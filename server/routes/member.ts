import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import { estimateOneRepMax, PROGRESS_PHOTO_MAX_BYTES } from '../../shared/rules.ts';
import { monthKeyOf, toDateKey } from '../../shared/time.ts';
import { requireRole, type AppEnv } from '../context.ts';
import { tx } from '../db/index.ts';
import { audit } from '../lib/audit.ts';
import { newId } from '../lib/crypto.ts';
import { badRequest, conflict, HttpError, notFound } from '../lib/errors.ts';
import { sniffImage, stripJpegMetadata } from '../lib/storage.ts';
import { body, dateKey, id, text } from '../lib/validate.ts';
import { bookPtSession, ratePtSession } from '../services/booking.ts';
import { issueQrToken } from '../services/checkin.ts';
import { enrollInClass, leaveClass } from '../services/classes.ts';
import { addPtCredits, extendMembershipDays, pointsBalance, requireMember } from '../services/members.ts';

const setSchema = z.object({
  setNumber: z.number().int().min(1).max(50),
  reps: z.number().int().min(0).max(200),
  weightKg: z.number().min(0).max(1000),
  rpe: z.number().min(1).max(10).optional(),
  isPr: z.boolean().optional(),
});
const loggedExercise = z.object({
  exerciseId: z.string().max(80),
  exerciseName: text(1, 120),
  sets: z.array(setSchema).min(1).max(30),
});

/** Volume is recomputed on the server; the client's total is ignored. */
const volumeOf = (exercises: z.infer<typeof loggedExercise>[]) =>
  Math.round(exercises.reduce((acc, ex) => acc + ex.sets.reduce((s, x) => s + x.reps * x.weightKg, 0), 0) * 10) / 10;

export const memberRoutes = new Hono<AppEnv>()
  .use('*', async (c, next) => {
    requireRole(c, 'MEMBER');
    await next();
  })
  .post('/qr-token', c => {
    const actor = requireRole(c, 'MEMBER');
    const deps = c.get('deps');
    deps.limiters.qrIssue.consume(actor.id);
    return c.json(issueQrToken(deps, actor.id));
  })
  .patch('/profile', async c => {
    const actor = requireRole(c, 'MEMBER');
    const { db, now } = c.get('deps');
    const input = await body(c, z.object({ fitnessGoal: text(2, 160).optional(), healthNotes: text(0, 1000).optional() }));
    db.prepare(
      `UPDATE member_profiles SET fitness_goal = COALESCE(?, fitness_goal), health_notes = COALESCE(?, health_notes), version = version + 1, updated_at = ?
       WHERE user_id = ?`
    ).run(input.fitnessGoal ?? null, input.healthNotes ?? null, now().toISOString(), actor.id);
    return c.json({ ok: true });
  })
  .post('/workouts', async c => {
    const actor = requireRole(c, 'MEMBER');
    const { db, now } = c.get('deps');
    const input = await body(
      c,
      z.object({
        date: dateKey,
        title: text(1, 160),
        durationMinutes: z.number().int().min(1).max(600),
        moodRating: z.number().int().min(1).max(5),
        notes: text(0, 2000),
        exercises: z.array(loggedExercise).min(1).max(30),
      })
    );
    if (input.date > toDateKey(now())) throw badRequest('Tanggal latihan tidak boleh di masa depan.');
    const logId = newId('wl');
    const volume = volumeOf(input.exercises);
    const pr = input.exercises.some(e => e.sets.some(s => s.isPr));
    tx(db, () => {
      db.prepare(
        `INSERT INTO workout_logs (id, member_id, log_date, title, duration_minutes, mood_rating, notes, total_volume_kg, exercises, pr_achieved, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(logId, actor.id, input.date, input.title, input.durationMinutes, input.moodRating, input.notes, volume, JSON.stringify(input.exercises), pr ? 1 : 0, now().toISOString());
      audit(db, actor, 'LOG_WORKOUT', `Mencatat sesi "${input.title}" (${volume.toLocaleString('id-ID')} kg volume)`, c.get('ip'), now());
    });
    return c.json({ ok: true, id: logId, totalVolumeKg: volume }, 201);
  })
  .post('/personal-records', async c => {
    const actor = requireRole(c, 'MEMBER');
    const { db, now } = c.get('deps');
    const input = await body(c, z.object({ exerciseName: text(1, 120), weightKg: z.number().positive().max(1000), reps: z.number().int().min(1).max(50) }));
    const e1rm = estimateOneRepMax(input.weightKg, input.reps);
    const logId = newId('wl');
    db.prepare(
      `INSERT INTO workout_logs (id, member_id, log_date, title, duration_minutes, mood_rating, notes, total_volume_kg, exercises, pr_achieved, created_at)
       VALUES (?, ?, ?, ?, 1, 5, ?, ?, ?, 1, ?)`
    ).run(
      logId,
      actor.id,
      toDateKey(now()),
      `Rekor Pribadi (PR): ${input.exerciseName}`,
      `${input.weightKg} kg × ${input.reps} reps (estimasi 1RM ${e1rm} kg)`,
      Math.round(input.weightKg * input.reps),
      JSON.stringify([{ exerciseId: 'pr', exerciseName: input.exerciseName, sets: [{ setNumber: 1, weightKg: input.weightKg, reps: input.reps, isPr: true }] }]),
      now().toISOString()
    );
    return c.json({ ok: true, id: logId, estimatedOneRepMax: e1rm }, 201);
  })
  .put('/meal-plan/checks/:day', async c => {
    const actor = requireRole(c, 'MEMBER');
    const { db, now } = c.get('deps');
    const day = Number(c.req.param('day'));
    if (!Number.isInteger(day) || day < 0 || day > 6) throw badRequest('Hari tidak valid.');
    const { checked } = await body(c, z.object({ checked: z.boolean() }));
    tx(db, () => {
      const row = db.prepare('SELECT daily_checked FROM meal_plans WHERE member_id = ?').get(actor.id) as { daily_checked: string } | undefined;
      if (!row) throw notFound('Anda belum memiliki meal plan.');
      const arr = (JSON.parse(row.daily_checked) as boolean[]).slice(0, 7);
      while (arr.length < 7) arr.push(false);
      arr[day] = checked;
      db.prepare('UPDATE meal_plans SET daily_checked = ?, updated_at = ? WHERE member_id = ?').run(JSON.stringify(arr), now().toISOString(), actor.id);
    });
    return c.json({ ok: true });
  })
  .put('/nutrition-targets', async c => {
    const actor = requireRole(c, 'MEMBER');
    const { db, now } = c.get('deps');
    const t = await body(
      c,
      z.object({
        calories: z.number().int().min(800).max(8000),
        protein: z.number().int().min(0).max(600),
        carbs: z.number().int().min(0).max(1200),
        fat: z.number().int().min(0).max(400),
      })
    );
    const iso = now().toISOString();
    // A member without a coach plan gets a blank self-managed plan, never someone else's menu
    db.prepare(
      `INSERT INTO meal_plans (member_id, id, title, coach_id, target_calories, target_protein, target_carbs, target_fat, disclaimer, updated_at)
       VALUES (?, ?, 'Target Makro Mandiri', NULL, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(member_id) DO UPDATE SET target_calories = excluded.target_calories, target_protein = excluded.target_protein,
         target_carbs = excluded.target_carbs, target_fat = excluded.target_fat, version = version + 1, updated_at = excluded.updated_at`
    ).run(actor.id, newId('mp'), t.calories, t.protein, t.carbs, t.fat, 'Target dihitung otomatis dari kalkulator; bukan saran medis.', iso);
    return c.json({ ok: true });
  })
  .post('/weekly-checkins', async c => {
    const actor = requireRole(c, 'MEMBER');
    const { db, now } = c.get('deps');
    const input = await body(
      c,
      z.object({
        weightKg: z.number().min(25).max(350),
        energyScore: z.number().int().min(1).max(5),
        sleepHours: z.number().min(0).max(24),
        stressScore: z.number().int().min(1).max(5),
        dietAdherencePercent: z.number().int().min(0).max(100),
        notes: text(0, 2000),
      })
    );
    const today = toDateKey(now());
    if (db.prepare('SELECT 1 FROM weekly_checkins WHERE member_id = ? AND checkin_date = ?').get(actor.id, today)) {
      throw conflict('Anda sudah mengirim check-in hari ini.');
    }
    db.prepare(
      `INSERT INTO weekly_checkins (id, member_id, checkin_date, weight_kg, energy_score, sleep_hours, stress_score, diet_adherence_percent, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(newId('wc'), actor.id, today, input.weightKg, input.energyScore, input.sleepHours, input.stressScore, input.dietAdherencePercent, input.notes, now().toISOString());
    return c.json({ ok: true }, 201);
  })
  .post('/measurements', async c => {
    const actor = requireRole(c, 'MEMBER');
    const { db, now } = c.get('deps');
    const cm = z.number().min(10).max(300).optional();
    const input = await body(
      c,
      z.object({ date: dateKey.optional(), weightKg: z.number().min(25).max(350), chestCm: cm, waistCm: cm, armCm: cm, thighCm: cm, bodyFatPercent: z.number().min(2).max(70).optional() })
    );
    const date = input.date ?? toDateKey(now());
    if (date > toDateKey(now())) throw badRequest('Tanggal pengukuran tidak boleh di masa depan.');
    db.prepare(
      `INSERT INTO body_measurements (id, member_id, measured_date, weight_kg, chest_cm, waist_cm, arm_cm, thigh_cm, body_fat_percent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(newId('bm'), actor.id, date, input.weightKg, input.chestCm ?? null, input.waistCm ?? null, input.armCm ?? null, input.thighCm ?? null, input.bodyFatPercent ?? null, now().toISOString());
    return c.json({ ok: true }, 201);
  })
  .post(
    '/photos',
    bodyLimit({ maxSize: Math.ceil((PROGRESS_PHOTO_MAX_BYTES * 4) / 3) + 64 * 1024, onError: () => { throw new HttpError(413, 'Foto terlalu besar (maksimal 5 MB).'); } }),
    async c => {
      const actor = requireRole(c, 'MEMBER');
      const { db, now, storage, limiters } = c.get('deps');
      limiters.upload.consume(actor.id);
      const input = await body(c, z.object({ dataUrl: z.string().max(8_000_000), notes: text(0, 500), weightKg: z.number().min(0).max(350).optional() }));
      const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(input.dataUrl);
      if (!match) throw badRequest('Format foto tidak didukung. Gunakan JPG, PNG, atau WebP.');
      let data: Buffer = Buffer.from(match[2], 'base64');
      if (data.length > PROGRESS_PHOTO_MAX_BYTES) throw new HttpError(413, 'Foto terlalu besar (maksimal 5 MB).');
      const mime = sniffImage(data);
      if (!mime) throw badRequest('File bukan gambar yang valid.');
      if (mime === 'image/jpeg') {
        const stripped = stripJpegMetadata(data);
        if (!stripped) throw badRequest('File JPEG rusak atau tidak valid.');
        data = stripped;
      }
      const key = storage.save(data, mime);
      const photoId = newId('pp');
      try {
        db.prepare(
          `INSERT INTO progress_photos (id, member_id, photo_date, weight_kg, storage_key, mime_type, size_bytes, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(photoId, actor.id, toDateKey(now()), input.weightKg ?? 0, key, mime, data.length, input.notes, now().toISOString());
      } catch (err) {
        storage.remove(key);
        throw err;
      }
      return c.json({ ok: true, id: photoId }, 201);
    }
  )
  .delete('/photos/:id', c => {
    const actor = requireRole(c, 'MEMBER');
    const { db, storage } = c.get('deps');
    const row = db.prepare('SELECT storage_key FROM progress_photos WHERE id = ? AND member_id = ?').get(c.req.param('id'), actor.id) as
      | { storage_key: string }
      | undefined;
    if (!row) throw notFound('Foto tidak ditemukan.');
    db.prepare('DELETE FROM progress_photos WHERE id = ?').run(c.req.param('id'));
    storage.remove(row.storage_key);
    return c.json({ ok: true });
  })
  .post('/pt-sessions', async c => {
    const actor = requireRole(c, 'MEMBER');
    const deps = c.get('deps');
    deps.limiters.writes.consume(`book:${actor.id}`);
    const input = await body(c, z.object({ coachId: id, date: dateKey, time: z.string().max(5), notes: text(0, 500).optional() }));
    return c.json({ ok: true, ...bookPtSession(deps, actor, input, c.get('ip')) }, 201);
  })
  .post('/pt-sessions/:id/rating', async c => {
    const actor = requireRole(c, 'MEMBER');
    const input = await body(c, z.object({ rating: z.number().int().min(1).max(5), comment: text(0, 1000) }));
    ratePtSession(c.get('deps'), actor, c.req.param('id'), input.rating, input.comment, c.get('ip'));
    return c.json({ ok: true });
  })
  .post('/classes/:id/enrollment', c => {
    const actor = requireRole(c, 'MEMBER');
    const res = enrollInClass(c.get('deps'), actor, c.req.param('id'), c.get('ip'));
    return c.json({ ok: true, message: `Berhasil mendaftar kelas ${res.name}.` }, 201);
  })
  .delete('/classes/:id/enrollment', c => {
    const actor = requireRole(c, 'MEMBER');
    const res = leaveClass(c.get('deps'), actor, c.req.param('id'), actor.id, c.get('ip'));
    return c.json({ ok: true, message: `Reservasi kelas ${res.name} dibatalkan.` });
  })
  .post('/surveys', async c => {
    const actor = requireRole(c, 'MEMBER');
    const { db, now } = c.get('deps');
    const score = z.number().int().min(1).max(5);
    const input = await body(
      c,
      z.object({ cleanliness: score, equipment: score, atmosphere: score, service: score, npsScore: z.number().int().min(0).max(10), suggestions: text(0, 2000), isComplaint: z.boolean() })
    );
    const today = toDateKey(now());
    tx(db, () => {
      try {
        db.prepare(
          `INSERT INTO satisfaction_surveys (id, member_id, survey_month, survey_date, cleanliness, equipment, atmosphere, service, nps_score, suggestions, is_complaint)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(newId('sat'), actor.id, monthKeyOf(today), today, input.cleanliness, input.equipment, input.atmosphere, input.service, input.npsScore, input.suggestions, input.isComplaint ? 1 : 0);
      } catch (err) {
        if (String((err as { code?: string }).code).startsWith('SQLITE_CONSTRAINT')) {
          throw conflict('Anda sudah mengisi survei bulan ini. Survei berikutnya dibuka bulan depan.');
        }
        throw err;
      }
      if (input.isComplaint) {
        db.prepare(
          `INSERT INTO feedback_tickets (id, member_id, member_name, ticket_date, category, text, status, created_at) VALUES (?, ?, ?, ?, 'Pelayanan', ?, 'BARU', ?)`
        ).run(newId('tkt'), actor.id, actor.name, today, input.suggestions || 'Keluhan dari survei bulanan (tanpa keterangan).', now().toISOString());
      }
      audit(db, actor, 'SUBMIT_SURVEY', `Survei kepuasan bulanan (NPS ${input.npsScore}/10)`, c.get('ip'), now());
    });
    return c.json({ ok: true }, 201);
  })
  .post('/tickets', async c => {
    const actor = requireRole(c, 'MEMBER');
    const { db, now, limiters } = c.get('deps');
    limiters.writes.consume(`ticket:${actor.id}`);
    const input = await body(c, z.object({ category: z.enum(['Fasilitas', 'Kebersihan', 'Pelayanan', 'Coach', 'Lainnya']), text: text(5, 2000) }));
    db.prepare(
      `INSERT INTO feedback_tickets (id, member_id, member_name, ticket_date, category, text, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'BARU', ?)`
    ).run(newId('tkt'), actor.id, actor.name, toDateKey(now()), input.category, input.text, now().toISOString());
    return c.json({ ok: true }, 201);
  })
  .post('/equipment-reports', async c => {
    const actor = requireRole(c, 'MEMBER');
    const { db, now, limiters } = c.get('deps');
    limiters.writes.consume(`eq:${actor.id}`);
    const input = await body(c, z.object({ equipmentId: id, issue: text(5, 1000) }));
    tx(db, () => {
      const eq = db.prepare('SELECT name, status FROM equipment WHERE id = ?').get(input.equipmentId) as { name: string; status: string } | undefined;
      if (!eq) throw notFound('Alat tidak ditemukan.');
      db.prepare(
        `INSERT INTO equipment_reports (id, equipment_id, member_id, member_name, issue_description, report_date, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?)`
      ).run(newId('rep'), input.equipmentId, actor.id, actor.name, input.issue, toDateKey(now()), now().toISOString());
      if (eq.status === 'OPERATIONAL') db.prepare("UPDATE equipment SET status = 'NEEDS_SERVICE' WHERE id = ?").run(input.equipmentId);
      audit(db, actor, 'REPORT_EQUIPMENT_ISSUE', `Laporan kerusakan ${eq.name}: "${input.issue.slice(0, 80)}"`, c.get('ip'), now());
    });
    return c.json({ ok: true }, 201);
  })
  .post('/rewards/:id/claim', c => {
    const actor = requireRole(c, 'MEMBER');
    const { db, now } = c.get('deps');
    const rewardId = c.req.param('id');
    const message = tx(db, () => {
      const reward = db.prepare('SELECT * FROM referral_rewards WHERE id = ? AND is_active = 1').get(rewardId) as
        | { id: string; title: string; points_required: number; category: 'MEMBERSHIP' | 'COACHING' | 'MERCHANDISE' }
        | undefined;
      if (!reward) throw notFound('Hadiah tidak ditemukan.');
      if (db.prepare('SELECT 1 FROM reward_claims WHERE member_id = ? AND reward_id = ?').get(actor.id, rewardId)) throw conflict('Hadiah ini sudah Anda klaim.');
      const balance = pointsBalance(db, actor.id);
      if (balance < reward.points_required) throw conflict(`Poin tidak mencukupi (perlu ${reward.points_required}, Anda punya ${balance}).`);
      const member = requireMember(db, actor.id);
      if (member.suspended && reward.category !== 'MERCHANDISE') throw conflict('Keanggotaan sedang ditangguhkan. Hubungi resepsionis.');
      const claimId = newId('clm');
      db.prepare('INSERT INTO reward_claims (id, member_id, reward_id, created_at) VALUES (?, ?, ?, ?)').run(claimId, actor.id, rewardId, now().toISOString());
      db.prepare(
        "INSERT INTO points_ledger (id, member_id, delta, reason, ref_type, ref_id, created_at) VALUES (?, ?, ?, ?, 'REWARD_CLAIM', ?, ?)"
      ).run(newId('pts'), actor.id, -reward.points_required, `Tukar hadiah: ${reward.title}`, claimId, now().toISOString());
      let delivery = 'Tunjukkan konfirmasi ini ke resepsionis untuk mengambil barang.';
      if (reward.category === 'MEMBERSHIP') {
        const end = extendMembershipDays(db, actor.id, 7, now());
        delivery = `Masa aktif bertambah 7 hari (s/d ${end}).`;
      } else if (reward.category === 'COACHING') {
        addPtCredits(db, actor.id, 1, now());
        delivery = '1 sesi PT ditambahkan ke saldo Anda.';
      }
      audit(db, actor, 'CLAIM_REFERRAL_REWARD', `Menukar ${reward.points_required} poin: "${reward.title}"`, c.get('ip'), now());
      return `Berhasil menukar "${reward.title}". ${delivery}`;
    });
    return c.json({ ok: true, message });
  });

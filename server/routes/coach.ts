import { Hono } from 'hono';
import { z } from 'zod';
import { requireRole, type AppEnv } from '../context.ts';
import { tx } from '../db/index.ts';
import { audit } from '../lib/audit.ts';
import { newId } from '../lib/crypto.ts';
import { forbidden, notFound } from '../lib/errors.ts';
import { body, id, text, timeKey } from '../lib/validate.ts';
import { completePtSession, setAvailability } from '../services/booking.ts';
import { assertCoachAccess } from '../services/members.ts';

const programExercise = z.object({
  exerciseId: z.string().max(80),
  exerciseName: text(1, 120),
  sets: z.number().int().min(1).max(20),
  reps: text(1, 20),
  targetRpe: z.number().min(1).max(10).optional(),
  restSeconds: z.number().int().min(0).max(900),
  notes: text(0, 300).optional(),
});
const programDay = z.object({
  dayNumber: z.number().int().min(1).max(7),
  dayName: text(1, 40),
  focus: text(1, 120),
  exercises: z.array(programExercise).min(1).max(20),
});
const mealItem = z.object({
  mealTime: z.enum(['Sarapan', 'Makan Siang', 'Snack Sore', 'Makan Malam', 'Pre/Post Workout']),
  foodName: text(1, 200),
  portion: text(0, 200),
  calories: z.number().min(0).max(5000),
  protein: z.number().min(0).max(500),
  carbs: z.number().min(0).max(800),
  fat: z.number().min(0).max(300),
});

export const coachRoutes = new Hono<AppEnv>()
  .use('*', async (c, next) => {
    requireRole(c, 'COACH');
    await next();
  })
  .post('/programs', async c => {
    const actor = requireRole(c, 'COACH');
    const { db, now } = c.get('deps');
    const input = await body(
      c,
      z.object({
        title: text(3, 160),
        description: text(0, 2000),
        target: z.enum(['Hipertrofi', 'Fat Loss', 'Kekuatan', 'Kebugaran Umum']),
        level: z.enum(['Pemula', 'Menengah', 'Lanjutan']),
        frequencyPerWeek: z.number().int().min(1).max(7),
        durationWeeks: z.number().int().min(1).max(52),
        assignedToMemberId: id.nullable().optional(),
        days: z.array(programDay).min(1).max(7),
      })
    );
    if (input.assignedToMemberId) assertCoachAccess(db, actor.id, input.assignedToMemberId);
    const programId = newId('prog');
    tx(db, () => {
      db.prepare(
        `INSERT INTO workout_programs (id, title, description, target, level, frequency_per_week, duration_weeks, assigned_to_member_id, created_by_coach_id, days, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(programId, input.title, input.description, input.target, input.level, input.frequencyPerWeek, input.durationWeeks, input.assignedToMemberId ?? null, actor.id, JSON.stringify(input.days), now().toISOString());
      audit(db, actor, 'CREATE_PROGRAM', `Membuat program "${input.title}"`, c.get('ip'), now());
    });
    return c.json({ ok: true, id: programId }, 201);
  })
  .post('/programs/:id/assign', async c => {
    const actor = requireRole(c, 'COACH');
    const { db, now } = c.get('deps');
    const { memberId } = await body(c, z.object({ memberId: id.nullable() }));
    const program = db.prepare('SELECT title, created_by_coach_id FROM workout_programs WHERE id = ?').get(c.req.param('id')) as
      | { title: string; created_by_coach_id: string | null }
      | undefined;
    if (!program) throw notFound('Program tidak ditemukan.');
    if (program.created_by_coach_id !== actor.id) throw forbidden('Hanya pembuat program yang dapat menugaskannya.');
    if (memberId) assertCoachAccess(db, actor.id, memberId);
    db.prepare('UPDATE workout_programs SET assigned_to_member_id = ? WHERE id = ?').run(memberId, c.req.param('id'));
    audit(db, actor, 'ASSIGN_PROGRAM', memberId ? `Program "${program.title}" ditugaskan ke klien ${memberId}` : `Program "${program.title}" dijadikan template umum`, c.get('ip'), now());
    return c.json({ ok: true });
  })
  .post('/workouts/:id/feedback', async c => {
    const actor = requireRole(c, 'COACH');
    const { db, now } = c.get('deps');
    const { comment } = await body(c, z.object({ comment: text(1, 2000) }));
    const log = db.prepare('SELECT member_id, title FROM workout_logs WHERE id = ?').get(c.req.param('id')) as { member_id: string; title: string } | undefined;
    if (!log) throw notFound('Catatan latihan tidak ditemukan.');
    assertCoachAccess(db, actor.id, log.member_id);
    db.prepare('UPDATE workout_logs SET coach_feedback = ? WHERE id = ?').run(comment, c.req.param('id'));
    audit(db, actor, 'COACH_FEEDBACK', `Komentar pada latihan "${log.title}"`, c.get('ip'), now());
    return c.json({ ok: true });
  })
  .put('/meal-plans/:memberId', async c => {
    const actor = requireRole(c, 'COACH');
    const { db, now } = c.get('deps');
    const memberId = c.req.param('memberId');
    assertCoachAccess(db, actor.id, memberId);
    const p = await body(
      c,
      z.object({
        title: text(2, 160),
        targetCalories: z.number().int().min(800).max(8000),
        targetProtein: z.number().int().min(0).max(600),
        targetCarbs: z.number().int().min(0).max(1200),
        targetFat: z.number().int().min(0).max(400),
        meals: z.array(mealItem).max(20),
        shoppingList: z.array(text(1, 200)).max(50),
        hydrationTargetLiters: z.number().min(0.5).max(10),
        supplementsAdvice: text(0, 1000),
        disclaimer: text(0, 1000),
      })
    );
    const iso = now().toISOString();
    db.prepare(
      `INSERT INTO meal_plans (member_id, id, title, coach_id, target_calories, target_protein, target_carbs, target_fat, meals, shopping_list,
         hydration_target_liters, supplements_advice, disclaimer, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(member_id) DO UPDATE SET title = excluded.title, coach_id = excluded.coach_id, target_calories = excluded.target_calories,
         target_protein = excluded.target_protein, target_carbs = excluded.target_carbs, target_fat = excluded.target_fat, meals = excluded.meals,
         shopping_list = excluded.shopping_list, hydration_target_liters = excluded.hydration_target_liters,
         supplements_advice = excluded.supplements_advice, disclaimer = excluded.disclaimer, version = version + 1, updated_at = excluded.updated_at`
    ).run(memberId, newId('mp'), p.title, actor.id, p.targetCalories, p.targetProtein, p.targetCarbs, p.targetFat, JSON.stringify(p.meals), JSON.stringify(p.shoppingList), p.hydrationTargetLiters, p.supplementsAdvice, p.disclaimer, iso);
    audit(db, actor, 'UPDATE_MEAL_PLAN', `Meal plan "${p.title}" untuk klien ${memberId}`, c.get('ip'), now());
    return c.json({ ok: true });
  })
  .post('/weekly-checkins/:id/reply', async c => {
    const actor = requireRole(c, 'COACH');
    const { db, now } = c.get('deps');
    const { reply } = await body(c, z.object({ reply: text(1, 2000) }));
    const row = db.prepare('SELECT member_id FROM weekly_checkins WHERE id = ?').get(c.req.param('id')) as { member_id: string } | undefined;
    if (!row) throw notFound('Check-in tidak ditemukan.');
    assertCoachAccess(db, actor.id, row.member_id);
    db.prepare('UPDATE weekly_checkins SET coach_reply = ?, replied_by = ? WHERE id = ?').run(reply, actor.id, c.req.param('id'));
    audit(db, actor, 'REPLY_CHECKIN', `Membalas check-in mingguan klien ${row.member_id}`, c.get('ip'), now());
    return c.json({ ok: true });
  })
  .put('/availability', async c => {
    const actor = requireRole(c, 'COACH');
    const { days } = await body(
      c,
      z.object({
        days: z
          .array(z.object({ dayOfWeek: z.number().int().min(0).max(6), startTime: timeKey, endTime: timeKey, isAvailable: z.boolean() }))
          .length(7)
          .refine(d => new Set(d.map(x => x.dayOfWeek)).size === 7, 'setiap hari harus muncul sekali'),
      })
    );
    setAvailability(c.get('deps'), actor, days, c.get('ip'));
    return c.json({ ok: true });
  })
  .post('/pt-sessions/:id/close', async c => {
    const actor = requireRole(c, 'COACH');
    const input = await body(c, z.object({ status: z.enum(['COMPLETED', 'NO_SHOW']), feedback: text(0, 2000).optional() }));
    completePtSession(c.get('deps'), actor, c.req.param('id'), input.status, input.feedback, c.get('ip'));
    return c.json({ ok: true });
  });

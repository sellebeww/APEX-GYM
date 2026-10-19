import { Hono } from 'hono';
import { z } from 'zod';
import { rupiah } from '../../shared/money.ts';
import { GYM_CAPACITY } from '../../shared/rules.ts';
import { addDaysToKey, toDateKey } from '../../shared/time.ts';
import { requireRole, type AppEnv } from '../context.ts';
import { tx } from '../db/index.ts';
import { audit } from '../lib/audit.ts';
import { hashPassword, newId, temporaryPassword } from '../lib/crypto.ts';
import { assertVersion, badRequest, conflict, notFound } from '../lib/errors.ts';
import { body, dateKey, id, rupiahAmount, text, timeKey, version } from '../lib/validate.ts';
import { processCheckIn, setOccupancy } from '../services/checkin.ts';
import { createClass, deleteClass, leaveClass, updateClass, type ClassInput } from '../services/classes.ts';
import { extendMembershipDays, requireMember } from '../services/members.ts';
import { getPayment, refundPayment, settlePayment } from '../services/payments.ts';

const classSchema = z.object({
  name: text(3, 120),
  category: z.enum(['Strength', 'HIIT', 'Pilates', 'Mobility', 'Powerlifting', 'Agility']),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: timeKey,
  endTime: timeKey,
  coachId: id,
  room: text(2, 80),
  maxCapacity: z.number().int().min(1).max(200),
  intensity: z.enum(['Sedang', 'Tinggi', 'Intens']),
  description: text(0, 1000),
  version,
});

export const adminRoutes = new Hono<AppEnv>()
  .use('*', async (c, next) => {
    requireRole(c, 'ADMIN');
    await next();
  })
  .post('/check-ins', async c => {
    const actor = requireRole(c, 'ADMIN');
    const deps = c.get('deps');
    deps.limiters.checkIn.consume(actor.id);
    const { code } = await body(c, z.object({ code: z.string().trim().min(1, 'kode kosong').max(600) }));
    return c.json(processCheckIn(deps, actor, code, c.get('ip')));
  })
  .put('/occupancy', async c => {
    const actor = requireRole(c, 'ADMIN');
    const { db, now } = c.get('deps');
    const { count } = await body(c, z.object({ count: z.number().int().min(0).max(GYM_CAPACITY * 3) }));
    setOccupancy(db, actor, count, now(), c.get('ip'));
    return c.json({ ok: true });
  })
  .patch('/members/:id', async c => {
    const actor = requireRole(c, 'ADMIN');
    const { db, now } = c.get('deps');
    const memberId = c.req.param('id');
    const input = await body(
      c,
      z.object({
        suspended: z.boolean().optional(),
        assignedCoachId: id.nullable().optional(),
        extendDays: z.number().int().min(1).max(366).optional(),
        reason: text(0, 300).optional(),
        version,
      })
    );
    const message = tx(db, () => {
      const m = requireMember(db, memberId);
      assertVersion(m.version, input.version);
      const notes: string[] = [];
      if (input.extendDays) {
        if (!input.reason || input.reason.length < 3) throw badRequest('Tuliskan alasan perpanjangan gratis (untuk audit).');
        const end = extendMembershipDays(db, memberId, input.extendDays, now());
        notes.push(`masa aktif +${input.extendDays} hari s/d ${end} (alasan: ${input.reason})`);
        audit(db, actor, 'EXTEND_MEMBERSHIP', `${m.name}: +${input.extendDays} hari s/d ${end}. Alasan: ${input.reason}`, c.get('ip'), now());
      }
      if (input.suspended !== undefined && input.suspended !== (m.suspended === 1)) {
        db.prepare('UPDATE member_profiles SET suspended = ?, version = version + 1, updated_at = ? WHERE user_id = ?').run(input.suspended ? 1 : 0, now().toISOString(), memberId);
        notes.push(input.suspended ? 'ditangguhkan' : 'diaktifkan kembali');
        audit(db, actor, input.suspended ? 'SUSPEND_MEMBER' : 'REACTIVATE_MEMBER', `${m.name} ${input.suspended ? 'ditangguhkan' : 'diaktifkan kembali'}${input.reason ? `. Alasan: ${input.reason}` : ''}`, c.get('ip'), now());
      }
      if (input.assignedCoachId !== undefined && input.assignedCoachId !== m.assigned_coach_id) {
        if (input.assignedCoachId && !db.prepare("SELECT 1 FROM users WHERE id = ? AND role = 'COACH' AND is_active = 1").get(input.assignedCoachId)) {
          throw badRequest('Coach tidak valid.');
        }
        db.prepare('UPDATE member_profiles SET assigned_coach_id = ?, version = version + 1, updated_at = ? WHERE user_id = ?').run(input.assignedCoachId, now().toISOString(), memberId);
        notes.push(input.assignedCoachId ? 'coach diperbarui' : 'coach dilepas');
        audit(db, actor, input.assignedCoachId ? 'ASSIGN_COACH' : 'UNASSIGN_COACH', `${m.name} ${input.assignedCoachId ? `ditugaskan ke ${input.assignedCoachId}` : 'dilepas dari coach'}`, c.get('ip'), now());
      }
      return notes.length ? `${m.name}: ${notes.join(', ')}.` : 'Tidak ada perubahan.';
    });
    return c.json({ ok: true, message });
  })
  /** Front-desk password reset: a one-time temporary password the member must change at next login. */
  .post('/users/:id/reset-password', async c => {
    const actor = requireRole(c, 'ADMIN');
    const { db, now } = c.get('deps');
    const target = db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(c.req.param('id')) as { id: string; name: string; role: string } | undefined;
    if (!target) throw notFound('Akun tidak ditemukan.');
    if (target.id === actor.id) throw badRequest('Gunakan menu ganti password untuk akun Anda sendiri.');
    const temp = temporaryPassword();
    const hash = await hashPassword(temp);
    tx(db, () => {
      db.prepare('UPDATE users SET password_hash = ?, must_change_password = 1, failed_logins = 0, locked_until = NULL, updated_at = ? WHERE id = ?').run(hash, now().toISOString(), target.id);
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(target.id);
      audit(db, actor, 'RESET_PASSWORD', `Password sementara dibuat untuk ${target.name}; semua sesi dikeluarkan`, c.get('ip'), now());
    });
    // Shown once to the admin, never stored in plain text or logged
    return c.json({ ok: true, temporaryPassword: temp });
  })
  .patch('/coaches/:id', async c => {
    const actor = requireRole(c, 'ADMIN');
    const { db, now } = c.get('deps');
    const coachId = c.req.param('id');
    const input = await body(c, z.object({ commissionRatePercent: z.number().int().min(0).max(100).optional(), isPublicApproved: z.boolean().optional(), version }));
    tx(db, () => {
      const cp = db.prepare('SELECT full_name, version FROM coach_profiles WHERE user_id = ?').get(coachId) as { full_name: string; version: number } | undefined;
      if (!cp) throw notFound('Coach tidak ditemukan.');
      assertVersion(cp.version, input.version);
      db.prepare(
        `UPDATE coach_profiles SET commission_rate_percent = COALESCE(?, commission_rate_percent), is_public_approved = COALESCE(?, is_public_approved), version = version + 1
         WHERE user_id = ?`
      ).run(input.commissionRatePercent ?? null, input.isPublicApproved === undefined ? null : input.isPublicApproved ? 1 : 0, coachId);
      const parts = [
        input.commissionRatePercent !== undefined ? `komisi ${input.commissionRatePercent}%` : '',
        input.isPublicApproved !== undefined ? (input.isPublicApproved ? 'tampil di situs publik' : 'disembunyikan dari situs publik') : '',
      ].filter(Boolean);
      audit(db, actor, 'UPDATE_COACH', `${cp.full_name}: ${parts.join(', ')}`, c.get('ip'), now());
    });
    return c.json({ ok: true });
  })
  .post('/expenses', async c => {
    const actor = requireRole(c, 'ADMIN');
    const { db, now } = c.get('deps');
    const input = await body(
      c,
      z.object({
        title: text(3, 160),
        amount: rupiahAmount,
        category: z.enum(['SALARY', 'RENT', 'ELECTRICITY', 'EQUIPMENT_MAINTENANCE', 'MARKETING', 'OTHER']),
        date: dateKey,
        notes: text(0, 500).optional(),
      })
    );
    if (input.date > addDaysToKey(toDateKey(now()), 31)) throw badRequest('Tanggal pengeluaran terlalu jauh di masa depan.');
    tx(db, () => {
      db.prepare('INSERT INTO expenses (id, title, amount, category, expense_date, notes, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
        newId('exp'),
        input.title,
        input.amount,
        input.category,
        input.date,
        input.notes ?? null,
        actor.id,
        now().toISOString()
      );
      audit(db, actor, 'ADD_EXPENSE', `Pengeluaran "${input.title}" ${rupiah(input.amount)} (${input.date})`, c.get('ip'), now());
    });
    return c.json({ ok: true }, 201);
  })
  .delete('/expenses/:id', c => {
    const actor = requireRole(c, 'ADMIN');
    const { db, now } = c.get('deps');
    tx(db, () => {
      const e = db.prepare('SELECT title, amount FROM expenses WHERE id = ?').get(c.req.param('id')) as { title: string; amount: number } | undefined;
      if (!e) throw notFound('Pengeluaran tidak ditemukan.');
      db.prepare('DELETE FROM expenses WHERE id = ?').run(c.req.param('id'));
      audit(db, actor, 'DELETE_EXPENSE', `Pengeluaran "${e.title}" ${rupiah(e.amount)} dihapus`, c.get('ip'), now());
    });
    return c.json({ ok: true });
  })
  /** Front-desk confirmation of a cash payment (the only way a CASH order becomes paid). */
  .post('/payments/:id/confirm-cash', c => {
    const actor = requireRole(c, 'ADMIN');
    const { db, now } = c.get('deps');
    const p = getPayment(db, c.req.param('id'));
    if (!p) throw notFound('Pembayaran tidak ditemukan.');
    if (p.provider !== 'CASH') throw conflict('Pembayaran digital hanya dapat dikonfirmasi oleh payment gateway.');
    const res = settlePayment(db, p.id, actor, now(), c.get('ip'));
    if (!res.applied) throw conflict('Pembayaran ini sudah diproses sebelumnya.');
    return c.json({ ok: true, message: `${p.invoice_number} dikonfirmasi lunas.` });
  })
  .post('/payments/:id/refund', async c => {
    const actor = requireRole(c, 'ADMIN');
    const { db, now } = c.get('deps');
    const { reason } = await body(c, z.object({ reason: text(5, 300) }));
    const res = refundPayment(db, c.req.param('id'), actor, reason, now(), c.get('ip'));
    if (!res.changed) throw conflict('Pembayaran ini sudah di-refund.');
    return c.json({
      ok: true,
      message:
        res.payment.provider === 'MIDTRANS'
          ? 'Refund dicatat dan hak member ditarik. Kembalikan dananya lewat dashboard Midtrans.'
          : 'Refund dicatat dan hak member ditarik.',
    });
  })
  .patch('/tickets/:id', async c => {
    const actor = requireRole(c, 'ADMIN');
    const { db, now } = c.get('deps');
    const input = await body(c, z.object({ status: z.enum(['BARU', 'DIPROSES', 'SELESAI']), adminResponse: text(0, 2000).optional() }));
    const res = db
      .prepare('UPDATE feedback_tickets SET status = ?, admin_response = COALESCE(?, admin_response), resolved_at = ? WHERE id = ?')
      .run(input.status, input.adminResponse || null, input.status === 'SELESAI' ? toDateKey(now()) : null, c.req.param('id'));
    if (!res.changes) throw notFound('Tiket tidak ditemukan.');
    audit(db, actor, 'UPDATE_TICKET', `Tiket ${c.req.param('id')} → ${input.status}`, c.get('ip'), now());
    return c.json({ ok: true });
  })
  .post('/testimonials/:id/toggle', c => {
    const actor = requireRole(c, 'ADMIN');
    const { db, now } = c.get('deps');
    const res = db.prepare('UPDATE testimonials SET approved_for_public = 1 - approved_for_public WHERE id = ?').run(c.req.param('id'));
    if (!res.changes) throw notFound('Testimoni tidak ditemukan.');
    audit(db, actor, 'TOGGLE_TESTIMONIAL', `Visibilitas testimoni ${c.req.param('id')} diubah`, c.get('ip'), now());
    return c.json({ ok: true });
  })
  .post('/announcements', async c => {
    const actor = requireRole(c, 'ADMIN');
    const { db, now } = c.get('deps');
    const a = await body(
      c,
      z.object({
        title: text(3, 160),
        content: text(5, 2000),
        type: z.enum(['INFO', 'PENTING', 'GYM_TUTUP', 'PROMO']),
        targetRole: z.enum(['ALL', 'MEMBER', 'COACH']),
        startDate: dateKey,
        endDate: dateKey,
        isPinned: z.boolean(),
        isPublished: z.boolean(),
      })
    );
    if (a.endDate < a.startDate) throw badRequest('Tanggal berakhir harus sama atau setelah tanggal mulai.');
    tx(db, () => {
      db.prepare(
        `INSERT INTO announcements (id, title, content, type, target_role, start_date, end_date, is_pinned, is_published, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(newId('ann'), a.title, a.content, a.type, a.targetRole, a.startDate, a.endDate, a.isPinned ? 1 : 0, a.isPublished ? 1 : 0, now().toISOString());
      audit(db, actor, 'ADD_ANNOUNCEMENT', `Pengumuman "${a.title}" (${a.type})`, c.get('ip'), now());
    });
    return c.json({ ok: true }, 201);
  })
  .post('/announcements/:id/toggle-publish', async c => {
    const actor = requireRole(c, 'ADMIN');
    const { db, now } = c.get('deps');
    const input = await body(c, z.object({ version }));
    tx(db, () => {
      const a = db.prepare('SELECT title, is_published, version FROM announcements WHERE id = ?').get(c.req.param('id')) as
        | { title: string; is_published: number; version: number }
        | undefined;
      if (!a) throw notFound('Pengumuman tidak ditemukan.');
      assertVersion(a.version, input.version);
      db.prepare('UPDATE announcements SET is_published = 1 - is_published, version = version + 1 WHERE id = ?').run(c.req.param('id'));
      audit(db, actor, 'TOGGLE_ANNOUNCEMENT', `"${a.title}" ${a.is_published ? 'ditarik ke draft' : 'diterbitkan'}`, c.get('ip'), now());
    });
    return c.json({ ok: true });
  })
  .delete('/announcements/:id', c => {
    const actor = requireRole(c, 'ADMIN');
    const { db, now } = c.get('deps');
    tx(db, () => {
      const a = db.prepare('SELECT title FROM announcements WHERE id = ?').get(c.req.param('id')) as { title: string } | undefined;
      if (!a) throw notFound('Pengumuman tidak ditemukan.');
      db.prepare('DELETE FROM announcements WHERE id = ?').run(c.req.param('id'));
      audit(db, actor, 'DELETE_ANNOUNCEMENT', `Pengumuman "${a.title}" dihapus`, c.get('ip'), now());
    });
    return c.json({ ok: true });
  })
  .post('/classes', async c => {
    const actor = requireRole(c, 'ADMIN');
    const input = await body(c, classSchema);
    return c.json({ ok: true, ...createClass(c.get('deps'), actor, input as ClassInput, c.get('ip')) }, 201);
  })
  .put('/classes/:id', async c => {
    const actor = requireRole(c, 'ADMIN');
    const input = await body(c, classSchema);
    updateClass(c.get('deps'), actor, c.req.param('id'), input as ClassInput, input.version, c.get('ip'));
    return c.json({ ok: true });
  })
  .delete('/classes/:id', c => {
    const actor = requireRole(c, 'ADMIN');
    const res = deleteClass(c.get('deps'), actor, c.req.param('id'), c.get('ip'));
    return c.json({ ok: true, message: `Kelas dihapus; ${res.cancelled} reservasi dibatalkan.` });
  })
  .delete('/classes/:id/enrollments/:memberId', c => {
    const actor = requireRole(c, 'ADMIN');
    leaveClass(c.get('deps'), actor, c.req.param('id'), c.req.param('memberId'), c.get('ip'));
    return c.json({ ok: true });
  })
  .patch('/equipment/:id', async c => {
    const actor = requireRole(c, 'ADMIN');
    const { db, now } = c.get('deps');
    const { status } = await body(c, z.object({ status: z.enum(['OPERATIONAL', 'NEEDS_SERVICE', 'UNDER_MAINTENANCE']) }));
    const res = db
      .prepare('UPDATE equipment SET status = ?, last_service_date = CASE WHEN ? = \'OPERATIONAL\' AND status <> \'OPERATIONAL\' THEN ? ELSE last_service_date END WHERE id = ?')
      .run(status, status, toDateKey(now()), c.req.param('id'));
    if (!res.changes) throw notFound('Alat tidak ditemukan.');
    audit(db, actor, 'UPDATE_EQUIPMENT_STATUS', `Status alat ${c.req.param('id')} → ${status}`, c.get('ip'), now());
    return c.json({ ok: true });
  })
  .patch('/equipment-reports/:id', async c => {
    const actor = requireRole(c, 'ADMIN');
    const { db, now } = c.get('deps');
    const input = await body(c, z.object({ status: z.enum(['PENDING', 'IN_PROGRESS', 'RESOLVED']), adminNotes: text(0, 1000).optional() }));
    tx(db, () => {
      const r = db.prepare('SELECT equipment_id FROM equipment_reports WHERE id = ?').get(c.req.param('id')) as { equipment_id: string } | undefined;
      if (!r) throw notFound('Laporan tidak ditemukan.');
      db.prepare('UPDATE equipment_reports SET status = ?, admin_notes = COALESCE(?, admin_notes) WHERE id = ?').run(input.status, input.adminNotes ?? null, c.req.param('id'));
      if (input.status === 'RESOLVED') {
        const open = db.prepare("SELECT 1 FROM equipment_reports WHERE equipment_id = ? AND status <> 'RESOLVED' LIMIT 1").get(r.equipment_id);
        // Closing the last open ticket brings the unit back into service
        if (!open) db.prepare("UPDATE equipment SET status = 'OPERATIONAL', last_service_date = ? WHERE id = ?").run(toDateKey(now()), r.equipment_id);
      } else if (input.status === 'IN_PROGRESS') {
        db.prepare("UPDATE equipment SET status = 'UNDER_MAINTENANCE' WHERE id = ? AND status <> 'UNDER_MAINTENANCE'").run(r.equipment_id);
      }
      audit(db, actor, 'UPDATE_EQUIPMENT_REPORT', `Laporan ${c.req.param('id')} → ${input.status}`, c.get('ip'), now());
    });
    return c.json({ ok: true });
  });

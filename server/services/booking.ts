import { cancellationRefundsCredit, PT_BOOKING_HORIZON_DAYS, PT_SESSION_MINUTES, PT_SLOT_TIMES } from '../../shared/rules.ts';
import { dayOfWeekOfKey, daysBetweenKeys, gymInstant, minutesOfDay, toDateKey } from '../../shared/time.ts';
import type { Actor, Deps } from '../context.ts';
import { tx, type DB } from '../db/index.ts';
import { audit } from '../lib/audit.ts';
import { newId } from '../lib/crypto.ts';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.ts';
import { membershipState, requireMember } from './members.ts';

const toHm = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

/** Does the coach teach a group class that overlaps this weekday/time window? */
export function coachTeachesAt(db: DB, coachId: string, dayOfWeek: number, start: string, end: string, excludeClassId?: string): string | null {
  const row = db
    .prepare(
      `SELECT name FROM group_classes WHERE coach_id = ? AND day_of_week = ? AND start_time < ? AND end_time > ? AND id <> ? LIMIT 1`
    )
    .get(coachId, dayOfWeek, end, start, excludeClassId ?? '') as { name: string } | undefined;
  return row?.name ?? null;
}

export function bookPtSession(deps: Deps, actor: Actor, input: { coachId: string; date: string; time: string; notes?: string }, ip: string) {
  const { db } = deps;
  const now = deps.now();
  if (!(PT_SLOT_TIMES as readonly string[]).includes(input.time)) throw badRequest('Jam sesi tidak tersedia. Pilih salah satu slot yang ditawarkan.');
  const startsAt = gymInstant(input.date, input.time);
  if (startsAt.getTime() <= now.getTime()) throw badRequest('Waktu sesi sudah lewat. Pilih slot berikutnya.');
  if (daysBetweenKeys(toDateKey(now), input.date) > PT_BOOKING_HORIZON_DAYS) {
    throw badRequest(`Booking paling jauh ${PT_BOOKING_HORIZON_DAYS} hari ke depan.`);
  }
  const endsAt = new Date(startsAt.getTime() + PT_SESSION_MINUTES * 60_000);
  const endTime = toHm(minutesOfDay(input.time) + PT_SESSION_MINUTES);

  return tx(db, () => {
    const member = requireMember(db, actor.id);
    if (!membershipState(member, now).hasAccess) throw conflict('Membership tidak aktif. Perpanjang paket untuk booking sesi PT.');
    if (member.pt_sessions_remaining <= 0) throw conflict('Sisa sesi PT habis. Beli paket PT terlebih dahulu.');

    const coach = db
      .prepare("SELECT u.name FROM users u JOIN coach_profiles cp ON cp.user_id = u.id WHERE u.id = ? AND u.role = 'COACH' AND u.is_active = 1")
      .get(input.coachId) as { name: string } | undefined;
    if (!coach) throw notFound('Coach tidak ditemukan.');

    const dow = dayOfWeekOfKey(input.date);
    const rule = db.prepare('SELECT * FROM coach_availability WHERE coach_id = ? AND day_of_week = ?').get(input.coachId, dow) as
      | { start_time: string; end_time: string; is_available: number }
      | undefined;
    if (!rule || !rule.is_available || input.time < rule.start_time || endTime > rule.end_time) {
      throw conflict('Coach tidak bertugas pada hari/jam tersebut. Pilih slot lain.');
    }
    const cls = coachTeachesAt(db, input.coachId, dow, input.time, endTime);
    if (cls) throw conflict(`Coach sedang mengajar kelas "${cls}" pada jam tersebut.`);

    const overlap = db
      .prepare(
        `SELECT coach_id, member_id FROM training_sessions
         WHERE status = 'SCHEDULED' AND (coach_id = ? OR member_id = ?) AND starts_at < ? AND ends_at > ? LIMIT 1`
      )
      .get(input.coachId, actor.id, endsAt.toISOString(), startsAt.toISOString()) as { coach_id: string; member_id: string } | undefined;
    if (overlap) {
      throw conflict(overlap.member_id === actor.id ? 'Anda sudah punya sesi PT di jam yang sama.' : 'Slot ini sudah diisi member lain. Pilih jam lain.');
    }

    const debit = db
      .prepare(
        `UPDATE member_profiles SET pt_sessions_remaining = pt_sessions_remaining - 1,
           assigned_coach_id = COALESCE(assigned_coach_id, ?), version = version + 1, updated_at = ?
         WHERE user_id = ? AND pt_sessions_remaining > 0`
      )
      .run(input.coachId, now.toISOString(), actor.id);
    if (debit.changes !== 1) throw conflict('Sisa sesi PT habis.');

    const id = newId('ts');
    db.prepare(
      `INSERT INTO training_sessions (id, member_id, coach_id, session_date, session_time, starts_at, ends_at, duration_minutes, status, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'SCHEDULED', ?, ?)`
    ).run(id, actor.id, input.coachId, input.date, input.time, startsAt.toISOString(), endsAt.toISOString(), PT_SESSION_MINUTES, input.notes || null, now.toISOString());
    audit(db, actor, 'BOOK_PT_SESSION', `${member.name} booking PT dengan ${coach.name} pada ${input.date} ${input.time}`, ip, now);
    return { id };
  });
}

interface SessionRow {
  id: string;
  member_id: string;
  coach_id: string;
  status: string;
  starts_at: string;
  session_date: string;
  session_time: string;
  rating: number | null;
}

function getSession(db: DB, id: string): SessionRow {
  const s = db.prepare('SELECT * FROM training_sessions WHERE id = ?').get(id) as SessionRow | undefined;
  if (!s) throw notFound('Sesi tidak ditemukan.');
  return s;
}

/** Cancels a scheduled session; the credit is returned per the 12-hour member policy. */
export function cancelPtSession(deps: Deps, actor: Actor, sessionId: string, ip: string) {
  const { db } = deps;
  const now = deps.now();
  return tx(db, () => {
    const s = getSession(db, sessionId);
    if (actor.role === 'MEMBER' && s.member_id !== actor.id) throw forbidden();
    if (actor.role === 'COACH' && s.coach_id !== actor.id) throw forbidden();
    if (s.status !== 'SCHEDULED') throw conflict('Sesi ini sudah tidak terjadwal.');
    const startsAt = new Date(s.starts_at);
    if (startsAt.getTime() <= now.getTime()) throw conflict('Sesi sudah dimulai; tandai selesai atau tidak hadir.');
    const refund = cancellationRefundsCredit({ startsAt, now, cancelledBy: actor.role });
    db.prepare(
      "UPDATE training_sessions SET status = 'CANCELLED', cancelled_by = ?, cancelled_at = ?, credit_refunded = ? WHERE id = ? AND status = 'SCHEDULED'"
    ).run(actor.role, now.toISOString(), refund ? 1 : 0, s.id);
    if (refund) {
      db.prepare('UPDATE member_profiles SET pt_sessions_remaining = pt_sessions_remaining + 1, version = version + 1, updated_at = ? WHERE user_id = ?').run(
        now.toISOString(),
        s.member_id
      );
    }
    audit(db, actor, 'CANCEL_PT_SESSION', `Sesi ${s.session_date} ${s.session_time} dibatalkan oleh ${actor.role}; kuota ${refund ? 'dikembalikan' : 'hangus (< 12 jam)'}`, ip, now);
    return { refunded: refund };
  });
}

/** Coach (or admin) closes a session after it started. */
export function completePtSession(deps: Deps, actor: Actor, sessionId: string, status: 'COMPLETED' | 'NO_SHOW', feedback: string | undefined, ip: string) {
  const { db } = deps;
  const now = deps.now();
  return tx(db, () => {
    const s = getSession(db, sessionId);
    if (actor.role === 'COACH' && s.coach_id !== actor.id) throw forbidden();
    if (s.status !== 'SCHEDULED') throw conflict('Sesi ini sudah ditutup.');
    if (new Date(s.starts_at).getTime() > now.getTime()) throw conflict('Sesi belum dimulai. Gunakan "Batalkan" untuk sesi yang akan datang.');
    db.prepare('UPDATE training_sessions SET status = ?, coach_feedback = COALESCE(?, coach_feedback) WHERE id = ?').run(status, feedback || null, s.id);
    audit(db, actor, 'CLOSE_PT_SESSION', `Sesi ${s.session_date} ${s.session_time} ditandai ${status}`, ip, now);
  });
}

export function ratePtSession(deps: Deps, actor: Actor, sessionId: string, rating: number, comment: string, ip: string) {
  const { db } = deps;
  const now = deps.now();
  return tx(db, () => {
    const s = getSession(db, sessionId);
    if (s.member_id !== actor.id) throw forbidden();
    if (s.status !== 'COMPLETED') throw conflict('Hanya sesi yang sudah selesai yang bisa dinilai.');
    if (s.rating !== null) throw conflict('Sesi ini sudah Anda nilai.');
    db.prepare('UPDATE training_sessions SET rating = ?, review_comment = ? WHERE id = ?').run(rating, comment || null, s.id);
    audit(db, actor, 'RATE_PT_SESSION', `Rating ${rating}/5 untuk sesi ${s.session_date}`, ip, now);
  });
}

/** Coach weekly hours; refuses to hide hours that already have booked sessions. */
export function setAvailability(
  deps: Deps,
  actor: Actor,
  days: { dayOfWeek: number; startTime: string; endTime: string; isAvailable: boolean }[],
  ip: string
) {
  const { db } = deps;
  const now = deps.now();
  tx(db, () => {
    for (const d of days) {
      if (d.isAvailable && d.endTime <= d.startTime) throw badRequest('Jam selesai harus setelah jam mulai.');
    }
    const upcoming = db
      .prepare("SELECT session_date, session_time FROM training_sessions WHERE coach_id = ? AND status = 'SCHEDULED' AND starts_at > ?")
      .all(actor.id, now.toISOString()) as { session_date: string; session_time: string }[];
    for (const s of upcoming) {
      const d = days.find(x => x.dayOfWeek === dayOfWeekOfKey(s.session_date));
      if (!d) continue;
      const end = toHm(minutesOfDay(s.session_time) + PT_SESSION_MINUTES);
      if (!d.isAvailable || s.session_time < d.startTime || end > d.endTime) {
        throw conflict(`Ada sesi terjadwal ${s.session_date} ${s.session_time} di luar jam baru. Batalkan/pindahkan sesi itu dulu.`);
      }
    }
    const upsert = db.prepare(
      `INSERT INTO coach_availability (coach_id, day_of_week, start_time, end_time, is_available) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(coach_id, day_of_week) DO UPDATE SET start_time = excluded.start_time, end_time = excluded.end_time, is_available = excluded.is_available`
    );
    for (const d of days) upsert.run(actor.id, d.dayOfWeek, d.startTime, d.endTime, d.isAvailable ? 1 : 0);
    audit(db, actor, 'UPDATE_AVAILABILITY', 'Coach memperbarui jam ketersediaan mingguan', ip, now);
  });
}


export type SlotReason = 'AVAILABLE' | 'PAST' | 'OFF' | 'TAKEN' | 'CLASS' | 'MINE';

/**
 * Availability of every bookable slot for one coach on one date, computed with the same rules the
 * booking endpoint enforces. It reveals only whether a slot is free, never who booked it.
 */
export function coachSlots(db: DB, coachId: string, date: string, memberId: string | null, now: Date) {
  const dow = dayOfWeekOfKey(date);
  const rule = db.prepare('SELECT * FROM coach_availability WHERE coach_id = ? AND day_of_week = ?').get(coachId, dow) as
    | { start_time: string; end_time: string; is_available: number }
    | undefined;
  return PT_SLOT_TIMES.map(time => {
    const startsAt = gymInstant(date, time);
    const endsAt = new Date(startsAt.getTime() + PT_SESSION_MINUTES * 60_000);
    const endTime = toHm(minutesOfDay(time) + PT_SESSION_MINUTES);
    let reason: SlotReason = 'AVAILABLE';
    if (startsAt.getTime() <= now.getTime()) reason = 'PAST';
    else if (!rule || !rule.is_available || time < rule.start_time || endTime > rule.end_time) reason = 'OFF';
    else if (coachTeachesAt(db, coachId, dow, time, endTime)) reason = 'CLASS';
    else {
      const clash = db
        .prepare("SELECT member_id FROM training_sessions WHERE status = 'SCHEDULED' AND (coach_id = ? OR member_id = ?) AND starts_at < ? AND ends_at > ? LIMIT 1")
        .get(coachId, memberId ?? '', endsAt.toISOString(), startsAt.toISOString()) as { member_id: string } | undefined;
      if (clash) reason = clash.member_id === memberId ? 'MINE' : 'TAKEN';
    }
    return { time, available: reason === 'AVAILABLE', reason };
  });
}

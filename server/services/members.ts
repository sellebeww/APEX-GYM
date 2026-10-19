import { computeRefundEndDate, computeRenewal, deriveMembershipStatus, getDaysRemaining } from '../../shared/membership.ts';
import { addDaysToKey, daysBetweenKeys, toDateKey } from '../../shared/time.ts';
import type { DB } from '../db/index.ts';
import { forbidden, notFound } from '../lib/errors.ts';

export interface MemberRow {
  user_id: string;
  plan_id: string | null;
  plan_name: string;
  start_date: string | null;
  end_date: string | null;
  suspended: number;
  assigned_coach_id: string | null;
  pt_sessions_remaining: number;
  referral_code: string;
  referred_by: string | null;
  version: number;
  name: string;
  is_active: number;
}

export function getMember(db: DB, memberId: string): MemberRow | undefined {
  return db
    .prepare(
      `SELECT mp.*, u.name, u.is_active FROM member_profiles mp JOIN users u ON u.id = mp.user_id
       WHERE mp.user_id = ? AND u.role = 'MEMBER'`
    )
    .get(memberId) as MemberRow | undefined;
}

export function requireMember(db: DB, memberId: string): MemberRow {
  const m = getMember(db, memberId);
  if (!m) throw notFound('Member tidak ditemukan.');
  return m;
}

export function membershipState(m: Pick<MemberRow, 'end_date' | 'suspended'>, now: Date) {
  const status = deriveMembershipStatus({ endDate: m.end_date, suspended: m.suspended === 1 }, now);
  return { status, hasAccess: status !== 'EXPIRED', daysRemaining: getDaysRemaining(m.end_date, now) };
}

/**
 * A coach may see and act on a member's data only when the member is assigned to them
 * or has booked a session with them. Everything coach-facing goes through this check.
 */
export function coachCanAccessMember(db: DB, coachId: string, memberId: string): boolean {
  const row = db
    .prepare(
      `SELECT 1 FROM member_profiles WHERE user_id = ? AND assigned_coach_id = ?
       UNION SELECT 1 FROM training_sessions WHERE member_id = ? AND coach_id = ? LIMIT 1`
    )
    .get(memberId, coachId, memberId, coachId);
  return !!row;
}

export function assertCoachAccess(db: DB, coachId: string, memberId: string) {
  if (!coachCanAccessMember(db, coachId, memberId)) throw forbidden('Member ini bukan klien Anda.');
}

export function coachClientIds(db: DB, coachId: string): string[] {
  return (
    db
      .prepare(
        `SELECT user_id AS id FROM member_profiles WHERE assigned_coach_id = ?
         UNION SELECT DISTINCT member_id AS id FROM training_sessions WHERE coach_id = ?`
      )
      .all(coachId, coachId) as { id: string }[]
  ).map(r => r.id);
}

/** Consecutive gym-local days with at least one logged workout, ending today or yesterday. */
export function workoutStreak(trainingDays: string[], now: Date): number {
  const days = new Set(trainingDays);
  const today = toDateKey(now);
  let cursor = days.has(today) ? today : addDaysToKey(today, -1);
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = addDaysToKey(cursor, -1);
  }
  return streak;
}

/** Applies a purchased membership period. Returns the new end date. */
export function applyMembership(db: DB, memberId: string, plan: { id: string; name: string; durationDays: number }, now: Date): string {
  const m = requireMember(db, memberId);
  const { startDate, endDate } = computeRenewal({ startDate: m.start_date, endDate: m.end_date }, plan.durationDays, now);
  db.prepare(
    `UPDATE member_profiles SET plan_id = ?, plan_name = ?, start_date = ?, end_date = ?, version = version + 1, updated_at = ?
     WHERE user_id = ?`
  ).run(plan.id, plan.name, startDate, endDate, now.toISOString(), memberId);
  return endDate;
}

/** Extends access by a number of days (rewards, complimentary extensions). */
export function extendMembershipDays(db: DB, memberId: string, days: number, now: Date): string {
  const m = requireMember(db, memberId);
  const today = toDateKey(now);
  const valid = !!m.end_date && daysBetweenKeys(today, m.end_date) >= 0;
  const endDate = valid ? addDaysToKey(m.end_date!, days) : addDaysToKey(today, days - 1);
  db.prepare(
    `UPDATE member_profiles SET end_date = ?, start_date = COALESCE(CASE WHEN ? THEN start_date END, ?), version = version + 1, updated_at = ?
     WHERE user_id = ?`
  ).run(endDate, valid ? 1 : 0, today, now.toISOString(), memberId);
  return endDate;
}

export function reverseMembership(db: DB, memberId: string, durationDays: number, now: Date): string | null {
  const m = requireMember(db, memberId);
  if (!m.end_date) return null;
  const endDate = computeRefundEndDate(m.end_date, durationDays, now);
  db.prepare('UPDATE member_profiles SET end_date = ?, version = version + 1, updated_at = ? WHERE user_id = ?').run(
    endDate,
    now.toISOString(),
    memberId
  );
  return endDate;
}

export function addPtCredits(db: DB, memberId: string, sessions: number, now: Date) {
  db.prepare(
    `UPDATE member_profiles SET pt_sessions_remaining = MAX(0, pt_sessions_remaining + ?), version = version + 1, updated_at = ?
     WHERE user_id = ?`
  ).run(sessions, now.toISOString(), memberId);
}

export function pointsBalance(db: DB, memberId: string): number {
  return (db.prepare('SELECT COALESCE(SUM(delta), 0) AS p FROM points_ledger WHERE member_id = ?').get(memberId) as { p: number }).p;
}

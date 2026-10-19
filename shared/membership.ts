import { addDaysToKey, daysBetweenKeys, toDateKey } from './time.ts';

export type MembershipStatus = 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED';

/** Members with this many days (or fewer) left are flagged as "expiring soon". */
export const EXPIRING_SOON_DAYS = 7;

/**
 * Whole calendar days between today (gym-local) and the membership end date.
 * The end date is the *last valid day*: 0 = ends today (still valid), negative = expired.
 */
export function calendarDaysUntil(endDate: string | undefined | null, now: Date = new Date()): number {
  if (!endDate) return -1;
  return daysBetweenKeys(toDateKey(now), endDate);
}

/** Days left on a membership, never negative. */
export function getDaysRemaining(endDate: string | undefined | null, now: Date = new Date()): number {
  return Math.max(0, calendarDaysUntil(endDate, now));
}

/** Status is always derived from the end date and suspension flag, never stored. */
export function deriveMembershipStatus(
  profile: { endDate?: string | null; suspended?: boolean | null },
  now: Date = new Date()
): MembershipStatus {
  if (profile.suspended) return 'EXPIRED';
  const days = calendarDaysUntil(profile.endDate, now);
  if (days < 0) return 'EXPIRED';
  if (days <= EXPIRING_SOON_DAYS) return 'EXPIRING_SOON';
  return 'ACTIVE';
}

/**
 * New access period after buying `durationDays` of membership.
 * - Still valid: the new days stack after the current end date.
 * - Lapsed (or never active): the period starts today and lasts exactly `durationDays` days (inclusive).
 * Suspension does not change the arithmetic; lifting a suspension is a separate admin action.
 */
export function computeRenewal(
  current: { startDate?: string | null; endDate?: string | null },
  durationDays: number,
  now: Date = new Date()
): { startDate: string; endDate: string } {
  if (!Number.isInteger(durationDays) || durationDays <= 0) throw new Error('durationDays must be a positive integer');
  const today = toDateKey(now);
  const stillValid = !!current.endDate && daysBetweenKeys(today, current.endDate) >= 0;
  if (stillValid) {
    return { startDate: current.startDate || today, endDate: addDaysToKey(current.endDate!, durationDays) };
  }
  return { startDate: today, endDate: addDaysToKey(today, durationDays - 1) };
}

/** Reverses a refunded purchase without ever moving the end date before yesterday. */
export function computeRefundEndDate(endDate: string, durationDays: number, now: Date = new Date()): string {
  const reduced = addDaysToKey(endDate, -durationDays);
  const floor = addDaysToKey(toDateKey(now), -1);
  return daysBetweenKeys(floor, reduced) < 0 ? floor : reduced;
}

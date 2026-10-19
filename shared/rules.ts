/** Business constants shared by the API (enforcement) and the UI (explanations). */

/** Sessions a member cancels less than this many hours ahead forfeit their credit. */
export const PT_CANCEL_WINDOW_HOURS = 12;
export const PT_SESSION_MINUTES = 60;
/** Bookable 1-on-1 slots (gym-local start times). */
export const PT_SLOT_TIMES = ['07:00', '09:00', '11:00', '14:00', '16:00', '18:00', '19:30'] as const;
/** Members can book at most this many days ahead. */
export const PT_BOOKING_HORIZON_DAYS = 60;

/** Lifetime of a member's QR entry token. */
export const QR_TOKEN_TTL_SECONDS = 60;
/** A second granted entry within this window is treated as a duplicate scan. */
export const DOUBLE_CHECKIN_WINDOW_MIN = 20;
/** A granted check-in counts towards live occupancy for this long. */
export const OCCUPANCY_WINDOW_MIN = 120;
export const GYM_CAPACITY = 100;

/** Points credited to the referrer when the referred member's first membership payment succeeds. */
export const REFERRAL_BONUS_POINTS = 100;

/** Unpaid orders a member may have open at the same time (anti-spam). */
export const MAX_OPEN_ORDERS_PER_MEMBER = 3;

export const PROGRESS_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

/** Whether cancelling a scheduled session gives the credit back. */
export function cancellationRefundsCredit(args: { startsAt: Date; now: Date; cancelledBy: 'MEMBER' | 'COACH' | 'ADMIN' }): boolean {
  if (args.cancelledBy !== 'MEMBER') return true;
  const hoursLeft = (args.startsAt.getTime() - args.now.getTime()) / 3_600_000;
  return hoursLeft >= PT_CANCEL_WINDOW_HOURS;
}

/** Epley estimate, rounded to 0.5 kg. */
export function estimateOneRepMax(weightKg: number, reps: number): number {
  if (reps <= 1) return weightKg;
  return Math.round(weightKg * (1 + reps / 30) * 2) / 2;
}

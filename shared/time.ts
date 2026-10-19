/**
 * Calendar & clock helpers pinned to the gym's own time zone.
 *
 * Every business date (membership end date, PT slot, report month) is a *gym-local* calendar date,
 * independent of the visitor's device clock or the server's TZ setting. Indonesia does not observe
 * daylight saving, so a fixed UTC offset is exact.
 */
export const GYM_TIME_ZONE = 'Asia/Jakarta';
export const GYM_UTC_OFFSET = '+07:00';
export const GYM_TZ_LABEL = 'WIB';

const MS_PER_DAY = 86_400_000;
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const keyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: GYM_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const hmFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: GYM_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Gym-local calendar date (YYYY-MM-DD) of an instant. */
export function toDateKey(d: Date = new Date()): string {
  const parts = keyFormatter.formatToParts(d);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Gym-local wall-clock time (HH:MM) of an instant. */
export function toTimeKey(d: Date = new Date()): string {
  return hmFormatter.format(d);
}

export function isDateKey(s: unknown): s is string {
  if (typeof s !== 'string' || !DATE_KEY_RE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function isTimeKey(s: unknown): s is string {
  return typeof s === 'string' && TIME_RE.test(s);
}

/** Pure calendar arithmetic on a YYYY-MM-DD key (no time zone involved). */
export function addDaysToKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + days)).toISOString().slice(0, 10);
}

/** Whole calendar days from `fromKey` to `toKey` (negative when `toKey` is earlier). */
export function daysBetweenKeys(fromKey: string, toKey: string): number {
  const ms = (k: string) => {
    const [y, m, d] = k.split('-').map(Number);
    return Date.UTC(y, (m || 1) - 1, d || 1);
  };
  return Math.round((ms(toKey) - ms(fromKey)) / MS_PER_DAY);
}

/** 0 = Sunday … 6 = Saturday for a gym-local calendar date. */
export function dayOfWeekOfKey(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** The absolute instant of a gym-local date + wall-clock time. */
export function gymInstant(dateKey: string, time: string): Date {
  return new Date(`${dateKey}T${time}:00${GYM_UTC_OFFSET}`);
}

/** "HH:MM" -> minutes after midnight */
export function minutesOfDay(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** Gym-local month (YYYY-MM) of a date key or an ISO timestamp. */
export function monthKeyOf(isoOrKey: string): string {
  if (isoOrKey.length > 10) return toDateKey(new Date(isoOrKey)).slice(0, 7);
  return isoOrKey.slice(0, 7);
}

export const ID_DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as const;
export type IdDayName = (typeof ID_DAY_NAMES)[number];

/** Locale formatting that always shows gym-local time, whatever the device's zone. */
export function formatDateTimeId(iso: string, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Date(iso).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...opts,
    timeZone: GYM_TIME_ZONE,
  });
}

export function formatTimeId(iso: string, withSeconds = false): string {
  return new Date(iso).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    ...(withSeconds ? { second: '2-digit' } : {}),
    timeZone: GYM_TIME_ZONE,
  });
}

/** "1 Oktober 2026" (long) or "1 Okt 2026" (short) for a calendar date key. */
export function formatDateId(dateKey: string | undefined | null, style: 'long' | 'short' = 'long'): string {
  if (!dateKey) return '-';
  const [y, m, d] = dateKey.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return '-';
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: style === 'long' ? 'long' : 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

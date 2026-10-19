import { describe, expect, it } from 'vitest';
import { addDaysToKey, calendarDaysUntil, deriveMembershipStatus, getDaysRemaining, toDateKey } from '../membership';

const noon = (key: string) => new Date(`${key}T12:00:00`);

describe('membership dates', () => {
  it('counts calendar days, with today as day 0 (still valid)', () => {
    expect(calendarDaysUntil('2026-10-14', noon('2026-10-14'))).toBe(0);
    expect(calendarDaysUntil('2026-10-17', noon('2026-10-14'))).toBe(3);
    expect(calendarDaysUntil('2026-10-13', noon('2026-10-14'))).toBe(-1);
  });

  it('never reports negative days remaining', () => {
    expect(getDaysRemaining('2026-01-01', noon('2026-10-14'))).toBe(0);
    expect(getDaysRemaining(undefined, noon('2026-10-14'))).toBe(0);
  });

  it('treats the last day as valid all day (no off-by-one near midnight)', () => {
    const lateEvening = new Date('2026-10-14T23:30:00');
    expect(deriveMembershipStatus({ endDate: '2026-10-14' }, lateEvening)).toBe('EXPIRING_SOON');
    expect(deriveMembershipStatus({ endDate: '2026-10-13' }, lateEvening)).toBe('EXPIRED');
  });

  it('derives ACTIVE / EXPIRING_SOON / EXPIRED from the end date only', () => {
    const now = noon('2026-10-14');
    expect(deriveMembershipStatus({ endDate: '2026-12-01' }, now)).toBe('ACTIVE');
    expect(deriveMembershipStatus({ endDate: '2026-10-21' }, now)).toBe('EXPIRING_SOON'); // exactly 7 days
    expect(deriveMembershipStatus({ endDate: '2026-10-22' }, now)).toBe('ACTIVE');
    expect(deriveMembershipStatus({ endDate: '2026-10-10' }, now)).toBe('EXPIRED');
  });

  it('suspension overrides a valid end date', () => {
    expect(deriveMembershipStatus({ endDate: '2027-01-01', suspended: true }, noon('2026-10-14'))).toBe('EXPIRED');
  });

  it('adds days across month and year boundaries', () => {
    expect(addDaysToKey('2026-10-14', 30)).toBe('2026-11-13');
    expect(addDaysToKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysToKey('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('formats local date keys without UTC shifting', () => {
    expect(toDateKey(new Date(2026, 0, 5, 0, 30))).toBe('2026-01-05');
    expect(toDateKey(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });
});

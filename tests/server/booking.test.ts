import { beforeEach, describe, expect, it } from 'vitest';
import { setup, type TestEnv } from './helpers.ts';

let t: TestEnv;
let reza: string; // 6 PT credits in seed
let kevin: string; // 0 PT credits
let nadia: string;
let admin: string;
let hendra: string;

// T0 = Wed 14 Oct 2026 10:00 WIB. Mon 19 Oct is a working day for every coach.
const MONDAY = '2026-10-19';

const credits = (id: string) => (t.db.prepare('SELECT pt_sessions_remaining AS n FROM member_profiles WHERE user_id = ?').get(id) as { n: number }).n;

beforeEach(async () => {
  t = setup();
  [reza, kevin, nadia, admin, hendra] = await Promise.all(
    ['reza@gym.test', 'kevin@gym.test', 'nadia@gym.test', 'admin@gym.test', 'hendra@gym.test'].map(e => t.login(e))
  );
});

const book = (cookie: string, body: Record<string, unknown>) => t.call('POST', '/api/member/pt-sessions', { cookie, body });

describe('PT booking', () => {
  it('books a free slot and debits one credit atomically', async () => {
    const before = credits('member-reza');
    const res = await book(reza, { coachId: 'coach-hendra', date: MONDAY, time: '09:00' });
    expect(res.status).toBe(201);
    expect(credits('member-reza')).toBe(before - 1);
    const row = t.db.prepare('SELECT starts_at FROM training_sessions WHERE id = ?').get(res.json.id) as { starts_at: string };
    expect(row.starts_at).toBe('2026-10-19T02:00:00.000Z'); // 09:00 WIB
  });

  it('refuses a slot already taken by another member', async () => {
    await book(reza, { coachId: 'coach-hendra', date: MONDAY, time: '11:00' });
    const res = await book(nadia, { coachId: 'coach-hendra', date: MONDAY, time: '11:00' });
    expect(res.status).toBe(409);
    expect(credits('member-nadia')).toBe(2);
  });

  it('refuses booking without credits, in the past, off-slot, off-hours or on a day off', async () => {
    expect((await book(kevin, { coachId: 'coach-hendra', date: MONDAY, time: '09:00' })).status).toBe(409);
    expect((await book(reza, { coachId: 'coach-hendra', date: '2026-10-14', time: '07:00' })).status).toBe(400);
    expect((await book(reza, { coachId: 'coach-hendra', date: MONDAY, time: '09:30' })).status).toBe(400);
    expect((await book(reza, { coachId: 'coach-hendra', date: '2026-10-18', time: '09:00' })).status).toBe(409); // Sunday
    expect((await book(reza, { coachId: 'coach-hendra', date: '2027-03-01', time: '09:00' })).status).toBe(400); // beyond horizon
  });

  it('refuses a member double-booking themself at the same time', async () => {
    await book(reza, { coachId: 'coach-hendra', date: MONDAY, time: '14:00' });
    expect((await book(reza, { coachId: 'coach-sarah', date: MONDAY, time: '14:00' })).status).toBe(409);
  });

  it('refuses a slot that clashes with a class the coach teaches', async () => {
    // Seed: Hendra teaches "APEX Strength & Conditioning" Monday 07:00-08:00
    const res = await book(reza, { coachId: 'coach-hendra', date: MONDAY, time: '07:00' });
    expect(res.status).toBe(409);
    expect(res.json.error.message).toMatch(/mengajar kelas/);
  });

  it('expired members cannot book', async () => {
    const siti = await t.login('siti@gym.test');
    t.db.prepare('UPDATE member_profiles SET pt_sessions_remaining = 3 WHERE user_id = ?').run('member-siti');
    expect((await book(siti, { coachId: 'coach-hendra', date: MONDAY, time: '09:00' })).status).toBe(409);
  });
});

describe('PT cancellation policy (12 hours)', () => {
  it('returns the credit when the member cancels 12 hours or more ahead', async () => {
    const { id } = (await book(reza, { coachId: 'coach-hendra', date: MONDAY, time: '16:00' })).json;
    const after = credits('member-reza');
    const res = await t.call('POST', `/api/pt-sessions/${id}/cancel`, { cookie: reza });
    expect(res.json.refunded).toBe(true);
    expect(credits('member-reza')).toBe(after + 1);
  });

  it('forfeits the credit when the member cancels less than 12 hours ahead', async () => {
    const { id } = (await book(reza, { coachId: 'coach-hendra', date: MONDAY, time: '16:00' })).json;
    const after = credits('member-reza');
    t.clock.now = new Date('2026-10-18T21:01:00Z'); // 19 Oct 04:01 WIB = 11h59m before 16:00 WIB
    const res = await t.call('POST', `/api/pt-sessions/${id}/cancel`, { cookie: reza });
    expect(res.json.refunded).toBe(false);
    expect(credits('member-reza')).toBe(after);
  });

  it('exactly 12 hours ahead still refunds (boundary)', async () => {
    const { id } = (await book(reza, { coachId: 'coach-hendra', date: MONDAY, time: '16:00' })).json;
    t.clock.now = new Date('2026-10-18T21:00:00Z'); // 19 Oct 04:00 WIB = 12h before
    expect((await t.call('POST', `/api/pt-sessions/${id}/cancel`, { cookie: reza })).json.refunded).toBe(true);
  });

  it('a coach cancellation always refunds, even at short notice', async () => {
    const { id } = (await book(reza, { coachId: 'coach-hendra', date: MONDAY, time: '16:00' })).json;
    const after = credits('member-reza');
    t.clock.now = new Date('2026-10-19T08:00:00Z'); // 15:00 WIB, 1h before
    expect((await t.call('POST', `/api/pt-sessions/${id}/cancel`, { cookie: hendra })).json.refunded).toBe(true);
    expect(credits('member-reza')).toBe(after + 1);
  });

  it('sessions cannot be closed before they start, and are rated once', async () => {
    const { id } = (await book(reza, { coachId: 'coach-hendra', date: MONDAY, time: '16:00' })).json;
    expect((await t.call('POST', `/api/coach/pt-sessions/${id}/close`, { cookie: hendra, body: { status: 'COMPLETED' } })).status).toBe(409);
    t.clock.now = new Date('2026-10-19T10:00:00Z');
    expect((await t.call('POST', `/api/coach/pt-sessions/${id}/close`, { cookie: hendra, body: { status: 'COMPLETED' } })).status).toBe(200);
    expect((await t.call('POST', `/api/member/pt-sessions/${id}/rating`, { cookie: reza, body: { rating: 5, comment: 'Mantap' } })).status).toBe(200);
    expect((await t.call('POST', `/api/member/pt-sessions/${id}/rating`, { cookie: reza, body: { rating: 1, comment: '' } })).status).toBe(409);
  });

  it('coach ratings are computed from real reviews', async () => {
    const s = (await t.call('GET', '/api/state')).json;
    const hendraProfile = s.coachProfiles['coach-hendra'];
    const reviews = t.db.prepare("SELECT COUNT(*) AS n FROM training_sessions WHERE coach_id = 'coach-hendra' AND rating IS NOT NULL").get() as { n: number };
    expect(hendraProfile.reviewCount).toBe(reviews.n);
  });

  it('a coach cannot hide hours that already have bookings', async () => {
    await book(reza, { coachId: 'coach-hendra', date: MONDAY, time: '18:00' });
    const days = Array.from({ length: 7 }, (_, d) => ({ dayOfWeek: d, startTime: '07:00', endTime: d === 1 ? '17:00' : '21:00', isAvailable: d !== 0 }));
    expect((await t.call('PUT', '/api/coach/availability', { cookie: hendra, body: { days } })).status).toBe(409);
  });
});

describe('group classes', () => {
  it('enrols once, respects capacity and frees the seat on cancel', async () => {
    t.db.prepare("UPDATE group_classes SET max_capacity = (SELECT COUNT(*) FROM class_enrollments WHERE class_id = 'cls-2') + 1 WHERE id = 'cls-2'").run();
    expect((await t.call('POST', '/api/member/classes/cls-2/enrollment', { cookie: kevin })).status).toBe(201);
    expect((await t.call('POST', '/api/member/classes/cls-2/enrollment', { cookie: kevin })).status).toBe(409);
    const full = await t.call('POST', '/api/member/classes/cls-2/enrollment', { cookie: reza });
    expect(full.status).toBe(409);
    expect(full.json.error.message).toMatch(/penuh/);
    expect((await t.call('DELETE', '/api/member/classes/cls-2/enrollment', { cookie: kevin })).status).toBe(200);
    expect((await t.call('POST', '/api/member/classes/cls-2/enrollment', { cookie: reza })).status).toBe(201);
  });

  it('admins cannot create classes that clash on room or coach', async () => {
    const base = {
      name: 'Kelas Uji',
      category: 'HIIT',
      dayOfWeek: 2, // Selasa: seed has "HIIT & Core Shred" 18:30-19:30 in Main Studio A with Sarah
      startTime: '19:00',
      endTime: '20:00',
      coachId: 'coach-rio',
      room: 'Main Studio A',
      maxCapacity: 10,
      intensity: 'Tinggi',
      description: '',
    };
    expect((await t.call('POST', '/api/admin/classes', { cookie: admin, body: base })).status).toBe(409);
    expect((await t.call('POST', '/api/admin/classes', { cookie: admin, body: { ...base, room: 'Ruang Baru', coachId: 'coach-sarah' } })).status).toBe(409);
    expect((await t.call('POST', '/api/admin/classes', { cookie: admin, body: { ...base, room: 'Ruang Baru' } })).status).toBe(201);
    expect((await t.call('POST', '/api/admin/classes', { cookie: admin, body: { ...base, room: 'Ruang Lain', startTime: '20:00', endTime: '19:00' } })).status).toBe(400);
  });
});

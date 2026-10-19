import { beforeEach, describe, expect, it } from 'vitest';
import { REFERRAL_BONUS_POINTS } from '../../shared/rules.ts';
import { setup, type TestEnv } from './helpers.ts';

let t: TestEnv;
let admin: string;
const points = (id: string) => (t.db.prepare('SELECT COALESCE(SUM(delta),0) AS p FROM points_ledger WHERE member_id = ?').get(id) as { p: number }).p;
const codeOf = (id: string) => (t.db.prepare('SELECT referral_code AS c FROM member_profiles WHERE user_id = ?').get(id) as { c: string }).c;

beforeEach(async () => {
  t = setup();
  admin = await t.login('admin@gym.test');
});

async function registerWithCode(email: string, phone: string, code: string) {
  const res = await t.call('POST', '/api/auth/register', { body: { name: 'Teman Baru', email, phone, password: 'StrongPass123', referralCode: code.toLowerCase() } });
  expect(res.status).toBe(201);
  return res.cookie!;
}

async function buyAndConfirm(cookie: string) {
  const order = await t.call('POST', '/api/payments/orders', { cookie, body: { kind: 'MEMBERSHIP', itemId: 'plan-1m', method: 'MANUAL_CASH' } });
  await t.call('POST', `/api/admin/payments/${order.json.paymentId}/confirm-cash`, { cookie: admin });
}

describe('referral bonus', () => {
  it('is not paid at sign-up (fake accounts earn nothing)', async () => {
    const before = points('member-kevin');
    await registerWithCode('a@example.test', '0812-1111-0001', codeOf('member-kevin'));
    expect(points('member-kevin')).toBe(before);
  });

  it('is paid exactly once, on the referred member\'s first paid membership', async () => {
    const before = points('member-kevin');
    const friend = await registerWithCode('b@example.test', '0812-1111-0002', codeOf('member-kevin'));
    await buyAndConfirm(friend);
    expect(points('member-kevin')).toBe(before + REFERRAL_BONUS_POINTS);
    await buyAndConfirm(friend);
    expect(points('member-kevin')).toBe(before + REFERRAL_BONUS_POINTS);
    const kevin = await t.login('kevin@gym.test');
    const s = (await t.call('GET', '/api/state', { cookie: kevin })).json;
    expect(s.referral.referrals).toEqual([expect.objectContaining({ name: 'Teman', bonusEarned: true })]);
  });
});

describe('reward claims', () => {
  it('spends points, applies the reward and allows each reward once', async () => {
    const reza = await t.login('reza@gym.test');
    const before = t.db.prepare("SELECT end_date FROM member_profiles WHERE user_id = 'member-reza'").get() as { end_date: string };
    const res = await t.call('POST', '/api/member/rewards/ref-1/claim', { cookie: reza });
    expect(res.status).toBe(200);
    expect(points('member-reza')).toBe(150);
    const after = t.db.prepare("SELECT end_date FROM member_profiles WHERE user_id = 'member-reza'").get() as { end_date: string };
    expect(new Date(after.end_date).getTime() - new Date(before.end_date).getTime()).toBe(7 * 86_400_000);
    expect((await t.call('POST', '/api/member/rewards/ref-1/claim', { cookie: reza })).status).toBe(409);
  });

  it('refuses a claim without enough points and never goes negative', async () => {
    const reza = await t.login('reza@gym.test');
    expect((await t.call('POST', '/api/member/rewards/ref-4/claim', { cookie: reza })).status).toBe(409);
    expect(points('member-reza')).toBe(250);
    const results = await Promise.all([
      t.call('POST', '/api/member/rewards/ref-2/claim', { cookie: reza }),
      t.call('POST', '/api/member/rewards/ref-3/claim', { cookie: reza }),
    ]);
    expect(results.filter(r => r.status === 200).length).toBe(1);
    expect(points('member-reza')).toBeGreaterThanOrEqual(0);
  });
});

describe('surveys', () => {
  it('accepts one survey per member per month and turns complaints into tickets', async () => {
    const kevin = await t.login('kevin@gym.test');
    const body = { cleanliness: 4, equipment: 5, atmosphere: 4, service: 2, npsScore: 6, suggestions: 'AC area kardio kurang dingin', isComplaint: true };
    // Kevin's seed survey is in September (shifted), so October is open
    expect((await t.call('POST', '/api/member/surveys', { cookie: kevin, body })).status).toBe(201);
    expect((await t.call('POST', '/api/member/surveys', { cookie: kevin, body })).status).toBe(409);
    const ticket = t.db.prepare("SELECT text FROM feedback_tickets WHERE member_id = 'member-kevin' ORDER BY created_at DESC").get() as { text: string };
    expect(ticket.text).toMatch(/AC area kardio/);
  });
});

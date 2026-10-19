import { beforeEach, describe, expect, it } from 'vitest';
import { setup, type TestEnv } from './helpers.ts';

let t: TestEnv;
let reza: string;
let nadia: string;
let hendra: string; // Reza's coach
let sarah: string; // Nadia's coach
let admin: string;

beforeEach(async () => {
  t = setup();
  [reza, nadia, hendra, sarah, admin] = await Promise.all([
    t.login('reza@gym.test'),
    t.login('nadia@gym.test'),
    t.login('hendra@gym.test'),
    t.login('sarah@gym.test'),
    t.login('admin@gym.test'),
  ]);
});

describe('role gates', () => {
  it('blocks anonymous users from every protected area', async () => {
    for (const [m, p] of [
      ['POST', '/api/member/qr-token'],
      ['POST', '/api/admin/check-ins'],
      ['PUT', '/api/coach/availability'],
      ['POST', '/api/payments/orders'],
      ['POST', '/api/chat/messages'],
    ] as const) {
      expect((await t.call(m, p, { body: {} })).status, `${m} ${p}`).toBe(401);
    }
  });

  it('blocks members and coaches from admin endpoints', async () => {
    for (const cookie of [reza, hendra]) {
      expect((await t.call('POST', '/api/admin/check-ins', { cookie, body: { code: 'member-reza' } })).status).toBe(403);
      expect((await t.call('PATCH', '/api/admin/members/member-reza', { cookie, body: { extendDays: 30, reason: 'gratis' } })).status).toBe(403);
      expect((await t.call('POST', '/api/admin/payments/inv-101/refund', { cookie, body: { reason: 'coba refund' } })).status).toBe(403);
    }
  });

  it('blocks admins and coaches from buying or booking as a member', async () => {
    expect((await t.call('POST', '/api/payments/orders', { cookie: admin, body: { kind: 'MEMBERSHIP', itemId: 'plan-1m', method: 'QRIS' } })).status).toBe(403);
    expect((await t.call('POST', '/api/member/pt-sessions', { cookie: hendra, body: { coachId: 'coach-hendra', date: '2026-10-20', time: '09:00' } })).status).toBe(403);
  });
});

describe('snapshot isolation', () => {
  it('public visitors receive only aggregate, non-personal data', async () => {
    const s = (await t.call('GET', '/api/state')).json;
    expect(s.me).toBeNull();
    expect(s.users).toEqual([]);
    expect(s.memberProfiles).toEqual({});
    expect(s.payments).toEqual([]);
    expect(s.chatMessages).toEqual([]);
    expect(s.groupClasses.every((c: any) => c.enrolledMemberIds.length === 0)).toBe(true);
    expect(typeof s.publicStats.activeMembers).toBe('number');
    // Hidden coach profiles never reach the public site
    expect(Object.values(s.coachProfiles).every((c: any) => c.isPublicApproved)).toBe(true);
  });

  it('a member sees only their own records', async () => {
    const s = (await t.call('GET', '/api/state', { cookie: reza })).json;
    expect(Object.keys(s.memberProfiles)).toEqual(['member-reza']);
    expect(s.payments.every((p: any) => p.memberId === 'member-reza')).toBe(true);
    expect(s.checkIns.every((c: any) => c.memberId === 'member-reza')).toBe(true);
    expect(s.chatMessages.every((m: any) => m.threadMemberId === 'member-reza')).toBe(true);
    expect(s.users.filter((u: any) => u.role === 'MEMBER').map((u: any) => u.id)).toEqual(['member-reza']);
    expect(s.users.some((u: any) => u.role === 'ADMIN')).toBe(false);
    expect(s.auditLogs).toEqual([]);
    expect(s.expenses).toEqual([]);
    for (const c of s.groupClasses) expect(c.enrolledMemberIds.every((id: string) => id === 'member-reza')).toBe(true);
  });

  it('a coach sees only their own clients', async () => {
    const s = (await t.call('GET', '/api/state', { cookie: hendra })).json;
    const ids = Object.keys(s.memberProfiles);
    expect(ids).toContain('member-reza');
    expect(ids).not.toContain('member-nadia');
    expect(s.trainingSessions.every((x: any) => x.coachId === 'coach-hendra')).toBe(true);
    expect(s.chatMessages.every((m: any) => ids.includes(m.threadMemberId))).toBe(true);
    expect(s.payments).toEqual([]);
  });

  it('admins do not receive private coach chats', async () => {
    const s = (await t.call('GET', '/api/state', { cookie: admin })).json;
    expect(s.chatMessages).toEqual([]);
    expect(Object.keys(s.memberProfiles).length).toBeGreaterThan(5);
  });
});

describe('cross-member access (IDOR)', () => {
  it('a member cannot post into another member\'s chat thread', async () => {
    const res = await t.call('POST', '/api/chat/messages', { cookie: nadia, body: { text: 'halo', threadMemberId: 'member-reza' } });
    expect(res.status).toBe(403);
  });

  it('a coach cannot message, review or plan for someone else\'s client', async () => {
    expect((await t.call('POST', '/api/chat/messages', { cookie: sarah, body: { text: 'hai', threadMemberId: 'member-reza' } })).status).toBe(403);
    expect((await t.call('POST', '/api/coach/weekly-checkins/wcheck-1/reply', { cookie: sarah, body: { reply: 'bagus' } })).status).toBe(403);
    expect((await t.call('POST', '/api/coach/workouts/wl-1/feedback', { cookie: sarah, body: { comment: 'ok' } })).status).toBe(403);
    const plan = {
      title: 'Plan',
      targetCalories: 2000,
      targetProtein: 120,
      targetCarbs: 200,
      targetFat: 60,
      meals: [],
      shoppingList: [],
      hydrationTargetLiters: 2,
      supplementsAdvice: '',
      disclaimer: '',
    };
    expect((await t.call('PUT', '/api/coach/meal-plans/member-reza', { cookie: sarah, body: plan })).status).toBe(403);
    expect((await t.call('PUT', '/api/coach/meal-plans/member-reza', { cookie: hendra, body: plan })).status).toBe(200);
  });

  it('a member cannot cancel or rate another member\'s PT session', async () => {
    expect((await t.call('POST', '/api/pt-sessions/ts-1/cancel', { cookie: nadia })).status).toBe(403);
    expect((await t.call('POST', '/api/member/pt-sessions/ts-2/rating', { cookie: nadia, body: { rating: 1, comment: '' } })).status).toBe(403);
  });

  it('progress photos are readable only by the owner and their coach', async () => {
    const tinyJpeg =
      'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';
    const up = await t.call('POST', '/api/member/photos', { cookie: reza, body: { dataUrl: tinyJpeg, notes: 'minggu 1' } });
    expect(up.status).toBe(201);
    const url = `/api/photos/${up.json.id}`;
    expect((await t.call('GET', url, { cookie: reza })).status).toBe(200);
    expect((await t.call('GET', url, { cookie: hendra })).status).toBe(200);
    expect((await t.call('GET', url, { cookie: nadia })).status).toBe(404);
    expect((await t.call('GET', url, { cookie: sarah })).status).toBe(403);
    expect((await t.call('GET', url, { cookie: admin })).status).toBe(403);
    expect((await t.call('GET', url)).status).toBe(401);
  });

  it('rejects uploads that are not really images', async () => {
    const fake = `data:image/jpeg;base64,${Buffer.from('<script>alert(1)</script>').toString('base64')}`;
    expect((await t.call('POST', '/api/member/photos', { cookie: reza, body: { dataUrl: fake, notes: '' } })).status).toBe(400);
    expect((await t.call('POST', '/api/member/photos', { cookie: reza, body: { dataUrl: 'data:image/svg+xml;base64,PHN2Zz4=', notes: '' } })).status).toBe(400);
  });

  it('a coach can only assign programs to their own clients', async () => {
    const program = {
      title: 'Program Uji',
      description: '',
      target: 'Kekuatan',
      level: 'Pemula',
      frequencyPerWeek: 3,
      durationWeeks: 4,
      assignedToMemberId: 'member-nadia',
      days: [{ dayNumber: 1, dayName: 'Hari 1', focus: 'Full body', exercises: [{ exerciseId: 'ex-1', exerciseName: 'Bench', sets: 3, reps: '8-10', restSeconds: 90 }] }],
    };
    expect((await t.call('POST', '/api/coach/programs', { cookie: hendra, body: program })).status).toBe(403);
    expect((await t.call('POST', '/api/coach/programs', { cookie: hendra, body: { ...program, assignedToMemberId: 'member-reza' } })).status).toBe(201);
  });
});

describe('optimistic concurrency between admins', () => {
  it('rejects an edit made against a stale version', async () => {
    const s = (await t.call('GET', '/api/state', { cookie: admin })).json;
    const v = s.memberProfiles['member-kevin'].version;
    const first = await t.call('PATCH', '/api/admin/members/member-kevin', { cookie: admin, body: { suspended: true, version: v } });
    expect(first.status).toBe(200);
    const second = await t.call('PATCH', '/api/admin/members/member-kevin', { cookie: admin, body: { assignedCoachId: 'coach-rio', version: v } });
    expect(second.status).toBe(409);
    expect(second.json.error.code).toBe('STALE_VERSION');
  });

  it('requires a reason for complimentary extensions and audits them', async () => {
    expect((await t.call('PATCH', '/api/admin/members/member-siti', { cookie: admin, body: { extendDays: 7 } })).status).toBe(400);
    const ok = await t.call('PATCH', '/api/admin/members/member-siti', { cookie: admin, body: { extendDays: 7, reason: 'Kompensasi AC rusak' } });
    expect(ok.status).toBe(200);
    const log = t.db.prepare("SELECT details FROM audit_logs WHERE action = 'EXTEND_MEMBERSHIP'").get() as { details: string };
    expect(log.details).toMatch(/Kompensasi AC rusak/);
  });
});

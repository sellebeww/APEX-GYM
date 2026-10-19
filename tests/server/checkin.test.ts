import { beforeEach, describe, expect, it } from 'vitest';
import { signQrToken } from '../../server/lib/qr.ts';
import { setup, type TestEnv } from './helpers.ts';

let t: TestEnv;
let admin: string;
let reza: string;

beforeEach(async () => {
  t = setup();
  admin = await t.login('admin@gym.test');
  reza = await t.login('reza@gym.test');
});

const scan = (code: string) => t.call('POST', '/api/admin/check-ins', { cookie: admin, body: { code } });

describe('QR check-in', () => {
  it('admits an active member with a fresh server-signed token', async () => {
    const qr = await t.call('POST', '/api/member/qr-token', { cookie: reza });
    expect(qr.json.token).toMatch(/^APX1\./);
    const res = await scan(qr.json.token);
    expect(res.json.success).toBe(true);
    expect(res.json.checkIn.memberId).toBe('member-reza');
    expect(res.json.checkIn.method).toBe('QR');
  });

  it('accepts each token only once (replay protection)', async () => {
    const { token } = (await t.call('POST', '/api/member/qr-token', { cookie: reza })).json;
    await scan(token);
    t.advance(30 * 60_000); // past the double check-in window
    const replay = await scan(token);
    expect(replay.json.success).toBe(false);
  });

  it('rejects an expired token', async () => {
    const { token } = (await t.call('POST', '/api/member/qr-token', { cookie: reza })).json;
    t.advance(61_000);
    const res = await scan(token);
    expect(res.json.success).toBe(false);
    expect(res.json.message).toMatch(/kedaluwarsa/);
  });

  it('rejects tokens signed with another key or edited to another member', async () => {
    const forged = signQrToken('attacker-secret'.padEnd(40, 'z'), 'member-reza', 60, t.clock.now.getTime()).token;
    expect((await scan(forged)).json.success).toBe(false);
    const { token } = (await t.call('POST', '/api/member/qr-token', { cookie: reza })).json;
    const [prefix, payload, sig] = token.split('.');
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    data.m = 'member-kevin';
    const tampered = [prefix, Buffer.from(JSON.stringify(data)).toString('base64url'), sig].join('.');
    const res = await scan(tampered);
    expect(res.json.success).toBe(false);
    expect(res.json.message).toMatch(/tidak sah/);
  });

  it('blocks a double check-in inside 20 minutes', async () => {
    await scan((await t.call('POST', '/api/member/qr-token', { cookie: reza })).json.token);
    t.advance(5 * 60_000);
    const second = await scan((await t.call('POST', '/api/member/qr-token', { cookie: reza })).json.token);
    expect(second.json.success).toBe(false);
    expect(second.json.message).toMatch(/double check-in/);
  });

  it('serialises concurrent scans of the same token: exactly one is admitted', async () => {
    const { token } = (await t.call('POST', '/api/member/qr-token', { cookie: reza })).json;
    const results = await Promise.all([scan(token), scan(token), scan(token)]);
    expect(results.filter(r => r.json.success).length).toBe(1);
  });

  it('does not issue QR codes to expired or suspended members', async () => {
    const siti = await t.login('siti@gym.test');
    expect((await t.call('POST', '/api/member/qr-token', { cookie: siti })).status).toBe(409);
    const s = (await t.call('GET', '/api/state', { cookie: admin })).json;
    await t.call('PATCH', '/api/admin/members/member-reza', { cookie: admin, body: { suspended: true, version: s.memberProfiles['member-reza'].version } });
    expect((await t.call('POST', '/api/member/qr-token', { cookie: reza })).status).toBe(409);
  });

  it('denies a token minted before the membership was suspended', async () => {
    const { token } = (await t.call('POST', '/api/member/qr-token', { cookie: reza })).json;
    await t.call('PATCH', '/api/admin/members/member-reza', { cookie: admin, body: { suspended: true } });
    const res = await scan(token);
    expect(res.json.success).toBe(false);
    expect(res.json.message).toMatch(/ditangguhkan/);
  });
});

describe('manual front-desk check-in', () => {
  it('matches exact id, email or phone only', async () => {
    expect((await scan('kevin@gym.test')).json.success).toBe(true);
    expect((await scan('0812-3456')).json.success).toBe(false); // partial phone
    expect((await scan('kevin')).json.success).toBe(false); // partial name/email
    expect((await scan('coach-hendra')).json.success).toBe(false); // staff are not members
  });

  it('denies expired members with the end date in the message', async () => {
    const res = await scan('siti@gym.test');
    expect(res.json.success).toBe(false);
    expect(res.json.message).toMatch(/berakhir pada/);
  });

  it('counts admitted members in live occupancy', async () => {
    const before = (await t.call('GET', '/api/state')).json.occupancy.count;
    await scan('kevin@gym.test');
    expect((await t.call('GET', '/api/state')).json.occupancy.count).toBe(before + 1);
  });
});

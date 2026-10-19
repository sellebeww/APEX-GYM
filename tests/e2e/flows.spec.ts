import { expect, test, type Browser, type Page } from '@playwright/test';
import { api, DEMO_PASSWORD, login, watchConsole } from './helpers.ts';

/** A separate browser context = a separate session cookie, so member and admin can act at the same time. */
async function sessionFor(browser: Browser, email: string): Promise<Page> {
  const page = await (await browser.newContext({ baseURL: 'http://127.0.0.1:8792' })).newPage();
  const res = await api.post(page, '/api/auth/login', { email, password: DEMO_PASSWORD });
  expect(res.status(), `login ${email}`).toBe(200);
  return page;
}

type Json = Record<string, any>;
const json = async (r: Awaited<ReturnType<typeof api.get>>): Promise<Json> => (await r.json()) as Json;

test.describe('QR check-in', () => {
  test('active member is admitted once; the same token cannot be replayed; garbage is refused', async ({ browser }) => {
    const member = await sessionFor(browser, 'reza@gym.test');
    const admin = await sessionFor(browser, 'admin@gym.test');
    const { token } = await json(await api.post(member, '/api/member/qr-token'));
    expect(token).toBeTruthy();

    const first = await json(await api.post(admin, '/api/admin/check-ins', { code: token }));
    expect(first.success).toBe(true);
    expect(first.checkIn.status).toBe('GRANTED');

    const replay = await json(await api.post(admin, '/api/admin/check-ins', { code: token }));
    expect(replay.success).toBe(false);

    const forged = await json(await api.post(admin, '/api/admin/check-ins', { code: `${token.slice(0, -4)}AAAA` }));
    expect(forged.success).toBe(false);
    const junk = await json(await api.post(admin, '/api/admin/check-ins', { code: 'bukan-token' }));
    expect(junk.success).toBe(false);
  });

  test('a lapsed membership is denied at the gate', async ({ browser }) => {
    const admin = await sessionFor(browser, 'admin@gym.test');
    const siti = await sessionFor(browser, 'siti@gym.test');
    const issued = await api.post(siti, '/api/member/qr-token');
    if (issued.ok()) {
      const { token } = await json(issued);
      const res = await json(await api.post(admin, '/api/admin/check-ins', { code: token }));
      expect(res.success).toBe(false);
    } else {
      expect(issued.status()).toBeGreaterThanOrEqual(400);
    }
  });

  test('admin scanner page: manual code entry shows a denied result for an invalid code', async ({ page }) => {
    const assertClean = watchConsole(page);
    await login(page, 'admin@gym.test');
    await page.goto('/#/admin/checkin');
    await page.locator('input[type="text"], input:not([type])').first().fill('kode-salah');
    await page.keyboard.press('Enter');
    await expect(page.getByText(/Akses ditolak/i)).toBeVisible();
    assertClean();
  });
});

test.describe('payments', () => {
  test('cash order stays pending until staff confirm it; members cannot confirm their own', async ({ browser }) => {
    const siti = await sessionFor(browser, 'siti@gym.test');
    const admin = await sessionFor(browser, 'admin@gym.test');
    const before = await json(await api.get(siti, '/api/state'));
    const endBefore: string = before.memberProfiles['member-siti']?.endDate ?? Object.values<Json>(before.memberProfiles)[0].endDate;

    const created = await api.post(siti, '/api/payments/orders', { kind: 'MEMBERSHIP', itemId: 'plan-1m', method: 'MANUAL_CASH' });
    expect(created.status()).toBe(201);
    const { paymentId } = await json(created);

    const mid = await json(await api.get(siti, '/api/state'));
    expect(mid.payments.find((p: Json) => p.id === paymentId).status).toBe('PENDING');
    expect(Object.values<Json>(mid.memberProfiles)[0].endDate).toBe(endBefore);

    expect((await api.post(siti, `/api/admin/payments/${paymentId}/confirm-cash`)).status()).toBe(403);

    const confirmed = await api.post(admin, `/api/admin/payments/${paymentId}/confirm-cash`);
    expect(confirmed.status()).toBe(200);
    const after = await json(await api.get(siti, '/api/state'));
    expect(after.payments.find((p: Json) => p.id === paymentId).status).toBe('SUCCESS');
    expect(Object.values<Json>(after.memberProfiles)[0].endDate > endBefore).toBe(true);

    // Confirming twice must not extend the membership a second time
    await api.post(admin, `/api/admin/payments/${paymentId}/confirm-cash`);
    const again = await json(await api.get(siti, '/api/state'));
    expect(Object.values<Json>(again.memberProfiles)[0].endDate).toBe(Object.values<Json>(after.memberProfiles)[0].endDate);
  });

  test('a member cannot invent a price or a plan', async ({ browser }) => {
    const siti = await sessionFor(browser, 'siti@gym.test');
    const res = await api.post(siti, '/api/payments/orders', { kind: 'MEMBERSHIP', itemId: 'plan-1m', method: 'QRIS', amount: 1 });
    // Unknown fields are ignored; the stored amount always comes from the server-side plan price
    if (res.status() === 201) {
      const { paymentId } = await json(res);
      const st = await json(await api.get(siti, '/api/state'));
      expect(st.payments.find((p: Json) => p.id === paymentId).amount).toBeGreaterThan(1);
    }
    expect((await api.post(siti, '/api/payments/orders', { kind: 'MEMBERSHIP', itemId: 'plan-gratis', method: 'QRIS' })).status()).toBeGreaterThanOrEqual(400);
  });
});

test.describe('data isolation', () => {
  test("a member's state never contains another member's private data", async ({ browser }) => {
    const reza = await sessionFor(browser, 'reza@gym.test');
    const st = await json(await api.get(reza, '/api/state'));
    expect(Object.keys(st.memberProfiles)).toEqual(['member-reza']);
    expect(st.chatMessages.every((m: Json) => m.threadMemberId === 'member-reza' || m.memberId === 'member-reza')).toBe(true);
    expect(st.payments.every((p: Json) => p.memberId === 'member-reza')).toBe(true);
    expect((await api.post(reza, '/api/chat/messages', { text: 'halo', threadMemberId: 'member-siti' })).status()).toBeGreaterThanOrEqual(400);
  });
});

test.describe('admin UI', () => {
  test('create a class, then see it in the schedule', async ({ page }) => {
    const assertClean = watchConsole(page);
    await login(page, 'admin@gym.test');
    await page.goto('/#/admin/classes');
    await page.getByRole('button', { name: 'Tambah kelas' }).first().click();
    await page.locator('#cl-name').fill('Mobility E2E Test');
    await page.locator('#cl-room').fill('Studio Uji');
    await page.locator('#cl-day').selectOption('Minggu');
    await page.locator('#cl-start').fill('21:00');
    await page.locator('#cl-end').fill('22:00');
    await page.getByRole('button', { name: 'Simpan kelas' }).click();
    await expect(page.getByRole('heading', { name: 'Mobility E2E Test' })).toBeVisible();
    // Same room + slot (and same coach) twice must be refused
    await page.getByRole('button', { name: 'Tambah kelas' }).first().click();
    await page.locator('#cl-name').fill('Bentrok Test');
    await page.locator('#cl-room').fill('Studio Uji');
    await page.locator('#cl-day').selectOption('Minggu');
    await page.locator('#cl-start').fill('21:00');
    await page.locator('#cl-end').fill('22:00');
    await page.getByRole('button', { name: 'Simpan kelas' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    assertClean();
  });

  test('finance export downloads a CSV with a header row', async ({ page }) => {
    await login(page, 'admin@gym.test');
    await page.goto('/#/admin/keuangan');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: /Ekspor CSV/ }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^laporan-keuangan-apex-.*\.csv$/);
    const text = await (await import('node:fs/promises')).readFile((await file.path())!, 'utf8');
    expect(text.startsWith('﻿"Invoice"')).toBe(true);
  });

  test('member management: extension needs an audit reason; reset password shows a one-time temporary password', async ({ page }) => {
    const assertClean = watchConsole(page);
    await login(page, 'admin@gym.test');
    await page.goto('/#/admin/members');
    const row = page.getByRole('listitem').filter({ hasText: 'reza@gym.test' });
    await row.getByRole('button', { name: '+30 hari' }).click();
    await page.getByRole('button', { name: 'Perpanjang', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText(/alasan/i);
    await page.locator('#extend-reason').fill('Kompensasi alat rusak (E2E)');
    await page.getByRole('button', { name: 'Perpanjang', exact: true }).click();
    await expect(page.locator('#extend-reason')).toBeHidden();

    const log = await json(await api.get(page, '/api/state'));
    expect(JSON.stringify(log.auditLogs)).toContain('Kompensasi alat rusak (E2E)');

    // A different account: reset logs the target out and changes its password, other specs still need reza
    await page.getByRole('listitem').filter({ hasText: 'nadia@gym.test' }).getByRole('button', { name: /Reset password/ }).click();
    await page.getByRole('button', { name: 'Ya, buat password sementara' }).click();
    await expect(page.getByRole('dialog', { name: 'Password sementara' }).locator('p.font-mono')).toHaveText(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/);
    assertClean();
  });
});

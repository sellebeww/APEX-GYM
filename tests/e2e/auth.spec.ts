import { expect, test } from '@playwright/test';
import { api, login, openLogin, watchConsole } from './helpers.ts';

const meEmail = async (page: import('@playwright/test').Page) =>
  ((await (await api.get(page, '/api/state')).json()) as { me: { email: string } | null }).me?.email ?? null;

test('wrong password is rejected, correct password opens the member dashboard, logout ends the session', async ({ page }) => {
  const assertClean = watchConsole(page);
  await openLogin(page);
  await page.locator('#auth-email').fill('reza@gym.test');
  await page.locator('#auth-password').fill('salah-total-123');
  await page.getByRole('dialog').getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  expect(await meEmail(page)).toBeNull();

  await page.locator('#auth-password').fill('ApexDemo2026');
  await page.getByRole('dialog').getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(page).toHaveURL(/#\/member\/dashboard/);
  expect(await meEmail(page)).toBe('reza@gym.test');

  await api.post(page, '/api/auth/logout');
  expect(await meEmail(page)).toBeNull();
  assertClean();
});

test('a member cannot open admin pages or call admin APIs', async ({ page }) => {
  await login(page, 'reza@gym.test');
  await expect(page).toHaveURL(/#\/member/);
  await page.goto('/#/admin/members');
  await expect(page.getByRole('heading', { name: /Manajemen member/i })).toHaveCount(0);
  expect((await api.get(page, '/api/admin/members')).status()).not.toBe(200);
  expect((await api.post(page, '/api/admin/check-ins', { code: 'x' })).status()).toBe(403);
});

test('registration creates a member who lands on the membership page', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Masuk/ }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Daftar member' }).click();
  await page.locator('#reg-name').fill('Tester E2E');
  await page.locator('#reg-email').fill('tester.e2e@example.test');
  await page.locator('#reg-phone').fill('0812-9000-1234');
  await page.locator('#reg-password').fill('E2eTester2026');
  await page.getByLabel('Ulangi password').fill('E2eTester2026');
  await page.getByRole('dialog').getByRole('button', { name: 'Selesaikan pendaftaran' }).click();
  await expect(page).toHaveURL(/#\/member\/membership/);
  expect(await meEmail(page)).toBe('tester.e2e@example.test');
});

import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, login, noHorizontalOverflow, watchConsole } from './helpers.ts';

test.use({ reducedMotion: 'reduce' });

const PUBLIC_ROUTES = ['/#/'];
const PORTALS: { email: string; routes: string[] }[] = [
  { email: 'reza@gym.test', routes: ['dashboard', 'qr', 'classes', 'coaching', 'membership', 'body-progress', 'referral'].map(t => `/#/member/${t}`) },
  { email: 'hendra@gym.test', routes: ['dashboard', 'clients', 'schedule', 'builder', 'nutrition'].map(t => `/#/coach/${t}`) },
  { email: 'admin@gym.test', routes: ['dashboard', 'checkin', 'classes', 'keuangan', 'members', 'equipment'].map(t => `/#/admin/${t}`) },
];

test('public landing page has no overflow, console errors, or axe violations', async ({ page }) => {
  const assertClean = watchConsole(page);
  for (const route of PUBLIC_ROUTES) {
    await page.goto(route);
    await page.waitForLoadState('networkidle');
    await noHorizontalOverflow(page);
    await expectNoAxeViolations(page);
  }
  assertClean();
});

for (const { email, routes } of PORTALS) {
  test(`${email.split('@')[0]} portal routes: no overflow, console errors, or axe violations`, async ({ page }) => {
    const assertClean = watchConsole(page);
    await login(page, email);
    // The welcome toast fades in and out; scanning it mid-transition reports contrast users never see
    await page.getByText('Berhasil masuk').waitFor({ state: 'hidden', timeout: 8000 });
    for (const route of routes) {
      await page.goto(route);
      await expect(page).toHaveURL(new RegExp(`${route.slice(2).replace(/\//g, '\\/')}$`));
      await expect(page.locator('main h1, main h2').first()).toBeVisible();
      await page.waitForLoadState('networkidle');
      await noHorizontalOverflow(page);
      await expectNoAxeViolations(page);
    }
    assertClean();
  });
}

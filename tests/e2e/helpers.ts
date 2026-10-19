import { AxeBuilder } from '@axe-core/playwright';
import { expect, type APIResponse, type Page } from '@playwright/test';

export const DEMO_PASSWORD = 'ApexDemo2026';

/** Collects uncaught page errors and console errors; call the returned function at the end of the test. */
export function watchConsole(page: Page) {
  const problems: string[] = [];
  page.on('pageerror', e => problems.push(`pageerror: ${e.message}`));
  page.on('console', m => {
    // Probes that deliberately fail (bad login, forbidden call) make the browser log the HTTP status itself
    if (m.type() === 'error' && !/status of (401|403|409|429)/.test(m.text())) problems.push(`console: ${m.text()}`);
  });
  return () => expect(problems, problems.join('\n')).toEqual([]);
}

export async function openLogin(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Masuk/ }).first().click();
}

export async function login(page: Page, email: string, password = DEMO_PASSWORD) {
  await openLogin(page);
  await page.locator('#auth-email').fill(email);
  await page.locator('#auth-password').fill(password);
  await page.getByRole('dialog').getByRole('button', { name: 'Masuk', exact: true }).click();
  // Wait for the portal redirect: navigating before the login response lands would be overwritten by it
  await page.waitForURL(/#\/(member|coach|admin)\//);
}

export const api = {
  post: (page: Page, path: string, data: unknown = {}): Promise<APIResponse> => page.request.post(path, { data, headers: { 'x-apex-csrf': '1' } }),
  get: (page: Page, path: string): Promise<APIResponse> => page.request.get(path),
};

export async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'horizontal overflow (px)').toBeLessThanOrEqual(0);
}

export async function expectNoAxeViolations(page: Page) {
  // Entrance animations fade text in from black; scanning mid-fade reports contrast that users never see
  await page.waitForTimeout(900);
  // preload:false: axe would otherwise XHR the Google Fonts stylesheet and trip our own connect-src CSP
  const results = await new AxeBuilder({ page })
    .options({ preload: false, runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } })
    .analyze();
  const url = page.url().split('#')[1] ?? '/';
  const lines = results.violations.map(v => {
    const sample = v.nodes.slice(0, 3).map(n => `${n.target.join(" ")} <${n.html.slice(0, 160)}> :: ${(n.any[0]?.message ?? n.failureSummary ?? '').slice(0, 140)}`);
    return `[${url}] ${v.id} (${v.nodes.length} node(s))\n    ${sample.join('\n    ')}`;
  });
  expect(lines, lines.join('\n')).toEqual([]);
}

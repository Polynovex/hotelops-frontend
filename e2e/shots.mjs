/**
 * Captures the landing screen for each role, plus any extra routes given.
 *
 *   node e2e/shots.mjs              # every role's landing screen
 *   node e2e/shots.mjs --tag after  # same, into a differently named set
 *
 * Used to see what a role actually opens on before and after design work,
 * rather than reasoning about it from the routing table.
 */
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';

const req = createRequire(import.meta.url);
const { authenticator } = req(
  path.resolve(process.cwd(), '..', 'hotelopsx-backend', 'node_modules', 'otplib')
);

const args = process.argv.slice(2);
const TAG = args.includes('--tag') ? args[args.indexOf('--tag') + 1] : 'before';
const ONLY = args.includes('--role') ? args[args.indexOf('--role') + 1] : null;
const BASE = 'http://localhost:5173';

const OUT = path.join(process.cwd(), 'e2e', 'ui', TAG);
fs.mkdirSync(OUT, { recursive: true });
const { users } = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), '..', 'hotelopsx-backend', 'test-users.json'), 'utf8')
);

const signIn = async (page, user) => {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  const tab = page.getByRole('button', { name: /email & password/i }).first();
  if (await tab.isVisible().catch(() => false)) {
    await tab.click();
    await page.waitForTimeout(500);
  }
  await page.locator('input[name="email"]').fill(user.email);
  await page.locator('input[name="password"]').fill(user.password);
  await page.getByRole('button', { name: /^sign in$/i }).first().click();

  const mfa = page.getByLabel(/authentication code/i).first();
  await Promise.race([
    mfa.waitFor({ state: 'visible', timeout: 8000 }).catch(() => null),
    page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 8000 }).catch(() => null)
  ]);
  if (await mfa.isVisible().catch(() => false)) {
    await mfa.fill(authenticator.generate(user.mfaSecret));
    await page.getByRole('button', { name: /verify and sign in/i }).first().click();
  }
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 15000 }).catch(() => null);
  // The session sync re-renders navigation once permissions arrive.
  await page.waitForResponse((r) => r.url().includes('/auth/me') && r.status() === 200, { timeout: 8000 })
    .catch(() => null);
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => null);
  /**
   * Some screens fetch several resources after the session settles — the HR
   * portal takes a few seconds — so a short pause caught them mid-spinner and
   * the capture showed a loading state rather than the page.
   */
  await page.waitForTimeout(6000);
  return !page.url().includes('/login');
};

const run = async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const targets = ONLY ? users.filter((u) => u.label === ONLY) : users;

  console.log(`\nCapturing "${TAG}" for ${targets.length} role(s)\n`);

  for (const user of targets) {
    const context = await browser.newContext({ viewport: { width: 1512, height: 950 }, deviceScaleFactor: 2 });
    const page = await context.newPage();

    if (!(await signIn(page, user))) {
      // A spent TOTP step is rejected by design; the next window works.
      const into = Math.floor(Date.now() / 1000) % 30;
      await page.waitForTimeout((31 - into) * 1000);
      if (!(await signIn(page, user))) {
        console.log(`  ✗ ${user.label} — could not sign in`);
        await context.close();
        continue;
      }
    }

    const landed = page.url().replace(BASE, '');
    await page.screenshot({ path: path.join(OUT, `${user.label}.png`) });
    console.log(`  ✓ ${user.label.padEnd(14)} ${landed}`);
    await context.close();
  }

  await browser.close();
  console.log(`\nSaved to e2e/ui/${TAG}/\n`);
};

run().catch((e) => { console.error('Capture failed:', e.message); process.exit(1); });

/**
 * Captures dashboard imagery for the marketing site.
 *
 * Runs against the application's own demo mode rather than a live tenant, for
 * two reasons: a real tenant's screens carry a real hotel's guests and takings,
 * which must not end up on a public page, and an empty tenant shows a wall of
 * zeros that misrepresents the product just as badly in the other direction.
 * Demo mode is the dataset the product ships for exactly this purpose.
 *
 *   VITE_ENABLE_DEMO_MODE=true npx vite --port 5176
 *   node e2e/marketing.mjs
 */
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const BASE = process.argv.find((a) => a.startsWith('http')) || 'http://localhost:5176';
const OUT = path.join(process.cwd(), 'e2e', 'ui', 'marketing');
fs.mkdirSync(OUT, { recursive: true });

/** One screen per audience the marketing site speaks to. */
const SHOTS = [
  { name: 'owner-dashboard', email: 'admin@demo.com', wait: 4500 },
  { name: 'front-desk', email: 'reception@demo.com', wait: 4500 },
  { name: 'point-of-sale', email: 'pos@demo.com', wait: 4500 },
  { name: 'housekeeping', email: 'housekeeping@demo.com', wait: 4500 },
  { name: 'finance', email: 'accounting@demo.com', wait: 4500 },
  // The room board is reached by navigation rather than by landing on it, so
  // it carries an explicit route.
  { name: 'rooms', email: 'admin@demo.com', route: '/business/rooms/status-board', wait: 5000 }
];

const run = async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });

  for (const shot of SHOTS) {
    // A generous viewport and 2x scale: these are shown scaled down inside a
    // device frame, and a 1x capture looks soft on any modern display.
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2
    });
    const page = await context.newPage();

    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 });
    const tab = page.getByRole('button', { name: /email & password/i }).first();
    if (await tab.isVisible().catch(() => false)) {
      await tab.click();
      await page.waitForTimeout(400);
    }
    await page.locator('input[name="email"]').fill(shot.email);
    await page.locator('input[name="password"]').fill('demo123');
    await page.getByRole('button', { name: /^sign in$/i }).first().click();

    await page
      .waitForURL((u) => !u.pathname.includes('/login'), { timeout: 15000 })
      .catch(() => null);
    if (shot.route) {
      await page.goto(`${BASE}${shot.route}`, { waitUntil: 'domcontentloaded' }).catch(() => null);
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => null);
    }

    await page.waitForTimeout(shot.wait);

    /**
     * Hide the demo-data banner for the capture only.
     *
     * It is correct for it to be loud in the product — someone must not mistake
     * sample figures for their own hotel's — but a marketing image announcing
     * "demo data" undercuts the very screen it is meant to show. Injected into
     * the page rather than removed from the app.
     */
    await page.addStyleTag({ content: '[role="status"]{display:none!important}' });
    await page.waitForTimeout(250);

    const landed = page.url().replace(BASE, '');
    await page.screenshot({ path: path.join(OUT, `${shot.name}.png`) });
    console.log(`  ✓ ${shot.name.padEnd(16)} ${landed}`);
    await context.close();
  }

  await browser.close();
  console.log(`\nSaved to e2e/ui/marketing/\n`);
};

run().catch((e) => {
  console.error('Capture failed:', e.message);
  process.exit(1);
});

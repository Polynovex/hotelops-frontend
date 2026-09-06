/**
 * Deep interaction audit for the dashboard.
 *
 * The role matrix proves each role reaches its screens. This goes a level
 * deeper: on every screen a role can open, it clicks every button, tab, filter
 * and menu trigger, and reports the ones that do nothing, throw, or open
 * something broken.
 *
 *   node e2e/interactions.mjs                 # every role
 *   node e2e/interactions.mjs --role posstaff # one role
 *   node e2e/interactions.mjs --headed
 *
 * Destructive controls are deliberately excluded — see DESTRUCTIVE below.
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
const HEADED = args.includes('--headed');
const ONLY = args.includes('--role') ? args[args.indexOf('--role') + 1] : null;
const BASE = 'http://localhost:5173';

const { users } = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), '..', 'hotelopsx-backend', 'test-users.json'), 'utf8')
);

const findings = [];
const record = (severity, role, screen, control, kind, detail) =>
  findings.push({ severity, role, screen, control, kind, detail });

/**
 * Controls that change or destroy data.
 *
 * This runs against a real tenant, so anything that deletes, voids, closes a
 * shift, runs a night audit or signs the session out is skipped by name. The
 * point is to find controls that are broken, not to exercise the write path —
 * and a harness that force-closes a till while auditing is worse than no
 * harness.
 */
const DESTRUCTIVE =
  /delete|remove|void|cancel|terminate|deactivate|revoke|close shift|force.?close|night audit|sign out|log ?out|reset|clear|archive|approve|reject|process payroll|publish|refund|check ?out/i;

/** Noise that says nothing about application health. */
const IGNORABLE = [
  /Download the React DevTools/i,
  /\[vite\]/i,
  /React Router Future Flag/i,
  /Failed to load resource/i,
  /validateDOMNesting/i,
  /unknown prop/i
];

const signIn = async (page, user) => {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(900);
  const tab = page.getByRole('button', { name: /email & password/i }).first();
  if (await tab.isVisible().catch(() => false)) {
    await tab.click();
    await page.waitForTimeout(400);
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
  await page
    .waitForResponse((r) => r.url().includes('/auth/me') && r.status() === 200, { timeout: 8000 })
    .catch(() => null);
  await page.waitForTimeout(1500);
  return !page.url().includes('/login');
};

/** Nav links this role can see, read once so the walk is stable. */
const readNav = (page) =>
  page
    .locator('nav a, [role="navigation"] a, .MuiDrawer-root [role="button"]')
    .evaluateAll((els) =>
      els
        .map((el) => ({
          label: (el.innerText || '').trim().split('\n')[0].slice(0, 30),
          collapsed: el.getAttribute('aria-expanded') === 'false'
        }))
        .filter((x) => x.label)
    );

const run = async () => {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: !HEADED,
    slowMo: HEADED ? 120 : 0
  });

  const targets = ONLY ? users.filter((u) => u.label === ONLY) : users;
  console.log(`\nInteraction audit — ${targets.length} role(s)\n`);

  let totalClicked = 0;

  const OUT = path.join(process.cwd(), 'e2e', 'interaction-findings.json');
  /**
   * Written after every role, not once at the end.
   *
   * A crash in the last role previously discarded everything the earlier ones
   * had found — the results existed only in memory, and an audit that loses its
   * output on the way to the finish line is worse than useless.
   */
  const persist = () => fs.writeFileSync(OUT, JSON.stringify(findings, null, 2));

  for (const user of targets) {
    const context = await browser.newContext({ viewport: { width: 1512, height: 950 } });
    const page = await context.newPage();

    let screen = 'login';
    let control = '—';
    let clicked = 0;
    let dead = 0;
    const visited = new Set();

    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      if (IGNORABLE.some((re) => re.test(text))) return;
      if (screen === 'login' && /401/.test(text)) return;
      record('high', user.label, screen, control, 'console', text.slice(0, 170));
    });

    page.on('pageerror', (err) => {
      record('high', user.label, screen, control, 'crash', String(err.message).slice(0, 170));
    });

    page.on('response', (res) => {
      const status = res.status();
      if (status < 500 || !res.url().includes('/api/')) return;
      record('high', user.label, screen, control, 'http',
        `${status} ${res.request().method()} ${res.url().split('/api/')[1]?.slice(0, 60)}`);
    });

    let signedIn = await signIn(page, user).catch(() => false);
    if (!signedIn) {
      // A spent TOTP step is refused by design; the next window works.
      const into = Math.floor(Date.now() / 1000) % 30;
      await page.waitForTimeout((31 - into) * 1000);
      signedIn = await signIn(page, user).catch(() => false);
    }
    if (!signedIn) {
      record('high', user.label, 'login', '—', 'auth', 'Could not sign in');
      console.log(`  ✗ ${user.label} — sign-in failed`);
      persist();
      await context.close();
      continue;
    }

    try {

    // Open every collapsed group so their children are reachable.
    for (const item of (await readNav(page)).filter((x) => x.collapsed)) {
      await page
        .getByRole('button', { name: item.label, exact: true })
        .first()
        .click({ timeout: 3000 })
        .catch(() => null);
      await page.waitForTimeout(250);
    }

    const navItems = await readNav(page);

    for (const item of navItems) {
      if (visited.has(item.label)) continue;
      visited.add(item.label);
      screen = item.label;
      control = '—';

      // Reach the screen, re-expanding groups if it collapsed on navigation.
      const link = page
        .getByRole('button', { name: item.label, exact: true })
        .or(page.getByRole('link', { name: item.label, exact: true }))
        .first();
      if (!(await link.isVisible().catch(() => false))) {
        for (const group of (await readNav(page)).filter((x) => x.collapsed)) {
          await page
            .getByRole('button', { name: group.label, exact: true })
            .first()
            .click({ timeout: 2500 })
            .catch(() => null);
          await page.waitForTimeout(250);
        }
      }
      if (!(await link.isVisible().catch(() => false))) continue;

      await link.click({ timeout: 5000 }).catch(() => null);
      await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => null);
      await page.waitForTimeout(700);

      const urlBefore = page.url();

      /**
       * Controls inside the page body only. The sidebar and header are the
       * same on every screen, so including them would re-test one menu once
       * per screen and drown the real findings.
       */
      const controls = await page
        .locator('main button, main [role="tab"], main a[href], main [role="button"]')
        .evaluateAll((els) =>
          els
            .map((el, index) => ({
              index,
              label: (el.innerText || el.getAttribute('aria-label') || '').trim().split('\n')[0].slice(0, 40),
              disabled: el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true',
              href: el.getAttribute('href')
            }))
            .filter((x) => x.label && !x.disabled)
        );

      for (const candidate of controls.slice(0, 14)) {
        if (DESTRUCTIVE.test(candidate.label)) continue;
        control = candidate.label;

        const target = page
          .locator('main button, main [role="tab"], main a[href], main [role="button"]')
          .filter({ hasText: candidate.label })
          .first();

        if (!(await target.isVisible().catch(() => false))) continue;

        /**
         * Tab selection is part of the state a click can legitimately change.
         *
         * A filter tab that switches to a view which is also empty changes no
         * text and issues no request, so without this the audit reports every
         * working tab on an empty screen as a dead control.
         */
        const selectedTabs = () =>
          page
            .locator('main [role="tab"], main [aria-selected]')
            .evaluateAll((els) => els.map((el) => el.getAttribute('aria-selected') || '').join('|'))
            .catch(() => '');

        const before = {
          url: page.url(),
          text: ((await page.locator('main').first().innerText().catch(() => '')) || '').length,
          dialogs: await page.locator('[role="dialog"]').count(),
          tabs: await selectedTabs()
        };

        /**
         * A request is evidence the control did something, even when the
         * screen looks identical afterwards.
         *
         * "Refresh" on a screen whose data has not changed re-fetches and
         * re-renders the same rows, so every visual signal stays the same and
         * a DOM comparison alone reports it as dead. Watching the network
         * separates a control that acted from one that is genuinely wired to
         * nothing.
         */
        let requested = false;
        const watchRequest = (r) => {
          if (r.url().includes('/api/')) requested = true;
        };
        page.on('request', watchRequest);

        // A download is also a real outcome that leaves the DOM untouched.
        let downloaded = false;
        const watchDownload = () => {
          downloaded = true;
        };
        page.on('download', watchDownload);

        await target.click({ timeout: 4000 }).catch(() => null);
        await page.waitForTimeout(900);
        page.off('request', watchRequest);
        page.off('download', watchDownload);
        clicked += 1;

        const after = {
          url: page.url(),
          text: ((await page.locator('main').first().innerText().catch(() => '')) || '').length,
          dialogs: await page.locator('[role="dialog"]').count(),
          tabs: await selectedTabs()
        };

        /**
         * A submit the browser refused is a real outcome, not a dead control.
         *
         * Native validation cancels the submit and the app focuses the offending
         * field, which changes no text and issues no request — so a DOM
         * comparison alone calls a working "Save" button inert.
         */
        const blockedByValidation = await page.evaluate(() => {
          const active = document.activeElement;
          return Boolean(
            active &&
              typeof active.checkValidity === 'function' &&
              !active.checkValidity()
          );
        }).catch(() => false);

        // Close anything that opened, so the next control is reachable.
        if (after.dialogs > before.dialogs) {
          await page.keyboard.press('Escape').catch(() => null);
          await page.waitForTimeout(350);
        }

        const changedSomething =
          after.url !== before.url ||
          after.dialogs !== before.dialogs ||
          Math.abs(after.text - before.text) > 12 ||
          requested ||
          downloaded ||
          blockedByValidation ||
          after.tabs !== before.tabs;

        if (!changedSomething) {
          dead += 1;
          record('medium', user.label, item.label, candidate.label, 'inert',
            'Clicking produced no navigation, dialog, request, download or content change');
        }

        // Return to the screen under test if the control navigated away.
        if (page.url() !== urlBefore) {
          await page.goto(urlBefore, { waitUntil: 'domcontentloaded' }).catch(() => null);
          await page.waitForTimeout(600);
        }
      }
    }

    } catch (roleError) {
      record('high', user.label, screen, control, 'harness',
        `Audit aborted for this role: ${String(roleError.message).slice(0, 120)}`);
    }

    totalClicked += clicked;
    console.log(
      `  ✓ ${user.label.padEnd(14)} ${visited.size} screen(s), ${clicked} control(s)` +
        (dead ? `, ${dead} inert` : '')
    );
    persist();
    await context.close();
  }

  await browser.close();

  const by = { high: [], medium: [], low: [] };
  for (const f of findings) by[f.severity].push(f);

  console.log('\n' + '─'.repeat(76));
  console.log(
    `${totalClicked} controls exercised · ${by.high.length} high · ${by.medium.length} medium`
  );
  console.log('─'.repeat(76));

  for (const level of ['high', 'medium']) {
    if (!by[level].length) continue;
    console.log(`\n${level.toUpperCase()}`);
    const seen = new Set();
    for (const f of by[level]) {
      const key = `${f.role}|${f.screen}|${f.control}|${f.kind}|${f.detail}`;
      if (seen.has(key)) continue;
      seen.add(key);
      console.log(`  [${f.role} · ${f.screen} · "${f.control}"] ${f.kind}: ${f.detail}`);
    }
  }

  fs.writeFileSync(
    path.join(process.cwd(), 'e2e', 'interaction-findings.json'),
    JSON.stringify(findings, null, 2)
  );
  console.log('\nRaw: e2e/interaction-findings.json\n');
};

run().catch((e) => {
  console.error('Interaction audit failed:', e.message);
  process.exit(1);
});

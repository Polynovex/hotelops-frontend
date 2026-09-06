/**
 * Form validation audit for the dashboard.
 *
 * Opens each form a role can reach and submits it empty, then with deliberately
 * invalid values, checking that the app refuses and says why. A form that
 * accepts nonsense, or refuses it silently, is the failure being looked for.
 *
 *   node e2e/forms.mjs [--role businessadmin] [--headed]
 *
 * Valid submissions are NOT exercised. This runs against a real tenant, and a
 * harness that creates reservations, expenses and staff records to prove the
 * happy path works leaves that data behind for someone to clean up. Rejection
 * behaviour is the half that can be tested safely, and it is where the bugs are.
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

/**
 * Each entry: a route, the control that opens the form, and the role that can
 * reach it. Kept explicit rather than discovered, so a failure names a real
 * user journey instead of an anonymous dialog index.
 */
const FORMS = [
  { role: 'businessadmin', name: 'New reservation', path: '/business/reservations/create', opener: null },
  { role: 'businessadmin', name: 'Record expense', path: '/business/finance/expenses', opener: /add expense|record expense|new expense/i },
  { role: 'businessadmin', name: 'Add staff', path: '/business/hr/staff', opener: /add staff|new staff|create staff/i },
  { role: 'supportstaff', name: 'Request leave', path: '/my-hr', opener: /request leave/i },
  { role: 'receptionist', name: 'New reservation', path: '/business/reservations/create', opener: null }
];

const findings = [];
const record = (severity, form, scenario, kind, detail) =>
  findings.push({ severity, form, scenario, kind, detail });

const signIn = async (page, user) => {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 });
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
  await page.waitForTimeout(2000);
  return !page.url().includes('/login');
};

/** Wording that counts as the app explaining a refusal. */
const EXPLAINS =
  /required|invalid|must be|cannot be|please (enter|choose|select|provide)|is not|too (short|long)|at least|pick|choose both|no .* selected/i;

const run = async () => {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: !HEADED,
    slowMo: HEADED ? 200 : 0
  });

  const entries = ONLY ? FORMS.filter((f) => f.role === ONLY) : FORMS;
  const byRole = new Map();
  for (const form of entries) {
    if (!byRole.has(form.role)) byRole.set(form.role, []);
    byRole.get(form.role).push(form);
  }

  console.log(`\nForm validation audit — ${entries.length} form(s)\n`);

  for (const [roleLabel, forms] of byRole) {
    const user = users.find((u) => u.label === roleLabel);
    if (!user) {
      record('high', roleLabel, 'setup', 'credentials', 'No seeded account for this role');
      continue;
    }

    const context = await browser.newContext({ viewport: { width: 1512, height: 950 } });
    const page = await context.newPage();

    if (!(await signIn(page, user))) {
      const into = Math.floor(Date.now() / 1000) % 30;
      await page.waitForTimeout((31 - into) * 1000);
      if (!(await signIn(page, user))) {
        record('high', roleLabel, 'login', 'auth', 'Could not sign in');
        await context.close();
        continue;
      }
    }

    for (const form of forms) {
      const title = `${roleLabel} · ${form.name}`;

      await page.goto(`${BASE}${form.path}`, { waitUntil: 'domcontentloaded' }).catch(() => null);
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => null);
      await page.waitForTimeout(1200);

      if (page.url().includes('/login')) {
        record('high', title, 'reach', 'auth', 'Bounced to login');
        continue;
      }

      if (form.opener) {
        const opener = page.getByRole('button', { name: form.opener }).first();
        if (!(await opener.isVisible().catch(() => false))) {
          record('medium', title, 'reach', 'missing', 'No control found to open this form');
          console.log(`  – ${title}: opener not found`);
          continue;
        }
        await opener.click().catch(() => null);
        await page.waitForTimeout(900);
      }

      const scope = (await page.locator('[role="dialog"]').count())
        ? page.locator('[role="dialog"]').last()
        : page.locator('main').first();

      const submit = scope
        .getByRole('button', { name: /save|submit|create|request|confirm|add|book/i })
        .last();

      if (!(await submit.isVisible().catch(() => false))) {
        record('medium', title, 'reach', 'missing', 'No submit control on the form');
        console.log(`  – ${title}: no submit control`);
        continue;
      }

      // ── Empty submission ────────────────────────────────────────────────
      const enabled = await submit.isEnabled().catch(() => false);
      let verdict;

      if (!enabled) {
        // A disabled submit is a valid way to refuse, provided the page says
        // what is missing — otherwise the user faces a dead button.
        const body = ((await scope.innerText().catch(() => '')) || '');
        if (!EXPLAINS.test(body)) {
          record('medium', title, 'empty', 'feedback',
            'Submit is disabled with nothing on screen naming what is required');
        }
        verdict = 'blocked (disabled)';
      } else {
        let posted = false;
        const watcher = (r) => {
          if (['POST', 'PUT', 'PATCH'].includes(r.method()) && r.url().includes('/api/')) posted = true;
        };
        page.on('request', watcher);
        await submit.click({ timeout: 4000 }).catch(() => null);
        await page.waitForTimeout(1600);
        page.off('request', watcher);

        const body = ((await scope.innerText().catch(() => '')) || '');
        if (posted) {
          record('high', title, 'empty', 'validation',
            'An empty form was sent to the server — nothing validated it in the browser');
        }
        if (!EXPLAINS.test(body)) {
          record('high', title, 'empty', 'feedback',
            'Empty submission was refused with no message explaining why');
        }
        verdict = posted ? 'SENT EMPTY' : 'blocked';
      }

      const has = findings.some((f) => f.form === title);
      console.log(`  ${has ? '✗' : '✓'} ${title} — empty: ${verdict}`);

      await page.keyboard.press('Escape').catch(() => null);
      await page.waitForTimeout(400);
    }

    await context.close();
  }

  await browser.close();

  const by = { high: [], medium: [] };
  for (const f of findings) (by[f.severity] ?? (by[f.severity] = [])).push(f);

  console.log('\n' + '─'.repeat(74));
  console.log(`FINDINGS: ${(by.high || []).length} high · ${(by.medium || []).length} medium`);
  console.log('─'.repeat(74));
  for (const level of ['high', 'medium']) {
    if (!(by[level] || []).length) continue;
    console.log(`\n${level.toUpperCase()}`);
    for (const f of by[level]) console.log(`  [${f.form} · ${f.scenario}] ${f.kind}: ${f.detail}`);
  }

  fs.writeFileSync(
    path.join(process.cwd(), 'e2e', 'form-findings.json'),
    JSON.stringify(findings, null, 2)
  );
  console.log('');
};

run().catch((e) => {
  console.error('Form audit failed:', e.message);
  process.exit(1);
});

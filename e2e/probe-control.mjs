import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';
const req = createRequire(import.meta.url);
const { authenticator } = req(path.resolve(process.cwd(), '..', 'hotelopsx-backend', 'node_modules', 'otplib'));
const { users } = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), '..', 'hotelopsx-backend', 'test-users.json'), 'utf8'));
const [label, route, control] = process.argv.slice(2);
const u = users.find((x) => x.label === label);
const BASE = 'http://localhost:5173';
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await (await b.newContext({ viewport: { width: 1512, height: 950 } })).newPage();
await p.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(900);
const tab = p.getByRole('button', { name: /email & password/i }).first();
if (await tab.isVisible().catch(() => false)) { await tab.click(); await p.waitForTimeout(400); }
await p.locator('input[name="email"]').fill(u.email);
await p.locator('input[name="password"]').fill(u.password);
await p.getByRole('button', { name: /^sign in$/i }).first().click();
const mfa = p.getByLabel(/authentication code/i).first();
await mfa.waitFor({ state: 'visible', timeout: 8000 }).catch(() => null);
if (await mfa.isVisible().catch(() => false)) {
  await mfa.fill(authenticator.generate(u.mfaSecret));
  await p.getByRole('button', { name: /verify and sign in/i }).first().click();
}
await p.waitForURL((x) => !x.pathname.includes('/login'), { timeout: 15000 }).catch(() => null);
await p.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
await p.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => null);
await p.waitForTimeout(1500);

const target = p.locator('main button, main [role="tab"], main [role="button"]').filter({ hasText: control }).first();
console.log('control visible:', await target.isVisible().catch(() => false));
await p.evaluate(() => {
  window.__invalidEvents = [];
  document.addEventListener('invalid', (e) => {
    window.__invalidEvents.push((e.target && e.target.tagName) || '?');
  }, true);
});
const before = { dialogs: await p.locator('[role="dialog"]').count(), body: (await p.locator('body').innerText()).length, url: p.url() };
const errs = []; p.on('pageerror', e => errs.push(e.message));
await target.click({ timeout: 4000 }).catch((e) => console.log('click error:', e.message.slice(0, 80)));
await p.waitForTimeout(1500);
const after = { dialogs: await p.locator('[role="dialog"]').count(), body: (await p.locator('body').innerText()).length, url: p.url() };
console.log('before:', JSON.stringify(before));
console.log('after :', JSON.stringify(after));
console.log('page errors:', errs.length ? errs.join(' | ').slice(0, 200) : '(none)');
const alerts = await p.locator('[role="alert"], .MuiAlert-root').allInnerTexts().catch(() => []);
console.log('alerts on page:', JSON.stringify(alerts));
const btn = await target.evaluate(el => ({ tag: el.tagName, type: el.getAttribute('type'), text: el.innerText.trim().slice(0,40), inForm: !!el.closest('form') })).catch(e => String(e));
console.log('control resolved to:', JSON.stringify(btn));
const formState = await p.evaluate(() => {
  const form = document.querySelector('main form');
  if (!form) return 'no form';
  const invalid = [...form.querySelectorAll('input,select,textarea')]
    .filter((el) => !el.checkValidity())
    .map((el) => ({ name: el.name || el.id || el.type, msg: el.validationMessage }));
  return { formValid: form.checkValidity(), invalidFields: invalid };
});
console.log('form validity:', JSON.stringify(formState));
const focused = await p.evaluate(() => {
  const el = document.activeElement;
  if (!el || el === document.body) return '(nothing focused)';
  const r = el.getBoundingClientRect();
  return {
    tag: el.tagName,
    invalid: typeof el.checkValidity === 'function' ? !el.checkValidity() : null,
    inViewport: r.top >= 0 && r.bottom <= window.innerHeight
  };
});
console.log('focused after click:', JSON.stringify(focused));
console.log('invalid events fired:', JSON.stringify(await p.evaluate(() => window.__invalidEvents)));
await p.screenshot({ path: path.join(process.cwd(), 'e2e', 'ui', `probe-${control.replace(/\W+/g,'-')}.png`) });
await b.close();

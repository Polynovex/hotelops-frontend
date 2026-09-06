import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';
const req = createRequire(import.meta.url);
const { authenticator } = req(path.resolve(process.cwd(), '..', 'hotelopsx-backend', 'node_modules', 'otplib'));
const { users } = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), '..', 'hotelopsx-backend', 'test-users.json'), 'utf8'));
const label = process.argv[2] || 'supportstaff';
const u = users.find((x) => x.label === label);
const BASE = 'http://localhost:5173';
const b = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
const p = await ctx.newPage();
const fails = [];
p.on('response', (r) => { if (r.status() >= 400 && r.url().includes('/api/')) fails.push(`${r.status()} ${r.url().split('/api/')[1]}`); });
p.on('console', (m) => { if (m.type() === 'error') fails.push('console: ' + m.text().slice(0, 140)); });
await p.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
const tab = p.getByRole('button', { name: /email & password/i }).first();
if (await tab.isVisible().catch(() => false)) { await tab.click(); await p.waitForTimeout(500); }
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
for (const wait of [3000, 5000, 8000]) {
  await p.waitForTimeout(wait);
  const txt = ((await p.locator('main, body').first().innerText().catch(() => '')) || '').trim();
  console.log(`after ~${wait}ms extra: ${txt.length} chars | ${txt.replace(/\s+/g,' ').slice(0, 110)}`);
}
console.log('\nfailures:'); console.log(fails.length ? [...new Set(fails)].join('\n') : '  (none)');
await b.close();

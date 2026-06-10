// Drive the real Eventiq chat UI in Chrome as the authenticated test user.
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
const require = createRequire('/opt/homebrew/lib/node_modules/playwright/');
const { chromium } = require('/opt/homebrew/lib/node_modules/playwright');
const here = dirname(fileURLToPath(import.meta.url));
const COOKIE = readFileSync(join(here, 'cookie.txt'), 'utf8').trim();
const BASE = 'http://localhost:3000';

const log = (...a) => console.log('[ui]', ...a);

const browser = await chromium.launch({ channel: 'chrome', headless: false });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
await ctx.addCookies([{
  name: 'next-auth.session-token', value: COOKIE,
  domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax', secure: false,
}]);
const page = await ctx.newPage();
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push('PAGEERROR: ' + e.message));

await page.goto(BASE, { waitUntil: 'networkidle' });

// Confirm the UI sees us as authenticated (composer unlocks).
const composer = 'input[placeholder="Describe your event or ask me anything..."]';
try {
  await page.waitForSelector(composer, { timeout: 15000 });
  log('AUTH OK — composer unlocked (signed-in placeholder present)');
} catch {
  log('AUTH FAIL — still showing signed-out composer');
}
await page.screenshot({ path: join(here, 'shot-1-authed.png') });

async function send(text, idx) {
  log(`sending #${idx}: ${text}`);
  await page.fill(composer, text);
  const t0 = Date.now();
  const respP = page.waitForResponse(
    r => r.url().includes('/api/chat') && r.request().method() === 'POST',
    { timeout: 90000 }
  );
  await page.click('button[aria-label="Send message"]');
  let status = 'NO-RESPONSE', body = {};
  try {
    const resp = await respP;
    status = resp.status();
    try { body = await resp.json(); } catch {}
  } catch (e) { status = 'TIMEOUT'; }
  const ms = Date.now() - t0;
  log(`  -> /api/chat status=${status} in ${ms}ms; tools=${JSON.stringify(body?.metadata?.toolsUsed ?? [])}; reply="${String(body?.content ?? '').slice(0,90).replace(/\n/g,' ')}..."`);
  await page.waitForTimeout(1500); // let DOM render the bubble
  await page.screenshot({ path: join(here, `shot-${idx + 1}.png`), fullPage: true });
  return { status, ms, tools: body?.metadata?.toolsUsed ?? [], len: String(body?.content ?? '').length };
}

const results = [];
results.push(await send('Hi! I want to plan a 40-person tech meetup in Singapore. Give me a quick checklist of what to organize.', 1));
results.push(await send('Find me a few real venues for 40 people near Tanjong Pagar.', 2));

log('RESULTS ' + JSON.stringify(results));
log('CONSOLE_ERRORS ' + JSON.stringify(consoleErrors.slice(0, 10)));
await page.waitForTimeout(800);
await browser.close();
log('done');

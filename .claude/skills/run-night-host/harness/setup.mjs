// Shared harness for night-host.html: static server on the repo root, Chromium at
// phone size, and routes that replace the network the page needs but this
// container cannot reach — Supabase (js/session.js, js/presence.js,
// js/shelf-data.js), the esm.sh QR import, and Google Fonts. The page's own
// code (night-host.html, js/waiting-room.js, js/scroll-lock.js, the modal,
// css/) runs unmodified.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

export const HERE = path.dirname(new URL(import.meta.url).pathname);
export const REPO = path.resolve(HERE, '../../../..');
export const PORT = 8123;
export const ORIGIN = `http://127.0.0.1:${PORT}`;
export const CODE = '5G37';
export const SHOTS = path.join(HERE, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

export const results = [];
export const log = (status, name, detail = '') => { results.push({ status, name, detail }); console.log(`${status.padEnd(5)} ${name}${detail ? ' — ' + detail : ''}`); };
export const check = (name, ok, detail = '') => log(ok ? 'PASS' : 'FAIL', name, detail);
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let server = null;
let browser = null;
const fontsCss = path.join(HERE, 'fonts', 'fonts.local.css');
const haveFonts = fs.existsSync(fontsCss);
if (!haveFonts) console.warn('WARN  fonts/ missing — run `npm run fonts` once; rendering with system fonts.');

function chromiumPath() {
  if (process.env.PW_CHROMIUM) return process.env.PW_CHROMIUM;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  try {
    const dir = fs.readdirSync(root).filter((d) => /^chromium-\d+$/.test(d)).sort().pop();
    const bin = dir && path.join(root, dir, 'chrome-linux', 'chrome');
    if (bin && fs.existsSync(bin)) return bin;
  } catch {}
  return undefined; // let Playwright find its own
}

async function serving() {
  try { const r = await fetch(`${ORIGIN}/night-host.html`); return r.ok; } catch { return false; }
}

/** Starts python's static server on the repo root unless something already answers on the port. */
export async function startServer() {
  if (await serving()) return;
  server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: REPO, stdio: 'ignore' });
  for (let i = 0; i < 40 && !(await serving()); i++) await sleep(250);
  if (!(await serving())) throw new Error(`static server did not come up on ${ORIGIN}`);
}

export async function launch() {
  await startServer();
  browser = await chromium.launch({ executablePath: chromiumPath(), args: ['--no-sandbox'] });
  return browser;
}

/**
 * A phone-sized page with every route wired. Fixture comes from the page URL:
 * ?d=5 deck size · ?reveal=1 deck shown · ?mode=random · ?broken=1 gives game 2
 * a 404 cover · plus the page's own flags (?lobby=0, ?tv=1, ?theme=navy, ?glass=0).
 */
export async function newPage({ reducedMotion } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    permissions: ['clipboard-read', 'clipboard-write'], reducedMotion: reducedMotion || 'no-preference',
  });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') page.errors.push(m.text()); });
  const file = (p) => fs.readFileSync(p);
  // Registered first so it is matched last: anything not local and not stubbed is aborted.
  await page.route((u) => !u.href.startsWith(ORIGIN), (r) => r.abort());
  if (haveFonts) {
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: file(fontsCss) }));
    await page.route('**/__fonts/*', (r) => r.fulfill({ status: 200, contentType: 'font/woff2', body: file(path.join(HERE, 'fonts', path.basename(new URL(r.request().url()).pathname))) }));
  }
  // The Vercel rewrite /night/:code/host -> night-host.html (globs do not match past a query string).
  await page.route((u) => /\/night\/[^/]+\/host$/.test(u.pathname), (r) => r.fulfill({ status: 200, contentType: 'text/html', body: file(path.join(REPO, 'night-host.html')) }));
  for (const m of ['session', 'presence', 'shelf-data']) {
    await page.route(`**/js/${m}.js`, (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: file(path.join(HERE, 'stubs', `${m}.js`)) }));
  }
  await page.route('https://esm.sh/qrcode@1.5.3', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: file(path.join(HERE, 'stubs', 'qrcode.js')) }));
  await page.route('**/u/nok', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>shelf stub</title>' }));
  // Skip the name gate: the host already has a name on this device.
  await page.addInitScript(([k, v]) => { sessionStorage.setItem(k, v); }, [`gamenight:${CODE}:name`, 'Nok']);
  return page;
}

/** Loads the host page and waits for runHost() to render (start button present, presence stub ready). */
export async function open(page, query = '') {
  await page.goto(`${ORIGIN}/night/${CODE}/host${query}`);
  try {
    await page.waitForSelector('#startBtn', { timeout: 15000 });
  } catch (e) {
    const html = await page.evaluate(() => (document.getElementById('screen')?.innerHTML || document.documentElement.outerHTML).replace(/\s+/g, ' ').slice(0, 300));
    console.log('LOAD FAILED', query, '\n', html, '\n', page.errors.join('\n'));
    throw e;
  }
  await page.waitForFunction(() => typeof window.__pushPlayers === 'function');
  await page.evaluate(() => document.fonts.ready);
  await sleep(150);
}

/** Simulates presence: the first name is the host. */
export const push = (page, names) => page.evaluate((ns) => window.__pushPlayers(ns.map((n, i) => ({ name: n, isHost: i === 0 }))), names);
export const shot = (page, name, opts = {}) => page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true, ...opts });
export const css = (page, sel, prop, pseudo) => page.$eval(sel, (el, [p, ps]) => getComputedStyle(el, ps || null)[p], [prop, pseudo]);
export const text = (page, sel) => page.$eval(sel, (el) => el.textContent.replace(/\s+/g, ' ').trim());
export const has = (page, sel) => page.$(sel).then(Boolean);

export async function finish() {
  await browser?.close();
  server?.kill();
  const fails = results.filter((r) => r.status === 'FAIL');
  if (results.length) {
    fs.writeFileSync(path.join(HERE, 'results.json'), JSON.stringify(results, null, 2));
    console.log(`\n${results.filter((r) => r.status === 'PASS').length} pass, ${fails.length} fail — screenshots in ${SHOTS}`);
  }
  process.exit(fails.length ? 1 : 0);
}

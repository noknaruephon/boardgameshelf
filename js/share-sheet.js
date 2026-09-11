// Share sheet — one component for "share this shelf" and "share this bag".
//
// A bottom sheet with the QR code, the address with Copy, the native share
// sheet where the browser has one, and Done. Spec: docs/bag-stage2-spec.md §7.
//
// The QR is drawn by vendor/qrcode.min.js (qrcode-generator, MIT), the same
// encoder settings.html already uses — nothing is fetched from a QR service
// and the full https:// address is what gets encoded. The script is loaded
// on first open, so a page that never shares never loads it.

import { registerOverlay, syncScrollLock } from './scroll-lock.js';

const STYLESHEET = '/css/share-sheet.css';
const QR_SCRIPT = '/vendor/qrcode.min.js';
const COPIED_MS = 1200;

const SHARE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 3v13M8 7l4-4 4 4"/></svg>';

let sheet = null;       // built on first open
let scrim = null;
let opener = null;      // focus goes back here on close
let copiedTimer = 0;
let qrLoading = null;

function loadOnce(tag, attrs, ready) {
  return new Promise(resolve => {
    if (ready()) return resolve(true);
    const el = document.createElement(tag);
    Object.assign(el, attrs);
    el.onload = () => resolve(true);
    el.onerror = () => resolve(false);
    document.head.appendChild(el);
  });
}

function loadStyles() {
  if (document.querySelector(`link[href="${STYLESHEET}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = STYLESHEET;
  document.head.appendChild(link);
}

function loadQr() {
  if (!qrLoading) {
    qrLoading = loadOnce('script', { src: QR_SCRIPT, async: true }, () => typeof window.qrcode === 'function');
  }
  return qrLoading;
}

// One path per dark module, on a viewBox of the module count, so the SVG
// scales to whatever the plate gives it with crisp edges.
function qrSvg(url) {
  const qr = window.qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  const n = qr.getModuleCount();
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  return `<svg viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg" focusable="false"><path d="${d}"/></svg>`;
}

function build() {
  scrim = document.createElement('div');
  scrim.className = 'share-scrim';
  scrim.addEventListener('click', close);

  sheet = document.createElement('div');
  sheet.className = 'share-sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-labelledby', 'shareSheetTitle');
  sheet.setAttribute('aria-hidden', 'true');
  sheet.innerHTML = `
    <div class="share-sheet__grab" aria-hidden="true"></div>
    <h2 class="share-sheet__title" id="shareSheetTitle"></h2>
    <p class="share-sheet__sub" data-share-sub></p>
    <div class="share-sheet__qr" data-share-qr role="img"></div>
    <div class="share-sheet__url">
      <span data-share-url></span>
      <button type="button" class="share-sheet__copy" data-share-copy>Copy</button>
    </div>
    <div class="share-sheet__row">
      <button type="button" class="share-sheet__btn share-sheet__btn--gold" data-share-native>${SHARE_ICON}Share…</button>
      <button type="button" class="share-sheet__btn" data-share-done>Done</button>
    </div>
  `;
  sheet.querySelector('[data-share-done]').addEventListener('click', close);
  sheet.querySelector('[data-share-copy]').addEventListener('click', copy);
  sheet.querySelector('[data-share-native]').addEventListener('click', shareNative);
  sheet.addEventListener('keydown', onKeydown);

  document.body.append(scrim, sheet);
  registerOverlay(isOpen);
}

function isOpen() {
  return !!sheet && sheet.classList.contains('is-open');
}

function focusable() {
  return Array.from(sheet.querySelectorAll('button:not([hidden]), [href], input, [tabindex]:not([tabindex="-1"])'))
    .filter(el => !el.disabled && el.offsetParent !== null);
}

function onKeydown(e) {
  if (e.key === 'Escape') { e.preventDefault(); close(); return; }
  if (e.key !== 'Tab') return;
  const items = focusable();
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

async function copy() {
  const btn = sheet.querySelector('[data-share-copy]');
  const url = sheet.dataset.url;
  try {
    await navigator.clipboard.writeText(url);
    btn.textContent = 'Copied';
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => { btn.textContent = 'Copy'; }, COPIED_MS);
  } catch {
    // No clipboard access (older WebKit, a non-secure context): select the
    // address so a long-press or ⌘C still gets it.
    const range = document.createRange();
    range.selectNodeContents(sheet.querySelector('[data-share-url]'));
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

async function shareNative() {
  const { url, title } = sheet.dataset;
  try {
    await navigator.share({ url, title });
  } catch {
    // Dismissed, or the platform declined: the sheet is still here with the
    // link and the code, so there is nothing to say.
  }
}

/**
 * @param {object} opts
 * @param {string} opts.url       the full https:// address to share and encode
 * @param {string} opts.title     "Share this bag" / "Share this shelf"
 * @param {string} opts.subtitle  the mono line under it
 * @param {HTMLElement} [opts.opener] gets focus back on close
 */
export async function openShareSheet({ url, title, subtitle, opener: from = null }) {
  loadStyles();
  if (!sheet) build();
  opener = from || document.activeElement;

  sheet.dataset.url = url;
  sheet.dataset.title = title;
  sheet.querySelector('#shareSheetTitle').textContent = title;
  sheet.querySelector('[data-share-sub]').textContent = subtitle || '';
  sheet.querySelector('[data-share-url]').textContent = url.replace(/^https?:\/\//, '');
  sheet.querySelector('[data-share-copy]').textContent = 'Copy';
  sheet.querySelector('[data-share-native]').hidden = typeof navigator.share !== 'function';

  const qr = sheet.querySelector('[data-share-qr]');
  qr.setAttribute('aria-label', `QR code for ${url}`);
  qr.innerHTML = '';
  qr.classList.remove('is-missing');

  sheet.setAttribute('aria-hidden', 'false');
  scrim.classList.add('is-open');
  sheet.classList.add('is-open');
  syncScrollLock();
  sheet.querySelector('[data-share-done]').focus({ preventScroll: true });

  // Drawn after the sheet is on its way up, so a slow script never holds the
  // sheet back; the plate is sized already, so nothing shifts when it lands.
  const ok = await loadQr();
  if (sheet.dataset.url !== url) return;   // reopened for another address meanwhile
  if (ok) qr.innerHTML = qrSvg(url);
  else { qr.classList.add('is-missing'); qr.textContent = 'Couldn’t draw the code. Copy the link instead.'; }
}

export function closeShareSheet() {
  close();
}

function close() {
  if (!isOpen()) return;
  scrim.classList.remove('is-open');
  sheet.classList.remove('is-open');
  sheet.setAttribute('aria-hidden', 'true');
  syncScrollLock();
  const back = opener;
  opener = null;
  if (back && typeof back.focus === 'function' && document.contains(back)) back.focus({ preventScroll: true });
}

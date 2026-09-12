// Bottom sheets — the scaffold, and the share sheet built on it.
//
// createBottomSheet() is the one bottom-sheet mechanism on the site: scrim,
// slide, focus trap, Escape/scrim/Done dismissal, focus back to the opener.
// The share sheet (QR code, the address with Copy, the native share sheet
// where the browser has one) and the shelf's Bags sheet (js/bag-ui.js) are
// both built on it, so they can never drift apart. Spec: docs/bag-stage2-spec.md
// §7 and docs/bag-shelf-header-spec.md §4.
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

let copiedTimer = 0;
let qrLoading = null;

/**
 * One bottom sheet: built once, opened many times. The caller owns what goes
 * inside `body`; the scaffold owns everything about being a sheet.
 *
 * @param {object} opts
 * @param {string} opts.className   added to the sheet, for the caller's styles
 * @param {string} opts.titleId     id of the element that names the dialog
 * @param {string} opts.bodyHTML    the sheet's contents, under the grab handle
 * @param {(sheet: HTMLElement) => void} [opts.onClose]
 */
export function createBottomSheet({ className = '', titleId, bodyHTML, onClose }) {
  loadStyles();
  let opener = null;

  const scrim = document.createElement('div');
  scrim.className = 'bsheet-scrim';

  const el = document.createElement('div');
  el.className = `bsheet ${className}`.trim();
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  if (titleId) el.setAttribute('aria-labelledby', titleId);
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `<div class="bsheet__grab" aria-hidden="true"></div>${bodyHTML}`;

  const isOpen = () => el.classList.contains('is-open');

  const focusable = () =>
    Array.from(el.querySelectorAll('button:not([hidden]), [href], input, [tabindex]:not([tabindex="-1"])'))
      .filter(x => !x.disabled && x.offsetParent !== null);

  function close() {
    if (!isOpen()) return;
    scrim.classList.remove('is-open');
    el.classList.remove('is-open');
    el.setAttribute('aria-hidden', 'true');
    syncScrollLock();
    const back = opener;
    opener = null;
    onClose?.(el);
    if (back && typeof back.focus === 'function' && document.contains(back)) back.focus({ preventScroll: true });
  }

  function open(from = null, { focus = null } = {}) {
    opener = from || document.activeElement;
    el.setAttribute('aria-hidden', 'false');
    scrim.classList.add('is-open');
    el.classList.add('is-open');
    syncScrollLock();
    const target = focus || focusable()[0];
    target?.focus({ preventScroll: true });
  }

  el.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    const items = focusable();
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  scrim.addEventListener('click', close);
  el.querySelectorAll('[data-sheet-close]').forEach(b => b.addEventListener('click', close));

  document.body.append(scrim, el);
  registerOverlay(isOpen);

  return { el, open, close, isOpen };
}

// ---- the share sheet ----

let share = null;       // { el, open, close } — built on first open

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
  share = createBottomSheet({
    className: 'share-sheet',
    titleId: 'shareSheetTitle',
    bodyHTML: `
      <h2 class="bsheet__title" id="shareSheetTitle"></h2>
      <p class="share-sheet__sub" data-share-sub></p>
      <div class="share-sheet__qr" data-share-qr role="img"></div>
      <div class="share-sheet__url">
        <span data-share-url></span>
        <button type="button" class="share-sheet__copy" data-share-copy>Copy</button>
      </div>
      <div class="share-sheet__row">
        <button type="button" class="share-sheet__btn share-sheet__btn--gold" data-share-native>${SHARE_ICON}Share…</button>
        <button type="button" class="share-sheet__btn" data-share-done data-sheet-close>Done</button>
      </div>
    `,
  });
  share.el.querySelector('[data-share-copy]').addEventListener('click', copy);
  share.el.querySelector('[data-share-native]').addEventListener('click', shareNative);
}

async function copy() {
  const sheet = share.el;
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
  const { url, title } = share.el.dataset;
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
  if (!share) build();
  const sheet = share.el;

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

  share.open(from, { focus: sheet.querySelector('[data-share-done]') });

  // Drawn after the sheet is on its way up, so a slow script never holds the
  // sheet back; the plate is sized already, so nothing shifts when it lands.
  const ok = await loadQr();
  if (sheet.dataset.url !== url) return;   // reopened for another address meanwhile
  if (ok) qr.innerHTML = qrSvg(url);
  else { qr.classList.add('is-missing'); qr.textContent = 'Couldn’t draw the code. Copy the link instead.'; }
}

export function closeShareSheet() {
  share?.close();
}

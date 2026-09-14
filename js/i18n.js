// TH/EN language runtime (docs/claude-code-spec-i18n.md).
//
// Resolution order: ?lang= → localStorage["bgs-lang"] → the browser's
// language → English. Strings live in /i18n/en.json and /i18n/th.json, keyed
// by surface ("shelf.search", "modal.close", …); a key missing from th.json
// falls back to English silently, which is how the never-translate list
// (wordmark, Beta, game titles, vibe names, BGG terms, "Start Game Night")
// stays English by design rather than by exception.
//
// Static markup carries data-i18n="key" (plus data-args='{"n":196}' for
// templates) and data-i18n-attr="aria-label:key,title:key"; JS-built markup
// calls t() and re-renders on the "bgs:langchange" event this module fires.

const KEY = 'bgs-lang';
const SUPPORTED = ['en', 'th'];
// The pill (js/lang-pill.js) and browser-language auto-detect are gated on
// this flag until the Thai content pass is reviewed. ?lang=th always works.
const FLAG = 'i18n';

let dict = { en: {}, th: {} };
let lang = 'en';
let ready = null;

export function hasFlag() {
  return new URLSearchParams(location.search).has(FLAG);
}

export function resolveLang() {
  const url = new URL(location.href);
  const fromUrl = url.searchParams.get('lang');
  if (SUPPORTED.includes(fromUrl)) {
    try { localStorage.setItem(KEY, fromUrl); } catch { /* private mode */ }
    url.searchParams.delete('lang');
    history.replaceState(null, '', url);
    return fromUrl;
  }
  let stored = null;
  try { stored = localStorage.getItem(KEY); } catch { /* private mode */ }
  if (SUPPORTED.includes(stored)) return stored;
  // FLAG: auto-detect only while the pill is live. Once the content pass has
  // shipped, drop the hasFlag() guard here and the one in js/lang-pill.js.
  if (hasFlag() && (navigator.language || '').toLowerCase().startsWith('th')) return 'th';
  return 'en';
}

/**
 * Loads the dictionaries and applies the resolved language to the document.
 * Safe to call from more than one module on a page: the fetch runs once.
 * One small fetch; call it before the first render, never before the covers.
 */
export function initI18n() {
  if (ready) return ready;
  lang = resolveLang();
  // Set straight away so the CSS type swap lands before the strings do.
  document.documentElement.lang = lang;
  document.documentElement.dataset.lang = lang;
  ready = (async () => {
    const load = (l) => fetch(`/i18n/${l}.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
    const [en, th] = await Promise.all([load('en'), load('th')]);
    dict = { en, th };
    applyLang(lang);
  })();
  return ready;
}

export function getLang() { return lang; }

/** Looks a key up in the current language, then English, then returns the key. */
export function t(key, args = {}) {
  const s = dict[lang]?.[key] ?? dict.en[key] ?? key;
  return String(s).replace(/\{(\w+)\}/g, (_, k) => (args[k] === undefined ? '' : args[k]));
}

/**
 * Count-aware lookup. English has singular forms under "<key>One"; Thai has
 * no plurals, so th.json carries the one template and this falls through to
 * it. `n` is also available to the template as {n}.
 */
export function tn(key, n, args = {}) {
  const one = `${key}One`;
  const has = (d, k) => !!d && d[k] !== undefined;
  // The current language's singular if it has one; English's singular only
  // when the current language has no form of the key at all.
  const useOne = n === 1 && (has(dict[lang], one) || (!has(dict[lang], key) && has(dict.en, one)));
  return t(useOne ? one : key, { n, ...args });
}

export function setLang(next) {
  if (!SUPPORTED.includes(next) || next === lang) return;
  lang = next;
  try { localStorage.setItem(KEY, next); } catch { /* private mode */ }
  applyLang(next);
  document.dispatchEvent(new CustomEvent('bgs:langchange', { detail: { lang: next } }));
}

/** Translates the data-i18n / data-i18n-attr markup under `root`. */
export function translate(root = document) {
  const argsOf = (el) => {
    if (!el.dataset.args) return {};
    try { return JSON.parse(el.dataset.args); } catch { return {}; }
  };
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n, argsOf(el));
  });
  root.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    // data-i18n-attr="aria-label:pill.aria,title:pill.title"
    const args = argsOf(el);
    el.dataset.i18nAttr.split(',').forEach((pair) => {
      const [attr, key] = pair.split(':').map((s) => s.trim());
      if (attr && key) el.setAttribute(attr, t(key, args));
    });
  });
}

function applyLang(l) {
  document.documentElement.lang = l;
  document.documentElement.dataset.lang = l;
  translate(document);
}

/**
 * Dates in Thai use the Gregorian calendar (never พ.ศ.) and Latin digits;
 * English uses en-GB. Route every date display through here.
 */
export function fmtDate(date, opts) {
  const locale = lang === 'th' ? 'th-TH-u-ca-gregory-nu-latn' : 'en-GB';
  return new Intl.DateTimeFormat(locale, opts).format(date);
}

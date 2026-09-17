// Theme registry and resolver. Spec: docs/claude-code-spec-themes.md.
//
// The tokens themselves live in css/base.css, one [data-theme] block per
// theme; this is the list the Settings picker and the runtime resolver read.
// Adding a theme is one CSS block there plus one entry here. `plate` and
// `line` exist only so a swatch can be drawn for a theme that is not applied;
// navy's are its --bgs-plate and its --line hairline flattened over that plate.
//
// First paint is handled by the inline script in every page's <head>, which
// runs before the stylesheet: ?theme= → localStorage → walnut. This module takes
// over once the page's own code runs, and is what applies the shelf owner's
// saved theme when their profile arrives.

export const THEMES = [
  { id: 'navy',     name: 'Navy',     plate: '#161A21', line: '#2B3036' },
  { id: 'walnut',   name: 'Walnut',   plate: '#211915', line: '#33281F' },
  { id: 'mahogany', name: 'Mahogany', plate: '#2A1812', line: '#46281D' },
  { id: 'oak',      name: 'Oak',      plate: '#2B231A', line: '#463A2A' },
];
export const DEFAULT_THEME = 'walnut';
export const STORAGE_KEY = 'bgs:theme';
export const isTheme = (id) => THEMES.some((t) => t.id === id);

const FADE_MS = 250;
let fadeTimer = 0;

/** The theme on <html> right now, normalised to a known id. */
export function currentTheme() {
  const id = document.documentElement.dataset.theme;
  return isTheme(id) ? id : DEFAULT_THEME;
}

/**
 * Keep <meta name="theme-color"> (iOS Safari's status/URL bar) on the
 * theme's page background. Read back from the cascade rather than the
 * registry so it can never drift from base.css.
 */
export function syncThemeColor() {
  const meta = document.querySelector('meta[name="theme-color"]');
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bgs-bg').trim();
  if (meta && bg) meta.content = bg;
}

/**
 * Apply a theme to the page. Unknown ids fall back to walnut. With `fade`,
 * <html> carries .theme-switching for the switch so inert surfaces
 * cross-fade (css/base.css); reduced motion skips the class entirely.
 * @returns {string} the id actually applied
 */
export function applyTheme(id, { fade = false } = {}) {
  const next = isTheme(id) ? id : DEFAULT_THEME;
  const root = document.documentElement;
  if (root.dataset.theme !== next) {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (fade && !reduce) {
      root.classList.add('theme-switching');
      clearTimeout(fadeTimer);
      fadeTimer = setTimeout(() => root.classList.remove('theme-switching'), FADE_MS);
    }
    root.dataset.theme = next;
  }
  syncThemeColor();
  return next;
}

/** Cache a theme so this device paints it before any profile loads. */
export function rememberTheme(id) {
  if (!isTheme(id)) return;
  try { localStorage.setItem(STORAGE_KEY, id); } catch { /* private mode, quota */ }
}

/** The ?theme= preview on this URL, if it names a real theme. */
export function previewTheme() {
  try { const id = new URLSearchParams(location.search).get('theme'); return isTheme(id) ? id : null; }
  catch { return null; }
}

/**
 * A shelf owner's saved theme, once their profile has loaded: visitors see
 * the shelf the way the owner styled it, and the owner's own device caches
 * it for next time. A ?theme= preview on the URL wins over it (the cache
 * is still written, the preview itself never is). A profile with no theme
 * leaves the page as resolved, with an unknown stored id settled to walnut.
 * @returns {string|null} the id applied, or null when the profile has none
 */
export function applyProfileTheme(profile) {
  const id = profile?.theme;
  if (!isTheme(id)) { applyTheme(currentTheme()); return null; }
  rememberTheme(id);
  if (previewTheme()) return null;
  applyTheme(id, { fade: true });
  return id;
}

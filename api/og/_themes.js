// Surface tokens per theme for the /api/og/* renderers. Satori cannot read
// CSS variables, so these mirror the [data-theme] blocks in css/base.css;
// keep them in step with the stylesheet and js/themes.js. Gold is shared by
// every theme and stays in each renderer.
//
// The leading underscore keeps Vercel from exposing this file as a route,
// the same convention as api/_lib/ and ./_fonts.js.

export const DEFAULT_THEME = 'walnut';

// bg / plate / ivory as in base.css; `card` is the lighter face a blank card
// fades from down to the plate (the default image's fanned cards).
const SURFACES = {
  navy:     { bg: '#0B0E13', plate: '#161A21', ivory: '#EEF1F5', ivoryRgb: '238,241,245', card: '#232936' },
  walnut:   { bg: '#171110', plate: '#211915', ivory: '#F2E9DA', ivoryRgb: '242,233,218', card: '#2E241E' },
  mahogany: { bg: '#1A100D', plate: '#2A1812', ivory: '#F4E8D8', ivoryRgb: '244,232,216', card: '#3A2119' },
  oak:      { bg: '#1E1812', plate: '#2B231A', ivory: '#F3EBDA', ivoryRgb: '243,235,218', card: '#3A3024' },
};

export const isTheme = (id) => Object.prototype.hasOwnProperty.call(SURFACES, id);

/**
 * The surface tokens for a theme id, falling back to the default for an
 * unknown or missing one. Alphas match the --bgs-ivory-70 / -45 tokens.
 */
export function surfaceTokens(id) {
  const s = SURFACES[isTheme(id) ? id : DEFAULT_THEME];
  return {
    bg: s.bg,
    plate: s.plate,
    ivory: s.ivory,
    ivory70: `rgba(${s.ivoryRgb},0.72)`,
    ivory45: `rgba(${s.ivoryRgb},0.45)`,
    cardGradient: `linear-gradient(160deg, ${s.card}, ${s.plate})`,
  };
}

/** `?theme=` on the request when it names a real theme, else null. */
export function themeFromUrl(url) {
  const id = url.searchParams.get('theme');
  return isTheme(id) ? id : null;
}

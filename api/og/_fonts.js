// Fonts for the /api/og/* image routes: Fraunces, Inter and IBM Plex Mono
// in the weights the layouts use, shaped as the `fonts` option of
// @vercel/og's ImageResponse.
//
// The fonts are static files on this same deployment, so the routes fetch
// them from their own origin at request time instead of bundling them into
// the function. Vercel traces every file an Edge function imports or
// references and counts it toward the function size limit; five fonts on
// top of @vercel/og's wasm pushed the function over that limit, which failed
// the build. Self-origin fetches are served from the edge cache and cost a
// few milliseconds.
//
// The leading underscore keeps Vercel from exposing this file as a route,
// the same convention as api/_lib/.

const STATIC = {
  frauncesRegular: '/assets/fonts/Fraunces-Regular.ttf',
  frauncesMedium: '/assets/fonts/Fraunces-Medium.ttf',
  interRegular: '/assets/fonts/Inter-Regular.ttf',
  interSemiBold: '/assets/fonts/Inter-SemiBold.ttf',
  plexMonoRegular: '/assets/fonts/IBMPlexMono-Regular.ttf',
};

async function loadBinary(origin, path) {
  const res = await fetch(new URL(path, origin));
  if (!res.ok) throw new Error(`Static asset ${path} returned ${res.status}`);
  return res.arrayBuffer();
}

/**
 * All five faces fetched in parallel from `origin`, ready to pass as
 * `fonts` to ImageResponse. Family names match the `fontFamily` values
 * the layouts use: 'Fraunces' (400, 500), 'Inter' (400, 600),
 * 'IBM Plex Mono' (400).
 */
export async function loadFonts(origin) {
  const [fraunces, frauncesMed, inter, interSemi, mono] = await Promise.all([
    loadBinary(origin, STATIC.frauncesRegular),
    loadBinary(origin, STATIC.frauncesMedium),
    loadBinary(origin, STATIC.interRegular),
    loadBinary(origin, STATIC.interSemiBold),
    loadBinary(origin, STATIC.plexMonoRegular),
  ]);
  return [
    { name: 'Fraunces', data: fraunces, weight: 400, style: 'normal' },
    { name: 'Fraunces', data: frauncesMed, weight: 500, style: 'normal' },
    { name: 'Inter', data: inter, weight: 400, style: 'normal' },
    { name: 'Inter', data: interSemi, weight: 600, style: 'normal' },
    { name: 'IBM Plex Mono', data: mono, weight: 400, style: 'normal' },
  ];
}

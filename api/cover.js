// GET /api/cover?u=<https://cf.geekdo-images.com/...>
//
// Same-origin relay for BGG cover images, so the invite poster can draw them
// onto a canvas without tainting it (BGG's CDN sends no CORS headers, and a
// tainted canvas cannot toBlob()). Only BGG's image host is relayed — this
// is not a general proxy — and only an image comes back, capped in size and
// cached for a year: cover URLs on the CDN are content-addressed.

import { handler, HttpError, queryParams } from './_lib/http.js';

const ALLOWED_HOSTS = new Set(['cf.geekdo-images.com']);
const MAX_BYTES = 8 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 12000;
const USER_AGENT = 'BoardgameShelf/1.0 (+https://boardgameshelf.app)';

export function parseCoverUrl(raw) {
  let url;
  try { url = new URL(String(raw || '')); } catch { throw new HttpError(400, 'Not a cover URL.'); }
  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname)) {
    throw new HttpError(400, 'Only BGG cover images are relayed.');
  }
  url.hash = '';
  return url;
}

export default handler(async (req, res) => {
  const url = parseCoverUrl(queryParams(req).u);

  let upstream;
  try {
    upstream = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'image/*' },
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch {
    throw new HttpError(502, 'Cover unavailable.');
  }
  if (!upstream.ok) throw new HttpError(502, 'Cover unavailable.', { upstream: upstream.status });
  // A redirect must not walk off the allow-list either.
  if (upstream.url && !ALLOWED_HOSTS.has(new URL(upstream.url).hostname)) {
    throw new HttpError(502, 'Cover unavailable.');
  }
  const type = upstream.headers.get('content-type') || '';
  if (!type.startsWith('image/')) throw new HttpError(502, 'Not an image.');
  const declared = Number(upstream.headers.get('content-length') || 0);
  if (declared > MAX_BYTES) throw new HttpError(502, 'Cover too large.');
  const body = Buffer.from(await upstream.arrayBuffer());
  if (body.length > MAX_BYTES) throw new HttpError(502, 'Cover too large.');

  res.statusCode = 200;
  res.setHeader('Content-Type', type);
  res.setHeader('Content-Length', String(body.length));
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(body);
}, { methods: ['GET'] });

// Tiny request/response helpers shared by the /api functions.
// Vercel's Node runtime gives `req.body` (parsed when the content type is
// JSON) and `res.status().json()`, but neither is assumed here so the handlers
// also run under plain node:http in tests.

export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') {
      try { return JSON.parse(req.body); } catch { return {}; }
    }
    return req.body;
  }
  let raw = '';
  for await (const chunk of req) raw += chunk;
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

/** Query string of a GET request, whichever shape the runtime hands over. */
export function queryParams(req) {
  if (req.query && typeof req.query === 'object') return req.query;
  const url = new URL(req.url || '/', 'http://localhost');
  return Object.fromEntries(url.searchParams.entries());
}

export function bearerToken(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(String(header).trim());
  return m ? m[1] : null;
}

/**
 * Wraps a handler so every thrown error becomes a JSON response — an HttpError
 * with its own status, anything else as a 500 that says nothing about the
 * internals.
 */
export function handler(fn, { methods = ['POST'] } = {}) {
  return async (req, res) => {
    try {
      if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
      if (!methods.includes(req.method)) throw new HttpError(405, 'Method not allowed');
      await fn(req, res);
    } catch (err) {
      if (err instanceof HttpError) {
        json(res, err.status, { status: 'error', message: err.message, ...err.extra });
        return;
      }
      console.error(err);
      json(res, 500, { status: 'error', message: 'Something went wrong on our side. Try again in a minute.' });
    }
  };
}

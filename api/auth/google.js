// POST /api/auth/google — where Google's sign-in button lands on phones.
//
// On a phone the landing page runs Google Identity Services in redirect mode
// (the popup mode opens a blank new tab that iOS Safari leaves hanging while
// our tab is suspended behind it). Google then POSTs the ID token here as a
// form: `credential` and `g_csrf_token`. The token is checked against the
// `g_csrf_token` cookie the GSI library set before redirecting (Google's
// double-submit CSRF check) and handed on to /welcome in the URL fragment,
// where the page exchanges it with Supabase together with the nonce it kept
// in sessionStorage. The fragment never reaches a server or a log, and the
// token is useless without that nonce.

import { handler } from '../_lib/http.js';

const OK = '/welcome#gsi=';
const FAILED = '/#signin&gsi=error';

async function formBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = typeof req.body === 'string' ? req.body : '';
  if (!raw) for await (const chunk of req) raw += chunk;
  return Object.fromEntries(new URLSearchParams(raw).entries());
}

function cookie(req, name) {
  const header = req.headers?.cookie || '';
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > -1 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

function redirect(res, to) {
  res.statusCode = 303;
  res.setHeader('Location', to);
  res.setHeader('Cache-Control', 'no-store');
  res.end();
}

export default handler(async (req, res) => {
  const body = await formBody(req);
  // GSI posts `credential`; the plain OAuth form_post shape calls it `id_token`.
  const credential = [body.credential, body.id_token].find((v) => typeof v === 'string' && v) || '';
  const csrf = typeof body.g_csrf_token === 'string' ? body.g_csrf_token : '';
  if (!credential || !csrf || csrf !== cookie(req, 'g_csrf_token')) {
    redirect(res, FAILED);
    return;
  }
  redirect(res, OK + encodeURIComponent(credential));
});

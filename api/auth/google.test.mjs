import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import google from './google.js';

function request({ method = 'POST', body = '', cookie = '', parsed } = {}) {
  const req = Readable.from(body ? [body] : []);
  req.method = method;
  req.headers = { cookie, 'content-type': 'application/x-www-form-urlencoded' };
  if (parsed !== undefined) req.body = parsed;
  return req;
}
function response() {
  const res = { statusCode: 200, headers: {}, body: '' };
  res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v; };
  res.end = (s = '') => { res.body += s; };
  return res;
}

test('matching csrf token: 303 to /welcome with the credential in the fragment', async () => {
  const res = response();
  await google(request({ body: 'credential=abc.def&g_csrf_token=t1', cookie: 'g_csrf_token=t1; other=x' }), res);
  assert.equal(res.statusCode, 303);
  assert.equal(res.headers.location, '/welcome#gsi=abc.def');
  assert.equal(res.headers['cache-control'], 'no-store');
});

test('a body the runtime already parsed is accepted as is', async () => {
  const res = response();
  await google(request({ parsed: { credential: 'tok', g_csrf_token: 'z' }, cookie: 'g_csrf_token=z' }), res);
  assert.equal(res.headers.location, '/welcome#gsi=tok');
});

test('id_token is accepted as the credential', async () => {
  const res = response();
  await google(request({ body: 'id_token=tok2&g_csrf_token=t1', cookie: 'g_csrf_token=t1' }), res);
  assert.equal(res.headers.location, '/welcome#gsi=tok2');
});

test('csrf mismatch or missing cookie: back to the sign-in block with an error', async () => {
  for (const cookie of ['g_csrf_token=other', '']) {
    const res = response();
    await google(request({ body: 'credential=abc&g_csrf_token=t1', cookie }), res);
    assert.equal(res.statusCode, 303);
    assert.equal(res.headers.location, '/#signin&gsi=error');
  }
});

test('missing credential: error redirect, not a token-less welcome', async () => {
  const res = response();
  await google(request({ body: 'g_csrf_token=t1', cookie: 'g_csrf_token=t1' }), res);
  assert.equal(res.headers.location, '/#signin&gsi=error');
});

test('GET is refused', async () => {
  const res = response();
  await google(request({ method: 'GET' }), res);
  assert.equal(res.statusCode, 405);
});

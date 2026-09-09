// node --test api/cover.test.mjs
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import cover, { parseCoverUrl } from './cover.js';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

function fakeResponse({ ok = true, status = 200, type = 'image/jpeg', body = PNG, url } = {}) {
  return {
    ok, status, url,
    headers: { get: (h) => (h === 'content-type' ? type : h === 'content-length' ? String(body.length) : null) },
    arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
  };
}

function fakeRes() {
  const res = { statusCode: 0, headers: {}, body: null };
  res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v; };
  res.end = (b) => { res.body = b; };
  return res;
}

async function call(query, fetchImpl) {
  globalThis.fetch = fetchImpl;
  const res = fakeRes();
  await cover({ method: 'GET', url: `/api/cover?${new URLSearchParams(query)}`, headers: {} }, res);
  return res;
}

const realFetch = globalThis.fetch;
beforeEach(() => { globalThis.fetch = () => { throw new Error('fetch not expected'); }; });
afterEach(() => { globalThis.fetch = realFetch; });

test('parseCoverUrl accepts only https BGG image URLs', () => {
  assert.equal(parseCoverUrl('https://cf.geekdo-images.com/abc/pic1.jpg#x').href, 'https://cf.geekdo-images.com/abc/pic1.jpg');
  for (const bad of ['', 'not a url', 'http://cf.geekdo-images.com/a.jpg', 'https://example.com/a.jpg', 'https://cf.geekdo-images.com.evil.com/a.jpg']) {
    assert.throws(() => parseCoverUrl(bad), /Not a cover URL|Only BGG/, bad);
  }
});

test('relays an image with CORS and long cache headers', async () => {
  const seen = [];
  const res = await call({ u: 'https://cf.geekdo-images.com/abc/pic1.jpg' }, async (url, opts) => {
    seen.push({ url: String(url), accept: opts.headers.Accept });
    return fakeResponse({ url: 'https://cf.geekdo-images.com/abc/pic1.jpg' });
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['content-type'], 'image/jpeg');
  assert.equal(res.headers['access-control-allow-origin'], '*');
  assert.match(res.headers['cache-control'], /immutable/);
  assert.equal(res.headers['content-length'], String(PNG.length));
  assert.deepEqual(seen, [{ url: 'https://cf.geekdo-images.com/abc/pic1.jpg', accept: 'image/*' }]);
  assert.ok(Buffer.isBuffer(res.body) && res.body.equals(PNG));
});

test('rejects non-BGG hosts without fetching', async () => {
  const res = await call({ u: 'https://example.com/pic.jpg' });
  assert.equal(res.statusCode, 400);
  assert.match(String(res.body), /Only BGG/);
});

test('refuses a non-image body and an upstream error', async () => {
  let res = await call({ u: 'https://cf.geekdo-images.com/a.jpg' }, async () => fakeResponse({ type: 'text/html' }));
  assert.equal(res.statusCode, 502);
  res = await call({ u: 'https://cf.geekdo-images.com/a.jpg' }, async () => fakeResponse({ ok: false, status: 404 }));
  assert.equal(res.statusCode, 502);
  res = await call({ u: 'https://cf.geekdo-images.com/a.jpg' }, async () => { throw new Error('down'); });
  assert.equal(res.statusCode, 502);
});

test('refuses a redirect that leaves the allow-list', async () => {
  const res = await call({ u: 'https://cf.geekdo-images.com/a.jpg' }, async () => fakeResponse({ url: 'https://elsewhere.example/a.jpg' }));
  assert.equal(res.statusCode, 502);
});

test('only GET', async () => {
  const res = fakeRes();
  await cover({ method: 'POST', url: '/api/cover', headers: {} }, res);
  assert.equal(res.statusCode, 405);
});

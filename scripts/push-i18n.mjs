#!/usr/bin/env node
// Push the Thai curation from games.json into Supabase `games.extras`.
//
//   node scripts/push-i18n.mjs [--dry-run]
//
// The shelf reads curated content from games.extras, not from games.json, so
// the Thai fields merged by scripts/merge-i18n.py only show up on the live
// site once they are in the database too. This copies exactly three things
// per game — blurb_th, caption_th, and teach.captions_th / teach.frames_th —
// into the row's existing extras, leaving every other key (and every BGG
// column) untouched. Unlike scripts/migrate-games-json.mjs it is safe to run
// after a BGG sync, and safe to run again: a game whose extras already carry
// the same Thai is skipped.
//
// Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the environment or
// from .env in the repo root (see .env.example). The service role key bypasses
// RLS; that is why this runs on your machine and never in the browser.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GAMES = path.join(ROOT, 'games.json');
const PAGE = 1000;

const dryRun = process.argv.includes('--dry-run');

async function loadDotEnv() {
  try {
    const raw = await readFile(path.join(ROOT, '.env'), 'utf8');
    for (const line of raw.split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (!m || line.trim().startsWith('#')) continue;
      const val = m[2].replace(/^(['"])(.*)\1$/, '$2');
      if (!(m[1] in process.env)) process.env[m[1]] = val;
    }
  } catch { /* no .env — rely on the environment */ }
}
await loadDotEnv();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.example).');
  process.exit(2);
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const filled = (v) => typeof v === 'string' && v.trim() !== '';
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// The Thai fields a games.json entry carries, keyed as they live in extras.
function thaiOf(g) {
  const out = {};
  if (filled(g.blurb_th)) out.blurb_th = g.blurb_th;
  if (filled(g.caption_th)) out.caption_th = g.caption_th;
  const t = g.teach;
  if (t && Array.isArray(t.captions_th)) {
    out.captions_th = t.captions_th;
    if (Array.isArray(t.frames_th)) out.frames_th = t.frames_th;
  }
  return out;
}

// ---- read ----

const games = JSON.parse(await readFile(GAMES, 'utf8'));
const wanted = new Map();
for (const g of games) {
  const th = thaiOf(g);
  if (Object.keys(th).length) wanted.set(String(g.bggId), th);
}
console.log(`games.json: ${wanted.size} of ${games.length} games carry Thai`);

const rows = new Map();
for (let from = 0; ; from += PAGE) {
  const { data, error } = await db
    .from('games')
    .select('bgg_id, extras')
    .in('bgg_id', Array.from(wanted.keys()))
    .range(from, from + PAGE - 1);
  if (error) { console.error('✗ read games:', error.message); process.exit(1); }
  for (const r of data) rows.set(String(r.bgg_id), r.extras || {});
  if (data.length < PAGE) break;
}

// ---- diff ----

const updates = [];
let unchanged = 0;
const missing = [];
for (const [id, th] of wanted) {
  const extras = rows.get(id);
  if (extras === undefined) { missing.push(id); continue; }
  const next = { ...extras };
  if (th.blurb_th !== undefined) next.blurb_th = th.blurb_th;
  if (th.caption_th !== undefined) next.caption_th = th.caption_th;
  if (th.captions_th !== undefined) {
    // Merge into the teach block already in the row rather than replacing it.
    const teach = { ...(extras.teach && typeof extras.teach === 'object' ? extras.teach : {}) };
    teach.captions_th = th.captions_th;
    if (th.frames_th !== undefined) teach.frames_th = th.frames_th;
    next.teach = teach;
  }
  if (same(next, extras)) { unchanged++; continue; }
  updates.push({ id, extras: next });
}

console.log(`to update ${updates.length} · already current ${unchanged} · not in games table ${missing.length}`);
if (missing.length) console.log('  not in games table (never synced?): ' + missing.join(', '));
if (dryRun) {
  console.log('\n--dry-run: nothing written. Sample:');
  if (updates[0]) console.log(JSON.stringify({ bgg_id: updates[0].id, blurb_th: updates[0].extras.blurb_th, caption_th: updates[0].extras.caption_th, teach_keys: Object.keys(updates[0].extras.teach || {}) }, null, 2));
  process.exit(0);
}

// ---- write: one UPDATE of the extras column per row ----

let written = 0;
for (const u of updates) {
  const { error } = await db.from('games').update({ extras: u.extras }).eq('bgg_id', u.id);
  if (error) { console.error(`\n✗ games ${u.id}:`, error.message); process.exit(1); }
  written++;
  process.stdout.write(`\rgames.extras ${written}/${updates.length}`);
}
console.log(`\n✓ done — ${written} rows updated`);

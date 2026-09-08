#!/usr/bin/env node
// One-time migration: games.json → Supabase.
//
//   node scripts/migrate-games-json.mjs <auth-user-uuid> [--display-name="…"] [--dry-run]
//
// Creates (or updates) the profile with slug "noknaruephon" for the given
// auth user id, upserts every game in games.json into the shared `games`
// cache — BGG fields in their columns, the curated fields (blurb, why, tag,
// teach, …) in `extras` — and marks each one owned in `user_games`.
//
// Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the environment or
// from a .env file in the repo root (see .env.example). The service role key
// bypasses RLS; that is why this runs on your machine and never in the
// browser.
//
// Run it once. It is idempotent for the shelf (re-running re-asserts the same
// rows), but a re-run AFTER a real BGG sync would overwrite the synced BGG
// fields with the games.json values, so treat it as a one-shot.

import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { DEFAULT_SHELF_SLUG } from '../js/config.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GAMES = path.join(ROOT, 'games.json');
const COVERS = path.join(ROOT, 'covers');
const CHUNK = 200;

// Curated fields carried over verbatim into games.extras, keyed as in games.json.
const EXTRA_KEYS = [
  'color', 'blurb', 'why', 'tag', 'playerRecommendations', 'caption', 'caption_override',
  'teach', 'fingerprint', 'backImage', 'spineImage', 'tableShot', 'weight',
];

// ---- args + env ----

const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => {
  const [k, ...v] = a.slice(2).split('=');
  return [k, v.length ? v.join('=') : true];
}));
const userId = args.find((a) => !a.startsWith('--'));
const dryRun = flags['dry-run'] === true;

if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) {
  console.error('Usage: node scripts/migrate-games-json.mjs <auth-user-uuid> [--display-name="…"] [--dry-run]');
  console.error('The uuid is your user id from Supabase → Authentication → Users.');
  process.exit(2);
}

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
const SITE_URL = (process.env.SITE_URL || 'https://boardgameshelf.vercel.app').replace(/\/$/, '');
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.example).');
  process.exit(2);
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const exists = (p) => access(p).then(() => true, () => false);
const chunks = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

// ---- rows ----

async function gameRow(g, now) {
  const id = String(g.bggId);
  // Spec §6: a local /covers/<id>.jpg becomes thumbnail_url. None exist today
  // (covers/ holds back-of-box and spine photos), so this falls through to the
  // BGG URL games.json already carries — the same picture the shelf shows now.
  const localCover = (await exists(path.join(COVERS, `${id}.jpg`))) ? `${SITE_URL}/covers/${id}.jpg` : null;

  const extras = {};
  for (const k of EXTRA_KEYS) if (g[k] !== undefined && g[k] !== null) extras[k] = g[k];

  const [minP, maxP] = Array.isArray(g.players) ? g.players : [null, null];
  const [minT, maxT] = Array.isArray(g.time) ? g.time : [null, null];

  return {
    bgg_id: id,
    name: g.title,
    year_published: g.yearPublished ?? null,
    min_players: minP ?? null,
    max_players: maxP ?? null,
    min_playtime: minT ?? null,
    max_playtime: maxT ?? null,
    weight: typeof g.weightScore === 'number' ? g.weightScore : null,
    bgg_rating: typeof g.bggRating === 'number' ? g.bggRating : null,
    subtype: g.subtype === 'boardgameexpansion' ? 'boardgameexpansion' : 'boardgame',
    mechanics: Array.isArray(g.mechanics) ? g.mechanics : [],
    categories: Array.isArray(g.categories) ? g.categories : [],
    description: g.blurb || null,
    thumbnail_url: localCover || g.image || null,
    image_url: g.image || null,
    extras,
    player_recommendations: g.playerRecommendations || null,
    updated_at: now,
  };
}

// ---- run ----

const games = JSON.parse(await readFile(GAMES, 'utf8'));
const now = new Date().toISOString();
const displayName = typeof flags['display-name'] === 'string' ? flags['display-name'] : DEFAULT_SHELF_SLUG;

const profile = {
  id: userId,
  slug: DEFAULT_SHELF_SLUG,
  bgg_username: DEFAULT_SHELF_SLUG,
  display_name: displayName,
  is_public: true,
};

const gameRows = [];
for (const g of games) gameRows.push(await gameRow(g, now));
const ids = new Set(gameRows.map((r) => r.bgg_id));
if (ids.size !== gameRows.length) {
  console.error('✗ duplicate bggId in games.json');
  process.exit(1);
}
const userRows = gameRows.map((r) => ({
  user_id: userId, bgg_id: r.bgg_id, owned: true, wishlist: false,
  user_rating: null, num_plays: 0, comment: null, synced_at: now,
}));

console.log(`profile   /u/${profile.slug} → ${userId}`);
console.log(`games     ${gameRows.length} rows (${gameRows.filter((r) => Object.keys(r.extras).length).length} with curated extras)`);
console.log(`user_games ${userRows.length} rows`);
if (dryRun) {
  console.log('\n--dry-run: nothing written. Sample games row:\n');
  console.log(JSON.stringify({ ...gameRows[0], extras: Object.keys(gameRows[0].extras) }, null, 2));
  process.exit(0);
}

{
  const { error } = await db.from('profiles').upsert(profile, { onConflict: 'id' });
  if (error) {
    if (error.code === '23505') {
      console.error(`✗ slug "${profile.slug}" is already claimed by a different user. Free it first.`);
    } else if (error.code === '23503') {
      console.error(`✗ no auth user with id ${userId}. Sign in once on the site, then copy your id from Supabase → Authentication → Users.`);
    } else {
      console.error('✗ profile:', error.message);
    }
    process.exit(1);
  }
}

let written = 0;
for (const part of chunks(gameRows, CHUNK)) {
  const { error } = await db.from('games').upsert(part, { onConflict: 'bgg_id' });
  if (error) { console.error('✗ games:', error.message); process.exit(1); }
  written += part.length;
  process.stdout.write(`\rgames     ${written}/${gameRows.length}`);
}
console.log();

written = 0;
for (const part of chunks(userRows, CHUNK)) {
  const { error } = await db.from('user_games').upsert(part, { onConflict: 'user_id,bgg_id' });
  if (error) { console.error('✗ user_games:', error.message); process.exit(1); }
  written += part.length;
  process.stdout.write(`\ruser_games ${written}/${userRows.length}`);
}
console.log();

{
  const { error } = await db.from('profiles').update({ last_synced_at: now }).eq('id', userId);
  if (error) { console.error('✗ last_synced_at:', error.message); process.exit(1); }
}

console.log(`\n✓ done — open ${SITE_URL}/u/${profile.slug}`);

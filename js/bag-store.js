// Bags — where they live.
//
// A bag is a named subset of a shelf: the games you packed for a trip. It has
// its own page at /bag/<id> that anyone with the link can open. Stage 2 keeps
// bags in Supabase (table `bags`, migration 20260911000000_bags.sql) and this
// module is the only place in the app that knows that: every caller is
// written against the interface below, so moving bags to signed-in accounts
// later changes this file and nothing else.
//
// The anon key never touches the table itself — RLS is on with no policies.
// Every read and write is one of the bag_* functions, and the only thing kept
// in this browser is the edit token a bag hands back when it is created, under
// localStorage['bgs.bagTokens'] as { [id]: token }. The token is what makes a
// later update or delete allowed; the database keeps only its hash.
//
// Bag (public shape) = { id, owner, name, game_ids: string[], created_at, updated_at }.
// game_ids are shelf ids — bggId from games.json — as strings. Stage 4 will
// attach a second list to a bag (viewer proposals) in its own table; game_ids
// is the packed list, not "every game a bag knows about".

import { supabase } from './supabase.js';
import { DEFAULT_SHELF_SLUG } from './config.js';

const TOKENS_KEY = 'bgs.bagTokens';
const LEGACY_KEY = 'bgs.bags.v1';   // Stage 1's localStorage bags, migrated once

export const BAG_ID_PATTERN = /^[a-z0-9]{8}$/;

// ---- edit tokens ----

// Storage can be unavailable (private windows, a full quota, a browser that
// blocks it); a token that cannot be kept means the bag is read-only from
// here, which is exactly what canEdit() will then report.
function readTokens() {
  try {
    const raw = localStorage.getItem(TOKENS_KEY);
    const data = raw ? JSON.parse(raw) : null;
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}

function writeTokens(tokens) {
  try {
    if (Object.keys(tokens).length) localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
    else localStorage.removeItem(TOKENS_KEY);
  } catch {
    /* ignore */
  }
}

function tokenFor(id) {
  const t = readTokens()[String(id)];
  return typeof t === 'string' && t ? t : null;
}

function rememberToken(id, token) {
  const tokens = readTokens();
  tokens[String(id)] = token;
  writeTokens(tokens);
}

function forgetToken(id) {
  const tokens = readTokens();
  delete tokens[String(id)];
  writeTokens(tokens);
}

// ---- shapes ----

function toIds(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of value) {
    if (raw === null || raw === undefined) continue;
    const id = String(raw);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function toBag(row) {
  if (!row || typeof row !== 'object' || !row.id) return null;
  return {
    id: String(row.id),
    owner: String(row.owner || DEFAULT_SHELF_SLUG),
    name: typeof row.name === 'string' && row.name ? row.name : 'Bag',
    game_ids: toIds(row.game_ids),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// The functions raise FORBIDDEN / NOT_FOUND by name; the client keeps the
// name so the page can say which happened without matching prose.
class BagError extends Error {
  constructor(code, cause) {
    super(code);
    this.code = code;
    if (cause) this.cause = cause;
  }
}

function classify(error) {
  const text = String(error?.message || error?.details || '');
  if (/FORBIDDEN/i.test(text)) return new BagError('FORBIDDEN', error);
  if (/NOT_FOUND/i.test(text)) return new BagError('NOT_FOUND', error);
  return new BagError('UNAVAILABLE', error);
}

async function rpc(fn, args) {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw classify(error);
  return data;
}

// ---- the store ----

export const bagStore = {
  /** Every bag packed from a shelf, most recently changed first. */
  async list(owner = DEFAULT_SHELF_SLUG) {
    const rows = await rpc('bag_list', { p_owner: owner });
    return (Array.isArray(rows) ? rows : []).map(toBag).filter(Boolean);
  },

  /** @returns {Promise<object|null>} null for an id nobody has */
  async get(id) {
    if (!id || !BAG_ID_PATTERN.test(String(id))) return null;
    const rows = await rpc('bag_get', { p_id: String(id) });
    return toBag(Array.isArray(rows) ? rows[0] : rows);
  },

  /**
   * Packs a new bag. The edit token comes back exactly once and is kept
   * here; the returned bag is the public shape.
   */
  async create({ name, game_ids, owner = DEFAULT_SHELF_SLUG }) {
    const rows = await rpc('bag_create', {
      p_name: String(name || '').trim() || 'Bag',
      p_game_ids: toIds(game_ids),
      p_owner: owner,
    });
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row?.id || !row?.edit_token) throw new BagError('UNAVAILABLE');
    rememberToken(row.id, row.edit_token);
    const bag = await bagStore.get(row.id);
    if (!bag) throw new BagError('UNAVAILABLE');
    return bag;
  },

  /** Rewrites a bag this browser holds the token for. Throws NO_TOKEN otherwise. */
  async update(id, { name, game_ids }) {
    const token = tokenFor(id);
    if (!token) throw new BagError('NO_TOKEN');
    const rows = await rpc('bag_update', {
      p_id: String(id),
      p_token: token,
      p_name: String(name || '').trim() || 'Bag',
      p_game_ids: toIds(game_ids),
    });
    const bag = toBag(Array.isArray(rows) ? rows[0] : rows);
    if (!bag) throw new BagError('UNAVAILABLE');
    return bag;
  },

  async remove(id) {
    const token = tokenFor(id);
    if (!token) throw new BagError('NO_TOKEN');
    await rpc('bag_delete', { p_id: String(id), p_token: token });
    forgetToken(id);
  },

  /** True when this browser packed the bag (or edited it): the token is here. */
  canEdit(id) {
    return !!tokenFor(id);
  },
};

// ---- Stage 1 → Stage 2 ----

/**
 * Stage 1 kept bags in localStorage['bgs.bags.v1']. On the first load with
 * the flag on they are packed again through bag_create, so they get a page
 * and a token like any other, and the old key is removed. Silent: a failure
 * leaves the key in place for the next visit and says so on the console.
 */
export async function migrateLegacyBags(owner = DEFAULT_SHELF_SLUG) {
  let legacy = null;
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return 0;
    legacy = JSON.parse(raw);
  } catch {
    // Unreadable: nothing worth carrying over. Clear it so this never repeats.
    try { localStorage.removeItem(LEGACY_KEY); } catch { /* ignore */ }
    return 0;
  }
  const bags = Array.isArray(legacy?.bags) ? legacy.bags : [];
  let moved = 0;
  try {
    for (const old of bags) {
      const ids = toIds(old?.game_ids);
      if (!ids.length) continue;
      await bagStore.create({ name: old?.name, game_ids: ids, owner });
      moved += 1;
    }
    try { localStorage.removeItem(LEGACY_KEY); } catch { /* ignore */ }
    console.log(`[bag] moved ${moved} bag${moved === 1 ? '' : 's'} from this browser to the shelf`);
  } catch (err) {
    console.warn('[bag] could not move the bags kept in this browser; will try again next visit', err);
  }
  return moved;
}

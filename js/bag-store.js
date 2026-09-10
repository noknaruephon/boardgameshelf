// Bags — where they live.
//
// A bag is a named subset of the shelf: the games you packed for a trip.
// Stage 1 keeps them in this browser. Stage 3 swaps this file for Supabase
// (a `bags` table plus RPC) once auth ships, and nothing else has to change:
// this module is the only place in the app that knows where a bag is stored,
// and every caller is written against the interface below.
//
// Stored under KEY as { bags: Bag[], active: string | null }.
// Bag = { id, name, game_ids: string[], created_at, updated_at }.
// game_ids are shelf ids — bggId from games.json — as strings.
//
// Every read is guarded: a corrupt or half-written value reads as "no bags"
// rather than throwing and taking the shelf down with it. Reads never write,
// so simply looking at the store cannot create the key.

const KEY = 'bgs.bags.v1';

function empty() {
  return { bags: [], active: null };
}

function newId() {
  return `bag_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

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

function toBag(value) {
  if (!value || typeof value !== 'object' || !value.id) return null;
  const now = new Date().toISOString();
  return {
    id: String(value.id),
    name: typeof value.name === 'string' ? value.name : '',
    game_ids: toIds(value.game_ids),
    created_at: typeof value.created_at === 'string' ? value.created_at : now,
    updated_at: typeof value.updated_at === 'string' ? value.updated_at : now,
  };
}

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || !Array.isArray(data.bags)) return empty();
    const bags = data.bags.map(toBag).filter(Boolean);
    // The active id is handed back as stored, even when no bag answers to it:
    // clearing it is a write, and a read never writes. shelf-scope.js is where
    // a dangling id gets cleared, on the first look that notices it.
    const active = typeof data.active === 'string' && data.active ? data.active : null;
    return { bags, active };
  } catch {
    return empty();
  }
}

// Storage can be unavailable (private windows, a full quota, a browser that
// blocks it): a bag that fails to persist is not worth an exception on the
// shelf, so the write is dropped and the in-memory session carries on.
function write(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export const bagStore = {
  /** @returns {Array<object>} every bag, oldest first */
  list() {
    return read().bags;
  },

  /** @returns {object|null} */
  get(id) {
    if (!id) return null;
    return read().bags.find(b => b.id === String(id)) || null;
  },

  /**
   * Upsert. A bag without an id is created; one with a known id is overwritten
   * in place, so editing a bag never leaves a duplicate behind. Always stamps
   * updated_at, and keeps the original created_at.
   * @returns {object} the stored bag
   */
  save(bag) {
    const data = read();
    const now = new Date().toISOString();
    const id = bag && bag.id ? String(bag.id) : newId();
    const index = data.bags.findIndex(b => b.id === id);
    const stored = {
      id,
      name: String((bag && bag.name) || '').trim() || 'Bag',
      game_ids: toIds(bag && bag.game_ids),
      created_at: index === -1
        ? String((bag && bag.created_at) || now)
        : data.bags[index].created_at,
      updated_at: now,
    };
    if (index === -1) data.bags.push(stored);
    else data.bags[index] = stored;
    write(data);
    return stored;
  },

  remove(id) {
    const key = String(id);
    const data = read();
    data.bags = data.bags.filter(b => b.id !== key);
    if (data.active === key) data.active = null;
    write(data);
  },

  /** @returns {string|null} the packed bag's id */
  activeId() {
    return read().active;
  },

  /** Pass null to unpack. Unpacking keeps the bag itself. */
  setActive(id) {
    const data = read();
    const key = id === null || id === undefined ? null : String(id);
    data.active = key && data.bags.some(b => b.id === key) ? key : null;
    write(data);
  },
};

// Which games the shelf is looking at.
//
// One function, one rule: with a bag packed the shelf *is* that bag, and with
// no bag it is the whole collection. The grid, the header count, the search
// and the filter sheet all read through scopedGames(), so the rule exists in
// exactly one place. Stage 2 points game night, share-as-image and "pick for
// tonight" at the same function rather than repeating it.
//
// The shelf's game shape (games.json → shelf-data.js) keys its id as `bggId`;
// bags store those ids as strings.

import { bagStore } from './bag-store.js';

// Off until the ?bag=1 flag turns it on. While off nothing here reads storage,
// so a shelf without the flag never touches the bags key at all.
let enabled = false;

// Packing mode picks from the whole shelf, including games the bag being
// edited doesn't hold yet — so scoping is suspended for as long as it lasts.
// The bag itself stays active in storage, which is what lets Cancel drop back
// into the packed shelf with nothing changed.
let suspended = false;

export function enableScope(on) {
  enabled = !!on;
}

export function suspendScope(on) {
  suspended = !!on;
}

/**
 * The packed bag, or null. An active id pointing at a bag that no longer
 * exists is cleared silently rather than left to fail every later read.
 * @returns {object|null}
 */
export function activeBag() {
  if (!enabled) return null;
  const id = bagStore.activeId();
  if (!id) return null;
  const bag = bagStore.get(id);
  if (!bag) {
    bagStore.setActive(null);
    return null;
  }
  return bag;
}

/**
 * @param {Array<object>} allGames every game on the shelf
 * @returns {Array<object>} the bag's games, or allGames when nothing is packed
 */
export function scopedGames(allGames) {
  if (suspended) return allGames;
  const bag = activeBag();
  if (!bag) return allGames;
  // Ids the shelf no longer carries (a game dropped on the last sync) simply
  // don't match anything here; the next save drops them from the bag.
  const ids = new Set(bag.game_ids);
  return allGames.filter(g => ids.has(String(g.bggId)));
}

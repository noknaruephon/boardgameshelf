# Spec: Bag — Stage 1 (packing mode, coverage bar, active bag on the shelf)

**Scope:** let Nok pack a named subset of the shelf ("a bag"), see whether it covers the trip, and make the shelf grid behave as if the bag is the collection. Behind `?bag=1`.

**Not in this stage:** scoping game night, share-as-image, and other features to the bag (Stage 2); shareable bag URLs and Supabase persistence (Stage 3, after auth); games not on the shelf; per-day plans.

**Mockup:** `docs/mockups/bag-packing-mockup.html` — three states in the toggle bar: Browsing, Packing, Packed. Visual source of truth; values below come from it.

---

## 1. Concept

```
Browsing ──"Pack a bag"──▶ Packing ──"Pack N games"──▶ Packed ──"Unpack"──▶ Browsing
                            │  ▲                          │
                          Cancel └────────"Edit"──────────┘
```

- **Bag** = `{ id, name, game_ids[], created_at, updated_at }`. Several may exist; at most one is **active**.
- **Packing** = the shelf grid in select mode with a fixed coverage bar at the bottom.
- **Packed** = a bag is active: the grid shows only bagged games, a chip at the top says which bag and offers Edit / Unpack.

## 2. Data & storage

### `bag-store.js` (new) — the only module that knows where bags live

```js
// Stage 1: localStorage. Stage 3 swaps this file for Supabase RPC; the interface stays.
const KEY = 'bgs.bags.v1';
export const bagStore = {
  list()            → Bag[]
  get(id)           → Bag | null
  save(bag)         → Bag          // upsert; sets updated_at
  remove(id)
  activeId()        → string | null
  setActive(id|null)
};
```

Shape stored under `KEY`: `{ bags: Bag[], active: string | null }`. Guard every read with try/catch; a corrupt value resets to empty rather than throwing.

### `shelf-scope.js` (new) — the single source of truth for "which games are visible"

```js
export function scopedGames(allGames) {
  const id = bagStore.activeId();
  if (!id) return allGames;
  const bag = bagStore.get(id);
  if (!bag) { bagStore.setActive(null); return allGames; }
  const set = new Set(bag.game_ids);
  return allGames.filter(g => set.has(String(g.id)));
}
export function activeBag() { … }   // → Bag | null
```

**Every consumer of the game list on the shelf page reads through `scopedGames()`** — grid, count in the header, search, filters, sort. Stage 2 will point game night / share / pick at the same function; don't duplicate the filtering logic anywhere else.

Game IDs are BGG object IDs from `games.json`, stored as strings.

## 3. Feature flag

Same pattern as `?vibes=1` / `?teach=1`: read `bag=1` from the URL once at boot, persist to `sessionStorage` so navigation inside the site keeps it, expose `flags.bag`. When off, nothing in this spec renders and no localStorage key is touched.

## 4. UI

Tokens: use the production `--bgs-*` variables. The mockup's hex values are approximations.

### 4.1 Entry point (Browsing)
In the shelf header actions, add a **"Pack a bag"** button (`.btn` style, secondary). Hidden while Packing or Packed.

### 4.2 Packing mode
- `body[data-state="packing"]` (or the project's equivalent) turns grid tiles into toggles:
  - tile gets `role="button"`/`<button>`, `aria-pressed="true|false"`, and an `aria-label` of `"{name}, {players} players, {playtime} minutes"`.
  - selected: 3px gold ring via `box-shadow: inset 0 0 0 3px var(--bgs-gold)` on a pseudo-element or overlay — **never `outline`**; a 28px gold check badge top-right.
  - unselected: cover at 78% opacity, 100% on hover.
  - tap toggles; the game modal does **not** open in this mode.
- A one-line hint above the grid: "Tap covers to pack them."
- Cover art unchanged; caption shows name plus a mono `2–4p · 30–45 min` line (already available from `minplayers/maxplayers/minplaytime/maxplaytime` in `games.json` — confirm field names).

### 4.3 Coverage bar (fixed bottom, Packing only)
Slides up on entering Packing (`transform: translateY`, 220ms; no transition when `prefers-reduced-motion`). Contents, left to right, wrapping on narrow screens:

| Element | Spec |
|---|---|
| Bag name | text input, Fraunces 22px, placeholder "Name the bag", underline only; gold underline on focus |
| Games | count, Fraunces 22px 500 |
| Players | eight 22×22 cells labelled `1 2 3 4 5 6 7 8+`; a cell is gold-filled when at least one packed game supports that count (`minplayers ≤ n ≤ maxplayers`; the `8+` cell = `maxplayers ≥ 8`) |
| Playtime | `{min of minplaytime}–{max of maxplaytime} min`, or `—` when empty |
| Gaps | pills, computed only when ≥1 game is packed: **"Nothing for 2 players"** if cell 2 is empty; **"Nothing for 5 players"** if cell 5 is empty; **"Nothing under 30 min"** if no packed game has `maxplaytime ≤ 30`. When none apply, the slot reads "Covered" in ivory-45 |
| Actions | "Cancel" (quiet) and **"Pack N games"** (primary gold; disabled at 0; singular at 1) |

Recompute on every toggle. Numbers use `font-variant-numeric: tabular-nums` so the bar doesn't jitter.

The bar's `aria-hidden` mirrors visibility. The bar is `role="region"` `aria-label="Bag coverage"`; the gaps container is `aria-live="polite"` so screen-reader users hear a gap appear/disappear as they pack.

### 4.4 Packed state
- `scopedGames()` now returns the bag; the grid re-renders with only those games. Header count reads `"{n} of {total} games"`.
- **Active chip** below the header: `[Bag name]  {n} games · {players} · {playtime}   [Edit] [Unpack]`. Pill, plate background, 1px gold ring via inset box-shadow. Players text is `"{lowest covered}–{highest covered} players"` (`8+` if the top cell is on).
- A dashed **"+ Add more"** tile is appended to the grid; it opens Packing with the current bag pre-selected.
- **Edit** → Packing with the bag's games pre-selected and its name in the input. Saving overwrites the same bag id.
- **Unpack** → `setActive(null)`, back to Browsing, full grid. The bag object is kept (not deleted).
- Cancel while editing an existing bag → back to Packed with no changes. Cancel while creating a new bag → Browsing, nothing saved.

### 4.5 Empty bag name
On "Pack", if the name is blank, use `"Bag"` and don't block. Don't invent a date-based name.

## 5. Motion

Only two transitions: the coverage bar slide (220ms) and the check badge scale (160ms). Both off under `prefers-reduced-motion`. **Don't add `animation` to any element that also has a `transition` on the same property** — WebKit drops the transition (see the WebKit rule in `docs/`).

## 6. Persistence details

- Toggling in Packing mode edits an in-memory draft; nothing is written until "Pack N games".
- On page load with `flags.bag` on and an active bag id present, boot straight into Packed. If the active id no longer exists, clear it silently.
- Bagged game ids that are no longer in `games.json` (removed on sync) are ignored at read time and dropped on the next save.

## 7. Verification

- [ ] Without `?bag=1`: no "Pack a bag" button, no bar, no chip, `localStorage['bgs.bags.v1']` never created.
- [ ] With `?bag=1`: Pack a bag → tap 3 covers → bar shows 3, correct player cells, correct playtime range.
- [ ] Pack only *7 Wonders Duel* and *Patchwork*: cells 2 on, others off; gaps show "Nothing for 5 players" only.
- [ ] Pack only *Brass: Birmingham*: gaps show "Nothing for 5 players" and "Nothing under 30 min".
- [ ] Pack 0 games: button disabled, gaps slot empty (no "Covered"), playtime `—`.
- [ ] "Pack 3 games" → grid shows exactly those 3 + "Add more" tile; header reads "3 of 196 games"; chip meta matches the bar.
- [ ] Reload: still Packed with the same bag.
- [ ] Edit → deselect one → Pack → chip and grid update; same bag id in storage (no duplicate).
- [ ] Unpack → full grid, header "196 games"; the bag still exists in storage.
- [ ] Search/filter while Packed only searches bagged games.
- [ ] Keyboard: Tab reaches every tile; Space/Enter toggles; `aria-pressed` updates; bar controls reachable; gaps announced.
- [ ] Safari iOS: bar respects `env(safe-area-inset-bottom)`; ring renders inside the tile (no clipped outline); transitions off with Reduce Motion on.
- [ ] `games.json` unchanged (diff additive).

## 8. Stage 2 / 3 (deferred, for context only)

- **Stage 2:** game night lobby draws its voting pool from `scopedGames()`; share-as-image mosaic uses the bag; "pick for tonight" uses the bag. Chip appears on those screens too.
- **Stage 3:** `bag-store.js` → Supabase table `bags` + RPC once auth ships; shareable `/u/{username}/bag/{slug}`; friends see the bag read-only.

## 9. Commit

```
feat(bag): packing mode, coverage bar and active bag scoping the shelf

Adds a "Pack a bag" flow behind ?bag=1: select games on the shelf,
see player/playtime coverage and gaps, then scope the grid to the bag.
Bags persist in localStorage via bag-store.js; shelf-scope.js is the
single filter point for later stages.
```

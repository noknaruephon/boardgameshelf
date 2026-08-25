# Claude Code Task — Extract game data and filter logic from `index.html`

**One change, nothing else.** No new features, no visual changes, no refactoring
beyond what's described here. When this is done the site must look and behave
exactly as it does now.

**Why:** `index.html` is 238KB, and 196KB of that is a hardcoded games array shipped
on every page load. Upcoming work (a game-night session builder) needs the same data
and the same filter logic. Duplicating either would guarantee they drift apart. This
extracts both into shared files so there is one source of truth.

---

## 1. Investigate first — do not skip

**The daily BoardGameGeek sync currently writes the games array into `index.html`.**
After this change it must write `games.json` instead. If that isn't updated, the next
sync will either clobber the extraction or silently stop updating the collection.

Before writing any code, find the sync. There is no `.github/` directory in the repo,
so it is not an Actions workflow here. Check for a script elsewhere in the repo, a
Vercel cron in `vercel.json`, or ask the user how the sync runs.

**If you cannot locate it, stop and ask before proceeding.** Shipping the extraction
without updating the sync is worse than not shipping it.

---

## 2. Current structure

| Lines | Contents |
|---|---|
| 876 | `<script>` opens |
| 877–6875 | `const games = [ ... ]` — the array to extract |
| 6876–~6935 | Filter logic and label helpers — to extract |
| ~6944 onward | `render()`, `openCard()`, UI wiring — **leave in place** |

There are no inline `onclick` / `onchange` handlers anywhere in the file, so nothing
depends on these being global.

---

## 3. Create `games.json`

Move the array at lines 877–6875 into `/games.json` at the repo root. Pure move —
do not reformat, reorder, rename fields, or "clean up" any entry. A diff of the data
itself should show only the change from JS array literal to JSON.

Note the trailing `];` at line 6875 belongs to the array and goes with it.

---

## 4. Create `js/filters.js`

Move these out of `index.html` verbatim and export each:

- `DEFAULT_FILTERS`
- `isFilterActive`
- `activeGroupCount`
- `playersLabel`
- `timeBucket`
- `playersMatch`
- `bestFitMatch`
- `applyFilters`
- `weightLabel`
- `timeLabel`
- `playersRangeLabel`

**Copy the logic exactly.** These encode real decisions — the `11` slider value
meaning "11+", the `bestFit` check requiring every count in range to be recommended,
the quick/medium/long thresholds at 30 and 60 minutes on the *average* of the time
range. Do not "improve" any of it. A behaviour change here is a bug, even if the new
version looks tidier.

---

## 5. Update `index.html`

Change the opening `<script>` at line 876 to `<script type="module">`, then:

```js
import {
  DEFAULT_FILTERS, isFilterActive, activeGroupCount, playersLabel,
  timeBucket, playersMatch, bestFitMatch, applyFilters,
  weightLabel, timeLabel, playersRangeLabel
} from './js/filters.js';

let games = [];

async function loadGames() {
  const res = await fetch('/games.json');
  if (!res.ok) throw new Error('Failed to load games');
  games = await res.json();
}
```

Everything downstream stays as-is. `render()`, `openCard()`, the filter sheet wiring —
untouched.

**Startup:** the page already shows a "Loading the shelf…" state and skeleton cards.
Await `loadGames()` before the first `render()`, so the skeletons stay visible until
data arrives instead of flashing an empty shelf.

**Failure state:** if the fetch fails, show a message in the shelf area — "Couldn't
load the collection. Try refreshing." Do not leave the skeletons spinning forever;
a permanent loading state looks like a hung page.

`type="module"` defers execution automatically, so any existing `DOMContentLoaded`
wrapper is now redundant but harmless. Leave it or remove it, your call — just don't
change behaviour.

---

## 6. Caching

`games.json` changes once a day; the rest of the site rarely changes. Add a cache
header for it in `vercel.json` — **merge into the existing config, do not replace it:**

```json
{
  "headers": [
    {
      "source": "/games.json",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" }
      ]
    }
  ]
}
```

This lets the browser cache it but revalidate each load, so a sync shows up
immediately rather than being stuck behind a stale cache.

If `vercel.json` already has a `headers` array, append to it rather than adding a
second one.

---

## 7. Do not touch

- `render()`, `openCard()`, or any card markup — a card-grid redesign is landing
  separately and will conflict.
- Any CSS. Not one line.
- The `covers/` directory.
- Anything in `docs/`.

If you believe something here needs changing to make the extraction work, stop and
explain in the PR rather than doing it.

---

## 8. Verification

- [ ] `git diff --stat` shows: `index.html` heavily reduced, `games.json` added,
      `js/filters.js` added, `vercel.json` lightly modified. Nothing else.
- [ ] `index.html` is roughly 40KB, down from 238KB.
- [ ] `games.json` parses as valid JSON and contains **195** entries.
- [ ] No CSS changed: `git diff index.html` shows no changes inside `<style>`.
- [ ] The sync process now targets `games.json` (see §1).

On the preview deployment:

- [ ] The shelf renders all 195 games, visually identical to production.
- [ ] Every filter works: player count slider, the `11+` case, "recommended counts
      only", time buckets, weight buckets, search, and sort.
- [ ] Filter combinations that return nothing still show "Nothing fits that combo."
- [ ] Tapping a card opens the detail modal; the box-back flip still works.
- [ ] Hard-refresh with an empty cache: skeletons appear, then the shelf fills in.
      No flash of an empty shelf.
- [ ] Block `/games.json` in DevTools and reload: the error message appears rather
      than a permanent loading state.

---

## 9. PR notes

State in the description:

- The measured before/after page weight.
- How the daily sync was located and what changed in it.
- Anything you had to touch beyond §3–§6, and why.

# Spec: BGG mechanics & categories sync

**Goal:** enrich every game in `games.json` with `mechanics` and `categories` arrays sourced from BoardGameGeek, and make the fetch repeatable so future additions to the collection get the same data with one command.

**Design source of truth:** `scripts/sync-bgg-taxonomy.py` (delivered alongside this spec — copy it into the repo verbatim; it is fully tested).

---

## What changes

### 1. New file: `scripts/sync-bgg-taxonomy.py`

Zero-dependency Python 3.8+ script (stdlib only — `urllib`, `xml.etree`, `json`). Copy the delivered file into `scripts/`. Do not rewrite it. Behavior summary:

- Reads `games.json` (path resolved relative to the script: `../games.json`)
- Collects every game missing `mechanics` **or** `categories`; `--force` refetches all
- Fetches `https://boardgamegeek.com/xmlapi2/thing?id=<up to 20 ids>` in batches, 2s apart, with an identifying User-Agent
- Handles BGG's quirks: HTTP **202** (request queued — retry with growing delay), **429** (exponential backoff), transient network errors
- Parses only `<link type="boardgamemechanic">` and `<link type="boardgamecategory">` elements; designer/artist/publisher links are ignored
- Inserts the two new keys **immediately after `weightScore`** in each game object, preserving all other key order
- Writes atomically (`games.json.tmp` → `os.replace`) with `indent=2, ensure_ascii=False` + trailing newline — verified byte-identical round-trip against the current file, so the diff is purely additive
- Exits non-zero and prints a warning list if any fetched game came back with zero mechanics **and** zero categories (signal that a `bggId` may be wrong or point at an odd entry)

### 2. Schema addition to `games.json`

Each game object gains, after `weightScore`:

```json
"mechanics": ["Open Drafting", "Hand Management", "Tile Placement"],
"categories": ["Animals", "Card Game"],
```

- Values are BGG's canonical English strings, in BGG's order. Store them verbatim — no renaming, no lowercasing. Display-layer copy decisions come later; this pass is raw data only.
- Plain strings, not `{id, value}` objects — matches the flat style of the rest of the file. BGG taxonomy names are stable enough for this use.
- Empty arrays are legal (some party games have very sparse taxonomy) but zero-both triggers the warning above.

### 3. No UI changes in this PR

`index.html`, `js/filters.js`, `js/game-modal.js` are untouched. Data-only. (Because selection mode lives inside `index.html`, any future mechanics-based filter will automatically apply there — no extra wiring will be needed when that day comes.)

---

## Workflow for future games

After adding a new game to `games.json` (with its `bggId`):

```bash
python3 scripts/sync-bgg-taxonomy.py
```

Only games missing the fields are fetched — a single new game is one request, ~2 seconds. If a daily/scheduled sync exists or is added later, append this same command as its final step; the no-op case ("0 to fetch") is silent-safe.

---

## Verification checklist

- [ ] `python3 scripts/sync-bgg-taxonomy.py --dry-run` completes 10/10 batches, reports `updated 195 games`, prints a sample game's mechanics/categories, and does **not** modify `games.json`
- [ ] Full run writes `games.json`; `git diff` shows **only added `"mechanics"` and `"categories"` lines** — no reordering, no reformatting, no changes to existing values
- [ ] Every game object contains both new keys, positioned directly after `weightScore`
- [ ] Spot-check three known games against their BGG pages (e.g. Codenames `178900`, Ark Nova `342942`, Cascadia `295947` — confirm ids from the file, don't trust this doc)
- [ ] Warning list is empty, or each warned title has been manually checked on BGG
- [ ] Re-running the script immediately prints `0 to fetch · Nothing to do`
- [ ] Site still loads and filters correctly (new keys are inert to current JS)

## Commit message

```
data: add BGG mechanics and categories to every game

New scripts/sync-bgg-taxonomy.py fetches boardgamemechanic and
boardgamecategory taxonomy from the BGG XML API2 (batched, throttled,
202/429-safe) and writes them into games.json after weightScore.
Idempotent: re-run after adding games to fetch only what's missing.
Data-only change; no UI wiring in this commit.
```

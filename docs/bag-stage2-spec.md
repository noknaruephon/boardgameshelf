# Spec: Bag — Stage 2 (bag pages, Supabase storage, share sheet with QR)

**Scope:** a bag becomes its own page at `/bag/{id}`, stored in Supabase so anyone with the link can open it. The shelf lists bags and gets a Share action. One share-sheet component (URL + QR + native share) serves both the shelf and bag pages.

**Supersedes** from Stage 1: the "active bag" mode, `shelf-scope.js`'s active-bag filtering, and the count-line indicator (`docs/bag-indicator-spec.md`). Packing mode and the coverage bar stay.

**Not in this stage:** game night scoped to a bag (Stage 3), viewers proposing games (Stage 4 — see §9 for the schema hook), OG image for bags, Google sign-in.

**Mockup:** `docs/mockups/bag-page-mockup.html` — three screens: Shelf · Bags row, Bag page, Share sheet. Visual source of truth.

---

## 1. Model

```
/                 full shelf (unchanged), + Bags row, + Share
/bag/{id}         one bag: shelf UI scoped to bag.game_ids, own header, Share, Edit (owner only)
```

- Nothing is "active." Shelf and bag are independent pages; both can be open at once, by anyone.
- **Ownership without auth:** creating a bag returns an `edit_token` the creating browser keeps in localStorage. Read is public; update/delete require the token. When sign-in lands, bags move to the owner's account.
- **IDs**: 8-char random (`[a-z0-9]`), generated in the DB. Names are display only.

## 2. Supabase

```sql
create extension if not exists pgcrypto;

create table public.bags (
  id           text primary key default lower(substr(encode(gen_random_bytes(6), 'base32'), 1, 8)),
  owner        text not null default 'noknaruephon',
  name         text not null default 'Bag',
  game_ids     text[] not null default '{}',
  token_hash   text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.bags enable row level security;
-- No policies: the anon role cannot touch the table directly. All access goes through the RPCs below.
revoke all on public.bags from anon, authenticated;
-- Grants ship with the table (see docs/supabase-conventions.md). anon and authenticated get
-- none on purpose; only the service role reads or writes bags outside the RPCs.
grant select, insert, update, delete on public.bags to service_role;
```

RPCs — all `security definer`, `set search_path = public`, executable by `anon`:

| Function | Returns | Notes |
|---|---|---|
| `bag_create(p_name text, p_game_ids text[])` | `{ id, edit_token }` | generates a 32-byte hex token, stores `sha256(token)`, returns the plain token once |
| `bag_get(p_id text)` | `{ id, owner, name, game_ids, created_at, updated_at }` | never returns `token_hash`; `null` if missing |
| `bag_list(p_owner text)` | array of the same public shape | ordered by `updated_at desc` |
| `bag_update(p_id, p_token, p_name, p_game_ids)` | public shape | `raise exception 'forbidden'` if `sha256(p_token) <> token_hash`; bumps `updated_at` |
| `bag_delete(p_id, p_token)` | `boolean` | same check |

Follow the existing game-night RPC conventions in `supabase/` for file layout and grants. Add the migration as a new numbered file; don't edit earlier migrations.

## 3. Client storage — `bag-store.js` (replace Stage 1's localStorage implementation)

```js
export const bagStore = {
  list()                    → Promise<Bag[]>          // bag_list(OWNER)
  get(id)                   → Promise<Bag|null>       // bag_get
  create({ name, game_ids }) → Promise<Bag>           // bag_create; stores token under bgs.bagTokens[id]
  update(id, { name, game_ids }) → Promise<Bag>       // bag_update with stored token; throws if none
  remove(id)                → Promise<void>
  canEdit(id)               → boolean                 // token present locally
};
```

Tokens live in `localStorage['bgs.bagTokens']` as `{ [id]: token }`. Nothing else about bags is stored locally.

**One-time migration:** on first load with the flag on, if `bgs.bags.v1` (Stage 1) exists, create each bag via `bagStore.create`, then delete the old key. Silent; log to console.

## 4. Routing

`/bag/{id}` must load without a build step. Add to `vercel.json`:

```json
{ "rewrites": [{ "source": "/bag/:id", "destination": "/bag.html" }] }
```

`bag.html` reuses the shelf's scripts and styles and reads the id from `location.pathname`. If the codebase makes it cleaner to route inside `index.html` instead, do that — the URL shape is what's fixed. Preserve the existing OG rewrite/route from the OG image feature.

Unknown id → a plain "This bag doesn't exist" page in the same layout, with a link to `/`.

## 5. Shelf changes (behind `?bag=1`)

### 5.1 Bags row
Between the tagline and the search row (mockup: Shelf screen).

- Label: `BAGS` — mono 11px, `.12em` tracking, uppercase, ivory-45.
- Horizontally scrolling row of pills, 30px tall, `padding: 0 12px`, 1px ivory-12 inset ring, gold ring on hover/focus. Content: gold diamond (7×7, rotated square) + name + count in mono 12px ivory-45. Each pill is an `<a href="/bag/{id}">`.
- Last item: `+ Pack a bag` pill, gold text. Opens packing mode.
- Row hidden entirely when there are no bags (the `+ Pack a bag` button then lives in the header actions as in Stage 1).
- Scrollbar hidden; scroll-snap not required.

### 5.2 Share
Eyebrow line becomes `nok.naruephon · SETTINGS · SHARE`; SHARE is gold like SETTINGS and opens the share sheet for `/`.

### 5.3 Packing flow
Unchanged UI. **"Pack N games"** now:
1. `bagStore.create({ name, game_ids })`
2. `location.href = /bag/{id}`

Editing (from a bag page's Edit): `/?bag=1&edit={id}` opens packing mode with that bag's games pre-selected and its name in the input. Save → `bagStore.update` → back to `/bag/{id}`. Cancel → back to `/bag/{id}`.

### 5.4 Remove
The active-bag filter in `shelf-scope.js` (delete the file if nothing else uses it), the count-line indicator, and the `+ Add more` tile.

## 6. Bag page — `/bag/{id}`

Same page skeleton as the shelf: eyebrow → H1 → (tagline slot) → search row → count line → grid → Game Night pill. Differences (mockup: Bag page screen):

| Slot | Content |
|---|---|
| eyebrow | `◆ BAG · from nok.naruephon` — mono uppercase as on the shelf; `from nok.naruephon` is an `<a href="/">` in ivory-45, no underline, ivory on hover. This is the only link back. |
| H1 | bag name (Fraunces, same size as "BoardgameShelf") |
| tagline slot | coverage row: the eight 18×18 player cells (gold-filled when covered — same rule as the packing bar) + `5 games · 40–180 min` in mono 12px ivory-70 |
| actions | `Share` — 36px pill, gold text + gold ring, upload icon. `Edit` — quiet text pill, **rendered only when `bagStore.canEdit(id)`**. Nothing else. |
| search | placeholder `Search this bag…`; search, filters and sort operate on the bag's games only |
| count line | `{n} games in this bag` |
| grid | identical card component to the shelf; game modal and teach work as on the shelf |
| Game Night | same floating pill. **For this stage: hidden on bag pages** (it would start a lobby over the full shelf — misleading). Stage 3 restores it scoped to the bag. |

`<title>`: `{bag name} · BoardgameShelf`. Reuse the shelf's OG tags but with the bag name in `og:title`; `og:image` stays the shelf image until the bag OG route exists.

Games in `game_ids` that are missing from `games.json` are ignored at render; `n` counts only rendered games.

## 7. Share sheet — `share-sheet.js` (new, shared)

Bottom sheet (`role="dialog" aria-modal="true"`), opened by the shelf's SHARE and the bag's Share.

| Element | Spec |
|---|---|
| grab handle | 36×4, ivory-12, centred |
| title | "Share this bag" / "Share this shelf" — Fraunces 20px 500 |
| subtitle | bag: "Anyone with the link can browse it"; shelf: "{total} games · read-only" — mono 12px ivory-45 |
| QR | 188×188 ivory plate, 14px radius, 12px padding; QR drawn at 164px, dark = `--bgs-bg`, light = `--bgs-ivory`, error correction M |
| URL row | 44px, mono 13px, ellipsised, with a **Copy** button (plate-2 background) that reads "Copied" for 1.2 s |
| buttons | **Share…** (filled gold, calls `navigator.share({ url, title })`; hidden if unsupported) and **Done** |
| motion | slide up 200ms, scrim fade; none under `prefers-reduced-motion` |
| dismissal | Done, scrim tap, Escape; focus returns to the opener; focus is trapped while open |

**QR library:** vendor a small MIT-licensed encoder (e.g. `qrcode-generator`) into `/vendor/` — no CDN, no external QR image service. The full `https://` URL is encoded.

## 8. Feature flag

- `?bag=1` gates: Bags row, `+ Pack a bag`, the shelf SHARE item, the migration.
- `/bag/{id}` pages are **not** gated — a shared link has to work for someone who's never seen the flag. The Share sheet on a bag page is likewise ungated.

## 9. Schema hook for Stage 4 (proposals) — do not build, do not block

Viewers will propose games to a bag. That will be a separate table `bag_proposals (bag_id, game_id, note, created_at)` with its own RPCs, never a write to `bags.game_ids`. Nothing in this stage should assume `game_ids` is the only game list attached to a bag (e.g. don't name a function `getBagGames` that only reads `game_ids` without a comment).

## 10. Verification

- [ ] Migration applied; `select * from bags` as anon → permission denied; `bag_get('nope')` → null.
- [ ] Flag off on `/`: no Bags row, no SHARE, no `+ Pack a bag`. `/bag/{id}` still loads.
- [ ] Flag on: Pack 3 games → lands on `/bag/{id}`; bag shows those 3; coverage cells and meta match; Edit visible.
- [ ] Open the same `/bag/{id}` in a private window: renders, **no Edit**, Share works.
- [ ] Shelf in one tab, bag in another: browsing either doesn't change the other.
- [ ] Edit → deselect one → save → back on `/bag/{id}` with 2 games; `updated_at` bumped; same id.
- [ ] Wrong token (edit `bgs.bagTokens` in devtools) → update fails with a visible, non-crashing message.
- [ ] Bags row lists the bag with its count; tapping opens it; `+ Pack a bag` opens packing.
- [ ] Share sheet: QR scans to the exact URL on a phone camera; Copy copies `https://…`; Share… opens the iOS sheet; Escape and scrim close it; focus returns.
- [ ] `/bag/zzzzzzzz` → "This bag doesn't exist" with a link home.
- [ ] Game Night pill absent on bag pages, present on the shelf.
- [ ] Stage 1 localStorage bags migrate once and the old key is gone.
- [ ] Safari iOS: sheet respects safe area; `from nok.naruephon` tappable at ≥ 32px height.
- [ ] `games.json` and the OG route untouched.

## 11. Commit

```
feat(bag): bags as shareable pages with Supabase storage and QR share sheet

Bags now live in Supabase and render at /bag/{id}. Anyone with the
link can browse; the packing device keeps an edit token. Adds a Bags
row and Share to the shelf, and a shared share-sheet component with
a vendored QR encoder. Removes the Stage 1 active-bag mode.
```

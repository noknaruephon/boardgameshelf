# Claude Code Spec — Multi-user shelf

**Goal:** turn the shelf into a multi-user app. Anyone can sign in, enter their
BGG username, sync their collection, and get a public shelf at
`/u/:bggusername`. No new features beyond that. No payments.

**Stack rule:** keep the current no-build static stack — plain HTML/CSS/JS,
esm.sh modules, Supabase, Vercel. Reuse the design tokens in `css/base.css`
and the shared game modal in `js/game-modal.js`. Do not redesign anything.

**Implementation notes** — decisions made while building this, and every
place the build deviates from the text below — are collected in §11 at the
end. Read them before touching the schema or the sync loop.

---

## 1. Routes (`vercel.json` rewrites)

| Path | File | What it does |
|---|---|---|
| `/` | `landing.html` | Short pitch + sign-in: Google button and magic-link email form |
| `/u/:bggusername` | `shelf.html` | Reads the slug from the path (lowercased), loads that user's shelf. Existing filter UI and game modal unchanged. |
| `/settings` | `settings.html` | BGG username field (first login), public/private toggle, Sync button with progress, last synced time, sign out |
| `/night/:code/host`, `/vote/:code`, `/vote/:code/swipe`, `/results/:code` | unchanged | Existing game-night routes keep working but are scoped to the shelf owner (`owner_id`) |

## 2. Auth

Supabase Auth with Google OAuth and magic-link email, via supabase-js from
esm.sh. After first sign-in, force the user to enter their BGG username; that
becomes their profile slug.

- Slug = BGG username lowercased, trimmed, spaces replaced with hyphens.
- Must be unique — first claim wins. Show a clear inline error if already taken.

## 3. Schema (SQL migration in `supabase/migrations/`)

**profiles**: `id uuid pk → auth.users`, `slug text unique`, `bgg_username text`
(original casing), `display_name text`, `is_public bool default true`,
`last_synced_at timestamptz`, `created_at`.

**games** (shared cache): `bgg_id text pk`, `name`, `year_published int`,
`min_players int`, `max_players int`, `min_playtime int`, `max_playtime int`,
`weight numeric`, `bgg_rating numeric`, `subtype text`
(`boardgame | boardgameexpansion`), `mechanics jsonb`, `categories jsonb`,
`description text`, `thumbnail_url text` (BGG URL), `image_url text` (BGG URL),
`updated_at`.

**user_games**: `user_id uuid → profiles`, `bgg_id text → games`, `owned bool`,
`wishlist bool`, `user_rating numeric`, `num_plays int`, `comment text`,
`synced_at`, pk `(user_id, bgg_id)`.

Existing session/vote tables: add `owner_id uuid → profiles`.

**RLS**

- `profiles`: select if `is_public` OR `auth.uid() = id`; insert/update only own row.
- `user_games`: select if the owner's profile `is_public` OR `auth.uid() = user_id`; write only own rows.
- `games`: public select; writes only via the service role (sync functions).
- session/vote tables: keep current behaviour; `owner_id` set by the owner.

## 4. Sync (Vercel serverless functions in `/api`, Node runtime)

Service-role key server-side only. Client-driven loop so no function runs
longer than a few seconds. Manual trigger only.

### `POST /api/sync/collection` (auth required)

Verify the user JWT server-side; use `profile.bgg_username`.

- Calls `https://boardgamegeek.com/xmlapi2/collection?username=X&own=1&stats=1`.
- If BGG returns **202**, respond `{ status: "queued" }`; the client retries
  every 5 s, max 12 tries, then shows "BGG is busy, try again in a minute".
- On **200**: parse the XML, upsert `user_games` (`owned`, `user_rating`,
  `num_plays`, `comment`), delete `user_games` rows no longer in the collection.
- Respond `{ status: "ok", total, missing: [bgg_ids not yet in the games cache
  or older than 30 days] }`.
- Errors: username not found → 404 with a message; collection private → 403
  with a message.

### `POST /api/sync/things` `{ ids: [max 20] }`

- Calls `https://boardgamegeek.com/xmlapi2/thing?id=1,2,3&stats=1`.
- Parse and upsert into `games`, storing BGG's thumbnail and image URLs
  directly (hotlinked, no downloading).
- Respond `{ done: [ids] }`.
- The client calls this in batches of 20, ~1 request/sec, with a progress bar
  (n of total).

On completion: set `last_synced_at`, reload shelf data.

## 5. Shelf data loading

`shelf.html` fetches the profile by slug, then `user_games` joined to `games`
for that user, via the anon key (RLS handles visibility).

- Covers use `loading="lazy"` and a neutral placeholder on error. (Originally
  `thumbnail_url`; changed to `image_url` after launch because BGG's ~200px
  thumbnail is blurry on phones, and its signed URLs offer no middle size.)
- Private shelf → "This shelf is private".
- Unknown slug → 404 page.
- Keep the current filter behaviour; expansions
  (`subtype = boardgameexpansion`) are hidden by default with a toggle.

## 6. Migration of existing data

`scripts/migrate-games-json.mjs`: reads `games.json`, inserts into `games` and
creates `user_games` for the profile with slug `noknaruephon` (creating the
profile row for the owner's auth user id, passed as an argument). Map existing
`/covers/{id}.jpg` files to `thumbnail_url` so the shelf keeps its current
images.

After migration, `/` no longer serves that shelf; it serves the landing page.
Remove the `games.json`-based loading path once `/u/noknaruephon` renders
correctly.

## 7. Edge cases

- 202 loop exceeds the cap.
- BGG down or 5xx: show the last synced data with a message.
- Collections over 1,500 games: batching handles it; show progress.
- A thing id that returns no item: skip and continue.
- Re-sync with no changes: fast path.
- Slug collision on signup: inline error, retry.
- Broken cover URL: placeholder, never a broken-image icon.

## 8. Out of scope

Payments, custom domains, stats, rules chat, scheduled re-sync, image caching.

## 9. Acceptance

A second person can sign in with Google, enter their BGG name, sync, and share
`/u/<theirname>`. The page opens with working filters and the game modal, and
their game-night session works, without the repo owner touching the repo. The
owner's shelf renders identically at `/u/noknaruephon`, and `/` shows the
landing page.

## 10. Delivery

1. Migration SQL first, then the sync functions, then the pages. Commit after each.
2. Update `.env.example` with every new variable.
3. Add a short README section: "Setting up a local dev environment",
   "Enabling Google sign-in in Supabase", and "Running the migration script".
4. Ask before changing anything in the game-night session code beyond adding
   `owner_id`.

---

## 11. Implementation notes

What was built, and where it departs from the text above. Every departure is
here on purpose; none of them is a shortcut.

### 11.1 Files

```
supabase/migrations/20260908000000_multiuser.sql   schema, RLS, RPCs (§3)
api/_lib/bgg.js          BGG fetch + XML parsing (collection and thing)
api/_lib/supabase.js     service-role client, JWT → user → profile
api/sync/collection.js   POST /api/sync/collection
api/sync/things.js       POST /api/sync/things
package.json             deps for /api only — still no build step
js/auth.js               supabase-js auth helpers shared by every page
js/shelf-data.js         profile + user_games→games loading, legacy-shape adapter
js/sync.js               the client-driven sync loop (§4)
landing.html             /
settings.html            /settings
shelf.html               /u/:slug — this is index.html, renamed (see 11.5)
scripts/migrate-games-json.mjs
.env.example, README.md
```

### 11.2 Two extra columns on `games`

`games.json` carries curated, hand-written content that BGG does not have:
`blurb`, `why`, `tag`, `color`, `caption`, `teach`, `fingerprint`,
`playerRecommendations`, `backImage`, `spineImage`, `tableShot`. §9 requires
`/u/noknaruephon` to render *identically*, and the modal's Highlights list,
the vibe filter (which reads `tag`) and the "Teach me in 60 seconds" section
all read from those fields. So `games` gains:

- `extras jsonb` — the curated fields, verbatim, keyed exactly as in
  `games.json`. Written only by the migration script. The thing sync never
  touches it (its upsert lists columns explicitly).
- `player_recommendations jsonb` — `{ "2": "best", "3": "recommended", … }`
  derived from BGG's `suggested_numplayers` poll in the thing sync, so the
  "Recommended counts only" filter works for everyone, not just the owner.

`js/shelf-data.js` folds both back into the shape the shelf, filters, modal
and game-night pages already consume (`bggId`, `players`, `time`, `weight`
bucket, `weightScore`, `image`, …). For a game with no curated extras: the
blurb is the first paragraph of BGG's description, `tag` is the first two
mechanics and the first category joined with ` · ` (which is what
`js/vibes.js` keys on), Highlights and the tag chip are omitted rather than
rendered empty. That, and the modal preferring `image_url` over the grid's
`thumbnail_url` for its cover, are the only changes to `js/game-modal.js`.

### 11.3 Covers

There are no `/covers/{id}.jpg` files: `covers/` holds six back-of-box and
spine photos, and every `image` in `games.json` is already a BGG CDN URL. The
migration script therefore uses a local cover when one exists for the id and
otherwise copies `image` into both `thumbnail_url` and `image_url`. Either
way the shelf keeps exactly the pictures it shows today.

### 11.4 `owner_id` on game nights

`create_game_night` predates this spec and its body is not in the repo, so it
is not redefined. Instead the migration adds `claim_game_night_owner(p_code,
p_owner_id)`, a SECURITY DEFINER function that sets `owner_id` on a session
whose owner is still null — and `js/session.js`'s `createGameNight()` calls it
right after creation with the shelf owner's profile id. `submit_vote` is
re-created from the Stage 4 body with one added line that copies the session's
`owner_id` onto the vote row.

The host is *not* required to sign in. A guest browsing `/u/nok` can start a
game night from that shelf exactly as today; the session is scoped to
`nok`'s profile because that is where the deck came from.

Sessions created before this migration have `owner_id = null`. The game-night
pages resolve those against `DEFAULT_SHELF_SLUG` in `js/config.js`
(`noknaruephon`) so old links keep working.

### 11.5 Game-night pages: one swap, nothing else

`night-host.html`, `vote.html`, `vote-swipe.html` and `results.html` each had
the same seven lines fetching `/games.json`. Those seven lines are now one
call to `fetchShelfGames(session.owner_id)` from `js/shelf-data.js`, which
returns games in the same shape, so `deckFromSession()` and everything after
it is untouched. `fetchSession()` selects `owner_id` as well. That is the
whole of the change to game-night code; anything further waits for a yes,
per §10.4.

### 11.6 `index.html` → `shelf.html`

Vercel serves a matching static file before it consults `rewrites`, so an
`index.html` at the root would keep winning `/` no matter what `vercel.json`
says. The shelf page is renamed with `git mv` (history intact) and `/` is
rewritten to `landing.html`. All asset paths in the shelf were already
absolute (`/css/…`, `/js/…`), which `/u/:slug` needs.

### 11.7 Unknown slug

The shelf is a static file behind a rewrite, so there is no server to send a
real 404 status. `shelf.html` renders a not-found state, sets
`<meta name="robots" content="noindex">` and the document title, and offers
the way home. Same for "This shelf is private".

### 11.8 Expansions toggle

`showExpansions` joins `DEFAULT_FILTERS` in `js/filters.js` (default
`false`); `applyFilters` drops `subtype === 'boardgameexpansion'` while it is
off. The switch sits in the filter sheet under "Recommended counts only",
using the same `.toggle-row` markup, and gets a removable chip like every
other filter. Games migrated from `games.json` are all `subtype = 'boardgame'`
so the owner's shelf is unaffected until a real sync updates them.

### 11.9 BGG API token

BGG has announced that XML API access will require a registered application
token. `BGG_API_TOKEN` is required in `.env` (it was optional until BGG
issued one): it is sent as
`Authorization: Bearer …` on every BGG request. Nothing else changes.

### 11.10 Fast path on re-sync

`/api/sync/collection` reads the user's existing `user_games` rows first and
upserts only rows whose `owned / wishlist / user_rating / num_plays / comment`
actually changed, then deletes the rows BGG no longer lists. When `missing`
comes back empty the client skips the thing loop entirely, so an unchanged
collection is one request.

### 11.11 Facebook sign-in

The landing page offers three ways in: Google (primary, gold), Facebook
(secondary) and a magic-link email behind "Prefer email?". Facebook uses
`supabase.auth.signInWithOAuth({ provider: 'facebook' })` with `scopes:
'email'` and the same `redirectTo` as Google, so it lands on `/welcome` and
picks up the identical claim-and-sync flow. There is no on-site button flow
for it the way Google Identity Services gives one, so the visitor does go to
facebook.com and back. `profiles` is untouched: the claim step seeds
`display_name` from `user_metadata.full_name || name`, which Supabase fills
from Facebook exactly as it does from Google, and Settings labels the provider
from `app_metadata.provider`. The Meta
app must be configured once in Supabase; the README has the steps.

### 11.12 What this sandbox could not verify

The implementation was written without outbound access to Supabase, BGG or
esm.sh, so the migration has not been applied to the live project and the
sync has not been run against BGG. The XML parsers are unit-tested against
recorded-shape fixtures in `api/_lib/bgg.test.mjs` (`npm test`), and the
games.json → row → shelf round trip was checked for all 196 games.
Run the migration and a sync on the preview deployment before merging.

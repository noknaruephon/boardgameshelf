# Claude Code Spec — "Browse an existing shelf" fallback

**Why:** BGG API access is pending approval, and sync can also fail (202 cap,
5xx, unknown username). A signed-in user should never hit a dead end: let
them open a shelf that already has a collection, as a guest.

**Delivered as two commits, in order:**

1. `Add public_shelves RPC`
2. `Offer existing shelves when sync is unavailable`

---

## Commit 1 — RPC `public_shelves()`

`supabase/migrations/20260909000000_public_shelves.sql`. SECURITY DEFINER,
stable, returns up to 24 rows ordered by game count desc:

`slug, display_name, bgg_username, game_count` (owned = true, subtype =
boardgame), `last_synced_at`, `thumbnails text[]` (first 4 `thumbnail_url`
by name).

Only profiles with `is_public = true` and `game_count > 0`. Execute granted
to anon and authenticated. Never returns ids or emails.

## Commit 2 — UI

### Shared component: `js/shelf-picker.js`

Exports `mountShelfPicker(container, { title, lede, note })`. Renders a
`.plate`-styled section with:

- `h2` = title (default "Browse a shelf that's already stocked")
- lede (default "Have a look around while your own sync isn't available.
  You're viewing as a guest.")
- list of shelves from `public_shelves()`: each row is a link to
  `/u/<slug>` with a 4-cover stack (38px squares; empty squares when a
  shelf has fewer than four thumbnails), `display_name` or `bgg_username`,
  and "196 games · synced 3 days ago" in mono. The entire row is the link;
  focus ring via box-shadow.
- Empty result → "No public shelves yet."

### Where it appears

1. `welcome.html`
   - `missing` state: below the error help, a quiet button "Browse an
     existing shelf instead" that mounts the picker under the plate.
   - `syncing` error state (`onError`): after "Try again", the same quiet
     button.
   - When the lookup endpoint itself returns 5xx or 503 (BGG token not yet
     valid): err "BGG isn't reachable right now. Your username is saved —
     you can sync later from Settings." and the picker mounts immediately.
     Continue still saves the profile so the user isn't stuck.
2. `settings.html`, "Sync from BGG" section
   - If the last sync failed or `last_synced_at` is null: quiet button
     "Browse an existing shelf" under the message, which mounts the picker
     in place.
   - Not shown when the user's own shelf has games.

### Copy

- Button: "Browse an existing shelf" (welcome: "…instead")
- Row meta: "<n> games · synced <relative time>"; if never: "<n> games"
- Above the list on welcome only, one mono line: "Your own shelf will be
  here once BGG lets us sync."

### Behaviour

- Opening another shelf as a guest is read-only: no owner controls, no
  sync button. See the note on game nights below.
- Picker fetch failures fail quietly: hide the button, log to console.
- Picker rows link with a normal `<a>`, no JS routing.

## Verify

- Signed in with no synced games → welcome shows the button in missing and
  error states; clicking lists noknaruephon with 4 covers and count.
- Settings with no sync yet → button present; after a successful sync →
  absent.
- Guest view of `/u/noknaruephon` shows no owner controls.
- RPC as anon returns only public shelves, no ids.
- Keyboard: rows are focusable links with the gold ring.

---

## Implementation notes

- **Game nights on a guest view are not hidden.** The spec expected
  session creation to be owner-only and asked for that to be verified. It
  is not: any visitor to `/u/<slug>` can start a game night from that
  shelf, and that is by design from the multi-user build (§11.4 of
  `docs/claude-code-multiuser.md`): the host at the table is usually a
  guest on their phone, not the shelf's owner. What a guest cannot do is
  change the shelf (no Settings link, no sync). Restricting game nights to
  owners would change the game-night product, so it was left alone and is
  flagged here for a decision.
- **"Own shelf has games"** in Settings is checked with a head-only count
  of the user's owned `user_games` rows, refreshed after every sync
  attempt. The button appears only when that count is zero and either the
  profile has never synced or the sync just failed.
- **5xx vs other lookup failures.** Only a 5xx/503 from `/api/bgg/lookup`
  takes the "username is saved" path (Continue enabled, picker mounted).
  Other failures, such as the server being unable to verify the session,
  keep the earlier "Claim anyway" button and add the browse button beside
  it, since the cause is not BGG.
- **Picker styles** ship inside `js/shelf-picker.js` and are injected once,
  so the two pages that mount it need no extra stylesheet.
- The RPC caps at 24 rows and orders by count then slug, so the listing is
  stable between calls.

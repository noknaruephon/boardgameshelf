# Claude Code Spec — Onboarding: "Three steps"

**Design source:** `docs/claim-sync-mockup.html`, option B ("Three steps").
**Goal:** new users go sign in → `/welcome` (enter BGG name, verified live)
→ sync with visible progress → open shelf. Settings keeps its existing
sections for returning users; the "claim" block in `settings.html` goes
away.

**Delivered as three commits, in order:**

1. `Add BGG username lookup endpoint`
2. `Extract sync loop into js/sync.js`
3. `Add /welcome onboarding: BGG name → sync, with progress`

---

## Routing

- `vercel.json`: `/welcome` → `welcome.html`.
- After sign-in (landing.html auth callback) and on any load of `/settings`
  or `/u/*`: if the user is signed in and has no profile slug → redirect to
  `/welcome`. If a slug exists and they open `/welcome` → redirect to
  `/settings`.

## Commit 1 — `GET /api/bgg/lookup?name=<username>`

Auth required (verify the Supabase JWT). Server-side only, sends
`Authorization: Bearer BGG_API_TOKEN`.

1. Call `https://boardgamegeek.com/xmlapi2/user?name=<name>`. No `id`
   attribute, or a 404 → `{ found:false }`.
2. If found, also call `collection?username=<name>&own=1&brief=1&subtype=boardgame`.
   This deliberately warms BGG's queue so the later sync is faster.
   - 200 → `count` = number of `<item>` elements →
     `{ found:true, username:<canonical name from the user response>, count }`
   - 202 → `{ found:true, username, count:null }`
3. Cache results in memory per instance for 10 minutes keyed by lowercased
   name. Rate-limit per user to 1 lookup/second (429 with `{ retryAfter:1 }`).
4. Never return raw BGG XML or any field beyond `found` / `username` / `count`.

## Commit 2 — `js/sync.js`

Move the sync loop (collection call, 202 retry every 5 s up to 12 tries,
then `/api/sync/things` in batches of 20 at ~1/s) into an ES module
exporting:

```
runSync({ onStep(text), onProgress(done, total), onBatch(games[]), onDone(summary), onError(message) })
```

`onBatch` receives the games just upserted (`bgg_id`, `name`,
`thumbnail_url`) so the UI can show covers arriving. Settings keeps working
with the same UI by calling `runSync` with its existing handlers. No
behaviour change in this commit.

## Commit 3 — `welcome.html`

Single column, max-width 560px, tokens from `base.css`, wordmark as on the
landing page (italic Fraunces, not the caps eyebrow).

### Steps strip (`aria-label="Progress"`)

Three segments: "Sign in" (done), "Your BGG name" (now), "Sync". Each is a
3px bar plus label. done = gold at .45, now = gold, upcoming = ivory at .12.
Classes update as the flow advances. `role="list"` with visually hidden
"Step 2 of 3: current" text for screen readers.

### State machine: empty → checking → found | missing → syncing → done

Headline and lede change per state. One `.plate` holds the active content.

**empty**
- h1 "Connect your collection"
- lede "We only need the username. Your owned games come straight from BGG, nothing to upload."
- label "BoardGameGeek username"; input `#bgg`, placeholder "noknaruephon",
  `autocapitalize=none`, `autocorrect=off`, `spellcheck=false`
- help "Same as your login on boardgamegeek.com. Not your email."
- button `#continue` "Continue", disabled

**checking** (600 ms after the last keystroke, min 3 chars; in-flight
lookup cancelled on new input)
- help with spinner "Checking BGG…"

**found**
- input border → `var(--bgs-vote-play)`
- help (ok) "Found — 196 games owned. Shelf address: /u/noknaruephon"
  (count omitted when null: "Found. Shelf address: …")
- button "Continue to sync", enabled

**missing**
- input border → `var(--bgs-vote-pass)`
- help (err) "We couldn't find that account. Usernames are case-insensitive, so it's usually a typo."
- button "Continue", disabled

On Continue: insert the profile row (slug = canonical username lowercased
with spaces → hyphens; `bgg_username` = canonical casing). Slug already
taken by another account → err "That shelf is already claimed. If it's
yours, sign in with the account you used before." Then advance to syncing.

**syncing**
- strip: step 2 done, step 3 now
- h1 "Pulling in your games"
- lede "This runs once now and whenever you tap Sync in settings."
- `.fill` grid: 6 columns of square cover slots (12 visible), empty slots
  ivory at .06; filled left-to-right from `onBatch` thumbnails (hotlinked
  `thumbnail_url`, `loading=lazy`, `alt=""`)
- progress bar (6px, gold) + "122 of 196 games" left, time estimate right
  ("about 30s left" = remaining batches × 1.1 s, rounded to 10 s; hidden
  until the first batch)
- while waiting on 202: text "BGG is preparing your collection…" and the
  bar shows an indeterminate 30%-width pulse; no pulse under
  `prefers-reduced-motion`
- help "Covers and details are cached, so the next sync is quick."
- error → err message from `onError` plus a "Try again" button that
  restarts `runSync`

**done**
- strip: all three done
- h1 "You're on the shelf"
- lede "Send the link to your group. They can browse and vote without signing in."
- full cover grid, then "196 games synced" (ok) left and `/u/noknaruephon`
  (mono) right
- buttons: gold "Open your shelf" (href `/u/<slug>`), quiet "Copy link"
  (writes `https://<host>/u/<slug>`, then reads "Copied" for 2 s)

### Settings changes

Remove `#claim`, `#claimForm` and related JS from `settings.html`; the
no-slug case redirects to `/welcome` instead. The "Sync from BGG" section
stays and imports `js/sync.js`.

## Accessibility

- The help line is `aria-live="polite"`; state changes announce once.
- The cover grid is `aria-hidden`; the progress text is the accessible
  progress (`role="status"`).
- Focus rings via box-shadow (`0 0 0 2px var(--bgs-bg), 0 0 0 4px var(--bgs-gold)`), never outline.
- The spinner is `aria-hidden` and stops under `prefers-reduced-motion`.
- Never put animation and transition on the same property of the same element.

## Verify

- Typing a real BGG name shows Found within ~1 s; a fake name shows the
  error; typing again clears the state.
- Continue creates the profile once; refreshing mid-sync resumes at
  syncing (profile exists, `last_synced_at` null).
- Covers appear as batches land; count and estimate update; the 202 wait
  shows the preparing message.
- Done buttons work; Copy link copies the correct URL on iOS Safari.
- Settings still syncs via the shared module; the old claim block is gone.
- Lighthouse accessibility ≥ current.

---

## Implementation notes

- **`js/sync.js` already existed** from the multi-user build, so commit 2
  reshaped its API rather than extracting from `settings.html`. `runSync`
  now takes the five handlers, never throws (errors go to `onError` with
  the same copy Settings showed before), and `onStep` passes a second
  argument `{ waiting }` so a page can switch its bar to indeterminate
  without parsing the text. `/api/sync/things` gained a `games` array
  (`bgg_id`, `name`, `thumbnail_url`) for `onBatch`; these are rows the
  caller's own sync just wrote, not a pass-through.
- **Lookup auth.** The endpoint runs before the profile row exists, so
  `api/_lib/supabase.js` gained `requireProfileOrUser()`; `requireProfile()`
  now wraps it. The handler wrapper in `api/_lib/http.js` takes a
  `methods` option so the route can be GET.
- **Lookup edge cases.** A BGG 404 on the user endpoint is `found:false`. A
  202 on the brief collection call is cached for only 15 s rather than 10
  minutes, so the next keystroke can pick up the count once BGG has it.
  BGG answers 200 with an empty `id` for unknown names; that is the main
  "not found" path.
- **Redirect on `/u/*`** checks the visitor's own profile alongside the
  shelf load rather than before it, so a shelf never waits on the check.
  Only a signed-in user with no profile row is redirected.
- **Indeterminate bar.** The pulse animates a `::after` pseudo-element on
  `.prog`; the `<i>` that carries the width transition never animates.
- **Display name** for the new profile is the sign-in provider's name
  (`userDisplayName(user)`), falling back to the BGG username. It can be
  changed later in Settings.
- **The 429 path** in the page waits `retryAfter` seconds and asks once
  more, so fast typing never leaves the field stuck on "Checking".
- The `/u/<slug>` shown in "found" is derived client-side with the same
  rule as `slugify()`; the row that is inserted uses `claimProfile()`,
  which applies that rule to the canonical username from BGG.

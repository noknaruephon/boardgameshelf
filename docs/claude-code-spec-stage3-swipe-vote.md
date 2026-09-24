# Claude Code Spec — Game Night, Stage 3: Swipe to Vote

**Builds on Stage 2**, which is merged and live: `night-host.html`, `vote.html`,
`js/presence.js`, `js/waiting-room.js`, `js/session.js`, `css/base.css`, and the shared
detail modal all exist and work.

**Scope:** the swipe screen at `/vote/{code}/swipe`. Both existing pages already
navigate there the instant voting starts, and it currently 404s. This spec fills that in:
casting votes, storing them, tracking who's finished, and moving the table on when
everyone is.

**Out of scope:** the results screen. When the last vote lands, every device navigates to
`/results/{code}`, which will 404. Expected and correct — that's Stage 4.

**Run `supabase-stage3-addendum.sql` before starting.** It adds the `votes` table, the
`finished_at` column, and the three functions this spec depends on (§3).

---

## 0. Working rules

- **Branch, PR into `main`.** Never push to `main` directly.
- **Ship dark.** No new entry points. Nothing on the shelf changes.
- **Static site.** Vanilla JS, ES modules, CDN imports. No bundler, no `package.json`.
- **Additive.** `index.html`, `js/filters.js`, and `games.json` must not change.
- **Reuse before rebuilding.** Almost everything this screen needs already exists in
  Stage 2. Read those files first — see §2.
- Verification happens on the **Vercel preview deployment**. Swipe gestures and
  multi-device sync cannot be tested in the sandbox.

---

## 1. Decisions already made

Settled during design. Do not re-litigate these; if one seems wrong, raise it in the PR
rather than building something different.

| Question | Decision |
|---|---|
| Vote values | Binary — **play** or **pass**. No third option, no rating. |
| Deck order | **Same order for every player**, exactly as stored in `session.game_ids`. |
| Changing a vote | **No.** Votes lock on swipe. No undo, no back button, no recap. |
| After the last card | Straight to a waiting panel. **No per-player recap interstitial.** |
| When everyone's done | **Auto-advance.** The database flips status; every device follows. |
| Someone wanders off | **Host gets a "Show results now" override** (§8). No timeout, no auto-drop. |

---

## 2. What already exists — read these first

```
js/session.js        RPC wrappers + sessionErrorMessage()
js/presence.js       joinSessionChannel() — presence + status changes
js/waiting-room.js   deckHTML(), rosterHTML(), deckFromSession(), openGameModal()
js/game-modal.js     the shared detail modal (shelf + waiting room)
css/base.css         tokens and page chrome — link this first, always
vote.html            the .deck-card / .deck-card.back styles (§6)
```

`deckFromSession(session, games)` already turns `session.game_ids` into ordered game
objects. **Use it.** Do not re-implement deck building.

The participant's name is in `sessionStorage['gamenight:{code}:name']`, written by
Stage 2. If it's missing, the person deep-linked to the swipe URL without joining —
send them to `/vote/{code}` to join properly.

---

## 3. `supabase-stage3-addendum.sql`

Write this file at the repo root, alongside where Stage 2's addendum lives. It is run by
hand in the Supabase SQL editor before the code is deployed.

**Everything callable with the anon key.** No service role key reaches the browser, ever.

### Schema

```sql
-- one row per player per game
create table votes (
  session_code text not null references sessions(code) on delete cascade,
  participant_name text not null,
  game_id text not null,
  vote text not null check (vote in ('play','pass')),
  created_at timestamptz not null default now(),
  primary key (session_code, participant_name, game_id)
);

-- Every new public table ships with its grants (see docs/supabase-conventions.md).
-- Anon only selects; inserts go through submit_vote(), which is SECURITY DEFINER.
grant select                         on public.votes to anon;
grant select, insert, update, delete on public.votes to authenticated;
grant select, insert, update, delete on public.votes to service_role;

alter table participants add column finished_at timestamptz;
```

The composite primary key is what makes votes idempotent: a double-fire from a flaky
network writes the same row twice with no duplicate and no error. Use
`on conflict do nothing` — **first vote wins**, since votes lock on swipe.

### Functions

**`submit_vote(p_code, p_name, p_game_id, p_vote)`**
Inserts one vote. Rejects if the session isn't `voting`. `on conflict do nothing`.

**`finish_voting(p_code, p_name)`**
Sets `finished_at = now()` for that participant if not already set. Then, in the same
transaction, **if every participant now has `finished_at` set, update the session status
to `done`.** That status change is what moves the whole table — see §7.

**`force_results(p_code)`**
Host escape hatch. Sets the session status to `done` regardless of who's finished.
Raises `NOT_HOST` if the caller isn't the host. Votes already cast still count; missing
votes simply don't exist. Stage 4 must not assume every player voted on every game.

### RLS

Match the existing policies on `sessions` and `participants`. Reads and writes scoped to
a session by code; no cross-session access. Add `votes` to the realtime publication only
if §7 needs it — see the note there before deciding.

---

## 4. Additions to `js/session.js`

Thin wrappers, same style as the existing ones:

```js
export async function submitVote(code, name, gameId, vote) { /* rpc('submit_vote', ...) */ }
export async function finishVoting(code, name)             { /* rpc('finish_voting', ...) */ }
export async function forceResults(code)                   { /* rpc('force_results', ...) */ }
```

Add to `ERROR_COPY`:

| Raised | Show |
|---|---|
| `NOT_VOTING` | "Voting's already finished for this game night." |
| `NOT_HOST` | ignore silently — only the host sees the button that raises this |

---

## 5. New files

```
vote-swipe.html    the whole screen (§6, §7)
js/swipe.js        gesture handling, extracted (§6)
```

Plus a rewrite in `vercel.json`, added to the existing array:

```json
{ "source": "/vote/:code/swipe", "destination": "/vote-swipe.html" }
```

Read the code from `window.location.pathname` the same way `night-host.html` does.

---

## 6. The swipe screen

**`swipe-vote-mockup.html` accompanies this spec and is the approved design.** Match its
layout, proportions, copy, and motion. It uses real games from `games.json`; the shipped
version does the same via `deckFromSession()`.

### Tokens

Two new semantic colours go in `css/base.css` alongside the existing ones:

```css
--bgs-vote-play:#8FA75A; --bgs-vote-play-rgb:143,167,90;
--bgs-vote-pass:#C2604A; --bgs-vote-pass-rgb:194,96,74;
```

These are **not** `--bgs-danger`. That token stays reserved for cancelling a game night;
passing on a game isn't destructive and must not borrow the destructive colour.

Everything else uses existing tokens. Gold stays on the eyebrow and progress bar only —
it's the brand colour here, not a vote colour.

### Layout, top to bottom

- **Eyebrow:** `Game Night · {CODE}`, mono, gold-dim.
- **Heading:** "Swipe to vote" in Fraunces.
- **Progress:** a thin gold track plus `3 / 6` in mono. Counts cards seen, not votes cast.
- **Card stack:** the top three remaining cards, back two scaled down and offset so the
  deck reads as a deck. Cover art fills the card; a label band below carries the title
  (Fraunces), the `★ N.N` rating pill, and players · time · weight. **The rating pill is
  the shelf's exact treatment** — same border, radius, and colour.
- **Info button:** top-right of the front card. Opens the shared detail modal via
  `openGameModal()` from `js/waiting-room.js`. **Do not build a second modal.** It must
  not trigger a swipe — stop propagation on the pointer events.
- **Two buttons** below the stack: pass (left, clay, ✕) and play (right, sage, ✓). These
  are not a fallback — some people will use them exclusively.
- **Hint:** "Drag right to play, left to pass — votes lock the moment you swipe".

### The swipe itself

Pointer events, not touch events — one code path for finger and mouse.

- Card follows the pointer, rotating `dx / 18` degrees.
- **Black wash:** a `#000` overlay across the whole card, opacity scaling to `0.58` at
  full drag, **in both directions**. The overlay does not change colour.
- **Stamp:** large centred mono text — PLAY in sage, PASS in clay — inside a bordered
  box, fading in and scaling up with drag distance. The stamp colour carries the meaning;
  the wash only darkens.
  *This was chosen over a coloured wash deliberately: a sage tint disappears over a
  green-heavy cover, while darkening reads identically across all 195 games.*
- **Threshold: 100px.** Past it, the card flies off and the vote commits. Under it, the
  card springs back and nothing is recorded.
- Below the threshold nothing is written. **Releasing mid-drag is not a vote.**

### Committing a vote

On commit, in this order:

1. Animate the card out and advance the local index immediately. **Never block the
   gesture on the network** — the next card must be draggable instantly.
2. Call `submitVote()` in the background.
3. On failure, retry once, then queue it and retry when the next vote succeeds. Do not
   show an error toast mid-deck and do not roll the card back — a vote that fails twice
   is recoverable from the queue, and interrupting a swipe run to report it is worse
   than the missing row.

### Reload mid-deck

On load, fetch this participant's existing votes and resume at the first game they
haven't voted on. Refreshing must not restart the deck or double-vote. If every game
already has a vote, go straight to the waiting panel (§7).

---

## 7. Waiting panel — after the last card

Replaces the stack in place. No route change, no recap.

Call `finishVoting()` once, when the last card commits.

- **Heading:** "Votes locked".
- **While others are still voting:** the tumbling die from Stage 2 (same inline SVG),
  "Waiting on the **table**" with "table" in gold, and the rotating hint line cycling
  every ~2.6s with a fade — same three hints as the Stage 2 waiting room.
- **Roster:** one row per player, not chips. Each row shows the name, host/you tags, and
  a status: a pulsing dot with "Voting…", or a gold check with "Done". Finished rows get
  a gold border. **Gold, not sage** — sage means *play*, and reusing it for *finished*
  muddies both.
- **When everyone's done:** the die is replaced by **three face-down cards shuffling** —
  `.deck-card.back` from the waiting room, unchanged, with a deal animation. Text becomes
  "All votes are in" with "Results are on their way" and a small gold spinner beneath.
  **Face-down deliberately: nothing about the outcome may leak before the reveal.**

`.deck-card` and `.deck-card.back` are currently duplicated in `vote.html` and
`night-host.html`. Rather than a third copy, **move them into `css/base.css`** and delete
both duplicates. Same reasoning as the Stage 2 token consolidation.

### How each device learns the state

Reuse `joinSessionChannel()` from `js/presence.js` — the channel, the status listener,
and the `SUBSCRIBED`-then-`track()` rule are all already correct. **Do not write a second
presence module.**

Add `finished: true` to the presence meta when a participant finishes, so roster status
updates without a database round trip. Presence is the right layer for "who's done right
now"; `finished_at` remains the durable record for `finish_voting()` to check.

**Status `done` → navigate to `/results/{code}`.** This is the only thing that advances
the table, and it comes from the database, so every device lands together — exactly like
Start Voting in Stage 2.

---

## 8. Host override

The host votes like everyone else, so they reach the same waiting panel.

- **Host only**, and **only once they've finished and at least one other player hasn't.**
- A quiet text button below the roster: "Show results now".
- Confirm first, naming the cost: "Theo and Priya haven't finished. Their votes so far
  will still count." Buttons: "Keep waiting" and "Show results".
- On confirm, `forceResults()`. The status flips and everyone navigates, including the
  people still mid-deck.
- Style it like Cancel in Stage 2 — quiet, well below the roster, not competing.

---

## 9. Do not build

- The results screen, any tallying, any tiebreak logic.
- An undo, a back button, or a vote-review screen.
- A second detail modal, a second presence module, a second card back.
- A "leave" button. Presence handles departures.
- Any entry point on the shelf. Still shipping dark.
- Changes to `index.html`, `js/filters.js`, or `games.json`.

---

## 10. Verification

Sandbox:

- [ ] `git diff --stat`: `vote-swipe.html`, `js/swipe.js`, `supabase-stage3-addendum.sql`
      added; `js/session.js`, `css/base.css`, `vercel.json` modified. `index.html`
      **unchanged**.
- [ ] `.deck-card` styles appear in `css/base.css` **once**, and no longer in `vote.html`
      or `night-host.html`.
- [ ] Grep for `service_role` — zero hits outside the existing warning comment.
- [ ] `track()` is still called only inside the `SUBSCRIBED` branch.
- [ ] No second copy of the detail modal.

Preview deployment — two browsers, or a laptop and a phone:

- [ ] Start voting from the host page → every device lands on the swipe screen together.
- [ ] Drag right past the threshold → PLAY stamp, card flies right, next card draggable
      **immediately**.
- [ ] Drag left → PASS stamp, card flies left.
- [ ] Drag 60px and release → card springs back, **no vote recorded** (check the table).
- [ ] The wash darkens the same way in both directions; only the stamp colour differs.
- [ ] Tap the info button → detail modal opens, **no swipe starts**, no vote is cast.
- [ ] The buttons cast the same votes as the gestures.
- [ ] Progress counter and bar track the deck correctly, including the last card.
- [ ] Last card → waiting panel appears in place, no route change, no recap.
- [ ] **Refresh mid-deck → resumes on the right card, no duplicate rows in `votes`.**
      *If this fails, the resume query is wrong — check it before anything else.*
- [ ] Second player finishes → first player's roster flips that row to "Done" live.
- [ ] Last player finishes → **every device navigates to `/results/{code}` at the same
      moment** (404 expected).
- [ ] Host waiting, someone still voting → "Show results now" appears **on the host's
      screen only**.
- [ ] Confirm it → everyone navigates, including the person mid-deck.
- [ ] Non-host never sees the override, at any point.
- [ ] Airplane mode for one swipe, then back on → the vote lands, no error toast, no
      duplicate.
- [ ] Mobile: the card stack fits without scrolling; the swipe doesn't trigger browser
      back or pull-to-refresh (`touch-action: none` on the card).
- [ ] Reduced motion: shuffle and spinner hold still; the screen still works.

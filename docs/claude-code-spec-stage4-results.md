# Claude Code Spec — Game Night, Stage 4: Results

**Builds on Stage 3**, which is merged and live: `vote-swipe.html`, `js/swipe.js`, the
`votes` table, `submit_vote` / `finish_voting` / `force_results`, and the presence
`finished` meta all exist and work.

**Scope:** the results screen at `/results/{code}`. Every device already navigates there
when the session status flips to `done`, and it currently 404s. This spec fills that in:
tallying the votes, the reveal, ties, and the rematch cycle.

**This is the last stage of the Game Night feature.** After this, the only thing left is
the entry-point PR that takes it out of `GAME_NIGHT_ENABLED`.

**Run `supabase-stage4-addendum.sql` before starting.** It ships alongside this spec —
already written, at the repo root next to the Stage 3 one. It adds the round columns,
makes the votes primary key and `submit_vote` round-aware, and adds `start_rematch`
(§3). Do not rewrite it; read it.

---

## 0. Working rules

- **Branch, PR into `main`.** Never push to `main` directly.
- **Ship dark.** No new entry points. Nothing on the shelf changes.
- **Static site.** Vanilla JS, ES modules, CDN imports. No bundler.
- **Additive.** `index.html`, `js/filters.js`, and `games.json` must not change.
- **Reuse before rebuilding.** Read `vote-swipe.html` first — this screen shares its
  page shell, its roster patterns, its confirm dialog, and its status handling.
- Verification happens on the **Vercel preview deployment**.

---

## 1. Decisions already made

| Question | Decision |
|---|---|
| Reveal | **Dramatic.** Face-down card, then a flip. Not an instant list. |
| Ranking | **Dense: 1, 2, 2, 3.** Ties share a number, the next game takes the next number. **Never skip.** |
| Individual votes | **Counts by default, names on tap.** Every game, winner and not. |
| Ties | **Shown as tied.** Never auto-broken, never coin-flipped. |
| Clear winner actions | **"Back to the shelf" only.** Nothing competes with the result. |
| Tie actions | **"Rematch" as the CTA**, "Back to the shelf" as a ghost button. |
| Rematch scope | **Only the tied games.** Everyone votes again on that shorter deck. |
| Who can start it | **Host only.** Everyone else gets "Request a rematch". |
| A rematch that ties again | **Repeats.** Rematch again. No forced tiebreak, ever. |
| Everyone passed everything | **"Nobody's feeling it tonight."** No reveal, no Rematch — shelf only. |

---

## 2. What already exists — read these first

```
js/session.js        RPC wrappers, fetchVotes(), sessionErrorMessage()
js/presence.js       joinSessionChannel() — presence, status, markFinished()
js/waiting-room.js   deckFromSession(), openGameModal()
js/game-modal.js     the shared detail modal — 4th surface, still one component
css/base.css         tokens, page chrome, .deck-card / .deck-card.back
vote-swipe.html      page shell, roster, confirm dialog, scroll lock, status nav
```

`fetchVotes(code, name)` currently filters to one participant. **Widen it or add a
sibling** that fetches every vote for a session — this screen needs all of them.

Participant name: `sessionStorage['gamenight:{code}:name']`. Missing → send to
`/vote/{code}`, same as Stage 3 does.

---

## 3. `supabase-stage4-addendum.sql`

Same conventions as the Stage 3 addendum: anon-key callable, `SECURITY DEFINER`
functions, safe to re-run.

The addendum (already written) does four things worth understanding before touching the
client:

- **Round columns** on `sessions` and `votes`. A rematch must not destroy round 1's
  result — the tally reads the current round; earlier rounds stay on disk.
- **Round-aware votes primary key** — `(session_code, participant_name, game_id, round)`.
  Without this, every round-2 insert collides with its round-1 row and is silently
  swallowed.
- **`submit_vote` now resolves the round server-side** from the session. The client
  still calls it with the same four arguments — no client change needed for voting.
- **`start_rematch(p_code, p_name, p_game_ids)`** — host only (`NOT_HOST`), tie only
  (`NOT_TIED`), and in one transaction: bump round, narrow `game_ids` to the tied
  games, clear every `finished_at`, set status back to `voting`.

Every device is already listening for status changes, so they all land on the swipe
screen together — same mechanism as Start Voting. **Do not navigate directly.**

Client-side consequence for the tally: **fetch votes filtered to `session.round`**, or
round 1's votes pollute a rematch's result.

**Rematch requests do NOT touch the database.** They ride on presence meta (§7), exactly
like `finished` does. A request only matters until the host acts on it.

### Error copy

Add to `ERROR_COPY` in `js/session.js`:

| Raised | Show |
|---|---|
| `NOT_TIED` | "This game night has already moved on." |
| `NOT_HOST` | already handled — ignored silently |

---

## 4. New files

```
results.html    the whole screen
```

Plus a rewrite in `vercel.json`:

```json
{ "source": "/results/:code", "destination": "/results.html" }
```

---

## 5. The tally

Fetch every vote for the session **at the current round**, then per game:

- `playCount` — votes of `'play'`
- `noVoteCount` — participants with no row for that game (the host's "Show results now"
  can cut voting short; Stage 3 guarantees this happens)

**The denominator is always the full participant count**, not the number who voted.
`"1 of 4 · 1 no vote"` is the honest line. Never quietly treat a missing vote as a pass.

Sort by `playCount` descending, then apply **dense ranking**:

```js
let rank = 0, prev = -1;
sorted.map((g) => {
  if (g.playCount !== prev) { rank += 1; prev = g.playCount; }
  return { ...g, rank };
});
```

Everything at rank 1 is a winner. **More than one means a tie** — that single fact drives
the headline, the reveal, and which buttons render.

**A zero-vote result gets its own state** (§6): when the top play count is 0, there is
no winner and nothing reveals. Detect it as `sorted[0].playCount === 0` after the tally,
before ranking drives anything else.

---

## 6. The screen

**`results-mockup.html` accompanies this spec and is the approved design.** Match its
layout, copy, timing, and motion.

### The reveal sequence

1. Headline "And the table says…" above a **face-down card** — `.deck-card.back`'s hatch
   pattern scaled up, gently wiggling. Same card the table watched shuffle on the
   tallying screen.
2. At ~1.1s it **flips** to the winner's cover, with a gold glow blooming in behind it.
   Headline becomes "Tonight's game", or **"It's a tie"** when there's more than one.
3. Title and the gold count pill fade in (~1.75s).
4. "How the rest stacked up" (~2.35s), rows staggering.
5. Buttons (~2.75s).

**Two hard rules, both learned the painful way:**

- **Never run a CSS animation and a CSS transition on the same property of the same
  element.** The wiggle lives on the outer `.flip`; the rotation transition lives on the
  inner `.flip-inner`. Put them on one element and WebKit silently skips the
  transition — the card snaps instead of turning. It looks correct in Chrome and broken
  on every iPhone at the table.
- **Nothing load-bearing may depend on `animation-fill-mode: forwards`.** If an element's
  resting state is invisible and only an animation makes it visible, a dropped animation
  leaves a blank hole where the winner should be.

A tie reveals **all tied cards side by side, flipping together**, titles joined with an
ampersand.

### Nobody's feeling it

When every game got zero play votes, **the card never turns** — no game earned the
reveal. At the moment the flip would have happened, the face-down card instead dims to
about half opacity and the headline lands as **"Nobody's feeling it tonight"**. Below
it: "Everyone passed on everything." and "The shelf awaits — maybe a different deck."

The list still renders — heading **"How the votes fell"**, every game included, rank
numbers replaced with an en dash (ranking six ways of zero means nothing), every count
an honest "0 of 4", rows still expandable to their all-pass chips. Actions: **"Back to
the shelf" only** — no Rematch; re-voting a deck everyone already rejected helps nobody.

### Colours

The winner card's glow, the count pill, and the play-vote name chips are all **gold**.
`--bgs-vote-play` / `--bgs-vote-pass` belong to the swipe screen; results doesn't borrow
them. Sage means *the act of swiping right*; by this screen that's history, and what's on
display is a winner.

### The ranked list

Row: rank number (mono), cover thumb, title, count line, and an **info button** at the
right edge.

- **Tapping the row body** expands the vote breakdown: gold chips for play, quiet
  outlined chips for pass, dashed italic "Priya · no vote" for anyone who didn't vote.
- **Tapping the info button** opens the shared game modal. Two adjacent tap targets with
  different jobs — the info button must be a **sibling** of the row button, not nested
  inside it, and must `stopPropagation`.
- **No "tied" tag on list rows.** Shared rank numbers already say it, and it only
  matters at the top.
- No progress bars. With 4–6 players, "2 of 4" is instantly readable and a bar just
  decorates a number.

The winner also gets an info button, on the **revealed** face of the card so it arrives
with the flip.

### Actions

**Clear winner:** gold "Back to the shelf". That's all.

**Tie, host:** gold "Rematch", hint "Everyone votes again — just the {n} tied games.",
ghost "Back to the shelf". Above the button, when requests exist: a pulsing gold dot and
"Theo wants a rematch" / "Theo and Priya want a rematch" (grammar correct for 1, 2, or
3+ names).

**Tie, everyone else:** gold "Request a rematch", hint "A rematch votes on just the tied
games.", ghost "Back to the shelf". After tapping: the button becomes a non-interactive
outlined "Rematch requested ✓" and the hint becomes "{host} can start it — a rematch
votes on just the tied games." **One request per person.**

Rematch passes only the tied games' ids to `start_rematch`.

---

## 7. Presence

Reuse `joinSessionChannel()`. Add `rematchRequested` to the meta alongside `finished`,
using the same `markFinished()` pattern — add a `markRematchRequested()` sibling rather
than a new module.

The host's request line renders from presence, so it updates live and disappears on
refresh. That's correct: a request is a nudge, not a record.

**Status handling:**
- `voting` → `/vote/{code}/swipe` (this is how a rematch moves everyone)
- `cancelled` → the ended screen, and leave the channel

Someone landing on `/results/{code}` while the session is still `voting` (a stale tab,
or they refreshed mid-rematch) goes to the swipe screen. Someone arriving at a `waiting`
session goes to `/vote/{code}`.

---

## 8. Do not build

- Any automatic tiebreak — no coin flip, no BGG rating, no "host picks". **Ever.**
- A rematch limit or forced resolution after N rounds. It repeats as long as they want.
- Vote editing, or a way to see another round's results.
- A second detail modal, presence module, or card back.
- Any entry point on the shelf. Still shipping dark.
- Changes to `index.html`, `js/filters.js`, or `games.json`.

---

## 9. Verification

Sandbox:

- [ ] `git diff --stat`: `results.html`, `supabase-stage4-addendum.sql` added;
      `js/session.js`, `js/presence.js`, `vercel.json` modified. `index.html`
      **unchanged**.
- [ ] Dense ranking: six games at play counts 4,3,2,2,1,1 render ranks **1,2,3,3,4,4** —
      no skipped numbers.
- [ ] No `animation` and `transition` on the same property of the same element in the
      reveal.
- [ ] Grep for `service_role` — zero hits outside the existing warning comment.

Preview deployment — two browsers, or a laptop and a phone:

- [ ] Finish voting → every device lands on results together.
- [ ] **The card flips smoothly on an iPhone (Safari), not just in Chrome.**
      *If it snaps instantly, the animation/transition conflict is back — fix that first.*
- [ ] Tap the count pill → winner's names expand.
- [ ] **Tap each list row → its names expand.** *Easy to break when restructuring the row
      markup; it fails silently.*
- [ ] Tap any info button → the shared modal opens, the row does **not** expand.
- [ ] Counts use the full player count as denominator; someone who didn't vote shows as
      "no vote", not as a pass.
- [ ] Clear winner → only "Back to the shelf" renders.
- [ ] Force a tie (two games, same play count) → both cards flip, "It's a tie", ampersand
      title, Rematch is the CTA.
- [ ] Non-host sees "Request a rematch"; tapping it shows the request on the **host's**
      screen within about a second, and their own button becomes "Rematch requested ✓".
- [ ] Non-host **cannot** start a rematch by any route.
- [ ] Host taps Rematch → **every device lands on the swipe screen** with only the tied
      games in the deck.
- [ ] That rematch tallies correctly and **does not include round 1's votes**.
- [ ] A rematch that ties again offers Rematch again.
- [ ] Everyone passes on everything → the card stays face-down and dims, "Nobody's
      feeling it tonight", every row "0 of 4" with en-dash ranks, and only "Back to the
      shelf" renders.
- [ ] Refreshing results re-renders the same result (reveal replays; that's fine).
- [ ] Mobile: the reveal fits without scrolling; two tied cards fit side by side.
- [ ] Reduced motion: the result appears complete and instantly, nothing invisible.

# Spec: TV mode — a big-screen companion for a live game night

**Mockup:** `docs/mockups/tv-mode-c.html` (locked). Open it and use the demo bar: Phase / Outcome / Deck shown–hidden / Deck size / Table / Theme / Phone inset / Reduced motion, plus "▶ Play the night" for the whole evening in sequence. The earlier option rounds (`tv-mode-options.html`, `tv-reveal-options.html`, `tv-reveal-options-2.html`) are reference only.
**Files touched:** new `tv.html`; `vercel.json`; `js/presence.js`; `vote-swipe.html`; `night-host.html`. No database change, no new RPC, no migration.
**Flag:** `?tv=1`, written as a kill-switch constant `TV_ENABLED` (ships `false`) in `night-host.html` and `vote-swipe.html`, `||` the URL param, exactly like `COVER_LIGHT_ENABLED` in `vote-swipe.html`. The TV page itself is not flagged: it has no entry point until the flag is on, and a direct visit is harmless (read-only).
**Commits:** three, in order. Stop for review after each.

## What this is

A read-only page at `/tv/:code` that the host opens on a laptop or casts to the television. It subscribes to the same Supabase Realtime channel as the phones and mirrors the night at big-screen size:

1. **Waiting room** — the QR ticket and join link, names as chips as people land.
2. **Voting** — "N of M have voted", seats with a tick for everyone who has finished, the deck as covers (or card backs when the host hid the deck). Votes are never shown.
3. **Results** — a five-second countdown so the room looks up, then the same sealed → count → crown reveal as the phones, scaled up. Winner, tie, nobody and host-forced outcomes.
4. **Tie-break** — follows a rematch into round 2 and back to results.
5. **Ended** — the host cancelled, or the code is wrong/expired.

The TV never votes, never counts toward "2 people to start", and never writes to the database. It joins presence only so the phones know it is there.

**Look up.** When a TV is in the session, the phones do not play the reveal. When the session flips to `done`, each phone shows a "Look up" holding card, and navigates to `/results/:code` only once the TV reports it has landed on the result — landing on the final state, no second count. With no TV, nothing about the phone flow changes.

## Out of scope

Reservation states (Upcoming / Lineup TBD / Night is live), the poster, OG images, a "TV" button on the results page, a QR on the ended screen, sound, an installable / fullscreen prompt (the browser's own F11 is enough for v1), a light theme (the page reads `data-theme` like every other page and will take the light theme when it lands). Do not touch `tally()`, dense ranking, the rematch RPCs, `results.html`'s own reveal, or the swipe screen's vote handling.

## Hard constraints (house rules)

- **WebKit rule:** never `animation` and `transition` on the same property of the same element. In this page: `.seat .chip`, `.mini`, `.mini .cov`, `.pips i`, `.deck`, `.seats-row`, `.scene`, `.cover-light img`, `.res-meta` use **transitions only**. `.num`, `.beat`, `.chip-n.pop`, `.crown .cov`, `.flash` and the confetti pieces use **animations only**. The countdown number and its ring are a fresh element per beat, so they are never transitioned.
- Gold rings via `box-shadow`, never `outline`. Focus rings: none needed (nothing is focusable except the BGG badge link, which keeps the site's `box-shadow` focus style).
- Production tokens only: Walnut, Navy, Mahogany and Oak must all look right with no per-theme rule. The page resolves `data-theme` with the same inline resolver the other pages use (the night's owner's theme, since the TV is a shelf surface).
- Plain ES modules with **absolute** import paths (`/js/…`): the page is reached through a rewrite, so relative imports 404.
- Participant names reach markup: escape them with the same `esc()` helper `results.html` uses.
- Cover light: call `setCoverLight(url)` with the **exact string** the visible `<img src>` uses, so the browser serves it from cache (see `js/cover-light.js`).
- BGG attribution: the "Powered by BGG" badge is on screen in every state, never dimmed or hidden (bottom right, `assets/powered-by-bgg.svg`, 32px tall at 1920).
- Nothing on this page has a placeholder: an unset field is absent (house rule from the poster).

## Data sources

| Need | Source | Notes |
|---|---|---|
| session (status, round, game_ids, reveal_deck, host_name, owner_id) | `fetchSession(code)` on load, then the `sessions` row change via presence.js | add `onSession(row)` to `joinSessionChannel` (Commit 1) so the TV gets `round` as well as `status` |
| the deck's games | `fetchGamesForSession(session)` + `deckFromSession(session, games)` | same as the phones |
| who is at the table, who has finished (waiting, voting) | presence `players` (already carries `finished`, `isHost`, `joinedAt`) | TV metas filtered out (Commit 1) |
| everyone who joined, in join order (results) | `fetchParticipants(code)` | durable record, so someone who voted and closed their tab still counts, as on `results.html` |
| votes (results) | `fetchSessionVotes(code, session.round)` | tally with the same rules `results.html` uses: plays per game, dense ranking, `nobody` when the top count is 0, `noVote` = participants with no row for a game |
| QR | `qrcode@1.5.3` from esm.sh, dark = `--bgs-bg`, transparent light, `margin: 0` | identical to `drawQR()` in `night-host.html`; link is `${origin}/vote/${code}` |

The TV loads with **no name gate and no sign-in**. It never calls `join_game_night`.

## Presence contract (Commit 1)

`joinSessionChannel` gains one option and one callback, and stops counting TVs:

```js
export function joinSessionChannel({
  code, participantName, isHost, finished = false, tv = false,
  onPresence, onStatus, onSession,
}) {
  // meta gains `tv`
  let meta = { name: participantName, isHost, joinedAt: …, finished, tv };

  function sync() {
    const all = Object.values(channel.presenceState()).map((m) => m[0]).filter(Boolean);
    // A TV is a screen, not a person: it never counts toward the two-player
    // gate, the "N here" line, the finished count or the results roster.
    const players = all.filter((m) => !m.tv).sort(…);
    const tvs = all.filter((m) => m.tv);
    onPresence({
      players, count: players.length,
      tvPresent: tvs.length > 0,
      // the highest round any TV has finished revealing; phones wait for this
      tvRevealedRound: Math.max(0, ...tvs.map((m) => m.revealedRound || 0)),
    });
  }
  // postgres_changes handler: keep onStatus(payload.new.status) and add
  //   onSession?.(payload.new)
  // Controller gains:
  async markRevealed(round) { meta = { ...meta, revealedRound: round }; await channel.track(meta); }
}
```

The TV joins with `participantName: 'tv:' + crypto.randomUUID().slice(0, 8)` (presence keys must be unique; two TVs in one room are fine) and `tv: true`. Everything else about the module — `track()` only after `SUBSCRIBED`, `leave()`, `markFinished()`, `markRematchRequested()` — is unchanged. Existing callers ignore the new fields.

## Page states and copy

Eyebrow (top left, mono, always): `GAME NIGHT · {code}`; in round 2 it gains `· ROUND 2 · TIE-BREAK`. Wordmark top right: *boardgameshelf* (Fraunces italic). Bottom left: a live dot + mono state word (`waiting room` / `voting` / `results` / `round 2 · voting` / `round 2 · results` / `ended`; the dot goes grey on `ended`). Bottom right: BGG badge.

| Status | Headline | Under it | Body |
|---|---|---|---|
| `waiting` | Scan to join | QR ticket (code under the QR), then mono `boardgameshelf.vercel.app` / `/vote/{code}` (second line ivory), then dim hint: `{n} at the table · waiting for {host} to start`; with n < 2: `Waiting for one more before {host} can start` | name chips along the bottom in join order; empty dashed chips fill the remaining slots up to the current count only (no fixed seat count) |
| `voting` | **{n}** of {m} have voted (n gold italic, fixed-width so the digit swap does not shift the line) | Swipe right to play, left to pass. Votes stay sealed until the last one lands. | seats row (pending seats dashed at 55%, solid + ivory tick once `finished`), then the deck: covers when `reveal_deck`, card backs (`?`) when not |
| `done` → countdown | All votes are in / *Look up* | | seats and deck dim to 28%, number counts 5→1 over the deck |
| `done` → count | Counting the votes | | pips fill (see timeline) |
| decided, single | The table has decided | | rank-1 mini lifts, rest dim, cover light to the winner |
| result, single | Tonight we *play* | title, pill `{k} of {m} said play` | crown cover, flash, confetti, seats turn over each person's vote (gold ✓ / clay ✕ / dash) |
| decided + result, tie | It's a tie | titles joined by ` · `, pill `{k} of {m} each`, dim hint `{host} can start a tie-break round on these from their phone` | tied covers side by side (2 → 15vw, 3 → 11.5vw; more than three: first three, titles name all), no flash, no confetti, no light, **seats hidden** |
| decided + result, nobody | Nobody's feeling it tonight | dim hint `Everyone passed on everything. {host} can pick a new deck from their phone.` | minis stay at 22%, no crown |
| host forced | as above | | sealed phase: dash chip for anyone with a missing vote on any game; result: dash on the winner for anyone who never voted on it |
| `voting` again (rematch) | as `voting` | | deck narrowed to `game_ids` of the new round, eyebrow shows the round |
| `cancelled` | Game night over | `{host} ended this game night.` | mono shelf link `boardgameshelf.vercel.app/u/{slug}` (owner's slug; omit the line if the session has no owner) |
| not found / expired | Game night over | `That game night has ended, or the code is wrong.` | |

Scene changes cross-fade: the new scene is inserted under the old one, the old one fades out over 450 ms and is removed.

## Timeline — `done` (single winner, motion on)

| t (ms) | Event |
|---|---|
| 0 | render count scene: headline "All votes are in" + sub "Look up"; seats with ticks/dashes; minis with empty pips; `setCoverLight(null)`; **phones already on their look-up card** (they act on the same status change) |
| 500 | `.counting` on the scene: deck and seats to opacity .28 |
| 900 | number **5** + ring (fresh elements, 820 ms animations) |
| 1720 / 2540 / 3360 / 4180 | **4**, **3**, **2**, **1** |
| 5000 | number layer removed, `.counting` off (deck and seats back to 1). Nothing flashes. |
| 5500 | headline "Counting the votes" |
| 6000 → ~7500 | one pip per `step` ms, round-robin across the deck (pip k of every game that has one, then pip k+1). `step = clamp(round(1500 / totalPlayVotes), 40, 110)` |
| +450 | decided: `.decided` on the scene, `.win` on rank-1 minis, `setCoverLight(winner.imageMid)`, headline |
| +950 | result: `.result`, crown + flash + confetti, headline "Tonight we *play*", `controller.markRevealed(session.round)` |
| result +500 | title + pill fade in |
| result +650, then every 130 | each seat's chip turns to that person's vote on the winner |

Tie: same to the decided beat, then the result beat with no flash / confetti / light; `markRevealed` fires at the result beat too. Nobody: after "Counting the votes" hold 1100 ms, then decided (all minis dim), then result 300 ms later; `markRevealed` fires there.

**Reduced motion** (`prefers-reduced-motion`): no countdown number — the scene holds a still "All votes are in / Look up" for 2500 ms, then renders straight to the final state (chips already turned over, light on for a single winner); `markRevealed` fires at that moment.

**Skip / seen already:** none on the TV. It has no input, and a TV that reloads mid-night simply lands on the current state (a reload during `done` plays the countdown and count again, which is acceptable; it is the room's screen, not a phone).

**Rematch mid-count:** `onStatus('voting')` clears every timer, calls `setCoverLight(null)`, and renders the voting scene for the new round. `onStatus('cancelled')` clears timers and renders ended. All timeouts go in one `timers` array, as on `results.html`.

## Layout constants

The mockup sizes everything in `cqw` inside a 16:9 frame; on the real page the frame **is** the viewport, so the same numbers are `vw`. Content is centred vertically, so a 16:10 laptop just gets more margin. Below 900 px wide (a phone opened `/tv/…`) the page renders one plate: "TV mode is for a big screen" with the same mono link and code, nothing else.

| Constant | vw | px @ 1920 |
|---|---|---|
| Side padding of chrome | 3.2 | 61 |
| Eyebrow / live line | mono .95 / .9, letter-spacing .16em / .06em | 18 / 17 |
| Wordmark | Fraunces italic 1.35 | 26 |
| BGG badge height | 1.7 | 32 |
| Headline (waiting, voting) | Fraunces 600 4 | 77 |
| Headline (count, result) | 3.6 / 3.8 | 69 / 73 |
| Sub-line under a headline | Inter 1.3, ivory-45 | 25 |
| Hint | Inter 1.35, ivory-70 | 26 |
| Mono link line | 1.15 | 22 |
| QR ticket | QR 19 square, padding 1.4, radius 1.4, code Fraunces 600 2.6 letter-spacing .18em, gold fill, `--bgs-on-gold` ink | 365 / 27 / 27 / 50 |
| Name chip (waiting) | Inter 500 1.15, padding .75 × 1.3, gold hairline .3 alpha, plate .85 | 22 / 14 × 25 |
| Seat (voting) | 5.2 circle, initial Inter 600 at .4 × seat, name Inter 500 .95, gap 2.2 between seats | 100 / 40 / 18 / 42 |
| Seat (count, result) | 4 circle | 77 |
| Seat chip | .42 × seat, ivory ✓ (`ok`), sage ✓ (`play`), clay ✕ (`pass`), plate dash (`novote`) | 42 / 32 |
| Host seat | gold border .75 alpha, gold initial, mono `HOST` after the name | |
| Cover (voting) | width `--mw`: 10.5 for ≤5 games, 9.2 for 6–8, 7.4 for 9+; aspect 3/4; radius .7; gold hairline .2 | 202 / 177 / 142 |
| Mini (count) | same widths; pips .5 dots, gap .28; 9+ people → a mono counted number instead of pips | 10 / 5 |
| Deck rows | `rows = ceil(n/5)`, `perRow = ceil(n/rows)`, deck max-width `perRow·mw + (perRow−1)·1.5 + 12` vw, gap 1.5 | |
| Winner mini | `translateY(-.9vw) scale(1.12)`, ring `0 0 0 .2vw gold` + `0 0 2.4vw gold .35`; others opacity .32 (.22 for nobody) | |
| Countdown number | Fraunces 600 19, gold, letter-spacing −.04em, text-shadow `0 0 6vw gold .35`; centred on the deck's centre | 365 |
| Countdown ring | 16 circle, `box-shadow 0 0 0 .25vw gold .55`, scales .6 → 2.8 and fades over 820 ms | 307 |
| Crown cover | 19.5 wide solo, 15 two tied, 11.5 three; radius 1.2; gold border .55; glow `0 0 6vw gold .25` | 374 / 288 / 221 |
| Crown animation | `crown` .75s `cubic-bezier(.2,.9,.25,1)`; second/third tied cover delayed .12s / .24s | |
| Flash | 150 % of crown width, gold radial, 1 s, single winner only | |
| Confetti | 48 pieces .45 × .7, gold / play / pass / ivory, Web Animations API 1400–2300 ms from the crown's centre, removed on finish | |
| Result title / pill | Fraunces 600 2.4 / mono .95 in a gold-hairline pill | 46 / 18 |
| Cover light | `.cover-light` from `base.css`, but `position:absolute` inside the page root and `--cl-scale: 13`; `.on` opacity .55 | |
| Scene cross-fade | 450 ms opacity | |

## Phones — the look-up card (Commit 3)

`vote-swipe.html`, `onStatus`:

```js
if (status === 'done') {
  navigated = true;
  clearInterval(hintTimer);
  if (tvOn && lastPresence.tvPresent) {
    renderLookUp();                       // stays on the channel; leaves in goLookUpResults()
    lookUpTimer = setTimeout(goLookUpResults, LOOK_UP_MAX_MS);   // 20000
  } else {
    controller.leave();
    window.location.href = `/results/${code}`;
  }
}
```

`onPresence` keeps the latest payload in `lastPresence`; while the look-up card is showing, `tvRevealedRound >= session.round` calls `goLookUpResults()` immediately. `goLookUpResults()` clears the timer, writes `sessionStorage['gamenight:{code}:revealed:{round}'] = '1'` (the key `results.html` already reads as "seen already", so the phone lands on the final state with the light on and no second count), calls `controller.leave()` and navigates. A phone that arrives at `/results/:code` some other way (refresh, a late joiner) behaves exactly as today.

Look-up card markup, in the swipe page's existing narrow column and styles: eyebrow `Game Night · {code}`; a 92 px gold-hairline circle with a gold `↑` that bobs 6 px (animation only, on the arrow, nothing else animates); `h1` **Look up**; `.waiting-sub` `The table is deciding on the big screen`. No roster, no shuffle, no buttons. `tvOn = TV_ENABLED || new URLSearchParams(location.search).get('tv') === '1'`.

## Host entry (Commit 3)

`night-host.html`, waiting room, behind `tvOn`: a `.copy-btn`-styled button **Show on TV** next to **Copy link** in `.code-row`, `<a href="/tv/{code}" target="_blank" rel="noopener">`. Nothing else on the host's phone changes. The button is not shown on the swipe or results screens in v1.

---

## Commit 1: presence contract + the TV page's waiting room and voting

1. `js/presence.js`: the contract above (`tv` option, TV filtering, `tvPresent`, `tvRevealedRound`, `onSession`, `markRevealed`). No behaviour change for existing callers.
2. `vercel.json`: `{ "source": "/tv/:code", "destination": "/tv.html" }`.
3. New `tv.html`: `base.css`, the theme resolver in `<head>`, page `<style>` with the constants above (waiting, voting, chrome, `.cover-light` override), the chrome, `#stage`, the small-screen plate. Module script: read the code from the path, `fetchSession`, `fetchGamesForSession`, `deckFromSession`, join presence as a TV, render `waiting` and `voting` from presence, follow `onSession` for status/round, render `cancelled` / not-found. For `done` render a plain "Votes are sealed" holding scene for now (Commit 2 replaces it).

**Verify:** open `/night/:code/host` on a phone and `/tv/:code` on a laptop. The TV shows the QR and the host's chip; a second phone joining adds a chip on the TV and the host's "Start Voting" enables at 2 people, not before, with the TV open. Start voting: the TV flips to "0 of 2 have voted", ticks appear as each phone finishes, the deck shows covers or backs per the host's toggle. Cancel from the host: TV shows ended. Wrong code: TV shows ended.

**Commit message:** `feat(gamenight): TV mode page — waiting room and voting mirror (no entry point yet)`

Stop for review.

## Commit 2: countdown, count and crown on the TV

`tv.html` only. The `done` scene per the timeline and outcome tables, tally shared in logic with `results.html` (copy the tally rules; do not import the page). `markRevealed(round)` at the result beat. Rematch and cancel handling mid-count. Reduced-motion path.

**Verify:** all four outcomes on Walnut and Navy (drive them with two phones; force with the host's "Show results now"); a tie followed by a rematch from the host's phone moves the TV to "Round 2 · tie-break" voting and back to results; a cancel during the countdown lands on ended with no stray light; reduced motion holds the still card then lands on the final state; deck of 10 and table of 8 fit on a 1920×1080 window without scrolling.

**Commit message:** `feat(gamenight): TV mode results — countdown, count and crown`

Stop for review.

## Commit 3: phones look up, host gets the button

`vote-swipe.html` and `night-host.html` per the two sections above, both behind `TV_ENABLED` / `?tv=1`. `TV_ENABLED` ships `false`.

**Verify:** with `?tv=1` on both phones and the TV open, the last vote lands → both phones show "Look up", the TV counts down and crowns, both phones then land on the results **final state** (no second count, light on, rematch actions present). Close the TV tab mid-count → phones land on results within 20 s. Without a TV in the session → phones navigate to results immediately as today. Without the flag → no "Show on TV" button, no look-up card, even with a TV open.

**Commit message:** `feat(gamenight): phones look up to the TV; "Show on TV" in the waiting room (behind ?tv=1)`

Stop for review.

## Deliberate deviations from the mockup

- The mockup's phone inset, demo bar, "Play the night", and the offline QR stand-in are mockup-only.
- The mockup keeps every ended / not-found state under one "Game night over" scene; the real page also has the small-screen plate.
- Mockup timings for who joins / finishes are simulated; the real page is driven entirely by presence and the session row.

## Verification checklist (whole feature)

- [ ] TV never appears in any roster, never changes any "N here" / "N of M" count, and never enables "Start Voting" on its own
- [ ] Two TVs in one session both work; neither counts
- [ ] Deck hidden → card backs in waiting and voting; covers only ever appear at the count
- [ ] Votes are never visible on the TV before the result beat (ticks and dashes only)
- [ ] Countdown: covers stay face up, dim to .28 and return; nothing gold flashes at zero
- [ ] Single winner: light, flash, confetti, chips turn over; tie: none of those, seats hidden; nobody: no crown; forced: dashes
- [ ] Rematch mid-count and cancel mid-count: timers cleared, no stray light, correct scene
- [ ] Phones with a TV present: look-up card, then results final state with the light on; fallback after 20 s; no change without a TV; no change without the flag
- [ ] Walnut, Navy, Mahogany, Oak with no per-theme rule; BGG badge visible in every state
- [ ] Reduced motion: still hold, then final state; no countdown, no confetti
- [ ] No `outline` anywhere; no element carries both an animation and a transition on the same property

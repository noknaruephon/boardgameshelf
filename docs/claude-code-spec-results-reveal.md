# Spec: Count-then-crown reveal on the Game Night results screen

**Mockup:** `docs/mockups/results-reveal-mockup.html` (locked). Built on the real `css/base.css` and the real `results.html` styles; open it and use the demo bar (Outcome / Table / Deck / Replay / Seen already / Reduced motion).
**Files touched:** `results.html`, `vote-swipe.html`, `css/base.css`, new `js/cover-light.js`
**Flag:** `?reveal=1`, written as a kill-switch constant like `COVER_LIGHT_ENABLED` in `vote-swipe.html`. Ships as `false`. With the flag off, `results.html` behaves exactly as today (tease, then flip).
**Commits:** three, in order. Stop for review after each.
**Supersedes:** the line in `docs/claude-code-spec-vote-cover-light.md` that says the results screen gets no light. With this reveal on, a single winner lights the results screen.

## What this is

Today the results screen wiggles a face-down card under "And the table says…", flips it to the winner, then fades in the title, the count pill, the ranking and the actions.

This replaces the wiggle-and-flip with a vote count the whole table watches:

1. **Votes are sealed.** A row of seats (one initial per participant, a tick for everyone who finished). Every game in the deck as a small cover with one empty pip per participant.
2. **Counting the votes.** Pips fill one at a time, round-robin across the deck.
3. **The table has decided.** The top game lifts with a gold ring, the rest dim, the cover light takes its colour.
4. **Tonight we play.** The winner pops in large with a gold flash and confetti. The seats move under the count pill and turn over each person's vote on that game, one by one. Then the ranking and actions fade in exactly as today.

Everything from `.winner-meta` down (title, count pill, name chips, ranking rows, rematch flow, info buttons, presence, status navigation) is unchanged.

## Out of scope

`tally()`, dense ranking, rematch RPCs, presence, the waiting/tallying shuffle on `vote-swipe.html`, the ranking rows, the footer, the game modal. Do not touch them.

## Hard constraints (house rules)

- **WebKit rule:** never put `animation` and `transition` on the same property of the same element. In this design: `.rv-mini`, `.rv-mini .c`, `.rv-chip`, `.rv-pips i` use **transitions only**. `.rv-cover`, `.rv-flash`, `h1.rv-swap` and the confetti pieces use **animations only**. Do not add a transition to any of the second group, or an animation to any of the first.
- Gold rings via `box-shadow`, never `outline`. No new focus styles are needed.
- Production tokens only. The reveal must look right on Walnut, Navy, Mahogany and Oak with no per-theme rule.
- Match existing style: plain ES modules, absolute import paths (this page is reached through a rewrite, relative imports 404).

## Outcomes

| Outcome | Count phase | Decided beat | Result |
|---|---|---|---|
| Single winner | pips fill | winner lifts, others dim, cover light to the winner, headline "The table has decided" | crown + flash + confetti + light; seats move under the pill and turn over votes; headline "Tonight we play" |
| Tie (2+ games at rank 1) | pips fill | all tied games lift together, headline "It's a tie" | tied covers side by side with the crown pop, **no flash, no confetti, no light**; seats are **not** shown (there is no single game to show votes on); rematch actions as today |
| Nobody (top game has 0 plays) | nothing fills; hold ~1.1 s | all minis dim, headline "Nobody's feeling it tonight" | no crown at all; minis stay, dimmed; existing "Everyone passed on everything." meta |
| Host forced results | as above | as above | as above. Anyone with a missing vote row on any game gets a dash chip instead of a tick in the sealed phase, and a dash on the winner if they never voted on it |

## Copy

| Where | Today | New (flag on) |
|---|---|---|
| Initial headline | And the table says… | Votes are sealed |
| Count | (none) | Counting the votes |
| Decided, single | (none) | The table has decided |
| Final, single | Tonight's game | Tonight we play |
| Final, tie | It's a tie | It's a tie |
| Final, nobody | Nobody's feeling it tonight | Nobody's feeling it tonight |

## Timeline (single winner, motion on)

| t (ms) | Event |
|---|---|
| 0 | render: seats with ticks/dashes, minis with empty pips, headline "Votes are sealed" |
| 900 | headline "Counting the votes" |
| 900 → ~2400 | one pip per `step` ms, round-robin (pip k of every game that has one, then pip k+1). `step = clamp(round(1500 / totalPlayVotes), 40, 110)` so the count lasts about 1.5 s whatever the table size |
| +450 | decided beat: `.win` on rank-1 minis, `.decided` on the row, `setCoverLight(winner.image)` (single only), `navigator.vibrate(8)` |
| +950 | result: `.done .play` on the stage, confetti, `vibrate([18,40,30])`, headline final |
| result +500 | `.winner-meta.show` |
| result +650, then every 130 | each seat's chip turns to that person's vote on the winner |
| result +1300 | `.rest.show` |
| result +1700 | `.actions.show` |

Nobody: after "Counting the votes" hold 1100 ms, then the decided beat, then result after 300 ms.

**Skip:** a tap anywhere on the stage before the result jumps to the final state with no animation.
**Seen already:** on finish (animated or skipped) set `sessionStorage['gamenight:{code}:revealed:{round}'] = '1'`. If it is set on load, or `prefers-reduced-motion` is on, render straight to the final state: no count, no crown animation, no flash, no confetti, chips already turned over. The cover light still comes on.
All timeouts go into the existing `timers` array so the existing `onStatus` handlers (rematch, cancelled) clear them.

## Layout constants

| Constant | Value |
|---|---|
| Stage min-height while counting | 250px (0 once done) |
| Seat | 32px circle, Inter 600 12px, first character of the name (`Array.from(name)[0]`, so Thai and emoji names work), `.me` gets a gold border and gold letter |
| Seat chip | 17px circle, right -6px, bottom -5px; kinds `ok` (ivory ✓), `play` (gold ✓), `pass` (plate ✕), `novote` (dash) |
| Seats row | gap 9px, wraps, max-width 330px |
| Mini width `--mw` | 56px for ≤5 games, 50px for 6–8, 44px for 9+ |
| Mini rows | balanced: `rows = ceil(n/5)`, `perRow = ceil(n/rows)`, row max-width `perRow*mw + (perRow-1)*10` (6 → 3+3, 10 → 5+5). Gap 12px 10px |
| Mini cover | aspect 3/4 (same as `.row-thumb`), radius 7px, border gold .18 |
| Pip size `--pip` | `min(5, floor((mw - (total-1)*2) / total))`, gap 2px. If that is under 3 px, show a mono number instead of pips and count it up |
| Winner mini | `translateY(-9px) scale(1.13)`, `box-shadow: 0 0 0 2px gold, 0 0 26px gold .3`; others `opacity:.36` |
| Crown cover | 236px wide solo (was 196), 150px for two tied, 104px for three; aspect 3/4, radius 14px, existing gold glow shadow |
| Crown animation | `rv-crown` .75s `cubic-bezier(.2,.9,.25,1)`; second tied cover delayed .12s |
| Flash | 150% of the crown width, gold radial, 1s, single winner only |
| Confetti | 34 pieces, 8×12px, colours gold / `--bgs-vote-play` / `--bgs-vote-pass` / ivory, Web Animations API, 1100–1800ms, removed on finish |

More than three games tied at rank 1: show the first three covers in the crown; the title line and pill already name/count them all.

---

## Commit 1: share the cover light (no behaviour change)

The cover light lives inside `vote-swipe.html` today. The results screen needs the same thing, and a second copy would drift.

1. **`css/base.css`**: move the whole `/* ---- cover light … ---- */` block out of `vote-swipe.html`'s `<style>` into `base.css` unchanged, from `.cover-light{position:fixed…` through the reduced-motion rule for `.cover-light img`, including its comments. Keep `body.coverlight .vote-glow{display:none;}` and its comment in `vote-swipe.html`: it is about that page's glow.
2. **New `js/cover-light.js`**:

```js
// Shared screen wash (docs/claude-code-spec-vote-cover-light.md). Used by the
// swipe screen and the results reveal. Opacity-only cross-fade between two
// static images: nothing here may ever grow an animation (WebKit rule).
let lightIdx = 0;

/** Adds the layer once. Call at the end of <body>. */
export function initCoverLight() {
  if (document.querySelector('.cover-light')) return;
  document.body.classList.add('coverlight');
  document.body.insertAdjacentHTML(
    'afterbegin',
    '<div class="cover-light" aria-hidden="true"><img alt=""><img alt=""></div>',
  );
}

/** Cross-fades to a cover; null fades out. `url` must be the exact string the visible <img> uses. */
export function setCoverLight(url) {
  const imgs = document.querySelectorAll('.cover-light img');
  if (imgs.length !== 2) return;
  if (!url) { imgs.forEach((i) => i.classList.remove('on')); return; }
  const next = imgs[lightIdx ^= 1];
  const prev = imgs[lightIdx ^ 1];
  next.onerror = () => next.classList.remove('on');
  next.src = url;
  next.classList.add('on');
  prev.classList.remove('on');
}
```

3. **`vote-swipe.html`**: import both, replace the inline `insertAdjacentHTML` block with `if (coverLightOn) initCoverLight();`, delete the local `lightIdx` and `setCoverLight`. Keep `COVER_LIGHT_ENABLED`, `coverLightOn` and every existing call site and comment.

**Verify before committing:** the swipe screen looks and behaves exactly as before (wash on first card, cross-fade on each committed vote, fade out at end of deck, gold glow hidden).

**Commit message:** `refactor(gamenight): share the cover light between pages (no behaviour change)`

Stop for review.

---

## Commit 2: the new result, static (flag on lands on the final state)

This commit builds the markup, the CSS and the final state only. With `?reveal=1` the page opens directly on the finished result, i.e. the "seen already / reduced motion" path. No timeline yet.

### 2a. Flag and imports (`results.html`, top of the module script)

```js
import { initCoverLight, setCoverLight } from '/js/cover-light.js';

// ---- count reveal flag (docs/claude-code-spec-results-reveal.md) ----
// Kill switch, same shape as COVER_LIGHT_ENABLED on the swipe screen.
const COUNT_REVEAL_ENABLED = false;
const countRevealOn =
  COUNT_REVEAL_ENABLED || new URLSearchParams(location.search).get('reveal') === '1';
if (countRevealOn) initCoverLight();
```

### 2b. CSS

Leave the existing `.reveal` / `.flip` / `.face` rules in place (the flag-off path still uses them). Add the block below after them. It is the mockup's reveal CSS verbatim, minus the mockup-only `html.rm` and `.demobar` rules:

```css
/* ---- count-then-crown reveal (docs/claude-code-spec-results-reveal.md) ----
   WebKit rule: .rv-mini, .rv-mini .c, .rv-chip and .rv-pips i use TRANSITIONS
   only; .rv-cover, .rv-flash, h1.rv-swap and the confetti use ANIMATIONS only.
   Never both on one element. */
.rv-stage{display:flex;flex-direction:column;align-items:center;min-height:250px;margin-bottom:18px;-webkit-tap-highlight-color:transparent;}
.rv-stage.skippable{cursor:pointer;}
.rv-seats{display:flex;flex-wrap:wrap;justify-content:center;gap:9px;margin:2px 0 18px;max-width:330px;}
.rv-seat{position:relative;width:32px;height:32px;border-radius:50%;display:grid;place-items:center;flex:none;
  font:600 12px/1 'Inter',sans-serif;color:var(--bgs-ivory-70);background:rgba(var(--bgs-ivory-rgb),.07);border:1px solid rgba(var(--bgs-ivory-rgb),.16);}
.rv-seat.me{color:var(--bgs-gold);border-color:rgba(var(--bgs-gold-rgb),.6);}
.rv-chip{position:absolute;right:-6px;bottom:-5px;width:17px;height:17px;border-radius:50%;display:grid;place-items:center;
  font:700 10px/1 'Inter',sans-serif;opacity:0;transform:scale(.5);transition:opacity .22s ease,transform .22s ease;}
.rv-chip.show{opacity:1;transform:none;}
.rv-chip.ok{background:var(--bgs-ivory);color:var(--bgs-bg);}
/* Gold, not sage: same reasoning as .vchip.play above. */
.rv-chip.play{background:var(--bgs-gold);color:var(--bgs-on-gold);}
.rv-chip.pass{background:var(--bgs-plate);color:var(--bgs-ivory-45);box-shadow:inset 0 0 0 1px rgba(var(--bgs-ivory-rgb),.22);}
.rv-chip.novote{background:var(--bgs-bg);color:var(--bgs-ivory-45);box-shadow:inset 0 0 0 1px rgba(var(--bgs-ivory-rgb),.28);font-weight:500;}

.rv-minis{display:flex;flex-wrap:wrap;justify-content:center;gap:12px 10px;}
.rv-mini{width:var(--mw,56px);flex:none;transition:transform .45s cubic-bezier(.2,.8,.2,1),opacity .4s ease;}
.rv-mini .c{aspect-ratio:3/4;border-radius:7px;overflow:hidden;background:var(--bgs-bg-radial);border:1px solid rgba(var(--bgs-gold-rgb),.18);transition:box-shadow .4s ease;}
.rv-mini .c img{width:100%;height:100%;object-fit:cover;display:block;}
.rv-pips{display:flex;justify-content:center;gap:2px;margin-top:7px;min-height:6px;}
.rv-pips i{width:var(--pip,5px);height:var(--pip,5px);flex:none;border-radius:50%;background:rgba(var(--bgs-ivory-rgb),.18);transition:background-color .25s ease;}
.rv-pips i.on{background:var(--bgs-gold);}
.rv-num{font:400 10.5px/1 'IBM Plex Mono',monospace;color:var(--bgs-ivory-45);text-align:center;margin-top:7px;}
.rv-mini.win{transform:translateY(-9px) scale(1.13);}
.rv-mini.win .c{box-shadow:0 0 0 2px var(--bgs-gold),0 0 26px rgba(var(--bgs-gold-rgb),.3);}
.rv-minis.decided .rv-mini:not(.win){opacity:.36;}

.rv-crown{display:none;position:relative;justify-content:center;gap:16px;}
.rv-stage.done{min-height:0;}
.rv-stage.done .rv-seats,.rv-stage.done .rv-minis{display:none;}
.rv-stage.done .rv-crown{display:flex;}
.rv-cover{position:relative;width:236px;aspect-ratio:3/4;border-radius:14px;overflow:hidden;background:var(--bgs-plate);
  border:1px solid rgba(var(--bgs-gold-rgb),.3);box-shadow:0 0 44px rgba(var(--bgs-gold-rgb),.28),0 18px 34px -10px rgba(0,0,0,.55);}
.rv-crown.duo .rv-cover{width:150px;}
.rv-crown.trio .rv-cover{width:104px;}
.rv-cover img{width:100%;height:100%;object-fit:cover;display:block;}
@keyframes rv-crown{0%{transform:scale(.5) rotate(-12deg);opacity:0;}55%{transform:scale(1.08) rotate(1.5deg);opacity:1;}75%{transform:scale(.98) rotate(-1deg);}100%{transform:none;opacity:1;}}
@keyframes rv-flash{0%{opacity:0;transform:translate(-50%,-50%) scale(.3);}25%{opacity:.9;}100%{opacity:0;transform:translate(-50%,-50%) scale(1.7);}}
@keyframes rv-rise{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:none;}}
.rv-stage.done.play .rv-cover{animation:rv-crown .75s cubic-bezier(.2,.9,.25,1) both;}
.rv-stage.done.play .rv-cover:nth-child(3){animation-delay:.12s;}
.rv-flash{position:absolute;left:50%;top:50%;width:150%;aspect-ratio:1;border-radius:50%;pointer-events:none;opacity:0;z-index:-1;
  background:radial-gradient(closest-side,rgba(var(--bgs-gold-rgb),.75),rgba(var(--bgs-gold-rgb),.15) 55%,transparent 72%);}
.rv-stage.done.play.solo .rv-flash{animation:rv-flash 1s ease-out both;}
.rv-burst{position:absolute;left:50%;top:50%;width:0;height:0;pointer-events:none;z-index:3;}
.rv-burst i{position:absolute;left:-4px;top:-6px;width:8px;height:12px;border-radius:2px;opacity:0;}
h1.rv-swap{animation:rv-rise .35s ease both;}
.winner-meta .rv-seats{margin:14px auto 0;}
```

And extend the existing reduced-motion block. **Before:**

```css
  @media (prefers-reduced-motion:reduce){
    .flip{animation:none;}
    .flip-inner{transition:none;}
    .face.cover{transition:none;}
    .winner-meta,.rest,.actions,.result-row{transition:none;}
    .req-dot{animation:none;}
  }
```

**After:**

```css
  @media (prefers-reduced-motion:reduce){
    .flip{animation:none;}
    .flip-inner{transition:none;}
    .face.cover{transition:none;}
    .winner-meta,.rest,.actions,.result-row{transition:none;}
    .req-dot{animation:none;}
    .rv-mini,.rv-mini .c,.rv-chip,.rv-pips i{transition:none;}
    .rv-cover,.rv-flash,h1.rv-swap{animation:none;}
  }
```

Note the existing `h1` rule carries `transition:opacity .3s ease`. `rv-swap` animates `opacity` on that same element, which is exactly the WebKit trap. With the flag on, render the headline as `<h1 id="headline" style="transition:none">` so only the animation owns it.

### 2c. Markup in `render()`

**Before** (inside the `screen.innerHTML` template):

```js
      <h1 id="headline">And the table says…</h1>
      <div class="reveal" id="reveal">
        ${revealCards.map((r) => `
          <div class="flip ${tie ? 'duo' : 'solo'}">
            …
          </div>`).join('')}
      </div>
```

**After:** build the stage in a helper and branch on the flag. The old block stays as the `else`.

```js
  // Layout maths for the minis (see the spec's layout constants).
  const mw = deck.length <= 5 ? 56 : deck.length <= 8 ? 50 : 44;
  const miniRows = Math.ceil(deck.length / 5);
  const perRow = Math.ceil(deck.length / miniRows);
  const minisW = perRow * mw + (perRow - 1) * 10;
  const pip = Math.min(5, Math.floor((mw - (total - 1) * 2) / total));
  const usePips = pip >= 3;

  function stageHTML() {
    const crownClass = winners.length === 2 ? 'duo' : winners.length > 2 ? 'trio' : '';
    return `
      <div class="rv-stage skippable ${tie ? '' : 'solo'}" id="stage">
        <div class="rv-seats" id="seats">
          ${participants.map((n, i) => `
            <span class="rv-seat ${n === myName ? 'me' : ''}" data-seat="${i}" title="${n}">${Array.from(n)[0] || '?'}<span class="rv-chip"></span></span>`).join('')}
        </div>
        <div class="rv-minis" id="minis" style="--mw:${mw}px;--pip:${pip}px;max-width:${minisW}px">
          ${deck.map((g) => rows.find((r) => r.game.bggId === g.bggId)).map((r) => `
            <div class="rv-mini" data-mini="${r.game.bggId}">
              <div class="c"><img src="${r.game.image}" alt=""></div>
              ${usePips ? `<div class="rv-pips">${'<i></i>'.repeat(total)}</div>` : `<div class="rv-num">0</div>`}
            </div>`).join('')}
        </div>
        <div class="rv-crown ${crownClass}" id="crown">
          <div class="rv-flash"></div>
          ${winners.slice(0, 3).map((r) => `
            <div class="rv-cover">
              <button class="info-btn" data-info="${r.game.bggId}" aria-label="About ${r.game.title}">i</button>
              <img src="${r.game.image}" alt="${r.game.title} cover">
            </div>`).join('')}
          <div class="rv-burst" id="burst"></div>
        </div>
      </div>`;
  }
```

The minis render in **deck order** (`deck.map`, looked up in `rows` by `bggId`), not ranking order, so the row does not give the result away before the count. Seats are addressed by **index** (`data-seat`), never by name: names are user-typed and can contain quotes.

Template becomes:

```js
      ${countRevealOn
        ? `<h1 id="headline" style="transition:none">Votes are sealed</h1>${stageHTML()}`
        : `<h1 id="headline">And the table says…</h1>
           <div class="reveal" id="reveal">…existing block unchanged…</div>`}
```

The existing `[data-info]` wiring already picks up the crown's info buttons.

### 2d. Final state

Add inside `runResults`, next to `render()`:

```js
  const REVEAL_KEY = `gamenight:${code}:revealed:${session.round}`;
  const finalHeadline = nobody ? "Nobody's feeling it tonight" : tie ? "It's a tie" : 'Tonight we play';
  const seatChip = (i) => screen.querySelector(`.rv-seat[data-seat="${i}"] .rv-chip`);
  const setChip = (i, kind) => {
    const c = seatChip(i); if (!c) return;
    c.className = `rv-chip show ${kind}`;
    c.textContent = { ok: '✓', play: '✓', pass: '✕', novote: '–' }[kind];
  };
  const miniOf = (r) => screen.querySelector(`.rv-mini[data-mini="${r.game.bggId}"]`);
  const unfinished = (n) => rows.some((r) => r.noVote.includes(n));
  let revealFinished = false;

  function finishReveal(animated) {
    if (revealFinished) return;
    revealFinished = true;
    timers.forEach(clearTimeout); timers = [];
    try { sessionStorage.setItem(REVEAL_KEY, '1'); } catch (e) {}
    const stage = document.getElementById('stage');
    stage.classList.remove('skippable');
    document.getElementById('headline').textContent = finalHeadline;

    // every pip in its final state, whatever the count had reached
    rows.forEach((r) => {
      const m = miniOf(r);
      if (usePips) m.querySelectorAll('.rv-pips i').forEach((p, k) => p.classList.toggle('on', k < r.play.length));
      else m.querySelector('.rv-num').textContent = r.play.length;
    });

    if (nobody) {
      document.getElementById('minis').classList.add('decided');
    } else {
      stage.classList.add('done');
      if (animated) stage.classList.add('play');
      setCoverLight(tie ? null : winners[0].game.image);
      if (animated && !tie) { confetti(); buzz([18, 40, 30]); }          // commit 3 adds these two
      if (!tie) {
        // the seats move under the pill and turn over each person's vote on the winner
        document.getElementById('winnerMeta').appendChild(document.getElementById('seats'));
        const w = winners[0];
        participants.forEach((n, i) => {
          const kind = w.play.includes(n) ? 'play' : w.pass.includes(n) ? 'pass' : 'novote';
          seatChip(i).className = 'rv-chip';
          timers.push(setTimeout(() => setChip(i, kind), animated ? 650 + i * 130 : 0));
        });
      }
    }
    const d = animated ? [500, 1300, 1700] : [0, 0, 0];
    timers.push(setTimeout(() => document.getElementById('winnerMeta').classList.add('show'), d[0]));
    timers.push(setTimeout(() => document.getElementById('rest').classList.add('show'), d[1]));
    timers.push(setTimeout(() => document.getElementById('actions').classList.add('show'), d[2]));
  }
```

In this commit, stub `confetti` and `buzz` as no-ops and replace the old timer block like so. **Before:**

```js
    // tease → flip → title + count → ranking → actions
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = reduced ? [0, 0, 0, 0] : [1100, 1750, 2350, 2750];
    timers.push(setTimeout(() => { … }, t[0]));
    …
```

**After:**

```js
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (countRevealOn) {
      // sealed phase: a tick for everyone who finished, a dash for anyone "Show results now" cut off
      participants.forEach((n, i) => setChip(i, unfinished(n) ? 'novote' : 'ok'));
      finishReveal(false);                       // commit 3 replaces this line with the timeline
    } else {
      // tease → flip → title + count → ranking → actions   (existing code, unchanged)
      …
    }
```

The tie case hides the seats (they live inside `.rv-stage`, which hides them once `.done`). The existing "tap the pill to see names" still works for both winner and tie.

**Commit message:** `feat(gamenight): count-reveal result layout behind ?reveal=1 (static final state)`

Stop for review. At this point `?reveal=1` should show: headline, large winner cover, title, pill, seats with gold ✓ / ✕ / dash under the pill, ranking, actions, and the screen washed in the winner's colour.

---

## Commit 3: the count timeline

Replace `finishReveal(false);` from commit 2 with:

```js
      let seen = false;
      try { seen = sessionStorage.getItem(REVEAL_KEY) === '1'; } catch (e) {}
      if (seen || reduced) { finishReveal(false); }
      else { runCount(); }
```

and add:

```js
  function say(text) {
    const h = document.getElementById('headline');
    h.textContent = text;
    h.classList.remove('rv-swap'); void h.offsetWidth; h.classList.add('rv-swap');
  }

  function runCount() {
    const stage = document.getElementById('stage');
    // tap anywhere on the count to skip it
    stage.addEventListener('click', () => { if (!revealFinished) finishReveal(false); });

    let t = 0;
    const at = (ms, f) => { t += ms; timers.push(setTimeout(f, t)); };

    at(900, () => say('Counting the votes'));
    const totalPlays = rows.reduce((a, r) => a + r.play.length, 0);
    const step = Math.max(40, Math.min(110, Math.round(1500 / Math.max(totalPlays, 1))));
    const deckRows = deck.map((g) => rows.find((r) => r.game.bggId === g.bggId));   // count in deck order
    for (let k = 0; k < total; k++) {
      deckRows.forEach((r) => {
        if (k >= r.play.length) return;
        at(step, () => {
          const m = miniOf(r);
          if (usePips) m.querySelectorAll('.rv-pips i')[k].classList.add('on');
          else m.querySelector('.rv-num').textContent = k + 1;
        });
      });
    }
    if (!totalPlays) at(1100, () => {});

    at(450, () => {
      say(nobody ? finalHeadline : tie ? "It's a tie" : 'The table has decided');
      document.getElementById('minis').classList.add('decided');
      winners.forEach((r) => miniOf(r).classList.add('win'));
      if (!nobody && !tie) setCoverLight(winners[0].game.image);
      buzz(8);
    });
    at(nobody ? 300 : 950, () => finishReveal(true));
  }

  function buzz(pattern) { try { navigator.vibrate && navigator.vibrate(pattern); } catch (e) {} }

  function confetti() {
    const host = document.getElementById('burst');
    if (!host) return;
    host.innerHTML = '';
    const cols = ['var(--bgs-gold)', 'var(--bgs-vote-play)', 'var(--bgs-vote-pass)', 'var(--bgs-ivory)', 'var(--bgs-gold)'];
    for (let n = 0; n < 34; n++) {
      const el = document.createElement('i');
      el.style.background = cols[n % 5];
      host.appendChild(el);
      const ang = Math.random() * Math.PI * 2, dist = 100 + Math.random() * 160;
      const x = Math.cos(ang) * dist, y = Math.sin(ang) * dist - 60;
      el.animate([
        { transform: 'translate(0,0) rotate(0) scale(.4)', opacity: 1 },
        { transform: `translate(${x}px,${y}px) rotate(${Math.random() * 540 - 270}deg) scale(1)`, opacity: 1, offset: .6 },
        { transform: `translate(${x * 1.1}px,${y + 120}px) rotate(${Math.random() * 720 - 360}deg) scale(.9)`, opacity: 0 },
      ], { duration: 1100 + Math.random() * 700, easing: 'cubic-bezier(.15,.8,.3,1)', fill: 'forwards' }).onfinish = () => el.remove();
    }
  }
```

The confetti pieces are created fresh and carry no transition, so animating them is safe under the WebKit rule.

Also make sure the two existing `onStatus` branches (rematch → `voting`, `cancelled`) still run `timers.forEach(clearTimeout)` before navigating, as they do today; nothing else is needed because every reveal timeout is in `timers`. When leaving for a rematch call `setCoverLight(null)` first so the wash does not flash on the way out.

**Commit message:** `feat(gamenight): count the votes, then crown the winner (results reveal timeline)`

Stop for review.

---

## Deliberate deviations from the mockup

- The mockup fabricates votes and participant names and has a demo bar; production uses `tally()` output untouched.
- The mockup addresses seats by name; production uses the participant index (names can contain quotes).
- The mockup's crown info button is inert; production keeps `data-info` so the existing modal wiring works.
- The mockup inlines `base.css` and a static `.cover-light` element; production uses `initCoverLight()`.
- The mockup's "Seen already" toggle stands in for the `sessionStorage` key.
- The mockup renders minis from its own deck array; production renders them in deck order from `deck`, looked up in `rows`.

## Verification checklist

- [ ] Flag off: results page is identical to today (wiggle, flip, 196px card, "Tonight's game")
- [ ] Commit 1: swipe screen wash unchanged in every respect
- [ ] `?reveal=1`, single winner: sealed → count → decided → crown with flash and confetti → seats turn over one by one → ranking → actions; about 4.3 s to the winner with 5 voters
- [ ] Minis are in deck order, not ranking order
- [ ] Count duration stays near 1.5 s with 2 voters × 2 games and with 8 voters × 10 games
- [ ] 6 games wrap 3+3, 10 games wrap 5+5; pips never overflow the mini; numbers replace pips when a pip would be under 3px
- [ ] Tie (2 and 3 games): tied minis lift together, covers side by side, no flash, no confetti, no light, no seats, rematch actions and "wants a rematch" line work, presence updates do not restart the reveal
- [ ] Nobody: nothing lifts, all minis dim, no crown, existing "Everyone passed on everything." copy
- [ ] Host forced results: unfinished voters show a dash in the sealed phase and a dash on the winner if they never voted on it; pill still reads "N of T" and rows still show "· 1 no vote"
- [ ] Tap during the count jumps to the final state; tapping the winner's info button opens the game modal
- [ ] Refresh and back-navigation land on the final state with no count and no confetti; a rematch round (new `round`) plays the count again
- [ ] Rematch started mid-count: timers clear, light fades, everyone lands on the swipe screen
- [ ] Reduced motion: final state immediately, no crown animation, no flash, no confetti; light still on
- [ ] iOS Safari on a real phone: headline swaps animate, minis lift smoothly, chips pop, crown pops. If any of these snaps instead of moving, an element has both an animation and a transition on one property
- [ ] Walnut, Navy, Mahogany, Oak: veil fades to each theme's own background; gold ring and chips read on all four
- [ ] Thai and emoji participant names give a sensible first character; a name with a quote in it breaks nothing
- [ ] No new network requests beyond the cover images the page already loads

## After verification (separate task)

Flip `COUNT_REVEAL_ENABLED` to `true`, then delete the `.reveal` / `.flip` / `.face` CSS, the `tease` keyframes and the flip branch of `render()`.

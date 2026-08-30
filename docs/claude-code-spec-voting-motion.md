# Spec: Voting screen — card promotion, exit continuity, gold tally reward, meta icons

**Design source of truth:** `docs/mockups/swipe-motion-v2.html` (copy the attached mockup here before starting). Open it in Safari *and* Chrome and swipe a few cards before reading further — the spec describes what you just saw.

**Scope:** Game Night Stage 3 voting screen only. No backend / RPC changes. No changes to vote submission logic.

---

## 0. Locate first — do not assume identifiers

Before editing, find the real names in the codebase and substitute them for the mockup's names throughout this spec:

```bash
grep -rn "pointerdown\|touchstart" --include=*.js --include=*.html . | grep -vi node_modules | head
grep -rn "deck\|swipe" css/*.css | head -40
grep -rn "PLAY\|PASS" --include=*.html --include=*.js . | grep -i stamp | head
```

Map the mockup's names to production before writing any code:

| Mockup | Production (fill in) |
|---|---|
| `.deck` | |
| `.deck-card` (outer, depth transform) | |
| `.card-body` (inner, drag/exit transform) | |
| `.cover` | |
| `.meta` / `.meta h2` | |
| `.wash` (blackwash overlay) | |
| `.stamp.play` / `.stamp.pass` | |
| `#tally` (count chip) | |
| drag handler function | |
| vote commit function | |

If production has **one** element carrying both the depth transform and the drag transform, split it into outer + inner first (see §1). This is mandatory — see Hard Constraint below.

---

## Hard constraint (project rule)

Never put a CSS `animation` and a CSS `transition` on the same property of the same element. WebKit silently drops the transition; Chrome hides the bug. This spec keeps them apart by design:

- **Outer card** — depth `transform` via CSS *transition* only.
- **Cover** — `filter` via CSS *transition* only.
- **Inner card** — drag `transform` set inline; exit via **Web Animations API** (`element.animate`), never CSS.
- **Stamp** — `@keyframes` only, no transition.
- **Tally number** — `transition` only.

---

## 1. Card promotion: rise + come into focus

### 1a. Structure

Each card in the stack needs two layers:

```html
<div class="deck-card" data-depth="0" style="--d:0">   <!-- outer: depth only -->
  <div class="card-body">                               <!-- inner: drag + exit -->
    <div class="cover" style="--art:url(…)"></div>
    <div class="wash"></div>
    <div class="stamp play">PLAY</div>
    <div class="stamp pass">PASS</div>
    <div class="meta">…</div>
  </div>
</div>
```

### 1b. CSS

```css
:root { --dur: .32s; }

.deck-card {
  position: absolute; inset: 0;
  transform: translateY(calc(var(--d) * 12px)) scale(calc(1 - var(--d) * .08));
  transition: transform var(--dur) cubic-bezier(.2,.8,.2,1);
  z-index: calc(10 - var(--d));
  will-change: transform;
}
.deck-card[data-depth="3"] { opacity: 0; }        /* preloaded, invisible */

.cover { transition: filter var(--dur) ease-out; }
.deck-card[data-depth="1"] .cover { filter: blur(3px); }
.deck-card[data-depth="2"] .cover { filter: blur(6px); }

/* meta only readable on the front card; fades in one beat after promotion */
.deck-card:not([data-depth="0"]) .meta { opacity: 0; }
.deck-card[data-depth="0"] .meta { opacity: 1; transition: opacity .18s ease-out .1s; }

.dragging .deck-card[data-depth="0"] { transition: none; }
```

Keep **four** cards mounted (depths 0–3) so promotion never shows an empty slot. Depth 3 is invisible and pre-blurred-free; it only exists to be ready.

### 1c. Promotion timing (JS)

Promotion must start **at the same moment** the front card starts leaving — not on `onfinish`. In the vote commit function:

```js
front.dataset.depth = 'x';           // take it out of the stack
front.style.zIndex = 20;             // keep it above while flying out
relayout(excluding = front);         // reassign depth 0..3 → triggers CSS transitions
// …start exit animation (see §2)…
exit.onfinish = () => { front.remove(); mountNextIfNeeded(); bindDrag(); };
```

`relayout` sets both `data-depth` and `--d` on every remaining card.

---

## 2. Exit continuity: no pause between release and fly-out

Current bug: the card stops at the release point, then accelerates away. Three causes, three fixes.

### 2a. Track drag position and velocity

```js
// pointerdown
drag = { x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, vx: 0, t: performance.now() };

// pointermove
const now = performance.now(), ndx = e.clientX - drag.x0;
drag.vx = (ndx - drag.dx) / Math.max(now - drag.t, 1);   // px per ms
drag.t = now;
drag.dx = ndx;
drag.dy = (e.clientY - drag.y0) * .4;
body.style.transform = `translate(${drag.dx}px, ${drag.dy}px) rotate(${drag.dx * .06}deg)`;
```

### 2b. Commit threshold — distance OR flick

```js
if (Math.abs(d.dx) > 90 || Math.abs(d.vx) > .8) vote(d.dx > 0 ? 'play' : 'pass', d);
else snapBack(body);
```

`snapBack`: inline `transition: transform .35s cubic-bezier(.34,1.56,.64,1)`, clear transform, wash opacity 0, stamps opacity 0 + transform cleared, remove the inline transition on `transitionend`.

### 2c. Exit animation — continue from the release pose

```js
function vote(kind, d /* drag state or undefined for button taps */) {
  const dir = kind === 'play' ? 1 : -1;
  const dx = d ? d.dx : 0, dy = d ? d.dy : 0;
  const rm = reducedMotion();                        // §5
  const from = `translate(${dx}px, ${dy}px) rotate(${dx * .06}deg)`;
  const to   = `translate(${dir * 620}px, ${dy - 40}px) rotate(${dir * (Math.abs(dx * .06) + 14)}deg)`;

  const exit = body.animate([{ transform: from }, { transform: to }], {
    duration: rm ? 1 : 340,                          // FIXED 340ms — do not scale by velocity
    easing: d ? 'cubic-bezier(.25,.6,.5,1)'          // moving start for a released drag
               : 'cubic-bezier(.4,0,.8,1)',          // ease-in for button taps (starts from rest)
    fill: 'forwards',
    // NO delay
  });
  …
}
```

Do not add a delay before the exit. Do not reset rotation to 0 at release. Duration is fixed at 340ms — an earlier velocity-scaled version was rejected as too fast.

### 2d. Guard

`busy = true` from vote start until `exit.onfinish`; drag and buttons ignore input while busy.

---

## 3. Swipe feedback: blackwash + stamp (keep production behaviour, tighten stamp)

Production already shows a blackwash and a PLAY/PASS stamp during drag. Keep that. Change only:

### 3a. Wash

```css
.wash { position:absolute; inset:0; background: rgba(20,18,15,.55); opacity:0; pointer-events:none; }
```
During drag: `wash.style.opacity = p` where `p = min(|dx| / 110, 1)`. On commit: `1`.

### 3b. Stamp — tighter outline

```css
.stamp {
  position: absolute; top: 26px;
  font-family: "IBM Plex Mono", monospace; font-weight: 500;
  font-size: 20px; line-height: 1; letter-spacing: .12em;
  padding: 6px 10px 6px 12px;        /* right pad trimmed to offset trailing tracking */
  border: 2px solid currentColor;    /* was 3px */
  border-radius: 6px;
  background: rgba(20,18,15,.6);     /* contrast plate — see §4 */
  opacity: 0; pointer-events: none; transform-origin: center;
}
.stamp.play { left: 22px;  color: var(--bgs-vote-play); transform: rotate(-12deg) scale(1.4); }
.stamp.pass { right: 22px; color: var(--bgs-vote-pass); transform: rotate(12deg)  scale(1.4); }
.stamp.commit { animation: stampIn .22s cubic-bezier(.2,1.4,.4,1) forwards; }
@keyframes stampIn { to { transform: rotate(var(--r)) scale(1); opacity: 1; } }
```
Set `style="--r:-12deg"` on `.stamp.play`, `--r:12deg` on `.stamp.pass`.

During drag, the active stamp tracks progress: `opacity = p`, `transform = rotate(±12deg) scale(1.4 - .4p)`; the other stamp is forced to `opacity: 0`. On commit, clear the inline transform and add `.commit`.

If production's font/size differ, keep the *ratios*: stroke ≈ 10% of cap height, horizontal padding ≈ 0.5em, radius ≈ 0.3em.

---

## 4. Reward: gold tally roll + pulse (no ripple, no confetti)

The count chip in the header is the emotional reward. Gold, not semantic colour — it signals progress, while sage/clay on the stamp signal the vote.

```html
<div class="tally" id="tally" aria-live="polite" aria-atomic="true">
  <span class="roll"><span id="rollNum">1</span></span><span>&nbsp;/ 24</span>
</div>
```

```css
.tally { …existing chip styles…; transition: background var(--dur), border-color var(--dur), color var(--dur); }
.tally .roll { display:inline-block; height:1.2em; line-height:1.2em; overflow:hidden; vertical-align:top; }
.tally .roll span { display:block; transition: transform .34s cubic-bezier(.2,.8,.2,1); }
.tally.pulse { background: rgba(217,180,90,.18); border-color: var(--bgs-gold); color: var(--bgs-gold); }
```

```js
function rewardTally(nextCount) {
  tally.classList.remove('pulse'); void tally.offsetWidth;
  tally.classList.add('pulse'); setTimeout(() => tally.classList.remove('pulse'), 420);
  rollNum.style.transition = 'none';
  rollNum.style.transform = 'translateY(100%)';
  rollNum.textContent = nextCount;
  void rollNum.offsetWidth;
  rollNum.style.transition = ''; rollNum.style.transform = '';
}
```
Call `rewardTally(index + 1)` inside `vote()` at the same time the exit starts. Remove any ripple / particle code if present from earlier experiments.

---

## 5. Meta row with icons

Replace the dot-separated string with three labelled items:

```html
<div class="meta">
  <h2>{title}</h2>
  <ul>
    <li><svg …people…  aria-hidden="true"/><span class="sr">Players</span>{minPlayers}–{maxPlayers}</li>
    <li><svg …clock…   aria-hidden="true"/><span class="sr">Play time</span>{playingTime} min</li>
    <li><svg …scale…   aria-hidden="true"/><span class="sr">Weight</span>{weight}</li>
  </ul>
</div>
```

Copy the three SVG paths verbatim from the mockup (`viewBox="0 0 24 24"`, stroke-based).

```css
.meta ul { margin:0; padding:0; list-style:none; display:flex; gap:14px;
           font-family:"IBM Plex Mono",monospace; font-size:12px; color:var(--bgs-ivory-70); }
.meta li  { display:inline-flex; align-items:center; gap:5px; }
.meta svg { width:14px; height:14px; flex:none; stroke:currentColor; fill:none;
            stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; opacity:.85; }
.meta h2, .meta li { text-shadow: 0 1px 2px rgba(0,0,0,.6); }
.sr { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }
```

Use the existing `games.json` fields for players / time / weight; if weight is stored as a float, render to one decimal.

---

## 6. Accessibility

- **Text on card:** bottom scrim (`rgba(20,18,15,.92)` at 100%) over the lightest cover art resolves to ≈ `#222220`. Ivory title = 13.4:1, ivory-70 meta = 7.3:1. Keep the scrim start ≤ 40% so the meta row always sits on the ≥ 90% region. Text-shadow is belt-and-braces, not the contrast source.
- **Stamp:** clay outline on blackwashed light art is only 1.8:1 without a plate; the `rgba(20,18,15,.6)` background lifts it above the 3:1 non-text minimum. Do not remove it.
- **Tally:** `aria-live="polite"` so the count is announced after each vote. Gold on chip base ≈ 8.6:1.
- **Icons:** `aria-hidden` + visually-hidden text label per item.
- **Reduced motion:**
  ```css
  @media (prefers-reduced-motion: reduce) {
    .deck-card, .cover, .tally .roll span { transition: none !important; }
    .stamp.commit { animation-duration: .01s !important; }
  }
  ```
  and in JS `duration: 1` for the exit when `matchMedia('(prefers-reduced-motion: reduce)').matches`. Result: instant swap, static stamp, count updates without rolling.
- **Keyboard:** ← = pass, → = play on the front card (already in mockup). Buttons keep `aria-label` and focus ring `outline: 2px solid var(--bgs-gold); outline-offset: 3px`.
- `touch-action: none` on the deck so vertical page scroll doesn't fight the horizontal drag.

---

## 7. Verification checklist

Test in **Safari iOS/macOS first**, then Chrome.

- [ ] Swipe slowly and release just past threshold → card keeps moving, no visible stop.
- [ ] Fast flick under 90px → counts as a vote.
- [ ] Release under threshold with no flick → springs back, stamps/wash clear.
- [ ] Back card rises + sharpens *while* the front leaves, not after.
- [ ] Never an empty slot: 4 cards mounted, depth 3 invisible.
- [ ] Meta text hidden on blurred cards, fades in ~100ms after promotion.
- [ ] Stamp: 2px stroke, proportional padding, plate behind it, snaps to scale 1 on commit.
- [ ] Tally rolls and pulses gold, never sage/clay.
- [ ] No ripple, no particles anywhere.
- [ ] Tapping Play/Pass buttons uses ease-in exit from rest.
- [ ] Repeated rapid inputs while a card is exiting are ignored (`busy`).
- [ ] `prefers-reduced-motion`: instant swap, no roll, no stamp animation.
- [ ] VoiceOver reads "Players 2–4, Play time 120 min, Weight 3.9" and announces the count.
- [ ] Vote still submits via `submit_vote` exactly once per card (idempotent PK unchanged).
- [ ] Inspect in Safari devtools: no element has both `animation` and `transition` on `transform` or `filter`.

---

## Commit

```
feat(vote): continuous swipe exit, focus-promote stack, gold tally reward, meta icons

- split card into depth (outer) / drag (inner) layers per WebKit rule
- promote back card in sync with exit; blur 3px→0 on cover
- exit continues from release pose at fixed 340ms, flick-to-vote
- tighten stamp outline, add contrast plate
- gold tally roll + pulse, aria-live
- players / time / weight icons with SR labels
```

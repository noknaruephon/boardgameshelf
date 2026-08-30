# Game Night: "Tonight's surprise" → lock & re-roll bottom sheet

**Scope:** one change — the random-path picker dialog in `index.html`. No changes to the confirm step, session RPCs, or `games.json`.
**Design source of truth:** `docs/mockups/tonights-surprise-mockup.html`, **Option 2** tab. Copy the mockup into `docs/mockups/` in this PR.

## Why

The current modal (`#gnSurpriseBackdrop`) has three problems visible on a phone:

1. Title clamp leaks a third line ("Alien o… Board") because `.gn-surprise-card .t` puts padding inside the clamped box.
2. "Shuffle again" discards good picks along with bad ones.
3. Covers alone don't say whether a game fits tonight (players, time).

This change: bottom sheet, lockable cards, per-card swap, re-roll only unlocked slots, players/time meta line. Count stays fixed at `GN_SURPRISE_COUNT`. Continue and Cancel keep their current names and roles.

## Behaviour

- **Keep:** tapping a card toggles `aria-pressed`. On a kept card the swap die (top-right) is replaced in place by a gold padlock badge. No border/ring highlight — the badge is the only state indicator.
- **Swap (per card):** die button top-right of an unkept card replaces just that game with one from the pool not already on the board.
- **Re-roll:** resamples only unkept slots, kept cards stay in place. Label shows how many will change: `Re-roll 4`. Disabled at 0 unkept. Unkept cards flip in a staggered wave (see §7); kept cards don't move.
- **Continue:** unchanged → `openConfirm()`.
- **Cancel:** unchanged text link → back to selection mode. Scrim tap and Esc do the same.
- **Meta line** under each title: `playersRangeLabel(g.players) · timeLabel(g.time)` (same helpers the tray uses).
- Subtitle becomes static copy: "Tap a game to keep it. Re-roll swaps the rest."

## Changes

### 1. State

```js
// before
const gnState = { mode: null, surprisePool: [], revealDeck: false };

// after
const gnState = { mode: null, surprisePool: [], kept: new Set(), revealDeck: false };
```

`kept` holds `bggId`s. Clear it wherever `surprisePool` is cleared (Cancel handler, and on Random FAB entry).

### 2. Sampling

```js
// before
function sampleSurprise(){
  const pool = gnPool();
  gnState.surprisePool = sampleN(pool, Math.min(GN_SURPRISE_COUNT, pool.length));
}

// after — fill only unkept slots, preserving positions of kept cards
function sampleSurprise(){
  const pool = gnPool();
  const target = Math.min(GN_SURPRISE_COUNT, pool.length);
  const keptIds = gnState.kept;
  const keptCount = gnState.surprisePool.filter(g => keptIds.has(g.bggId)).length;
  const fresh = sampleN(pool.filter(g => !keptIds.has(g.bggId)), target - keptCount);
  const next = [];
  let f = 0;
  for(const g of gnState.surprisePool){
    if(keptIds.has(g.bggId)) next.push(g);
    else if(f < fresh.length) next.push(fresh[f++]);
  }
  while(f < fresh.length) next.push(fresh[f++]);
  gnState.surprisePool = next.slice(0, target);
}

function swapSurpriseAt(index){
  const onBoard = new Set(gnState.surprisePool.map(g => g.bggId));
  const [pick] = sampleN(gnPool().filter(g => !onBoard.has(g.bggId)), 1);
  if(!pick) return; // pool exhausted — leave the card
  gnState.surprisePool[index] = pick;
}
```

First open: `surprisePool` is empty and `kept` is empty, so this degrades to today's behaviour. Pool-too-small is already guarded by `GN_MIN_POOL` at the FAB.

### 3. Markup (in the `insertAdjacentHTML` block)

```html
<!-- before -->
<div class="gn-backdrop" id="gnSurpriseBackdrop">
  <div class="gn-panel" role="dialog" aria-modal="true" aria-labelledby="gnSurpriseTitle">
    <h3 id="gnSurpriseTitle">Tonight's surprise</h3>
    <p class="gn-sub" id="gnSurpriseSub"></p>
    <div class="gn-surprise-grid" id="gnSurpriseGrid"></div>
    <div class="gn-row">
      <button class="gn-secondary-btn" id="gnShuffleBtn" type="button">Shuffle again</button>
      <button class="gn-primary-btn" id="gnSurpriseContinue" type="button">Continue</button>
    </div>
    <button class="gn-cancel-link" id="gnSurpriseCancel" type="button">Cancel</button>
  </div>
</div>

<!-- after -->
<div class="gn-backdrop gn-backdrop--sheet" id="gnSurpriseBackdrop">
  <div class="gn-panel gn-sheet" role="dialog" aria-modal="true" aria-labelledby="gnSurpriseTitle">
    <div class="gn-sheet__grab" aria-hidden="true"></div>
    <h3 id="gnSurpriseTitle">Tonight's surprise</h3>
    <p class="gn-sub">Tap a game to keep it. Re-roll swaps the rest.</p>
    <div class="gn-surprise-grid" id="gnSurpriseGrid"></div>
    <div class="gn-row">
      <button class="gn-secondary-btn" id="gnRerollBtn" type="button">${GN_ROLL_SVG} Re-roll <span id="gnRerollN"></span></button>
      <button class="gn-primary-btn" id="gnSurpriseContinue" type="button">Continue</button>
    </div>
    <button class="gn-cancel-link" id="gnSurpriseCancel" type="button">Cancel</button>
  </div>
</div>
```

`#gnShuffleBtn` → `#gnRerollBtn`. `#gnSurpriseSub` id no longer needed (static copy). Reuse `GN_ROLL_SVG` for re-roll/swap. Add a new padlock icon next to the other SVG constants:

```js
const GN_LOCK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
```

### 4. Render

```js
function renderSurprise(){
  const grid = document.getElementById('gnSurpriseGrid');
  grid.innerHTML = gnState.surprisePool.map((g, i) => {
    const kept = gnState.kept.has(g.bggId);
    return `
      <div class="gn-surprise-flip" data-index="${i}">
      <div class="gn-surprise-card" role="button" tabindex="0" aria-pressed="${kept}" data-index="${i}" data-id="${g.bggId}">
        <div class="art"><img src="${g.image}" alt="" loading="lazy" onerror="this.remove()"></div>
        <div class="meta">
          <div class="t">${g.title}</div>
          <div class="s">${playersRangeLabel(g.players)} · ${timeLabel(g.time)}</div>
        </div>
        <span class="lock" aria-hidden="true">${GN_LOCK_SVG}</span>
        <button class="swap" type="button" data-swap="${i}" aria-label="Swap ${g.title}" ${kept ? 'hidden' : ''}>${GN_ROLL_SVG}</button>
        <span class="sr-only">${kept ? 'Kept' : 'Not kept'}: ${g.title}</span>
      </div>
      </div>`;
  }).join('');
  updateSurpriseControls();
}

function updateSurpriseControls(){
  const total = gnState.surprisePool.length;
  const kept = gnState.surprisePool.filter(g => gnState.kept.has(g.bggId)).length;
  const loose = total - kept;
  document.getElementById('gnRerollN').textContent = loose;
  document.getElementById('gnRerollBtn').disabled = loose === 0;
}
```

### 5. Handlers

Replace the surprise-view block in `initGameNight()`:

```js
const grid = document.getElementById('gnSurpriseGrid');
function toggleKept(id){
  gnState.kept.has(id) ? gnState.kept.delete(id) : gnState.kept.add(id);
  renderSurprise();
}
grid.addEventListener('click', e => {
  const swap = e.target.closest('[data-swap]');
  if(swap){
    e.stopPropagation();
    const i = Number(swap.dataset.swap);
    rollSurpriseCards([i], () => swapSurpriseAt(i));
    return;
  }
  const card = e.target.closest('.gn-surprise-card');
  if(card) toggleKept(card.dataset.id);
});
grid.addEventListener('keydown', e => {
  const card = e.target.closest('.gn-surprise-card');
  if(!card || (e.key !== 'Enter' && e.key !== ' ')) return;
  e.preventDefault();
  toggleKept(card.dataset.id);
});

document.getElementById('gnRerollBtn').addEventListener('click', ()=>{
  const loose = gnState.surprisePool.map((g, i) => gnState.kept.has(g.bggId) ? -1 : i).filter(i => i >= 0);
  rollSurpriseCards(loose, sampleSurprise);
});
document.getElementById('gnSurpriseContinue').addEventListener('click', ()=>{
  closeGnBackdrop(document.getElementById('gnSurpriseBackdrop'));
  openConfirm();
});

function dismissSurprise(){
  closeGnBackdrop(document.getElementById('gnSurpriseBackdrop'));
  gnState.mode = 'manual';
  gnState.surprisePool = [];
  gnState.kept.clear();
}
document.getElementById('gnSurpriseCancel').addEventListener('click', dismissSurprise);
document.getElementById('gnSurpriseBackdrop').addEventListener('click', e => {
  if(e.target.id === 'gnSurpriseBackdrop') dismissSurprise();
});
document.addEventListener('keydown', e => {
  if(e.key === 'Escape' && document.getElementById('gnSurpriseBackdrop').classList.contains('open')) dismissSurprise();
});
```

Random FAB entry: add `gnState.surprisePool = []; gnState.kept.clear();` before `sampleSurprise()` so a reopen never inherits stale keeps.

`currentGnGameIds()` is unchanged — it already reads `surprisePool`.

Swipe-down to dismiss is optional; if added, pointer-track only on `.gn-sheet__grab` (not the grid), dismiss on dy > 80px, otherwise spring back. Scrim/Cancel/Esc are the guaranteed paths.

### 6. CSS

Add after the existing `.gn-panel` rules. Do **not** modify `.gn-panel` — the confirm dialog still uses it centered.

```css
/* sheet variant of the shared shell */
.gn-backdrop--sheet{align-items:flex-end;padding:0;}
.gn-sheet{
  max-width:none;max-height:88vh;
  border-radius:24px 24px 0 0;
  border-width:1px 0 0;
  padding:12px 20px calc(16px + env(safe-area-inset-bottom));
  box-shadow:0 -20px 60px rgba(0,0,0,.5);
  animation:gn-rise .34s cubic-bezier(.2,.8,.2,1);
}
@keyframes gn-rise{from{transform:translateY(24px);opacity:0}to{transform:none;opacity:1}}
.gn-sheet__grab{width:40px;height:4px;border-radius:2px;background:rgba(var(--bgs-ivory-rgb),.22);margin:0 auto 16px;}
.gn-sheet h3{font-size:24px;}

/* cards */
.gn-surprise-grid{gap:10px;margin-bottom:20px;}
.gn-surprise-card{position:relative;border-radius:12px;cursor:pointer;-webkit-tap-highlight-color:transparent;}
.gn-surprise-card:focus-visible{outline:2px solid var(--bgs-gold);outline-offset:2px;}
.gn-surprise-card .meta{padding:8px 8px 10px;}
/* clamp fix: padding moved to .meta, fixed 2-line box */
.gn-surprise-card .t{font-size:13px;line-height:1.2;padding:0;min-height:2.4em;}
.gn-surprise-card .s{margin-top:4px;font-family:'IBM Plex Mono',monospace;font-size:10.5px;color:var(--bgs-ivory-45);}
/* kept badge sits exactly where the swap button was, so the corner just changes state */
.gn-surprise-card .lock{position:absolute;top:8px;right:8px;width:32px;height:32px;border-radius:999px;background:var(--bgs-gold);color:var(--bgs-bg);display:grid;place-items:center;transform:scale(0);transition:transform .18s cubic-bezier(.2,.9,.3,1.3);}
.gn-surprise-card .lock svg{width:15px;height:15px;}
.gn-surprise-card[aria-pressed="true"] .lock{transform:scale(1);}
.gn-surprise-card .swap{position:absolute;top:8px;right:8px;width:32px;height:32px;border-radius:999px;border:1px solid rgba(255,255,255,.25);background:rgba(20,16,10,.55);backdrop-filter:blur(6px);color:var(--bgs-ivory);display:grid;place-items:center;cursor:pointer;}
.gn-surprise-card .swap svg{width:16px;height:16px;}
.gn-surprise-card .swap[hidden]{display:none;}

/* re-roll flip: animation on the wrapper only; .gn-surprise-card and .lock keep their transitions */
.gn-surprise-grid{perspective:900px;}
.gn-surprise-flip{transform-style:preserve-3d;backface-visibility:hidden;border-radius:12px;}
.gn-surprise-flip.out{animation:gn-flip-out .18s ease-in forwards;}
.gn-surprise-flip.in{animation:gn-flip-in .28s cubic-bezier(.2,.8,.2,1);}
@keyframes gn-flip-out{to{transform:rotateY(90deg);}}
@keyframes gn-flip-in{from{transform:rotateY(-90deg);}}

.gn-row .gn-secondary-btn{display:flex;align-items:center;justify-content:center;gap:6px;}
.gn-row .gn-secondary-btn svg{width:16px;height:16px;}
.gn-row .gn-primary-btn{flex:1.6;}

@media (prefers-reduced-motion:reduce){
  .gn-sheet{animation:none;}
  .gn-surprise-flip.out,.gn-surprise-flip.in{animation:none;}
  .gn-surprise-card .lock{transition:none;}
}
@media (prefers-reduced-transparency:reduce){
  .gn-surprise-card .swap{background:rgba(20,16,10,.92);backdrop-filter:none;}
}
@supports not (backdrop-filter:blur(1px)){
  .gn-surprise-card .swap{background:rgba(20,16,10,.92);}
}
@media (min-width:640px){
  .gn-sheet{max-width:520px;margin:0 auto;}
}
```

Note the `.gn-sheet` rule has an `animation` on transform/opacity and no `transition` — keep it that way (WebKit animation/transition conflict rule). The lock badge uses `transition` only, on an element the sheet animation doesn't touch.

### 7. Re-roll flip (staggered wave)

Each re-rolled card flips edge-on (0 → 90°), swaps its face while invisible, then flips back in (−90° → 0). Cards start 70 ms apart in grid order, so six cards read as a wave across the board rather than a simultaneous pop. Kept cards never animate.

```js
const GN_ROLL_STAGGER_MS = 70;
let gnRolling = false;

// indices: which slots to flip. mutate(): applies the new sample to gnState.surprisePool.
// The DOM is patched per card at the flip edge instead of re-rendering the grid, so
// kept cards keep their nodes (and focus) and don't blink.
function rollSurpriseCards(indices, mutate){
  if(gnRolling || indices.length === 0) return;
  const reduced = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  mutate();
  if(reduced){ renderSurprise(); return; }

  gnRolling = true;
  document.getElementById('gnRerollBtn').disabled = true;
  const grid = document.getElementById('gnSurpriseGrid');
  let remaining = indices.length;

  indices.forEach((i, k) => {
    const wrap = grid.querySelector(`.gn-surprise-flip[data-index="${i}"]`);
    setTimeout(() => {
      wrap.classList.add('out');
      wrap.addEventListener('animationend', () => {
        wrap.classList.remove('out');
        wrap.outerHTML = renderSurpriseCard(gnState.surprisePool[i], i); // face swap at the edge
        const fresh = grid.querySelector(`.gn-surprise-flip[data-index="${i}"]`);
        fresh.classList.add('in');
        fresh.addEventListener('animationend', () => {
          fresh.classList.remove('in');
          if(--remaining === 0){ gnRolling = false; updateSurpriseControls(); }
        }, { once:true });
      }, { once:true });
    }, k * GN_ROLL_STAGGER_MS);
  });
}
```

Refactor `renderSurprise()` so the per-card template lives in `renderSurpriseCard(g, i)` (returns the `.gn-surprise-flip` string) and `renderSurprise()` maps over it. `rollSurpriseCards` swaps the DOM node itself rather than re-rendering the grid.

Notes:
- `mutate()` runs before the animation, so `currentGnGameIds()` is correct immediately even if the user taps Continue mid-wave. `gnRolling` only guards against a second re-roll overlapping the first.
- Total duration for six cards: 5 × 70 + 180 + 280 ≈ 810 ms. Don't raise the stagger past ~90 ms or the wave starts to feel slow on a 2×3 grid.
- Reduced motion: state changes, grid re-renders, no flip.
- WebKit rule: `.gn-surprise-flip` carries the `animation` and nothing else — no `transition` on it. `.lock` keeps its `transform` transition on the card's child. Keep them on separate elements.

## Accessibility

- Kept state is `aria-pressed` on the card (`role=button`, Enter/Space). The only visual indicator is the padlock badge: dark glyph on gold ≈ 9:1; gold disc against cover art is unguaranteed, but it occupies the same slot as the swap button so the corner is always occupied by one or the other — state is read by which icon is there, not by presence alone.
- Swap button sits over arbitrary cover art, so it carries its own 55% dark scrim + 25% white hairline (~3.2:1 in the worst case). Reduced-transparency and no-`backdrop-filter` fallbacks raise the scrim to 92%.
- Re-roll button text carries the unkept count. No extra live region.
- Focus order: cards (row-major, swap buttons inline) → Re-roll → Continue → Cancel. Esc and scrim close.

## Verification

- [ ] Random FAB → sheet rises from bottom, six cards with players · time meta
- [ ] "This Game Is Killer: Alien on Board" clamps to exactly 2 lines in iOS Safari, no third-line bleed
- [ ] Tap card → swap die replaced by gold padlock in the same corner, no border change; tap again → die returns
- [ ] Re-roll label shows unkept count; kept cards stay in position and don't move after re-roll; disabled at 0 unkept
- [ ] Re-roll: unkept cards flip edge-on in a left-to-right, top-to-bottom wave (~70 ms apart), new face appears on the flip-back, in iOS Safari and Chrome
- [ ] Tapping Re-roll during a wave does nothing; Continue during a wave creates the session with the new ids
- [ ] Swap die replaces only that card, never duplicates a game already on the board
- [ ] Continue → confirm dialog; session created with exactly those 6 ids
- [ ] Cancel, scrim tap, Esc all return to selection mode: `mode='manual'`, pool and keeps cleared
- [ ] Reopen after cancel → fresh sample, no stale keeps
- [ ] Reduced-motion: no rise animation, no lock transition, re-roll swaps faces instantly
- [ ] Confirm dialog still renders centered — `.gn-panel` untouched
- [ ] VoiceOver reads "Kept: <title>" / "Not kept: <title>"

## Commit

```
feat(game-night): lock & re-roll bottom sheet for Tonight's surprise

Replace the centered surprise modal with a bottom sheet. Cards can be
kept (padlock badge replaces the swap die); per-card swap; Re-roll only replaces unkept
slots with a staggered flip wave and shows the count. Adds players/time
meta line. Fixes 2-line
title clamp leak. Continue and Cancel unchanged.

Design: docs/mockups/tonights-surprise-mockup.html (Option 2)
```

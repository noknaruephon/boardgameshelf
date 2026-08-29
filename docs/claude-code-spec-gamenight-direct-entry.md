# Spec: Game Night entry — direct to selection, gold wave, Random FAB

**Supersedes** `claude-code-spec-gold-wave.md` (delete it if present; everything from it is folded in here).
**Scope:** `index.html` only. Removes the mode-chooser panel, makes the pill enter selection mode directly with the gold-wave entrance, and adds a "Random" icon FAB that opens the existing surprise panel from inside selection mode.
**Design reference:** `docs/mockups/gamenight-direct-entry-mockup.html`.
**Depends on:** the centered plate-glass pill (`claude-code-spec-fab-plate-glass.md`).

---

## Behaviour

| Today | After |
|---|---|
| Pill → chooser panel (Select games / Surprise us) | Pill → selection mode directly, with the gold wave |
| Surprise us is a chooser option | "Random" is an icon FAB, bottom-right above the bar, visible only in selection mode. Opens the existing "Tonight's surprise" panel. |
| Chooser shows "N games match your filters" | Dropped. The `GN_MIN_POOL` toast guard stays on the pill. |
| Confirm step, surprise panel, shuffle, cancel paths | Unchanged. Both paths still converge on `openConfirm()`. |

One behaviour change worth stating: cancelling the surprise panel now returns the user to selection mode (it's still live underneath) instead of to the shelf. That's correct — they haven't left the flow.

---

## Edit 1 — remove the chooser panel

**Markup:** delete the whole `<div class="gn-backdrop" id="gnChooserBackdrop">…</div>` block (currently ~lines 1662–1676).

**JS:** delete these listeners in the entry-point setup (~lines 1738–1752):
- `gnChooserCancel` click
- `gnOptSelect` click
- `gnOptSurprise` click

And remove `document.getElementById('gnChooserBackdrop'),` from the backdrop-click array (~line 1804).

**CSS:** `.gn-option` is only used by the chooser. Delete its rules. `.gn-panel`, `.gn-sub`, `.gn-cancel-link` are shared with the surprise/confirm panels — keep them.

Then `grep -n "Chooser\|gnOpt" index.html` must return nothing.

## Edit 2 — pill goes straight to selection mode

**Before**
```js
  gnStartBtn.addEventListener('click', ()=>{
    const pool = gnPool();
    if(pool.length < GN_MIN_POOL){
      showGnToast('Not enough games match these filters');
      return;
    }
    document.getElementById('gnChooserPool').textContent = `${pool.length} games match your filters.`;
    openGnBackdrop(document.getElementById('gnChooserBackdrop'));
  });
```

**After**
```js
  gnStartBtn.addEventListener('click', ()=>{
    const pool = gnPool();
    if(pool.length < GN_MIN_POOL){
      showGnToast('Not enough games match these filters');
      return;
    }
    gnState.mode = 'manual';
    enterSelectionMode();
  });
```

## Edit 3 — Random icon FAB

**Markup:** create it right after `gnStartBtn` is appended, same pattern (built only when the flag is on):

```js
  const GN_ROLL_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><g transform="rotate(-18 13 13)"><rect x="6" y="6" width="14" height="14" rx="3.2"/><circle cx="9.6" cy="9.6" r="1.2" fill="currentColor" stroke="none"/><circle cx="16.4" cy="9.6" r="1.2" fill="currentColor" stroke="none"/><circle cx="13" cy="13" r="1.2" fill="currentColor" stroke="none"/><circle cx="9.6" cy="16.4" r="1.2" fill="currentColor" stroke="none"/><circle cx="16.4" cy="16.4" r="1.2" fill="currentColor" stroke="none"/></g><path d="M3 9.5a9 9 0 0 1 1.6-3.2" opacity=".7"/><path d="M2.2 13.5a10 10 0 0 1 .2-2.2" opacity=".45"/></svg>';

  const gnRandomBtn = document.createElement('button');
  gnRandomBtn.className = 'gn-random-fab';
  gnRandomBtn.type = 'button';
  gnRandomBtn.id = 'gnRandomBtn';
  gnRandomBtn.setAttribute('aria-label', 'Random — pick 6 games for us');
  gnRandomBtn.innerHTML = `${GN_ROLL_SVG}<span class="lbl">Random</span>`;
  document.body.appendChild(gnRandomBtn);
```

Put `GN_ROLL_SVG` next to `GN_DIE_SVG` and the other icon constants (~line 1407) rather than inline, to match convention.

**CSS** (append after the `.gn-fab` rules):

```css
  /* Random: icon FAB that lives above the bar while selecting. Same glass
     recipe as .gn-fab. z-index 14 = the tray's layer, under the bar (15). */
  .gn-random-fab{
    position:fixed;right:16px;
    bottom:calc(64px + 14px + env(safe-area-inset-bottom)); /* bar min-height + gap */
    z-index:14;
    display:inline-flex;align-items:center;gap:0;height:46px;padding:0 14px;
    background:rgba(var(--bgs-plate-rgb),0.82);
    -webkit-backdrop-filter:blur(16px) saturate(1.2);backdrop-filter:blur(16px) saturate(1.2);
    border:1.5px solid rgba(var(--bgs-gold-rgb),0.55);border-radius:999px;
    color:var(--bgs-gold);font-family:'Inter',sans-serif;font-size:13.5px;font-weight:700;
    white-space:nowrap;cursor:pointer;
    box-shadow:0 1px 0 rgba(var(--bgs-ivory-rgb),0.08) inset,0 8px 24px -10px rgba(0,0,0,0.7);
    opacity:0;transform:translateY(14px) scale(0.9);pointer-events:none;
    transition:opacity 0.2s ease,transform 0.24s cubic-bezier(.2,.8,.3,1),gap 0.3s ease,padding 0.3s ease;
  }
  .gn-random-fab svg{width:18px;height:18px;flex:none;}
  .gn-random-fab .lbl{max-width:0;overflow:hidden;opacity:0;transition:max-width 0.3s ease,opacity 0.2s ease;}
  /* Arrives as the wave settles, not with it. */
  body.gn-selecting .gn-random-fab{opacity:1;transform:none;pointer-events:auto;transition-delay:0.42s,0.42s,0s,0s;}
  /* On entry the label is written out for ~2s, then collapses to the icon. */
  .gn-random-fab.labelled{gap:8px;padding:0 18px 0 14px;}
  .gn-random-fab.labelled .lbl{max-width:70px;opacity:1;}
  .gn-random-fab:active{transform:scale(0.95);}
  .gn-random-fab:focus-visible{outline:2px solid var(--bgs-gold);outline-offset:3px;}
  @supports not (backdrop-filter:blur(1px)){.gn-random-fab{background:var(--bgs-plate);}}
  @media (prefers-reduced-transparency:reduce){
    .gn-random-fab{background:var(--bgs-plate);-webkit-backdrop-filter:none;backdrop-filter:none;}
  }
```

**Click handler** (replaces the old `gnOptSurprise` listener):

```js
  gnRandomBtn.addEventListener('click', ()=>{
    gnRandomBtn.classList.remove('labelled');
    gnState.mode = 'random';
    sampleSurprise();
    renderSurprise();
    openGnBackdrop(document.getElementById('gnSurpriseBackdrop'));
  });
```

**Surprise cancel** — mode must fall back to `manual`, not `null`, because selection mode is still live:

**Before**
```js
  document.getElementById('gnSurpriseCancel').addEventListener('click', ()=>{
    closeGnBackdrop(document.getElementById('gnSurpriseBackdrop'));
    gnState.mode = null;
    gnState.surprisePool = [];
  });
```
**After**
```js
  document.getElementById('gnSurpriseCancel').addEventListener('click', ()=>{
    closeGnBackdrop(document.getElementById('gnSurpriseBackdrop'));
    gnState.mode = 'manual';
    gnState.surprisePool = [];
  });
```

Also check `closeGnBackdrop` / the backdrop-click handler: if either resets `gnState.mode` to `null` for the surprise panel, apply the same `'manual'` fallback there.

**Copy:** in `updateConfirmSummary()` change `'Surprise mode'` → `'Random picks'` so the confirm step matches the new label.

## Edit 4 — gold wave CSS (append after the `.gn-bar` block)

```css
  /* ---- gold wave: selection-mode entrance. Origin = pill centre (46px tall at 16px → 39px). ---- */
  .gn-wave{
    position:fixed;left:50%;bottom:calc(39px + env(safe-area-inset-bottom));
    width:12px;height:12px;margin:0 0 -6px -6px;border-radius:50%;
    z-index:11;pointer-events:none;opacity:0;
    border:2px solid rgba(var(--bgs-gold-rgb),0.7);
    box-shadow:0 0 24px 6px rgba(var(--bgs-gold-rgb),0.18);
  }
  .gn-wave.go{animation:gn-wave 0.72s cubic-bezier(.1,.6,.3,1) both;}
  @keyframes gn-wave{0%{transform:scale(1);opacity:1;}100%{transform:scale(260);opacity:0;border-width:0.5px;}}

  /* Each card gets --gn-d (seconds) from JS = distance from the pill. */
  body.gn-selecting.gn-waving .checkbox,
  body.gn-selecting.gn-waving .info-btn{
    animation:gn-pop 0.36s cubic-bezier(.2,.8,.2,1.25) both;animation-delay:var(--gn-d,0s);
  }
  body.gn-selecting.gn-waving .game-card:not(.selected) .sel-ring{
    animation:gn-ring-pass 0.5s ease-out both;animation-delay:var(--gn-d,0s);
  }
  body.gn-selecting.gn-waving .game-card:not(.selected) .art img{transition-delay:var(--gn-d,0s);}
  @keyframes gn-pop{0%{opacity:0;transform:scale(0.4);}100%{opacity:1;transform:scale(1);}}
  @keyframes gn-ring-pass{0%{border-color:transparent;}35%{border-color:rgba(var(--bgs-gold-rgb),0.9);}100%{border-color:transparent;}}

  @media (prefers-reduced-motion:reduce){
    .gn-wave.go,
    body.gn-selecting.gn-waving .checkbox,
    body.gn-selecting.gn-waving .info-btn,
    body.gn-selecting.gn-waving .sel-ring{animation:none;}
    body.gn-selecting.gn-waving .game-card:not(.selected) .art img{transition-delay:0s;}
    .gn-random-fab,.gn-random-fab .lbl{transition:none;}
  }
```

`gn-ring-pass` ends on `transparent` (the ring's normal unselected state), so a card tapped mid-wave still goes solid gold via the existing, more specific `.selected .sel-ring` rule.

## Edit 5 — wave element + enter/exit

Create the wave element once, right after `gnRandomBtn` is appended:
```js
  const gnWave = document.createElement('div');
  gnWave.className = 'gn-wave';
  gnWave.setAttribute('aria-hidden', 'true');
  document.body.appendChild(gnWave);
```
If `enterSelectionMode()` can't see this scope, declare `let gnWave = null, gnRandomBtn = null;` at module level next to `gnState` and assign here.

**`enterSelectionMode` — before**
```js
function enterSelectionMode(){
  state.selectionMode = true;
  document.body.classList.add('gn-selecting');
  updateGnBar();
}
```
**After**
```js
// Wavefront speed, px/s. 1400 lands the top corners of a phone viewport at ~0.5s.
const GN_WAVE_SPEED = 1400;
const GN_RANDOM_LABEL_MS = 2200;

function primeGnWave(){
  const origin = document.getElementById('gnStartBtn');
  if(!origin) return;
  const r = origin.getBoundingClientRect();
  const ox = r.left + r.width / 2, oy = r.top + r.height / 2;
  document.querySelectorAll('.game-card').forEach(card => {
    const b = card.getBoundingClientRect();
    // Offscreen cards snap in so scrolling never reveals a half-finished animation.
    if(b.bottom < 0 || b.top > window.innerHeight){ card.style.setProperty('--gn-d', '0s'); return; }
    const d = Math.hypot(b.left + b.width / 2 - ox, b.top + b.height / 2 - oy);
    card.style.setProperty('--gn-d', (d / GN_WAVE_SPEED).toFixed(3) + 's');
  });
}

function enterSelectionMode(){
  state.selectionMode = true;
  primeGnWave();                       // measure before the class flip
  document.body.classList.add('gn-selecting', 'gn-waving');
  if(gnWave){ gnWave.classList.remove('go'); void gnWave.offsetWidth; gnWave.classList.add('go'); }
  clearTimeout(enterSelectionMode._wave);
  enterSelectionMode._wave = setTimeout(()=>document.body.classList.remove('gn-waving'), 800);
  if(gnRandomBtn){
    gnRandomBtn.classList.add('labelled');
    clearTimeout(enterSelectionMode._label);
    enterSelectionMode._label = setTimeout(()=>gnRandomBtn.classList.remove('labelled'), GN_RANDOM_LABEL_MS);
  }
  updateGnBar();
}
```

**`exitSelectionMode` — before**
```js
function exitSelectionMode(){
  state.selectionMode = false;
  state.selectedIds.clear();
  clearSelectedCards();
  document.body.classList.remove('gn-selecting');
```
**After**
```js
function exitSelectionMode(){
  state.selectionMode = false;
  state.selectedIds.clear();
  clearSelectedCards();
  clearTimeout(enterSelectionMode._wave);
  clearTimeout(enterSelectionMode._label);
  document.body.classList.remove('gn-selecting', 'gn-waving');
  if(gnWave) gnWave.classList.remove('go');
  if(gnRandomBtn) gnRandomBtn.classList.remove('labelled');
  gnState.mode = null;
```

---

## Verification

`index.html?gamenight=1`, iPhone Safari first.

**Entry**
- [ ] Tap pill: no chooser. Gold ring expands from bottom-centre; checkboxes, info buttons, and art-dim ripple outward; top corners land ≤ 0.5s; nothing still moving at 1s.
- [ ] Bar slides up immediately; a card in the top row tapped *during* the wave selects and updates the count.
- [ ] With filters leaving < 2 games: pill shows the "Not enough games" toast, nothing else happens.
- [ ] Scroll up right after the wave: previously-offscreen cards are already in final state.

**Random FAB**
- [ ] Arrives bottom-right ~0.4s after the wave starts, reading "Random" with the rolling-die icon; collapses to icon-only after ~2s.
- [ ] Doesn't overlap Continue, the tray handle, or the toast at any width (SE, 15 Pro, 1280px desktop).
- [ ] Tap → "Tonight's surprise" with 6 picks; Shuffle again resamples; Continue → confirm step reads "6 games · Random picks"; the reveal-deck toggle is hidden (random mode).
- [ ] Cancel on the surprise panel, or tapping outside it → back in selection mode with prior selections intact, Random FAB still present, `gnState.mode === 'manual'`.
- [ ] Tap Random a second time: label does not re-expand (it only reveals on entry).
- [ ] Bar Cancel → shelf; Random FAB and wave gone; re-enter → wave and label reveal play again.
- [ ] Manual path: select 3, Continue → confirm reads "3 games · You picked them", reveal toggle visible.

**Motion / a11y**
- [ ] Reduce Motion: no ring, no stagger, Random FAB appears without slide.
- [ ] Reduce Transparency: both FABs solid plate.
- [ ] VoiceOver: Random FAB announces "Random — pick 6 games for us, button".
- [ ] `grep -n "Chooser\|gnOpt\|Surprise mode" index.html` → no matches.
- [ ] `night-host.html` / `vote.html` unaffected.

## Commit

`feat(gamenight): pill enters selection directly with gold wave; Random icon FAB replaces chooser`

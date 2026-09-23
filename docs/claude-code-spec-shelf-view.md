# Spec: Shelf view on the shelf page, with a view toggle

**Mockup (locked):** `docs/mockups/shelf-view-mockup.html`. Built on `shelf.html`'s own stylesheet, header and filter bar, with all 196 games. Demo bar: game count (all / filtered 17 / 1), selection mode, theme.
**Decisions locked:** covers only (no titles in the shelf view); default view is Shelf; the toggle shows for everyone, owner and guest.
**Files touched:** `shelf.html` (markup + CSS + `render()` and a few helpers), `js/bag-ui.js` (`decorateCard` learns the second tile shape).
**Also in this task:** the sort button (`#sortBtn`) leaves the filter bar. Sorting stays as it is by default (rating, descending); the ascending/descending flip is retired.
**Flag:** `?view=cards|shelf` is the URL form of the toggle, not a feature flag. Ship without a flag: the card grid is unchanged and one tap away.
**Commits:** three, in order. Stop for review after each.

## What this is

The shelf page gets a second way to lay out the same games: rows of walnut planks with the boxes standing on them, backlit, exactly as the landing hero shows it. A two-stop toggle in the filter bar switches between **Shelf** (new, default) and **Cards** (today's grid, untouched). A third stop, **List**, comes in a later phase; leave room for it.

Everything else stays: search, filters, sort, the count line, chips, the empty state, the game modal on tap, game-night selection mode, bag packing, the sticky compact topbar, themes.

## Hard constraints (house rules)

- **WebKit rule.** `.gbox` transitions `transform` only. Nothing in the shelf view animates; the glows are static gradients (no `filter`, no keyframes). The game-night wave (`gn-pop`, `gn-ring-pass`) animates `.chk` / `.sel`, which have no transitions. Keep it that way.
- Rings are `box-shadow`, never `border`/`outline`.
- `content-visibility:auto` implies paint containment, which **clips anything outside the row's box**. The plank, the lift, the glow and the ring therefore live inside the row's padding (see constants). If a glow or a plank ever gets cut flat, this is why.
- Tokens only. The plank's walnut colours are the one deliberate exception (it is furniture, identical on every theme): `#4a3527 / #2e2018 / #1c130e`.
- The card grid's CSS and markup are not edited. New CSS is additive.

## Persistence and default

`localStorage['bgs:view']` = `'shelf' | 'cards'` (later `'list'`). Missing or unknown → `'shelf'`. `?view=` in the URL wins for that load and is saved. Same shape-check pattern as `bgs:theme` (`js/themes.js`).

The bag route (`isBagRoute`) hides the filter bar today; it hides the toggle with it and renders **cards**, as now. The shelf view is for the shelf only in this phase.

---

## Commit 1: the toggle

### Markup

In `.filter-sort-bar`, after `#filterBtn`. Remove `#sortBtn`, its `#sortIcon`, the `sortBtn` click handler and `state.sort` (leave the default order: `bggRating` descending):

```html
<div class="view-toggle" id="viewToggle" role="radiogroup" aria-label="Shelf view" data-view="shelf">
  <button type="button" class="view-opt" data-view="shelf" role="radio" aria-checked="true" aria-label="Shelf view">
    <svg viewBox="0 0 15 15" fill="none"><rect x="2" y="3" width="3" height="5.5" rx=".8" stroke="currentColor" stroke-width="1.3"/><rect x="6.2" y="2" width="3" height="6.5" rx=".8" stroke="currentColor" stroke-width="1.3"/><rect x="10.4" y="3.5" width="3" height="5" rx=".8" stroke="currentColor" stroke-width="1.3"/><path d="M1 10.5h13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
  </button>
  <button type="button" class="view-opt" data-view="cards" role="radio" aria-checked="false" aria-label="Card view">
    <svg viewBox="0 0 15 15" fill="none"><rect x="1.5" y="1.5" width="5" height="5" rx="1.2" stroke="currentColor" stroke-width="1.3"/><rect x="8.5" y="1.5" width="5" height="5" rx="1.2" stroke="currentColor" stroke-width="1.3"/><rect x="1.5" y="8.5" width="5" height="5" rx="1.2" stroke="currentColor" stroke-width="1.3"/><rect x="8.5" y="8.5" width="5" height="5" rx="1.2" stroke="currentColor" stroke-width="1.3"/></svg>
  </button>
  <span class="view-ink" aria-hidden="true"></span>
</div>
```

The compact sticky `#topbar` gets no toggle (it holds search + filter only; the toggle is a browsing choice, not a filtering one).

### CSS

```css
/* ---- view toggle: two stops wearing exactly the .icon-btn look (40px tall, plate, 1px gold-.18 border, 12px radius),
   so it reads as the filter button's sibling. Not glass. A third stop (List) is a third 38px column and one more .view-ink translate. ---- */
.view-toggle{position:relative;flex:none;display:grid;grid-template-columns:repeat(2,38px);height:40px;box-sizing:border-box;padding:0;border-radius:12px;isolation:isolate;
  background:var(--bgs-plate);border:1px solid rgba(var(--bgs-gold-rgb),0.18);}
.view-opt{position:relative;z-index:1;width:38px;height:38px;display:grid;place-items:center;background:none;border:0;padding:0;color:var(--bgs-ivory-45);cursor:pointer;transition:color .15s ease;}
.view-opt svg{width:15px;height:15px;}
.view-opt[aria-checked="true"]{color:var(--bgs-gold);}
.view-opt:focus-visible{outline:0;box-shadow:inset 0 0 0 2px var(--bgs-gold);border-radius:12px;}
.view-ink{position:absolute;top:3px;bottom:3px;left:3px;width:32px;border-radius:9px;background:rgba(var(--bgs-gold-rgb),.14);box-shadow:inset 0 0 0 1px rgba(var(--bgs-gold-rgb),.45);transition:transform .22s var(--ease-liquid);}
.view-toggle[data-view="cards"] .view-ink{transform:translateX(38px);}
@media (prefers-reduced-motion:reduce){.view-ink,.view-opt{transition:none;}}
```

Add `.view-ink` to the existing reduced-motion list if you prefer one place.

### JS

```js
// ---- view (Shelf | Cards; List later) ----
const VIEWS = ['shelf', 'cards'];
function readView(){
  const q = new URLSearchParams(location.search).get('view');
  let v = null;
  try { v = localStorage.getItem('bgs:view'); } catch (e) {}
  const pick = VIEWS.includes(q) ? q : (VIEWS.includes(v) ? v : 'shelf');
  if (q && q !== v) { try { localStorage.setItem('bgs:view', pick); } catch (e) {} }
  return pick;
}
state.view = isBagRoute ? 'cards' : readView();   // add `view` to `state`

function setView(v){
  if (!VIEWS.includes(v) || v === state.view) return;
  state.view = v;
  try { localStorage.setItem('bgs:view', v); } catch (e) {}
  syncViewToggle();
  render();
}
function syncViewToggle(){
  const t = document.getElementById('viewToggle');
  if (!t) return;
  t.dataset.view = state.view;
  t.querySelectorAll('.view-opt').forEach(o => o.setAttribute('aria-checked', String(o.dataset.view === state.view)));
}
document.querySelectorAll('#viewToggle .view-opt').forEach(o => o.addEventListener('click', () => setView(o.dataset.view)));
```

In this commit `render()` still draws cards whatever `state.view` says; the toggle only moves its ink. Call `syncViewToggle()` once after `state` exists.

**Commit message:** `feat(shelf): view toggle in the filter bar (Shelf | Cards), stored as bgs:view`

Stop for review.

---

## Commit 2: the shelf view

### Markup (rendered by `render()` when `state.view === 'shelf'`)

`#shelf` swaps its class: `shelf` for cards, `planks` for the shelf view (`shelf.className = state.view === 'shelf' ? 'planks' : 'shelf'`). The skeleton in the HTML stays as it is (cards); it is replaced on first render either way.

```html
<div class="planks" id="shelf">
  <div class="plankrow">
    <button class="gbox" type="button" data-id="295947" style="--lean:-6deg" aria-label="Cascadia">
      <span class="glow"></span>
      <span class="sel"></span>
      <span class="chk">…GN_CHECK_SVG…</span>
      <span class="info-btn" data-gn-info role="button" aria-label="Cascadia details"><i>i</i></span>
      <span class="face"><img src="…imageSmall…" alt="Cascadia cover" loading="lazy" decoding="async" data-orig="…" onerror="…same as the card…"></span>
      <span class="foot"></span>
    </button>
    … N boxes …
    <span class="lamp" aria-hidden="true"></span>
    <span class="plank" aria-hidden="true"></span>
  </div>
  …
</div>
```

- N per row = the card grid's column count at that width: **3 / 4 (≥560px) / 6 (≥800px)**. Compute it in JS from `matchMedia`, and re-render on the two breakpoints changing (`matchMedia(...).addEventListener('change', …)`), not on every resize.
- Boxes are **centred** on the plank; a short last row sits centred on a full-length plank (see the mockup's "Filtered · 17").
- `.sel`, `.chk`, `.info-btn` render only when `selectionOverlays` is true, exactly as the card does.
- Lean per box: cycle `[-6,4,-3,5,-5,3,-4,6,-2,4,-6,2]` by overall index.
- The `<img>` is the card's image tag verbatim (same `imageSmall || image`, `data-orig`, `onerror`); the shelf view has no info block, so the onerror's `.closest('.art')` becomes `.closest('.face')`.
- Click handling is the card's, unchanged (bag packing → toggle, selecting → `toggleSelect` / `[data-gn-info]` → `openCard`, else `openCard`). Extract the handler into a function both shapes call.

### CSS

```css
/* ---- shelf view (the landing hero's shelf, for the whole collection). Sibling of .shelf; the card grid is untouched. ---- */
.planks{display:flex;flex-direction:column;gap:0;padding:0 0 40px;   /* rows touch; the 62px bottom padding is the spacing */--n:3;--g:14px;--pad:10px;
  --bw:calc((100% - 2 * var(--pad) - (var(--n) - 1) * var(--g)) / var(--n));}
@media (min-width:560px){.planks{--n:4;--g:16px;}}
@media (min-width:800px){.planks{--n:6;--g:22px;}}
/* the row is a containment box: plank, lift, glow and ring all live inside its padding */
.plankrow{position:relative;display:flex;justify-content:center;align-items:flex-end;gap:var(--g);padding:22px var(--pad) 48px;isolation:isolate;
  content-visibility:auto;contain-intrinsic-size:auto 240px;}   /* 48px bottom: 14px plank + 34px of its shadow, all inside the containment box */
/* the board: a lit top face, a darker front, a gold hairline on the top edge */
.plankrow .plank{position:absolute;left:4px;right:4px;bottom:34px;height:14px;border-radius:2px 2px 3px 3px;z-index:3;
  background:linear-gradient(to bottom,#5a4231 0 22%,#3a2a20 22% 48%,#2a1d16 48%,#1a110d 100%);
  box-shadow:inset 0 1px 0 rgba(var(--bgs-gold-rgb),.6),inset 0 -1px 0 rgba(0,0,0,.75),0 1px 0 rgba(0,0,0,.6);}
/* the plank's shadow on the wall (the reference's wide soft shadow): darkest just under the board, gone by 34px, softened at both ends.
   NO filter:blur and NO overhang beyond the plank — the softness is the gradient itself. A blur or a negative inset here reaches past
   the row's containment box and gets cut flat. */
.plankrow .plank::before{content:"";position:absolute;left:0;right:0;top:100%;height:34px;pointer-events:none;
  background:linear-gradient(to bottom,rgba(0,0,0,.7) 0,rgba(0,0,0,.4) 30%,rgba(0,0,0,.12) 68%,transparent 100%);
  -webkit-mask-image:linear-gradient(to right,transparent,#000 6%,#000 94%,transparent);mask-image:linear-gradient(to right,transparent,#000 6%,#000 94%,transparent);}
/* the boxes' shadow cast back onto the wall just above the board */
.plankrow .plank::after{content:"";position:absolute;left:2%;right:2%;bottom:100%;height:16px;pointer-events:none;background:linear-gradient(to top,rgba(0,0,0,.45),transparent);}
.plankrow .lamp{position:absolute;inset:0;z-index:0;pointer-events:none;background:radial-gradient(ellipse 50% 50% at 50% 45%,rgba(var(--bgs-ivory-rgb),.05),transparent 100%);}
.gbox{position:relative;flex:none;width:var(--bw);aspect-ratio:3/4;z-index:2;padding:0;border:0;background:none;color:inherit;font:inherit;cursor:pointer;
  transform:translateY(0);transition:transform .35s var(--ease-liquid);}
.gbox .face{position:absolute;inset:0;z-index:2;border-radius:5px;overflow:hidden;background:var(--bgs-plate);   /* z-index 2: the glow (z 1) must sit BEHIND the cover, never over it */
  box-shadow:inset 0 0 0 1px rgba(var(--bgs-ivory-rgb),.14),-5px 10px 18px -9px rgba(0,0,0,.9);
  transform:perspective(600px) rotateY(var(--lean,0deg));transform-origin:50% 100%;}
.gbox .face img{width:100%;height:100%;object-fit:cover;object-position:center top;display:block;}
.gbox .face::after{content:"";position:absolute;inset:0;background:linear-gradient(105deg,rgba(255,255,255,.14) 0,transparent 30%,transparent 72%,rgba(0,0,0,.22) 100%);}
/* one shared warm light per box; flat gradient, no blur, no animation — 196 of these must stay cheap */
.gbox .glow{position:absolute;left:-20%;right:-20%;top:-14%;bottom:-3%;z-index:1;pointer-events:none;opacity:.9;
  background:radial-gradient(ellipse 46% 46% at 50% 56%,rgba(var(--bgs-gold-rgb),.42) 0,rgba(var(--bgs-gold-rgb),.16) 45%,transparent 100%);}
.gbox .foot{position:absolute;left:4%;right:4%;bottom:-3px;height:10px;border-radius:50%;background:rgba(0,0,0,.8);filter:blur(3px);z-index:1;}
.gbox:hover,.gbox:focus-visible,.gbox:active{transform:translateY(-8px) scale(1.04);z-index:5;}
.gbox:hover .face{transform:perspective(600px) rotateY(0);}
.gbox:focus-visible{outline:0;}
.gbox:focus-visible .face{box-shadow:0 0 0 2px var(--bgs-gold),inset 0 0 0 1px rgba(var(--bgs-ivory-rgb),.14);}
/* selection + packing: the cards' language on the box */
.gbox .sel{position:absolute;inset:-4px;border-radius:8px;box-shadow:inset 0 0 0 2px rgba(var(--bgs-ivory-rgb),.35);display:none;z-index:3;pointer-events:none;}
.gbox .chk{position:absolute;top:6px;left:6px;width:22px;height:22px;border-radius:50%;background:rgba(var(--bgs-bg-rgb),.7);box-shadow:inset 0 0 0 1.5px rgba(var(--bgs-ivory-rgb),.6);display:none;place-items:center;z-index:4;}
.gbox .chk svg{opacity:0;}
.gbox .info-btn{z-index:4;}   /* reuse the card's .info-btn placement; it is already display:none outside selection */
body.is-selecting .gbox .sel,body.is-selecting .gbox .chk{display:grid;}
body.is-selecting .gbox:not(.selected) .face img{opacity:.62;}
body.is-selecting .gbox.selected .sel{box-shadow:inset 0 0 0 2px var(--bgs-gold);}
body.is-selecting .gbox.selected .chk{background:var(--bgs-gold);box-shadow:none;}
body.is-selecting .gbox.selected .chk svg{opacity:1;}
body.is-selecting .gbox.selected .glow{background:radial-gradient(ellipse 46% 46% at 50% 56%,rgba(var(--bgs-gold-rgb),.8) 0,rgba(var(--bgs-gold-rgb),.3) 45%,transparent 100%);}
@media (prefers-reduced-motion:reduce){.gbox{transition:none;}}
```

The `.face img` opacity rule mirrors `body.is-selecting .game-card:not(.selected) .art img`. If the card version carries a `transition:opacity .15s`, copy it; the game-night wave sets `--gn-d` on the tile and the card's `.art img{transition-delay:var(--gn-d)}` rule needs a `.gbox .face img` twin.

Skeletons: the shelf view needs none; the cards' skeleton shows until the first `render()`.

### Commit message

`feat(shelf): shelf view — planks, backlit boxes, covers only`

Stop for review.

---

## Commit 3: make the helpers view-agnostic

Today several places assume `.game-card`. Each needs to work for both tile shapes. Add a shared class `tile` to both the card and the box (`el.className = 'game-card tile'` / `'gbox tile'`) and switch these to it:

| Where | Today | Change |
|---|---|---|
| `cardNodeFor(id)` | `.game-card[data-id]` | `.tile[data-id]` |
| `clearSelectedCards()` | `.game-card.selected` | `.tile.selected` |
| game-night wave (`--gn-d` loop) | `document.querySelectorAll('.game-card')` | `.tile` |
| any other `querySelectorAll('.game-card')` in `shelf.html` / `js/game-night*.js` / `js/bag-ui.js` | grep and switch | |
| CSS `body.is-selecting .game-card…` rules | unchanged | the `.gbox` twins are in commit 2 |

`bag-ui.js` `decorateCard(cardEl, game)`: it appends `.bag-line` into `.info`, which a box does not have. When `cardEl.querySelector('.info')` is null, skip the line; the ring, checkbox, `aria-pressed` and `aria-label` still apply. Packing on the shelf view therefore shows the ring and a brighter backlight but not the players/time line; that is acceptable for this phase (the modal has both). Note it in the commit message.

Selection-mode chrome (`.gn-fab`, the tray, `updateGnBar()`) reads `state.selectedIds`, not DOM, so it needs nothing.

**Commit message:** `refactor(shelf): tile helpers work for cards and boxes; bag decorates both`

Stop for review.

---

## Deliberate deviations from the mockup

- The mockup's demo bar (count, selecting, theme) is mockup-only; the mockup's selection toggle is a stub, production uses the real `toggleSelect`.
- The mockup's box has a `.cap` title element and label modes; **none of that ships** (covers only is locked). Drop `.cap` and the `data-labels` rules.
- The mockup builds tiles from a static array; production builds from `filtered` in `render()` with the real image tag and the real click handler.
- The mockup renders both views with a class swap on `#shelf`; production does the same.

## Layout constants

| | Phones | ≥560px | ≥800px |
|---|---|---|---|
| Boxes per plank | 3 | 4 | 6 |
| Gap | 14px | 16px | 22px |
| Row side padding | 10px | 10px | 10px |
| Row padding top / bottom | 22px / 48px (glow + lift room / plank + its shadow) | same | same |
| Plank | 14px tall, lit top face + darker front, gold top edge, 4px in from the row's edges; 34px gradient shadow below (no blur, no overhang, faded at the ends); 16px box shadow above | | |
| Plank → next row's boxes | about 56px | | |
| Box lean | −6…+6°, cycled | | |
| Lift | −8px, scale 1.04, .35s | | |
| Rows gap | 0 (the row's own bottom padding spaces them) | | |
| Toggle | 40px tall, 2 × 38px stops inside a 1px border, ink 32px, slides 38px per stop; same plate/border/radius as `.icon-btn` | | |

## Verification checklist

- [ ] First visit (no `bgs:view`): Shelf view. Toggle to Cards → grid identical to today; reload keeps Cards; `?view=shelf` overrides and is saved
- [ ] Guest and owner both see the toggle; bag route hides it and shows cards
- [ ] 196 games: 66 rows on a phone, 49 at 4-up, 33 at 6-up; boxes centred on every plank, short last row centred; scrolling smooth (rows are `content-visibility:auto`)
- [ ] No gold haze over any cover: the glow paints behind the face, not on top of it
- [ ] Sort button gone; order is rating descending; filter button and toggle are the same height with the same border and radius
- [ ] No hard edge on any glow or plank shadow; nothing clipped at row edges (the containment rule). The plank's shadow fades out fully before the next row's boxes
- [ ] Search, filters, chips, sort and the count line behave identically in both views; empty state renders in both
- [ ] Tap a box → game modal; hover lifts on desktop; focus ring visible via keyboard
- [ ] Game night selection: rings, checkbox, dimming and the gold backlight on selected boxes; the pill's wave runs across boxes; selections survive a view switch (state is ids, not DOM); tray "hidden by filters" tags still correct
- [ ] Bag packing on the shelf view: ring + checkbox toggle, `aria-pressed` correct, no `.bag-line` (documented)
- [ ] Sticky compact topbar unchanged; no toggle in it
- [ ] Walnut, Navy, Mahogany, Oak: glows and lamp use tokens; plank walnut identical on all (intended)
- [ ] Reduced motion: no lift transition, no ink slide
- [ ] iOS Safari: lift animates; glass toggle renders with glass on and off
- [ ] Lighthouse mobile: no regression against the card view on the same 196 games

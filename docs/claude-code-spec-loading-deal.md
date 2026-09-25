# Loading screen — the backlit deal

Restyle of the shared game-night loading animation (`.deal` in `css/base.css`) and the
static shell it sits in. Design locked on the canvas "Loading screen — 3 options",
artboard **A · Backlit deal** (option A of three).

What changes, in one sentence: the deal becomes the focal element — four bigger cards
fan into a hand over one warm gold backlight, square up under the ring pulse, fade and
re-deal — and on the four game-night shells it sits vertically centred with the copy
under it and the footer pinned to the bottom of the viewport.

## Scope

| Surface | Markup today | Change |
|---|---|---|
| `night-host.html`, `vote.html`, `vote-swipe.html`, `results.html` | `#screen` → eyebrow, h1, `.deal-wrap` | Reorder into a `.deal-shell` (hand first, copy under it); shell centred, footer pinned — Commit 2 |
| `settings.html` | `#loading.deal-wrap` inline under the header | Gets the new hand automatically from Commit 1; stays inline, no shell, no centring |
| `js/waiting-room.js` `shuffleHTML()` (the three-card shuffle) | — | **Unchanged.** The shuffle holds the table mid-flow; only the page-load deal is restyled |
| Copy | per page | **Unchanged**: "Game Night" / "Dealing tonight's picks…" / "Gathering tonight's results…" |

No feature flag: this is a restyle of a component that already ships, with no new
entry point. Two commits.

## Commit 1 — `css/base.css`: the backlit deal

Replace the `.deal-wrap` … `@keyframes bgs-ring-pulse` block and its reduced-motion
lines. `.deck-card` / `.deck-card.back` (shared with the deck preview and the shuffle)
stay as they are; `.deal .deck-card` overrides what it needs.

### Layout constants

| Thing | Value |
|---|---|
| Hand (`.deal`) | 260 × 170 px, `position:relative` |
| `.deal-wrap` height | 200 px (was 120), `margin:0` (the shell owns spacing) |
| Card | 86 × 116 px, radius 10, centred with negative margins (`-64px 0 0 -43px` from `left:50%;top:50%`) |
| Card transform origin | `50% 135%` — the pivot sits below the card so the fan reads as a hand |
| Rest rotations | c1 −22°, c2 −7°, c3 7°, c4 22° |
| Stagger | 0 / .16 s / .32 s / .48 s |
| Cycle | 3.8 s, `cubic-bezier(.3,.7,.3,1)`, infinite |
| Card stripes | `repeating-linear-gradient(45deg, rgba(gold,.08) 0 4px, transparent 4px 8px)` over `--bgs-plate` |
| Card edge | `1px solid rgba(gold,.28)`; shadow `0 14px 30px rgba(0,0,0,.55), inset 0 1px 0 rgba(ivory,.06)` |
| "?" glyph | Fraunces 600, 24 px, `--bgs-gold-dim` (glyph stays — same rule as the lobby fan) |
| Backlight (`.deal-light`) | 300 × 190 px ellipse behind the hand, `radial-gradient(closest-side, rgba(gold,.42), rgba(gold,.12) 55%, rgba(gold,0))`, `filter:blur(14px)`; breathes opacity .55 ↔ 1 over the same 3.8 s |
| Ring (`.deal-ring`) | 104 × 134 px, radius 15, `inset 0 0 0 2px` gold; pulses to .75 at 78% of the cycle (when the cards are squared up), gone by 92% |
| z-order | light (0) < c1 < c2 < c3 < c4 < ring (5) |

### Keyframes

```css
@keyframes bgs-deal-in{
  0%  {opacity:0;transform:translate(150px,-170px) rotate(38deg);}   /* off-screen, top right */
  13% {opacity:1;transform:translate(0,0) var(--rest);}              /* lands in the fan */
  58% {opacity:1;transform:translate(0,0) var(--rest);}              /* holds the hand */
  70% {opacity:1;transform:translate(0,0) rotate(0deg);}             /* squares up */
  86% {opacity:1;transform:translate(0,0) rotate(0deg);}
  96%,100%{opacity:0;transform:translate(0,0) rotate(0deg);}          /* fades, re-deals */
}
@keyframes bgs-ring-pulse{
  0%,70%{box-shadow:inset 0 0 0 2px rgba(var(--bgs-gold-rgb),0);}
  78%   {box-shadow:inset 0 0 0 2px rgba(var(--bgs-gold-rgb),.75);}
  92%,100%{box-shadow:inset 0 0 0 2px rgba(var(--bgs-gold-rgb),0);}
}
@keyframes bgs-deal-breathe{0%,100%{opacity:.55;}50%{opacity:1;}}
```

### Markup (the component; every page that inlines it changes the same way)

Before:
```html
<div class="deal-wrap">
  <div class="deal" aria-hidden="true">
    <div class="deck-card back">?</div>
    <div class="deck-card back">?</div>
    <div class="deck-card back">?</div>
    <div class="deck-card back">?</div>
    <div class="deal-ring"></div>
  </div>
</div>
```
After (one new element, first child so it paints behind):
```html
<div class="deal-wrap">
  <div class="deal" aria-hidden="true">
    <div class="deal-light"></div>
    <div class="deck-card back">?</div>
    <div class="deck-card back">?</div>
    <div class="deck-card back">?</div>
    <div class="deck-card back">?</div>
    <div class="deal-ring"></div>
  </div>
</div>
```

### WebKit rule (hard constraint, as in every spec)

Never `animation` and `transition` on the same property of the same element. Here:
cards animate `transform` + `opacity` only; the light animates `opacity` only, on its own
element; the ring animates `box-shadow` only, on its own element. None of them carries a
transition, and `.deal .deck-card` never takes `.clickable`. Gold rings are
`box-shadow: inset`, never `outline`.

### Reduced motion

Static fanned hand under the steady light — nothing depends on an animation to become
visible, so the shell can never be blank:
```css
@media (prefers-reduced-motion:reduce){
  .deal .deck-card{animation:none;opacity:1;transform:translate(0,0) var(--rest);}
  .deal-light{animation:none;opacity:.8;}
  .deal-ring{animation:none;box-shadow:none;}
}
```
(This replaces the current reduced-motion rule, which showed a squared deck under a
half-strength ring; the fanned rest state is the one on the canvas with Motion off.)

### Commit message

`Restyle the game-night loading deal: bigger fanned hand over a gold backlight`

## Commit 2 — the shell: centred hand, copy under it, footer pinned

Applies to `night-host.html`, `vote.html`, `vote-swipe.html`, `results.html`. Same edit
on each; page-specific copy kept verbatim.

### Markup

Before (`vote.html`; the others differ only in the h1):
```html
<div class="screen" id="screen">
  <div class="eyebrow">Game Night</div>
  <h1>Dealing tonight's picks&hellip;</h1>
  <div class="deal-wrap">…</div>
</div>
```
After:
```html
<div class="screen" id="screen">
  <div class="deal-shell">
    <div class="deal-wrap">…</div>
    <div class="deal-shell__copy">
      <div class="eyebrow">Game Night</div>
      <h1>Dealing tonight's picks&hellip;</h1>
    </div>
  </div>
</div>
```

### CSS — in `css/base.css`, next to the deal (shared by all four pages)

```css
/* The loading shell: the hand centred in the viewport with the copy under it, the
   footer pinned to the bottom. Scoped with :has() so it applies only while the
   static shell is on screen — the first screen.innerHTML render removes .deal-shell
   and the page's normal flow returns, no JS involved. */
body:has(.deal-shell){display:flex;flex-direction:column;}
body:has(.deal-shell) .screen{flex:1 0 auto;display:flex;flex-direction:column;justify-content:center;}
body:has(.deal-shell) .shelf-footer{margin-top:auto;}
.deal-shell{display:flex;flex-direction:column;align-items:center;gap:34px;padding-bottom:24px;}
.deal-shell__copy{display:flex;flex-direction:column;align-items:center;gap:8px;}
.deal-shell .eyebrow{margin:0;}
.deal-shell h1{margin:0;font-size:26px;line-height:1.2;}
```

| Constant | Value |
|---|---|
| Hand → copy gap | 34 px |
| Eyebrow → h1 gap | 8 px |
| Shell bottom padding | 24 px (optical: lifts the group slightly above true centre) |
| Loading h1 | 26 px / 1.2 (the pages' own h1 at 22–23 px is untouched; it takes over on first render) |
| Footer | `margin-top:auto` — pinned to the viewport bottom only while the shell is up |

`body` already has `min-height:100svh` in `base.css`, which is what lets the column fill
the viewport. `:has()` is Safari 15.4+ / Chrome 105+ — the same floor as the `svh` unit
the site already relies on; older browsers just get the top-aligned shell they have today.

### Commit message

`Centre the game-night loading shell and pin its footer`

## Deliberate deviations from the mockup

- The mockup's footer (`Privacy` / `Terms`, copyright lines) is the production footer
  drawn for context — `.shelf-footer` is not touched.
- The mockup's Theme / Motion tweaks are canvas controls, not product features; the
  real page follows `<html data-theme>` and `prefers-reduced-motion` as it already does.
- The mockup fakes the page at 390 × 844. On the real page the shell centres in whatever
  `100svh` is; nothing is pixel-fixed vertically.

## Verification

- [ ] `vote.html` shell: hand centred in the viewport, eyebrow + h1 under it, footer at
      the bottom edge; no vertical scroll on an iPhone-sized viewport
- [ ] Same on `night-host.html`, `vote-swipe.html`, `results.html`; each keeps its own h1 text
- [ ] Cards deal in from top-right, fan (−22/−7/7/22°), square up, ring pulses while
      squared, fade, repeat; light breathes behind them; "?" glyph on every card
- [ ] `settings.html` `#loading` shows the new hand inline under the header, no centring
- [ ] Once the page renders (`screen.innerHTML = …`), layout is exactly as before this
      change: footer back under the content, nothing centred
- [ ] Waiting-room / tally shuffle (`shuffleHTML()`) is visually unchanged
- [ ] Reduced motion (Xcode simulator or macOS setting): static fan under a steady light,
      no ring, nothing blank
- [ ] Safari: fan animation runs smoothly; no dropped transitions (nothing here has one)
- [ ] All four themes (`?theme=` / Settings): plate and ivory follow the theme, gold does not

# Bag packing bar — replace the half-screen sheet with a slim info bar + floating glass buttons

**Scope:** one change — the bottom sheet shown while packing a bag on the shelf page.
**Reference mockup:** `docs/mockups/bag-pack-bar.html` (copy the attached `bag-sheet-options-mockup.html` there first; the locked design is the default view, "A · floating buttons"). Ignore the other demo-bar options — they were rejected.
**Do not touch:** the bag page (`/bag/{id}`), share sheet, or any Supabase code. This is UI only.

Work in two commits. Stop for review after each.

---

## Why

The current packing sheet ("Name the bag" + games / players / playtime / gaps + Cancel / Pack) covers almost half the grid, so you can't see what you're packing. The revision makes the bottom of the screen a read-only coverage bar, floats the two actions above it as glass pills, and moves naming to *after* Pack is tapped.

## Locked design

```
┌───────────────────────────────────────────────┐
│  (grid, scrolls behind)                       │
│                          ╭────────╮ ╭───────╮ │  ← floating glass pills, 44px,
│                          │ Cancel │ │ Pack  │ │     12px above the bar, 16px from right
│ ──────────────────────────────────────────────│  ← 1px --bgs-line
│  3 games        ▇ ▇ ▇ ▇ ▇ ▢ ▢ ▢               │  ← count (Fraunces) / strip (24px cells)
│  60–150 min     1 2 3 4 5 6 7 8+              │  ← time (mono)     / labels centred per cell
│  Nothing for 5 · Nothing under 30 min         │  ← amber line, only when gaps exist
└───────────────────────────────────────────────┘
```

Naming step (after Pack): a short sheet — "Name the bag", one line "3 games, 60–150 min", the name input, then `Back` / `Pack the bag`. Reuse the existing name input and validation; only its position in the flow changes.

## Layout constants

| Item | Value |
|---|---|
| Bar horizontal padding | 16px (matches grid padding — must align with card edges) |
| Bar vertical padding | 14px top / 14px + `env(safe-area-inset-bottom)` bottom |
| Bar height | 76px without gap line, 102px with (excl. safe area) |
| Bar border-top | 1px `--bgs-line` (`rgba(var(--bgs-gold-rgb), .28)` if no such token exists) |
| Left block width | 104px, fixed |
| Count | Fraunces 24/24 weight 500; "games" Inter 14 `--bgs-mute`, 5px gap |
| Time | IBM Plex Mono 12/14, `--bgs-mute`, 6px below count |
| Strip | 8 cells, `flex:1` each, height 24px, gap 4px, radius 6px |
| Cell — covered | `--bgs-gold` fill |
| Cell — not covered | `rgba(var(--bgs-ivory-rgb), .12)` |
| Cell — gap (2p / 5p missing, bag non-empty) | not-covered fill + 4px amber dot centred 9px below the cell |
| Cell labels | 11/14, `--bgs-mute`, one per cell, centred, 6px below strip |
| Gap line | Inter 12/16, `--bgs-amber`, 10px below the row, items joined with " · "; element removed when empty |
| Floating row | right-aligned, 10px between pills, 12px above the bar's top border, 16px from the right edge |
| Pill size | 44px tall, radius 22px, Cancel padding 0 18px, Pack padding 0 26px |
| Pill glass | `backdrop-filter: blur(18px) saturate(160%)` (+ `-webkit-` prefix) |
| Cancel pill | bg `rgba(var(--bgs-ivory-rgb), .10)`, border 1px `rgba(var(--bgs-ivory-rgb), .22)`, text `--bgs-ivory` 15 / 500 |
| Pack pill | bg `rgba(var(--bgs-gold-rgb), .26)`, border 1px `rgba(var(--bgs-gold-rgb), .55)`, text `--bgs-ivory` 15 / 600 |
| Pill shadow | `0 8px 24px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.18), inset 0 -1px 0 rgba(0,0,0,.25)` |
| Pack disabled | opacity .45, `cursor: default`, when bag is empty |
| No-backdrop fallback | `@supports not (backdrop-filter: blur(1px))`: Cancel bg `rgba(42,31,22,.92)`; Pack bg `rgba(var(--bgs-gold-rgb), .55)` with dark text `#1a1206` |
| Amber | add `--bgs-amber: #F0913A` to `css/base.css` if no amber/warning token exists; if one does, use it and note the name in the PR |
| Grid bottom padding while packing | ≥ bar height + 44px pill + 12px + safe area, so the last row can scroll clear of both |

## Hard rules (from engineering principles)

- Never put `animation` and `transition` on the same property of the same element (WebKit drops the transition). The bar uses **transitions only**: `height .28s cubic-bezier(.2,.8,.2,1)`, cell colours `.18s`. No keyframe animations anywhere in this change.
- Focus rings and gold overlay rings via `box-shadow` only. Never `outline`. Suggested focus: `box-shadow: 0 0 0 2px var(--bgs-bg), 0 0 0 4px var(--bgs-gold)`. Note the pills already use `box-shadow` for depth — append the focus ring to that list on `:focus-visible` rather than replacing it.
- Selected cover ring stays `box-shadow: inset 0 0 0 2px var(--bgs-gold)` (existing behaviour, don't change).
- Respect `prefers-reduced-motion: reduce` — set the bar and cell transitions to `none`.

---

## Commit 1 — bar + floating pills, naming deferred

**Files:** the shelf page's packing sheet markup, its CSS, and the packing-mode JS (locate via the existing "Name the bag" string / the players-cells renderer).

1. Remove the name input from the packing sheet. Keep its markup and validation in a new `.bag-name` step (see Commit 2) — do not delete it.
2. Replace the sheet body with the bar structure below. Keep whatever element the JS uses as the sheet root so show/hide logic is untouched.

```html
<div class="bag-dock">
  <div class="bag-dock__float">
    <button type="button" class="bag-dock__cancel">Cancel</button>
    <button type="button" class="bag-dock__pack" disabled>Pack</button>
  </div>
  <div class="bag-dock__bar">
    <div class="bag-dock__row">
      <div class="bag-dock__left">
        <div class="bag-dock__count"><span data-bag-count>0</span><small>games</small></div>
        <div class="bag-dock__time" data-bag-time>–</div>
      </div>
      <div class="bag-dock__right">
        <div class="bag-dock__strip" data-bag-strip></div>
        <div class="bag-dock__labels"><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8+</span></div>
      </div>
    </div>
    <div class="bag-dock__gaps" data-bag-gaps></div>
  </div>
</div>
```

3. Port the CSS from the mockup's `#A4` block and the shared `.strip` rules, renaming selectors to the BEM names above and swapping any literal colours for the production tokens in `css/base.css`. The mockup's token *values* were approximated — the names are authoritative, the values are not.
4. Wire the existing coverage calculation to the new hooks:
   - `[data-bag-count]` → number of games in the bag
   - `[data-bag-time]` → `${min}–${max} min`, or `–` when empty
   - `[data-bag-strip]` → 8 `<span>`s; class `is-covered` when any packed game supports that count (8+ is covered by any game with max ≥ 8), plus `is-gap` on cells 2 and 5 when uncovered and the bag is non-empty
   - `[data-bag-gaps]` → existing warning strings joined with ` · `, empty string when none (CSS hides the empty element)
   - `.bag-dock__pack[disabled]` ↔ bag empty
5. Cancel keeps the existing exit-packing-mode behaviour. Pack now opens the naming step instead of saving.
6. Bump the grid's bottom padding while packing so the last row clears the pills.

**Suggested message:** `feat(bag): replace packing sheet with coverage bar and floating glass actions`

Stop for review.

## Commit 2 — naming step

1. Add the `.bag-name` sheet: slides up over a `rgba(0,0,0,.6)` scrim from the bottom edge, radius 22px top corners, padding 22px 20px 36px, 1px `--bgs-line` top border.
   - `<h2>` "Name the bag" — Fraunces 22 / 500
   - `<p>` "{n} games, {min}–{max} min" — Inter 13 `--bgs-mute`
   - the existing name input, restyled 50px tall, Fraunces 18 / 500, 12px radius, 1px `--bgs-line`, focus ring via `box-shadow: 0 0 0 2px var(--bgs-gold)`
   - footer: `Back` (text button, `--bgs-mute`) left; `Pack the bag` (solid `--bgs-gold`, dark text — the *solid* style, not glass, since it's on a solid surface) filling the rest
2. Back closes the sheet and returns to packing with the selection intact. Tapping the scrim does the same.
3. `Pack the bag` runs the existing save path exactly as Pack did before.
4. Autofocus the input on open (check iOS Safari doesn't need a user gesture; if it does, skip autofocus rather than hack it).

**Suggested message:** `feat(bag): move bag naming to a confirmation step after Pack`

Stop for review.

---

## Deliberate deviations from the mockup

- The mockup's demo bar, reduced-motion checkbox, the rejected options (A / A1 / A2 / A3 / A · 3 rows / B / C) and the phone frame are demo scaffolding — do not port them.
- Mockup cover images and titles are stand-ins; the real grid is untouched.
- Mockup uses `title=""` tooltips on cells; production does not need them.

## Verification checklist

- [ ] Bar is 76px tall (excl. safe area) with an empty or gap-free bag, 102px with gaps; measure in DevTools
- [ ] Bar content left edge aligns exactly with the first column of covers
- [ ] Pills sit 12px above the bar border and 16px from the right edge; blur visibly shows cover colour through them when scrolling the grid
- [ ] Pack is disabled with an empty bag and enabled at one game
- [ ] Pack Brass + Nippon only → cells 2–4 gold, amber dot under 5, line reads "Nothing for 5 · Nothing under 30 min"
- [ ] Add a 1-player game → cell 1 turns gold; add a 5-player game → dot under 5 disappears and line updates
- [ ] Clear the bag → strip goes fully dim, time shows "–", gap line hidden, Pack disabled
- [ ] Tap Pack → naming sheet opens with the correct count and time; Back returns with selection intact; "Pack the bag" saves and lands on the bag page as before
- [ ] Last grid row can scroll fully above the pills
- [ ] `prefers-reduced-motion` → no transitions on the bar or cells
- [ ] No `outline` anywhere in the diff; focus rings visible on both pills and the name input via keyboard
- [ ] No `animation` added anywhere in the diff
- [ ] Safari iOS: `-webkit-backdrop-filter` present; Chrome/Firefox: `@supports not` fallback renders near-solid pills
- [ ] No console errors; Supabase calls unchanged (diff shows no `.rpc(` / `.from(` changes)

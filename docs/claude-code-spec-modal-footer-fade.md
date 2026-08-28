# Spec: Game modal — footer fade + glass Close

**Scope:** one file, `css/game-modal.css`. No markup or JS changes.
**Design reference:** `docs/mockups/modal-footer-fade-mockup.html` (the "Proposed" tab). Copy it into `docs/mockups/` from this PR's attachments before starting.
**Applies to:** every page that opens the game modal — `index.html`, `night-host.html`, `vote.html` — since they all consume this one stylesheet.

---

## Problem

`.card-sticky` already paints a gradient, but it is 72% solid plate and sits as a flex **sibling** of `#card-body`. Content never scrolls underneath it, so the bottom of the modal reads as a hard edge and users don't realise Highlights and the tag exist below the fold.

## Change

Float the footer over the scroll area with a true transparent → plate fade, pad the body so the last item can scroll clear of the Close button, and make Close a tinted-glass button so the content passing behind it is visible.

Before touching anything, run `grep -rn "card-sticky\|modal__close\|card-body" --include=*.css --include=*.js --include=*.html .` and confirm no page overrides these selectors. If one does, stop and flag it.

---

## Edit 1 — `.card-sticky` floats over the body

**Before**
```css
.card-sticky{
  flex:none;
  padding:12px 20px calc(14px + env(safe-area-inset-bottom));
  background:linear-gradient(to top, var(--bgs-plate) 72%, rgba(36,26,16,0));
  display:flex;gap:10px;
}
```

**After**
```css
.card-sticky{
  position:absolute;left:0;right:0;bottom:0;z-index:5;
  padding:28px 20px calc(14px + env(safe-area-inset-bottom));
  /* Solid behind the button, then a 28px fade at the top edge so content
     visibly slides under it. */
  background:linear-gradient(to top,
    var(--bgs-plate) 0%,
    var(--bgs-plate) 62%,
    rgba(var(--bgs-plate-rgb),0) 100%);
  display:flex;gap:10px;
}
```

`--bgs-plate-rgb` does not exist yet. Add it to `:root` in `css/base.css` directly below `--bgs-plate`:
```css
--bgs-plate-rgb:36,26,16;
```
(`.card` already has `position:relative`, so absolute positioning resolves against it. The `#close-btn` in the corner is `z-index:10` and stays on top.)

## Edit 2 — `#card-body` clears the button

**Before**
```css
#card-body{
  padding:30px 30px 26px;
  flex:1 1 auto;
  min-height:0;
  overflow-y:auto;
}
```

**After**
```css
#card-body{
  /* Bottom padding = Close button's top edge + 20px, so the last item can
     scroll clear of the button without leaving a dead gap. */
  padding:30px 30px calc(78px + env(safe-area-inset-bottom));
  flex:1 1 auto;
  min-height:0;
  overflow-y:auto;
}
```

## Edit 3 — `.modal__close` becomes glass

**Before**
```css
.card-sticky .modal__close{
  background:transparent;border:1.5px solid rgba(var(--bgs-ivory-rgb),0.22);
  color:var(--bgs-ivory-70);font:inherit;font-size:13px;font-weight:600;
  padding:13px 16px;border-radius:10px;cursor:pointer;
}
```

**After**
```css
.card-sticky .modal__close{
  /* Tinted glass. Tint must stay >= .65 so full-ivory text keeps 4.5:1
     against a near-white cover scrolling behind it (.72 gives 5.7:1). */
  background:rgba(var(--bgs-plate-rgb),0.72);
  -webkit-backdrop-filter:blur(14px) saturate(1.2);
  backdrop-filter:blur(14px) saturate(1.2);
  border:1.5px solid rgba(var(--bgs-ivory-rgb),0.45);
  box-shadow:0 1px 0 rgba(var(--bgs-ivory-rgb),0.10) inset,
             0 8px 24px -10px rgba(0,0,0,0.6);
  color:var(--bgs-ivory);font:inherit;font-size:13px;font-weight:600;
  padding:13px 16px;border-radius:10px;cursor:pointer;
}
```

Deliberate token changes, do not "tidy" them back:
- `color` ivory-70 → ivory (ivory-70 fails 4.5:1 over light covers).
- `border` .22 → .45 (.22 is 1.9:1 against plate, below the 3:1 non-text minimum; .45 is 3.9:1).

`.modal__add` (gold, selection mode only) is unchanged — it's the primary action and stays solid.

## Edit 4 — fallbacks and focus (new rules, append after Edit 3)

```css
/* Solid plate when blur isn't available or the OS asks for less transparency. */
@supports not (backdrop-filter:blur(1px)){
  .card-sticky .modal__close{background:var(--bgs-plate);}
}
@media (prefers-reduced-transparency:reduce){
  .card-sticky .modal__close{
    background:var(--bgs-plate);
    -webkit-backdrop-filter:none;backdrop-filter:none;
  }
}
/* Visible keyboard focus on the dark plate. */
.close-btn:focus-visible,
.card-sticky button:focus-visible{
  outline:2px solid var(--bgs-gold);outline-offset:2px;
}
```

---

## Verification

Test with `?gamenight=1` on `index.html` so both footer states are reachable. Use **Dune: Imperium – Uprising** (dark cover) and a light-box game such as **Azul** or **Cascadia** for the worst-case contrast pass.

- [ ] Open a modal on iPhone Safari. Highlights list is partially visible under the fade before scrolling; the fade is gradual, not a hard band.
- [ ] Scroll to the end: the tag sits just above Close with ~20px gap, no large empty area, nothing hidden under the button.
- [ ] Scroll a cover image behind Close on a light-box game: cover is visibly blurred through the button and "Close" text remains clearly readable.
- [ ] Enter selection mode: gold **Add to tonight** + glass **Close** sit side by side, same height, nothing overlaps the corner ✕.
- [ ] Toggle "In tonight's deck" state — outlined gold button still renders correctly next to glass Close.
- [ ] iOS Settings → Accessibility → Display → Reduce Transparency ON: Close renders solid plate, layout otherwise identical.
- [ ] Keyboard (desktop): Tab reaches ✕ and Close; both show a gold focus ring.
- [ ] Backdrop tap still closes; body scroll lock (`scroll-lock.js`) unaffected — page behind doesn't scroll while the modal scrolls.
- [ ] Repeat the first two checks on `night-host.html` and `vote.html`.
- [ ] Safe area: on a notched iPhone the button bottom padding respects the home indicator (no change from today).

## Commit

`fix(modal): float footer with fade and glass Close so below-fold content is discoverable`

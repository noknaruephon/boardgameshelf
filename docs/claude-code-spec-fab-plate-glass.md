# Spec: Game Night FAB — plate glass

**Scope:** one CSS block, `.gn-fab` in `index.html` (inline `<style>`, around line 573). No markup or JS changes.
**Depends on:** `--bgs-plate-rgb: 36,26,16;` in `css/base.css`. This token is added by `claude-code-spec-modal-footer-fade.md`. If that spec hasn't landed yet, add the token now, directly below `--bgs-plate`.
**Design reference:** `docs/mockups/fab-glass-mockup.html` → "1 Plate glass".

---

## Goal

Turn the solid-plate pill into tinted glass so cover art is faintly visible through it, using the same glass recipe as the modal's Close button so the two read as one system. Gold text, gold border, size, position, hover, active, and the selection-mode exit animation are all unchanged.

Before editing, run `grep -rn "gn-fab" --include=*.html --include=*.css --include=*.js .` and confirm `.gn-fab` is styled only in `index.html`. If it's styled elsewhere, stop and flag it.

---

## Edit 1 — `.gn-fab` background, border, shadow

Only the three marked lines change. Everything else in the block stays exactly as-is.

**Before**
```css
.gn-fab{
  position:fixed;
  left:16px;
  bottom:calc(16px + env(safe-area-inset-bottom));
  z-index:12;
  display:inline-flex;
  align-items:center;
  gap:8px;
  height:46px;
  padding:0 18px 0 15px;
  background:var(--bgs-plate);
  border:1.5px solid rgba(var(--bgs-gold-rgb),0.55);
  border-radius:999px;
  color:var(--bgs-gold);
  font-family:'Inter',sans-serif;
  font-size:13.5px;
  font-weight:700;
  letter-spacing:0.01em;
  cursor:pointer;
  white-space:nowrap;
  box-shadow:0 6px 20px rgba(0,0,0,0.5);
  transition:transform 0.18s cubic-bezier(.2,.8,.3,1), opacity 0.18s ease, border-color 0.18s ease;
}
```

**After**
```css
.gn-fab{
  position:fixed;
  left:16px;
  bottom:calc(16px + env(safe-area-inset-bottom));
  z-index:12;
  display:inline-flex;
  align-items:center;
  gap:8px;
  height:46px;
  padding:0 18px 0 15px;
  /* Tinted glass. Tint stays >= .82: gold text is lower-contrast than ivory,
     and .82 is where it clears 4.5:1 over a white cover (4.87:1). */
  background:rgba(var(--bgs-plate-rgb),0.82);
  -webkit-backdrop-filter:blur(16px) saturate(1.2);
  backdrop-filter:blur(16px) saturate(1.2);
  border:1.5px solid rgba(var(--bgs-gold-rgb),0.55);
  border-radius:999px;
  color:var(--bgs-gold);
  font-family:'Inter',sans-serif;
  font-size:13.5px;
  font-weight:700;
  letter-spacing:0.01em;
  cursor:pointer;
  white-space:nowrap;
  box-shadow:0 1px 0 rgba(var(--bgs-ivory-rgb),0.08) inset,
             0 8px 24px -10px rgba(0,0,0,0.7);
  transition:transform 0.18s cubic-bezier(.2,.8,.3,1), opacity 0.18s ease, border-color 0.18s ease;
}
```

Notes:
- The mockup used a `.45` border. Ship `.55` (i.e. **leave the border line unchanged**): `.45` is 2.8:1 against plate, under the 3:1 non-text minimum; `.55` clears it. Visual difference is negligible.
- `.gn-fab:hover`, `:active`, `svg`, and `body.gn-selecting .gn-fab` blocks: do not touch.

## Edit 2 — fallbacks and focus (new rules, append directly after `.gn-fab svg{…}`)

```css
/* Solid plate when blur isn't available or the OS asks for less transparency. */
@supports not (backdrop-filter:blur(1px)){
  .gn-fab{background:var(--bgs-plate);}
}
@media (prefers-reduced-transparency:reduce){
  .gn-fab{
    background:var(--bgs-plate);
    -webkit-backdrop-filter:none;backdrop-filter:none;
  }
}
.gn-fab:focus-visible{outline:2px solid var(--bgs-gold);outline-offset:3px;}
```

If a `:focus-visible` rule for `.gn-fab` already exists, keep the existing one and skip that line.

---

## Verification

Test on `index.html` with `?gamenight=1`.

- [ ] iPhone Safari: scroll the shelf so a light cover (Things in Rings, A Fake Artist, Bohnanza) sits under the pill. Cover is faintly visible and blurred through the pill; "Game Night" label remains clearly readable.
- [ ] Same with a dark cover (Uprising, Spirit Island): pill looks near-identical to today — the glass should be subtle, not showy.
- [ ] Pill size, position, and gold border are pixel-identical to production (compare against a screenshot of the current build).
- [ ] Hover brightens the border to full gold; press scales to .95 — both unchanged.
- [ ] Tap the pill → selection mode: the pill still animates down and out; bottom bar appears; no flash of solid plate during the exit.
- [ ] Exit selection mode: pill returns with the glass intact.
- [ ] iOS Settings → Accessibility → Display → Reduce Transparency ON: pill renders solid plate, otherwise identical.
- [ ] Desktop keyboard: Tab to the pill shows a gold focus ring.
- [ ] Toast (`.gn-toast`) still clears the pill — its 78px bottom offset is unaffected.
- [ ] Scroll performance on an older iPhone: no jank from `backdrop-filter` while the grid scrolls. If there is, reduce blur to 12px before reducing the tint.

## Commit

`style(fab): plate-glass Game Night pill, matching the modal Close`

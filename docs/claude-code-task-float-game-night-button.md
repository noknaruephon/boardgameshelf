# Claude Code Task — Float the "Start Game Night" button

**Small change, UI only.** No logic changes, no new features. The button does exactly
what it does today; only its position, appearance, and visibility rules change.

---

## 1. Find the current implementation first

The button was added in the Stage 1 session-creation work, currently gated behind
`GAME_NIGHT_ENABLED` / `?gamenight=1`. Locate its markup, CSS, and the code that
decides whether to render it before changing anything. Do not assume the class names
or structure described below match what exists — adapt.

**A reference implementation accompanies this task** (`fab-mockup.html`). It shows the
approved appearance, exit/entry animation, and the icon (a simple dotted-die glyph,
inline SVG, no icon library dependency). Match its look and behaviour; adapt the
markup to fit the real button's existing structure and event wiring rather than
replacing it wholesale.

---

## 2. What changes

### Position
Move it out of the header. It becomes a **floating action button fixed to the bottom-left**
of the viewport.

```css
position:fixed;
left:16px;
bottom:calc(16px + env(safe-area-inset-bottom));
z-index:12;
```

`z-index` must sit **below** the selection bottom bar (15), the tray (14), and the
scrim (13), and below the filter sheet and detail modal. It should never overlap a
modal or sheet.

### Appearance
A **pill**, not a circle. This is a discovery-dependent action — an unlabelled icon
gives no clue what it does.

- Background `--bgs-plate`, border `1.5px solid rgba(var(--bgs-gold-rgb),.55)`, text
  and icon in `--bgs-gold`. This matches the existing plate-background-with-gold-border
  language already used elsewhere on the card (e.g. the rating pill), so it reads as
  part of the site's vocabulary rather than a bolt-on. **Do not use a solid gold fill**
  — that was tried and rejected; it competes too hard with the cover art, which is the
  page's whole point.
- Border brightens to full opacity `--bgs-gold` on `:hover` — confirms interactivity
  without needing a fill change.
- Fully rounded (`border-radius:999px`).
- Icon plus label. Label: **"Game Night"** — shorter than "Start Game Night" and
  clearer in a compact pill. Keep the accessible name as "Start Game Night" via
  `aria-label`.
- A shadow so it reads as floating above the grid rather than pasted onto it:
  `box-shadow:0 6px 20px rgba(0,0,0,.5)`.
- Minimum 44px tall for touch (46px in the approved mockup).
- Standard press feedback — a slight scale-down on `:active`, matching whatever the
  rest of the site does.

### Visibility
- **Hidden in selection mode.** The bottom bar owns that state; the host has already
  started, so the entry point is noise. Hide it whenever `selectionMode` is true.
- Animate out rather than snapping — fade plus a small scale or downward translate,
  around 180ms. It should feel like it's handing off to the bottom bar, and it should
  animate back in on cancel.
- Still gated by the existing feature flag. When the flag is off, it isn't in the DOM
  at all — do not weaken that to a CSS hide.

---

## 3. Check for collisions

Before finalising, confirm the FAB doesn't overlap or obscure:

- Any existing floating or sticky control at the bottom of the viewport. **If something
  already sits bottom-left or bottom-right, stop and flag it** rather than stacking
  them.
- The last row of cards when scrolled to the bottom. If the FAB covers part of it, add
  bottom padding to the shelf container equal to the FAB height plus its offset.
- The footer text ("195 games in the collection…").

---

## 4. Do not

- Change what the button does, or any session-creation logic.
- Change the mode chooser, selection mode, the tray, or the bottom bar.
- Alter the feature flag behaviour.
- Introduce new colour values. `--bgs-gold` and `--bgs-plate` already exist.

---

## 5. Verification

- [ ] With `?gamenight=1`, the pill floats bottom-left and stays put while scrolling.
- [ ] Without the flag, it's absent from the DOM entirely.
- [ ] Tapping it opens the mode chooser exactly as before.
- [ ] Entering selection mode animates it out; cancelling animates it back.
- [ ] It never overlaps the bottom bar, tray, scrim, filter sheet, or detail modal.
- [ ] Scrolled to the bottom, the last row of cards is fully readable — not covered.
- [ ] On a narrow phone (~360px), the pill doesn't crowd the screen or wrap its label.
- [ ] Touch target is at least 44px tall.
- [ ] Colours match the mockup exactly: `--bgs-plate` fill, gold border at ~55%
      opacity brightening on hover — not a solid gold fill.

> **Stats radar removed** in commit "Remove Stats radar from game modal" (branch `claude/teach-section-impl-33fuqd`); the table-shot toggle in this spec still stands.

# Spec: Details modal — table-shot toggle + Stats fingerprint section

**Design source of truth:** `docs/mockups/details-modal-visuals.html` (commit alongside this spec).
Open it in a browser; use the game pills to see all three states (full data / full data / sparse data) and the reduced-motion toggle.

**Scope:** two additive features on the game details modal. No changes to existing sections (stat chips, description, highlights, category line).

1. **Media toggle** — a `Cover | On the table` segmented control directly under the game image. Switching crossfades between the box cover and a table-shot photo. Games without a table shot render exactly as today: no toggle, no second layer.
2. **Stats section** — a five-axis radar ("fingerprint") appended as the last section of the modal body, after the category line. Games without fingerprint data render no section at all (no header, no divider).

---

## 0. Verify before writing (required)

This spec was written against a mockup, not the live codebase. Before implementing, locate and confirm the real identifiers. Do not trust any class name in this document until verified.

```bash
grep -n "modal" js/game-modal.js | head -30        # modal open/render/close functions
grep -n "cover\|img\|image" js/game-modal.js | head -20   # cover element + how src is set
grep -n "highlight\|categor" js/game-modal.js | head      # where body sections are appended (Stats goes after)
grep -n -- "--bgs-" index.html | head -20          # confirm token names and values
```

Also confirm in `css/game-modal.css`:
- The section-header rule used by HIGHLIGHTS (Stats reuses it — do not duplicate).
- Whether the modal body scroll container clips overflow (affects radar label rendering — see §4).

**Token caution:** the mockup's `:root` token values are *approximations* (only `--bgs-bg` was confirmed). Use production tokens everywhere; the contrast numbers in §6 must be recomputed against real values.

---

## 1. Data model (`games.json`)

Two new optional fields per game. Absent field = feature hidden for that game. No migration needed; ship data progressively.

```jsonc
{
  "id": 224517,
  "name": "Brass: Birmingham",
  // ... existing fields unchanged ...
  "tableShot": "images/table/224517.webp",     // optional; relative path
  "fingerprint": {                              // optional; all five axes required if present
    "complexity": 4.8,                          // 0–5, one decimal
    "luck": 1.4,
    "interaction": 3.4,
    "length": 4.2,
    "strategy": 5
  }
}
```

Rules:
- `fingerprint` is all-or-nothing: if any axis is missing, treat as absent (hide section). Validate on render, don't crash.
- Asset convention for table shots: `images/table/{bggId}.webp`, 16:10, ~1200 px wide, compressed for web (~150 KB target).
- Fingerprint values are **precomputed and stored**, not derived at runtime — keeps the static-site architecture simple. Phase 1: hand-author for an initial batch. Appendix A documents a derivation heuristic if we later automate it in the sync script.

---

## 2. Media toggle

### Markup (reference — adapt to the real modal structure)

The existing cover `<img>` becomes one of two absolutely-positioned layers inside the media container. Toggle row sits between the media block and the modal body.

```html
<div class="modal-media">
  <img class="media-layer media-cover on" src="{cover}" alt="{name} box cover">
  <!-- only rendered when game.tableShot exists: -->
  <img class="media-layer media-table" src="{tableShot}" alt="{name} set up on a table" loading="lazy" aria-hidden="true">
</div>
<!-- only rendered when game.tableShot exists: -->
<div class="media-toggle-row">
  <div class="media-toggle" role="group" aria-label="Game image view">
    <button type="button" data-view="cover" aria-pressed="true">Cover</button>
    <button type="button" data-view="table" aria-pressed="false">On the table</button>
  </div>
</div>
```

(The mockup includes small inline SVG icons for the two buttons; carry them over.)

### CSS (reference)

```css
.modal-media{position:relative; aspect-ratio:16/10; background:#000; overflow:hidden}
.media-layer{
  position:absolute; inset:0; width:100%; height:100%; object-fit:cover;
  opacity:0;
  transition:opacity .32s ease;   /* transition ONLY — see WebKit rule below */
}
.media-layer.on{opacity:1}
@media (prefers-reduced-motion: reduce){ .media-layer{transition:none} }
```

Gold selected state on the toggle buttons uses `box-shadow: inset 0 0 0 1px rgba(var(--bgs-gold-rgb), .55)` — **never `outline`** (outline paints beneath child elements; established project rule).

### Behavior

- Modal open (and re-open) always resets to Cover.
- Click toggles `aria-pressed` on both buttons and swaps `.on` / `aria-hidden` on the layers **in place** — do not re-render the media block, or the crossfade won't run.
- The table `<img>` is in the DOM from modal open with `loading="lazy"`, so the browser fetches it before/at first toggle rather than showing a blank frame.
- If the table image fails to load (`onerror`), remove the toggle row and table layer — degrade to today's behavior silently.

### ⚠️ WebKit animation/transition conflict (hard project rule)

`.media-layer` carries a `transition` on `opacity`. **No CSS `animation` may ever touch these elements** — not opacity, not anything, including any modal-entrance animation that might currently target the cover image. During verification (§0), check whether the existing modal open animation animates the image; if it does, move that entrance animation to the `.modal-media` **parent** so the layers keep transition-only. This exact conflict has burned the project twice.

---

## 3. Stats section

Appended after the category line, inside the modal body. Rendered only when `game.fingerprint` is valid.

```html
<section class="fp-section">
  <h3>Stats</h3>   <!-- reuse the production HIGHLIGHTS header class/rule; do not duplicate styles -->
  <div class="fp-chart"><!-- SVG injected by renderer --></div>
</section>
```

- `.fp-section` gets the same top divider treatment as other section breaks (`border-top: 1px solid rgba(var(--bgs-ivory-rgb), .08)` in the mockup — match production).
- When hidden, the element is not rendered at all (no `display:none` remnant, no stray divider).

---

## 4. Radar renderer

Port `renderFingerprint()` from the mockup (self-contained, no dependencies). Key requirements:

```js
const FP_AXES = ["Complexity", "Luck", "Interaction", "Length", "Strategy"]; // display order, 12 o'clock first, clockwise
const FP_MAX = 5;
const FP_R = 88;                  // radar radius
const FP_LABEL_GAP = 1.23;        // labels drawn at R * FP_LABEL_GAP from center
const FP_LABEL_CLEARANCE = 85;    // horizontal px reserved per side for label text

// viewBox is DERIVED, not a magic number — if axis names or font size change, this adapts:
const FP_CX = FP_R * FP_LABEL_GAP + FP_LABEL_CLEARANCE;        // 193 → round to taste
const FP_W  = FP_CX * 2;
```

(The mockup ships 360×265 with cx=180; the derivation above is the rule that produced it. `FP_LABEL_CLEARANCE` must fit the longest axis name at the final font size — "Interaction" was the constraint. If labels ever clip, this constant is the fix, not the radius.)

- SVG: `viewBox` only, `width:100%; max-width:360px; height:auto; overflow:visible` — scales down to 320 px viewports without clipping.
- Polygon: `fill rgba(gold,.18)`, `stroke gold 2px`, vertex dots gold `r=3`; grid rings at 1/3, 2/3, 3/3 in `ivory` at low alpha.
- **Bloom animation:** `animation` on the polygon's `transform` (scale .6→1) with `transform-origin` at the radar center. The polygon has **no `transition` on any property** — same WebKit rule as §2, opposite direction.
- Reduced motion: `@media (prefers-reduced-motion: reduce){ .radar-shape{animation:none} }`.
- Re-trigger the bloom each time the modal opens (re-inject the SVG or restart the animation); it should not only play on the first-ever open.

---

## 5. Accessibility

- Radar SVG: `role="img"` + `aria-label="Stats: Complexity 4.8 out of 5, Luck 1.4 out of 5, …"` — the numeric readout was removed visually, so this label is the *only* channel for exact values. Non-negotiable.
- Toggle: real `<button>`s, `aria-pressed`, `role="group"` with `aria-label="Game image view"`, visible `:focus-visible` ring in gold.
- Inactive media layer: `aria-hidden="true"`, and its `alt` texts differ meaningfully (box cover vs. set up on a table).
- **Contrast (recompute with production tokens):** against the approximated plate `#221711`, radar axis labels at `ivory-45` measure ≈ **3.9:1** — passes 3:1 non-text but *fails* 4.5:1 for the 10 px label text. **Use `ivory-70` for radar labels** (≈ 8.2:1 ✓). Gold `#D9A441` on plate ≈ 7.8:1 ✓ for the header and radar stroke (needs 3:1 as non-text ✓). This is a deliberate deviation from the mockup's label color, made for WCAG — keep it.
- `@supports not (backdrop-filter: …)` fallbacks: none needed in the final design (the badge that used blur was removed).

---

## 6. Verification checklist

- [ ] Safari/WebKit: crossfade animates in **both** directions (cover→table and table→cover). If one direction snaps, an `animation` is colliding with the transition — see §2.
- [ ] Chrome + Safari: radar bloom plays on every modal open; no bloom with reduced motion enabled (OS setting and DevTools emulation).
- [ ] Game with no `tableShot`: no toggle row, no layout shift versus production, media block identical to today.
- [ ] Game with no/partial `fingerprint`: no Stats section, no stray divider, modal ends at category line.
- [ ] 320 px viewport: all five radar labels fully visible (test the longest, "Interaction"); SVG scales, no horizontal scroll.
- [ ] Keyboard: tab reaches both toggle buttons, gold focus ring visible, Enter/Space toggles, `aria-pressed` updates.
- [ ] VoiceOver: radar announces "Stats" + all five values; inactive image layer is skipped.
- [ ] Modal close → reopen: resets to Cover view.
- [ ] Table image 404: toggle disappears, no broken-image frame.
- [ ] Regression: stat chips, description, HIGHLIGHTS, category line unchanged; title clamp still holds on long names (padding lives on `.meta` wrapper, not `.t` — do not touch).
- [ ] Contrast ratios re-verified with production token values (§5).

---

## 7. Suggested commits

1. `feat(modal): add cover/table-shot toggle with crossfade to details modal`
2. `feat(modal): append Stats fingerprint radar section; hidden when no data`
3. `data: add tableShot + fingerprint fields for initial game batch`

---

## Appendix A — fingerprint derivation heuristic (phase 2, optional)

If fingerprint generation moves into the BGG sync script instead of hand-authoring:

- **Complexity** = BGG weight, clamped 0–5.
- **Length** = scale of max playtime: ≤20 m → 1, ≤45 → 2, ≤75 → 3, ≤120 → 4, >120 → 5.
- **Luck** = base 1 + per-mechanic bumps (Dice Rolling +1.5, Push Your Luck +1.5, Card Drafting +0.5, Roll-and-Move +2), clamped 0–5.
- **Interaction** = base 1 + bumps (Trading +2, Negotiation +2, Team-Based +2, Take That +1.5, Auction +1.5, Area Majority +1, Solo/coop vs. AI −1), clamped.
- **Strategy** = weight-anchored (weight ≥3 → 4–5) with Party/Children's categories forcing ≤2.

Hand-tuned values always win over derived ones (a `fingerprintSource` field can track which is which if useful). Any automated pass should be spot-checked against ~10 games spanning the shelf before committing.


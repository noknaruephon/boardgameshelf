# Spec: Vote screen loading state — "Dealing the deck"

**Design source of truth:** `game-night-loading-options.html` (mockup), **Option A · Dealing the deck**.
**Target:** `vote-swipe.html` only — the static shell shown between page load and the first `screen.innerHTML` render.
**Verified against `main`** as of 2026-08-31: shell markup at `vote-swipe.html` line ~340, shared card back `.deck-card.back` and `@keyframes bgs-deal` in `css/base.css`, `shuffleHTML()` in `js/waiting-room.js` line 75.

---

## What changes

The swipe page currently boots into a bare shell:

```html
<div class="screen" id="screen">
  <div class="eyebrow">Game Night</div>
  <h1>Loading&hellip;</h1>
</div>
```

Replace it with the deal-in animation: four face-down cards fly in one at a time, land with scattered tilts, square up into a neat deck, a gold ring pulses once, then the loop restarts. Pure CSS, so it animates even before the module script resolves (the module-import failure mode documented at the top of the script leaves this shell on screen — it should still look alive, matching today's behavior where the static "Loading…" also just sits there).

## Design decisions (divergences from the mockup — intentional)

1. **Face-down `.deck-card.back` cards, not the mockup's colored cover gradients.** base.css's own comment establishes the rule: the card back is *one component, not a third copy*, and every game-night holding state draws it. The loader joins that family. Face-down also can't leak anything, consistent with the shuffle's rationale.
2. **Keyframe names `bgs-deal-in` and `bgs-ring-pulse`.** `@keyframes bgs-deal` already exists in base.css (the waiting shuffle) — do **not** reuse or shadow it.
3. **CSS lives in `vote-swipe.html`'s inline `<style>` block**, not base.css. It's used by one page. If the waiting room later adopts it, promote to base.css in that PR, not this one.
4. **Copy: `Dealing tonight's picks&hellip;`** replaces `Loading&hellip;`. Matches the animation's verb; "tonight's picks" is the flow's existing vocabulary.
5. **Distinct from `.shuffle` on purpose.** Shuffle = holding the table (waiting/tallying). Deal-in = gathering the games. Two different messages, two different motions.

## Hard constraints (do not relax)

- **WebKit rule:** never a CSS `animation` and a CSS `transition` on the same property of the same element. Every moving part below has exactly one `animation` and no transitions. The ring pulse is a **separate element** from the cards.
- **Gold ring uses `box-shadow: inset`**, never `outline`.
- Don't add `.clickable` to these cards (it carries a `transform` transition in base.css — would violate the rule above).

## Implementation

### 1. Shell markup (`vote-swipe.html`, replaces the block at ~line 340)

```html
<div class="screen" id="screen">
  <div class="eyebrow">Game Night</div>
  <h1>Dealing tonight's picks&hellip;</h1>
  <div class="deal-wrap">
    <div class="deal" aria-hidden="true">
      <div class="deck-card back">?</div>
      <div class="deck-card back">?</div>
      <div class="deck-card back">?</div>
      <div class="deck-card back">?</div>
      <div class="deal-ring"></div>
    </div>
  </div>
</div>
```

Markup mirrors `shuffleHTML()`: `aria-hidden` on the animation wrapper, `?` glyph on the shared card back. Nothing else in the shell changes; `renderEnded()` and the voting/waiting renders already overwrite `screen.innerHTML` wholesale, so no JS changes are needed.

### 2. CSS (add to the page's `<style>` block, near the existing `/* ---- waiting state ---- */` section)

```css
/* ---- initial loading state: dealing the deck ----
   Four face-down cards dealt into the vote deck, then a gold ring pulse.
   Cards animate transform+opacity only; the ring animates box-shadow only,
   on its own element — one animation per element, no transitions (WebKit). */
.deal-wrap{height:120px;display:flex;align-items:center;justify-content:center;margin:26px 0 0;}
.deal{position:relative;width:64px;height:85px;}
.deal .deck-card{
  position:absolute;inset:0;width:64px;height:85px;
  border-radius:8px;font-size:18px;
  box-shadow:0 8px 18px rgba(0,0,0,.45);
  opacity:0;
  animation:bgs-deal-in 3.4s cubic-bezier(.3,.7,.3,1) infinite;
}
.deal .deck-card:nth-child(1){--rest:rotate(-5deg);}
.deal .deck-card:nth-child(2){--rest:rotate(4deg);animation-delay:.22s;}
.deal .deck-card:nth-child(3){--rest:rotate(-2deg);animation-delay:.44s;}
.deal .deck-card:nth-child(4){--rest:rotate(0deg);animation-delay:.66s;}
@keyframes bgs-deal-in{
  0%   {opacity:0;transform:translate(110px,-90px) rotate(28deg);}
  12%  {opacity:1;transform:translate(0,0) var(--rest);}   /* lands, tilted */
  16%  {transform:translate(0,0) var(--rest);}
  30%  {transform:translate(0,0) rotate(0deg);}            /* squares up */
  84%  {opacity:1;transform:translate(0,0) rotate(0deg);}
  94%,100%{opacity:0;transform:translate(0,0) rotate(0deg);}
}
.deal-ring{
  position:absolute;inset:-7px;border-radius:13px;pointer-events:none;
  box-shadow:inset 0 0 0 2px rgba(var(--bgs-gold-rgb),0);
  animation:bgs-ring-pulse 3.4s infinite;
}
@keyframes bgs-ring-pulse{
  0%,30%{box-shadow:inset 0 0 0 2px rgba(var(--bgs-gold-rgb),0);}
  40%   {box-shadow:inset 0 0 0 2px rgba(var(--bgs-gold-rgb),.7);}
  58%,100%{box-shadow:inset 0 0 0 2px rgba(var(--bgs-gold-rgb),0);}
}
```

Notes:
- `--rest` per-card custom property keeps one shared keyframe block instead of four near-duplicates.
- Duration and delays match the approved mockup (3.4s loop, .22s stagger). The last card lands at ~1.4s, ring pulses at ~1.36s–2.0s — a full "gather → assembled" beat completes even on fast loads before the real render swaps in.
- Card size 64×85 keeps the shared 3:4 card proportion at a hero-ish scale (the base 44px `.deck-card` reads too small alone at screen center).

### 3. Reduced motion (extend the existing `@media (prefers-reduced-motion:reduce)` block in this page)

```css
.deal .deck-card{animation:none;opacity:1;transform:translate(0,0) rotate(0deg);}
.deal-ring{animation:none;box-shadow:inset 0 0 0 2px rgba(var(--bgs-gold-rgb),.45);}
```

Static assembled deck with a steady half-strength gold ring — same information (something is being prepared), no motion. Nothing here relies on an animation to become visible, matching the page's existing reduced-motion rationale.

## Accessibility

- The `h1` carries the state for screen readers; the animation is `aria-hidden`, same pattern as `shuffleHTML()`.
- Ring at `rgba(gold,.7)` peak / `.45` static against `--bgs-plate` clears the 3:1 WCAG non-text contrast minimum for a decorative-but-informative indicator; it is not the sole loading signal (the `h1` text is).
- `prefers-reduced-motion` fully suppresses both animations via the page's existing media block.

## Verification checklist

- [ ] Load `/vote/{code}/swipe` on a slow connection (DevTools throttling): deal-in plays immediately, before the module script resolves.
- [ ] Safari (or iOS Simulator): cards fly in, square up, ring pulses — no skipped motion. This is the WebKit-conflict smoke test.
- [ ] `?debug=1` with a bad code: `renderEnded()` fully replaces the loader — no orphaned cards or ring.
- [ ] Fast load: swap from loader to voting screen doesn't flash mid-animation artifacts (cards are `position:absolute` inside `.deal`, so removal is atomic with `screen.innerHTML`).
- [ ] `prefers-reduced-motion: reduce` (macOS: Reduce Motion): static deck + steady ring, `h1` unchanged.
- [ ] Waiting/tallying states still use `.shuffle` untouched; `@keyframes bgs-deal` in base.css unmodified.
- [ ] No new CSS in base.css; no JS changes.

## Suggested commit message

```
vote-swipe: replace static loading text with deal-in deck animation

Four face-down cards (shared .deck-card.back) deal into the vote deck
with a gold ring pulse while the session loads. Pure CSS in the static
shell, so it runs before the module script resolves. One animation per
element, no transitions on animated properties (WebKit rule); ring is
inset box-shadow. Reduced motion: static assembled deck.
```

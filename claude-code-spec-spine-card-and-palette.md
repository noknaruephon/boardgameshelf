# BoardgameShelf — Spine Card Redesign + Global Palette Update
**Spec for Claude Code implementation**
**Source of truth:** `option-a-final.html` mockup (locked design)

---

## 1. Goal

Replace the current shelf card treatment (rotated title stamped on cover art, raw stars, dark tint overlay) with a cover-forward grid card: full untouched artwork + a fixed-color label plate underneath carrying title and rating. Then extend the plate's color tokens to become the site's single source of truth for color — replacing any ad hoc/inline colors elsewhere on the page (header, search bar, filter drawer, buttons) with these tokens.

This is a **restyle + component swap**, not a rebuild. Keep all existing data fetching, filtering, search, and modal logic as-is — only touch the shelf card component and the global color tokens.

---

## 2. Design tokens (exact values, locked)

```css
:root {
  --bgs-bg: #160F0A;        /* page background base */
  --bgs-bg-radial: #241708; /* radial gradient top stop, ellipse at top, fading to --bgs-bg at 55% */
  --bgs-plate: #241A10;     /* card label plate — fixed, no per-game variation */
  --bgs-ivory: #F4EBDA;     /* primary text on dark */
  --bgs-ivory-70: rgba(244,235,218,0.72); /* secondary text */
  --bgs-ivory-45: rgba(244,235,218,0.45); /* tertiary/meta text */
  --bgs-gold: #E3B04B;      /* rating, accents, active states */
}
```

Typography (already in use elsewhere on the site per existing tokens — confirm these match, don't introduce new families):
- Display / titles: **Fraunces** (weight 600 for card titles, 500–700 available)
- Body / UI / meta: **Inter**
- If the codebase already defines IBM Plex Mono for data/numeric contexts, keep using it there — don't touch.

---

## 3. Component: `GameCard` (shelf grid card)

### Structure
```
<article class="card">
  <div class="art">              <!-- untouched cover art, no filter, no tint -->
    <img />
  </div>
  <div class="plate-body">        <!-- fixed --bgs-plate background -->
    <h3 class="title">…</h3>      <!-- 2-line clamp, Fraunces 600 -->
    <div class="meta-row">
      <span class="rating-pill">★ {rating.toFixed(1)}</span>
      <span class="players">{minPlayers}–{maxPlayers}</span>
    </div>
  </div>
</article>
```

### TypeScript contract
```ts
interface GameCardProps {
  id: string;
  title: string;
  coverImageUrl: string;
  rating: number;        // 0–5, one decimal display
  minPlayers: number;
  maxPlayers: number;    // sentinel 11 = "11+", reuse existing formatPlayerCount() if present
  onSelect: (id: string) => void; // opens existing detail modal — do not change modal
}
```

### Key rules (non-negotiable — these are the whole point of the redesign)
1. **No filter, tint, or overlay on `.art img`.** Remove whatever dark wash/opacity is currently applied to cover thumbnails site-wide.
2. **Title never renders on top of the image.** It lives only inside `.plate-body`, horizontal orientation (no `rotate()` transforms), `-webkit-line-clamp: 2`.
3. **Rating is a single pill**, not repeated star icons: one star glyph + numeric value, e.g. `★ 4.3`. Solid/opaque background (`rgba(0,0,0,0.3)` over the plate, or adjust to taste) — never rendered directly over the image.
4. **Plate color is always `--bgs-plate`.** No per-game or per-tag color variation.

### CSS
```css
.card {
  border-radius: 10px;
  overflow: hidden;
  background: var(--bgs-plate);
  box-shadow: 0 3px 10px rgba(0,0,0,.35);
  display: flex;
  flex-direction: column;
  transition: transform .15s ease;
}
.card:hover { transform: translateY(-2px); }

.art {
  aspect-ratio: 3/4;
  width: 100%;
  overflow: hidden;
  background: #000;
}
.art img { width: 100%; height: 100%; object-fit: cover; display: block; }

.plate-body {
  padding: 8px 8px 9px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.title {
  font-family: 'Fraunces', serif;
  font-weight: 600;
  font-size: 12.5px;
  line-height: 1.24;
  color: var(--bgs-ivory);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.meta-row { display: flex; align-items: center; justify-content: space-between; gap: 4px; }
.rating-pill {
  display: inline-flex; align-items: center; gap: 3px;
  background: rgba(0,0,0,.3);
  border: 1px solid rgba(227,176,75,.35);
  border-radius: 20px;
  padding: 2px 6px 2px 5px;
  font-size: 10.5px; font-weight: 700;
  color: var(--bgs-gold);
  white-space: nowrap;
}
.players { font-size: 10px; color: var(--bgs-ivory-45); font-weight: 500; white-space: nowrap; }
```

---

## 4. Grid layout

```css
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
@media (min-width: 560px) { .grid { grid-template-columns: repeat(4, 1fr); gap: 14px; } }
@media (min-width: 800px) { .grid { grid-template-columns: repeat(6, 1fr); gap: 16px; } }
```

This replaces the current fixed 5-column mobile layout. Confirm against the live filter/sort controls that this doesn't collide with the existing "Show N games" count or search bar spacing — adjust container padding if needed, but don't change the grid breakpoints above.

---

## 5. Global palette application

The current site already uses a warm dark walnut/brass palette that's close to these tokens — this is largely a **formalization**, not a full repaint. Steps:

1. Audit the codebase for hardcoded colors (inline styles, one-off hex values in component files, Tailwind arbitrary values like `bg-[#...]`) across: header/wordmark, search input, filter drawer (Players/Time/Weight controls), "Reset" and "Show N games" buttons, modal background.
2. Replace each with the closest matching token from Section 2. If an existing color doesn't map cleanly, flag it rather than guessing — some elements (e.g. filter chip active states) may need a token this spec doesn't define; extend the palette minimally rather than introducing an unrelated color.
3. Centralize tokens in whatever the project already uses for this (CSS custom properties in a global stylesheet, or `tailwind.config` theme extension, or a `tokens.ts` — match existing convention, don't introduce a new system).
4. Do not touch the BGG-sourced game description text styling, only structural/chrome colors.

---

## 6. Acceptance criteria

- [ ] No `filter`, `opacity`, or tint applied to any cover art anywhere on the shelf.
- [ ] No rotated text anywhere in the grid view.
- [ ] Rating renders identically legible against both a near-black cover (e.g. Star Wars: Rebellion) and a near-white cover (e.g. Nemesis: Lockdown) — spot check both.
- [ ] Mobile viewport (390px) shows 3 columns, no title truncation beyond the 2-line clamp.
- [ ] All chrome (header, search, filters, buttons) pulls color from the token set in Section 2 — no remaining hardcoded hex values outside the token definitions.
- [ ] Existing filter logic, search, sort, and detail modal behavior unchanged.

---

## 7. Out of scope for this pass

- The "spine shelf" companion view (Option B from design exploration) — separate future task.
- Weight indicator / dots on the card — explicitly excluded from this version.
- Per-game tag color on the plate — explicitly excluded, plate is a single fixed color.

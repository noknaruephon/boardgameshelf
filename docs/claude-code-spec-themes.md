# Spec: Selectable dark themes (Navy / Walnut / Mahogany / Oak)

Locked design: `docs/mockups/settings-theme-b.html` (copy it into the repo alongside this spec).
Supersedes every earlier palette spec (`claude-code-spec-mono-palette.md`, `claude-code-spec-slate-brass.md`, the unwritten "paper" direction). Do not commit those.

## What we're building

The site keeps its current gold accent and gets a small theme system: four dark themes the shelf owner picks in Settings, built so a fifth (and more) is one CSS block plus one registry entry, with no picker code changes.

- **Navy** — today's colours, stays the default.
- **Walnut** — neutral dark brown.
- **Mahogany** — red-brown.
- **Oak** — warm yellow-olive brown.

Gold (`--bgs-gold` and its RGB variant) is shared by every theme and never changes. Ivory and muted text shift slightly warm on the brown themes.

Theme is a **shelf attribute**: the owner sets it in Settings, it's saved to their profile, and visitors see the shelf the way the owner styled it. localStorage is only a cache so the owner's own device paints correctly before the profile loads.

Ships behind `?themes=1` (strip hidden without it, `?theme=` override still works for previews).

## Commit 1 — theme tokens and resolution (no UI)

### `css/base.css`

Move the theme-dependent tokens out of `:root` into per-theme blocks. Keep every token name exactly as it is today; only where they're declared changes.

```css
:root {
  /* shared — unchanged */
  --bgs-gold: …;          /* existing value, untouched */
  --bgs-gold-rgb: …;      /* existing value, untouched */
  /* …every other non-surface token stays here… */
}

/* Navy = today's values. Copy them verbatim from the current :root — do not retype from this spec. */
:root, [data-theme="navy"] {
  --bgs-bg: …; --bgs-plate: …; --bgs-ivory: …;
  /* + the RGB variants and any hairline / muted tokens that exist today */
}

[data-theme="walnut"] {
  --bgs-bg: #171110; --bgs-plate: #211915; --bgs-line: #33281F;
  --bgs-ivory: #F2E9DA; --bgs-muted: #A08F7C;
  --bgs-bg-rgb: 23,17,16; --bgs-plate-rgb: 33,25,21;
}
[data-theme="mahogany"] {
  --bgs-bg: #1A100D; --bgs-plate: #2A1812; --bgs-line: #46281D;
  --bgs-ivory: #F4E8D8; --bgs-muted: #B09280;
  --bgs-bg-rgb: 26,16,13; --bgs-plate-rgb: 42,24,18;
}
[data-theme="oak"] {
  --bgs-bg: #1E1812; --bgs-plate: #2B231A; --bgs-line: #463A2A;
  --bgs-ivory: #F3EBDA; --bgs-muted: #B4A385;
  --bgs-bg-rgb: 30,24,18; --bgs-plate-rgb: 43,35,26;
}
```

`--bgs-line` and `--bgs-muted` are the names used in the mockup for the hairline and secondary-text colours. If base.css already has tokens for those roles under other names, use the existing names and map these values onto them; if hairlines are currently hard-coded rgba values, introduce `--bgs-line` and replace the hard-codes in the same commit (grep for the literal navy hex/rgba values — any that remain will stay navy on the brown themes).

`html` / `body` must read `background: var(--bgs-bg)` and `color: var(--bgs-ivory)` — no literal colours.

### Theme registry — new `js/themes.js`

Single source of truth for the picker and the resolver:

```js
export const THEMES = [
  { id: 'navy',     name: 'Navy',     plate: '#161B22', line: '#262C36' }, // fill from base.css
  { id: 'walnut',   name: 'Walnut',   plate: '#211915', line: '#33281F' },
  { id: 'mahogany', name: 'Mahogany', plate: '#2A1812', line: '#46281D' },
  { id: 'oak',      name: 'Oak',      plate: '#2B231A', line: '#463A2A' },
];
export const DEFAULT_THEME = 'navy';
export const isTheme = id => THEMES.some(t => t.id === id);
```

`plate` and `line` exist only so the swatch dots can be drawn without the theme being applied. Adding a theme later = one CSS block + one entry here.

### Resolution and first paint

Inline `<script>` in `<head>` of every page, before the stylesheet link, so there is no navy flash:

1. `?theme=<id>` if valid → use it (preview only, not persisted).
2. else `localStorage['bgs:theme']` if valid.
3. else `navy`.
4. `document.documentElement.dataset.theme = id`.

Then, once the shelf owner's profile has loaded (wherever display name is read today), apply `profile.theme` if it's set and valid, and write it to `localStorage['bgs:theme']`. Visitors get the owner's theme this way; the owner's own device already had it cached.

Update `<meta name="theme-color">` whenever the theme is applied — set it to that theme's `--bgs-bg` (read via `getComputedStyle` after setting `data-theme`).

### Persistence

Add `theme text` to the same profile row the Display name setting writes to (nullable, no default). Extend the existing update RPC / policy in the same way display name is handled; validate server-side against the four ids (a `check` constraint or a guard in the RPC).

### Transition

When the theme changes after load, surfaces should cross-fade rather than snap:

```css
html.theme-switching, html.theme-switching body,
html.theme-switching .card, html.theme-switching .plate {
  transition: background-color 200ms ease, border-color 200ms ease, color 200ms ease;
}
@media (prefers-reduced-motion: reduce) {
  html.theme-switching * { transition: none !important; }
}
```

Add `theme-switching` to `<html>` only for the duration of the switch (remove it on `transitionend` or after 250 ms). **WebKit rule:** do not put this transition on any element that already has an `animation` on `background-color`, `border-color` or `color` (the Game Night pill, toasts, pulse rings). Scope the class list above to inert surfaces only — if in doubt leave the element out; it will snap, which is fine.

Suggested commit message: `feat(theme): per-theme token blocks, registry and resolver (navy default)`

## Commit 2 — Settings theme strip (option B)

Inside the Settings card, under the existing Display name rows, a new group and one row:

```
LOOK
┌───────────────────────────────────────────┐
│ Theme                              Walnut │
│                                           │
│   ●      ●      ●      ●      ·           │
│ Navy  Walnut Mahogany Oak                 │
└───────────────────────────────────────────┘
```

- Row label "Theme", right side shows the current theme's name in the muted mono style the other rows use.
- Below it, `.theme-strip`: a **five-column grid**, `grid-template-columns: repeat(5, 1fr)`, each theme centred in its own column, fifth column empty until the fifth theme lands. Six or more wrap to a second row of five (`grid-auto-rows`).
- Each swatch is a `<button type="button" role="radio" aria-checked>` inside a `role="radiogroup"` labelled "Theme": a 40 px circle filled with the theme's `plate`, an inner 22 px disc (inset 9 px) filled with the theme's `line`, name underneath in 12 px mono, muted.
- Selected: gold ring `box-shadow: inset 0 0 0 2px var(--bgs-gold), inset 0 0 0 5px var(--bgs-plate)` on the circle, name in ivory. Focus-visible: the same ring. Never `outline`.
- Tap → apply theme immediately (registry → `data-theme`, meta theme-color, `theme-switching` cross-fade), write localStorage, then save to profile. Save failure → revert to the previous theme and show the existing toast pattern with "Couldn't save theme. Try again."
- Whole group hidden unless `?themes=1` is present (or the flag is lifted).

### Layout constants

| Thing | Value |
|---|---|
| Strip columns | 5 × 1fr, fixed |
| Strip padding | 6px 12px 18px |
| Swatch circle | 40 px, `border: 1px solid rgba(255,255,255,.14)` |
| Inner disc | inset 9 px (22 px), theme `line` colour |
| Selected ring | inset 2 px gold + 3 px plate gap |
| Name | 12 px mono, muted; ivory when selected |
| Cross-fade | 200 ms ease; none under reduced motion |

### Deliberate deviations from the mockup

- Swatch colours come from `THEMES[].plate/line`, not inline styles per theme, so a fifth theme needs no HTML.
- The mockup's shared `--tile-*` custom properties are mockup plumbing only; don't port them.

Suggested commit message: `feat(settings): theme strip behind ?themes=1`

## Out of scope (do not touch)

- OG images and the invite poster stay fixed navy in this pass.
- `powered-by-bgg.svg` stays BGG orange; app icon unchanged.
- No light theme; every theme in this system is dark and shares gold.

## Verification

- [ ] With no flag and no stored theme, the site is pixel-identical to today (diff `base.css` computed values on `:root`).
- [ ] `?theme=oak` on any page paints oak on first frame — no navy flash (throttle network, hard reload).
- [ ] `?themes=1` on Settings shows the LOOK group with four swatches in a five-slot grid, equal gaps, fifth slot empty.
- [ ] Tapping each swatch recolours the page, updates the row value, the ring, and the Safari status/URL bar colour.
- [ ] Reload as the owner: theme persists (profile). Open the shelf in a private window: visitor sees the owner's theme.
- [ ] Reduced motion on: switch snaps, no transition.
- [ ] Game Night pill, toasts and any pulsing element still animate after a switch (WebKit rule).
- [ ] Keyboard: arrow keys move between swatches, Enter/Space selects, focus ring visible via box-shadow only.
- [ ] Grep the codebase for the literal navy hex/rgba values: none remain outside the `[data-theme="navy"]` block.

# Liquid Glass restyle — Claude Code spec

Repo: `noknaruephon/boardgameshelf` · Mockup: `docs/mockups/liquid-glass-mockup.html` (copy the attached file there first)

## Goal

Move the shelf UI to a Liquid-Glass material: translucent warm plate, blur + saturate, a refractive rim, a specular highlight that drifts with scroll, and motion that morphs rather than swaps. Applies to every floating control, sheet and menu. **Game cards are the exception** — they stay solid.

Ship behind a flag: `?glass=1` (persist to `localStorage.bgsGlass`). Gate by loading `css/glass.css` only when the flag is set — no selector prefixing. Removing the flag later is a one-line change.

## Hard constraints (from engineering-principles)

- **Never put `animation` and `transition` on the same property of the same element** — WebKit silently drops the transition. Everything here is transitions + one JS-driven CSS variable; no `@keyframes`. If you need an entrance, use a class toggle + transition.
- Rings and focus: `box-shadow` (incl. `inset`) only. **Never `outline`, never `border`** for the glass rim.
- Token names from `css/base.css` verbatim. The mockup's values are eyeballed — **read `base.css` and use the real values**; add the new `--glass-*` tokens next to them.
- Cards use `games.json` data as today; the mockup's cover/title pairing is placeholder.

## Material spec

New tokens (in `base.css` `:root`):

| Token | Value |
|---|---|
| `--glass-fill-a` | `.52` (plate tint alpha; pressed `.74`) |
| `--glass-blur` | `22px` |
| `--glass-sat` | `1.6` |
| `--glass-rim-w` | `1.5px` |
| `--glass-rim-light` | `rgba(var(--bgs-ivory-rgb),.22)` |
| `--glass-rim-gold` | `rgba(var(--bgs-gold-rgb),.28)` |
| `--glass-shadow` | `0 12px 32px rgba(0,0,0,.45), 0 1px 0 rgba(0,0,0,.4)` |
| `--glass-sheen` | `rgba(var(--bgs-ivory-rgb),.10)` |
| `--light-x` | `20%` (JS-updated on scroll) |
| `--ease-liquid` | `cubic-bezier(.32,.72,0,1)` |
| `--dur` | `.55s` |

`.glass` (copy from mockup — the three layers matter):

1. **Element**: background = specular gradient positioned by `--light-x` over `rgba(var(--bgs-plate-rgb), var(--glass-fill-a))`; `backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat))` with `-webkit-` prefix; rim via four inset box-shadows (light top-left, dark bottom-right, gold 1px ring) + `--glass-shadow`. `isolation: isolate`.
2. **`::before` refraction ring**: `inset:0; padding: var(--glass-rim-w)`; masked to a ring with `-webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude`; its own `backdrop-filter: blur(3px) brightness(1.35) saturate(2) contrast(1.1)`; conic-gradient highlight; `z-index:-1`.
3. **`::after` thickness glow**: `inset 0 0 18px ivory/.05, inset 0 -10px 20px black/.18`.

Press state: `:active` → `--glass-fill-a:.74; transform: scale(.97)`. Transitions on `background`, `box-shadow` (`--dur`) and `transform` (`.28s`).

Elements that get `.glass`: search field, filter + sort buttons, settings button, Beta pill, bags button + bags menu, filter sheet (and its tab puck + chips), Game Night pill/sheet, compact topbar, any existing share sheets / packing pills. Chips and sheet rows use lighter overrides (`--glass-fill-a:.28–.30; --glass-blur:8–10px; --glass-shadow:none`).

## Layout constants

| Thing | Value |
|---|---|
| Card | `border-radius:18px`, flex column, solid `--bgs-plate` |
| Card artwork box | `aspect-ratio: 4/5`, `object-fit: cover`, `object-position: center top`, **no gradient, no overlay, never under the info** |
| Card info | `padding: 9px 10px 11px`; title Fraunces 600 13.5px/1.2, 2-line clamp; rating pill gold ring only (no fill); players in mono muted |
| Control radius | 18px (52px controls) · 14px (40px controls) · 999px pills |
| Compact topbar | fixed, `top: 10px + safe-area`, `left/right: 12px`, height 56px, radius 22px, **search field + filter button only — no wordmark** |
| Topbar trigger | `scrollY > 150` → `.is-in`; hidden state `translateY(-140%) scale(.96)` + opacity 0 |
| Game Night pill | fixed bottom `24px + safe-area`, 232×60, radius 999 |
| Game Night open | width `calc(100vw - 24px)` max 456, height 420, bottom `12px + safe-area`, radius 30, `--glass-fill-a:.66` |
| Sheets (filter etc.) | same box as Game Night open; enter via `translateY(112%)` → `0` |
| Scrim | `rgba(var(--bgs-bg-rgb),.45)`, opacity transition .35s |
| Light drift | on scroll: `--light-x = 20 + (scrollY/8) % 60` % — set directly, no transition |

## Commit 1 — material + cards

`feat(ui): liquid glass material and solid-info cards (behind ?glass=1)`

1. Flag plumbing: read `?glass=1` → `localStorage.bgsGlass`; inject `<link href="css/glass.css">` when set.
2. Add tokens to `base.css`; create `css/glass.css` with `.glass` and all overrides.
3. Restructure the shelf card markup to `.card > .art > img` + `.card > .info`. This is a markup change that affects the non-flag path too — keep visual parity there (the artwork box + solid info layout is the new default regardless of flag; only the glass chrome is gated). Delete any existing cover gradient/overlay on the card.
4. Apply `.glass` to the header controls, bags button/menu, filter sheet, Beta pill.
5. Reduced motion: `@media (prefers-reduced-motion: reduce)` → all transitions off; refraction ring stays (it's static).

**Stop for review** — Nok checks material on-device before motion lands.

## Commit 2 — motion

`feat(ui): glass motion — compact topbar, Game Night morph, light drift`

1. Compact topbar: new fixed element with search + filter; slide/scale in past 150px; the full header keeps scrolling away. Search input state must be shared (typing in one reflects in the other).
2. Game Night pill → sheet: **one element**. `.is-open` transitions width/height/margin-left/bottom/border-radius; `.pill` content fades+scales out, `.sheet` content fades/rises in with `.18s` delay. Sheet content = the existing Game Night entry actions (start vote / schedule / upcoming if present). Do not invent new actions; if the pill currently navigates directly, the sheet holds that single action plus close. Scrim tap, close button and `Esc` close it; `aria-expanded` toggles.
3. Filter sheet tabs: sliding glass puck (`translateX(i*100%)`, `.45s var(--ease-liquid)`).
4. Light drift: passive scroll listener sets `--light-x` on `<html>`.

**Stop for review.**

## Deliberate deviations from the mockup

- Mockup demo bar, cover/title pairing and fake bag names are not shipped.
- Mockup's compact-topbar filter button duplicates the header one; in production both must open the same filter sheet.
- The refraction technique is the CSS masked-ring approach (works in Safari). Do **not** use `backdrop-filter: url(#svg)` — Chrome-only.

## Verification checklist

- [ ] With no flag, the shelf looks as before except cards: 4:5 artwork box, solid info, no gradient.
- [ ] `?glass=1` persists across reloads; removing `localStorage.bgsGlass` restores default.
- [ ] iOS Safari: glass blur visible, refraction ring visible, no `outline` anywhere (`grep -n "outline" css/`).
- [ ] Press any glass control: fill thickens and scales to .97; release returns.
- [ ] Scroll past the header: compact bar slides in; scroll back: it leaves. Typing in either search filters the shelf.
- [ ] Tap Game Night: pill morphs into sheet in one motion (no flash/swap); scrim, ×, Esc all close; `aria-expanded` correct.
- [ ] Highlight on glass surfaces shifts as you scroll.
- [ ] Reduced motion on: no transitions, everything still reachable.
- [ ] No cover art visible beneath any card's info area; artwork top edge (titles) not cropped.
- [ ] Lighthouse / on-device scroll on the full 197-card shelf stays smooth (cards have no backdrop-filter).
- [ ] Rings/focus all via `box-shadow`; no `animation`+`transition` on the same property anywhere in `glass.css`.

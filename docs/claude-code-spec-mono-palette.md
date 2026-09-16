# Cool black & white palette ("Ink")

Mockup: `docs/mockups/bw-palette-mockup.html` (demo bar switches direction / accent / semantics / glass / motion; ship the defaults: **A Ink, white accent, tuned semantics, glass on**). Covers and titles in the mockup are the first twelve entries of `games.json`.

## What changes

The dark-walnut palette becomes a cool near-black and white palette. Cover art is the only colour on the page apart from semantic colour, which stays functional (play / pass / destructive / warning / info).

Gold is retired **as a hue, not as a role**. There are ~330 references to `--bgs-gold*`, `--line-gold` and `--glass-rim-gold` across `css/`, `js/` and the pages; renaming them is churn with no benefit. Keep every token name and remap the values in `css/base.css`. Anything that reads tokens at runtime (`js/invite-poster.js`, the Teach pictograms via `.pg-*` in `css/game-modal.css`) follows for free.

Two commits. Commit 1 is the whole visible site. Commit 2 is the Satori renderers, which cannot read CSS variables.

## Token table

`css/base.css` `:root` — replace the value, keep the name and the comment.

| Token | Before | After |
|---|---|---|
| `--bgs-bg` | `#160F0A` | `#0A0B0D` |
| `--bgs-bg-rgb` | `22,15,10` | `10,11,13` |
| `--bgs-bg-radial` | `#241708` | `#111318` |
| `--bgs-plate` | `#241A10` | `#15171B` |
| `--bgs-plate-rgb` | `36,26,16` | `21,23,27` |
| `--bgs-ivory` | `#F4EBDA` | `#F5F6F8` |
| `--bgs-ivory-rgb` | `244,235,218` | `245,246,248` |
| `--bgs-ivory-70` | `rgba(244,235,218,0.72)` | `rgba(245,246,248,0.72)` |
| `--bgs-ivory-45` | `rgba(244,235,218,0.45)` | `rgba(245,246,248,0.45)` |
| `--bgs-gold` | `#E3B04B` | `#F5F6F8` |
| `--bgs-gold-rgb` | `227,176,75` | `245,246,248` |
| `--bgs-gold-dim` | `rgba(227,176,75,0.62)` | `rgba(245,246,248,0.55)` |
| `--bgs-icon-gold` | `#e2b463` | `#F5F6F8` |
| `--bgs-on-gold` | — (new) | `#0A0B0D` |
| `--line` | `rgba(244,235,218,0.10)` | `rgba(245,246,248,0.10)` |
| `--line-gold` | `rgba(227,176,75,0.22)` | `rgba(245,246,248,0.16)` |
| `--bgs-amber` | `#F0913A` | `#E0A83A` |
| `--bgs-danger` | `#A8503A` | `#B84A40` |
| `--bgs-danger-hover` | `#C2705A` | `#D2665B` |
| `--bgs-vote-play` | `#8FA75A` | `#5FB07F` |
| `--bgs-vote-play-rgb` | `143,167,90` | `95,176,127` |
| `--bgs-vote-pass` | `#C2604A` | `#D9645A` |
| `--bgs-vote-pass-rgb` | `194,96,74` | `217,100,90` |
| `--bgs-info` | — (new) | `#5B9CDB` |
| `--bgs-info-rgb` | — (new) | `91,156,219` |
| `--glass-rim-gold` | `rgba(var(--bgs-gold-rgb),.28)` | `rgba(var(--bgs-ivory-rgb),.14)` |

Keep the existing vote-pass / danger separation — passing on a game is not destructive and still must not borrow the cancel colour. Both are now cooler reds at different weights.

Add `--bgs-on-gold` next to `--bgs-gold` with the comment: `/* ink on an accent fill — was implied by --bgs-bg/--bgs-plate while gold was a mid tone; white needs an explicit one */`. `--bgs-info` is reserved for the live-voting / presence surfaces; nothing consumes it yet.

## Commit 1 — tokens, glass and the literals that escaped the tokens

**`css/base.css`** — the table above.

**`css/glass.css`**
- Line 57: the rim gradient stop `rgba(var(--bgs-gold-rgb),.18) 25%` → `rgba(var(--bgs-ivory-rgb),.18) 25%`. With gold remapped this is already ivory; change it so the intent is explicit.
- Line 714: the ambient glow under the info round `rgba(var(--bgs-gold-rgb),.18)` → `rgba(var(--bgs-ivory-rgb),.12)`. White at .18 reads as a spotlight; drop to .12.
- `.selbar__pill.gold` (487) and `.gn-primary-btn` (662): both are `background:var(--bgs-gold)` with dark text inherited from the walnut. Set `color:var(--bgs-on-gold)` explicitly on both. Check every other `background:var(--bgs-gold)` in `css/` and the pages the same way; grep `background:var(--bgs-gold)` and `background: var(--bgs-gold)`.
- Line 490 / 664: `inset 0 1px 0 rgba(255,255,255,.35)` sheen on a white pill is invisible — leave it, it is harmless.

**Hardcoded literals — replace all of these; there are no others outside `docs/`, `covers/` and the icons:**

| File | Line | Before | After |
|---|---|---|---|
| `landing.html`, `shelf.html`, `settings.html`, `welcome.html`, `privacy.html`, `terms.html`, `vote.html`, `vote-swipe.html`, `results.html`, `night-host.html` | `<meta name="theme-color">` | `#160F0A` | `#0A0B0D` |
| `night-host.html` | 358 (QR) | `dark: '#160F0A'` | `dark: '#0A0B0D'` |
| `landing.html` 87, `welcome.html` 52, `privacy.html` 42, `terms.html` 42 | `.btn.gold:hover` / `.back:hover` | `#ecbd5b` | `rgba(var(--bgs-ivory-rgb),.88)` |
| `landing.html` 135–139 | `.cover` `--c` plates | `#3E5C3E #3B4F76 #7A3B2E #A64B32 #8B3A3A` | all `#15171B` (`--bgs-plate`) |
| `shelf.html` 1028, 1070, 1073 | surprise-card swap | `rgba(20,16,10,…)` | `rgba(var(--bgs-bg-rgb),…)` same alpha |
| `shelf.html` 1129 | `.gn-error` | `#e07a5f` | `var(--bgs-danger-hover)` |
| `shelf.html` 2507 | `GN_CHECK_SVG` stroke | `#241A10` | `#0A0B0D` |
| `js/shelf-data.js` 90 | fallback plate colour | `'#241A10'` | `'#15171B'` |
| `css/bag.css` 375, 601 | `.bag-dock__cancel` | `rgba(42,31,22,.92)` | `rgba(var(--bgs-plate-rgb),.92)` |
| `css/bag.css` 376, 555, 602 | ink on the Pack pill | `#1a1206` | `var(--bgs-on-gold)` |
| `vote-swipe.html` 180, 192 | `.wash` | `rgba(20,18,15,…)` | `rgba(var(--bgs-bg-rgb),…)` same alpha |

The five landing `--c` plates were curated per-cover cocoa tones behind the fanned hand; in mono the hand sits on plate. If the plates now read as flat, the only permitted variation is lightness: `#15171B`, `#1A1D22`, `#15171B`, `#1F232A`, `#15171B`. Do not reintroduce hue.

Leave alone:
- `assets/powered-by-bgg.svg` — third-party attribution mark, BGG orange stays as BGG ships it.
- `assets/icon.svg`, `AppIcon_assets/` — app icon is its own decision, out of scope.
- `covers/*.svg`, Google "G" glyph colours in `landing.html`.
- `js/invite-poster.js` — reads `--bgs-*` from `<html>` at render time; nothing to change. Verify the gold ring on the candidate strip (line 258) renders white and is still visible over dark covers.
- `js/teach-scenes.js` / `.pg-*` — the pictogram grammar was "gold = what the player does, ivory = the world, dim ivory = not in play". It collapses to solid white / white .72 / white .32, which is still three legible weights. Accept.

Commit message: `Palette: cool black & white (Ink) — remap tokens, retint glass, sweep literals`

Stop for review after Commit 1 with screenshots of `/`, `/u/noknaruephon` (selection mode with two picks), the vote-swipe screen and the bag packing bar.

## Commit 2 — Satori renderers

Satori has no CSS variables; both files carry a `T` object copied from `base.css`. Update them to the table.

**`api/og/index.js`** (site-wide default OG)

```js
const T = {
  bg: '#0A0B0D',
  ivory: '#F5F6F8',
  ivory70: 'rgba(245,246,248,0.7)',
  ivory45: 'rgba(245,246,248,0.45)',
  gold: '#F5F6F8',
  goldRing: 'rgba(245,246,248,0.75)',
  goldFrame: 'rgba(245,246,248,0.35)',
  play: '#5FB07F',
  pass: '#D9645A',
};
const CARD_GRADIENT = 'linear-gradient(160deg, #1F232A, #15171B)';
const PLAY_INK = '#0F2418';
const PASS_INK = '#2A0F0D';
```

Cards were "blank cocoa cards with gold edge"; they become graphite cards with a white edge. Headline, sage Play pill and clay pass dot keep their roles.

**`api/og/[username].js`** (per-shelf OG)

```js
const T = {
  bg: '#0A0B0D',
  plate: '#15171B',
  ivory: '#F5F6F8',
  ivory70: 'rgba(245,246,248,0.72)',
  ivory45: 'rgba(245,246,248,0.45)',
  gold: '#F5F6F8',
  goldGlow: 'rgba(245,246,248,0.10)',
};
```

`goldGlow` drops from .16 to .10 — white glow at .16 washes the fanned covers.

Bump the OG cache-buster (`?v=` on the `og:image` / `twitter:image` meta in `landing.html` and `shelf.html`) to today's date so link previews refresh.

Commit message: `OG: Ink palette for default and per-shelf images`

## Deviations from the mockup

- The mockup's `--bgs-mute`, `--bgs-line`, `--bgs-accent*`, `--bgs-success`, `--bgs-warning`, `--glass`, `--glass-line` are mockup-only aliases. Do not add them; the production names in the table are the ones to use.
- The mockup draws a single `.round.glass` search bar; production keeps the existing `.topbar` markup and only the tokens change.

## Rules that still apply

- WebKit: never put `animation` and `transition` on the same property of the same element — the transition is silently dropped. Nothing in this change touches motion, so do not add transitions "to soften the palette swap".
- Focus rings and selection rings stay `box-shadow` (rings `inset`); never `outline`.
- No placeholder text on poster or OG images.

## Verification

- [ ] `grep -rn "160F0A\|241A10\|F4EBDA\|E3B04B\|ecbd5b\|e07a5f\|1a1206\|rgba(20,1[68],1[05]\|rgba(42,31,22" --include=*.html --include=*.css --include=*.js . | grep -v "^./docs"` returns nothing.
- [ ] Shelf: card info plate is `#15171B`, no gradient into the art, 4:5 art box unchanged.
- [ ] Selection mode: two picks show a white `inset` ring and a white count badge with dark digits; "Continue · 2" is white with dark text (`--bgs-on-gold`), "Pick N more" stays glass.
- [ ] Glass chrome: refraction rim is white-only, no warm cast; focus ring on the search input and icon buttons is white 2px over a bg gap.
- [ ] Swipe vote: × is cool clay, ✓ is sage, info round is white; ambient glow under the row visible but not a spotlight.
- [ ] Bag packing bar: gap cells and gap line are amber `#E0A83A`; Pack pill is white with dark text.
- [ ] Cancel game night button is `#B84A40` → `#D2665B` on hover, visibly different from the swipe pass red.
- [ ] Teach section: pictograms render in three legible weights of white.
- [ ] Invite poster: candidate strip ring is white and visible over a dark cover; no gold anywhere.
- [ ] `/api/og` and `/api/og/noknaruephon` render with the new palette; `og:image` `?v=` bumped; Powered by BGG mark untouched.
- [ ] iOS Safari status bar colour matches `#0A0B0D` on every page.
- [ ] Reduced motion: unchanged behaviour.

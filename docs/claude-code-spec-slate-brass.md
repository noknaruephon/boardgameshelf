# Slate + brass palette

Mockup: `docs/mockups/gold-accent-options.html` — ship option **B** (the default it opens on), glass on. Covers and titles are the first twelve entries of `games.json`. This supersedes `claude-code-spec-mono-palette.md`; do not commit that one.

## What changes

The dark-walnut neutrals become cool slate. Gold stays the accent and keeps every job it has today (primary fills, selection rings, count badges, mono meta and eyebrow in gold-dim, gold hairlines, top-bar icons, the glass refraction rim) — it is only re-mixed to a brass that sits on blue-gray, and gets an explicit ink token for text on gold fills. Semantic colour (play / pass / destructive / warning / info) is re-tuned cooler and stays functional. Cover art is untouched.

Every `--bgs-*` token keeps its name; values change in `css/base.css`. `js/invite-poster.js` and the Teach pictograms (`.pg-*` in `css/game-modal.css`) read tokens at runtime and follow for free. The Satori OG renderers cannot, so they are a second commit.

## Token table

`css/base.css` `:root` — replace values, keep names and comments.

| Token | Before | After |
|---|---|---|
| `--bgs-bg` | `#160F0A` | `#0B0E13` |
| `--bgs-bg-rgb` | `22,15,10` | `11,14,19` |
| `--bgs-bg-radial` | `#241708` | `#131821` |
| `--bgs-plate` | `#241A10` | `#161A21` |
| `--bgs-plate-rgb` | `36,26,16` | `22,26,33` |
| `--bgs-ivory` | `#F4EBDA` | `#EEF1F5` |
| `--bgs-ivory-rgb` | `244,235,218` | `238,241,245` |
| `--bgs-ivory-70` | `rgba(244,235,218,0.72)` | `rgba(238,241,245,0.72)` |
| `--bgs-ivory-45` | `rgba(244,235,218,0.45)` | `rgba(238,241,245,0.45)` |
| `--bgs-gold` | `#E3B04B` | `#E4B54D` |
| `--bgs-gold-rgb` | `227,176,75` | `228,181,77` |
| `--bgs-gold-dim` | `rgba(227,176,75,0.62)` | `rgba(240,196,85,0.80)` |
| `--bgs-icon-gold` | `#e2b463` | `#E4B54D` |
| `--bgs-on-gold` | — (new) | `#2A1F0C` |
| `--bgs-gold-hover` | — (new) | `#F0C455` |
| `--line` | `rgba(244,235,218,0.10)` | `rgba(238,241,245,0.10)` |
| `--line-gold` | `rgba(227,176,75,0.22)` | `rgba(228,181,77,0.22)` |
| `--bgs-amber` | `#F0913A` | `#E0A83A` |
| `--bgs-danger` | `#A8503A` | `#B84A40` |
| `--bgs-danger-hover` | `#C2705A` | `#D2665B` |
| `--bgs-vote-play` | `#8FA75A` | `#5FB07F` |
| `--bgs-vote-play-rgb` | `143,167,90` | `95,176,127` |
| `--bgs-vote-pass` | `#C2604A` | `#D9645A` |
| `--bgs-vote-pass-rgb` | `194,96,74` | `217,100,90` |
| `--bgs-info` | — (new) | `#5B9CDB` |
| `--bgs-info-rgb` | — (new) | `91,156,219` |

Unchanged: `--glass-*` (the rim already derives from `--bgs-gold-rgb` / `--bgs-ivory-rgb`), `--ease-liquid`, `--dur`.

Notes for the new tokens:
- `--bgs-on-gold` — ink on any gold fill. The walnut site got this for free by inheriting `--bgs-bg` / `#1a1206`; on slate that inherited ink is blue-black and reads harsh, so it is now explicit and warm. Comment: `/* ink on a gold fill — warm, not the page bg; full-contrast black on brass glares */`.
- `--bgs-gold-hover` — the brighter brass, replaces the four hardcoded `#ecbd5b` hovers.
- `--bgs-gold-dim` is deliberately mixed from the brighter brass at .80, not from `--bgs-gold`; the eyebrow and mono meta were muddy at .62 of the fill colour. Comment that.
- Keep the vote-pass / danger split (passing on a game is not destructive); both are cooler reds at different weights.
- `--bgs-info` is reserved for live-voting / presence surfaces; nothing consumes it yet.

## Commit 1 — tokens and the literals that escaped them

**`css/base.css`** — the table above.

**Gold fills get explicit ink.** Grep `background:var(--bgs-gold)` and `background: var(--bgs-gold)` across `css/` and `*.html`, and set `color:var(--bgs-on-gold)` on each rule where the text colour is inherited or a literal. Known sites: `.selbar__pill.gold` (`css/glass.css` 487), `.gn-primary-btn` (`css/glass.css` 662), `.bag-dock__pack` (`css/bag.css` 376, 602), `.btn.gold` in `landing.html` / `welcome.html`, `.back` in `privacy.html` / `terms.html`, the `.gn-surprise` confirm button in `shelf.html`.

**Hardcoded literals — replace all; there are none others outside `docs/`, `covers/` and the icons:**

| File | Line | Before | After |
|---|---|---|---|
| `landing.html`, `shelf.html`, `settings.html`, `welcome.html`, `privacy.html`, `terms.html`, `vote.html`, `vote-swipe.html`, `results.html`, `night-host.html` | `<meta name="theme-color">` | `#160F0A` | `#0B0E13` |
| `night-host.html` | 358 (QR) | `dark: '#160F0A'` | `dark: '#0B0E13'` |
| `landing.html` 87, `welcome.html` 52, `privacy.html` 42, `terms.html` 42 | `:hover` | `#ecbd5b` | `var(--bgs-gold-hover)` |
| `landing.html` 135–139 | `.cover` `--c` plates | `#3E5C3E #3B4F76 #7A3B2E #A64B32 #8B3A3A` | `#1F2A3A #232936 #2B2733 #33302B #2B2A33` |
| `shelf.html` 1028, 1070, 1073 | surprise-card swap | `rgba(20,16,10,…)` | `rgba(var(--bgs-bg-rgb),…)` same alpha |
| `shelf.html` 1129 | `.gn-error` | `#e07a5f` | `var(--bgs-danger-hover)` |
| `shelf.html` 2507 | `GN_CHECK_SVG` stroke | `#241A10` | `#2A1F0C` |
| `js/shelf-data.js` 90 | fallback plate colour | `'#241A10'` | `'#161A21'` |
| `css/bag.css` 375, 601 | `.bag-dock__cancel` | `rgba(42,31,22,.92)` | `rgba(var(--bgs-plate-rgb),.92)` |
| `css/bag.css` 376, 555, 602 | ink on Pack pill | `#1a1206` | `var(--bgs-on-gold)` |
| `vote-swipe.html` 180, 192 | `.wash` | `rgba(20,18,15,…)` | `rgba(var(--bgs-bg-rgb),…)` same alpha |

The five landing plates were cocoa tones behind the fanned hand; the replacements are the same five covers' dominant hues pulled into slate — cool, near-plate lightness, each distinct. Do not use the originals.

Leave alone:
- `games.json` `color` per game (used by `js/shelf-data.js` and the poster's placeholder plates) — curated per-game, treated like cover art.
- `assets/powered-by-bgg.svg` — third-party attribution mark, BGG orange stays.
- `assets/icon.svg`, `AppIcon_assets/` — app icon is its own decision.
- `covers/*.svg`, the Google "G" glyph colours in `landing.html`.
- `js/invite-poster.js`, `js/teach-scenes.js`, `css/glass.css` rim and glow rules — token-driven, nothing to change.

Commit message: `Palette: slate + brass — remap tokens, explicit ink on gold, sweep literals`

Stop for review with screenshots of `/`, `/u/noknaruephon` in selection mode with two picks, vote-swipe, the bag packing bar, and the game modal's Teach section.

## Commit 2 — Satori renderers

Both files carry a `T` object copied from `base.css` because Satori has no CSS variables.

**`api/og/index.js`**

```js
const T = {
  bg: '#0B0E13',
  ivory: '#EEF1F5',
  ivory70: 'rgba(238,241,245,0.7)',
  ivory45: 'rgba(238,241,245,0.45)',
  gold: '#E4B54D',
  goldRing: 'rgba(228,181,77,0.75)',
  goldFrame: 'rgba(228,181,77,0.35)',
  play: '#5FB07F',
  pass: '#D9645A',
};
const CARD_GRADIENT = 'linear-gradient(160deg, #232936, #161A21)';
const PLAY_INK = '#0F2418';
const PASS_INK = '#2A0F0D';
```

Blank cocoa cards become slate cards; the gold edge, headline, sage Play pill and clay pass dot keep their roles.

**`api/og/[username].js`**

```js
const T = {
  bg: '#0B0E13',
  plate: '#161A21',
  ivory: '#EEF1F5',
  ivory70: 'rgba(238,241,245,0.72)',
  ivory45: 'rgba(238,241,245,0.45)',
  gold: '#E4B54D',
  goldGlow: 'rgba(228,181,77,0.16)',
};
```

Bump the `?v=` cache-buster on `og:image` / `twitter:image` in `landing.html` and `shelf.html` to today's date.

Commit message: `OG: slate + brass palette for default and per-shelf images`

## Deviations from the mockup

- The mockup's `--meta`, `--eyebrow`, `--card-line`, `--icon`, `--pill-on-*`, `--bgs-accent*`, `--bgs-mute`, `--bgs-line`, `--glass`, `--glass-line` are mockup-only aliases for switching options; do not add them. In production these roles already resolve through `--bgs-gold-dim`, `--line-gold`, `--bgs-icon-gold` and `--bgs-gold`.
- The mockup's single `.round.glass` search bar stands in for the real `.topbar`; markup is untouched, tokens only.
- Options A and C in the mockup are rejected; ignore them.

## Rules that still apply

- WebKit: never `animation` and `transition` on the same property of the same element. This change adds no motion.
- Focus and selection rings stay `box-shadow` (rings `inset`); never `outline`.
- No placeholder text on poster or OG images.

## Verification

- [ ] `grep -rn "160F0A\|241A10\|F4EBDA\|E3B04B\|e2b463\|ecbd5b\|e07a5f\|1a1206\|rgba(20,1[68],1[05]\|rgba(42,31,22" --include=*.html --include=*.css --include=*.js . | grep -v "^./docs"` returns nothing.
- [ ] Every element with a gold background has `--bgs-on-gold` text: Continue pill, primary buttons on landing/welcome/privacy/terms, Pack pill, count badges, surprise-sheet Continue.
- [ ] Eyebrow and mono meta read as bright brass, not mustard — `--bgs-gold-dim` is `rgba(240,196,85,0.80)`.
- [ ] Shelf: card info plate is `#161A21`, no gradient into the art, 4:5 art box unchanged; card hairline is `--line-gold`.
- [ ] Selection mode: two picks show a gold `inset` ring and a gold badge with warm ink; "Pick N more" stays glass.
- [ ] Glass chrome: refraction rim shows brass, not the old orange gold; focus ring on search and icon buttons is brass 2px over a bg gap.
- [ ] Swipe vote: × cool clay, ✓ sage, info round brass; ambient glow under the row visible.
- [ ] Bag packing bar: gap cells and gap line amber `#E0A83A`.
- [ ] Cancel game night is `#B84A40` → `#D2665B` on hover, visibly different from the swipe pass red.
- [ ] Teach pictograms: brass / paper / dim paper, three legible weights.
- [ ] Invite poster: candidate strip ring is brass over a dark cover.
- [ ] `/api/og` and `/api/og/noknaruephon` render in slate + brass; `?v=` bumped; Powered by BGG untouched.
- [ ] iOS Safari status bar matches `#0B0E13` on every page.
- [ ] Reduced motion behaviour unchanged.

## Hand-off prompt

```
Read docs/claude-code-spec-slate-brass.md and only that spec (do not read the docs folder wholesale; docs/claude-code-spec-mono-palette.md is superseded and must not be applied).

Implement it as two ordered commits, stopping for my review after each.

Commit 1 — "Palette: slate + brass — remap tokens, explicit ink on gold, sweep literals"
- Apply the token table to css/base.css: change values only, keep every token name and its comment. Add --bgs-on-gold, --bgs-gold-hover, --bgs-info and --bgs-info-rgb with the comments given.
- Grep every gold-background rule and set color:var(--bgs-on-gold) where the text colour is inherited or literal.
- Replace every literal in the "Hardcoded literals" table. Run the grep in the verification section and paste its output — it must be empty.
- Do not touch: games.json colours, assets/, AppIcon_assets/, covers/, js/invite-poster.js, js/teach-scenes.js, api/og/*, or any glass rim/glow rule in css/glass.css.
- Do not add or change any animation or transition. Focus and selection rings stay box-shadow, never outline.
- Stop. Show me the diff summary and screenshots (or a local `vercel dev` walkthrough) of landing, /u/noknaruephon in selection mode with two picks, vote-swipe, the bag packing bar, and the Teach section in a game modal.

Commit 2 — "OG: slate + brass palette for default and per-shelf images"
- Update the T objects and CARD_GRADIENT / PLAY_INK / PASS_INK in api/og/index.js and api/og/[username].js exactly as written.
- Bump ?v= on og:image and twitter:image in landing.html and shelf.html to today's date.
- Stop. Render both OG routes locally and show me the images.

Work through the verification checklist and report each item pass/fail before calling either commit done.
```

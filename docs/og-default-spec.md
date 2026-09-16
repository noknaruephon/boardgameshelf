# Default OG image — "Pick tonight's game, together."

**Scope:** add a generic, site-wide 1200×630 OG image and point every non-shelf page at it. The per-shelf image at `/api/og/[username]` is **not** changed.

**Mockup:** `docs/mockups/og-default-mockup.html` — the `.og` CSS block in that file is the source of truth for geometry.

**Assumption to confirm with Nok before starting:** the homepage (`index.html`), `/welcome`, and any other page that currently has no `og:image` (or points at Nok's shelf image) should use the new default. Shelf pages keep their own generated image.

Stop for review after each commit.

---

## Commit 1 — `api/og/index.js`: default OG renderer

### Approach

1. Read the existing `api/og/[username].js` first. Reuse its runtime config (`export const config = { runtime: 'edge' }`), its font loading (Fraunces, Inter, IBM Plex Mono), and its `ImageResponse` setup. If font loading is inline in that file, extract it to `api/og/_fonts.js` and import from both routes. No behaviour change to the username route.
2. Create `api/og/index.js` responding at `/api/og`. No params. Cache aggressively: `Cache-Control: public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000`.
3. Colours: read the hex values out of `css/base.css` (`--bgs-bg`, `--bgs-ivory`, `--bgs-gold`, `--bgs-vote-play`, `--bgs-vote-pass`) and hardcode them as constants at the top of the file with a comment naming the token. Satori cannot read CSS variables. The mockup's hex values are approximations — the repo values win.

### Layout constants (1200×630 canvas)

| Element | Value |
|---|---|
| Canvas | 1200×630, background `--bgs-bg` |
| Eyebrow | left 72, top 56; Fraunces 500 22px `--bgs-ivory`; 9px gold diamond (square rotated 45°), 10px gap, text "BoardgameShelf" |
| Headline | left 72, top 212, width 560; Fraunces 400 84px, line-height 1.02, letter-spacing -0.5px; "Pick tonight's game, together." |
| Sub-line | left 72, top 428; Inter 400 26px, `--bgs-ivory` at 70%; "Everyone swipes. The table decides." |
| URL | left 72, bottom 52; IBM Plex Mono 400 19px, `--bgs-ivory` at 45%; "boardgameshelf.vercel.app" |
| Fan container | right 120, top 88; 300×430 |
| Card (×3) | 236×330, radius 18; background `linear-gradient(160deg, #4a3d34, #33291f)`; 2px ring `rgba(gold, .75)`; shadow `0 18px 40px rgba(0,0,0,.45)`; transform-origin `50% 120%` |
| Card inner frame | inset 14 on all sides, radius 10, 1px border `rgba(gold, .35)` |
| Card gem | 20×20 gold square rotated 45°, centred, opacity .7 |
| Card 1 (back) | `translateX(80px) rotate(22deg)`; dim overlay `rgba(0,0,0,.28)` |
| Card 2 (mid) | `translateX(40px) rotate(11deg)`; dim overlay `rgba(0,0,0,.15)` |
| Card 3 (front) | no transform, no dim |
| Play pill | left -10, top 250 (relative to fan); padding 12 22 12 16; radius 999; background `--bgs-vote-play`; text `#1f261a` Inter 600 24px; 22px check icon, 10px gap; `rotate(-6deg)`; shadow `0 10px 24px rgba(0,0,0,.4)` |
| Pass dot | right -26, top 70 (relative to fan); 48px circle; background `--bgs-vote-pass`; "×" `#2a1a12` Inter 600 26px; opacity .85; shadow `0 8px 20px rgba(0,0,0,.4)` |

### Satori notes (deliberate deviations from the mockup)

- Every container is `display: flex` — Satori has no block layout.
- No pseudo-elements: the inner frame, gem and dim overlay are real `<div>`s (the mockup already does this).
- `filter: brightness()` is unsupported — that is why cards 1 and 2 use a dim overlay div instead.
- The check icon is an inline `<svg>` with `stroke="currentColor"` replaced by the literal text colour `#1f261a`.
- If the ring via `box-shadow: 0 0 0 2px` does not render, use `border: 2px solid rgba(gold, .75)` and reduce the card's inner size by 4px to keep 236×330 outer.

### Verification

- [ ] `GET /api/og` returns `image/png` 1200×630 locally (`vercel dev`)
- [ ] `GET /api/og/noknaruephon` is pixel-identical to before
- [ ] Headline wraps to exactly two lines ("Pick tonight's game," / "together.")
- [ ] No BGG badge, no beta pill, no cover art anywhere on the image
- [ ] Response carries the cache headers above

**Commit message:** `feat(og): add default site-wide OG image at /api/og`

---

## Commit 2 — wire the meta tags

### Changes

For `index.html`, `welcome.html` (and any other non-shelf HTML page — list them in the PR description), set or replace:

```html
<!-- before (index.html) -->
<meta property="og:image" content="https://boardgameshelf.vercel.app/api/og/noknaruephon">

<!-- after -->
<meta property="og:title" content="BoardgameShelf">
<meta property="og:description" content="Track your games. Pick tonight's, together.">
<meta property="og:image" content="https://boardgameshelf.vercel.app/api/og">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="https://boardgameshelf.vercel.app/api/og">
```

If `index.html` has no existing `og:image`, just add the block. Do not touch the shelf page template or anything that sets the per-username image.

### Verification

- [ ] Paste `https://boardgameshelf.vercel.app` into iMessage / Slack / the OpenGraph debugger — new image appears, title "BoardgameShelf"
- [ ] Paste a shelf URL (`/u/noknaruephon`) — still shows the fanned real-cover image
- [ ] `grep -r "api/og/noknaruephon" *.html` returns nothing outside shelf templates

**Commit message:** `feat(og): point non-shelf pages at the default OG image`

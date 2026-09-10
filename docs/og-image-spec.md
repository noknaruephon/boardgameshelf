# Spec: OG image for shelf links

**Scope:** one concern — generate a 1200×630 Open Graph image per shelf and wire it into the page `<head>`. No changes to sync, the shelf UI, or the share-as-image feature.

**Mockup:** `docs/mockups/og-image-mockup.html` → layout **C · Hand**. This is the visual source of truth; the CSS values below are lifted from it.

---

## 1. Outcome

Pasting `https://boardgameshelf.vercel.app` (and later `/u/{username}`) into Slack, iMessage, Discord, WhatsApp, X or LinkedIn shows a card with five fanned covers on the right, and the shelf name, game count and URL on the left, in the walnut design system.

```
┌──────────────────────────────────────────────────────┐
│ ◆ BoardgameShelf                                     │
│                                    ╭──╮╭──╮╭──╮╭──╮   │
│                                  ╭╯  ╰╯  ╰╯  ╰╯  ╰╮  │
│  Nok's shelf                      │  fanned hand  │   │
│  196 games on the shelf           ╰───────────────╯   │
│                                                       │
│  boardgameshelf.vercel.app/u/noknaruephon             │
└──────────────────────────────────────────────────────┘
```

## 2. Files

| Action | Path |
|---|---|
| add | `api/og/[username].js` — Edge function, renders the PNG |
| add | `public/fonts/Fraunces-Regular.ttf`, `Fraunces-Medium.ttf`, `Inter-Regular.ttf`, `Inter-SemiBold.ttf`, `IBMPlexMono-Regular.ttf` |
| add | `package.json` dependency: `@vercel/og` (Vercel installs it; no local build step is introduced) |
| edit | `index.html` — `<head>` meta tags |
| add | `docs/mockups/og-image-mockup.html` (already designed) |

> Fonts: Satori (the renderer behind `@vercel/og`) needs static TTF/OTF/WOFF files — **not woff2, not variable fonts**. Download the static instances from Google Fonts. Fraunces' `opsz`/`SOFT` axes will not apply; that's acceptable.

## 3. Route: `api/og/[username].js`

```js
import { ImageResponse } from '@vercel/og';
import games from '../../games.json';      // v1: single shelf. See §7 for v2.

export const config = { runtime: 'edge' };

const SHELVES = {
  // v1 — one known shelf. Replace with a Supabase lookup in v2.
  noknaruephon: { name: "Nok's shelf", url: 'boardgameshelf.vercel.app/u/noknaruephon' },
};

const font = (file) =>
  fetch(new URL(`../../public/fonts/${file}`, import.meta.url)).then((r) => r.arrayBuffer());

export default async function handler(req) {
  const username = new URL(req.url).pathname.split('/').pop();
  const shelf = SHELVES[username];
  if (!shelf) return new Response('Not found', { status: 404 });

  const [fraunces, frauncesMed, inter, interSemi, mono] = await Promise.all([
    font('Fraunces-Regular.ttf'), font('Fraunces-Medium.ttf'),
    font('Inter-Regular.ttf'), font('Inter-SemiBold.ttf'), font('IBMPlexMono-Regular.ttf'),
  ]);

  const covers = pickCovers(games, 5);

  return new ImageResponse(<Card shelf={shelf} count={games.length} covers={covers} />, {
    width: 1200,
    height: 630,
    fonts: [
      { name: 'Fraunces', data: fraunces, weight: 400 },
      { name: 'Fraunces', data: frauncesMed, weight: 500 },
      { name: 'Inter', data: inter, weight: 400 },
      { name: 'Inter', data: interSemi, weight: 600 },
      { name: 'IBM Plex Mono', data: mono, weight: 400 },
    ],
    headers: {
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
```

If the repo doesn't already transpile JSX in `api/`, write the tree with `React.createElement` or use the `.jsx`/`.tsx` extension — Vercel handles either. Don't add a bundler for this.

### Cover selection — `pickCovers(games, n)`

Deterministic, so the image is stable between renders and cacheable:

1. Filter to games that have an `image` (full-size) field.
2. Sort by BGG rating descending (`rating` / `average` — use whatever `games.json` calls it), ties by name.
3. Take the first `n`.
4. If fewer than `n` have images, pad with a plate tile (see §4, "no cover").

*(Future: a `game_curation.og_featured` boolean would let Nok hand-pick the five. Not in this spec.)*

Use the **full `image` URL**, not `thumbnail` — thumbnails are ~200px and will look soft at 230×322. Satori fetches the URLs itself server-side, so the `/api/cover` CORS proxy is not needed here.

## 4. `<Card>` — layout C in Satori-safe CSS

Satori rules that matter: **flexbox only** (no grid), every element with more than one child needs `display: 'flex'`, `position: absolute` and `transform: rotate()` are supported, `object-fit: 'cover'` is supported, `box-shadow` and `radial-gradient` are supported, `backdrop-filter` is not.

Tokens (hardcode — no CSS variables in Satori):

```js
const T = {
  bg: '#16110d', plate2: '#2f2419', ivory: '#f2e8d5',
  ivory70: 'rgba(242,232,213,.7)', ivory45: 'rgba(242,232,213,.45)',
  gold: '#cfa957', goldGlow: 'rgba(207,169,87,.16)',
};
```
> Replace these with the production values from the live stylesheet before merging (`--bgs-bg`, `--bgs-plate`, `--bgs-ivory`, `--bgs-gold`).

Structure and values:

```
root            1200×630, display:flex, background T.bg, color T.ivory, overflow hidden
├─ copy         width 560, padding 64 0 60 64, flex column, justify-content space-between
│  ├─ mark      flex row, align center, gap 10
│  │  ├─ diamond   10×10, radius 2, background T.gold, transform rotate(45deg)
│  │  └─ text      Fraunces 500, 22px, letter-spacing -0.22px, "BoardgameShelf"
│  ├─ block     flex column
│  │  ├─ name      Fraunces 400, 92px, line-height 1, letter-spacing -1.84px
│  │  └─ count     Inter 400, 26px, T.ivory70, margin-top 18
│  │                 → "<count>" as a nested span: Inter 600, T.gold, then " games on the shelf"
│  └─ url       IBM Plex Mono 400, 18px, T.ivory45
└─ hand         flex 1, position relative
   ├─ glow      absolute inset 0, background radial-gradient(60% 55% at 60% 62%, T.goldGlow, transparent 70%)
   └─ tile ×5   absolute, 230×322, left 50%, top 50%, margin -161 0 0 -115,
                radius 10, overflow hidden, background T.plate2,
                box-shadow 0 24px 60px rgba(0,0,0,.6),
                transform-origin 50% 150%
                rotations (index 0→4):
                  rotate(-22deg) translateY(-6px)
                  rotate(-11deg) translateY(-16px)
                  rotate(0deg)   translateY(-22px)
                  rotate(11deg)  translateY(-16px)
                  rotate(22deg)  translateY(-6px)
       └─ img   width 100%, height 100%, object-fit cover
```

Satori doesn't support `inset` box-shadows for the 1px card edge; skip it — the drop shadow carries the separation.

**Long shelf names:** if `shelf.name.length > 14`, render the name at 72px instead of 92px. If `> 22`, 56px. Never wrap to three lines.

**No cover:** a tile with no `image` renders the plate background with the game name in Fraunces 400 28px, T.ivory, padded 24px, bottom-aligned.

## 5. `index.html` `<head>`

Before:
```html
<title>BoardgameShelf</title>
```

After (adapt title/description to whatever the page currently uses):
```html
<title>BoardgameShelf</title>
<meta property="og:type" content="website">
<meta property="og:site_name" content="BoardgameShelf">
<meta property="og:title" content="Nok's shelf — 196 games">
<meta property="og:description" content="A board game collection on BoardgameShelf.">
<meta property="og:url" content="https://boardgameshelf.vercel.app">
<meta property="og:image" content="https://boardgameshelf.vercel.app/api/og/noknaruephon?v=2026-09-10">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Five board game covers fanned like a hand of cards, with the shelf name and game count.">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Nok's shelf — 196 games">
<meta name="twitter:description" content="A board game collection on BoardgameShelf.">
<meta name="twitter:image" content="https://boardgameshelf.vercel.app/api/og/noknaruephon?v=2026-09-10">
```

- `og:image` **must be absolute**. Relative URLs are ignored by most scrapers.
- `?v=` is a cache-buster. Since sync is manual, bump it (or have the sync script write today's date) so previewers — which cache aggressively, Facebook and LinkedIn for weeks — pick up the new mosaic after a sync. The `s-maxage` on the route only covers Vercel's edge cache.
- `og:image:alt` is what screen readers get on platforms that expose it; keep it descriptive of the picture, not the site.
- The game count in `og:title` is a static string for v1; when the page is generated per user in v2 it comes from the profile.

## 6. Verification

- [ ] `curl -I https://boardgameshelf.vercel.app/api/og/noknaruephon` → `200`, `content-type: image/png`, `cache-control` as specified.
- [ ] Open the PNG: 1200×630, five real covers, fan matches the mockup, no fallback-font boxes (□) in the name or count.
- [ ] `…/api/og/nobody` → `404`.
- [ ] Temporarily rename a game's `image` to break the URL: that tile renders as a plate with the name, the route still returns 200.
- [ ] Shelf name of 20 and 26 characters renders at 72 / 56px with no third line.
- [ ] Paste the site URL into Slack and iMessage: card shows the image. Use https://www.opengraph.xyz or LinkedIn's Post Inspector to check other platforms without posting.
- [ ] Cold render (after a redeploy) completes under ~3 s. If it doesn't, drop to 4 covers before reaching for image resizing.
- [ ] Nothing changed in `games.json`, the shelf UI, or the share-as-image feature (diff is additive).

## 7. Deferred (not in this PR)

- **v2 multi-user:** replace `SHELVES` + `games.json` import with a Supabase RPC `get_shelf_og(username)` returning `{ display_name, game_count, covers[] }`. The route shape `/api/og/[username]` is already right for `/u/{username}`.
- **Curated picks:** `game_curation.og_featured`.
- **Sync hook:** have the sync script rewrite the `?v=` date in `index.html`.
- **Image weight:** if BGG full-size images make cold renders slow, proxy through `/api/cover` with a resize, or cache to R2.

## 8. Commit

```
feat: add OG image route and Open Graph meta tags

Adds /api/og/[username] (Vercel Edge, @vercel/og) rendering a
1200x630 card with five fanned covers, shelf name, count and URL.
Wires og:* and twitter:* tags into index.html.
```

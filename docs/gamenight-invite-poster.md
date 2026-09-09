# Spec: Game night invite image (poster layout)

Branch: `feat/invite-poster` · Flag: `?invite=1` · Mockup: `docs/mockups/gamenight-invite-poster.html`

## Goal

Let the host pick candidate games straight from the shelf, choose one as the headline, and share a poster-style image (Story 1080×1920, Square 1080×1080) that invites friends to a game night. The image carries the headline cover, a strip of the other candidates, date, host, the night's link, a QR, and the "Powered by BGG" badge.

Open `docs/mockups/gamenight-invite-poster.html` in a browser first. It is the visual source of truth: type sizes, spacing, fade, copy, and the strip overflow rule are all final there. Match it, don't reinterpret it.

## Scope

In:
- Shelf **select mode** (multi-select + headline star) behind `?invite=1`
- Sticky action bar with count, headline name, and "Share invite"
- Bottom sheet reusing the existing share-shelf sheet pattern: format picker (Story / Square), live preview, Share / Save PNG
- Canvas renderer for the poster
- Wiring to the existing game night creation so the link and QR point at a real `/n/:code`

Out (follow-up specs):
- OG image for `/n/:code`
- Venue on the poster (there is no host line)
- Persisting the date on the night (the sheet's date and time live in memory; with none set the poster renders "Date TBC")
- Any change to voting stages

## Before you write code

1. Read the existing share-shelf implementation (bottom sheet, canvas mosaic, format picker, Web Share + PNG fallback, `/api/cover` proxy). Reuse every piece you can; this feature is a sibling, not a rewrite.
2. Read how a game night is created today (Stage 1 RPC). Note its signature. This spec needs it to accept an ordered list of candidate ids plus a headline id. If it doesn't, extend it additively (new optional param, new nullable column `headline_game_id`), never by changing existing behaviour.
3. Confirm which feature-flag helper the codebase uses for `?vibes=1` / `?teach=1` and use the same one.

## 1. Select mode on the shelf

Entry: with `?invite=1`, add a "Plan a night" button next to the existing shelf actions. Clicking it toggles `body.is-selecting`.

While selecting:
- Each cover tile gains an overlay `<button class="pick" aria-pressed="false" aria-label="Add {title}">`. Clicking toggles selection and flips `aria-pressed` and the label ("Remove {title}").
- Selected tiles get the gold ring via `box-shadow: inset 0 0 0 3px var(--bgs-gold)` (never `outline`) and the check pip top-right, per mockup.
- Selected tiles also show a star button top-left: `<button class="star" aria-label="Make {title} the headline" aria-pressed="false">`. Tabler `star` outline, 24px, `currentColor`.
- The first selected game is the headline by default. Starring another game moves the headline. Deselecting the headline promotes the earliest remaining pick. Headline tile shows the gold "Headline" tag bottom-left.
- Order of selection is preserved; it's the order of the strip.

State lives in one object: `{ picked: number[], headline: number | null }`. Keep it in memory only; leaving select mode clears it.

Action bar (sticky bottom, `--bgs-plate`, shadow as mockup):
- Left: `<b aria-live="polite">{n} games picked</b>` and `<small>Headline: {title}</small>` (or "Pick at least one").
- Right: "Share invite" button, gold. Disabled state is not used; with zero picks it opens the sheet with the empty poster ("Pick a game") so the host sees why.

Exit: "Done" in the bar's left corner on mobile widths, or Escape. Focus returns to "Plan a night".

## 2. Share sheet

Reuse the share-shelf bottom sheet. Differences:
- Title: "Invite"
- Format picker: Story (default) and Square only. No Portrait.
- Preview: the poster canvas scaled to fit the sheet width. Re-render on format change and on any selection change if the sheet is open.
- "When": a "Date decided" switch (on by default) with a date and a time input under the format picker; switching it off hides the inputs and prints "Date TBC", for a host who isn't sure yet. The poster's date line reads "Sat 19 Sep, 7 pm" (minutes only when not :00, time optional), or "Date TBC" while empty. Re-render on change.
- Buttons: "Share" (Web Share API with the PNG file, falls back to download) and "Save PNG". Same code paths as the shelf share.
- Filename: `game-night-{code}-{story|square}.png`

On first open, create the night if one doesn't exist for this selection: call the Stage 1 RPC with `candidate_ids` (ordered) and `headline_game_id`. Store the returned code. Show a small inline spinner in the preview area while waiting; the QR and link render once the code arrives. If the RPC fails, render the poster without QR and with the link line replaced by "Couldn't create the night. Try again." plus a retry button in the sheet, not on the canvas.

## 3. Poster renderer

`renderInvitePoster({ format, headline, rest, night }) → Promise<HTMLCanvasElement>` — `night` carries `{ code, error, dateLabel }`

Layout constants come from the mockup; do not eyeball them. Story values, with Square in brackets:

| Region | Story | Square |
|---|---|---|
| Canvas | 1080 × 1920 | 1080 × 1080 |
| Hero | 0 → 1160 | 0 → 620 |
| Hero fade | bottom 46% of hero, `rgba(bg,0)` → `bg` | same |
| BGG badge | right 72, top 72, Plex Mono 22, ivory on `rgba(bg,.55)` pill, radius 8 | same |
| Body top | 1040 | 520 |
| Eyebrow | Inter 400 34, ivory 70% | same |
| Title | Fraunces 300 128, opsz 144, letter-spacing −0.02em, max width 920 | 84 |
| Strip tiles | 150 square, radius 10, gap 22 | 104, gap 16 |
| Strip "+N" tile | ring `inset 0 0 0 3px gold` at 80%, Plex Mono 500 40 gold | 28 |
| Strip caption | Inter 400 34, ivory 70% | 24 |
| Hairline | 2px gold 80%, bottom 330, inset 80 | bottom 230 |
| Footer | bottom 88, inset 80 | bottom 60 |
| Date | Plex Mono 500 44 | 32 |
| Link | Plex Mono 500 36, `boardgameshelf.app/n/{code}` | 26 |
| QR | 190 square, ivory plate radius 12, 14 padding | 140 |

Copy:
- Eyebrow: "We're probably playing"
- Strip caption: 0 others → "Bring your own if you like"; 1 → "or this one"; n → "or one of these {n}"
- Strip shows up to 5 others, then a "+{n−5}" tile. (The mockup's "up to 3" toggle was for comparison only; ship 5.)
- Empty headline: hero is `--bgs-plate`, title "Pick a game". Only reachable with zero picks.

Title wrapping: measure with `ctx.measureText`; wrap on spaces to max width; allow at most 2 lines; if a title still overflows at 2 lines, step the font size down in 8px increments to a floor of 96 (64 on Square). Long titles like "Brass: Birmingham" must never clip.

Fonts: call `document.fonts.load()` for the three faces at the exact weights used and await them before drawing. If `Fraunces` fails to load, draw anyway; do not block share on a font.

Images: draw the headline cover with cover-fit into the hero, and each strip cover cover-fit into its tile. Load through `/api/cover?u=` with `crossOrigin = "anonymous"` so the canvas stays untainted. If a cover fails, fill the region with the game's curated colour (`game_curation.colour`, fallback `--bgs-plate`) and set the title in Fraunces on it, as the mockup's placeholder plates do. Never let one failed image fail the whole render.

QR: vendor `qrcode-generator` (MIT, single file, no build step) into `/vendor/`. Encode the full `https://boardgameshelf.app/n/{code}` URL, error correction M, draw modules in `--bgs-bg` on the ivory plate. Skip the QR entirely when there is no code.

Colours: read `--bgs-bg`, `--bgs-plate`, `--bgs-ivory`, `--bgs-gold` from `getComputedStyle(document.documentElement)` at render time. No hex literals in the renderer.

## 4. Accessibility

- Select-mode tiles are real buttons with `aria-pressed`; the star is a separate button so screen-reader users get two clear actions per tile.
- The action bar count is `aria-live="polite"` so each tap is announced without moving focus.
- The sheet traps focus, closes on Escape, returns focus to "Share invite". Same as the existing sheet.
- The preview `<canvas>` carries `aria-label="Invite preview: {headline title}, {n} other games, {date}"`, updated on every render.
- Reduced motion: the only transition in this feature is the hero background colour swap in the mockup; the production sheet should honour `prefers-reduced-motion` the same way the shelf share sheet does. Do not add entrance animations.
- Don't combine `animation` and `transition` on the same property on the same element anywhere in this feature (WebKit drops the transition).

## 5. Files

- `docs/specs/gamenight-invite-poster.md` — this file
- `js/invite.js` (or wherever the share-shelf module lives; match its location and naming) — select mode, sheet wiring, renderer
- `vendor/qrcode-generator.js`
- CSS additions in the same stylesheet as the share sheet, scoped under `.is-selecting` and `.invite-sheet`
- Supabase: additive migration only if the Stage 1 RPC needs `headline_game_id`

## Verification

- [ ] `?invite=1` shows "Plan a night"; without the flag nothing changes on the shelf
- [ ] Tap 4 covers: ring + pip on each, first one carries "Headline", bar reads "4 games picked · Headline: {title}"
- [ ] Star the third pick: headline moves, tag moves, bar updates, preview re-renders if open
- [ ] Deselect the headline: next earliest pick becomes headline
- [ ] Share invite with 4 picks → sheet opens, night is created, code appears in link and QR
- [ ] Story and Square both match the mockup side by side at 100% (screenshot both, compare)
- [ ] 7 picks → strip shows 5 tiles plus "+1"; caption "or one of these 6"
- [ ] Headline "Brass: Birmingham" wraps to 2 lines without clipping on both formats
- [ ] Block `/api/cover` in devtools → hero and strip fall back to curated colour plates; share still works
- [ ] Web Share on iOS Safari and Android Chrome sends a PNG; desktop Chrome downloads it
- [ ] Canvas is not tainted (`toBlob` succeeds) after real BGG covers load
- [ ] Keyboard only: Tab reaches pick and star on every tile, Escape exits select mode, focus lands back on "Plan a night"
- [ ] VoiceOver: each tap announces the new count
- [ ] `prefers-reduced-motion: reduce` — no transitions or animations fire
- [ ] Lighthouse a11y on the shelf with select mode open stays at the current score or better

Commit message suggestion:

```
feat(invite): shelf select mode and poster-layout game night invite image (behind ?invite=1)
```

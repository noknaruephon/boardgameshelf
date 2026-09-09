# Spec: Game night invite image (poster layout)

Branch: `feat/invite-poster` · Flag: `?invite=1` · Mockup: `docs/mockups/gamenight-invite-poster.html`

## Goal

Let the host pick candidate games straight from the shelf, choose one as the headline, and share a poster-style image (Story 1080×1920, Square 1080×1080) that invites friends to a game night. The image carries the headline cover, a strip of the other candidates, date, host, the night's link, and a QR. No BGG badge on the poster; attribution lives on the `/n/:code` page the link opens.

Open `docs/mockups/gamenight-invite-poster.html` in a browser first. It is the visual source of truth: type sizes, spacing, fade, copy, and the strip overflow rule are all final there. Match it, don't reinterpret it.

## Scope

In:
- Entry from the Game Night selection mode, behind `?invite=1`
- A Share button in the Game Night selection bar
- Bottom sheet reusing the existing share-shelf sheet pattern: format picker (Story / Square), live preview, Share / Save PNG
- Canvas renderer for the poster
- Wiring to the existing game night creation so the link and QR point at a real `/n/:code`

Out (follow-up specs):
- OG image for `/n/:code`
- Editing date/time/venue in the sheet (use the values the night already has; if a value is missing, omit that line from the poster entirely, never render a placeholder)
- Any change to voting stages

## Before you write code

1. Read the existing share-shelf implementation (bottom sheet, canvas mosaic, format picker, Web Share + PNG fallback, `/api/cover` proxy). Reuse every piece you can; this feature is a sibling, not a rewrite.
2. Read how a game night is created today (Stage 1 RPC). Note its signature. This spec needs it to accept an ordered list of candidate ids plus a headline id. If it doesn't, extend it additively (new optional param, new nullable column `headline_game_id`), never by changing existing behaviour.
3. Confirm which feature-flag helper the codebase uses for `?vibes=1` / `?teach=1` and use the same one.

## 1. Selecting the games

There is no separate entry point. The Game Night pill's existing selection mode is where games are picked: tap the pill, tap covers, the bottom bar counts them. With `?invite=1` (or the flag on) that bar gains a **Share** button (Tabler `share`, ghost, next to Continue) that opens the invite sheet for the games already selected. It is disabled at zero picks, like the bar's other controls.

- Order of selection is preserved; it's the order of the strip.
- The first selected game is the headline by default. The host moves it in the sheet's "Headline and games" picker; there is no star on the shelf.
- The invite's own state (headline, date, place, night) lives in memory only; leaving selection mode clears it.

## 2. Share sheet

Mockup: `docs/mockups/invite-sheet-mobile.html` at 390px wide. Reuse the share-shelf bottom sheet (scrim, panel, scroll lock, focus trap, Escape). Differences:
- Title "Invite" with a Tabler `x` icon button to close. Sentence case everywhere; no mono-caps eyebrow labels.
- Preview first, at the top of the sheet, scaled to fit so the whole poster is always visible. Never cropped. Re-render on format change and on any selection change while the sheet is open.
- Format is a segmented control (Story / Square, `aria-pressed`) directly under the preview. No "Format" label.
- Settings are tappable rows (real buttons) with icon, label, value, chevron. No description line under the label:
  - **When** (calendar): tapping opens the native date/time picker; the input is never rendered inline. Value "Sat 19 Sep, 7 pm" (minutes only when not :00); unset reads "Add a date", muted, and the line is not on the poster.
  - **Where** (map-pin): a short text field folds out under the row. Value "Nok's"; unset reads "Add a place", muted, and the line is not on the poster.
  - **Headline and games** (star): cover thumbs, the headline ringed gold. Tapping opens the picks as tiles with the shelf's star treatment so the host can move the headline without leaving the sheet.
  - **Link** (link, copy icon): "/n/{code}". Tapping copies the full URL. While the night is being created it reads "Creating…"; if creation failed the row reads "Couldn't create the night. Tap to retry" and is the retry.
- One primary action: "Share invite" (Tabler `share`), gold, full width. Beneath it a quiet text button: "Save as PNG" downloads the file; on iPhone and iPad it reads "Save to Photos" and shows the image full screen, where press-and-hold offers Save to Photos (a web page cannot write to Photos directly; a download would land in Files).
- Filename: `game-night-{code}-{story|square}.png`
- Tabler icons: calendar, map-pin, star, link, copy, chevron-right, share, x. Outline, `currentColor`.

On first open, create the night if one doesn't exist for this selection: call the Stage 1 RPC with `candidate_ids` (ordered) and `headline_game_id`. Store the returned code. Show a small inline spinner in the preview area while waiting; the QR and link render once the code arrives. If the RPC fails, render the poster without QR and with the link line replaced by "Couldn't create the night. Try again."; the Link row is the retry, not anything on the canvas.

## 3. Poster renderer

`renderInvitePoster({ format, headline, rest, night }) → Promise<HTMLCanvasElement>` — `night` carries `{ code, error, dateLabel }`

Layout constants come from the mockup; do not eyeball them. Story values, with Square in brackets:

| Region | Story | Square |
|---|---|---|
| Canvas | 1080 × 1920 | 1080 × 1080 |
| Hero | 0 → 1160 | 0 → 620 |
| Hero fade | bottom 46% of hero, `rgba(bg,0)` → `bg` | same |
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
- Missing date: omit the date line. Missing venue: omit the "at {host}" line. The footer's left column collapses upward so the link keeps the same baseline gap to whatever sits above it; the link and QR always render once a code exists. No "TBC", no placeholders, ever.

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
- CSS additions in the same stylesheet as the share sheet, scoped under `.gn-bar__share` and `.invite-sheet`
- Supabase: additive migration only if the Stage 1 RPC needs `headline_game_id`

## Verification

- [ ] `?invite=1` adds Share to the Game Night selection bar; without the flag the bar is what it was
- [ ] Select 4 covers: Share enables; the sheet's headline is the first pick
- [ ] Move the headline in the sheet's picker: poster, thumbs and night key follow
- [ ] Deselect the headline on the shelf: the next earliest pick becomes headline
- [ ] Share with 4 picks → sheet opens, night is created, code appears in link and QR
- [ ] Story and Square both match the mockup side by side at 100% (screenshot both, compare)
- [ ] 7 picks → strip shows 5 tiles plus "+1"; caption "or one of these 6"
- [ ] Night with no date and no venue → footer shows only the link and QR, no empty lines or placeholders; with one of the two set, only that line appears
- [ ] Headline "Brass: Birmingham" wraps to 2 lines without clipping on both formats
- [ ] Block `/api/cover` in devtools → hero and strip fall back to curated colour plates; share still works
- [ ] Web Share on iOS Safari and Android Chrome sends a PNG; desktop Chrome downloads it
- [ ] Canvas is not tainted (`toBlob` succeeds) after real BGG covers load
- [ ] Keyboard only: Tab reaches Share in the bar, the sheet traps focus, Escape closes it and focus lands back on Share
- [ ] VoiceOver: each tap announces the new count
- [ ] `prefers-reduced-motion: reduce` — no transitions or animations fire
- [ ] Lighthouse a11y on the shelf with select mode open stays at the current score or better

Commit message suggestion:

```
feat(invite): shelf select mode and poster-layout game night invite image (behind ?invite=1)
```

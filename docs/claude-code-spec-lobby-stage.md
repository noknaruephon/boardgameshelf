# Game Night lobby — "The stage" (night-host.html)

Redesign of the host's waiting room for better hierarchy: the hidden deck becomes the hero (a fanned hand under a gold glow), the QR + code sit in a glass share bar, the roster becomes glass chips, and Start voting becomes a pill that turns gold the moment the table can start.

Design: canvas "Game Night waiting room — options", row **C · The stage — locked states** (four artboards: waiting, ready, deck shown · 5 players, QR full screen).
Flag: `?lobby=1` / `LOBBY_ENABLED = false` (same shape as `TV_ENABLED` in this file). Flag off = page exactly as today.

## Scope

- `night-host.html` only (its inline CSS + `runHost().render()`), plus two new exported helpers in `js/waiting-room.js`.
- `vote.html` keeps `deckHTML()` / `rosterHTML()` untouched — the new helpers are lobby-only.
- No DB change. No change to presence, `MIN_PLAYERS_TO_START`, `onStartVoting`, `onCancel`, the TV sheet, or the `.deal-wrap` loading shell.

## Step 0 — locate and report (no code)

Report, then stop for review:

1. In `night-host.html`: the flag block (`TV_ENABLED` … `tvOn`), `runHost()` → `render()`, `drawQR()`, `copyLink()`, the `qr-card` / `recap` / `start-btn` CSS.
2. In `js/waiting-room.js`: `deckHTML`, `attachDeckHandlers`, `rosterHTML` — confirm which pages import each.
3. Whether `night-host.html` already links `/css/glass.css` (I don't think it does). `vote-swipe.html` does — copy its include, same guard/flag semantics.
4. `MIN_PLAYERS_TO_START` value and where `deck[i].image` / `.title` come from.

## Commit 1 — layout, share bar, roster, CTA, QR sheet

Behind `lobbyOn`. `render()` branches: `lobbyOn ? renderStage() : render()` (keep the old body as-is).

### Page structure (top → bottom)

```
.eyebrow                    GAME NIGHT (existing)
.stage-title  h1            Tonight's deck
.stage-sub                  5 games · hidden until voting · you picked them
.fan-wrap                   ← Commit 2; Commit 1 renders the existing deckHTML() here
.share-bar.glass            [QR 76px] JOIN CODE / 5G37 / Tap the code to fill the screen  [gold copy round]
.here                       HERE NOW ······ n
.here-row                   [N Nok HOST] [M Mai] … [◌ Waiting for players…]
.tv-row (only if tvOn)      [glass pill: Show on TV]
.start-pill                 Start voting  |  Start voting · 3 players
.start-hint                 Needs 1 more player to start  |  Everyone swipes on their own phone.
.cancel-btn                 Cancel game night (existing)
```

`h1` text: **Tonight's deck** (replaces "Scan to join" — the QR says that itself).

`.stage-sub` copy, built in JS:
`${deck.length} ${games} · ${session.reveal_deck ? 'shown' : 'hidden until voting'} · ${session.mode === 'random' ? 'picked at random' : 'you picked them'}`
This replaces `.recap` (remove it in the stage branch).

### Share bar

```html
<div class="share-bar glass">
  <button class="share-bar__qr" id="qrOpen" type="button" aria-label="Show the QR code full screen">
    <div class="qr-frame qr-frame--thumb" id="qr"></div>
  </button>
  <div class="share-bar__text">
    <div class="share-bar__kicker">Join code</div>
    <div class="share-bar__code">${code}</div>
    <div class="share-bar__hint">Tap the code to fill the screen</div>
  </div>
  <button class="share-bar__copy" id="copyLink" type="button" aria-label="Copy link">
    <svg …copy icon…></svg>
  </button>
</div>
```

- `drawQR()` unchanged (still `/vote/${code}`, still page colour on ivory). The frame is now 76px; the SVG scales.
- `copyLink()`: the button is icon-only now, so the "Copied!" feedback becomes a swap to a check icon for 1.6s (`aria-label` → "Copied"), not a text swap. Keep the existing clipboard call.
- The whole `.share-bar__text` block is also a tap target for the QR sheet (wrap kicker/code/hint in the same `<button>` as the thumb, or a second button — one accessible name, "Show the QR code full screen"). Don't nest buttons.

### Roster → `lobbyRosterHTML(players, myName)` (new, `js/waiting-room.js`)

```html
<div class="here">
  <span class="here__label">Here now</span><span class="here__n">${n}</span>
</div>
<div class="here-row">
  ${players.map(p => `
    <span class="chip glass${p.name === myName ? ' chip--you' : ''}">
      <span class="chip__avatar">${initial(p.name)}</span>${p.name}
      ${p.name === myName ? '<span class="chip__tag">Host</span>' : ''}
    </span>`).join('')}
  <span class="chip chip--open${canStart ? '' : ' is-waiting'}">
    <span class="pulse"></span>${canStart ? 'Room for more' : 'Waiting for players…'}
  </span>
</div>
```

- `initial()` = first grapheme of the name, upper-cased (Thai names: first character is fine).
- Keep the existing `pop` enter animation on `.chip` (transform + opacity only — no transition on those props).
- `.pulse` is the existing 6px dot + opacity keyframes; in `.chip--open:not(.is-waiting)` the animation is off and opacity is 1.

### CTA

`.start-btn` is replaced (stage branch only) by `.start-pill`:

- Not ready: `disabled`, glass material, label "Start voting", text `--bgs-ivory` at 38%. Hint: `Needs ${short} more ${player(s)} to start`.
- Ready: gold fill, `--bgs-on-gold` text, label `Start voting · ${n} players`, trailing arrow icon, hint "Everyone swipes on their own phone." (existing).
- Same `id="startBtn"`, same handler.

### `.tv-row`

Only when `tvOn`: one centred glass pill `#showTv` "Show on TV" with the tv icon, opening the existing sheet. When `tvOn` is false the row is not rendered (no empty gap).

### QR sheet

Full-screen ivory dialog opened from the share bar. One instance, built on first open (like the TV sheet).

```html
<div class="qr-sheet" id="qrSheet" role="dialog" aria-modal="true" aria-labelledby="qrSheetTitle" hidden>
  <div class="qr-sheet__bar">
    <span class="qr-sheet__kicker" id="qrSheetTitle">Scan to join</span>
    <button class="qr-sheet__x" type="button" aria-label="Close">×</button>
  </div>
  <div class="qr-frame qr-frame--big"><!-- same svg string as #qr --></div>
  <div class="qr-sheet__code">${code}</div>
  <div class="qr-sheet__url">${location.host}/vote/${code}</div>
  <p class="qr-sheet__help">Hold the phone up — anyone at the table can scan with their camera.</p>
  <button class="qr-sheet__copy" type="button">Copy link</button>
</div>
```

- Opens with a 220ms fade + 8px rise on the sheet (transform/opacity, no transition on them elsewhere). Close: ×, Esc, or the browser back button is **not** wired (keep it simple).
- Focus moves to × on open and back to the opener on close. Body scroll locked via `js/scroll-lock.js` (the existing helper).
- `qr-sheet__copy` reuses `copyLink()` (text swap "Copied!" is fine here — it's a text button).
- QR is drawn once; store the SVG string from `drawQR()` and reuse it for the big frame (don't call `QRCode.toString` twice).

## Commit 2 — the fan and the glow

Replaces the `deckHTML()` call in the stage branch with `fanHTML(deck, session.reveal_deck)` (new, `js/waiting-room.js`).

```html
<div class="fan-wrap">
  <div class="fan-glow" aria-hidden="true"></div>
  <div class="fan" style="--n:${n}">
    ${cards}   <!-- .deck-card back  |  .deck-card clickable with <img> -->
  </div>
</div>
```

- Cards reuse `.deck-card` / `.deck-card.back` from `base.css` for the back pattern and border; the fan overrides size, radius, font and position (see constants).
- Face-down cards keep the **"?"** glyph (decision), set in Fraunces italic 600 at the fan size.
- Revealed covers use the same `<img>` markup as `deckHTML()` and are tappable → `attachDeckHandlers(container, deck)` works unchanged (it matches `.deck-card.clickable`).
- Each card: `--i` (0-based) and the fan sets `--step` from `n`. Rotation `calc((var(--i) - (var(--n) - 1) / 2) * var(--step))`, `transform-origin: 50% 135%`. z-index: middle card on top, falling off symmetrically (set inline per card in `fanHTML`, since CSS can't abs()).
- The glow is **always gold** (decision) — deck shown or hidden. It does not take the cover's colour. No `js/cover-light.js` here.
- Sizes and spread scale with deck size (table below). Above 10 games, cap at 10 in the fan and add a mono `+N` chip after the fan (`.fan-more`).
- Keep the existing `.deal-wrap` loading shell above; it is replaced by `renderStage()` exactly as today.

## Layout constants

| Element | Value |
| --- | --- |
| Page padding | as today (`24px 16px …`), `.screen` max-width 420 |
| h1 | Fraunces 600, 34px, line-height 1.05, left-aligned, `margin: 0 0 6px` |
| `.stage-sub` | Inter 13px, `--bgs-ivory-70`, left-aligned, `margin-bottom: 18px` |
| `.fan-wrap` | height 222px, `position: relative`, `margin-bottom: 18px` |
| Fan card (n ≤ 5) | 104 × 146, radius 10, `?` 34px |
| Fan card (6–7) | 92 × 130, radius 9, `?` 30px |
| Fan card (8–10) | 80 × 112, radius 8, `?` 26px |
| Fan step | `min(13deg, 52deg / (n − 1))`; n = 1 → 0deg |
| Fan card top | 44px; cards centred on the wrap's x-centre |
| Card shadow | `inset 0 0 0 1px rgba(gold,.22), 0 10px 24px rgba(0,0,0,.5)` |
| `.fan-glow` | 300 × 170, `top: 70px`, centred, `border-radius: 999px`, `radial-gradient(closest-side, rgba(gold,.38), rgba(gold,0))`, `filter: blur(26px)`, `pointer-events: none`, `z-index: 0` (cards above) |
| `.share-bar` | glass material, radius 18, padding 12, `display:flex; gap:14px; align-items:center`, `margin-bottom: 18px` |
| QR thumb | 76 × 76 ivory, radius 10, padding 6 |
| `.share-bar__kicker` | IBM Plex Mono 10px, `.18em`, uppercase, `--bgs-gold` |
| `.share-bar__code` | Fraunces 600, 36px, `.04em`, line-height 1 |
| `.share-bar__hint` | 11px, `--bgs-ivory-70` |
| `.share-bar__copy` | 44px round, gold fill, `--bgs-on-gold` icon 18px |
| `.here` | mono 11px `.18em` uppercase; label gold, count `--bgs-ivory-70`; `margin-bottom: 10px` |
| `.here-row` | `flex-wrap: wrap; gap: 8px`, `margin-bottom: 18px` |
| `.chip` | height 40, radius 999, padding `0 14px 0 5px`, 13px 500; glass |
| `.chip__avatar` | 30px round, `--bgs-plate`, `inset 0 0 0 1.5px gold`, Fraunces 14px |
| `.chip__tag` | mono 9px `.16em` uppercase gold, `margin-left: 2px` |
| `.chip--open` | `1.5px dashed rgba(ivory,.2)` border, no glass, padding `0 14px 0 12px`, `--bgs-ivory-70` |
| `.tv-row` | centred, `margin-bottom: 12px`; pill height 44 |
| `.start-pill` | height 56, radius 999, 16px 600, full width |
| Start pill (ready) | gold fill, `--bgs-on-gold`, arrow icon 18px, `box-shadow: 0 12px 32px rgba(gold,.25)` |
| Start pill (disabled) | glass material, text `rgba(ivory,.38)`, `cursor: default`, no opacity dim (the glass is the dim) |
| `.start-hint` | as today, `margin-top: 10px` |
| `.qr-sheet` | `position: fixed; inset: 0; z-index` above the TV sheet; ivory bg; padding `calc(52px + env(safe-area-inset-top)) 24px 40px`; column, centred |
| Big QR | 300 × 300 white tile, radius 20, padding 18, `0 16px 40px rgba(42,31,23,.14)`; `margin-top: 24px` |
| `.qr-sheet__code` | Fraunces 600, 64px, `.08em`, ink `--bgs-bg` |
| `.qr-sheet__url` | mono 12px, ink at 55% |
| `.qr-sheet__help` | 14px, ink at 70%, centred, `margin-top: auto` |
| `.qr-sheet__copy` | height 48, radius 999, `--bgs-bg` fill, ivory text |

`gold` = `rgb(var(--bgs-gold-rgb))`, `ivory` = `rgb(var(--bgs-ivory-rgb))`. Themes: everything is token-based; the QR sheet is the one intentionally light surface and uses the theme's `--bgs-ivory` / `--bgs-bg` pair, so it stays readable on every theme.

## Hard rules

- **WebKit**: never `animation` and `transition` on the same property of the same element. `.chip` keeps the `pop` animation on transform/opacity → no transitions on those props on `.chip`. The QR sheet's enter is a transition on the sheet element only.
- Focus rings via `box-shadow` only; the glass material's `--glass-focus` slot for `.glass` elements, `0 0 0 3px var(--bgs-bg), 0 0 0 5px var(--bgs-gold)` for the gold pill and copy round. No `outline` anywhere.
- Gold rings on avatars via `box-shadow: inset`, never `outline`.
- `prefers-reduced-motion`: `.pulse` animation off, `pop` off, QR sheet appears without the rise, fan renders in place (it has no motion anyway).
- All buttons are real `<button type="button">`; the share-bar QR/code target and the copy round each have an `aria-label`.
- Presence: `players` still comes from presence; `lobbyRosterHTML` is pure and takes the same array `rosterHTML` does.
- `deck[i].image` failures keep the `onerror="this.remove()"` behaviour from `deckHTML()` — a card with no image falls back to the plate + border, not a broken icon.

## Deliberate deviations from the canvas

- No back button in the header (the page has none today; "Cancel game night" stays the exit).
- The bottom "Copy link" glass pill is gone — Copy lives once, in the share bar. The bottom row is "Show on TV" only, and only when `tvOn`.
- Canvas URL text reads `/n/5G37`; production is `/vote/{code}` (what the QR already encodes).
- Deck shown state on the canvas uses placeholder colour tiles; production uses real covers via `deckHTML()`'s image markup.
- Canvas names (Mai, Ploy, Tan…) are placeholders; presence supplies real names.

## Verification

- [ ] Flag off: page identical to today (diff the rendered DOM against `main`).
- [ ] `?lobby=1`: h1 "Tonight's deck", sub line reflects deck size / shown-hidden / mode ("picked at random" for `mode === 'random'`).
- [ ] Fan renders 1, 3, 5, 7, 10 and 12 games (12 → 10 + `+2` chip); middle card on top; `?` glyph on backs; covers tappable when `reveal_deck`, open the game modal, not tappable when hidden.
- [ ] Glow is gold with the deck hidden and shown.
- [ ] Share bar: QR scans to `/vote/{code}`; copy round copies the same URL and swaps to a check for 1.6s; tapping QR or code opens the sheet.
- [ ] QR sheet: 300px QR scans from ~1.5 m; × and Esc close; focus returns to the opener; page doesn't scroll behind it; Copy link works there.
- [ ] Roster: host chip carries HOST; a second phone joining pops a new chip; open chip reads "Waiting for players…" with the pulse at n < min, "Room for more" with no pulse at n ≥ min; chips wrap cleanly at 5–8 names.
- [ ] Start pill: glass + "Start voting" + "Needs 1 more player to start" at n=1; gold + "Start voting · 2 players" + "Everyone swipes on their own phone." at n=2; tapping starts voting as today.
- [ ] `?tv=1&lobby=1`: "Show on TV" pill appears above the start pill and opens the TV sheet; without `?tv=1` no row, no gap.
- [ ] Cancel game night still present and working.
- [ ] Walnut, Navy, Mahogany, Oak: no hard-coded colours; QR sheet readable on all four.
- [ ] Reduced motion: no pulse, no pop, sheet fades without rising.
- [ ] Safari iOS: glass renders (backdrop-filter), no dropped transitions on `.chip`, no `outline` anywhere.

Suggested commit messages:
1. `night-host: stage lobby — share bar, chip roster, start pill, QR sheet (behind ?lobby=1)`
2. `night-host: fanned deck with gold glow (behind ?lobby=1)`

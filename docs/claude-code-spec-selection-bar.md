# Game Night selection bar — Claude Code spec

Repo: `noknaruephon/boardgameshelf` · Mockup: `docs/mockups/selection-bar-b.html` (copy the attached file there first) · Depends on: `css/glass.css` + `.glass` material from `claude-code-spec-liquid-glass.md` (Commit 1 must be merged).

## Goal

Replace the current full-width selection-mode bottom bar (Cancel · "N selected / Pick at least 2 more" · share · Continue) with two floating glass elements: a **status chip** that opens the selected-games list, and an **action pill** that carries the state. Same behaviour as today; only the surface changes.

Gate the same way as the glass restyle — this lives in `glass.css` / the glass code path. The non-flag bar stays as is.

## Hard constraints

- Transitions only, no `@keyframes`; never `animation` + `transition` on the same property of the same element (WebKit drops the transition).
- Rings/focus via `box-shadow` only. No `outline`, no `border`.
- Reuse the existing selection state, `MIN` (2) constant, share handler, Continue handler, cancel handler and the existing selected-list function. **Do not reimplement selection logic** — this is a view swap over existing state. Tokens from `base.css` verbatim.

## Structure

```
.selbar                      fixed; left/right 12px; bottom 16px + safe-area; max-width 406px; centred; flex column; align center; gap 10px; z-index above shelf
  .selbar__list.glass        selected-games list, absolute, bottom: calc(100% + 10px)
  button.selbar__chip.glass  status chip
  .selbar__row               flex; gap 10px; width 100%; justify center
    button.round.glass       Cancel (×)
    button.selbar__pill.glass  action pill
    button.round.glass       Share
.scrim                       fixed inset 0, rgba(bg,.4), only while list is open
```

## Constants

| Thing | Value |
|---|---|
| Chip | height 34px; padding `0 6px 0 14px`; radius 999; Plex Mono 12.5px; `--glass-fill-a:.45; --glass-blur:14px; --glass-shadow:0 4px 12px rgba(0,0,0,.35)` |
| Chip text | always `"{n} selected"` — "0 selected", "1 selected", "3 selected" |
| Chip colour | muted (`--bgs-muted`) when n < MIN; ivory when n ≥ MIN |
| Chip chevron | 22px slot, gold, chevron-up; rotates 180° (`.35s var(--ease-liquid)`) while list open; hidden (opacity 0, width 0) at n = 0 |
| Chip at n = 0 | `disabled`, `pointer-events:none`; still visible |
| Chip a11y | `aria-expanded`, `aria-controls="selbar-list"` |
| Round buttons | 52×52, radius 999, `--glass-fill-a:.5`, ivory icon |
| Pill | height 56; padding `0 26px`; radius 999; Inter 600 17px; `flex:1; max-width:260px`; `--glass-fill-a:.58`; `white-space:nowrap` |
| Pill n < MIN | glass, muted text, `"Pick {MIN−n} more"`, no icon, **disabled** (no-op on tap) |
| Pill n ≥ MIN | `.gold` — background `--bgs-gold`, text `--bgs-bg`, dice icon 22px + `"Continue · {n}"`; box-shadow `0 6px 18px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.35)`; refraction/thickness pseudos hidden |
| Pill transition | background, box-shadow, width — `var(--dur) var(--ease-liquid)`; the width change from "Pick 2 more" → "Continue · 3" must animate, not jump |
| Share | hidden until n ≥ MIN via `.hide` (opacity 0, width 0, no margin/padding, pointer-events none); fades/grows in |
| List | radius 24; padding 8; `--glass-fill-a:.66`; `transform-origin: 50% 100%`; closed `translateY(12px) scale(.94)` + opacity 0; open: none/1; `.45s var(--ease-liquid)` + opacity `.25s` |
| List header | Plex Mono 11px, `.12em` tracking, uppercase, gold: `"Selected · {n}"` |
| List item | flex, gap 12, padding 8, radius 16; cover thumb 36×45 radius 8 `object-position: center top`; title Fraunces 600 15px; meta Plex Mono 12px muted `"★ {rating} · {players}"`; remove × 32×32 radius 10 at right, `rgba(ivory,.06)` bg |
| List height | max `min(50vh, 420px)`, `overflow-y:auto` |
| Scrim | opacity transition `.3s`; tap closes list |

## Behaviour

1. Chip tap toggles the list (open ↔ close). Scrim tap and `Esc` close it. List content comes from the existing selected-list function; each item's × calls the existing deselect, which re-renders chip/pill/share and the card's checkbox. If the list empties, close it.
2. Cancel (×) = existing cancel (exit selection mode).
3. Continue = existing Continue handler; only reachable at n ≥ MIN.
4. Share = existing share handler.
5. Bar re-renders on every selection change from the shelf checkboxes too.
6. Reduced motion: all transitions off; list still opens/closes.

## Commit

`feat(gamenight): floating glass selection bar — status chip with list + morphing action pill`

Stop for review after.

## Deliberate deviations from the mockup

- Mockup's own selection state, card grid and demo bar are not shipped — wire to the real state.
- Mockup keeps the "i" info button on cards untouched; leave the existing card info affordance as is.

## Verification checklist

- [ ] Enter selection mode with flag on: chip "0 selected" (muted, no chevron, not tappable), pill "Pick 2 more" (glass, disabled), × visible, share hidden.
- [ ] Select 1: chip "1 selected", chevron appears, chip tappable; pill "Pick 1 more"; share still hidden.
- [ ] Select 2: chip turns ivory; pill morphs to gold "Continue · 2" with visible width transition; share fades in.
- [ ] Tap chip: list rises from the chip, scrim appears, chevron flips; items show thumb/title/meta; × removes and the shelf checkbox clears; count in header and chip update.
- [ ] Remove down to 0 from the list: list closes itself, chip back to "0 selected" and inert.
- [ ] Scrim tap and Esc close the list; `aria-expanded` correct.
- [ ] Cancel, Continue, Share call the same handlers as the old bar (diff shows no new business logic).
- [ ] Flag off: old bar unchanged.
- [ ] No `outline`; no `animation` in the new CSS; iOS Safari renders blur + rim on chip, pill, rounds and list.

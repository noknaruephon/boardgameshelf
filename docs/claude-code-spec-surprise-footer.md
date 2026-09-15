# "Tonight's surprise" sheet — footer & cancel — Claude Code spec

Repo: `noknaruephon/boardgameshelf` · Mockup: `docs/mockups/surprise-actions-a.html` (copy the attached file there first) · Depends on: `.glass` material in `css/glass.css` (glass Commit 1 merged).

## Goal

In the Game Night "Tonight's surprise" sheet, replace the current action row (`Re-roll 6` ghost + `Continue` gold, with a `Cancel` text link beneath) with a pinned glass footer — Re-roll (glass) beside Continue (gold, wider) — and move Cancel to a glass × in the sheet header.

**Nothing else in the sheet changes.** The game cards (artwork, title, meta, the per-card dice button, tap-to-keep behaviour and its visual state) stay exactly as they are today. The heading, subtitle and grab handle stay.

Lives in the glass code path (same gating as the rest of the restyle). Non-flag sheet unchanged.

## Hard constraints

- Transitions only; never `animation` + `transition` on the same property of the same element.
- Rings/focus via `box-shadow` only — no `outline`, no `border`.
- Reuse the existing re-roll, continue and cancel handlers and the existing re-roll count source. **No new business logic.** Tokens from `base.css` verbatim.

## Structure

```
.surprise-sheet
  .surprise-sheet__hd              (existing: grab handle, h2, p)
    button.surprise-sheet__x.glass   ← NEW, replaces the Cancel text link
  .surprise-sheet__scroll           (existing grid; add bottom padding so the last row clears the footer)
  .surprise-sheet__ft               ← NEW pinned footer
    button.btn.re.glass              Re-roll
    button.btn.go.gold               Continue
```

## Constants

| Thing | Value |
|---|---|
| × button | absolute; `top` aligned with the h2 cap-height (30px from sheet top in the mockup — match the real header), `right: 14px`; 40×40; radius 999; ivory icon 16px stroke 2.5; `--glass-fill-a:.4; --glass-shadow:0 4px 12px rgba(0,0,0,.3)`; `aria-label="Cancel"` |
| Footer | absolute inside the sheet; `left/right: 12px`; `bottom: calc(14px + env(safe-area-inset-bottom))`; flex; gap 10px; above the scroll area |
| Scroll bottom padding | 110px |
| Button base | height 54; radius 999; Inter 600 16px; flex center; gap 10; `white-space: nowrap` |
| Re-roll | `flex: 1`; `.glass` with `--glass-fill-a:.55`; ivory text; dice icon 20px (existing icon asset if there is one) |
| Re-roll count | `<span class="n">` — Plex Mono 500 14px, gold text, `padding: 2px 8px`, radius 999, background `rgba(var(--bgs-gold-rgb),.14)`. Bound to the existing count value (whatever "Re-roll 6" reads from today) |
| Continue | `flex: 1.35`; `.gold`: background `--bgs-gold`, text `--bgs-bg`; box-shadow `0 6px 18px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.35)`; glass pseudos hidden |
| Press | inherited from `.glass` (`--glass-fill-a:.74; scale(.97)`); give `.gold` the same `scale(.97)` on `:active` |
| Disabled Re-roll (if the existing logic ever disables it) | opacity .4, `pointer-events: none` — keep whatever condition exists today |

## Behaviour

1. × → existing cancel/close handler (same as the old Cancel link). Swipe-down to dismiss, if it exists, is unchanged.
2. Re-roll → existing handler; the count span re-renders from the existing value.
3. Continue → existing handler.
4. Footer stays pinned while the grid scrolls; the last card row must be fully visible above it.
5. Reduced motion: transitions off.

## Commit

`feat(gamenight): glass footer for Tonight's surprise — re-roll + continue, cancel as ×`

Stop for review after.

## Deliberate deviations from the mockup

- Mockup's cards, swap animation and re-roll pool are placeholders — do not touch the real cards or their logic.
- Mockup count is static 6 — bind to the real value.

## Verification checklist

- [ ] Flag on: footer is glass, pinned; Re-roll left with gold mono count, Continue right and visibly wider; no Cancel text link.
- [ ] × in header closes the sheet exactly as the old Cancel did.
- [ ] Re-roll and Continue trigger the same handlers as before (diff shows no new logic).
- [ ] Count updates whenever it did before.
- [ ] Scroll the grid: last row clears the footer; footer never scrolls.
- [ ] Cards are byte-identical in markup and CSS to before (diff the card partial).
- [ ] Flag off: sheet unchanged.
- [ ] No `outline`, no `animation` in new CSS; iOS Safari renders blur + rim on × and Re-roll.

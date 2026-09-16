# Spec — Game Night vote screen: glass action row

Scope: one change, one commit. Move the game-info button off the card into the vote action row, and restyle ×, ✓ and info as glass rounds. Nothing else on the screen changes.

Mockup: `docs/mockups/gamenight-vote-actions.html` (locked: "Info at right edge" + "Ambient glow behind row"). The old-info toggle in the mockup is for comparison only.

Depends on: liquid-glass Commit 1 (`glass.css`, `?glass=1`). Reuse the glass material from there — don't redefine blur/edge values here.

## Flag decision

Follow the existing pattern: the glass material applies under `?glass=1` via `glass.css`. The **layout change** (info moved into the row, sizes below) applies flag or not, so the info button is never left floating on the card. Without the flag the three rounds keep the current solid ring style.

## Before → after

Before (current `swipe` view):
- `.info` round (~40px) absolutely positioned top-right inside the card.
- Action row: two 64px rounds (× and ✓), centred, gap ~20px.

After:
- Card has no info button.
- Action row is a 4-column grid: `1fr auto auto 1fr`. × and ✓ stay in columns 2–3, exactly where they are today. Info sits in column 4, `justify-self: end`, flush to the card's right edge.
- All three are glass rounds; info is smaller and quieter.
- A soft ambient glow sits behind the row (decorative, `pointer-events: none`, `aria-hidden`).

## Layout constants

| Element | Value |
| --- | --- |
| Row height | 64px |
| Row horizontal margin | 16px (matches card) |
| × / ✓ size | 64px |
| Info size | 44px (min tap target — don't go smaller) |
| Gap between × and ✓ | 20px |
| Grid | `1fr auto auto 1fr`; info `justify-self: end`, `align-self: center` |
| Icon size × / ✓ | 26px, stroke 2.6, round caps |
| Info glyph | Fraunces italic 600, 18px, colour `--bgs-ivory` at ~65% (sand) |
| × stroke | coral (existing `--bgs-danger` or equivalent) |
| ✓ stroke | sage (existing success token) |
| Glass fill × / ✓ | as `glass.css` material |
| Glass fill info | one step quieter: fill ~5% white, edge ~12% white |
| Press | `transform: scale(.94)`, fill brightens one step, 180ms `cubic-bezier(.2,.8,.2,1)` |
| Glow | `inset: -30px -10px` behind the row; three radial gradients (coral 22% at 30%, sage 20% at 60%, gold 18% at 92%), `filter: blur(18px)` |

## Hard rules

- WebKit: never put `animation` and `transition` on the same property of the same element. The press `scale` is a `transition` on the button; if any idle/enter animation is added later, put it on an outer wrapper.
- Focus rings via `box-shadow` only — `0 0 0 2px var(--bgs-gold)` with a 3px offset ring (`0 0 0 3px var(--bgs-bg), 0 0 0 5px var(--bgs-gold)`). No `outline`.
- Respect `prefers-reduced-motion`: disable the press transition, keep the scale snap.
- Info button keeps its existing handler and `aria-label="Game info"`. × / ✓ keep `aria-label="Pass"` / `"Play"` and the existing swipe-lock behaviour.
- Glow must not intercept touches or interfere with the card drag gesture — `pointer-events: none`, positioned behind the row only (not over the card).

## Deliberate deviations from the mockup

- Mockup uses inline glass values; production uses the shared material in `glass.css`.
- Mockup cover art is a CSS placeholder; production uses the real cover as today.
- Mockup renders the whole screen in a phone frame; only the action row and info button change in production.

## Verification

- [ ] Info button no longer appears on the card in any vote state (1/4 … 4/4).
- [ ] × and ✓ have not moved: same size, same centre position as before the change.
- [ ] Info is flush to the card's right edge, vertically centred on the row, 44px.
- [ ] With `?glass=1`: all three read as glass; info is visibly quieter than × / ✓.
- [ ] Without the flag: same layout, current solid style, no floating info on the card.
- [ ] Tap info → existing info sheet opens. Tap × / ✓ → vote locks as before.
- [ ] Swipe gesture on the card unaffected; glow does not block drags.
- [ ] Keyboard focus shows gold `box-shadow` ring on each round; no `outline` anywhere.
- [ ] Reduced motion: no transition, press still visibly registers.
- [ ] iOS Safari: glass renders (backdrop-filter with `-webkit-` prefix), no dropped transitions.

## Commit

`feat(gamenight): move info into glass action row on vote screen`

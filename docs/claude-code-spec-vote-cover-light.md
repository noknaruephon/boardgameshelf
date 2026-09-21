# Spec: Cover light on the Game Night vote screen

**Mockup:** `docs/mockups/vote-cover-light-a.html` (locked: option A "Wash")
**Flag:** `?coverlight=1` (no entry point; remove the gate in a later task once verified on device)
**Depends on:** glass Commit 1 (`glass.css`), `claude-code-spec-vote-actions.md` (the action row and its ambient gold glow)
**Commits:** two, in order. Stop for review after Step 0 and after each commit.

## What this is

On the swipe-to-vote screen, the whole screen background takes the colour of the card currently on top of the deck. A heavily blurred, enlarged copy of that card's cover sits behind everything; when the voter swipes, it cross-fades to the next cover. A veil fades the light back to the theme background behind the top bar and at the bottom edge so text stays legible.

Pure CSS plus one small JS function. No canvas, no colour extraction, no new network requests, no new dependencies.

## Scope

In scope: the swipe-to-vote screen only, all rounds including rematch rounds.

Out of scope: results/ranking screen, waiting states, selection mode, the shelf, the game modal, the landing page. The vote card itself, the × / ✓ / info rounds, the header and the progress indicator do not change.

## Step 0: locate, report, stop

The mockup's screen chrome was reconstructed from the locked action-row design, not copied from source. **Do not copy chrome from the mockup.** Only the `.light` layer and its CSS transfer.

Before editing, find and report:

1. The file(s) that render the vote screen and the element that wraps the whole screen (the light's parent).
2. The function that advances to the next card after a vote, and how a rematch round re-deals.
3. How the current card's cover URL is obtained (the exact string used for the card `<img src>`).
4. The selector for the ambient gold glow behind the action row (from the vote-actions spec).
5. How existing flags (`?glass=1`, `?vibes=1`) are read, so `?coverlight=1` follows the same pattern.

Stop and show me these five answers before Commit 1.

## Hard constraints (repeat of house rules)

- **WebKit rule:** never put `animation` and `transition` on the same property of the same element. The two light images transition `opacity` only and carry no animation. Their `transform` is static.
- Focus rings stay `box-shadow` only. This work adds no focusable elements.
- Production token names only (`--bgs-bg`, `--bgs-bg-rgb`). No hard-coded theme colours: the veil must work on Navy, Walnut, Mahogany and Oak unchanged.

## Layout constants

| Constant | Value | Note |
|---|---|---|
| Light source image box | 160 × 200 px | Rendered small, then scaled. Keeps the blur cheap on phones |
| Scale | 4.6 | `transform: translate(-50%,-50%) scale(4.6)` centred in the screen |
| Blur | 22 px | Applied at the small size, so the visual blur is about 100 px |
| Saturate | 1.6 | |
| Lit opacity | 0.62 | Class `.on` |
| Cross-fade | 0.6 s, opacity only | 0 s under reduced motion |
| Veil stops (top to bottom) | bg 100% at 0, bg 35% at 22%, bg 25% at 70%, bg 85% at 100% | `rgba(var(--bgs-bg-rgb), a)` |
| Layer order | light at `z-index:-1` inside an isolated parent | Parent gets `isolation:isolate; overflow:hidden` |

## Commit 1: the light layer (static)

**Markup**, first child of the vote screen wrapper, only when the flag is on:

```html
<div class="cover-light" aria-hidden="true"><img alt=""><img alt=""></div>
```

**CSS** (new block in the vote screen's stylesheet; if glass chrome is loaded separately, this goes with the vote screen styles, not in `glass.css`):

```css
/* Cover light: two stacked copies cross-fade on OPACITY only (WebKit rule). */
.vote-screen--coverlight { isolation: isolate; overflow: hidden; }   /* use the real wrapper selector from Step 0 */
.cover-light { position: absolute; inset: 0; z-index: -1; pointer-events: none; }
.cover-light img {
  position: absolute; left: 50%; top: 50%;
  width: 160px; height: 200px; object-fit: cover;
  opacity: 0; transition: opacity .6s;
  filter: blur(22px) saturate(1.6);
  transform: translate(-50%, -50%) scale(4.6);
}
.cover-light img.on { opacity: .62; }
.cover-light::after {
  content: ""; position: absolute; inset: 0;
  background: linear-gradient(to bottom,
    var(--bgs-bg) 0,
    rgba(var(--bgs-bg-rgb), .35) 22%,
    rgba(var(--bgs-bg-rgb), .25) 70%,
    rgba(var(--bgs-bg-rgb), .85) 100%);
}
@media (prefers-reduced-motion: reduce) { .cover-light img { transition: none; } }
```

**Gold glow:** when the flag is on, hide the fixed ambient gold glow behind the action row (selector from Step 0). The wash replaces it; both together read muddy. With the flag off, nothing changes.

**JS**, one function beside the vote screen code:

```js
// Cross-fades the screen light to a cover. Pass null to fade the light out.
let _lightIdx = 0;
function setCoverLight(url) {
  const imgs = document.querySelectorAll('.cover-light img');
  if (imgs.length !== 2) return;
  if (!url) { imgs.forEach(i => i.classList.remove('on')); return; }
  const next = imgs[_lightIdx ^= 1], prev = imgs[_lightIdx ^ 1];
  next.onerror = () => next.classList.remove('on');   // no stand-in in production: a failed cover means no light
  next.src = url;                                      // MUST be the exact string the card <img> uses, so it is a cache hit
  next.classList.add('on'); prev.classList.remove('on');
}
```

Copy any `referrerpolicy` / `crossorigin` attributes the card image uses onto both light images, so the browser treats the request as the same resource.

In this commit, call `setCoverLight()` once, for the first card when the vote screen opens.

**Commit message:** `feat(gamenight): cover light layer on vote screen behind ?coverlight=1`

Stop for review.

## Commit 2: follow the deck

- Call `setCoverLight(nextCoverUrl)` at the moment the vote is committed (the same tick the card starts to fly out), not after the fly-out ends. The 0.6 s fade then overlaps the card motion, as in the mockup.
- Do **not** change the light during a drag that snaps back.
- Rematch: when `start_rematch` flips status back to `voting` and the narrowed deck is dealt, call `setCoverLight()` with the new first card.
- After the voter's last card (waiting for others, or moving to results), call `setCoverLight(null)` so the screen returns to the plain theme background. The results screen gets no light.
- Leaving the vote screen by the × also clears the light (so a stale image never flashes on re-entry).

**Commit message:** `feat(gamenight): cover light follows the vote deck, clears at end of round`

Stop for review.

## Deliberate deviations from the mockup

- The mockup loops its five-card deck; production ends the round normally and fades the light out.
- The mockup falls back to flat colour stand-ins when a cover fails to load. Production does not: no cover, no light.
- The mockup's header, progress bar, live count and card are approximations. Production chrome is untouched.
- Mockup token values are approximated; production uses the real tokens.

## Known follow-up (not in this task)

When the light theme (fifth theme slot) lands, a coloured wash over a paper background will look muddy. Cover light should be disabled for light themes, or get its own treatment, in that theme's spec.

## Verification checklist

- [ ] Flag off: vote screen is pixel-identical to today, gold glow present
- [ ] Flag on: first card lights the screen on open; gold glow hidden
- [ ] Each committed vote cross-fades to the next cover; a snapped-back drag does not
- [ ] Network panel: no additional image requests when the light changes (cache hits only)
- [ ] Header title, live count, progress and the × / ✓ / info rounds stay legible over the brightest covers in the collection (try a yellow box and a white box)
- [ ] Clay × and sage ✓ remain distinguishable over warm and green covers
- [ ] All four dark themes: the veil fades to that theme's own background, no navy showing through on Walnut/Mahogany/Oak
- [ ] Rematch round relights from its first card
- [ ] Last card: light fades out; results screen has no light
- [ ] Broken cover URL: light stays off, no broken-image icon, no console error loop
- [ ] Reduced motion: light swaps instantly
- [ ] iOS Safari on a real phone: drag stays smooth; opacity fade actually animates (WebKit rule check: no `animation` on `.cover-light img`)
- [ ] Two voters on different cards each see their own card's light (it is local state, nothing goes over Realtime)

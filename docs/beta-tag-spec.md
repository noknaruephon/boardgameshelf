# Beta tag — wordmark pill

Save as `docs/beta-tag-spec.md`. Two commits. Stop for review after each.

## Goal

A small "Beta" pill beside the BoardgameShelf wordmark on every page that carries the header. Hover or tap opens a one-line tooltip explaining the site is under active development, with a link to a feedback form. No layout shift, nothing to dismiss, no localStorage.

## Where it appears

Every page with the wordmark header:

- landing / sign-in (`index.html`)
- `/welcome`
- shelf page (`/:username`) — the game modal lives inside this page, so it's covered
- `/n/:code` game night page
- `/bag/:id`
- `/privacy`, `/terms`

Never on: the OG image (`/api/og/[username]`), the invite poster canvas, the QR/link share sheets. If the poster renderer or any share surface reuses header markup, the pill must be excluded there.

If the header is a shared partial or injected by JS, add it once there. If each page has its own header markup, add it to each page listed above — check before assuming.

## Commit 1 — the pill

Inside the wordmark element, directly after the wordmark text:

```html
<a class="bgs-wordmark" href="/">BoardgameShelf<button type="button" class="bgs-beta" aria-label="Beta — about this label">Beta</button></a>
```

If the wordmark is not a link, use the same structure inside whatever wraps it. Text content is `Beta` (sentence case in the DOM, uppercased via CSS so screen readers don't spell it out).

```css
.bgs-beta {
  display: inline-block;
  margin-left: 10px;
  padding: 3px 8px;
  border: 1px solid rgba(var(--bgs-gold-rgb), 0.6);
  border-radius: 999px;
  background: transparent;
  color: var(--bgs-gold);
  font-family: 'IBM Plex Mono', monospace;
  font-style: normal;
  font-weight: 500;
  font-size: 11px;
  letter-spacing: 0.14em;
  line-height: 1;
  text-transform: uppercase;
  vertical-align: middle;
  position: relative;
  top: -1px;
  cursor: default;
  -webkit-appearance: none;
  appearance: none;
}
.bgs-beta:focus-visible {
  box-shadow: 0 0 0 2px var(--bgs-bg), 0 0 0 4px var(--bgs-gold);
}
```

Use the token names exactly as they exist in `css/base.css`. If `--bgs-gold-rgb` is named differently, use the real name — don't add a new token.

Rules:
- Focus ring via `box-shadow` only. No `outline` anywhere.
- The pill must not change the header's height. If the wordmark line-height is tight, adjust `top` rather than padding.
- The wordmark's own italic must not leak into the pill (`font-style: normal` is there for that).

Commit message: `feat(header): add beta pill beside the wordmark`

## Commit 2 — tooltip and feedback link

Add one config constant near the other site-level constants (or at the top of the header script):

```js
const BETA_FEEDBACK_URL = ''; // fill in the Google Form / Tally link
```

Markup, added as a sibling immediately after the pill (inside the wordmark wrapper so positioning is relative to it):

```html
<div class="bgs-beta-tip" role="tooltip" id="bgs-beta-tip" hidden>
  We’re still in beta and actively improving. If something isn’t working as expected, we’d love to know.
  <a href="" target="_blank" rel="noopener" class="bgs-beta-tip__link">Give feedback →</a>
</div>
```

- Set `aria-describedby="bgs-beta-tip"` on the pill.
- Set the link's `href` from `BETA_FEEDBACK_URL` at init. If the constant is empty, remove the link element entirely — no dead link, no placeholder.

```css
.bgs-wordmark { position: relative; }
.bgs-beta-tip {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 30;
  max-width: 260px;
  padding: 10px 12px;
  border: 1px solid rgba(var(--bgs-gold-rgb), 0.25);
  border-radius: 8px;
  background: var(--bgs-plate);
  color: var(--bgs-ivory);
  font-family: 'Inter', sans-serif;
  font-style: normal;
  font-weight: 400;
  font-size: 13px;
  line-height: 1.45;
  letter-spacing: 0;
  text-transform: none;
  opacity: 0;
  transform: translateY(-4px);
  transition: opacity 120ms ease-out, transform 120ms ease-out;
  pointer-events: none;
}
.bgs-beta-tip.is-open {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}
.bgs-beta-tip__link {
  display: block;
  margin-top: 6px;
  color: var(--bgs-gold);
  text-decoration: underline;
  text-underline-offset: 3px;
}
@media (prefers-reduced-motion: reduce) {
  .bgs-beta-tip { transition: none; transform: none; }
}
```

Behaviour (vanilla JS, one small module):
- Pointer devices (`@media (hover: hover)`): open on `mouseenter` of the pill, close on `mouseleave` of the wordmark wrapper (so the cursor can travel into the tooltip to reach the link). 150ms close delay.
- Touch: `click` on the pill toggles. Close on tap outside, on `Escape`, and on scroll.
- Toggle by adding/removing `is-open` and flipping the `hidden` attribute (remove `hidden` before adding `is-open`; re-add `hidden` on `transitionend` — or immediately under reduced motion).
- Keyboard: pill is focusable (it's a button). `Enter`/`Space` toggle. `Escape` closes and returns focus to the pill.
- If the tooltip would overflow the right edge of the viewport, add class `is-flipped` which sets `left: auto; right: 0`.

WebKit rule: the tooltip uses `transition` on `opacity` and `transform`. Do not add any `animation` to the same element. If an entrance animation is ever wanted, put it on an inner wrapper.

Commit message: `feat(header): beta tooltip with feedback link`

## Layout constants

| Item | Value |
|---|---|
| Pill gap from wordmark | 10px |
| Pill padding | 3px 8px |
| Pill font | IBM Plex Mono 500, 11px, 0.14em tracking, uppercase |
| Pill border | 1px, gold at 60% |
| Pill radius | 999px |
| Pill optical nudge | top: -1px |
| Tooltip offset | 8px below wordmark |
| Tooltip max width | 260px |
| Tooltip padding | 10px 12px |
| Tooltip radius | 8px |
| Tooltip font | Inter 400, 13px / 1.45 |
| Tooltip motion | opacity + translateY(-4px → 0), 120ms ease-out |
| Close delay (hover) | 150ms |

## Copy (final)

- Pill: `Beta`
- Tooltip: `We’re still in beta and actively improving. If something isn’t working as expected, we’d love to know.`
- Link: `Give feedback →`

## Deviations from the mockup

- Mockup pill was a `<span>`; shipped as a `<button>` so the tooltip is keyboard-reachable.
- Mockup used a 10px gap; kept. Everything else matches.

## Verification

Commit 1:
- [ ] Pill visible on all seven page types listed above, nowhere else
- [ ] Not present on OG image, poster, or share sheets
- [ ] Header height unchanged (compare before/after in devtools)
- [ ] Pill text is upright, not italic
- [ ] Tab to the pill shows a gold box-shadow ring; no `outline` in the diff
- [ ] Wordmark link still navigates to `/` on click of the text; clicking the pill does not navigate

Commit 2:
- [ ] Hover opens tooltip on desktop; moving the cursor into the tooltip keeps it open; leaving closes after ~150ms
- [ ] Tap toggles on iOS Safari and Android Chrome; tap outside closes; scroll closes
- [ ] `Escape` closes and focus returns to the pill
- [ ] With `BETA_FEEDBACK_URL` empty, no link is rendered
- [ ] With a URL set, link opens in a new tab with `rel="noopener"`
- [ ] Tooltip never overflows the viewport on a 320px-wide screen (flips to right-aligned)
- [ ] `prefers-reduced-motion: reduce` — tooltip appears instantly, no transform
- [ ] No `animation` and `transition` on the same property anywhere in the added CSS

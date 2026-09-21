// Shared screen wash (docs/claude-code-spec-vote-cover-light.md). Used by the
// swipe screen and the results reveal. Opacity-only cross-fade between two
// static images: nothing here may ever grow an animation (WebKit rule).
//
// The styles live in css/base.css, so both pages get the same wash from one
// copy — the reason this module exists at all rather than a second one drifting
// inside results.html.

let lightIdx = 0;

/**
 * Adds the layer once and marks the body as washed.
 *
 * The layer belongs to the page, not to #screen: it has to reach past the
 * column into the gutters, and #screen's contents are replaced wholesale on
 * every render, which would throw it away. Call this at the end of <body>, so
 * the element already exists, and leave it in place for the life of the page.
 * setCoverLight(null) is what turns it off, so a fade out plays in full instead
 * of being cut short by the next render.
 */
export function initCoverLight() {
  if (document.querySelector('.cover-light')) return;
  document.body.classList.add('coverlight');
  document.body.insertAdjacentHTML(
    'afterbegin',
    '<div class="cover-light" aria-hidden="true"><img alt=""><img alt=""></div>',
  );
}

/**
 * Cross-fades the screen light to a cover. Call with null to fade it out.
 *
 * The two images take turns: the incoming one takes the src and `.on`, the
 * outgoing one only loses `.on`. So the swap is a plain opacity transition
 * between two static elements — nothing here touches transform, and nothing
 * here may ever grow an animation.
 *
 * A no-op when the page never called initCoverLight(), since the layer is only
 * in the markup then.
 *
 * @param {string} [url] the *exact* string the card's own <img src> uses, so
 *   the browser serves it from cache rather than fetching the cover twice.
 *   That card image carries neither referrerpolicy nor crossorigin, so these
 *   carry neither either: adding one would make it a different request.
 */
export function setCoverLight(url) {
  const imgs = document.querySelectorAll('.cover-light img');
  if (imgs.length !== 2) return;
  if (!url) { imgs.forEach((i) => i.classList.remove('on')); return; }
  const next = imgs[lightIdx ^= 1];
  const prev = imgs[lightIdx ^ 1];
  // No stand-in in production, unlike the mockup: a cover that will not load
  // means no light, rather than a broken image sitting behind the deck.
  next.onerror = () => next.classList.remove('on');
  next.src = url;
  next.classList.add('on');
  prev.classList.remove('on');
}

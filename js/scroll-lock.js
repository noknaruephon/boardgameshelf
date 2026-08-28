// Background scroll lock, shared by every page.
//
// Each overlay on the site — the game detail modal, the shelf's filter sheet
// and Game Night dialogs, the host's confirm dialog — covers the page with a
// scrim, so letting the page scroll underneath is only ever a way to lose your
// place. Locking is a property of "is anything open", not of any one overlay,
// which matters because overlays hand off to each other: the selected-games
// tray closes as the confirm dialog opens, and a lock owned by either one
// would flicker or strand the page.
//
// So pages register a predicate per overlay and call syncScrollLock() after
// any change. The answer is derived from what is actually on screen rather
// than counted, which cannot drift out of step with the DOM.

const isOpenChecks = new Set();

/**
 * Registers an overlay. `isOpen` is called on every sync and should report
 * whether that overlay is currently showing.
 */
export function registerOverlay(isOpen) {
  isOpenChecks.add(isOpen);
}

let lockedScrollY = 0;

function setScrollLocked(locked) {
  if (locked === document.body.classList.contains('scroll-locked')) return;

  if (locked) {
    lockedScrollY = window.scrollY;
    // Taking the body out of flow removes the scrollbar on pointer platforms;
    // widening the padding by that gutter keeps content from jumping sideways.
    const gutter = window.innerWidth - document.documentElement.clientWidth;
    if (gutter > 0) {
      const basePad = parseFloat(getComputedStyle(document.body).paddingRight) || 0;
      document.body.style.paddingRight = `${basePad + gutter}px`;
    }
    document.body.style.top = `-${lockedScrollY}px`;
    document.body.classList.add('scroll-locked');
  } else {
    document.body.classList.remove('scroll-locked');
    document.body.style.top = '';
    document.body.style.paddingRight = '';
    // The page jumped to 0 the moment the body left flow; put it back.
    window.scrollTo(0, lockedScrollY);
  }
}

/** Locks or releases the page to match whichever overlays are open. */
export function syncScrollLock() {
  let anyOpen = false;
  for (const isOpen of isOpenChecks) {
    if (isOpen()) {
      anyOpen = true;
      break;
    }
  }
  setScrollLocked(anyOpen);
}

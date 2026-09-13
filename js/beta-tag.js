// Beta pill tooltip, shared by every page with the wordmark header.
//
// The pill itself is markup on each page (a <button class="bgs-beta"> inside
// the .bgs-wordmark wrapper); this module builds the tooltip beside it and
// wires the open/close behaviour. Spec: docs/beta-tag-spec.md.
//
// Open on hover for pointer devices, with the wrapper (not the pill) owning
// mouseleave so the cursor can travel down into the tooltip to reach the
// feedback link. Tap toggles on touch. Escape closes and hands focus back to
// the pill. Nothing is remembered between visits: there is nothing to dismiss.

import { BETA_FEEDBACK_URL } from '/js/config.js';

const CLOSE_DELAY_MS = 150;
const TRANSITION_MS = 120;
const VIEWPORT_GUTTER_PX = 8;

function buildTip() {
  const tip = document.createElement('div');
  tip.className = 'bgs-beta-tip';
  tip.id = 'bgs-beta-tip';
  tip.setAttribute('role', 'tooltip');
  tip.hidden = true;
  tip.append('BoardgameShelf is in beta — things will change and get better.');
  // No URL, no link: a dead link is worse than none.
  if (BETA_FEEDBACK_URL) {
    const link = document.createElement('a');
    link.className = 'bgs-beta-tip__link';
    link.href = BETA_FEEDBACK_URL;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = 'Tell me what’s off →';
    tip.append(link);
  }
  return tip;
}

function init() {
  const pill = document.querySelector('.bgs-beta');
  const wrap = pill && pill.closest('.bgs-wordmark');
  if (!pill || !wrap) return;

  const tip = buildTip();
  pill.insertAdjacentElement('afterend', tip);
  pill.setAttribute('aria-describedby', tip.id);

  const hoverMq = window.matchMedia('(hover: hover)');
  const motionMq = window.matchMedia('(prefers-reduced-motion: reduce)');
  let closeTimer = 0;
  let hideTimer = 0;
  const isOpen = () => tip.classList.contains('is-open');

  function open() {
    clearTimeout(closeTimer);
    clearTimeout(hideTimer);
    if (isOpen()) return;
    tip.hidden = false;
    // Measure unflipped, then flip if the right edge would leave the viewport.
    // A wrapper narrower than the tooltip (the centred landing wordmark on a
    // phone) can overflow the left edge once flipped instead, so as a last
    // resort pin the tooltip to the viewport gutter.
    tip.classList.remove('is-flipped');
    tip.style.left = '';
    let box = tip.getBoundingClientRect(); // also forces the reflow the transition needs
    if (box.right > window.innerWidth - VIEWPORT_GUTTER_PX) {
      tip.classList.add('is-flipped');
      box = tip.getBoundingClientRect();
      if (box.left < VIEWPORT_GUTTER_PX) {
        tip.classList.remove('is-flipped');
        tip.style.left = `${VIEWPORT_GUTTER_PX - wrap.getBoundingClientRect().left}px`;
      }
    }
    // Point the caret at the pill wherever the tooltip ended up, keeping it
    // clear of the rounded corners.
    const pillBox = pill.getBoundingClientRect();
    const tipBox = tip.getBoundingClientRect();
    const caret = Math.min(Math.max(pillBox.left + pillBox.width / 2 - tipBox.left, 14), tipBox.width - 14);
    tip.style.setProperty('--bgs-tip-caret', `${caret}px`);
    tip.classList.add('is-open');
  }

  function close() {
    clearTimeout(closeTimer);
    if (!isOpen()) return;
    tip.classList.remove('is-open');
    // hidden goes back on once the fade is done; transitionend does not fire
    // under reduced motion (no transition) so hide straight away there, and
    // the timer covers a transitionend that never arrives.
    if (motionMq.matches) { tip.hidden = true; return; }
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hideIfClosed, TRANSITION_MS + 50);
  }

  function hideIfClosed() {
    clearTimeout(hideTimer);
    if (!isOpen()) tip.hidden = true;
  }

  function closeSoon() {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(close, CLOSE_DELAY_MS);
  }

  tip.addEventListener('transitionend', (e) => { if (e.propertyName === 'opacity') hideIfClosed(); });

  // Pointer devices: hover opens, leaving the whole wrapper closes.
  pill.addEventListener('mouseenter', () => { if (hoverMq.matches) open(); });
  wrap.addEventListener('mouseenter', () => { if (hoverMq.matches) clearTimeout(closeTimer); });
  wrap.addEventListener('mouseleave', () => { if (hoverMq.matches) closeSoon(); });

  // Tap and keyboard (Enter/Space on a button both arrive as click) toggle.
  // A real mouse click on a hover device only ever opens: the hover already
  // opened it, and toggling would close it under the cursor.
  pill.addEventListener('click', (e) => {
    if (hoverMq.matches && e.detail > 0) { open(); return; }
    if (isOpen()) close(); else open();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !isOpen()) return;
    close();
    pill.focus();
  });
  document.addEventListener('pointerdown', (e) => {
    if (isOpen() && !wrap.contains(e.target)) close();
  }, { passive: true });
  window.addEventListener('scroll', () => { if (isOpen()) close(); }, { passive: true, capture: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

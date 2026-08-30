// Drag-to-vote gesture handling for the swipe screen, kept apart from the
// rendering and network logic in vote-swipe.html so the pointer math lives in
// one place. Pointer events, not touch events — one code path for finger and
// mouse.
//
// Layer rule (project-wide, and the reason this file never touches the outer
// card): an element must never carry a CSS animation and a CSS transition on
// the same property — WebKit silently drops the transition and the motion
// snaps, while Chrome hides the bug. So the depth transform lives on the outer
// `.card` as a transition, and everything here drives the inner `.card-body`:
// the drag sets `transform` inline, and the exit runs through the Web
// Animations API rather than CSS. The two never describe transform at once.

/** Past this many pixels a release counts as a vote. */
export const SWIPE_DISTANCE = 90;
/** …or below that, past this speed (px/ms) — a short fast flick still votes. */
export const FLICK_VELOCITY = 0.8;

/** Drag distance at which the wash and stamp reach full strength. */
const FEEDBACK_RANGE = 110;

export function reducedMotion() {
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Wash opacity and stamp growth track the drag, so the card answers the finger. */
function applyDragFeedback(body, dx) {
  const p = Math.min(Math.abs(dx) / FEEDBACK_RANGE, 1);
  body.querySelector('.wash').style.opacity = p;

  const toward = dx > 0 ? 'play' : 'pass';
  const active = body.querySelector(`.stamp.${toward}`);
  const other = body.querySelector(`.stamp.${toward === 'play' ? 'pass' : 'play'}`);
  other.style.opacity = 0;
  active.style.opacity = p;
  // Starts oversized and settles toward its resting scale as the vote becomes
  // certain; the commit animation finishes the journey to scale 1.
  active.style.transform = `rotate(${dx > 0 ? -12 : 12}deg) scale(${1.4 - 0.4 * p})`;
}

function clearFeedback(body) {
  body.querySelector('.wash').style.opacity = 0;
  body.querySelectorAll('.stamp').forEach((s) => {
    s.style.opacity = 0;
    s.style.transform = '';
  });
}

/**
 * Full-strength wash and a stamp that snaps to its resting size. Used both when
 * a drag crosses the threshold and when a vote comes from the buttons.
 *
 * The inline transform is cleared first: `.commit` animates transform via
 * keyframes, and leaving an inline value would out-specify the animation.
 */
export function markCommitted(body, kind) {
  body.querySelector('.wash').style.opacity = 1;
  const stamp = body.querySelector(`.stamp.${kind}`);
  stamp.style.transform = '';
  stamp.classList.add('commit');
}

/**
 * Flies the card off in the direction voted.
 *
 * Continues from wherever the drag left it — same position, same rotation — so
 * a released card keeps moving instead of stopping dead and restarting. The
 * duration is deliberately fixed rather than scaled by release speed: a
 * velocity-scaled version read as too abrupt.
 *
 * @param {object} [d] the drag state, or omitted for a button tap
 * @returns {Animation} resolve work on its `finished`/`onfinish`
 */
export function exitCard(body, kind, d) {
  const dir = kind === 'play' ? 1 : -1;
  const dx = d ? d.dx : 0;
  const dy = d ? d.dy : 0;
  // A stale inline transition would otherwise still describe transform while
  // the animation runs.
  body.style.transition = '';
  const from = `translate(${dx}px, ${dy}px) rotate(${dx * 0.06}deg)`;
  const to = `translate(${dir * 620}px, ${dy - 40}px) rotate(${dir * (Math.abs(dx * 0.06) + 14)}deg)`;
  return body.animate([{ transform: from }, { transform: to }], {
    duration: reducedMotion() ? 1 : 340,
    // A released drag is already moving, so it starts fast and eases out; a
    // button tap starts from rest and needs to accelerate.
    easing: d ? 'cubic-bezier(.25,.6,.5,1)' : 'cubic-bezier(.4,0,.8,1)',
    fill: 'forwards',
  });
}

/** Springs an undecided card back to centre and clears its feedback. */
function snapBack(body) {
  body.style.transition = 'transform .35s cubic-bezier(.34,1.56,.64,1)';
  body.style.transform = '';
  clearFeedback(body);
  body.addEventListener('transitionend', () => { body.style.transition = ''; }, { once: true });
}

/**
 * Wires pointer-drag voting onto one card's inner body.
 *
 * @param {HTMLElement} body the `.card-body` — never the outer `.card`
 * @param {object}   handlers
 * @param {(kind: 'play'|'pass', drag: object) => void} handlers.onCommit fired
 *   once a release passes the distance or flick threshold. The caller owns the
 *   exit and the deck; the stamp and wash are already at full strength.
 * @param {() => boolean} [handlers.canStart] gate for the busy guard — a card
 *   already on its way out must not accept a new drag.
 */
export function attachSwipe(body, { onCommit, canStart }) {
  if (!body) return;
  // The stack is marked too, not just the card: the front card's depth
  // transform must not glide while a finger is on it, and that rule lives on
  // the outer element this file deliberately never styles.
  const stack = body.closest('.stack');
  let drag = null;

  body.addEventListener('pointerdown', (e) => {
    // The info button sits on the card and opens the detail modal; a tap there
    // must never begin a drag.
    if (e.target.closest('.info-btn')) return;
    if (canStart && !canStart()) return;
    body.setPointerCapture(e.pointerId);
    drag = { x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, vx: 0, t: performance.now() };
    body.classList.add('dragging');
    stack?.classList.add('dragging');
  });

  body.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const now = performance.now();
    const ndx = e.clientX - drag.x0;
    // px per ms, sampled per move — this is what makes a flick count.
    drag.vx = (ndx - drag.dx) / Math.max(now - drag.t, 1);
    drag.t = now;
    drag.dx = ndx;
    // Vertical follow is damped: the gesture is horizontal, the card just tilts
    // along rather than tracking the finger up and down.
    drag.dy = (e.clientY - drag.y0) * 0.4;
    body.style.transform = `translate(${drag.dx}px, ${drag.dy}px) rotate(${drag.dx * 0.06}deg)`;
    applyDragFeedback(body, drag.dx);
  });

  const release = () => {
    if (!drag) return;
    const d = drag;
    drag = null;
    body.classList.remove('dragging');
    stack?.classList.remove('dragging');
    if (Math.abs(d.dx) > SWIPE_DISTANCE || Math.abs(d.vx) > FLICK_VELOCITY) {
      const kind = d.dx > 0 ? 'play' : 'pass';
      markCommitted(body, kind);
      onCommit(kind, d);
    } else {
      snapBack(body);
    }
  };

  body.addEventListener('pointerup', release);
  body.addEventListener('pointercancel', release);
}

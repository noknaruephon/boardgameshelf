// Drag-to-vote gesture handling for the swipe screen, extracted from the
// rendering/network logic in vote-swipe.html so the pointer math stays in
// one place. Pointer events, not touch events — one code path for finger
// and mouse, per the approved mockup (swipe-vote-mockup.html).

export const SWIPE_THRESHOLD = 100;

// Full-strength stamp + wash, used both when a drag crosses the threshold
// and when a vote is cast via the play/pass buttons (no drag to derive the
// strength from, so it jumps straight to 1).
export function flashVoteMarks(card, vote) {
  const playStamp = card.querySelector('.stamp.play');
  const passStamp = card.querySelector('.stamp.pass');
  const wash = card.querySelector('.wash');
  if (vote === 'play') {
    playStamp.style.opacity = 1;
    playStamp.style.transform = 'rotate(-10deg) scale(1.08)';
    passStamp.style.opacity = 0;
  } else {
    passStamp.style.opacity = 1;
    passStamp.style.transform = 'rotate(10deg) scale(1.08)';
    playStamp.style.opacity = 0;
  }
  // The wash is always #000 darkening — colour lives in the stamp only, so
  // the treatment reads the same over every cover in the collection instead
  // of a tint fighting the art.
  wash.style.background = '#000';
  wash.style.opacity = 0.58;
}

// Animates the committed card off-screen. Purely visual — the caller owns
// advancing the deck index and submitting the vote.
export function flyOffCard(card, vote, dy = 0) {
  card.style.transition = 'transform .32s ease, opacity .32s ease';
  card.style.transform = `translate(${vote === 'play' ? 620 : -620}px, ${dy}px) rotate(${vote === 'play' ? 26 : -26}deg)`;
  card.style.opacity = '0';
}

/**
 * Wires pointer-drag voting onto the front card.
 * @param {HTMLElement} card
 * @param {(vote: 'play'|'pass', dy: number) => void} onCommit called once a
 *   drag crosses the threshold on release. Marks are already flashed by the
 *   time this fires — the caller only needs to fly the card off and advance.
 */
export function attachSwipe(card, { onCommit }) {
  if (!card) return;
  const playStamp = card.querySelector('.stamp.play');
  const passStamp = card.querySelector('.stamp.pass');
  const wash = card.querySelector('.wash');
  let startX = 0, startY = 0, dx = 0, dy = 0, dragging = false;

  function resetMarks() {
    playStamp.style.opacity = 0;
    passStamp.style.opacity = 0;
    wash.style.opacity = 0;
  }

  card.addEventListener('pointerdown', (e) => {
    // Never let a tap on the info button start a drag or cast a vote.
    if (e.target.closest('.info-btn')) return;
    dragging = true;
    startX = e.clientX; startY = e.clientY;
    card.setPointerCapture(e.pointerId);
    card.style.transition = 'none';
  });

  card.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    dx = e.clientX - startX; dy = e.clientY - startY;
    const rot = dx / 18;
    card.style.transform = `translate(${dx}px, ${dy}px) rotate(${rot}deg)`;
    const pos = Math.min(Math.max(dx / 90, 0), 1);
    const neg = Math.min(Math.max(-dx / 90, 0), 1);
    playStamp.style.opacity = pos;
    playStamp.style.transform = `rotate(-10deg) scale(${0.75 + 0.35 * pos})`;
    passStamp.style.opacity = neg;
    passStamp.style.transform = `rotate(10deg) scale(${0.75 + 0.35 * neg})`;
    // Black wash in both directions, opacity scaling to .58 at full drag.
    wash.style.background = '#000';
    wash.style.opacity = Math.max(pos, neg) * 0.58;
  });

  function release() {
    if (!dragging) return;
    dragging = false;
    if (dx > SWIPE_THRESHOLD) {
      flashVoteMarks(card, 'play');
      onCommit('play', dy);
    } else if (dx < -SWIPE_THRESHOLD) {
      flashVoteMarks(card, 'pass');
      onCommit('pass', dy);
    } else {
      // Under the threshold: spring back, nothing recorded.
      card.style.transition = 'transform .3s cubic-bezier(.2,.9,.3,1)';
      card.style.transform = 'translate(0,0) rotate(0)';
      resetMarks();
    }
    dx = 0; dy = 0;
  }

  card.addEventListener('pointerup', release);
  card.addEventListener('pointercancel', release);
}

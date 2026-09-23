/* The shelf hero: nine real boxes on two walnut planks, each one backlit.
   docs/claude-code-spec-landing-hero.md, commit 1.

   Both the phone set (two shelves of three) and the desktop set (four and
   five) are rendered; css/landing.css shows one and hides the other at the
   900px query. Simpler than re-rendering on resize, and the six thumbnails
   the visitor never sees are cheap. Same games, same order, as the mockup. */

import { LANDING_GAMES } from '/js/landing-data.js';
import { sizedCover } from '/js/cover-url.js';

const wall = document.querySelector('.shelfhero .shelfwall');
if (wall) {

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* Each box's lean, by game, and its breathing offset, by place on its shelf,
   so no two lights on one plank swell together. */
const LEAN = [-7, 4, -3, 6, -5, 3, -6, 5, -2];
const box = (g, k) => {
  const { title, image } = LANDING_GAMES[g];
  const bd = ((k * 13) % 60) / 10;                          // 0, 1.3, 2.6 … without float drift
  return `<button class="box" type="button" style="--lean:${LEAN[g]}deg;--bd:-${bd}s" aria-label="${esc(title)}">` +
    `<span class="glow"></span>` +
    `<span class="face"><img src="${sizedCover(image, 384)}" alt="" width="384" height="512" decoding="async" onerror="this.style.visibility='hidden'"></span>` +
    `<span class="foot"></span>` +
    `<span class="name">${esc(title)}</span>` +
    `</button>`;
};
const shelf = (games) => `<div class="shelf">${games.map(box).join('')}<span class="lamp"></span><span class="plank"></span></div>`;

wall.innerHTML =
  `<div class="mob">${shelf([0, 1, 2])}${shelf([3, 4, 5])}</div>` +
  `<div class="desk">${shelf([0, 1, 2, 3])}${shelf([4, 5, 6, 7, 8])}</div>`;

/* A tap on a phone is the hover lift, held for a moment; hover covers the
   desktop. A box is a button so it is focusable, and tapping it does nothing
   else. */
const boxes = [...wall.querySelectorAll('.box')];
boxes.forEach((b) => b.addEventListener('click', () => {
  boxes.forEach((x) => x.classList.remove('up'));
  b.classList.add('up');
  setTimeout(() => b.classList.remove('up'), 1800);
}));

}

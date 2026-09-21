/* The closing section: a floor of covers running to a gold horizon, the cover
   light drifting over it, and small pieces of a vote floating around the real
   sign-in.
   docs/claude-code-spec-landing.md, commit 4. Lifted from the mockup's
   `closing (F8)` script block.

   Everything this module draws is decorative and pointer-inert, at a negative
   z-index inside the section's own stacking context, so the focal block — the
   Google button, the email panel, the guest link — stays clickable.

   WebKit rule: the floor's tilt is a static transform on .plane and the drift
   is an animation on the .drift wrapper inside it; the outer .pz flies in on a
   transition and the child inside it bobs on an animation. Nothing carries
   both. The cover light is opacity-transitioned and must never be animated. */

import { LANDING_WALL, LANDING_GAMES } from '/js/landing-data.js';
import { sizedCover } from '/js/cover-url.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const sec = $('#signin');
if (sec) {

const HIDE = `onerror="this.style.visibility='hidden'"`;
/* Floor tiles, the light and the pieces are all small: 160. The light steps
   through the same covers the floor draws, at the same width, so each one it
   lights is already in cache. */
const im = (url) => `<img src="${sizedCover(url, 160)}" alt="" loading="lazy" decoding="async" ${HIDE}>`;
/* Floor tiles are NOT loading="lazy". They sit in a plane tilted in 3D and
   clipped by .floor, and a browser's lazy-load check reasons about the
   untransformed layout box: on iOS Safari the rows whose layout position falls
   outside the clip — the near rows, which the tilt brings into view at the
   bottom of the section — never loaded, and the floor stopped a third of the
   way down. The deferral is done by hand instead: the floor is built when the
   section comes within a viewport of the screen (below). */
const tile = (url) => `<img src="${sizedCover(url, 160)}" alt="" decoding="async" ${HIDE}>`;

const motionless = window.matchMedia('(prefers-reduced-motion:reduce)');
/* Reduced motion, or a visitor who asked for less data: the floor holds
   still, the pieces arrive in place and the light keeps its first cover. */
const still = () => motionless.matches || !!navigator.connection?.saveData;
if (navigator.connection?.saveData) sec.classList.add('still');

/* ── The floor. 16 rows with a 4-row period, so translateY(-25%) over 46s
   comes back to an identical row and the loop has no seam. */
const wide = window.matchMedia('(min-width:900px)');
function floor() {
  const cols = wide.matches ? 14 : 10;
  let h = '';
  for (let r = 0; r < 16; r++) for (let c = 0; c < cols; c++) h += tile(LANDING_WALL[((r % 4) * 11 + c * 7) % LANDING_WALL.length]);
  const drift = $('#drift');
  drift.style.setProperty('--cols', cols);
  drift.innerHTML = h;
}
/* 160 covers is not a download the hero should share bandwidth with, so the
   floor is built once the section is within a viewport of the screen — early
   enough to be there when you arrive, and never on a visit that stops short. */
new IntersectionObserver((es, io) => {
  if (!es.some((e) => e.isIntersecting)) return;
  io.disconnect();
  floor();
  wide.addEventListener('change', floor);
}, { rootMargin: '100% 0px' }).observe(sec);

/* ── The light, stepping through the shelf every 3.6s. Two stacked images
   cross-faded by opacity; a cover that fails to load simply gives no light. */
const L = $$('#f8light img');
let li = 0, lk = 0, timer = null;
function light() {
  const n = L[li ^= 1];
  n.onerror = () => n.classList.remove('on');
  n.src = sizedCover(LANDING_WALL[(lk++ * 5) % LANDING_WALL.length], 160);
  n.classList.add('on');
  L[li ^ 1].classList.remove('on');
}
function run(on) {
  clearInterval(timer);
  timer = null;
  if (!on) return;
  light();
  if (!still()) timer = setInterval(light, 3600);
}

/* ── The vote, in pieces: a card mid-swipe with its Play stamp, the ✓ and ✕
   rounds, the five seats with one still to vote, the count with the leader
   ringed, the winner, the "4 of 5 would play" pill, confetti and the join
   code. From 1200px up they sit in the side gutters, anchored to the focal
   block rather than the screen with max()/min() guards, so the gap is the
   same on a laptop and on a large monitor. Below that they keep to a band
   above the text and a band below it. */
const D = LANDING_GAMES;
const pips = (n) => '<b>' + [0, 1, 2, 3, 4].map((k) => `<u class="${k < n ? 'on' : ''}"></u>`).join('') + '</b>';
const conf = '<span class="v-conf">' + [
  ['var(--bgs-gold)', 6, 8, 20], ['var(--bgs-vote-play)', 26, 0, -30], ['var(--bgs-vote-pass)', 48, 12, 45],
  ['var(--bgs-ivory)', 14, 32, 70], ['var(--bgs-gold)', 40, 36, -15], ['var(--bgs-vote-play)', 58, 40, 30],
].map(([c, x, y, r]) => `<b style="background:${c};left:${x}px;top:${y}px;transform:rotate(${r}deg)"></b>`).join('') + '</span>';

// [phone position, side-gutter position, fly-in x, y, start rotation, resting rotation, delay, contents]
const P = [
  ['left:7%;top:26px', 'left:max(12px,calc(50% - 596px));top:19%', '-140px', '-60px', -40, -9, 0, `<span class="v-card">${im(D[4].image)}<em>Play</em></span>`],
  ['right:7%;top:20px', 'left:min(calc(100% - 150px),calc(50% + 464px));top:15%', '140px', '-60px', 40, 7, .1, `<span class="v-win"><span class="c">${im(D[1].image)}</span><span>Tonight we play</span></span>`],
  ['left:33%;top:18px', 'left:calc(50% - 440px);top:7%', '0px', '-150px', 0, 0, .2, `<span class="v-round yes">✓</span>`],
  ['left:50%;top:84px;margin-left:-72px', 'left:max(12px,calc(50% - 660px));top:64%', '-40px', '-120px', 0, -2, .28, `<span class="v-seats"><i class="me ok">N</i><i class="ok">T</i><i class="ok">P</i><i class="ok">S</i><i class="wait">M</i></span>`],
  ['left:7%;bottom:64px', 'left:max(12px,calc(50% - 640px));bottom:7%', '-150px', '60px', 0, -3, .16, `<span class="v-count"><div>${im(D[0].image)}${pips(2)}</div><div class="w">${im(D[1].image)}${pips(4)}</div><div>${im(D[2].image)}${pips(3)}</div><div>${im(D[3].image)}${pips(1)}</div></span>`],
  ['right:9%;bottom:78px', 'left:calc(50% + 476px);top:62%', '150px', '40px', 0, 0, .24, `<span class="v-round no">✕</span>`],
  ['left:50%;bottom:26px;margin-left:-62px', 'left:min(calc(100% - 190px),calc(50% + 440px));bottom:9%', '0px', '160px', 0, -3, .34, `<span class="v-gold">4 of 5 would play</span>`],
  ['right:7%;bottom:28px', 'left:calc(50% - 400px);bottom:8%', '120px', '120px', 0, 4, .4, `<span class="v-chip">K7QP</span>`],
  ['left:46%;bottom:88px', 'left:calc(50% + 380px);top:6%', '80px', '100px', 0, 0, .3, conf],
];
const gutters = window.matchMedia('(min-width:1200px)');   // the side layout needs gutters to sit in
function pieces() {
  $('#pieces').innerHTML = P.map(([m, d, fx, fy, fr, rot, dl, h], i) =>
    `<div class="pz" style="${gutters.matches ? d : m};--fx:${fx};--fy:${fy};--fr:${fr}deg;--rot:${rot}deg;--d:${dl}s;--bd:-${i * .7}s">${h}</div>`
  ).join('');
}
pieces();
gutters.addEventListener('change', pieces);

/* Nothing here runs while the section is off screen: the floor drift, the
   pieces' bob and the button's halo are paused by .live, and the light's
   timer is cleared. The fly-in happens once. */
new IntersectionObserver((es) => es.forEach((e) => {
  run(e.isIntersecting);
  sec.classList.toggle('live', e.isIntersecting);
  if (e.isIntersecting) sec.classList.add('in');
}), { threshold: .15 }).observe(sec);

}

/* The story section: one phone stays pinned while four steps scroll past, and
   pieces of each screen float around it.
   docs/claude-code-spec-landing.md, commit 3. Lifted from the mockup's `story`
   script block.

   The four screens are schematic on purpose — they are built from LANDING_GAMES
   here, not embedded from the real pages.

   The step prose lives in landing-next.html, not in this file: it is the
   section's text and must be there whether or not this module loads. This
   module adds the phone, the pieces, and the observer that says which step you
   are reading.

   WebKit rule: the phone, the screens and the outer .frag transition and are
   never animated; the idle float is an animation on the .frag's inner child,
   which has no transition of its own. */

import { LANDING_GAMES } from '/js/landing-data.js';
import { sizedCover } from '/js/cover-url.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const story = $('#story');
if (story) {

const G = LANDING_GAMES;
const HIDE = `onerror="this.style.visibility='hidden'"`;
/* Tiles and floating pieces are small: 160. The vote card and the crown are
   the screens' focal covers: 384. */
const im = (i, w) => `<img src="${sizedCover(G[i % G.length].image, w)}" alt="" loading="lazy" decoding="async" ${HIDE}>`;
const tile = (i) => im(i, 160);
/* The wash behind a screen is that screen's own cover, blurred — so it reuses
   the exact string the visible cover uses and costs no extra fetch. */
const wash = (i) => `<div class="wash" style="background-image:url('${sizedCover(G[i].image, 384)}')"></div>`;

const NINE = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const SCREEN = [
  `<div class="scr"><div class="eb">nok's</div><div class="wm">BoardgameShelf</div><div class="url">boardgameshelf.vercel.app/u/you</div><div class="g3">${NINE.map((i) => `<div class="tile">${tile(i)}</div>`).join('')}</div></div>`,
  `<div class="scr"><div class="eb">Start game night</div><div class="ttl">Pick the contenders</div><div class="g3 picking">${NINE.map((i) => `<div class="tile ${[1, 4, 8].includes(i) ? 'sel' : ''}">${tile(i)}</div>`).join('')}</div><div class="dock"><span class="s-chip">3 selected</span><div class="pillrow"><span class="ground">✕</span><span class="gpill">Continue · 3</span></div></div></div>`,
  `<div class="scr">${wash(4)}<div class="eb">Game Night · K7QP</div><div class="roster"><i class="me">N</i><i>T</i><i>P</i><i>S</i><i>M</i></div><div class="vcard">${im(4, 384)}</div><div class="vrow"><span class="no">✕</span><span class="yes">✓</span><span class="info">i</span></div></div>`,
  `<div class="scr">${wash(1)}<div class="eb">Game Night · K7QP</div><div class="ttl">Tonight we play</div><div class="crown">${im(1, 384)}</div><div class="ttl cname">${G[1].title}</div><div class="cpill">4 of 5 would play ›</div><div class="roster"><i class="me">N</i><i class="me">T</i><i class="me">P</i><i class="me">S</i><i>M</i></div></div>`,
];
$('#aPhone').innerHTML = SCREEN.join('');

/* Pieces that lift off each screen: [step, resting position, the offset they
   fly in from, rotation, contents]. The outer .frag carries the fly-in as a
   transition; the child inside it bobs. */
const conf = () => '<span class="f-conf">' + [
  ['var(--bgs-gold)', 8, 6, 20], ['var(--bgs-vote-play)', 30, 0, -30], ['var(--bgs-vote-pass)', 52, 14, 45],
  ['var(--bgs-ivory)', 18, 34, 70], ['var(--bgs-gold)', 44, 40, -15], ['var(--bgs-vote-play)', 60, 44, 30],
].map(([c, x, y, r]) => `<b style="background:${c};left:${x}px;top:${y}px;transform:rotate(${r}deg)"></b>`).join('') + '</span>';

const FR = [
  [0, 'left:-34%;top:8%', '40px', '30px', -9, `<span class="f-tile">${tile(5)}</span>`],
  [0, 'right:-36%;top:30%', '-40px', '10px', 8, `<span class="f-tile">${tile(7)}</span>`],
  [0, 'left:-30%;bottom:10%', '40px', '-20px', 6, `<span class="f-chip">/u/you</span>`],
  [1, 'right:-38%;top:10%', '-40px', '30px', 7, `<span class="f-tile ring">${tile(4)}</span>`],
  [1, 'left:-40%;top:40%', '40px', '0px', -4, `<span class="f-chip">3 selected</span>`],
  [1, 'right:-44%;bottom:12%', '-50px', '-20px', -3, `<span class="f-gold">Continue · 3</span>`],
  [2, 'left:-42%;top:10%', '40px', '20px', 0, `<span class="f-seats"><i>N</i><i>T</i><i>P</i><i>S</i><i>M</i></span>`],
  [2, 'right:-30%;top:38%', '-40px', '0px', 0, `<span class="f-round yes">✓</span>`],
  [2, 'left:-30%;bottom:20%', '40px', '-10px', 0, `<span class="f-round no">✕</span>`],
  [2, 'right:-34%;top:6%', '-30px', '30px', 5, `<span class="f-chip">K7QP</span>`],
  [3, 'right:-48%;top:34%', '-50px', '0px', -4, `<span class="f-gold">4 of 5 would play</span>`],
  [3, 'left:-36%;top:6%', '40px', '30px', 0, conf()],
  [3, 'left:-34%;bottom:14%', '40px', '-20px', -8, `<span class="f-tile ring">${tile(1)}</span>`],
];
$('#frags').innerHTML = FR.map(([s, pos, fx, fy, rot, h]) =>
  `<div class="frag" data-s="${s}" style="${pos};--fx:${fx};--fy:${fy};--rot:${rot}deg">${h}</div>`
).join('');

function aOn(i) {
  story.dataset.step = i;                                     // the phone leans a little per step
  $$('#aPhone .scr').forEach((e, k) => e.classList.toggle('on', k === i));
  $$('#aTabs span').forEach((e, k) => e.classList.toggle('on', k === i));
  $$('#aSteps .step').forEach((e, k) => e.classList.toggle('on', k === i));
  $$('#frags .frag').forEach((e) => e.classList.toggle('on', +e.dataset.s === i));
}
aOn(0);

/* A step becomes active when its HEADING is inside the band you can actually
   read. On a phone that band sits between the pinned phone above and the
   floating CTA below; on desktop the phone and the steps are side by side, so
   mid-screen decides. The observer is rebuilt when the 900px query flips,
   because the two bands are nothing like each other. */
const mq = matchMedia('(min-width:900px)');
let aIO;
function aWatch() {
  if (aIO) aIO.disconnect();
  aIO = new IntersectionObserver(
    (es) => es.forEach((e) => { if (e.isIntersecting) aOn(+e.target.closest('.step').dataset.i); }),
    { rootMargin: mq.matches ? '-40% 0px -50% 0px' : '-58% 0px -12% 0px' },
  );
  $$('#aSteps .step h3').forEach((h) => aIO.observe(h));
}
aWatch();
mq.addEventListener('change', aWatch);

}

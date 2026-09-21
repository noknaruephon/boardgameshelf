/* The hero's playable vote, its cover wall and the cover light.
   docs/claude-code-spec-landing.md, commit 2. Lifted from the mockup's `hero`
   script block; the mockup's demo hooks (heroDemo, heroPress, table.dataset
   .hold) and its colour stand-ins are not production and are gone.

   WebKit rule, which the whole file is arranged around: no element ever
   carries an `animation` and a `transition` on the same property. Here that
   means the slots and the flung card transition and never animate; the wall's
   columns, the late voter's dots, the crown, the flash and the confetti
   animate on elements that have no transition. */

import { LANDING_GAMES, LANDING_WALL } from '/js/landing-data.js';
import { sizedCover } from '/js/cover-url.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const table = $('#table');
if (table) {

const motionless = window.matchMedia('(prefers-reduced-motion:reduce)');
const reduced = () => motionless.matches;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* The five cards, in deal order. A cover that fails hides itself — production
   has no colour stand-ins, and half a card reads worse than none. */
const GAMES = LANDING_GAMES.slice(0, 5);
const cover = (g, w) => sizedCover(GAMES[g].image, w);
const HIDE = `onerror="this.style.visibility='hidden'"`;
/* Deck cards and the winner are the same 384 string, so the winner is a cache
   hit on the card the visitor just swiped. */
const cardImg = (g) => `<img src="${cover(g, 384)}" alt="${esc(GAMES[g].title)}" width="384" height="480" draggable="false" loading="eager" decoding="async" ${HIDE}>`;
const miniImg = (g) => `<img src="${cover(g, 160)}" alt="" width="160" height="200" draggable="false" loading="lazy" decoding="async" ${HIDE}>`;

/* ── 1. Cover wall: nine columns of seven, six of them shown on phones (CSS).
   Decorative and lazy — it must never compete with the deck for bandwidth. */
$('#wall').innerHTML = Array.from({ length: 9 }, (_, c) =>
  `<div class="col">${Array.from({ length: 7 }, (_, r) =>
    `<img src="${sizedCover(LANDING_WALL[(c * 7 + r) % LANDING_WALL.length], 160)}" alt="" width="160" height="200" loading="lazy" decoding="async" ${HIDE}>`
  ).join('')}</div>`
).join('');

/* ── 2. Cover light: two stacked images cross-faded by opacity alone, so the
   whole wall takes the colour of whatever the visitor is looking at. Never
   give these an animation — the fade is the transition in css/landing.css.
   The src is the deck card's own 384 string, so lighting a cover costs
   nothing beyond the card already on screen. A cover that fails to load
   simply gives no light. */
const lights = $$('#light img');
let li = 0;
function light(g) {
  const next = lights[li ^= 1];
  next.onerror = () => next.classList.remove('on');
  next.src = cover(g, 384);
  next.classList.add('on');
  lights[li ^ 1].classList.remove('on');
}

/* ── 3. The table. Seats: 0,1 = friends, 2 = you, 3 = friend, 4 = the late
   voter. Three friends vote live on every card. The late voter's ballot lands
   at the end and is chosen so exactly ONE game wins, preferring a game the
   visitor said play to. This demo never ends in a tie, on purpose: the
   rematch is explained in the story section, not acted out here. */
const deck = $('#deck');
const seats = $$('#seats .seat');
const LIVE = [0, 1, 3], YOU = 2, LATE = 4;
const FRIENDS = [[1, 0, 1], [0, 1, 0], [1, 1, 0], [0, 1, 1], [0, 0, 1]];   // per game: the three live friends' votes

let idx = 0, mine = [], timers = [];
const later = (f, ms) => timers.push(setTimeout(f, reduced() ? 0 : ms));
const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

function chip(seat, kind) {
  const c = seats[seat].querySelector('.chip');
  c.className = 'chip' + (kind ? ' show ' + kind : '');
  c.textContent = kind === 'y' || kind === 'ok' ? '✓' : kind === 'n' ? '✕' : '';
}
const clearChips = () => seats.forEach((_, i) => chip(i, null));

const REST = [[0, 0, 0], [9, 11, 3.5], [-8, 20, -3.5]];
function layout() {
  $$('#deck .slot').forEach((s) => {
    const d = +s.dataset.i - idx;
    if (d < 0) { s.style.opacity = 0; s.style.pointerEvents = 'none'; return; }
    const [x, y, r] = REST[Math.min(d, 2)];
    s.style.transform = `translate(${x}px,${y}px) rotate(${r}deg) scale(${1 - Math.min(d, 2) * .04})`;
    s.style.opacity = d > 2 ? 0 : 1;
    s.style.zIndex = 10 - d;
  });
  $('#count').textContent = `${Math.min(idx + 1, 5)} of 5`;
  if (idx < 5) {
    light(idx);
    clearChips();
    const g = idx;
    // While voting a chip says only WHO has voted on this card, never what
    // they voted. Cancelled if the visitor gets there first.
    LIVE.forEach((seat, k) => later(() => { if (idx === g) chip(seat, 'ok'); }, 450 + k * 520));
  }
}

function deal() {
  clearTimers();
  idx = 0; mine = [];
  table.classList.remove('done', 'waiting');
  seats[LATE].classList.add('slow');
  $('#burst').innerHTML = '';
  deck.innerHTML = GAMES.map((_, g) =>
    `<div class="slot" data-i="${g}"><div class="card">${cardImg(g)}<span class="stamp play">Play</span><span class="stamp pass">Pass</span></div></div>`
  ).join('');
  $$('#deck .card').forEach(bindDrag);
  layout();
}

function vote(dir) {
  const slot = $(`#deck .slot[data-i="${idx}"]`);
  if (!slot) return;
  clearTimers();
  const card = slot.firstElementChild;
  card.classList.add('snap');
  card.style.transform = `translate(${dir * 460}px,-30px) rotate(${dir * 24}deg)`;
  card.querySelector(dir > 0 ? '.play' : '.pass').style.opacity = 1;
  mine[idx] = dir > 0 ? 1 : 0;
  idx++;
  if (idx < 5) layout(); else later(waiting, 260);
}

/* ── 4. The reveal. Votes stay sealed until everyone is in, then they are
   counted and one game wins. No eliminations, no showdown. */
const base = () => FRIENDS.map((f, g) => f.reduce((a, b) => a + b, 0) + (mine[g] || 0));
function pickWinner() {
  const b = base(), max = Math.max(...b);
  const tops = b.map((v, g) => (v === max ? g : -1)).filter((g) => g >= 0);
  const w = tops.find((g) => mine[g]) ?? tops[0];              // prefer a game the visitor said play to
  const final = b.map((v, g) => v + (g === w ? 1 : 0));        // the late voter's one play vote goes to the winner
  return { w, final };
}

const say = (t, sub) => { $('#cntTitle').textContent = t; $('#cntText').textContent = sub; };
const mini = (g) => $(`#minis [data-g="${g}"]`);
function drawMinis() {
  $('#minis').className = 'minis';
  $('#minis').innerHTML = GAMES.map((_, g) =>
    `<div class="mini" data-g="${g}"><div class="c">${miniImg(g)}</div><div class="pips">${'<i></i>'.repeat(5)}</div></div>`
  ).join('');
}

function waiting() {
  clearTimers();
  table.classList.remove('done');
  table.classList.add('waiting');
  [...LIVE, YOU].forEach((i) => chip(i, 'ok'));
  chip(LATE, null);
  seats[LATE].classList.add('slow');
  say('One vote to go', "Four of five have voted. There's always one.");
  drawMinis();
  const r = pickWinner();
  if (reduced()) return result(r);                            // no count: straight to the result

  let t = 1500;
  const at = (ms, f) => { t += ms; later(f, t); };
  at(0, () => {
    seats[LATE].classList.remove('slow');
    chip(LATE, 'ok');
    say('All five are in', 'Votes stay sealed until now.');
    buzz(12);
  });
  at(750, () => say('Counting the votes', ''));
  // ballots tick in one at a time, round-robin across the five games
  for (let k = 0; k < 5; k++) for (let g = 0; g < 5; g++) if (k < r.final[g]) at(75, () => {
    mini(g).querySelectorAll('.pips i')[k].classList.add('on');
  });
  at(450, () => {
    say('The table has decided', '');
    $('#minis').classList.add('decided');
    mini(r.w).classList.add('win');
    light(r.w);
    buzz(8);
  });
  at(900, () => result(r));
}

/* ── 5. One winner. Crown, gold flash, confetti, then each seat turns over
   its vote on the winning game. */
function buzz(p) { try { navigator.vibrate && navigator.vibrate(p); } catch { /* not supported */ } }

function confetti() {
  const host = $('#burst');
  host.innerHTML = '';
  if (reduced()) return;
  const cols = ['var(--bgs-gold)', 'var(--bgs-vote-play)', 'var(--bgs-vote-pass)', 'var(--bgs-ivory)', 'var(--bgs-gold)'];
  for (let n = 0; n < 34; n++) {
    const el = document.createElement('i');
    el.style.background = cols[n % 5];
    host.appendChild(el);
    const ang = Math.random() * Math.PI * 2, dist = 90 + Math.random() * 150;
    const x = Math.cos(ang) * dist, y = Math.sin(ang) * dist - 60;
    // Web Animations API on fresh elements: nothing here has a transition.
    el.animate([
      { transform: 'translate(0,0) rotate(0) scale(.4)', opacity: 1 },
      { transform: `translate(${x}px,${y}px) rotate(${Math.random() * 540 - 270}deg) scale(1)`, opacity: 1, offset: .6 },
      { transform: `translate(${x * 1.1}px,${y + 120}px) rotate(${Math.random() * 720 - 360}deg) scale(.9)`, opacity: 0 },
    ], { duration: 1100 + Math.random() * 700, easing: 'cubic-bezier(.15,.8,.3,1)', fill: 'forwards' }).onfinish = () => el.remove();
  }
}

function result(r) {
  clearTimers();
  table.classList.remove('waiting');
  seats[LATE].classList.remove('slow');
  clearChips();
  $('#winner').innerHTML = cardImg(r.w);
  light(r.w);
  $('#resText').textContent = `${r.final[r.w]} of 5 said play.` +
    (mine[r.w] ? ' You included.' : ' You passed, and got outvoted. It happens.');
  table.classList.remove('done');
  void table.offsetWidth;                                     // restart the entrance animations
  table.classList.add('done');
  confetti();
  buzz([18, 40, 30]);
  const votes = [FRIENDS[r.w][0], FRIENDS[r.w][1], mine[r.w] ? 1 : 0, FRIENDS[r.w][2], 1];
  votes.forEach((v, i) => later(() => chip(i, v ? 'y' : 'n'), 650 + i * 140));
}

/* ── 6. Input. Drag past 80px, tap ✕ / ✓, or use the arrow keys once the
   table has focus — the key listener is on the table, never on the document,
   so arrow keys still scroll the page everywhere else. */
function bindDrag(card) {
  let sx = 0, dx = 0, on = false;
  card.addEventListener('pointerdown', (e) => {
    if (+card.parentElement.dataset.i !== idx) return;
    on = true; sx = e.clientX; dx = 0;
    card.classList.remove('snap');
    card.setPointerCapture(e.pointerId);
  });
  card.addEventListener('pointermove', (e) => {
    if (!on) return;
    dx = e.clientX - sx;
    card.style.transform = `translate(${dx}px,${-Math.abs(dx) * .06}px) rotate(${dx * .06}deg)`;
    card.querySelector('.play').style.opacity = Math.max(0, Math.min(1, dx / 80));
    card.querySelector('.pass').style.opacity = Math.max(0, Math.min(1, -dx / 80));
  });
  const end = () => {
    if (!on) return;
    on = false;
    if (Math.abs(dx) > 80) return vote(Math.sign(dx));
    card.classList.add('snap');
    card.style.transform = '';
    card.querySelectorAll('.stamp').forEach((s) => { s.style.opacity = 0; });
  };
  card.addEventListener('pointerup', end);
  card.addEventListener('pointercancel', end);
}

$('#btnYes').addEventListener('click', () => vote(1));
$('#btnNo').addEventListener('click', () => vote(-1));
$('#again').addEventListener('click', deal);
table.addEventListener('keydown', (e) => {
  if (e.target.closest('button,a')) return;                   // the ✕ / ✓ buttons answer for themselves
  if (e.key === 'ArrowRight') { e.preventDefault(); vote(1); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); vote(-1); }
});

deal();

}

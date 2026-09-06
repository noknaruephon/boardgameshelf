import { timeLabel, weightLabel, playersRangeLabel } from './filters.js';
import { registerOverlay, syncScrollLock } from './scroll-lock.js';
import { renderScene } from './teach-scenes.js';

// The game detail modal, shared by the shelf and the game-night waiting room.
// Markup lives here and styling in css/game-modal.css, so an enhancement to
// either lands on every page at once. Pages must link that stylesheet.

const PLUS_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
const TICK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';

const PLAYERS_ICON = `<svg class="stat-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="7" r="3"/><circle cx="16" cy="8" r="2.5"/><path d="M3 20c0-3 2.5-5 6-5s6 2 6 5"/><path d="M14.5 15c2.5.3 4.5 2 4.5 5"/></svg>`;
const TIME_ICON = `<svg class="stat-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2"/><path d="M9 2h6"/></svg>`;
const WEIGHT_ICON = `<svg class="stat-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="M5 7l-3 6a3 3 0 006 0z"/><path d="M19 7l-3 6a3 3 0 006 0z"/><path d="M5 7h14"/><path d="M9 21h6"/></svg>`;

const VIEW_COVER_ICON = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M5 8h14"/></svg>`;
const VIEW_TABLE_ICON = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="9" rx="9" ry="4"/><path d="M5 12v6M19 12v6M12 13v7"/></svg>`;

// Tabler line icons: 24 viewBox, currentColor stroke, 1.75, no fill.
const ic = (paths, s = 15, w = 1.75) =>
  `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
const SCHOOL_ICON = ic('<path d="M22 9l-10-4-10 4 10 4 10-4v6"/><path d="M6 10.6v5.4a6 3 0 0 0 12 0v-5.4"/>', 16);
const ALERT_ICON  = ic('<path d="M12 9v4"/><path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636-2.87l-8.106-13.536a1.914 1.914 0 0 0-3.274 0z"/><path d="M12 16h.01"/>', 13);
const PENCIL_ICON = ic('<path d="M4 20h4L18.5 9.5a2.828 2.828 0 1 0-4-4L4 16v4"/><path d="M13.5 6.5l4 4"/>', 13);

// ---- "Teach me in 60 seconds" feature flag ----
// Live: every visitor gets the section, so the flag is now a kill switch
// rather than a curtain, the same shape as the shelf's Game Night flag. Set it
// back to false to pull the section without reverting anything; ?teach=1
// still reveals it while it is off. Read once at module load.
const TEACH_ENABLED = true;
const teachVisible =
  TEACH_ENABLED || new URLSearchParams(location.search).get('teach') === '1';

function coverHTML(g) {
  if (g.backImage) {
    return `
      <div class="flip-scene">
        <div class="flip-card" id="flip-card">
          <div class="flip-face flip-front">
            <img class="card-cover" src="${g.image}" alt="${g.title} box cover" loading="lazy" decoding="async" onerror="this.style.display='none'">
          </div>
          <div class="flip-face flip-back">
            <img class="card-cover" src="${g.backImage}" alt="${g.title} back of box" loading="lazy" decoding="async" onerror="this.style.display='none'">
          </div>
        </div>
        <p class="flip-hint">⟲ tap or swipe to see the back of the box</p>
      </div>`;
  }
  return `
    <div class="card-cover-wrap" style="background:${g.color}22">
      <img class="card-cover" src="${g.image}" alt="${g.title} box cover" width="600" height="450" loading="lazy" decoding="async" fetchpriority="low" onerror="this.parentElement.style.background='${g.color}';this.style.display='none'">
    </div>`;
}

// A game with a table shot gets the cover overlaid by the photo and a toggle to
// crossfade between them. Without one the cover is returned untouched, so the
// 189 games that have no photo render exactly the markup they do today.
//
// The cover layer stays in normal flow and keeps sizing the block to the box
// art's own aspect ratio, as it does today; only the photo is absolutely
// positioned over it. That keeps both images uncropped-by-the-container and
// leaves nothing to reflow mid-crossfade.
//
// Flip games: the photo overlays the whole scene, so it also covers the "tap or
// swipe" hint under the card and stands ~13% taller than the box art did. That
// reads fine — the photo simply fills the block — but it is the one place the
// two cover treatments interact, and no game carries both fields today (6 have
// backImage, none have tableShot). Worth a look if that ever changes.
function mediaHTML(g) {
  const cover = coverHTML(g);
  if (!g.tableShot) return cover;

  return `
    <div class="media-stack">
      <div class="media-layer media-cover on">${cover}</div>
      <img class="media-layer media-table" src="${g.tableShot}" alt="${g.title} set up on a table" loading="lazy" decoding="async" aria-hidden="true">
    </div>
    <div class="media-toggle-row">
      <div class="media-toggle" role="group" aria-label="Game image view">
        <button class="media-toggle__btn" type="button" data-view="cover" aria-pressed="true">${VIEW_COVER_ICON} Cover</button>
        <button class="media-toggle__btn" type="button" data-view="table" aria-pressed="false">${VIEW_TABLE_ICON} On the table</button>
      </div>
    </div>`;
}

// ---- Teach me in 60 seconds ----
// Five beats, picture first. Scene SVGs are decorative: the caption beside
// each one is the accessible text, so they are aria-hidden rather than
// role="img" — naming the scene as well would read everything twice.
const TEACH_BEAT_KEYS = ['hook', 'win', 'turn', 'gotcha', 'first'];

function beatHTML(b) {
  const icon = b.key === 'gotcha' ? ALERT_ICON : '';
  if (b.scene === 'strip') {
    return `
      <li class="teach-beat teach-beat--strip">
        <p class="teach-beat__label">${icon}${b.label}</p>
        <div class="teach-strip">
          ${b.steps.map((s, i) => `
            <div class="teach-frame">
              <div class="teach-scene"><span class="teach-frame__num">${i + 1}</span>${renderScene(s.scene)}</div>
              <p class="teach-frame__cap">${s.caption}</p>
            </div>`).join('')}
        </div>
        <p class="teach-beat__text">${b.caption}</p>
      </li>`;
  }
  return `
    <li class="teach-beat">
      <div class="teach-scene">${renderScene(b.scene)}</div>
      <div>
        <p class="teach-beat__label">${icon}${b.label}</p>
        <p class="teach-beat__text">${b.caption}</p>
      </div>
    </li>`;
}

// All-or-nothing, the same contract the Stats section had: with the flag off,
// no `teach` field, or anything other than the five beats in order, nothing is
// emitted — so no heading and no divider is ever left behind.
function teachHTML(g) {
  if (!teachVisible) return '';
  const t = g.teach;
  if (!t || !Array.isArray(t.beats) || t.beats.length !== 5) return '';
  if (t.beats.some((b, i) => !b || b.key !== TEACH_BEAT_KEYS[i])) return '';
  const strip = t.beats[2];
  if (strip.scene === 'strip' && (!Array.isArray(strip.steps) || strip.steps.length !== 3)) return '';
  const draft = t.reviewed !== true;
  return `
    <section class="teach-section">
      <p class="why-heading">${SCHOOL_ICON} Teach me in 60 seconds</p>
      ${draft ? `<p class="teach-draft">${PENCIL_ICON} Draft — not yet checked against the rulebook</p>` : ''}
      <ol class="teach-beats">
        ${t.beats.map(beatHTML).join('')}
      </ol>
      <p class="teach-foot">${t.wordCount} words · five pictures</p>
    </section>`;
}

function bodyHTML(g) {
  return `
    ${mediaHTML(g)}
    <h2>${g.title}</h2>
    <div class="stat-row">
      <span class="stat-chip">${PLAYERS_ICON} ${playersRangeLabel(g.players)}</span>
      <span class="stat-chip">${TIME_ICON} ${timeLabel(g.time)}</span>
      <span class="stat-chip">${WEIGHT_ICON} ${weightLabel(g.weightScore)}</span>
    </div>
    <p class="blurb">${g.blurb}</p>
    <p class="why-heading">Highlights</p>
    <ul class="why-list">
      ${g.why.map((w) => `<li>${w}</li>`).join('')}
    </ul>
    <span class="tag">${g.tag}</span>${teachHTML(g)}`;
}

// The back-of-box flip: tap, or swipe horizontally. Re-wired on every open
// because the cover markup is rebuilt each time.
function wireFlip(root) {
  const flipCard = root.querySelector('#flip-card');
  if (!flipCard) return;

  const frontImg = flipCard.querySelector('.flip-front .card-cover');
  const applyRatio = () => {
    if (frontImg.naturalWidth && frontImg.naturalHeight) {
      flipCard.style.aspectRatio = `${frontImg.naturalWidth} / ${frontImg.naturalHeight}`;
    }
  };
  if (frontImg.complete) applyRatio();
  else frontImg.addEventListener('load', applyRatio, { once: true });

  let startX = 0, startY = 0;
  const toggle = () => flipCard.classList.toggle('flipped');
  flipCard.addEventListener('click', toggle);
  flipCard.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });
  flipCard.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > 20 && Math.abs(dx) > Math.abs(dy)) {
      toggle();
      e.preventDefault();
    }
  });
}

// Cover <-> table-shot crossfade. Like the flip, re-wired on every open because
// the media markup is rebuilt each time — which is also what resets the view to
// Cover, per spec.
function wireMediaToggle(root) {
  const stack = root.querySelector('.media-stack');
  if (!stack) return;

  const cover = stack.querySelector('.media-cover');
  const table = stack.querySelector('.media-table');
  const row = root.querySelector('.media-toggle-row');
  const btns = row ? Array.from(row.querySelectorAll('[data-view]')) : [];

  // A photo that never arrives degrades to today's modal rather than leaving a
  // broken frame behind a toggle that promises one. Restoring `on` matters: the
  // error can land while the table view is showing, and the cover would
  // otherwise stay faded out with nothing over it.
  const degrade = () => {
    table.remove();
    if (row) row.remove();
    cover.classList.add('on');
    cover.setAttribute('aria-hidden', 'false');
  };
  table.addEventListener('error', degrade);
  if (table.complete && table.naturalWidth === 0) degrade();

  // Swapped in place, never re-rendered: rebuilding the markup would drop the
  // transition's starting value and the crossfade would snap.
  const show = (view) => {
    const wantCover = view === 'cover';
    cover.classList.toggle('on', wantCover);
    cover.setAttribute('aria-hidden', String(!wantCover));
    table.classList.toggle('on', !wantCover);
    table.setAttribute('aria-hidden', String(wantCover));
    btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
  };

  btns.forEach((b) => b.addEventListener('click', () => {
    if (b.getAttribute('aria-pressed') === 'true') return;
    show(b.dataset.view);
  }));
}

/**
 * Builds the modal and returns a handle to it.
 *
 * @param {object}   [opts]
 * @param {object}   [opts.selection] omit for a read-only modal (Close only).
 *   Supply `{ isSelected(game), toggle(game) }` to add the deck button beside
 *   Close — the shelf does this in game-night builds. CSS keeps that button
 *   hidden until `body.gn-selecting` is set, so it only shows while selecting.
 */
export function createGameModal({ selection } = {}) {
  let openGame = null;

  document.body.insertAdjacentHTML('beforeend', `
    <div class="backdrop" id="backdrop">
      <div class="card" id="card">
        <button class="close-btn" id="close-btn" type="button" aria-label="Close">✕</button>
        <div id="card-body"></div>
        <div class="card-sticky" id="cardSticky">
          ${selection ? '<button class="modal__add" id="modalAddBtn" type="button"></button>' : ''}
          <button class="modal__close" id="modalCloseBtn" type="button">Close</button>
        </div>
      </div>
    </div>
  `);

  const backdrop = document.getElementById('backdrop');
  // Every page gets this modal, so registering here locks the background on
  // all of them without each page repeating itself.
  registerOverlay(() => backdrop.classList.contains('open'));
  const body = document.getElementById('card-body');
  const addBtn = document.getElementById('modalAddBtn');

  function close() {
    backdrop.classList.remove('open');
    openGame = null;
    syncScrollLock();
  }

  function refreshFooter() {
    if (!addBtn || !openGame) return;
    const inDeck = selection.isSelected(openGame);
    addBtn.className = 'modal__add' + (inDeck ? ' is-in' : '');
    addBtn.innerHTML = inDeck
      ? `${TICK_SVG} In tonight's deck`
      : `${PLUS_SVG} Add to tonight`;
  }

  function open(game) {
    openGame = game;
    body.innerHTML = bodyHTML(game);
    body.scrollTop = 0;
    wireFlip(body);
    wireMediaToggle(body);
    refreshFooter();
    backdrop.classList.add('open');
    syncScrollLock();
  }

  document.getElementById('close-btn').addEventListener('click', close);
  document.getElementById('modalCloseBtn').addEventListener('click', close);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      if (openGame) selection.toggle(openGame);
    });
  }

  return {
    open,
    close,
    refreshFooter,
    get openGame() { return openGame; },
  };
}

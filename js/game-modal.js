import { timeLabel, weightLabel, playersRangeLabel } from './filters.js';
import { registerOverlay, syncScrollLock } from './scroll-lock.js';

// The game detail modal, shared by the shelf and the game-night waiting room.
// Markup lives here and styling in css/game-modal.css, so an enhancement to
// either lands on every page at once. Pages must link that stylesheet.

const PLUS_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
const TICK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';

const PLAYERS_ICON = `<svg class="stat-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="7" r="3"/><circle cx="16" cy="8" r="2.5"/><path d="M3 20c0-3 2.5-5 6-5s6 2 6 5"/><path d="M14.5 15c2.5.3 4.5 2 4.5 5"/></svg>`;
const TIME_ICON = `<svg class="stat-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2"/><path d="M9 2h6"/></svg>`;
const WEIGHT_ICON = `<svg class="stat-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="M5 7l-3 6a3 3 0 006 0z"/><path d="M19 7l-3 6a3 3 0 006 0z"/><path d="M5 7h14"/><path d="M9 21h6"/></svg>`;

const VIEW_COVER_ICON = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M5 8h14"/></svg>`;
const VIEW_TABLE_ICON = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="9" rx="9" ry="4"/><path d="M5 12v6M19 12v6M12 13v7"/></svg>`;

// Inline onerror prefix: a sized cover that fails (the optimiser is not
// available) retries once with the original before the handler gives up.
const FALLBACK_ONCE = "if(this.dataset.orig&&this.src!==this.dataset.orig){this.src=this.dataset.orig;delete this.dataset.orig;return}";

// One cover, uncropped, on the stage. There is no plate behind it; a cover
// that never arrives tints its box with the game's colour so something still
// sits under the light. `backImage` stays in the data but is no longer shown.
function coverHTML(g) {
  return `
    <div class="stage-cover-wrap">
      <img class="card-cover" src="${g.imageMid || g.imageLarge || g.image}" alt="${g.title} box cover" width="600" height="450" loading="lazy" decoding="async" fetchpriority="low" data-orig="${g.imageLarge || g.image}" onerror="${FALLBACK_ONCE}this.parentElement.style.background='${g.color}';this.style.display='none'">
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

// Curated on the owner's shelf; a freshly synced shelf has none, and an empty
// "Highlights" heading would say so louder than leaving it out.
function highlightsHTML(g) {
  const why = Array.isArray(g.why) ? g.why.filter(Boolean) : [];
  if (!why.length) return '';
  return `
    <p class="why-heading">Highlights</p>
    <ul class="why-list">
      ${why.map((w) => `<li>${w}</li>`).join('')}
    </ul>`;
}

// "best at 3–4" from playerRecommendations ({ "3": "best", "4": "best", … }).
// Contiguous run → "3–4"; single → "3"; gaps → "2, 4". Nothing → ''.
// Display-only, so it lives here rather than in filters.js.
function bestAtLabel(g) {
  const rec = g.playerRecommendations;
  if (!rec) return '';
  const best = Object.keys(rec).filter((k) => rec[k] === 'best').map(Number).sort((a, b) => a - b);
  if (!best.length) return '';
  const runs = [];
  for (const n of best) {
    const r = runs[runs.length - 1];
    if (r && n === r[1] + 1) r[1] = n; else runs.push([n, n]);
  }
  const txt = runs.map(([a, b]) => (a === b ? `${a}` : `${a}–${b}`)).join(', ');
  return ` <span class="stage-meta__best">· best at ${txt}</span>`;
}

function bodyHTML(g) {
  return `
    <div class="stage-hero">
      <span class="stage-light" aria-hidden="true"></span>
      ${mediaHTML(g)}
    </div>
    ${g.tag ? `<p class="stage-eyebrow">${g.tag}</p>` : ''}
    <h2 class="stage-title">${g.title}</h2>
    <p class="stage-meta">
      <span class="stage-meta__item">${PLAYERS_ICON}${playersRangeLabel(g.players)}${bestAtLabel(g)}</span>
      <span class="stage-meta__sep" aria-hidden="true">·</span>
      <span class="stage-meta__item">${TIME_ICON}${timeLabel(g.time)}</span>
      <span class="stage-meta__sep" aria-hidden="true">·</span>
      <span class="stage-meta__item">${WEIGHT_ICON}${weightLabel(g.weightScore)}</span>
    </p>
    <p class="blurb">${g.blurb}</p>
    ${highlightsHTML(g)}`;
}

// Cover <-> table-shot crossfade. Re-wired on every open because the media
// markup is rebuilt each time — which is also what resets the view to Cover,
// per spec.
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
 * @param {object}   [opts.selection] omit for a read-only modal.
 *   Supply `{ isSelected(game), toggle(game) }` to add the floating deck pill —
 *   the shelf does this in game-night builds. CSS keeps that pill hidden until
 *   `body.gn-selecting` is set, so it only shows while selecting.
 */
export function createGameModal({ selection } = {}) {
  let openGame = null;

  document.body.insertAdjacentHTML('beforeend', `
    <div class="backdrop" id="backdrop">
      <div class="card stage" id="card">
        <button class="close-btn" id="close-btn" type="button" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
        <div id="card-body"></div>
        <div class="card-sticky" id="cardSticky">
          ${selection ? '<button class="modal__add" id="modalAddBtn" type="button"></button>' : ''}
        </div>
      </div>
    </div>
  `);

  const backdrop = document.getElementById('backdrop');
  // Every page gets this modal, so registering here locks the background on
  // all of them without each page repeating itself.
  registerOverlay(() => backdrop.classList.contains('open'));
  const card = document.getElementById('card');
  const body = document.getElementById('card-body');
  const addBtn = document.getElementById('modalAddBtn');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  // ---- The lift ----
  // One element moves: a fixed-position ghost copy of the tapped cover. It
  // starts exactly over the shelf card's art (same crop), flies to the stage
  // cover's rectangle while the crop relaxes to the full box art, then hands
  // off to the real cover. Close plays it in reverse. Everything is
  // transform + clip-path + opacity; no layout animates.
  let origin = null;        // the shelf element we lifted from
  let ghost = null;
  let settle = 0;           // timeout id for the hand-off

  function coverRect() {
    return body.querySelector('.stage-cover-wrap')?.getBoundingClientRect();
  }

  // Places the ghost over `rect` as the shelf crops it (cover-fit, centred,
  // top-aligned) given the ghost's own box `dest`.
  function shelfTransform(rect, dest) {
    const s = Math.max(rect.width / dest.width, rect.height / dest.height);
    const dx = rect.left + (rect.width - dest.width * s) / 2 - dest.left;
    const dy = rect.top - dest.top;
    const insetX = (dest.width - rect.width / s) / 2;
    const insetB = dest.height - rect.height / s;
    return {
      transform: `translate(${dx}px, ${dy}px) scale(${s})`,
      clip: `inset(0 ${insetX}px ${insetB}px ${insetX}px)`,
    };
  }

  function makeGhost(dest, src) {
    const el = document.createElement('div');
    el.className = 'lift-ghost';
    el.style.left = `${dest.left}px`;
    el.style.top = `${dest.top}px`;
    el.style.width = `${dest.width}px`;
    el.style.height = `${dest.height}px`;
    el.innerHTML = `<img src="${src}" alt="">`;
    document.body.appendChild(el);
    return el;
  }

  function killGhost() {
    clearTimeout(settle);
    ghost?.remove();
    ghost = null;
    card.classList.remove('is-lifting');
  }

  /**
   * @param {object} game
   * @param {object} [opts]
   * @param {Element} [opts.from] the shelf element whose bounds the cover
   *   lifts from (`.game-card .art` or `.gbox .face`). Omit for a plain fade.
   */
  function open(game, { from } = {}) {
    killGhost();
    openGame = game;
    body.innerHTML = bodyHTML(game);
    body.scrollTop = 0;
    wireMediaToggle(body);
    refreshFooter();
    card.classList.remove('is-out');

    const fromImg = from?.querySelector('img');
    const lift = !!(from && fromImg && fromImg.complete && fromImg.naturalWidth && !reduced.matches);

    // The stage cover takes the shelf's already-decoded bitmap first, so the
    // block has its final height before the mid-size image arrives.
    const coverImg = body.querySelector('.card-cover');
    if (lift && coverImg) {
      coverImg.style.aspectRatio = `${fromImg.naturalWidth} / ${fromImg.naturalHeight}`;
      const hi = coverImg.src;
      coverImg.src = fromImg.currentSrc || fromImg.src;
      const pre = new Image();
      pre.onload = () => { if (openGame === game) coverImg.src = hi; };
      pre.src = hi;
    }

    backdrop.classList.toggle('no-lift', !lift);
    backdrop.classList.add('open');
    syncScrollLock();

    if (!lift) {
      origin = null;
      requestAnimationFrame(() => card.classList.add('is-in'));
      return;
    }

    origin = from;
    card.classList.add('is-lifting');
    const dest = coverRect();                 // forces layout with the modal visible
    const start = shelfTransform(from.getBoundingClientRect(), dest);
    const el = ghost = makeGhost(dest, coverImg.src);
    el.style.transform = start.transform;
    el.style.clipPath = start.clip;
    // Two frames: one to commit the start state, one to transition from it.
    // `el` is this call's ghost: a close or reopen in between replaces it,
    // and the stale frame must not touch the new one.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (ghost !== el) return;
      el.style.transform = 'none';
      el.style.clipPath = 'inset(0)';
      card.classList.add('is-in');
      settle = setTimeout(killGhost, 600);   // hand-off; transitionend is not relied on
    }));
  }

  function close() {
    if (!backdrop.classList.contains('open')) return;
    openGame = null;
    card.classList.remove('is-in');
    card.classList.add('is-out');

    const dest = coverRect();
    const onScreen = origin && document.contains(origin) && (() => {
      const r = origin.getBoundingClientRect();
      return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
    })();
    const lift = onScreen && dest && !reduced.matches;

    const finish = () => {
      killGhost();
      backdrop.classList.remove('open');
      card.classList.remove('is-out');
      syncScrollLock();
      // Drop the body so the cover's decoded bitmap can be released: with the
      // markup left in place each game read added another full-size image to
      // what the page held, and a few in a row reloaded iOS Safari.
      body.innerHTML = '';
      origin = null;
    };

    if (!lift) { finish(); return; }

    killGhost();
    card.classList.add('is-lifting');
    const img = body.querySelector('.card-cover');
    const el = ghost = makeGhost(dest, img?.currentSrc || img?.src || '');
    // Start from an explicit full-box clip: `none` → `inset()` cannot
    // interpolate, and the crop would snap instead of closing in.
    el.style.transform = 'none';
    el.style.clipPath = 'inset(0)';
    const end = shelfTransform(origin.getBoundingClientRect(), dest);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (ghost !== el) return;               // reopened during the first frames
      el.style.transform = end.transform;
      el.style.clipPath = end.clip;
      backdrop.classList.remove('open');      // backdrop fades under the returning ghost
      settle = setTimeout(finish, 560);
    }));
  }

  function refreshFooter() {
    if (!addBtn || !openGame) return;
    const inDeck = selection.isSelected(openGame);
    addBtn.className = 'modal__add' + (inDeck ? ' is-in' : '');
    addBtn.innerHTML = inDeck
      ? `${TICK_SVG} In tonight's deck`
      : `${PLUS_SVG} Add to tonight`;
  }

  // Swipe-down to close: a vertical pull of more than 90px that starts with
  // the body scrolled to the top. No follow-the-finger — the lift itself is
  // the dismissal animation. Nothing happens while the body is scrolled.
  let touchX = 0, touchY = 0, pulling = false;
  body.addEventListener('touchstart', (e) => {
    pulling = body.scrollTop === 0;
    touchX = e.touches[0].clientX;
    touchY = e.touches[0].clientY;
  }, { passive: true });
  body.addEventListener('touchmove', (e) => {
    if (!pulling) return;
    const dx = e.touches[0].clientX - touchX;
    const dy = e.touches[0].clientY - touchY;
    if (dy > 90 && Math.abs(dy) > Math.abs(dx)) {
      pulling = false;
      close();
    }
  }, { passive: true });
  body.addEventListener('touchend', () => { pulling = false; }, { passive: true });

  document.getElementById('close-btn').addEventListener('click', close);
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

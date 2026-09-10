// Bag — the packing UI.
//
// Three states, and the shelf's body carries the current one as
// data-bag-state so the CSS can follow:
//
//   browse ──"Pack a bag"──▶ packing ──"Pack N games"──▶ packed ──"Unpack"──▶ browse
//                              │ ▲                          │
//                          Cancel └───────── "Edit" ────────┘
//
// Loaded only when the ?bag=1 flag is on: with it off this module is never
// fetched, so no button, bar or chip exists and localStorage is untouched.
//
// Field names are the shelf's own (games.json → shelf-data.js): `bggId`,
// `players: [min, max]`, `time: [min, max]` — there is no minplayers or
// maxplaytime on these objects.

import { bagStore } from './bag-store.js';
import { enableScope, suspendScope, activeBag } from './shelf-scope.js';

const STYLESHEET = '/css/bag.css';

const CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';

const gameId = g => String(g.bggId);

// The shelf collapses a range whose ends match ("30m", not "30–30m"); the bag
// reads the same way.
const range = ([lo, hi]) => (lo === hi ? `${lo}` : `${lo}–${hi}`);

/**
 * Player and playtime cover for a set of games.
 * The 8th cell stands for "8 or more", so a 12-player party game lights it.
 */
function coverage(games) {
  const covers = n => games.some(g => g.players[0] <= n && (n >= 8 ? g.players[1] >= 8 : g.players[1] >= n));
  const cells = [1, 2, 3, 4, 5, 6, 7, 8].map(covers);
  const minTime = games.length ? Math.min(...games.map(g => g.time[0])) : null;
  const maxTime = games.length ? Math.max(...games.map(g => g.time[1])) : null;
  // Gaps only mean something once something is packed: an empty bag is not
  // "missing" anything yet.
  const gaps = [];
  if (games.length) {
    if (!cells[1]) gaps.push('Nothing for 2 players');
    if (!cells[4]) gaps.push('Nothing for 5 players');
    if (!games.some(g => g.time[1] <= 30)) gaps.push('Nothing under 30 min');
  }
  return { cells, minTime, maxTime, gaps };
}

function coveredPlayersLabel(cells) {
  const on = cells.map((covered, i) => (covered ? i + 1 : 0)).filter(Boolean);
  if (!on.length) return '';
  const lowest = on[0];
  const highest = on[on.length - 1];
  const top = highest === 8 ? '8+' : String(highest);
  return lowest === highest ? `${top} players` : `${lowest}–${top} players`;
}

function timeLabel(minTime, maxTime) {
  if (minTime === null) return '—';
  return minTime === maxTime ? `${minTime} min` : `${minTime}–${maxTime} min`;
}

function loadStyles() {
  if (document.querySelector(`link[href="${STYLESHEET}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = STYLESHEET;
  document.head.appendChild(link);
}

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

/**
 * @param {object} opts
 * @param {() => Array<object>} opts.getGames every game on the shelf, unscoped
 * @param {() => void} opts.rerender the shelf's render()
 * @param {HTMLElement} opts.headerEl the page header, where the entry point goes
 * @param {HTMLElement} opts.gridEl the shelf grid
 */
export function setupBag({ getGames, rerender, headerEl, gridEl }) {
  enableScope(true);
  loadStyles();

  // A bag left active from a previous visit boots straight into Packed. An
  // active id whose bag is gone is cleared by activeBag() on the way past.
  let mode = activeBag() ? 'packed' : 'browse';
  let draft = new Set();   // bggIds; in-memory until "Pack N games"
  let editingId = null;    // the bag being edited; null while creating one

  // ---- DOM ----

  const packBtn = el('<button class="bag-pack-btn" type="button">Pack a bag</button>');
  const actions = el('<div class="bag-header-actions"></div>');
  actions.appendChild(packBtn);
  headerEl.appendChild(actions);

  const chip = el(`
    <div class="bag-chip" hidden>
      <b class="bag-chip__name"></b>
      <span class="bag-chip__meta"></span>
      <button class="bag-btn bag-btn--small" type="button" data-bag-edit>Edit</button>
      <button class="bag-btn bag-btn--small bag-btn--quiet" type="button" data-bag-unpack>Unpack</button>
    </div>
  `);
  headerEl.after(chip);
  const chipName = chip.querySelector('.bag-chip__name');
  const chipMeta = chip.querySelector('.bag-chip__meta');

  const hint = el('<p class="bag-hint" hidden>Tap covers to pack them. <b>The bar shows who the bag covers, and for how long.</b></p>');
  gridEl.before(hint);

  const bar = el(`
    <div class="bag-bar" role="region" aria-label="Bag coverage" aria-hidden="true" tabindex="-1">
      <div class="bag-bar__row">
        <div class="bag-bar__name">
          <input class="bag-name-input" type="text" placeholder="Name the bag" aria-label="Bag name" autocomplete="off" spellcheck="false">
        </div>
        <div class="bag-cov">
          <div class="bag-cov__item">
            <span class="bag-lab">Games</span>
            <span class="bag-val"><b data-bag-count>0</b></span>
          </div>
          <div class="bag-cov__item">
            <span class="bag-lab">Players</span>
            <div class="bag-dots" data-bag-dots aria-hidden="true"></div>
            <span class="bag-sr" data-bag-players></span>
          </div>
          <div class="bag-cov__item">
            <span class="bag-lab">Playtime</span>
            <span class="bag-val bag-val--plain" data-bag-time>—</span>
          </div>
          <div class="bag-cov__item bag-cov__item--gaps">
            <span class="bag-lab">Gaps</span>
            <div class="bag-gaps" data-bag-gaps aria-live="polite"></div>
          </div>
        </div>
        <div class="bag-bar__actions">
          <button class="bag-btn bag-btn--quiet" type="button" data-bag-cancel>Cancel</button>
          <button class="bag-btn bag-btn--primary" type="button" data-bag-commit disabled>Pack</button>
        </div>
      </div>
    </div>
  `);
  document.body.appendChild(bar);

  const nameInput = bar.querySelector('.bag-name-input');
  const countEl = bar.querySelector('[data-bag-count]');
  const dotsEl = bar.querySelector('[data-bag-dots]');
  const playersSrEl = bar.querySelector('[data-bag-players]');
  const timeEl = bar.querySelector('[data-bag-time]');
  const gapsEl = bar.querySelector('[data-bag-gaps]');
  const commitBtn = bar.querySelector('[data-bag-commit]');
  const cancelBtn = bar.querySelector('[data-bag-cancel]');

  dotsEl.innerHTML = [1, 2, 3, 4, 5, 6, 7, 8]
    .map(n => `<span class="bag-dot" data-n="${n}">${n === 8 ? '8+' : n}</span>`)
    .join('');
  const dots = Array.from(dotsEl.querySelectorAll('.bag-dot'));

  // ---- state ----

  function draftGames() {
    return getGames().filter(g => draft.has(gameId(g)));
  }

  function bagGames(bag) {
    const ids = new Set(bag.game_ids);
    return getGames().filter(g => ids.has(gameId(g)));
  }

  const SUPPORTS_INERT = 'inert' in HTMLElement.prototype;

  function applyMode() {
    document.body.dataset.bagState = mode;
    packBtn.hidden = mode !== 'browse';
    hint.hidden = mode !== 'packing';
    chip.hidden = mode !== 'packed';
    const packing = mode === 'packing';
    bar.setAttribute('aria-hidden', String(!packing));
    // The bar's visibility takes the slide's 220ms to catch up, and its
    // controls are tabbable for as long as it is still on screen. inert closes
    // that window where the browser has it; visibility closes it everywhere else.
    if (SUPPORTS_INERT) bar.inert = !packing;
  }

  function updateBar() {
    const selected = draftGames();
    const cover = coverage(selected);
    countEl.textContent = String(selected.length);
    dots.forEach((dot, i) => dot.classList.toggle('on', cover.cells[i]));
    playersSrEl.textContent = selected.length
      ? `Player counts covered: ${coveredPlayersLabel(cover.cells) || 'none'}`
      : '';
    timeEl.textContent = timeLabel(cover.minTime, cover.maxTime);
    // "Covered" is the all-clear, so it belongs to a bag that holds something.
    // An empty bag leaves the slot blank rather than claiming it covers a trip.
    if (cover.gaps.length) {
      gapsEl.classList.remove('is-clear');
      gapsEl.innerHTML = cover.gaps.map(g => `<span class="bag-gap">${g}</span>`).join('');
    } else {
      gapsEl.classList.toggle('is-clear', selected.length > 0);
      gapsEl.textContent = selected.length ? 'Covered' : '';
    }
    commitBtn.disabled = selected.length === 0;
    commitBtn.textContent = selected.length
      ? `Pack ${selected.length} game${selected.length === 1 ? '' : 's'}`
      : 'Pack';
  }

  function updateChip() {
    const bag = activeBag();
    if (!bag) return;
    const games = bagGames(bag);
    const cover = coverage(games);
    chipName.textContent = bag.name;
    const parts = [`${games.length} game${games.length === 1 ? '' : 's'}`];
    const players = coveredPlayersLabel(cover.cells);
    if (players) parts.push(players);
    if (cover.minTime !== null) parts.push(timeLabel(cover.minTime, cover.maxTime));
    chipMeta.textContent = parts.join(' · ');
  }

  function enterPacking(bagId) {
    editingId = bagId || null;
    const existing = editingId ? bagStore.get(editingId) : null;
    // Only ids the shelf still carries make it into the draft, so a game
    // dropped by a sync leaves the bag on the next save.
    const known = new Set(getGames().map(gameId));
    draft = new Set((existing ? existing.game_ids : []).filter(id => known.has(id)));
    nameInput.value = existing ? existing.name : '';
    mode = 'packing';
    suspendScope(true); // pick from the whole shelf, not from the bag
    applyMode();
    rerender();
    updateBar();
    // Focus lands on the bar itself rather than the name field: on iOS
    // focusing the input would throw the keyboard over the grid you came to tap.
    bar.focus({ preventScroll: true });
  }

  function commit() {
    if (!draft.size) return;
    const saved = bagStore.save({
      id: editingId || undefined,
      name: nameInput.value.trim() || 'Bag',
      game_ids: Array.from(draft),
    });
    bagStore.setActive(saved.id);
    editingId = null;
    draft = new Set();
    mode = 'packed';
    suspendScope(false);
    applyMode();
    rerender();
    chip.querySelector('[data-bag-edit]').focus({ preventScroll: true });
  }

  function cancel() {
    const wasEditing = !!editingId;
    editingId = null;
    draft = new Set();
    suspendScope(false);
    mode = wasEditing && activeBag() ? 'packed' : 'browse';
    applyMode();
    rerender();
    const back = mode === 'packed' ? chip.querySelector('[data-bag-edit]') : packBtn;
    back.focus({ preventScroll: true });
  }

  function unpack() {
    // The bag itself stays: unpacking is putting it down, not throwing it away.
    bagStore.setActive(null);
    mode = 'browse';
    applyMode();
    rerender();
    packBtn.focus({ preventScroll: true });
  }

  // ---- wiring ----

  packBtn.addEventListener('click', () => enterPacking(null));
  chip.querySelector('[data-bag-edit]').addEventListener('click', () => {
    const bag = activeBag();
    if (bag) enterPacking(bag.id);
  });
  chip.querySelector('[data-bag-unpack]').addEventListener('click', unpack);
  cancelBtn.addEventListener('click', cancel);
  commitBtn.addEventListener('click', commit);
  applyMode();

  // ---- what the shelf calls ----

  return {
    /** True while tiles are toggles: the shelf skips the detail modal. */
    packing() {
      return mode === 'packing';
    },

    mode() {
      return mode;
    },

    /** Turns one freshly rendered grid tile into a packing toggle. */
    decorateCard(cardEl, game) {
      if (mode !== 'packing') {
        cardEl.removeAttribute('aria-pressed');
        return;
      }
      const packed = draft.has(gameId(game));
      cardEl.setAttribute('aria-pressed', String(packed));
      cardEl.setAttribute(
        'aria-label',
        `${game.title}, ${range(game.players)} players, ${range(game.time)} minutes`
      );
      cardEl.insertAdjacentHTML('beforeend', `<span class="bag-check" aria-hidden="true">${CHECK_SVG}</span>`);
      const body = cardEl.querySelector('.plate-body');
      if (body) {
        // Player count and playtime, the two things you are weighing while you
        // pack. On a phone the tile is too narrow for both, so the CSS drops
        // the player half there and gives the card's own count back instead.
        body.insertAdjacentHTML(
          'beforeend',
          `<span class="bag-line"><span class="bag-line__players">${range(game.players)}p · </span>${range(game.time)} min</span>`
        );
      }
    },

    /**
     * Toggling only ever changes one tile, so the grid is patched in place —
     * a re-render would drop every cover image and the scroll position.
     */
    toggleGame(game, cardEl) {
      const id = gameId(game);
      const packed = !draft.has(id);
      if (packed) draft.add(id);
      else draft.delete(id);
      if (cardEl) cardEl.setAttribute('aria-pressed', String(packed));
      updateBar();
    },

    /** Called at the end of every render(), after the grid is rebuilt. */
    afterRender() {
      if (mode !== 'packed') return;
      updateChip();
      const add = el('<button class="bag-add" type="button" aria-label="Add more games to this bag">+ Add more</button>');
      add.addEventListener('click', () => {
        const bag = activeBag();
        enterPacking(bag ? bag.id : null);
      });
      gridEl.appendChild(add);
    },
  };
}

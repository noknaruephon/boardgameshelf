// Bag — the packing UI on the shelf.
//
// Two states, and the shelf's body carries the current one as data-bag-state
// so the CSS can follow:
//
//   browse ──"Pack a bag" / "+ Pack a bag"──▶ packing ──"Pack N games"──▶ /bag/<id>
//                                               │
//                                             Cancel ──▶ browse (or back to the bag being edited)
//
// A packed bag is a page of its own (/bag/<id>, routed inside shelf.html), so
// nothing here is "active": the shelf always shows the whole collection, and
// this module adds the way in — the "N bags" control on the count line, the
// Bags sheet it opens, the coverage bar — and the save that ends on the bag's
// page. Spec: docs/bag-shelf-header-spec.md.
//
// Loaded only when the ?bag=1 flag is on: with it off this module is never
// fetched, so no row, button or bar exists and localStorage is untouched.
//
// Field names are the shelf's own (games.json → shelf-data.js): `bggId`,
// `players: [min, max]`, `time: [min, max]`.

import { bagStore, migrateLegacyBags } from './bag-store.js';
import { coverage, coveredPlayersLabel, timeLabel, cellsHTML } from './bag-coverage.js';
import { createBottomSheet } from './share-sheet.js';

const STYLESHEET = '/css/bag.css';

const gameId = g => String(g.bggId);

// The shelf collapses a range whose ends match ("30m", not "30–30m"); the bag
// reads the same way.
const range = ([lo, hi]) => (lo === hi ? `${lo}` : `${lo}–${hi}`);

const SAVE_ERRORS = {
  NO_GAMES: 'Pick at least one game to pack.',
  NO_NAME: 'Name the bag before packing it.',
  NO_TOKEN: 'This browser can’t edit that bag — only the one that packed it can.',
  FORBIDDEN: 'That bag wouldn’t accept the change: the edit key here doesn’t match.',
  NOT_FOUND: 'That bag is gone. Pack it again to make a new one.',
  UNAVAILABLE: 'Couldn’t reach the shelf to save. Check the connection and try again.',
};

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
 * @param {() => Array<object>} opts.getGames every game on the shelf
 * @param {() => void} opts.rerender the shelf's render()
 * @param {HTMLElement} opts.headerEl the page header, where the entry point goes
 * @param {HTMLElement} opts.gridEl the shelf grid
 * @param {HTMLElement} opts.countEl the "196 on the shelf" line; the bags
 *   control takes its right-hand end
 * @param {string} opts.ownerSlug whose shelf this is: bags are packed for it
 * @param {(origin: HTMLElement) => void} [opts.runWave] the shelf's selection
 *   entrance — the gold wave out from the control that was tapped
 * @param {() => void} [opts.stopWave] cancels it when packing ends early
 */
export function setupBag({ getGames, rerender, headerEl, gridEl, countEl: shelfCountEl, ownerSlug, runWave, stopWave }) {
  loadStyles();

  let mode = 'browse';
  let draft = new Set();    // bggIds; in-memory until "Pack N games"
  let editing = null;       // the bag being edited (public shape); null while creating one
  let saving = false;

  // ---- DOM ----

  // The one way in: the right-hand end of the count line. With bags it reads
  // "◆ N bags ▾" and opens the Bags sheet; with none it reads "◆ Pack a bag"
  // and opens packing straight away.
  const packBtn = el(`
    <button class="shelf-bags-btn" type="button" aria-haspopup="dialog" aria-expanded="false">
      <i class="bag-diamond" aria-hidden="true"></i><span class="shelf-bags-btn__label">Pack a bag</span><span class="shelf-bags-btn__caret" aria-hidden="true" hidden>▾</span>
    </button>
  `);
  const packLabel = packBtn.querySelector('.shelf-bags-btn__label');
  const packCaret = packBtn.querySelector('.shelf-bags-btn__caret');
  shelfCountEl.classList.add('shelf-count--with-bags');
  shelfCountEl.appendChild(packBtn);
  let bags = [];

  // The Bags sheet: the same scaffold as the share sheet, rows of bags with
  // a cover stack, and "+ Pack a bag" last.
  const sheet = createBottomSheet({
    className: 'bags-sheet',
    titleId: 'bagsSheetTitle',
    bodyHTML: `
      <h2 class="bsheet__title" id="bagsSheetTitle">Bags</h2>
      <div class="bags-sheet__list" data-bags-list></div>
    `,
    onClose: () => packBtn.setAttribute('aria-expanded', 'false'),
  });
  const sheetList = sheet.el.querySelector('[data-bags-list]');

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
        <p class="bag-bar__error" data-bag-error role="alert" hidden></p>
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
  const errorEl = bar.querySelector('[data-bag-error]');

  dotsEl.innerHTML = cellsHTML([false, false, false, false, false, false, false, false]);
  const dots = Array.from(dotsEl.querySelectorAll('.bag-dot'));

  // ---- the bags control and sheet ----

  function bagGames(bag) {
    const ids = new Set(bag.game_ids);
    return getGames().filter(g => ids.has(gameId(g)));
  }

  function renderControl() {
    const n = bags.length;
    packLabel.textContent = n ? `${n} bag${n === 1 ? '' : 's'}` : 'Pack a bag';
    packCaret.hidden = n === 0;
    if (n) packBtn.setAttribute('aria-haspopup', 'dialog');
    else packBtn.removeAttribute('aria-haspopup');
  }

  function renderSheet() {
    sheetList.innerHTML = '';
    for (const bag of bags) {
      const games = bagGames(bag);
      const cover = coverage(games);
      const a = el('<a class="bags-sheet__row"></a>');
      a.href = `/bag/${encodeURIComponent(bag.id)}`;
      // The first three covers, the grid's own thumbnails, so they are
      // already in the browser's cache.
      const stack = el('<span class="bags-stack" aria-hidden="true"></span>');
      for (const g of games.slice(0, 3)) {
        const img = document.createElement('img');
        img.src = g.image; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
        img.addEventListener('error', () => img.remove());
        stack.appendChild(img);
      }
      const txt = el('<span class="bags-sheet__txt"><span class="bags-sheet__name"></span><span class="bags-sheet__meta"></span></span>');
      txt.querySelector('.bags-sheet__name').textContent = bag.name;
      const parts = [`${games.length} game${games.length === 1 ? '' : 's'}`];
      const players = coveredPlayersLabel(cover.cells);
      if (players) parts.push(players.replace(' players', ' p'));
      if (cover.minTime !== null) parts.push(timeLabel(cover.minTime, cover.maxTime));
      txt.querySelector('.bags-sheet__meta').textContent = parts.join(' · ');
      a.append(stack, txt, el('<span class="bags-sheet__chev" aria-hidden="true">›</span>'));
      sheetList.appendChild(a);
    }
    const add = el('<button class="bags-sheet__row bags-sheet__row--new" type="button">+ Pack a bag</button>');
    add.addEventListener('click', () => { sheet.close(); enterPacking(null, packBtn); });
    sheetList.appendChild(add);
  }

  function openBags() {
    if (!bags.length) { enterPacking(null, packBtn); return; }
    packBtn.setAttribute('aria-expanded', 'true');
    sheet.open(packBtn);
  }

  // Stage 1's local bags are packed again into the shelf first, so they show
  // up in the sheet on the same visit. Neither step is allowed to take the
  // shelf down: a list that fails to load is simply "Pack a bag".
  const bagsReady = (async () => {
    try { await migrateLegacyBags(ownerSlug); } catch { /* reported by the store */ }
    try {
      bags = await bagStore.list(ownerSlug);
    } catch (err) {
      console.warn('[bag] could not list bags', err);
      bags = [];
    }
    renderControl();
    renderSheet();
  })();

  // ---- state ----

  function draftGames() {
    return getGames().filter(g => draft.has(gameId(g)));
  }

  const SUPPORTS_INERT = 'inert' in HTMLElement.prototype;

  function applyMode() {
    document.body.dataset.bagState = mode;
    hint.hidden = mode !== 'packing';
    // The way in steps aside while you are already packing.
    packBtn.hidden = mode === 'packing';
    const packing = mode === 'packing';
    // The shelf's own selection mode: the card ring, the checkbox, the ⓘ and
    // the dimmed unpicked covers are game night's, and packing wears them
    // unchanged. Only the bar at the bottom is the bag's own.
    document.body.classList.toggle('is-selecting', packing);
    bar.setAttribute('aria-hidden', String(!packing));
    // The bar's visibility takes the slide's 220ms to catch up, and its
    // controls are tabbable for as long as it is still on screen. inert closes
    // that window where the browser has it; visibility closes it everywhere else.
    if (SUPPORTS_INERT) bar.inert = !packing;
  }

  function showError(code) {
    errorEl.textContent = SAVE_ERRORS[code] || SAVE_ERRORS.UNAVAILABLE;
    errorEl.hidden = false;
  }

  function clearError() {
    errorEl.hidden = true;
    errorEl.textContent = '';
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
    // Pack stays live: pressing it with nothing picked, or no name, says so
    // in the bar rather than sitting dimmed with no reason showing.
    commitBtn.disabled = saving;
    commitBtn.textContent = saving
      ? 'Packing…'
      : selected.length
        ? `${editing ? 'Save' : 'Pack'} ${selected.length} game${selected.length === 1 ? '' : 's'}`
        : 'Pack';
  }

  function enterPacking(bag, origin) {
    editing = bag || null;
    // Only ids the shelf still carries make it into the draft, so a game
    // dropped by a sync leaves the bag on the next save.
    const known = new Set(getGames().map(gameId));
    draft = new Set((editing ? editing.game_ids : []).filter(id => known.has(id)));
    nameInput.value = editing ? editing.name : '';
    clearError();
    mode = 'packing';
    applyMode();
    rerender();
    updateBar();
    // The wave measures the cards it is about to sweep, so it runs on the
    // grid packing mode just rendered.
    runWave?.(origin || packBtn);
    // Focus lands on the bar itself rather than the name field: on iOS
    // focusing the input would throw the keyboard over the grid you came to tap.
    bar.focus({ preventScroll: true });
  }

  // Saving ends on the bag's own page. Until the navigation lands the bar
  // stays up with everything still selected, so a failure loses nothing.
  async function commit() {
    if (saving) return;
    // A bag needs games, and a name: the page it becomes is titled with it,
    // and the sheet lists it by it. Say which is missing, games first.
    if (!draft.size) { showError('NO_GAMES'); return; }
    if (!nameInput.value.trim()) {
      showError('NO_NAME');
      nameInput.focus();
      return;
    }
    stopWave?.();
    saving = true;
    clearError();
    updateBar();
    const payload = { name: nameInput.value.trim(), game_ids: Array.from(draft) };
    try {
      const saved = editing
        ? await bagStore.update(editing.id, payload)
        : await bagStore.create({ ...payload, owner: ownerSlug });
      location.href = `/bag/${encodeURIComponent(saved.id)}`;
    } catch (err) {
      saving = false;
      updateBar();
      showError(err?.code);
      console.warn('[bag] save failed', err);
    }
  }

  function cancel() {
    stopWave?.();
    const back = editing;
    editing = null;
    draft = new Set();
    clearError();
    if (back) {
      // Editing came from the bag's page; Cancel goes back there unchanged.
      location.href = `/bag/${encodeURIComponent(back.id)}`;
      return;
    }
    mode = 'browse';
    applyMode();
    rerender();
    packBtn.focus({ preventScroll: true });
  }

  // ---- wiring ----

  packBtn.addEventListener('click', openBags);
  cancelBtn.addEventListener('click', cancel);
  commitBtn.addEventListener('click', commit);
  nameInput.addEventListener('input', () => { clearError(); updateBar(); });
  applyMode();

  // ---- what the shelf calls ----

  return {
    /** True while tiles are toggles: the shelf skips the detail modal. */
    packing() {
      return mode === 'packing';
    },

    /** Resolves once the bags list has loaded (or given up). */
    bagsReady,

    /**
     * Opens packing with an existing bag's games selected and its name in
     * the input; the shelf calls this for /?bag=1&edit=<id>. Save rewrites
     * the same bag and returns to its page.
     */
    startEdit(bag, origin) {
      if (!bag || !bagStore.canEdit(bag.id)) {
        console.warn('[bag] no edit key for this bag in this browser');
        return false;
      }
      enterPacking(bag, origin || packBtn);
      return true;
    },

    /** Turns one freshly rendered grid tile into a packing toggle. */
    decorateCard(cardEl, game) {
      if (mode !== 'packing') {
        cardEl.classList.remove('selected');
        cardEl.removeAttribute('aria-pressed');
        return;
      }
      const packed = draft.has(gameId(game));
      // `.selected` is the shelf's selected-card class: the ring, the filled
      // checkbox and the full-strength cover all follow it, the same as they
      // do while game night is picking.
      cardEl.classList.toggle('selected', packed);
      cardEl.setAttribute('aria-pressed', String(packed));
      cardEl.setAttribute(
        'aria-label',
        `${game.title}, ${range(game.players)} players, ${range(game.time)} minutes`
      );
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
      if (cardEl) {
        cardEl.classList.toggle('selected', packed);
        cardEl.setAttribute('aria-pressed', String(packed));
      }
      // Picking a game answers "pick at least one game".
      if (packed) clearError();
      updateBar();
    },
  };
}

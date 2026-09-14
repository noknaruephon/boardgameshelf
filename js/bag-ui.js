// Bag — the packing UI on the shelf.
//
// Two states, and the shelf's body carries the current one as data-bag-state
// so the CSS can follow:
//
//   browse ──"+ Pack a bag" (owner only)──▶ packing ──"Pack N games"──▶ /bag/<id>
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
 * @param {boolean} [opts.canPack] whether the viewer is the shelf's owner.
 *   Only the owner packs: guests get the Bags sheet to browse, with no
 *   "+ Pack a bag" row, and packing never opens for them.
 * @param {(origin: HTMLElement) => void} [opts.runWave] the shelf's selection
 *   entrance — the gold wave out from the control that was tapped
 * @param {() => void} [opts.stopWave] cancels it when packing ends early
 */
export function setupBag({ getGames, rerender, headerEl, gridEl, countEl: shelfCountEl, ownerSlug, canPack = false, runWave, stopWave }) {
  loadStyles();

  let mode = 'browse';
  let draft = new Set();    // bggIds; in-memory until "Pack N games"
  let editing = null;       // the bag being edited (public shape); null while creating one
  let saving = false;

  // ---- DOM ----

  // The one way in: the right-hand end of the count line. It reads
  // "◆ N bags ▾", or "◆ No bags ▾" with none, and always opens the Bags sheet.
  const packBtn = el(`
    <button class="shelf-bags-btn" type="button" aria-haspopup="dialog" aria-expanded="false">
      <i class="bag-diamond" aria-hidden="true"></i><span class="shelf-bags-btn__label">No bags</span><span class="shelf-bags-btn__caret" aria-hidden="true">▾</span>
    </button>
  `);
  const packLabel = packBtn.querySelector('.shelf-bags-btn__label');
  shelfCountEl.classList.add('shelf-count--with-bags');
  shelfCountEl.appendChild(packBtn);
  let bags = [];

  // The Bags sheet: the same scaffold as the share sheet, rows of bags with
  // a cover stack, and for the owner "+ Pack a bag" last. With no bags it
  // says so, and the owner still gets the row.
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

  // The dock: a read-only coverage bar along the bottom edge, with Cancel and
  // Pack floating above it as glass pills so the grid stays visible behind.
  // `.bag-bar` is still the root the show/hide logic drives (the slide, the
  // visibility flip, inert); `.bag-dock` is the layout inside it.
  const bar = el(`
    <div class="bag-bar bag-dock" role="region" aria-label="Bag coverage" aria-hidden="true" tabindex="-1">
      <div class="bag-dock__float">
        <button type="button" class="bag-dock__cancel" data-bag-cancel>Cancel</button>
        <button type="button" class="bag-dock__pack" data-bag-commit disabled>Pack</button>
      </div>
      <div class="bag-dock__bar">
        <div class="bag-dock__row">
          <div class="bag-dock__left">
            <div class="bag-dock__count"><span data-bag-count>0</span><small>games</small></div>
            <div class="bag-dock__time" data-bag-time>–</div>
          </div>
          <div class="bag-dock__right">
            <div class="bag-dock__strip" data-bag-strip aria-hidden="true"></div>
            <span class="bag-sr" data-bag-players></span>
            <div class="bag-dock__labels" aria-hidden="true"><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8+</span></div>
          </div>
        </div>
        <div class="bag-dock__gaps" data-bag-gaps aria-live="polite"></div>
      </div>
    </div>
  `);
  document.body.appendChild(bar);

  // The naming step. Pack no longer saves: it opens this, and "Pack the bag"
  // runs the save. It lives beside the bar rather than inside it, because the
  // bar slides with a transform and a fixed sheet inside it would slide too.
  // Commit 1 keeps it plain and hidden; the sheet styling is the next commit.
  const nameStep = el(`
    <div class="bag-name" role="dialog" aria-modal="true" aria-labelledby="bagNameTitle" hidden>
      <div class="bag-name__panel">
        <h2 class="bag-name__title" id="bagNameTitle">Name the bag</h2>
        <p class="bag-name__sub" data-bag-name-sub></p>
        <input class="bag-name-input" type="text" placeholder="Name the bag" aria-label="Bag name" autocomplete="off" spellcheck="false">
        <p class="bag-bar__error" data-bag-error role="alert" hidden></p>
        <div class="bag-name__foot">
          <button type="button" class="bag-name__back" data-bag-name-back>Back</button>
          <button type="button" class="bag-name__save" data-bag-save>Pack the bag</button>
        </div>
      </div>
    </div>
  `);
  document.body.appendChild(nameStep);

  const nameInput = nameStep.querySelector('.bag-name-input');
  const nameSubEl = nameStep.querySelector('[data-bag-name-sub]');
  const nameBackBtn = nameStep.querySelector('[data-bag-name-back]');
  const saveBtn = nameStep.querySelector('[data-bag-save]');
  const errorEl = nameStep.querySelector('[data-bag-error]');
  const countEl = bar.querySelector('[data-bag-count]');
  const stripEl = bar.querySelector('[data-bag-strip]');
  const playersSrEl = bar.querySelector('[data-bag-players]');
  const timeEl = bar.querySelector('[data-bag-time]');
  const gapsEl = bar.querySelector('[data-bag-gaps]');
  const commitBtn = bar.querySelector('[data-bag-commit]');
  const cancelBtn = bar.querySelector('[data-bag-cancel]');

  // Eight cells, 1 to 8+. Covered when a packed game plays at that count;
  // the 2 and 5 cells also carry a gap mark when the bag has games but none
  // for that count, since those are the two the gap line calls out.
  stripEl.innerHTML = '<span></span>'.repeat(8);
  const cells = Array.from(stripEl.children);

  // ---- the bags control and sheet ----

  function bagGames(bag) {
    const ids = new Set(bag.game_ids);
    return getGames().filter(g => ids.has(gameId(g)));
  }

  function renderControl() {
    const n = bags.length;
    packLabel.textContent = n ? `${n} bag${n === 1 ? '' : 's'}` : 'No bags';
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
    if (!bags.length) {
      const empty = el('<p class="bags-sheet__empty"></p>');
      empty.textContent = canPack ? 'Nothing packed yet.' : 'No bags on this shelf yet.';
      sheetList.appendChild(empty);
    }
    if (canPack) {
      const add = el('<button class="bags-sheet__row bags-sheet__row--new" type="button">+ Pack a bag</button>');
      add.addEventListener('click', () => { sheet.close(); enterPacking(null, packBtn); });
      sheetList.appendChild(add);
    }
  }

  function openBags() {
    packBtn.setAttribute('aria-expanded', 'true');
    sheet.open(packBtn);
  }

  // Stage 1's local bags are packed again into the shelf first, so they show
  // up in the sheet on the same visit. Neither step is allowed to take the
  // shelf down: a list that fails to load is simply "No bags".
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
    if (!packing) closeNaming();
  }

  function openNaming() {
    if (!draft.size) { showError('NO_GAMES'); return; }
    clearError();
    nameStep.hidden = false;
    nameInput.focus({ preventScroll: true });
  }

  function closeNaming() {
    if (nameStep.hidden) return;
    nameStep.hidden = true;
    clearError();
    // Back returns to packing with the selection intact; focus goes back to
    // the pill that opened the step.
    if (mode === 'packing') commitBtn.focus({ preventScroll: true });
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
    const n = selected.length;
    const cover = coverage(selected);
    countEl.textContent = String(n);
    cells.forEach((cell, i) => {
      cell.classList.toggle('is-covered', cover.cells[i]);
      cell.classList.toggle('is-gap', n > 0 && !cover.cells[i] && (i === 1 || i === 4));
    });
    playersSrEl.textContent = n
      ? `Player counts covered: ${coveredPlayersLabel(cover.cells) || 'none'}`
      : '';
    const time = cover.minTime === null ? '–' : timeLabel(cover.minTime, cover.maxTime);
    timeEl.textContent = time;
    // The gap line is only there when there is something to say; CSS hides
    // the empty element, so the bar drops back to its shorter height.
    gapsEl.textContent = cover.gaps.join(' · ');
    // Pack waits for a game. It opens the naming step; saving happens there.
    commitBtn.disabled = !n || saving;
    commitBtn.textContent = editing ? 'Save' : 'Pack';
    nameSubEl.textContent = `${n} game${n === 1 ? '' : 's'}, ${time}`;
    saveBtn.disabled = saving;
    saveBtn.textContent = saving ? 'Packing…' : `${editing ? 'Save' : 'Pack'} the bag`;
  }

  function enterPacking(bag, origin) {
    // A new bag is the owner's to pack. Editing one goes by its edit token,
    // which only a browser that packed it holds.
    if (!bag && !canPack) return;
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
  // Reached from the naming step's "Pack the bag"; the bar's Pack only opens
  // that step.
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
    closeNaming();
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
  commitBtn.addEventListener('click', openNaming);
  nameBackBtn.addEventListener('click', closeNaming);
  saveBtn.addEventListener('click', commit);
  nameInput.addEventListener('input', clearError);
  nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } });
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

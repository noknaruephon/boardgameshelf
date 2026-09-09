// Game night invite poster — shelf select mode, the invite sheet, and night
// creation. Behind ?invite=1 on the shelf; shelf.html calls setupInvite() only
// when the flag is on, so with it off none of this is in the DOM.
//
// Select mode wraps each shelf card in a tile that carries two real buttons:
// "pick" (toggles the game in or out of the night) and "star" (makes it the
// headline). The card itself is a <button>, and a button cannot contain
// buttons, so the tile sits around it rather than inside it. Leaving select
// mode unwraps every card again; nothing about the grid is re-rendered, so
// covers and scroll position survive both transitions.
//
// The sheet is the filter sheet's twin: same scrim and panel classes, same
// scroll lock, same focus trap and Escape handling. The poster itself is
// drawn by js/invite-poster.js.

import { registerOverlay, syncScrollLock } from './scroll-lock.js';
import { userDisplayName } from './auth.js';
import { renderInvitePoster, NIGHT_URL_BASE } from './invite-poster.js';

// Tabler "star" (outline) and "check", both on currentColor.
const STAR_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z"/></svg>`;
// Tabler outline icons (3.31), 24px grid, stroke 2, currentColor.
const ICON_PATHS = {
  calendar: '<path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12z"/><path d="M16 3v4"/><path d="M8 3v4"/><path d="M4 11h16"/><path d="M11 15h1"/><path d="M12 15v3"/>',
  'map-pin': '<path d="M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"/><path d="M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0z"/>',
  star: '<path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z"/>',
  link: '<path d="M9 15l6 -6"/><path d="M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464"/><path d="M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463"/>',
  copy: '<path d="M7 7m0 2.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667z"/><path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1"/>',
  'chevron-right': '<path d="M9 6l6 6l-6 6"/>',
  share: '<path d="M6 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/><path d="M18 6m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/><path d="M18 18m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/><path d="M8.7 10.7l6.6 -3.4"/><path d="M8.7 13.3l6.6 3.4"/>',
  x: '<path d="M18 6l-12 12"/><path d="M6 6l12 12"/>',
};
const icon = (name, cls = '') =>
  `<svg class="invite-ti ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name]}</svg>`;
const CHECK_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10"/></svg>`;

// The poster uses faces the shelf does not: Fraunces 300 and 400. Loaded
// here, not in shelf.html's <link>, so a shelf without the flag requests
// exactly the fonts it does today.
const POSTER_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400&display=swap';

// "Sat 19 Sep, 7 pm" from the picker's YYYY-MM-DD and HH:MM; empty date → null
// (no date line on the poster). Minutes only when they are not :00.
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function formatWhen(date, time) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || '');
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) return null;
  const day = `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  const t = /^(\d{2}):(\d{2})/.exec(time || '');
  if (!t) return day;
  const h = Number(t[1]), min = Number(t[2]);
  const h12 = h % 12 || 12;
  return `${day}, ${h12}${min ? ':' + String(min).padStart(2, '0') : ''} ${h < 12 ? 'am' : 'pm'}`;
}

const esc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * @param {object} ctx
 * @param {HTMLElement} ctx.shelfEl     the card grid (#shelf)
 * @param {HTMLElement} ctx.toolbarEl   where "Plan a night" goes (the filter/sort bar)
 * @param {() => object[]} ctx.getGames legacy-shaped games currently loaded
 * @param {() => object|null} ctx.getProfile  the shelf's profile (owner)
 * @param {() => Promise<object|null>} ctx.getViewer  the signed-in user, if any
 * @returns {{ onRender: () => void, isSelecting: () => boolean }}
 */
export function setupInvite({ shelfEl, toolbarEl, getGames, getProfile, getViewer }) {
  // The whole of select mode's state. bggIds are strings on this shelf, in
  // the order they were picked — that order is the strip's order.
  const sel = { picked: [], headline: null };
  let selecting = false;

  if (!document.querySelector(`link[href="${POSTER_FONTS_HREF}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = POSTER_FONTS_HREF;
    document.head.appendChild(link);
  }

  const gameById = id => getGames().find(g => g.bggId === id) || null;

  // ---- entry point ----

  const planBtn = document.createElement('button');
  planBtn.className = 'icon-btn plan-btn';
  planBtn.id = 'planNightBtn';
  planBtn.type = 'button';
  planBtn.setAttribute('aria-pressed', 'false');
  planBtn.textContent = 'Plan a night';
  toolbarEl.appendChild(planBtn);
  planBtn.addEventListener('click', () => (selecting ? exit() : enter()));

  // ---- action bar ----

  const bar = document.createElement('div');
  bar.className = 'invite-bar';
  bar.id = 'inviteBar';
  bar.hidden = true;
  bar.innerHTML = `
    <button class="invite-bar__done" id="inviteDone" type="button">Done</button>
    <div class="invite-bar__text">
      <b id="inviteCount" aria-live="polite"></b>
      <small id="inviteHeadnote"></small>
    </div>
    <button class="invite-bar__share" id="inviteShare" type="button">Share invite</button>
  `;
  shelfEl.insertAdjacentElement('afterend', bar);
  const countEl = bar.querySelector('#inviteCount');
  const headnoteEl = bar.querySelector('#inviteHeadnote');
  const shareInviteBtn = bar.querySelector('#inviteShare');
  bar.querySelector('#inviteDone').addEventListener('click', exit);
  shareInviteBtn.addEventListener('click', openSheet);

  function updateBar() {
    const n = sel.picked.length;
    const h = sel.headline ? gameById(sel.headline) : null;
    countEl.textContent = `${n} game${n === 1 ? '' : 's'} picked`;
    headnoteEl.textContent = h ? `Headline: ${h.title}` : 'Pick at least one';
  }

  // ---- tiles ----

  function wrapCard(card) {
    const id = card.dataset.id;
    const g = gameById(id);
    if (!g) return;
    const tile = document.createElement('div');
    tile.className = 'inv-tile';
    tile.dataset.id = id;
    card.parentNode.insertBefore(tile, card);
    tile.appendChild(card);
    // The pick overlay covers the card and owns its taps; the card drops out
    // of the tab order so keyboard users meet pick and star, nothing else.
    card.setAttribute('tabindex', '-1');
    card.setAttribute('aria-hidden', 'true');
    tile.insertAdjacentHTML('beforeend', `
      <button class="pick" type="button" aria-pressed="false" aria-label="Add ${esc(g.title)}">
        <span class="art-zone"><span class="pip">${CHECK_SVG}</span><span class="tag">Headline</span></span>
      </button>
      <button class="star" type="button" aria-pressed="false" aria-label="Make ${esc(g.title)} the headline">${STAR_SVG}</button>
    `);
  }

  function unwrapCard(tile) {
    const card = tile.querySelector('.game-card');
    if (card) {
      card.removeAttribute('tabindex');
      card.removeAttribute('aria-hidden');
      tile.parentNode.insertBefore(card, tile);
    }
    tile.remove();
  }

  function syncTile(tile) {
    const id = tile.dataset.id;
    const g = gameById(id);
    const on = sel.picked.includes(id);
    const head = on && sel.headline === id;
    tile.classList.toggle('on', on);
    tile.classList.toggle('head', head);
    const pick = tile.querySelector('.pick');
    pick.setAttribute('aria-pressed', String(on));
    if (g) pick.setAttribute('aria-label', `${on ? 'Remove' : 'Add'} ${g.title}`);
    tile.querySelector('.star').setAttribute('aria-pressed', String(head));
  }

  // Wraps whatever cards the grid currently holds — called on entry and after
  // every re-render while selecting (filters and search stay live).
  function decorate() {
    shelfEl.querySelectorAll('.game-card[data-id]').forEach(card => {
      if (!card.parentElement.classList.contains('inv-tile')) wrapCard(card);
    });
    shelfEl.querySelectorAll('.inv-tile').forEach(syncTile);
  }

  function undecorate() {
    shelfEl.querySelectorAll('.inv-tile').forEach(unwrapCard);
  }

  shelfEl.addEventListener('click', (e) => {
    if (!selecting) return;
    const star = e.target.closest('.star');
    if (star) { setHeadline(star.closest('.inv-tile').dataset.id); return; }
    const pick = e.target.closest('.pick');
    if (pick) togglePick(pick.closest('.inv-tile').dataset.id);
  });

  // ---- selection ----

  function togglePick(id) {
    if (sel.picked.includes(id)) sel.picked = sel.picked.filter(x => x !== id);
    else sel.picked = [...sel.picked, id];
    // The first pick is the headline until a star says otherwise; losing the
    // headline promotes the earliest remaining pick.
    if (!sel.picked.includes(sel.headline)) sel.headline = sel.picked[0] ?? null;
    selectionChanged();
  }

  function setHeadline(id) {
    if (!sel.picked.includes(id)) return;
    sel.headline = id;
    selectionChanged();
  }

  function selectionChanged() {
    shelfEl.querySelectorAll('.inv-tile').forEach(syncTile);
    updateBar();
    if (sheetOpen) { syncRows(); ensureNight(); renderPreview(); }
  }

  // ---- mode ----

  function enter() {
    if (selecting) return;
    selecting = true;
    document.body.classList.add('is-selecting');
    planBtn.setAttribute('aria-pressed', 'true');
    decorate();
    bar.hidden = false;
    updateBar();
  }

  // Leaving select mode clears the picks and the night: the state is in
  // memory only.
  function exit() {
    if (!selecting) return;
    selecting = false;
    sel.picked = [];
    sel.headline = null;
    night = emptyNight();
    when.date = ''; when.time = '';
    venue = '';
    undecorate();
    document.body.classList.remove('is-selecting');
    bar.hidden = true;
    planBtn.setAttribute('aria-pressed', 'false');
    planBtn.focus();
  }

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !selecting) return;
    // An open overlay (this sheet, the filter sheet, the detail modal) owns
    // Escape; select mode only takes it when nothing is on top.
    if (sheetOpen || document.body.classList.contains('scroll-locked')) return;
    exit();
  });

  // ---- sheet ----
  // docs/mockups/invite-sheet-mobile.html: preview first and never cropped,
  // a segmented format control under it, settings as tappable rows, one
  // gold primary action. The scrim and panel are the filter sheet's.

  const scrim = document.createElement('div');
  scrim.className = 'sheet-scrim invite-scrim';
  scrim.id = 'inviteScrim';
  const sheet = document.createElement('div');
  sheet.className = 'filter-sheet invite-sheet';
  sheet.id = 'inviteSheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-labelledby', 'inviteSheetTitle');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="invite-head">
      <h2 id="inviteSheetTitle">Invite</h2>
      <button class="invite-icon" id="inviteClose" type="button" aria-label="Close">${icon('x')}</button>
    </div>
    <div class="sheet-body invite-body">
      <div class="invite-previewwrap">
        <div class="invite-preview" id="invitePreview">
          <div class="invite-preview__canvas" id="inviteCanvasHolder"></div>
          <div class="invite-spinner" id="inviteSpinner" role="status" hidden><i aria-hidden="true"></i>Creating the night…</div>
        </div>
      </div>
      <div class="invite-seg" role="group" aria-label="Format">
        <button type="button" data-format="story" aria-pressed="true">Story</button>
        <button type="button" data-format="square" aria-pressed="false">Square</button>
      </div>
      <div class="invite-rows">
        <button class="invite-row" id="inviteWhenRow" type="button">
          ${icon('calendar')}
          <span class="invite-row__lab"><b>When</b></span>
          <span class="invite-row__val" id="inviteWhenVal"></span>
          ${icon('chevron-right', 'invite-row__chev')}
        </button>
        <input class="invite-native" id="inviteWhenInput" type="datetime-local" step="300" tabindex="-1" aria-hidden="true">
        <button class="invite-row" id="inviteWhereRow" type="button" aria-expanded="false" aria-controls="inviteWhereEdit">
          ${icon('map-pin')}
          <span class="invite-row__lab"><b>Where</b></span>
          <span class="invite-row__val" id="inviteWhereVal"></span>
          ${icon('chevron-right', 'invite-row__chev')}
        </button>
        <div class="invite-edit" id="inviteWhereEdit" hidden>
          <input class="invite-edit__input" id="inviteWhereInput" type="text" maxlength="40" autocomplete="off" placeholder="e.g. Nok's" aria-label="Place">
          <button class="invite-edit__done" id="inviteWhereDone" type="button">Done</button>
        </div>
        <button class="invite-row" id="inviteGamesRow" type="button" aria-expanded="false" aria-controls="invitePicker">
          ${icon('star')}
          <span class="invite-row__lab"><b>Headline and games</b></span>
          <span class="invite-thumbs" id="inviteThumbs" aria-hidden="true"></span>
          ${icon('chevron-right', 'invite-row__chev')}
        </button>
        <div class="invite-picker" id="invitePicker" role="group" aria-label="Pick the headline" hidden></div>
        <button class="invite-row" id="inviteLinkRow" type="button">
          ${icon('link')}
          <span class="invite-row__lab"><b>Link</b></span>
          <span class="invite-row__val" id="inviteLinkVal" aria-live="polite"></span>
          ${icon('copy', 'invite-row__chev')}
        </button>
      </div>
    </div>
    <div class="invite-actions">
      <button class="invite-primary" id="inviteShareBtn" type="button">${icon('share')}Share invite</button>
      <button class="invite-secondary" id="inviteSaveBtn" type="button">Save as PNG</button>
    </div>
  `;
  document.body.append(scrim, sheet);

  const $ = id => sheet.querySelector('#' + id);
  const holder = $('inviteCanvasHolder');
  const spinnerEl = $('inviteSpinner');
  const formatBtns = [...sheet.querySelectorAll('[data-format]')];
  const whenInput = $('inviteWhenInput');
  const whereEdit = $('inviteWhereEdit');
  const whereInput = $('inviteWhereInput');
  const picker = $('invitePicker');

  let format = 'story';
  // What the host has decided, in memory only like the picks. Unset means
  // that line is simply not on the poster.
  const when = { date: '', time: '' };
  let venue = '';
  let sheetOpen = false;
  let sheetLastFocused = null;
  let currentCanvas = null;
  let currentBlob = null;   // the PNG of currentCanvas, made ahead of Share
  let renderSeq = 0;

  formatBtns.forEach(btn => btn.addEventListener('click', () => {
    format = btn.dataset.format;
    formatBtns.forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
    renderPreview();
  }));

  $('inviteClose').addEventListener('click', closeSheet);
  scrim.addEventListener('click', closeSheet);
  $('inviteShareBtn').addEventListener('click', share);
  $('inviteSaveBtn').addEventListener('click', savePng);

  // When: the row opens the native date and time picker; the input itself is
  // never shown. Clearing in the picker takes the line off the poster.
  $('inviteWhenRow').addEventListener('click', () => {
    try { whenInput.showPicker(); } catch { whenInput.focus(); whenInput.click(); }
  });
  whenInput.addEventListener('change', () => {
    const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(whenInput.value || '');
    when.date = m ? m[1] : '';
    when.time = m ? m[2] : '';
    syncRows();
    renderPreview();
  });

  // Where: a text field folds out under the row; Done, Enter or leaving it commits.
  function openWhere() {
    whereEdit.hidden = false;
    $('inviteWhereRow').setAttribute('aria-expanded', 'true');
    whereInput.value = venue;
    whereInput.focus();
  }
  function commitWhere() {
    venue = whereInput.value.trim();
    whereEdit.hidden = true;
    $('inviteWhereRow').setAttribute('aria-expanded', 'false');
    syncRows();
    renderPreview();
  }
  $('inviteWhereRow').addEventListener('click', () => (whereEdit.hidden ? openWhere() : commitWhere()));
  $('inviteWhereDone').addEventListener('click', () => { commitWhere(); $('inviteWhereRow').focus(); });
  whereInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commitWhere(); $('inviteWhereRow').focus(); }
    if (e.key === 'Escape') { e.stopPropagation(); whereInput.value = venue; commitWhere(); $('inviteWhereRow').focus(); }
  });
  whereInput.addEventListener('blur', () => { if (!whereEdit.hidden) setTimeout(() => { if (!whereEdit.hidden && !whereEdit.contains(document.activeElement)) commitWhere(); }, 0); });

  // Headline and games: the picks as tiles, the shelf's star treatment, so
  // the host can move the headline without leaving the sheet.
  $('inviteGamesRow').addEventListener('click', () => {
    const open = picker.hidden;
    picker.hidden = !open;
    $('inviteGamesRow').setAttribute('aria-expanded', String(open));
    if (open) renderPicker();
  });
  picker.addEventListener('click', (e) => {
    const tile = e.target.closest('[data-headline]');
    if (tile) setHeadline(tile.dataset.headline);
  });
  function renderPicker() {
    const games = sel.picked.map(gameById).filter(Boolean);
    const tiles = [...picker.querySelectorAll('.invite-pick')];
    // Same picks as last time: flip the headline in place so a tile that has
    // keyboard focus keeps it. Anything else rebuilds the grid.
    if (tiles.length && tiles.length === games.length && tiles.every((t, i) => t.dataset.headline === games[i].bggId)) {
      tiles.forEach(t => {
        const head = t.dataset.headline === sel.headline;
        t.classList.toggle('head', head);
        t.setAttribute('aria-pressed', String(head));
      });
      return;
    }
    picker.innerHTML = games.map(g => {
      const head = g.bggId === sel.headline;
      return `<button class="invite-pick${head ? ' head' : ''}" type="button" data-headline="${esc(g.bggId)}" aria-pressed="${head}" aria-label="Make ${esc(g.title)} the headline" style="--c:${esc(g.color || '')}">
        ${g.image ? `<img src="${esc(g.image)}" alt="" loading="lazy">` : ''}
        <span class="invite-pick__star">${STAR_SVG}</span>
        <span class="invite-pick__tag">Headline</span>
        <span class="invite-pick__title">${esc(g.title)}</span>
      </button>`;
    }).join('') || '<p class="invite-picker__empty">Pick games on the shelf first.</p>';
  }

  // Link: copies the night's URL; while there is no code it says why, and a
  // failed creation makes the row the retry.
  const nightUrl = () => (night.code ? `${NIGHT_URL_BASE}${night.code}` : '');
  let copiedTimer = null;
  $('inviteLinkRow').addEventListener('click', async () => {
    if (night.error) { night = emptyNight(); ensureNight(); return; }
    if (!night.code) return;
    try {
      await navigator.clipboard.writeText(nightUrl());
      const val = $('inviteLinkVal');
      val.textContent = 'Copied';
      clearTimeout(copiedTimer);
      copiedTimer = setTimeout(syncRows, 1600);
    } catch {}
  });

  function syncRows() {
    const dateLabel = formatWhen(when.date, when.time);
    setRow('inviteWhenVal', dateLabel, 'Add a date');
    setRow('inviteWhereVal', venue, 'Add a place');
    whenInput.value = when.date ? `${when.date}T${when.time || '19:00'}` : '';

    const thumbs = sel.picked.map(gameById).filter(Boolean).slice(0, 4);
    $('inviteThumbs').innerHTML = thumbs.map(g =>
      `<i class="${g.bggId === sel.headline ? 'h' : ''}" style="--c:${esc(g.color || '')}${g.image ? `;background-image:url(&quot;${esc(g.image)}&quot;)` : ''}"></i>`).join('');
    if (!picker.hidden) renderPicker();

    const linkVal = $('inviteLinkVal');
    if (night.code) { linkVal.textContent = `/n/${night.code}`; linkVal.classList.remove('muted'); }
    else if (night.error) { linkVal.textContent = "Couldn't create the night. Tap to retry"; linkVal.classList.add('muted'); }
    else if (night.pending) { linkVal.textContent = 'Creating…'; linkVal.classList.add('muted'); }
    else { linkVal.textContent = sel.picked.length ? '' : 'Pick a game first'; linkVal.classList.add('muted'); }
  }
  // A row's value, or a muted "Add a …" when the host hasn't set one — in
  // which case that line is simply not on the poster.
  function setRow(valId, value, emptyValue) {
    const val = $(valId);
    val.textContent = value || emptyValue;
    val.classList.toggle('muted', !value);
  }

  function getFocusable() {
    return [...sheet.querySelectorAll('button, input, [tabindex]:not([tabindex="-1"])')]
      .filter(el => !el.disabled && !el.hidden && el.tabIndex >= 0 && el.offsetParent !== null);
  }

  function openSheet() {
    sheetLastFocused = document.activeElement;
    sheetOpen = true;
    scrim.classList.add('open');
    sheet.classList.add('open');
    syncScrollLock();
    syncRows();
    getFocusable()[0]?.focus();
    ensureNight();
    renderPreview();
  }

  function closeSheet() {
    sheetOpen = false;
    if (!whereEdit.hidden) commitWhere();
    picker.hidden = true;
    $('inviteGamesRow').setAttribute('aria-expanded', 'false');
    scrim.classList.remove('open');
    sheet.classList.remove('open');
    syncScrollLock();
    if (sheetLastFocused) sheetLastFocused.focus();
  }

  registerOverlay(() => sheetOpen);

  document.addEventListener('keydown', (e) => {
    if (!sheetOpen || (e.key !== 'Escape' && e.key !== 'Tab')) return;
    if (e.key === 'Escape') { closeSheet(); return; }
    const focusable = getFocusable();
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  // ---- the night ----

  // One night per selection: the key is the ordered picks plus the headline.
  // Reopening the sheet on the same picks reuses the code; a different
  // selection creates a new night.
  function emptyNight() { return { key: null, code: null, pending: false, error: false }; }
  let night = emptyNight();
  const selectionKey = () => `${sel.picked.join(',')}|${sel.headline || ''}`;

  // The host is the signed-in viewer when there is one, else the shelf's owner.
  let hostPromise = null;
  function getHost() {
    hostPromise ||= Promise.resolve(getViewer()).then(viewer => {
      const p = getProfile();
      return (viewer && userDisplayName(viewer)) || p?.display_name || p?.bgg_username || p?.slug || 'the host';
    }).catch(() => getProfile()?.display_name || 'the host');
    return hostPromise;
  }

  async function ensureNight() {
    const key = selectionKey();
    if (night.key === key && (night.code || night.pending)) return;
    if (!sel.picked.length) { night = { ...emptyNight(), key }; syncRows(); return; }
    night = { key, code: null, pending: true, error: false };
    spinnerEl.hidden = false;
    syncRows();
    try {
      const [{ createGameNight }, hostName] = await Promise.all([import('./session.js'), getHost()]);
      const code = await createGameNight({
        hostName, mode: 'manual', revealDeck: true,
        gameIds: sel.picked.slice(), ownerId: getProfile()?.id,
      });
      if (night.key !== key) return; // the selection moved on meanwhile
      // Same key the Game Night flow sets, so /night/:code/host knows the host.
      try { sessionStorage.setItem(`gamenight:${code}:name`, hostName); } catch {}
      night = { key, code, pending: false, error: false };
    } catch (err) {
      if (night.key !== key) return;
      night = { key, code: null, pending: false, error: true };
    }
    spinnerEl.hidden = true;
    syncRows();
    if (sheetOpen) renderPreview();
  }

  // ---- preview ----

  function posterInputs() {
    const headline = sel.headline ? gameById(sel.headline) : null;
    const rest = sel.picked.filter(id => id !== sel.headline).map(gameById).filter(Boolean);
    return { headline, rest };
  }

  async function renderPreview() {
    const seq = ++renderSeq;
    const { headline, rest } = posterInputs();
    const dateLabel = formatWhen(when.date, when.time);
    const canvas = await renderInvitePoster({
      format, headline, rest,
      night: { code: night.code, error: night.error, dateLabel, venue: venue || null },
    });
    if (seq !== renderSeq) return;
    canvas.className = `invite-canvas ${format}`;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label',
      `Invite preview: ${headline ? headline.title : 'no headline yet'}, ${rest.length} other game${rest.length === 1 ? '' : 's'}, ${dateLabel || 'no date yet'}${venue ? ` at ${venue}` : ''}`);
    holder.replaceChildren(canvas);
    currentCanvas = canvas;
    currentBlob = null;
    // Made now rather than on tap so Share can call navigator.share() while
    // the tap's activation is still fresh.
    toPng(canvas).then(blob => { if (seq === renderSeq) currentBlob = blob; }).catch(() => {});
  }

  // ---- share / save ----

  const fileName = () => `game-night-${night.code || 'draft'}-${format}.png`;

  function toPng(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('toBlob failed'))), 'image/png');
    });
  }

  async function currentPng() {
    if (!currentCanvas) return null;
    return currentBlob || toPng(currentCanvas);
  }

  function download(blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  }

  async function share() {
    const blob = await currentPng();
    if (!blob) return;
    const file = new File([blob], fileName(), { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Game night' });
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return; // the host changed their mind
      }
    }
    download(blob);
  }

  async function savePng() {
    const blob = await currentPng();
    if (blob) download(blob);
  }

  return {
    onRender() { if (selecting) decorate(); },
    isSelecting: () => selecting,
  };
}

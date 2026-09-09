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
import { renderInvitePoster } from './invite-poster.js';

// Tabler "star" (outline) and "check", both on currentColor.
const STAR_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z"/></svg>`;
const CHECK_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10"/></svg>`;

// The poster uses faces the shelf does not: Fraunces 300 and 400, Plex Mono
// 400. Loaded here, not in shelf.html's <link>, so a shelf without the flag
// requests exactly the fonts it does today.
const POSTER_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400&family=IBM+Plex+Mono:wght@400&display=swap';

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
    if (sheetOpen) { ensureNight(); renderPreview(); }
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
    <div class="sheet-header">
      <h2 id="inviteSheetTitle">Invite</h2>
      <button class="reset-link" id="inviteClose" type="button">Close</button>
    </div>
    <div class="sheet-body">
      <div class="sheet-group invite-format">
        <span class="filter-label" id="inviteFormatLabel">Format</span>
        <div class="segmented" role="group" aria-labelledby="inviteFormatLabel">
          <button class="pill active" type="button" data-format="story" aria-pressed="true">Story 9:16</button>
          <button class="pill" type="button" data-format="square" aria-pressed="false">Square 1:1</button>
        </div>
      </div>
      <p class="invite-error" id="inviteError" hidden>
        Couldn't create the night.
        <button class="invite-retry" id="inviteRetry" type="button">Try again</button>
      </p>
      <div class="invite-preview" id="invitePreview">
        <div class="invite-preview__canvas" id="inviteCanvasHolder"></div>
        <div class="invite-spinner" id="inviteSpinner" role="status" hidden><i aria-hidden="true"></i>Creating the night…</div>
      </div>
    </div>
    <div class="sheet-footer invite-actions">
      <button class="apply-btn" id="inviteShareBtn" type="button">Share</button>
      <button class="invite-save" id="inviteSaveBtn" type="button">Save PNG</button>
    </div>
  `;
  document.body.append(scrim, sheet);

  const holder = sheet.querySelector('#inviteCanvasHolder');
  const spinnerEl = sheet.querySelector('#inviteSpinner');
  const errorEl = sheet.querySelector('#inviteError');
  const formatBtns = [...sheet.querySelectorAll('[data-format]')];

  let format = 'story';
  let sheetOpen = false;
  let sheetLastFocused = null;
  let currentCanvas = null;
  let currentBlob = null;   // the PNG of currentCanvas, made ahead of Share
  let renderSeq = 0;

  formatBtns.forEach(btn => btn.addEventListener('click', () => {
    format = btn.dataset.format;
    formatBtns.forEach(b => {
      const on = b === btn;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    renderPreview();
  }));

  sheet.querySelector('#inviteClose').addEventListener('click', closeSheet);
  scrim.addEventListener('click', closeSheet);
  sheet.querySelector('#inviteRetry').addEventListener('click', async () => {
    night = emptyNight();
    await ensureNight();
    // The retry link hides itself on success, taking focus with it.
    if (!getFocusable().includes(document.activeElement)) sheet.querySelector('#inviteShareBtn').focus();
  });
  sheet.querySelector('#inviteShareBtn').addEventListener('click', share);
  sheet.querySelector('#inviteSaveBtn').addEventListener('click', savePng);

  function getFocusable() {
    return [...sheet.querySelectorAll('button, [tabindex]:not([tabindex="-1"])')]
      .filter(el => !el.disabled && !el.hidden && el.offsetParent !== null);
  }

  function openSheet() {
    sheetLastFocused = document.activeElement;
    sheetOpen = true;
    scrim.classList.add('open');
    sheet.classList.add('open');
    syncScrollLock();
    getFocusable()[0]?.focus();
    ensureNight();
    renderPreview();
  }

  function closeSheet() {
    sheetOpen = false;
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
    errorEl.hidden = true;
    if (!sel.picked.length) { night = { ...emptyNight(), key }; return; }
    night = { key, code: null, pending: true, error: false };
    spinnerEl.hidden = false;
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
    errorEl.hidden = !night.error;
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
    const host = await getHost();
    const canvas = await renderInvitePoster({
      format, headline, rest, host,
      night: { code: night.code, error: night.error, dateLabel: null },
    });
    if (seq !== renderSeq) return;
    canvas.className = 'invite-canvas';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label',
      `Invite preview: ${headline ? headline.title : 'no headline yet'}, ${rest.length} other game${rest.length === 1 ? '' : 's'}, Date TBC`);
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

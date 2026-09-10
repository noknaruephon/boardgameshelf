// Game night invite poster — the invite sheet, reached from the Game Night
// selection mode. Behind the INVITE_ENABLED kill switch
// on the shelf (?invite=1 reveals it while off); shelf.html calls
// setupInvite() only when the flag is on, so with it off none of this is in
// the DOM.
//
// The picks are the shelf's own Game Night selection (state.selectedIds, in
// selection order). This module adds one thing to that mode's bar: a Share
// button that opens the sheet for the games already selected. The headline
// is the first pick until the host moves it in the sheet's picker.
//
// The sheet is the filter sheet's twin: same scrim and panel classes, same
// scroll lock, same focus trap and Escape handling. The poster itself is
// drawn by js/invite-poster.js.

import { registerOverlay, syncScrollLock } from './scroll-lock.js';
import { renderInvitePoster } from './invite-poster.js';

// Tabler outline icons (3.31), 24px grid, stroke 2, currentColor.
const ICON_PATHS = {
  calendar: '<path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12z"/><path d="M16 3v4"/><path d="M8 3v4"/><path d="M4 11h16"/><path d="M11 15h1"/><path d="M12 15v3"/>',
  'map-pin': '<path d="M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"/><path d="M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0z"/>',
  star: '<path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z"/>',
  'chevron-right': '<path d="M9 6l6 6l-6 6"/>',
  share: '<path d="M6 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/><path d="M18 6m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/><path d="M18 18m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/><path d="M8.7 10.7l6.6 -3.4"/><path d="M8.7 13.3l6.6 3.4"/>',
  x: '<path d="M18 6l-12 12"/><path d="M6 6l12 12"/>',
};
const icon = (name, cls = '') =>
  `<svg class="invite-ti ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name]}</svg>`;
const STAR_SVG = icon('star');

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

// iPhone and iPad (iPadOS reports itself as a Mac with touch). Saving to
// Photos from a web page there goes through the image's press-and-hold
// menu; a download lands in Files instead.
const IS_IOS = typeof navigator !== 'undefined' && (/iP(hone|ad|od)/.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

const esc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * @param {object} ctx
 * @param {HTMLElement} ctx.barEl       the Game Night selection bar (#gnBar)
 * @param {HTMLElement} ctx.beforeEl    the bar's Continue button; Share goes before it
 * @param {() => string[]} ctx.getSelectedIds  the shelf's picks, bggIds in selection order
 * @param {() => object[]} ctx.getGames legacy-shaped games currently loaded
 * @returns {{ onSelection: () => void, reset: () => void }}
 */
export function setupInvite({ barEl, beforeEl, getSelectedIds, getGames }) {
  if (!document.querySelector(`link[href="${POSTER_FONTS_HREF}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = POSTER_FONTS_HREF;
    document.head.appendChild(link);
  }

  const gameById = id => getGames().find(g => g.bggId === id) || null;

  // The host's choice of headline; null means "the first pick". Validated
  // against the current picks every time it is read.
  let headlineId = null;
  const picks = () => getSelectedIds();
  function headlineOf(ids) {
    return ids.includes(headlineId) ? headlineId : (ids[0] ?? null);
  }

  // ---- entry: Share in the selection bar ----

  const shareBtn = document.createElement('button');
  shareBtn.className = 'gn-bar__share';
  shareBtn.id = 'gnBarShare';
  shareBtn.type = 'button';
  shareBtn.setAttribute('aria-label', 'Share invite');
  shareBtn.innerHTML = icon('share');
  shareBtn.disabled = true;
  barEl.classList.add('has-share');
  barEl.insertBefore(shareBtn, beforeEl);
  shareBtn.addEventListener('click', openSheet);

  function onSelection() {
    shareBtn.disabled = picks().length === 0;
    if (sheetOpen) { syncRows(); renderPreview(); }
  }

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
          <div class="invite-skeleton story" id="inviteSkeleton" aria-hidden="true">
            <i class="invite-skeleton__hero"></i>
            <span class="invite-skeleton__text">
              <i class="invite-skeleton__line eyebrow"></i>
              <i class="invite-skeleton__line title"></i>
              <span class="invite-skeleton__strip"><i></i><i></i><i></i></span>
            </span>
          </div>
          <span class="sr-only" id="inviteBusy" role="status"></span>
          <div class="invite-preview__canvas" id="inviteCanvasHolder"></div>
        </div>
      </div>
      <div class="invite-seg" role="group" aria-label="Format">
        <button type="button" data-format="story" aria-pressed="true">Story</button>
        <button type="button" data-format="square" aria-pressed="false">Square</button>
      </div>
      <div class="invite-rows">
        <div class="invite-row-wrap">
          <button class="invite-row" id="inviteWhenRow" type="button" tabindex="-1" aria-hidden="true">
            ${icon('calendar')}
            <span class="invite-row__lab"><b>When</b></span>
            <span class="invite-row__val" id="inviteWhenVal"></span>
            ${icon('chevron-right', 'invite-row__chev')}
          </button>
          <input class="invite-native" id="inviteWhenInput" type="datetime-local" step="300" aria-label="When">
        </div>
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
      </div>
    </div>
    <div class="invite-actions">
      <button class="invite-primary" id="inviteShareBtn" type="button">${icon('share')}Share invite</button>
      <button class="invite-secondary" id="inviteSaveBtn" type="button">${IS_IOS ? 'Save to Photos' : 'Save as PNG'}</button>
    </div>
  `;
  // Save to Photos on iOS: the image full screen, where press-and-hold
  // offers Photos. Sits above the sheet; Done or Escape returns to it.
  const viewer = document.createElement('div');
  viewer.className = 'invite-viewer';
  viewer.id = 'inviteViewer';
  viewer.setAttribute('role', 'dialog');
  viewer.setAttribute('aria-modal', 'true');
  viewer.setAttribute('aria-labelledby', 'inviteViewerHint');
  viewer.hidden = true;
  viewer.innerHTML = `
    <img class="invite-viewer__img" id="inviteViewerImg" alt="Your invite">
    <p class="invite-viewer__hint" id="inviteViewerHint">Press and hold the image, then tap <b>Save to Photos</b></p>
    <button class="invite-viewer__done" id="inviteViewerDone" type="button">Done</button>
  `;
  document.body.append(scrim, sheet, viewer);

  const $ = id => sheet.querySelector('#' + id);
  const holder = $('inviteCanvasHolder');
  const skeleton = $('inviteSkeleton');
  const busy = $('inviteBusy');

  // A poster-shaped placeholder while the fonts and covers arrive: on open
  // and on a format change, when there is no poster of the right shape to
  // show. Other re-renders (a date, a place, the headline) keep the previous
  // poster on screen until the new one is ready.
  function showSkeleton(fmt) {
    holder.replaceChildren();
    currentCanvas = null;
    currentBlob = null;
    skeleton.className = `invite-skeleton ${fmt}`;
    skeleton.hidden = false;
    busy.textContent = 'Drawing the poster…';
  }
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
    if (btn.dataset.format === format) return;
    format = btn.dataset.format;
    formatBtns.forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
    showSkeleton(format);
    renderPreview();
  }));

  $('inviteClose').addEventListener('click', closeSheet);
  scrim.addEventListener('click', closeSheet);
  $('inviteShareBtn').addEventListener('click', share);
  $('inviteSaveBtn').addEventListener('click', savePng);

  // When: the native datetime input lies invisibly over the row, so a tap
  // anywhere on the row is a tap on the input and the browser opens its own
  // picker — no showPicker() needed, which iOS Safari refuses on a hidden
  // input. Desktop browsers only open the calendar from the input's icon,
  // so a mouse click asks for the picker explicitly. Clearing in the picker
  // takes the line off the poster.
  let whenPointer = 'touch';
  whenInput.addEventListener('pointerdown', (e) => { whenPointer = e.pointerType || 'touch'; });
  whenInput.addEventListener('click', () => {
    if (whenPointer !== 'mouse') return;
    try { whenInput.showPicker?.(); } catch {}
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

  // Headline and games: the picks as tiles with a star, so the host can move
  // the headline without leaving the sheet.
  $('inviteGamesRow').addEventListener('click', () => {
    const open = picker.hidden;
    picker.hidden = !open;
    $('inviteGamesRow').setAttribute('aria-expanded', String(open));
    if (open) renderPicker();
  });
  picker.addEventListener('click', (e) => {
    const tile = e.target.closest('[data-headline]');
    if (!tile) return;
    headlineId = tile.dataset.headline;
    syncRows();
    renderPreview();
  });
  function renderPicker() {
    const ids = picks();
    const head = headlineOf(ids);
    const games = ids.map(gameById).filter(Boolean);
    const tiles = [...picker.querySelectorAll('.invite-pick')];
    // Same picks as last time: flip the headline in place so a tile that has
    // keyboard focus keeps it. Anything else rebuilds the grid.
    if (tiles.length && tiles.length === games.length && tiles.every((t, i) => t.dataset.headline === games[i].bggId)) {
      tiles.forEach(t => {
        const on = t.dataset.headline === head;
        t.classList.toggle('head', on);
        t.setAttribute('aria-pressed', String(on));
      });
      return;
    }
    picker.innerHTML = games.map(g => {
      const on = g.bggId === head;
      return `<button class="invite-pick${on ? ' head' : ''}" type="button" data-headline="${esc(g.bggId)}" aria-pressed="${on}" aria-label="Make ${esc(g.title)} the headline" style="--c:${esc(g.color || '')}">
        ${g.image ? `<img src="${esc(g.image)}" alt="" loading="lazy">` : ''}
        <span class="invite-pick__star">${STAR_SVG}</span>
        <span class="invite-pick__tag">Headline</span>
        <span class="invite-pick__title">${esc(g.title)}</span>
      </button>`;
    }).join('') || '<p class="invite-picker__empty">Pick games on the shelf first.</p>';
  }

  function syncRows() {
    const dateLabel = formatWhen(when.date, when.time);
    setRow('inviteWhenVal', dateLabel, 'Add a date');
    setRow('inviteWhereVal', venue, 'Add a place');
    whenInput.value = when.date ? `${when.date}T${when.time || '19:00'}` : '';

    const ids = picks();
    const head = headlineOf(ids);
    const thumbs = ids.map(gameById).filter(Boolean).slice(0, 4);
    $('inviteThumbs').innerHTML = thumbs.map(g =>
      `<i class="${g.bggId === head ? 'h' : ''}" style="--c:${esc(g.color || '')}${g.image ? `;background-image:url(&quot;${esc(g.image)}&quot;)` : ''}"></i>`).join('');
    if (!picker.hidden) renderPicker();
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
    showSkeleton(format);
    getFocusable()[0]?.focus();
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
    if (!sheetOpen || !viewer.hidden || (e.key !== 'Escape' && e.key !== 'Tab')) return;
    if (e.key === 'Escape') { closeSheet(); return; }
    const focusable = getFocusable();
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  // Leaving selection mode clears everything the sheet remembered: the
  // state is in memory only.
  function reset() {
    headlineId = null;
    when.date = ''; when.time = '';
    venue = '';
    if (!viewer.hidden) closeViewer();
    if (sheetOpen) closeSheet();
    shareBtn.disabled = true;
  }

  // ---- preview ----

  function posterInputs() {
    const ids = picks();
    const head = headlineOf(ids);
    const headline = head ? gameById(head) : null;
    const rest = ids.filter(id => id !== head).map(gameById).filter(Boolean);
    return { headline, rest };
  }

  async function renderPreview() {
    const seq = ++renderSeq;
    const { headline, rest } = posterInputs();
    const dateLabel = formatWhen(when.date, when.time);
    const canvas = await renderInvitePoster({
      format, headline, rest,
      details: { dateLabel, venue: venue || null },
    });
    if (seq !== renderSeq) return;
    canvas.className = `invite-canvas ${format}`;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label',
      `Invite preview: ${headline ? headline.title : 'no headline yet'}, ${rest.length} other game${rest.length === 1 ? '' : 's'}, ${dateLabel || 'no date yet'}${venue ? ` at ${venue}` : ''}`);
    holder.replaceChildren(canvas);
    skeleton.hidden = true;
    busy.textContent = '';
    currentCanvas = canvas;
    currentBlob = null;
    // Made now rather than on tap so Share can call navigator.share() while
    // the tap's activation is still fresh.
    toPng(canvas).then(blob => { if (seq === renderSeq) currentBlob = blob; }).catch(() => {});
  }

  // ---- share / save ----

  const fileName = () => `game-night-${format}.png`;

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

  // ---- save to Photos (iOS) ----

  let viewerUrl = null;
  let viewerLastFocused = null;
  function openViewer(blob) {
    if (viewerUrl) URL.revokeObjectURL(viewerUrl);
    viewerUrl = URL.createObjectURL(blob);
    const img = viewer.querySelector('#inviteViewerImg');
    img.src = viewerUrl;
    img.alt = currentCanvas?.getAttribute('aria-label') || 'Your invite';
    viewerLastFocused = document.activeElement;
    viewer.hidden = false;
    viewer.querySelector('#inviteViewerDone').focus();
  }
  function closeViewer() {
    viewer.hidden = true;
    if (viewerLastFocused) viewerLastFocused.focus();
  }
  viewer.querySelector('#inviteViewerDone').addEventListener('click', closeViewer);
  viewer.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); closeViewer(); }
    if (e.key === 'Tab') e.preventDefault(); // one control: focus stays on Done
  });

  async function savePng() {
    const blob = await currentPng();
    if (!blob) return;
    if (IS_IOS) openViewer(blob);
    else download(blob);
  }

  return { onSelection, reset };
}

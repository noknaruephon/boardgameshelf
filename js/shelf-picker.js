import { supabase } from './supabase.js';

// "Shelves you can browse as a guest": the fallback for a signed-in user
// whose own sync is not available yet (BGG approval pending, 202 cap, 5xx,
// unknown username). Lists public shelves from the public_shelves() RPC as
// plain links to /u/<slug>; viewing one is the ordinary guest view.
// Data and mounting: docs/claude-code-browse-shelves-fallback.md.
// Layout: docs/claude-code-shelf-picker-a.md (mockup option A, "Inline list").

/** @returns {Promise<Array<{slug, display_name, bgg_username, game_count, last_synced_at, thumbnails}>>} */
export async function fetchPublicShelves() {
  const { data, error } = await supabase.rpc('public_shelves');
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

/** Compact relative time: "just now", "5m ago", "20h ago", "3d ago"; '' when never. */
export function relativeTime(iso) {
  if (!iso) return '';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  return `${months}mo ago`;
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Styles ship with the module so every page that mounts the picker gets the
// same list without linking another stylesheet. Injected once.
export const PICKER_CSS = `
  .picker{margin-top:28px;padding-top:22px;border-top:1px solid rgba(var(--bgs-gold-rgb),.18);text-align:left;}
  .picker .kicker{font-family:'IBM Plex Mono',monospace;font-size:12px;letter-spacing:.02em;color:var(--bgs-gold-dim);margin:0 0 6px;}
  .picker-list{list-style:none;margin:0;padding:0;}
  .picker-row{display:flex;align-items:center;gap:14px;padding:12px 0;text-decoration:none;color:inherit;border-bottom:1px solid rgba(var(--bgs-ivory-rgb),.08);border-radius:6px;}
  .picker-list li:last-child .picker-row{border-bottom:0;}
  .picker-row:focus-visible{outline:none;box-shadow:0 0 0 2px var(--bgs-bg),0 0 0 4px var(--bgs-gold);}
  .picker .stack{position:relative;width:60px;height:54px;flex:none;}
  .picker .stack img{position:absolute;width:38px;height:38px;object-fit:cover;border-radius:4px;box-shadow:0 4px 10px rgba(0,0,0,.5);background:var(--bgs-plate);}
  .picker .stack img:nth-child(1){left:0;top:14px;transform:rotate(-8deg);}
  .picker .stack img:nth-child(2){left:11px;top:7px;transform:rotate(3deg);}
  .picker .stack img:nth-child(3){left:22px;top:0;transform:rotate(11deg);}
  .picker-text{min-width:0;}
  .picker-text b{display:block;font-weight:600;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .picker-meta{font-size:13px;color:var(--bgs-ivory-45);white-space:nowrap;}
  .picker .chev{margin-left:auto;color:var(--bgs-gold-dim);font-size:18px;}
  .picker-note{font-size:12px;color:var(--bgs-ivory-45);margin:10px 0 0;}
  .picker-empty{font-size:13px;color:var(--bgs-ivory-45);margin:6px 0 0;}
`;
let styled = false;
function ensureStyles() {
  if (styled) return;
  styled = true;
  const style = document.createElement('style');
  style.textContent = PICKER_CSS;
  document.head.appendChild(style);
}

function rowHTML(s) {
  const name = s.display_name || s.bgg_username || s.slug;
  const n = Number(s.game_count) || 0;
  const when = relativeTime(s.last_synced_at);
  const meta = `${n} game${n === 1 ? '' : 's'}${when ? ` · synced ${when}` : ''}`;
  // Up to three covers; a shelf with fewer simply gets a smaller stack.
  const thumbs = (Array.isArray(s.thumbnails) ? s.thumbnails : []).filter(Boolean).slice(0, 3);
  const stack = thumbs.map((url) => `<img src="${esc(url)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">`).join('');
  return `
    <li>
      <a class="picker-row" href="/u/${encodeURIComponent(s.slug)}">
        <span class="stack" aria-hidden="true">${stack}</span>
        <span class="picker-text">
          <b>${esc(name)}</b>
          <span class="picker-meta">${esc(meta)}</span>
        </span>
        <span class="chev" aria-hidden="true">›</span>
      </a>
    </li>`;
}

/**
 * Renders the picker into `container` (replacing its content). Resolves with
 * the number of shelves listed. Throws when the RPC fails, so the caller can
 * hide its button and move on; nothing is rendered in that case.
 *
 * @param {HTMLElement} container
 * @param {object} [opts]
 * @param {boolean} [opts.note]  show the "Your own shelf will be here…" line
 *   (the welcome page); omitted on settings
 * @param {string} [opts.title]  accepted for compatibility, unused
 * @param {string} [opts.lede]   accepted for compatibility, unused
 */
export async function mountShelfPicker(container, { note = false } = {}) {
  ensureStyles();
  const shelves = await fetchPublicShelves();
  container.innerHTML = `
    <div class="picker" id="shelfPicker">
      <p class="kicker">Shelves you can browse as a guest</p>
      ${shelves.length
        ? `<ul class="picker-list" role="list">${shelves.map(rowHTML).join('')}</ul>`
        : '<p class="picker-empty">No public shelves yet.</p>'}
      ${note ? '<p class="picker-note">Your own shelf will be here once BGG lets us sync.</p>' : ''}
    </div>`;
  container.hidden = false;
  return shelves.length;
}

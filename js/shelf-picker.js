import { supabase } from './supabase.js';

// "Browse a shelf that's already stocked": the fallback for a signed-in user
// whose own sync is not available yet (BGG approval pending, 202 cap, 5xx,
// unknown username). Lists public shelves from the public_shelves() RPC as
// plain links to /u/<slug>; viewing one is the ordinary guest view.
// Spec: docs/claude-code-browse-shelves-fallback.md.

const DEFAULT_TITLE = "Browse a shelf that's already stocked";
const DEFAULT_LEDE = "Have a look around while your own sync isn't available. You're viewing as a guest.";

/** @returns {Promise<Array<{slug, display_name, bgg_username, game_count, last_synced_at, thumbnails}>>} */
export async function fetchPublicShelves() {
  const { data, error } = await supabase.rpc('public_shelves');
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

/** "3 days ago" style, or '' when never. */
export function relativeTime(iso) {
  if (!iso) return '';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.round(days / 30);
  return `${months} month${months === 1 ? '' : 's'} ago`;
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Styles ship with the module so every page that mounts the picker gets the
// same rows without linking another stylesheet. Injected once.
let styled = false;
function ensureStyles() {
  if (styled) return;
  styled = true;
  const style = document.createElement('style');
  style.textContent = `
    .shelf-picker{background:var(--bgs-plate);border:1px solid rgba(var(--bgs-gold-rgb),.22);border-radius:16px;padding:20px;margin:16px 0 0;box-shadow:0 12px 30px -18px rgba(0,0,0,.8);text-align:left;}
    .shelf-picker h2{font-family:'Fraunces',serif;font-weight:600;font-size:19px;margin:0 0 6px;color:var(--bgs-ivory);}
    .shelf-picker .sp-lede{font-size:14px;line-height:1.5;color:var(--bgs-ivory-70);margin:0 0 6px;}
    .shelf-picker .sp-note{font-family:'IBM Plex Mono',monospace;font-size:12px;letter-spacing:.02em;color:var(--bgs-gold-dim);margin:0 0 6px;}
    .shelf-picker ul{list-style:none;margin:10px 0 0;padding:0;display:grid;gap:8px;}
    .shelf-picker .sp-row{
      display:flex;align-items:center;gap:14px;padding:10px 12px;border-radius:12px;
      background:rgba(var(--bgs-ivory-rgb),.05);border:1px solid rgba(var(--bgs-ivory-rgb),.1);
      color:var(--bgs-ivory);text-decoration:none;transition:background .15s ease;
    }
    .shelf-picker .sp-row:hover{background:rgba(var(--bgs-gold-rgb),.1);}
    .shelf-picker .sp-row:focus-visible{outline:none;box-shadow:0 0 0 2px var(--bgs-bg),0 0 0 4px var(--bgs-gold);}
    .shelf-picker .sp-stack{position:relative;width:62px;height:54px;flex:none;}
    .shelf-picker .sp-stack span{
      position:absolute;width:38px;height:38px;border-radius:4px;overflow:hidden;
      background:rgba(var(--bgs-ivory-rgb),.08);box-shadow:0 4px 10px rgba(0,0,0,.5);
    }
    .shelf-picker .sp-stack span:nth-child(1){left:0;top:16px;transform:rotate(-8deg);}
    .shelf-picker .sp-stack span:nth-child(2){left:8px;top:10px;transform:rotate(-2deg);}
    .shelf-picker .sp-stack span:nth-child(3){left:16px;top:4px;transform:rotate(4deg);}
    .shelf-picker .sp-stack span:nth-child(4){left:24px;top:0;transform:rotate(11deg);}
    .shelf-picker .sp-stack img{display:block;width:100%;height:100%;object-fit:cover;}
    .shelf-picker .sp-text{min-width:0;display:flex;flex-direction:column;gap:3px;}
    .shelf-picker .sp-text b{font-weight:600;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .shelf-picker .sp-meta{font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--bgs-ivory-70);}
    .shelf-picker .sp-empty{font-size:14px;color:var(--bgs-ivory-45);margin:10px 0 0;}
  `;
  document.head.appendChild(style);
}

function rowHTML(s) {
  const name = s.display_name || s.bgg_username || s.slug;
  const n = Number(s.game_count) || 0;
  const when = relativeTime(s.last_synced_at);
  const meta = `${n} game${n === 1 ? '' : 's'}${when ? ` · synced ${when}` : ''}`;
  const thumbs = Array.isArray(s.thumbnails) ? s.thumbnails.slice(0, 4) : [];
  const stack = Array.from({ length: 4 }, (_, i) => thumbs[i]
    ? `<span><img src="${esc(thumbs[i])}" alt="" loading="lazy" decoding="async" onerror="this.remove()"></span>`
    : '<span></span>').join('');
  return `
    <li>
      <a class="sp-row" href="/u/${encodeURIComponent(s.slug)}">
        <span class="sp-stack" aria-hidden="true">${stack}</span>
        <span class="sp-text"><b>${esc(name)}</b><span class="sp-meta">${esc(meta)}</span></span>
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
 * @param {string} [opts.title]
 * @param {string} [opts.lede]
 * @param {string} [opts.note]  one mono line above the list, e.g. welcome's
 *   "Your own shelf will be here once BGG lets us sync."
 */
export async function mountShelfPicker(container, { title = DEFAULT_TITLE, lede = DEFAULT_LEDE, note = '' } = {}) {
  ensureStyles();
  const shelves = await fetchPublicShelves();
  container.innerHTML = `
    <section class="shelf-picker" aria-label="${esc(title)}">
      <h2>${esc(title)}</h2>
      <p class="sp-lede">${esc(lede)}</p>
      ${note ? `<p class="sp-note">${esc(note)}</p>` : ''}
      ${shelves.length
        ? `<ul>${shelves.map(rowHTML).join('')}</ul>`
        : '<p class="sp-empty">No public shelves yet.</p>'}
    </section>`;
  container.hidden = false;
  return shelves.length;
}

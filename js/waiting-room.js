import { createGameModal } from './game-modal.js';

// The same detail modal the shelf uses, in its read-only form — no deck button,
// since nothing is being picked here. Built on first tap so pages that never
// reveal their deck don't carry it.
let modal = null;

function gameModal() {
  if (!modal) modal = createGameModal();
  return modal;
}

export function openGameModal(game) {
  gameModal().open(game);
}

export function closeGameModal() {
  modal?.close();
}

/** Deck preview: revealed covers (tappable) or hidden card backs (not tappable). */
export function deckHTML(deck, revealDeck) {
  const cards = revealDeck
    ? deck.map((g, i) => `
        <div class="deck-card clickable" data-i="${i}">
          <img src="${g.image}" alt="${g.title} cover" loading="lazy" decoding="async" onerror="this.remove()">
        </div>`).join('')
    : deck.map(() => `<div class="deck-card back">?</div>`).join('');
  const heading = revealDeck
    ? "Tonight's deck — tap a game to read more"
    : `${deck.length} ${deck.length === 1 ? 'game' : 'games'}, hidden`;
  return `
    <div class="deck">
      <h2>${heading}</h2>
      <div class="deck-row">${cards}</div>
    </div>`;
}

/** Delegates clicks on a deck rendered by deckHTML() to open the detail modal. */
export function attachDeckHandlers(container, deck) {
  container.addEventListener('click', (ev) => {
    const card = ev.target.closest('.deck-card.clickable');
    if (!card) return;
    openGameModal(deck[Number(card.dataset.i)]);
  });
}

/** Roster of name chips, rendered from presence — not the participants table. */
export function rosterHTML(players, myName) {
  const n = players.length;
  return `
    <div class="roster">
      <div class="roster-head">
        <span class="pulse"></span>
        <h2>${n} ${n === 1 ? 'person' : 'people'} here</h2>
      </div>
      <div class="names">
        ${players.map((p) => `
          <span class="name-chip${p.name === myName ? ' you' : ''}">
            ${p.name}
            ${p.isHost ? '<span class="tag">host</span>' : (p.name === myName ? '<span class="tag">you</span>' : '')}
          </span>`).join('')}
      </div>
    </div>`;
}

/** The stage's fan shows at most this many cards; the rest become a "+N" chip. */
const FAN_MAX = 10;

/** Card size, corner radius, "?" size and the angle between cards, by deck size. */
function fanMetrics(n) {
  const size = n <= 5 ? { w: 104, h: 146, r: 10, q: 34 }
    : n <= 7 ? { w: 92, h: 130, r: 9, q: 30 }
    : { w: 80, h: 112, r: 8, q: 26 };
  const step = n <= 1 ? 0 : Math.round(Math.min(13, 52 / (n - 1)) * 100) / 100;
  return { ...size, step };
}

/**
 * The stage lobby's deck (night-host.html, docs/claude-code-spec-lobby-stage.md):
 * the cards fanned like a hand under a gold glow. Same card markup as
 * deckHTML() — face-down backs with the "?" glyph, or tappable covers that
 * attachDeckHandlers() opens (`.deck-card.clickable` + data-i) — so an image
 * that fails still falls back to the plate and border. The page's CSS reads
 * --n/--step and the size set from .fan, --i and the z-index from each card:
 * the middle card sits on top and the stack falls off symmetrically.
 */
export function fanHTML(deck, revealDeck) {
  const shown = deck.slice(0, FAN_MAX);
  const n = shown.length;
  const m = fanMetrics(n);
  const cards = shown.map((g, i) => {
    const z = n - Math.abs(2 * i - (n - 1));
    const style = `--i:${i};z-index:${z}`;
    return revealDeck
      ? `<div class="deck-card clickable" data-i="${i}" style="${style}">
          <img src="${g.image}" alt="${g.title} cover" loading="lazy" decoding="async" onerror="this.remove()">
        </div>`
      : `<div class="deck-card back" style="${style}">?</div>`;
  }).join('');
  const more = deck.length > FAN_MAX ? `<span class="fan-more">+${deck.length - FAN_MAX}</span>` : '';
  return `
    <div class="fan-wrap">
      <div class="fan-glow" aria-hidden="true"></div>
      <div class="fan" style="--n:${n};--step:${m.step}deg;--w:${m.w}px;--h:${m.h}px;--r:${m.r}px;--q:${m.q}px">${cards}</div>
      ${more}
    </div>`;
}

/** First grapheme of a name, upper-cased, for the chip avatar. */
function initial(name) {
  const s = String(name ?? '').trim();
  if (!s) return '?';
  // Intl.Segmenter keeps a base letter with its marks (Thai vowels above and
  // below); code points are the fallback where it is missing.
  const first = (typeof Intl !== 'undefined' && Intl.Segmenter)
    ? [...new Intl.Segmenter().segment(s)][0].segment
    : Array.from(s)[0];
  return first.toUpperCase();
}

/**
 * The stage lobby's roster (night-host.html, docs/claude-code-spec-lobby-stage.md):
 * "Here now" with a count, one glass chip per player, and an open chip that
 * pulses "Waiting for players…" until the table can start. Pure; takes the
 * same presence array rosterHTML() does. `canStart` is the page's call
 * (players.length >= MIN_PLAYERS_TO_START) so this module stays free of presence.
 */
export function lobbyRosterHTML(players, myName, canStart) {
  const n = players.length;
  return `
    <div class="here">
      <span class="here__label">Here now</span><span class="here__n">${n}</span>
    </div>
    <div class="here-row">
      ${players.map((p) => `
        <span class="chip glass${p.name === myName ? ' chip--you' : ''}">
          <span class="chip__avatar">${initial(p.name)}</span>${p.name}
          ${p.name === myName ? '<span class="chip__tag">Host</span>' : ''}
        </span>`).join('')}
      <span class="chip chip--open${canStart ? '' : ' is-waiting'}">
        <span class="pulse"></span>${canStart ? 'Room for more' : 'Waiting for players…'}
      </span>
    </div>`;
}

/**
 * The waiting animation: three face-down cards being shuffled.
 *
 * Used on every game-night screen that has to hold the table for a moment —
 * waiting for the host to start, waiting for the others to finish voting, and
 * tallying. Face-down on all of them, so the one that must not leak a result
 * cannot. Styled by `.shuffle` in css/base.css.
 */
export function shuffleHTML() {
  return `
    <div class="shuffle-wrap">
      <div class="shuffle" aria-hidden="true">
        <div class="deck-card back">?</div>
        <div class="deck-card back">?</div>
        <div class="deck-card back">?</div>
      </div>
    </div>`;
}

/** Builds the ordered deck of full game objects from a session's stored game_ids. */
export function deckFromSession(session, games) {
  const byId = new Map(games.map((g) => [g.bggId, g]));
  return session.game_ids.map((id) => byId.get(id)).filter(Boolean);
}

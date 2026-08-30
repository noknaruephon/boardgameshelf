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

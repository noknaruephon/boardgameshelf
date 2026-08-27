import { timeLabel, weightLabel, playersRangeLabel } from './filters.js';

// A minimal detail modal, not the shelf's — that one is wired into index.html's own
// selection-mode state and DOM ids, too entangled to share from a standalone page.
const MODAL_ID = 'wr-modal';

function ensureModal() {
  if (document.getElementById(MODAL_ID)) return;
  document.body.insertAdjacentHTML('beforeend', `
    <div class="wr-modal" id="${MODAL_ID}">
      <div class="wr-modal__panel">
        <div class="wr-modal__scroll">
          <div class="wr-modal__cover" id="wrModalCover"></div>
          <h3 id="wrModalTitle"></h3>
          <div class="wr-modal__meta" id="wrModalMeta"></div>
          <p id="wrModalDesc"></p>
        </div>
        <div class="wr-modal__close-row">
          <button class="wr-modal__close" id="wrModalClose" type="button">Close</button>
        </div>
      </div>
    </div>
  `);
  document.getElementById('wrModalClose').addEventListener('click', closeGameModal);
  document.getElementById(MODAL_ID).addEventListener('click', (ev) => {
    if (ev.target.id === MODAL_ID) closeGameModal();
  });
}

export function openGameModal(game) {
  ensureModal();
  document.getElementById('wrModalCover').innerHTML =
    `<img src="${game.image}" alt="${game.title} cover" loading="lazy" decoding="async" onerror="this.remove()">`;
  document.getElementById('wrModalTitle').textContent = game.title;
  document.getElementById('wrModalMeta').innerHTML = `
    <span>👥 ${playersRangeLabel(game.players)}</span>
    <span>⏱ ${timeLabel(game.time)}</span>
    <span>⚖️ ${weightLabel(game.weightScore)}</span>`;
  document.getElementById('wrModalDesc').textContent = game.blurb;
  document.getElementById(MODAL_ID).classList.add('open');
}

export function closeGameModal() {
  document.getElementById(MODAL_ID)?.classList.remove('open');
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

/** Builds the ordered deck of full game objects from a session's stored game_ids. */
export function deckFromSession(session, games) {
  const byId = new Map(games.map((g) => [g.bggId, g]));
  return session.game_ids.map((id) => byId.get(id)).filter(Boolean);
}

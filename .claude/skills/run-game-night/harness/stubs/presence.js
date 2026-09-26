// Stub of js/presence.js: same callbacks and controller as the real channel,
// driven from the test instead of Supabase.
//   window.__pushPlayers(['Nok','Mai'])  or  ([{ name, isHost, finished }])  → onPresence
//   window.__pushStatus('voting')                                          → onStatus
//   window.__pushSession({ status, round, game_ids })                      → onSession + onStatus
//   window.__tvPresent / __tvRevealedRound feed the TV fields of onPresence.
// The controller records markFinished/markRematchRequested/markRevealed on window.
export const MIN_PLAYERS_TO_START = 2;
export function joinSessionChannel({ participantName, isHost, finished = false, onPresence, onStatus, onSession }) {
  const self = { name: participantName, isHost, joinedAt: new Date().toISOString(), finished };
  const emit = (players) => onPresence({
    players, count: players.length,
    tvPresent: !!window.__tvPresent, tvRevealedRound: window.__tvRevealedRound || 0,
  });
  window.__pushPlayers = (list) => emit(list.map((p, i) => (typeof p === 'string' ? { name: p, isHost: i === 0, finished: false } : p)));
  window.__pushStatus = (s) => onStatus?.(s);
  window.__pushSession = (row) => { onSession?.(row); if (row.status) onStatus?.(row.status); };
  setTimeout(() => emit([self]), 0);
  return {
    leave() { window.__left = true; },
    async markFinished() { window.__markedFinished = true; },
    async markRematchRequested() { window.__rematchRequested = true; },
    async markRevealed(r) { window.__revealed = r; },
  };
}

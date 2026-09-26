// Stub of js/presence.js: the review pushes players through window.__pushPlayers.
export const MIN_PLAYERS_TO_START = 2;
export function joinSessionChannel({ participantName, onPresence, onStatus }) {
  window.__pushPlayers = (players) => onPresence({ players });
  window.__pushStatus = (s) => onStatus(s);
  setTimeout(() => onPresence({ players: [{ name: participantName, isHost: true }] }), 0);
  return { leave() { window.__left = true; } };
}

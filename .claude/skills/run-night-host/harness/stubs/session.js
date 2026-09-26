// Stub of js/session.js for the lobby review. Fixture from the page URL.
const q = new URLSearchParams(location.search);
const d = Number(q.get('d') || 5);
export async function fetchSession(code) {
  return {
    code, status: 'waiting',
    mode: q.get('mode') === 'random' ? 'random' : 'picked',
    reveal_deck: q.get('reveal') === '1',
    game_ids: Array.from({ length: d }, (_, i) => 1000 + i),
    host_name: 'Nok', owner_id: 'owner-1', bag_id: null,
  };
}
export async function joinGameNight(code, name) { return name; }
export async function startVoting(code) { window.__started = (window.__started || 0) + 1; }
export async function cancelGameNight(code) { window.__cancelled = true; }
export function sessionErrorMessage() { return ''; }

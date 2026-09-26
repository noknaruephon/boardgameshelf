// Stub of js/session.js for the game-night harness. Fixture from the page URL:
//   ?status=waiting|voting|done|cancelled   ?d=5 deck size   ?round=1
//   ?reveal=1  ?mode=random  ?players=Nok,Mai  (participants; first is the host)
//   ?myvotes=N   this device already voted on the first N games (swipe resume)
//   ?votes=win|tie|nobody|partial   everyone's votes for the results page
// Writes: window.__started, __cancelled, __votes[], __finished[], __forced, __rematch.
const q = new URLSearchParams(location.search);
const d = Number(q.get('d') || 5);
const round = Number(q.get('round') || 1);
const ids = Array.from({ length: d }, (_, i) => 1000 + i);
const players = (q.get('players') || 'Nok,Mai').split(',').filter(Boolean);

export async function fetchSession(code) {
  return {
    code, status: q.get('status') || 'waiting', round,
    mode: q.get('mode') === 'random' ? 'random' : 'picked',
    reveal_deck: q.get('reveal') === '1',
    game_ids: ids, host_name: players[0], owner_id: 'owner-1', bag_id: null,
  };
}
export async function joinGameNight(code, name) { return name; }
export async function startVoting() { window.__started = (window.__started || 0) + 1; }
export async function cancelGameNight() { window.__cancelled = true; }
export async function submitVote(code, name, gameId, vote) { (window.__votes ||= []).push({ name, gameId, vote }); }
export async function finishVoting(code, name) { (window.__finished ||= []).push(name); }
export async function forceResults() { window.__forced = true; }
export async function fetchVotes(code, name, r) {
  const n = Number(q.get('myvotes') || 0);
  return ids.slice(0, n).map((id) => ({ game_id: id, vote: 'play' }));
}
export async function fetchSessionVotes(code, r) {
  const kind = q.get('votes') || 'win';
  const rows = [];
  const vote = (name, id, v) => rows.push({ participant_name: name, game_id: id, vote: v });
  players.forEach((name, pi) => {
    if (kind === 'partial' && pi === players.length - 1) return; // cut off by "Show results now"
    ids.forEach((id, gi) => {
      let v = 'pass';
      if (kind === 'win') v = gi === 0 || (gi === 1 && pi % 2 === 0) ? 'play' : 'pass';
      else if (kind === 'tie') v = gi < 2 ? 'play' : 'pass';
      else if (kind === 'partial') v = gi === 0 ? 'play' : 'pass';
      vote(name, id, v);
    });
  });
  return rows;
}
export async function fetchParticipants() { return players; }
export async function startRematch(code, name, gameIds) { window.__rematch = gameIds; }
export function sessionErrorMessage() { return ''; }

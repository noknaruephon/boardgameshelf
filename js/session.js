import { supabase } from './supabase.js';

/**
 * Creates a game night and returns its session code, e.g. "FOX7".
 *
 * Rules that would live in API routes are database functions instead — there is
 * no application server — so this is a single `.rpc()` call.
 *
 * @param {object}   opts
 * @param {string}   opts.hostName   the host's display name; they vote too
 * @param {string}   opts.mode       'manual' (host picked) or 'random' (surprise)
 * @param {boolean}  opts.revealDeck whether the games show in the waiting room
 * @param {string[]} opts.gameIds    bggId values from games.json, as strings
 * @returns {Promise<string>} the session code
 */
export async function createGameNight({ hostName, mode, revealDeck, gameIds }) {
  const { data, error } = await supabase.rpc('create_game_night', {
    p_host_name: hostName,
    p_mode: mode,
    p_reveal_deck: revealDeck,
    p_game_ids: gameIds,
  });
  if (error) throw error;
  return data;
}

/**
 * Joins a game night as a participant.
 * @returns {Promise<string>} the final, disambiguated name — may differ from `name`
 */
export async function joinGameNight(code, name) {
  const { data, error } = await supabase.rpc('join_game_night', {
    p_code: code, p_name: name,
  });
  if (error) throw error;
  return data;
}

/** Moves a session from waiting to voting. Every device navigates on the realtime change. */
export async function startVoting(code) {
  const { error } = await supabase.rpc('start_voting', { p_code: code });
  if (error) throw error;
}

/** Ends a session before voting starts. */
export async function cancelGameNight(code) {
  const { error } = await supabase.rpc('cancel_game_night', { p_code: code });
  if (error) throw error;
}

/** @returns {Promise<object|null>} the session row, or null when missing or expired */
export async function fetchSession(code) {
  const { data, error } = await supabase
    .from('sessions')
    .select('code, host_name, mode, reveal_deck, game_ids, status, round')
    .eq('code', code)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Casts one vote. Locks on swipe — the composite primary key on `votes` makes this idempotent. */
export async function submitVote(code, name, gameId, vote) {
  const { error } = await supabase.rpc('submit_vote', {
    p_code: code, p_name: name, p_game_id: gameId, p_vote: vote,
  });
  if (error) throw error;
}

/** Marks this participant done. Flips the session to `done` if they were the last. */
export async function finishVoting(code, name) {
  const { error } = await supabase.rpc('finish_voting', {
    p_code: code, p_name: name,
  });
  if (error) throw error;
}

/**
 * Host escape hatch: moves the table on without waiting for everyone.
 * Passes `name` so the database can check it against the session's host —
 * this architecture has no server-side auth, so that's the only identity
 * available to enforce NOT_HOST with.
 */
export async function forceResults(code, name) {
  const { error } = await supabase.rpc('force_results', {
    p_code: code, p_name: name,
  });
  if (error) throw error;
}

/**
 * This participant's votes in one round.
 *
 * `round` is not optional by accident: votes from earlier rounds stay on disk
 * so a rematch can't destroy the first result, which means an unfiltered read
 * would see round 1's votes for the tied games and conclude this player has
 * already finished the rematch before they have swiped anything.
 *
 * @returns {Promise<Array<{game_id: string, vote: string}>>}
 */
export async function fetchVotes(code, name, round) {
  const { data, error } = await supabase
    .from('votes')
    .select('game_id, vote')
    .eq('session_code', code)
    .eq('participant_name', name)
    .eq('round', round);
  if (error) throw error;
  return data;
}

/**
 * Every participant's votes in one round — what the results screen tallies.
 * @returns {Promise<Array<{participant_name: string, game_id: string, vote: string}>>}
 */
export async function fetchSessionVotes(code, round) {
  const { data, error } = await supabase
    .from('votes')
    .select('participant_name, game_id, vote')
    .eq('session_code', code)
    .eq('round', round);
  if (error) throw error;
  return data;
}

/**
 * Everyone who joined this game night, from the durable record rather than
 * presence. The results screen counts votes out of this: presence only knows
 * who still has a tab open, so someone who voted and then closed theirs would
 * silently shrink the denominator and turn an honest "2 of 4" into "2 of 3".
 *
 * @returns {Promise<string[]>} participant names, in join order
 */
export async function fetchParticipants(code) {
  const { data, error } = await supabase
    .from('participants')
    .select('name, joined_at')
    .eq('session_code', code)
    .order('joined_at', { ascending: true });
  if (error) throw error;
  return data.map((p) => p.name);
}

/**
 * Host only, tie only: starts another round on just the tied games.
 * The database bumps the round, narrows the deck and flips the status back to
 * `voting` in one transaction — every device navigates on that status change,
 * so nothing here redirects.
 */
export async function startRematch(code, name, gameIds) {
  const { error } = await supabase.rpc('start_rematch', {
    p_code: code, p_name: name, p_game_ids: gameIds,
  });
  if (error) throw error;
}

// The database raises named errors as part of the Postgres exception message.
// Never surface those raw — turn them into sentences instead.
const ERROR_COPY = {
  SESSION_NOT_FOUND: () => 'That game night has ended, or the code is wrong.',
  SESSION_CANCELLED: (hostName) => `${hostName || 'The host'} ended this game night.`,
  VOTING_IN_PROGRESS: () => "Voting's already started — you'll catch the next round.",
  NOT_ENOUGH_PLAYERS: () => 'Need at least 2 players to start.',
  NOT_VOTING: () => "Voting's already finished for this game night.",
  NOT_TIED: () => 'This game night has already moved on.',
};

/**
 * Turns a thrown Supabase RPC error into user-facing copy.
 * @returns {string|null} null for ALREADY_STARTED and NOT_HOST — ignore both
 *   silently: another device got there first, or only the host's own UI shows
 *   the button that could raise NOT_HOST in the first place
 */
export function sessionErrorMessage(error, hostName) {
  const message = error?.message || '';
  if (message.includes('ALREADY_STARTED')) return null;
  if (message.includes('NOT_HOST')) return null;
  for (const [token, copy] of Object.entries(ERROR_COPY)) {
    if (message.includes(token)) return copy(hostName);
  }
  return "Something went wrong. Please try again.";
}

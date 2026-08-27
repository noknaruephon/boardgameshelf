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
    .select('code, host_name, mode, reveal_deck, game_ids, status')
    .eq('code', code)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// The database raises named errors as part of the Postgres exception message.
// Never surface those raw — turn them into sentences instead.
const ERROR_COPY = {
  SESSION_NOT_FOUND: () => 'That game night has ended, or the code is wrong.',
  SESSION_CANCELLED: (hostName) => `${hostName || 'The host'} ended this game night.`,
  VOTING_IN_PROGRESS: () => "Voting's already started — you'll catch the next round.",
  NOT_ENOUGH_PLAYERS: () => 'Need at least 2 players to start.',
};

/**
 * Turns a thrown Supabase RPC error into user-facing copy.
 * @returns {string|null} null for ALREADY_STARTED — ignore it silently, another
 *   device got there first
 */
export function sessionErrorMessage(error, hostName) {
  const message = error?.message || '';
  if (message.includes('ALREADY_STARTED')) return null;
  for (const [token, copy] of Object.entries(ERROR_COPY)) {
    if (message.includes(token)) return copy(hostName);
  }
  return "Something went wrong. Please try again.";
}

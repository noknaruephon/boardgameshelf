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

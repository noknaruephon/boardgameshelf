import { supabase } from './supabase.js';

export const MIN_PLAYERS_TO_START = 2;

/**
 * Joins the session channel and reports changes via callbacks.
 * Returns a controller with leave().
 */
export function joinSessionChannel({
  code, participantName, isHost, finished = false, onPresence, onStatus,
}) {
  const channel = supabase.channel(`session:${code}`, {
    config: { presence: { key: participantName } },
  });

  // Mutable so markFinished() below can re-track with an updated flag without
  // clobbering the rest of the meta (isHost, joinedAt).
  let meta = { name: participantName, isHost, joinedAt: new Date().toISOString(), finished };

  function sync() {
    const state = channel.presenceState();

    // presenceState() returns { [key]: metas[] }. One participant can briefly hold
    // more than one meta — a phone reconnecting before the old socket times out.
    // Collapse to one entry per key, or the count double-reports the same human
    // and the two-player gate unlocks with one person in the room.
    const players = Object.values(state)
      .map((metas) => metas[0])
      .filter(Boolean)
      .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));

    onPresence({ players, count: players.length });
  }

  channel
    .on('presence', { event: 'sync' }, sync)
    .on('presence', { event: 'join' }, sync)
    .on('presence', { event: 'leave' }, sync)
    // Status lives in the database, not presence: it must survive a refresh and be
    // identical on every device. This row change is what moves the whole table from
    // waiting to voting at the same instant.
    .on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'sessions',
      filter: `code=eq.${code}`,
    }, (payload) => {
      if (payload.new?.status) onStatus(payload.new.status);
    })
    .subscribe(async (status) => {
      if (status !== 'SUBSCRIBED') return;

      // track() MUST run after SUBSCRIBED. Called earlier it fails silently: the
      // person looks connected on their own screen but is invisible to everyone
      // else. This is the single most common way this breaks.
      await channel.track(meta);
    });

  return {
    leave() {
      // untrack() before removeChannel() so other devices see the drop promptly
      // rather than waiting out the server-side presence timeout.
      channel.untrack().catch(() => {});
      supabase.removeChannel(channel);
    },
    // Updates this participant's presence meta to finished, so every other
    // device's roster flips their row live — no database round trip. Safe to
    // call more than once.
    async markFinished() {
      meta = { ...meta, finished: true };
      await channel.track(meta);
    },
    // Asks the host for a rematch. Deliberately presence and not a table: a
    // request is a nudge that stops mattering the moment the host acts, so it
    // should not outlive the tab that made it.
    async markRematchRequested() {
      meta = { ...meta, rematchRequested: true };
      await channel.track(meta);
    },
  };
}

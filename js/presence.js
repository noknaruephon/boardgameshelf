import { supabase } from './supabase.js';

export const MIN_PLAYERS_TO_START = 2;

/**
 * Joins the session channel and reports changes via callbacks.
 * Returns a controller with leave().
 */
export function joinSessionChannel({
  code, participantName, isHost, onPresence, onStatus,
}) {
  const channel = supabase.channel(`session:${code}`, {
    config: { presence: { key: participantName } },
  });

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
      await channel.track({
        name: participantName,
        isHost,
        joinedAt: new Date().toISOString(),
      });
    });

  return {
    leave() {
      // untrack() before removeChannel() so other devices see the drop promptly
      // rather than waiting out the server-side presence timeout.
      channel.untrack().catch(() => {});
      supabase.removeChannel(channel);
    },
  };
}

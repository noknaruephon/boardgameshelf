import { supabase } from './supabase.js';

export const MIN_PLAYERS_TO_START = 2;

/**
 * Joins the session channel and reports changes via callbacks.
 * Returns a controller with leave().
 *
 * `tv: true` joins as a screen rather than a person (docs/claude-code-spec-tv-mode.md):
 * the TV is tracked so the phones know it is there, but it is filtered out of
 * `players` and never counts. `onSession(row)` hands over the whole changed
 * sessions row, for a caller that needs more than the status (the TV follows
 * `round` and `game_ids` through a rematch).
 */
export function joinSessionChannel({
  code, participantName, isHost, finished = false, tv = false,
  onPresence, onStatus, onSession,
}) {
  const channel = supabase.channel(`session:${code}`, {
    config: { presence: { key: participantName } },
  });

  // Mutable so markFinished() below can re-track with an updated flag without
  // clobbering the rest of the meta (isHost, joinedAt).
  let meta = { name: participantName, isHost, joinedAt: new Date().toISOString(), finished, tv };

  function sync() {
    const state = channel.presenceState();

    // presenceState() returns { [key]: metas[] }. One participant can briefly hold
    // more than one meta — a phone reconnecting before the old socket times out.
    // Collapse to one entry per key, or the count double-reports the same human
    // and the two-player gate unlocks with one person in the room.
    const all = Object.values(state)
      .map((metas) => metas[0])
      .filter(Boolean);

    // A TV is a screen, not a person: it never counts toward the two-player
    // gate, the "N here" line, the finished count or the results roster.
    const players = all
      .filter((m) => !m.tv)
      .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
    const tvs = all.filter((m) => m.tv);

    onPresence({
      players,
      count: players.length,
      tvPresent: tvs.length > 0,
      // The highest round any TV has finished revealing; phones on their
      // look-up card wait for this before landing on the results.
      tvRevealedRound: Math.max(0, ...tvs.map((m) => m.revealedRound || 0)),
    });
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
      if (!payload.new) return;
      // The row first, so a caller using both sees the fresh round and deck
      // by the time the status fires.
      onSession?.(payload.new);
      if (payload.new.status) onStatus?.(payload.new.status);
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
    // TV only: the screen has landed on this round's result, so the phones
    // holding a "Look up" card can move on to the results page.
    async markRevealed(round) {
      meta = { ...meta, revealedRound: round };
      await channel.track(meta);
    },
  };
}

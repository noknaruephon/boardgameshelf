// What a set of games covers: which player counts, and how long they run.
// Shared by the packing bar (js/bag-ui.js) and the bag page header (shelf.html),
// so the two can never disagree about a cell.
//
// Field names are the shelf's own (games.json → shelf-data.js): `players: [min, max]`,
// `time: [min, max]`.

/**
 * @param {Array<object>} games
 * @returns {{cells: boolean[], minTime: number|null, maxTime: number|null, gaps: string[]}}
 *   cells[i] is true when some game plays at i+1 players; the 8th cell stands
 *   for "8 or more", so a 12-player party game lights it.
 */
export function coverage(games) {
  const covers = n => games.some(g => g.players[0] <= n && (n >= 8 ? g.players[1] >= 8 : g.players[1] >= n));
  const cells = [1, 2, 3, 4, 5, 6, 7, 8].map(covers);
  const minTime = games.length ? Math.min(...games.map(g => g.time[0])) : null;
  const maxTime = games.length ? Math.max(...games.map(g => g.time[1])) : null;
  // Gaps only mean something once something is packed: an empty bag is not
  // "missing" anything yet.
  const gaps = [];
  if (games.length) {
    if (!cells[1]) gaps.push('Nothing for 2 players');
    if (!cells[4]) gaps.push('Nothing for 5 players');
    if (!games.some(g => g.time[1] <= 30)) gaps.push('Nothing under 30 min');
  }
  return { cells, minTime, maxTime, gaps };
}

/** "2–6 players", "8+ players", or "" when nothing is covered. */
export function coveredPlayersLabel(cells) {
  const on = cells.map((covered, i) => (covered ? i + 1 : 0)).filter(Boolean);
  if (!on.length) return '';
  const lowest = on[0];
  const highest = on[on.length - 1];
  const top = highest === 8 ? '8+' : String(highest);
  return lowest === highest ? `${top} players` : `${lowest}–${top} players`;
}

/** "40–180 min", "30 min", or "—" for an empty set. */
export function timeLabel(minTime, maxTime) {
  if (minTime === null) return '—';
  return minTime === maxTime ? `${minTime} min` : `${minTime}–${maxTime} min`;
}

/** The eight player cells as markup; `small` is the 18px bag-page size. */
export function cellsHTML(cells, { small = false } = {}) {
  return [1, 2, 3, 4, 5, 6, 7, 8]
    .map((n, i) => `<span class="bag-dot${small ? ' bag-dot--small' : ''}${cells[i] ? ' on' : ''}" data-n="${n}">${n === 8 ? '8+' : n}</span>`)
    .join('');
}

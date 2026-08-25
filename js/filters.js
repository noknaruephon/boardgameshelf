export const DEFAULT_FILTERS = { minPlayers:1, maxPlayers:11, time:"any", weight:"any", bestFit:false };

export function isFilterActive(filters){
  return filters.minPlayers !== 1 || filters.maxPlayers !== 11 || filters.time !== "any" || filters.weight !== "any" || filters.bestFit;
}
export function activeGroupCount(filters){
  let n = 0;
  if(filters.minPlayers !== 1 || filters.maxPlayers !== 11) n++;
  if(filters.time !== "any") n++;
  if(filters.weight !== "any") n++;
  if(filters.bestFit) n++;
  return n;
}
export function playersLabel(filters){
  const { minPlayers:min, maxPlayers:max } = filters;
  if(min===1 && max===11) return "Any";
  if(max===11) return `${min}+`;
  if(min===max) return `${min}`;
  return `${min}–${max}`;
}
export function timeBucket(t){
  const avg = (t[0]+t[1])/2;
  if(avg < 30) return "quick";
  if(avg <= 60) return "medium";
  return "long";
}
export function playersMatch(g, filters){
  return filters.maxPlayers === 11
    ? g.players[1] >= filters.minPlayers
    : g.players[0] <= filters.maxPlayers && g.players[1] >= filters.minPlayers;
}
export function bestFitMatch(g, filters){
  if(!filters.bestFit) return true;
  const rec = g.playerRecommendations;
  if(!rec) return false;
  // "11" on the slider stands for "11+"; cap the check at what the game actually supports
  const upper = filters.maxPlayers === 11 ? Math.min(11, g.players[1]) : filters.maxPlayers;
  for(let n = filters.minPlayers; n <= upper; n++){
    const label = rec[String(n)];
    if(label !== "best" && label !== "recommended") return false;
  }
  return true;
}
export function applyFilters(list, filters, search){
  return list.filter(g=>{
    if(!playersMatch(g, filters)) return false;
    if(!bestFitMatch(g, filters)) return false;
    if(filters.time!=="any" && timeBucket(g.time)!==filters.time) return false;
    if(filters.weight!=="any" && g.weight!==filters.weight) return false;
    if(search && !g.title.toLowerCase().includes(search)) return false;
    return true;
  });
}
export function weightLabel(score){
  return `${score.toFixed(1)} / 5`;
}
export function timeLabel(t){
  return t[0]===t[1] ? `${t[0]}m` : `${t[0]}–${t[1]}m`;
}
export function playersRangeLabel(players){
  return players[0]===players[1] ? `${players[0]}` : `${players[0]}–${players[1]}`;
}

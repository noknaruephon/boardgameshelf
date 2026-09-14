import { VIBES } from './vibes.js';
import { t } from './i18n.js';

// showExpansions: expansions (subtype = boardgameexpansion) are hidden unless
// the shelf owner turned "Show expansions" on in Settings. It is carried here
// so applyFilters can see it, but it is not a filter the viewer set, so it
// counts for neither isFilterActive nor activeGroupCount.
export const DEFAULT_FILTERS = { minPlayers:1, maxPlayers:11, mode:"vibe", vibe:null, time:"any", weight:"any", bestFit:false, showExpansions:false };

export function isFilterActive(filters){
  return filters.minPlayers !== 1 || filters.maxPlayers !== 11 || filters.time !== "any" || filters.weight !== "any" || filters.bestFit || filters.vibe !== null;
}
export function activeGroupCount(filters){
  let n = 0;
  if(filters.minPlayers !== 1 || filters.maxPlayers !== 11) n++;
  if(filters.vibe) n++;
  if(filters.mode === "numbers"){
    if(filters.time !== "any") n++;
    if(filters.weight !== "any") n++;
  }
  if(filters.bestFit) n++;
  return n;
}
export function playersLabel(filters){
  const { minPlayers:min, maxPlayers:max } = filters;
  if(min===1 && max===11) return t('filter.any');
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
    if(!filters.showExpansions && g.subtype === "boardgameexpansion") return false;
    if(!playersMatch(g, filters)) return false;
    if(!bestFitMatch(g, filters)) return false;
    if(filters.mode === "vibe"){
      if(filters.vibe && !(g.vibes || []).includes(filters.vibe)) return false;
    } else {
      if(filters.time!=="any" && timeBucket(g.time)!==filters.time) return false;
      if(filters.weight!=="any" && g.weight!==filters.weight) return false;
    }
    if(search && !g.title.toLowerCase().includes(search)) return false;
    return true;
  });
}
export function vibeLabel(key){
  const v = VIBES.find(x => x.key === key);
  return v ? v.label : key;
}
export function weightLabel(score){
  return `${score.toFixed(1)} / 5`;
}
// Meta strings go through i18n: English keeps the bare "2–4" and "30m", Thai
// reads "2–4 คน" and "30 นาที" (docs/claude-code-spec-i18n.md, meta.*).
export function timeLabel(time){
  const range = time[0]===time[1] ? `${time[0]}` : `${time[0]}–${time[1]}`;
  return t('meta.time', { range });
}
export function playersRangeLabel(players){
  const range = players[0]===players[1] ? `${players[0]}` : `${players[0]}–${players[1]}`;
  return t('meta.players', { range });
}

// Vibe = derived tag. A game can carry several. Order = pill order in the UI.
// Rules read the curated `tag` string plus weightScore / time / players.
// 'other' is a fallback, never a rule: assigned only when nothing else hit.
export const VIBES = [
  { key:'party',    label:'Party',    hint:'Loud, silly, everyone talks at once.' },
  { key:'bluffing', label:'Bluffing', hint:'Someone at the table is lying.' },
  { key:'coop',     label:'Co-op',    hint:'Win or lose together.' },
  { key:'duel',     label:'Duel',     hint:'Head to head, just the two of you.' },
  { key:'strategy', label:'Strategy', hint:'Build an engine, plan three turns ahead.' },
  { key:'family',   label:'Family',   hint:'Easy to teach, everyone can join.' },
  { key:'chill',    label:'Chill',    hint:'Low conflict, pretty tiles, quiet turns.' },
  { key:'story',    label:'Story',    hint:'A theme that pulls you in.' },
  { key:'other',    label:'Others',   hint:'Doesn’t fit a box yet.' },
];

const PARTY = ['party','big group','drawing','trivia','word game','social','dexterity'];
const BLUFF = ['social deduction','bluffing','hidden role','hidden information','deduction','negotiation','traitor'];
const STRAT = ['strategy','euro','economic','engine','worker','auction','city','network','route','area control','empire','political','market','tile','drafting'];
const CHILL = ['tile','drafting','set collection','pattern','nature','whimsical','solo','relax','puzzle','trick-taking','route'];
const STORY = ['campaign','legacy','narrative','adventure','story','epic','dungeon','sci-fi','fantasy','horror','exploration','thematic','zombie','miniatures'];

// Missing data must never *create* a match: tag → '', weightScore → Infinity,
// time/players → the rule that needs them is skipped (returns false).
const tagOf   = g => (typeof g.tag === 'string' ? g.tag : '').toLowerCase();
const has     = (g, words) => { const t = tagOf(g); return words.some(w => t.includes(w)); };
const weight  = g => (typeof g.weightScore === 'number' ? g.weightScore : Infinity);
const hasTime = g => Array.isArray(g.time) && g.time.length >= 2
                     && typeof g.time[0] === 'number' && typeof g.time[1] === 'number';
const hasPlayers = g => Array.isArray(g.players) && typeof g.players[1] === 'number';
const avgTime = g => (g.time[0] + g.time[1]) / 2;

const RULES = {
  party:    g => has(g, PARTY),
  bluffing: g => has(g, BLUFF),
  coop:     g => has(g, ['co-op','cooperative','team play','team vs']),
  duel:     g => has(g, ['two-player','2-player','duel']) || (hasPlayers(g) && g.players[1] === 2),
  strategy: g => (weight(g) >= 2.5 || has(g, STRAT)) && !has(g, PARTY) && !has(g, BLUFF),
  family:   g => hasTime(g) && hasPlayers(g)
                 && weight(g) <= 2.0 && avgTime(g) <= 60 && g.players[1] >= 3
                 && !has(g, [...PARTY, ...BLUFF, 'duel', 'wargame']),
  chill:    g => weight(g) <= 2.6 && has(g, CHILL)
                 && !has(g, [...PARTY, ...BLUFF, 'duel', 'wargame', 'real-time']),
  story:    g => has(g, STORY),
};

export function applyVibes(games){
  for(const g of games){
    g.vibes = Object.keys(RULES).filter(k => RULES[k](g));
    if(g.vibes.length === 0) g.vibes = ['other'];
  }
  return games;
}

// Temporary console tally for ?debug=vibes — Task 2 removes it.
export function logVibeTally(games){
  const rows = VIBES.map(v => {
    const hits = games.filter(g => g.vibes.includes(v.key));
    return { vibe: v.key, count: hits.length, first8: hits.slice(0, 8).map(g => g.title).join(' | ') };
  });
  console.table(rows);
  console.log('other:', games.filter(g => g.vibes.includes('other')).map(g => g.title));
  console.log('≥4 vibes:', games.filter(g => g.vibes.length >= 4).map(g => `${g.title} [${g.vibes.join(',')}]`));
}

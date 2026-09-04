# Task 1 of 2: Vibe tags — data pass (no UI)

Add a derived `vibes[]` array to every game at load, computed from fields
`games.json` already has: `tag`, `weightScore`, `time`, `players`. No BGG
fetch, no new data file, **no visible change**. Ends with a console tally
Nok reviews before Task 2.

Design source of truth: `docs/mockups/vibe-filter-mockup.html` — its
`VIBES` array and the `v` field on each game are the expected output.

## New file: `js/vibes.js` (ES module, like `js/filters.js`)

```js
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

const has = (g, words) => { const t = g.tag.toLowerCase(); return words.some(w => t.includes(w)); };
const avgTime = g => (g.time[0] + g.time[1]) / 2;

const RULES = {
  party:    g => has(g, PARTY),
  bluffing: g => has(g, BLUFF),
  coop:     g => has(g, ['co-op','cooperative','team play','team vs']),
  duel:     g => has(g, ['two-player','2-player','duel']) || g.players[1] === 2,
  strategy: g => (g.weightScore >= 2.5 || has(g, STRAT)) && !has(g, PARTY) && !has(g, BLUFF),
  family:   g => g.weightScore <= 2.0 && avgTime(g) <= 60 && g.players[1] >= 3
                 && !has(g, [...PARTY, ...BLUFF, 'duel', 'wargame']),
  chill:    g => g.weightScore <= 2.6 && has(g, CHILL)
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
```

Missing `tag` → treat as `''`; missing `weightScore` → `Infinity`; missing
`time`/`players` → skip the rule. A missing value must never *create* a match.

## Wire it in `index.html`

Import next to the other modules and call once, right after `games.json`
is parsed and before the first `render()`:

```js
import { VIBES, applyVibes } from './js/vibes.js';
// …after: games = await (await fetch('/games.json')).json();  (grep -n for the exact line)
applyVibes(games);
```

## Tally (temporary — Task 2 removes it)

Gated on `new URLSearchParams(location.search).has('debug')` with value
`vibes`, log a table: one row per vibe with count and the first 8 titles,
then a full list of games in `other`, then any game with ≥ 4 vibes.

Expected from the mockup data (196 games): party 65, bluffing 49, coop 18,
duel 22, strategy 69, family 29, chill 14, story 12, other 3
(Catan: 3D Edition, Time to Panic, Builders of Babel). Small drift is fine
if `games.json` changed; large drift means the rules were mistranslated.

## Verification

- [ ] `?debug=vibes` prints the tally and it matches the numbers above ±2.
- [ ] No game has zero vibes; `other` has exactly the three listed.
- [ ] Shelf renders identically with and without the flag.
- [ ] No new network requests. Module loads via the existing `<script type="module">`.

Commit: `feat(shelf): derive vibe tags from tag/weight/time (data only)`

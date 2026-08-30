#!/usr/bin/env node
// Sync entry point for games.json.
//
// Run with:  node scripts/sync-games.mjs
//
// Right now this does one job: give every game a `caption` — the short
// decision line the voting screen shows under the card. It is the place a
// real BGG fetch belongs when one is added (see "The BGG seam" below), so
// that captions stay a step of the sync rather than a script someone has to
// remember to run.
//
// Two fields are involved:
//   caption           generated here on every run; overwritten freely
//   caption_override  hand-written; this script never writes or removes it
//
// Deliberately NOT named `blurb`: games.json already has one, holding the
// long description the shared detail modal renders (js/game-modal.js). These
// are different jobs — a paragraph you read while deciding what to look at,
// versus one line you read while deciding play or pass.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GAMES = path.join(ROOT, 'games.json');

export const MAX_CAPTION = 110;

// ---------------------------------------------------------------------------
// The BGG seam
// ---------------------------------------------------------------------------
// There is no BGG fetch in this repo yet: games.json is maintained by hand, so
// there is nothing here to hang a `mechanics` / `categories` request off. What
// the collection does carry is `tag` — "Dice placement · euro classic",
// "Worker placement · deckbuilding" — which is the same kind of vocabulary,
// already curated and already human-readable.
//
// So captions are built from `tag` today. When a real BGG sync lands, it
// should populate `tag` (or add `mechanics`/`categories` and widen
// `sourceTerms()` below) and then call buildCaption() exactly as this does —
// nothing else here needs to change.
function sourceTerms(game) {
  return String(game.tag || '')
    .split('·')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Sentence 1 — what you do
// ---------------------------------------------------------------------------

// Who it is for. When one of these is present the sentence reads
// "A party game of social deduction." rather than listing it as a mechanic.
const AUDIENCE = new Map([
  ['party', 'party'],
  ['family', 'family'],
  ['family theme', 'family'],
  ['kids', 'kids'],
  ['big group', 'big-group'],
  ['two-player', 'two-player'],
  ['2-player', 'two-player'],
  ['duel', 'two-player'],
  ['dueling', 'two-player'],
  ['2-player duel', 'two-player'],
  ['team play', 'team'],
  ['team vs team', 'team'],
  ['solo-friendly', 'solo-friendly'],
  ['gateway', 'gateway'],
  ['icebreaker', 'icebreaker'],
]);

// Terms that only describe weight or length. Sentence 2 already covers that
// ground, so they never become the "what you do" half on their own.
const FEEL_ONLY = new Set([
  'light', 'heavy', 'quick', 'quick play', 'filler', 'light filler',
  'quick filler', 'epic', 'speed', 'minimalist', 'whimsical', 'licensed',
  'classic', 'strategy',
]);

// The common terms, and the ones whose raw text reads badly mid-sentence.
// Anything not listed falls through to its own text, which is already written
// for humans — so the table improves the vocabulary rather than gating it.
const MECHANIC = new Map([
  ['social deduction', 'social deduction'],
  ['hidden role', 'hidden roles'],
  ['hidden role classic', 'hidden roles'],
  ['hidden traitor', 'a hidden traitor'],
  ['hidden information', 'hidden information'],
  ['hidden movement', 'hidden movement'],
  ['deckbuilding', 'deck-building'],
  ['deck-building race', 'deck-building'],
  ['engine-building', 'engine-building'],
  ['combo building', 'combo-building'],
  ['tableau building', 'tableau-building'],
  ['worker placement', 'worker placement'],
  ['dice placement', 'dice placement'],
  ['dice-placement', 'dice placement'],
  ['dice', 'dice rolling'],
  ['area control', 'area control'],
  ['tile-laying', 'tile-laying'],
  ['route-building', 'route-building'],
  ['network-building', 'network-building'],
  ['city-building', 'city-building'],
  ['empire-building', 'empire-building'],
  ['civilization', 'building a civilization'],
  ['card drafting', 'card drafting'],
  ['drafting', 'drafting'],
  ['set collection', 'set collection'],
  ['hand management', 'hand management'],
  ['trick-taking', 'trick-taking'],
  ['climbing', 'climbing card play'],
  ['push-your-luck', 'push-your-luck'],
  ['push your luck', 'push-your-luck'],
  ['auction', 'bidding'],
  ['bidding', 'bidding'],
  ['spatial auction', 'spatial bidding'],
  ['betting', 'betting'],
  ['negotiation', 'negotiation'],
  ['negotiation classic', 'negotiation'],
  ['real-time negotiation', 'real-time negotiation'],
  ['trading', 'trading'],
  ['classic trading', 'trading'],
  ['stock market', 'playing the market'],
  ['market simulation', 'playing the market'],
  ['bubble economy', 'playing the market'],
  ['economic', 'economic play'],
  ['heavy economic', 'economic play'],
  ['political economy', 'political and economic play'],
  ['political strategy', 'political manoeuvring'],
  ['economic railroads', 'railway economics'],
  ['railway', 'railway building'],
  ['transport', 'moving goods'],
  ['racing', 'racing'],
  ['real-time', 'real-time play'],
  ['cooperative', 'co-operative play'],
  ['co-op', 'co-operative play'],
  ['cooperative campaign', 'a co-operative campaign'],
  ['semi-co-op', 'semi-co-operative play'],
  ['semi-cooperative', 'semi-co-operative play'],
  ['campaign', 'a campaign'],
  ['deduction', 'deduction'],
  ['2-player deduction', 'deduction'],
  ['bluffing', 'bluffing'],
  ['guessing', 'guessing'],
  ['guessing game', 'guessing'],
  ['word game', 'word play'],
  ['trivia', 'trivia'],
  ['drawing', 'drawing'],
  ['map drawing', 'map drawing'],
  ['flip-and-write', 'flip-and-write'],
  ['storytelling', 'storytelling'],
  ['narrative', 'storytelling'],
  ['performance', 'performing'],
  ['communication', 'communication'],
  ['social', 'social play'],
  ['dexterity', 'dexterity'],
  ['puzzle', 'puzzling'],
  ['abstract', 'abstract play'],
  ['abstract strategy', 'abstract strategy'],
  ['spatial strategy', 'spatial strategy'],
  ['light strategy', 'straightforward strategy'],
  ['heavy strategy', 'deep strategy'],
  ['euro', 'euro strategy'],
  ['heavy euro', 'deep euro strategy'],
  ['euro classic', 'classic euro strategy'],
  ['exploration', 'exploration'],
  ['survival horror', 'survival horror'],
  ['horror', 'horror'],
  ['mystery', 'mystery'],
  ['wargame', 'wargaming'],
  ['asymmetric wargame', 'asymmetric wargaming'],
  ['asymmetric', 'asymmetric powers'],
  ['arena combat', 'arena combat'],
  ['miniatures', 'miniatures combat'],
  ['unmatched', 'asymmetric duels'],
  ['resource management', 'resource management'],
  ['farming', 'farming'],
  ['fishing', 'fishing'],
  ['nature', 'nature'],
  ['sci-fi', 'science fiction'],
  ['cold war', 'cold-war brinkmanship'],
  ['wild west', 'the old west'],
  ['cinema theme', 'movie-making'],
  ['travel game', 'travel'],
  ['card game', 'card play'],
]);

/** Never empty: the line every game falls back to when nothing maps. */
const GENERIC = 'Compete for points across a few rounds.';

// ---------------------------------------------------------------------------
// Preferred source: the curated description
// ---------------------------------------------------------------------------
// Tags alone produce captions that are technically accurate and useless —
// "Engine-building." says the same thing about forty games, and the card's own
// meta row already shows players, time and weight, so a generated
// "Heavy; a long session." was repeating what was six pixels above it. The
// collection's `blurb` field is hand-written, concrete and unique per game
// ("Roll dice, then spend them to place hexagonal tiles across your estate"),
// which is what actually helps someone decide. It is just too long, so the
// job here is to cut it to one clean clause rather than to compose from parts.

const MIN_CAPTION = 45;

/** Words that mean the sentence was going somewhere; never end on one. */
const DANGLING = /\b(and|or|but|the|an?|to|of|in|on|at|with|while|from|for|as|by|into|onto|than|that|which|who|whom|where|when|your|their|his|her|its|our|my|you|they|before|after|over|under|through|about|across|against|between|during|plus|then|so|if|is|are|was|were|be|been|up|down|out|off|per|via|each|every|both|either|neither)$/i;

const firstSentence = (text) =>
  (String(text || '').trim().match(/^(.+?[.!?])(\s|$)/) || [null, String(text || '').trim()])[1];

function trimDangling(s) {
  let out = s.trim().replace(/[,;:—–-]+$/, '').trim();
  for (;;) {
    if (!DANGLING.test(out)) return out;
    const next = out.replace(/\s+\S+$/, '').replace(/[,;:—–-]+$/, '').trim();
    if (!next || next === out) return out;
    out = next;
  }
}

/**
 * Drops a short trailing item left hanging off a list.
 *
 * Cutting "name the murder weapon, location, and cause of death" before its
 * "and" leaves "name the murder weapon, location" — which reads as a list the
 * sentence forgot to finish. When the final item is short, ending on the one
 * before it is cleaner. Also tidies trailing asides like ", say".
 */
function repairTrailingItem(s) {
  const lastComma = s.lastIndexOf(',');
  if (lastComma < MIN_CAPTION || s.length - lastComma > 25) return s;
  const shorter = trimDangling(s.slice(0, lastComma));
  return shorter.length >= MIN_CAPTION ? shorter : s;
}

/**
 * Cuts a sentence down to one clause that still reads as a whole thought.
 * Prefers a strong break, then a conjunction, then a comma; only falls back to
 * a word boundary, and gives up rather than return a stub.
 */
function condense(text, max) {
  const s = String(text).trim().replace(/\s+/g, ' ');
  if (s.length <= max) return s;
  const body = s.replace(/[.!?]$/, '');

  const breaks = [/ — | – |—|–|;|:/g, / (?=and |while |before |but |so )/g, /,/g];
  for (const re of breaks) {
    re.lastIndex = 0;
    let best = '';
    let m;
    while ((m = re.exec(body))) {
      const cut = trimDangling(body.slice(0, m.index));
      if (cut.length <= max - 1 && cut.length >= MIN_CAPTION) best = cut;
    }
    if (best) return repairTrailingItem(best);
  }

  const words = body.slice(0, max - 1).split(' ');
  words.pop();
  const cut = trimDangling(words.join(' '));
  return cut.length >= MIN_CAPTION ? cut : '';
}

const endPunct = (s) => (/[.!?]$/.test(s) ? s : `${s}.`);

/** The caption drawn from the curated description, or '' if none is usable. */
function fromDescription(game) {
  const condensed = condense(firstSentence(game.blurb), MAX_CAPTION);
  return condensed ? endPunct(condensed) : '';
}

const phraseFor = (term) => MECHANIC.get(term) || term;

/**
 * The mapped mechanic phrases, de-duplicated. Different tag terms can share a
 * phrase — "Auction · bidding" both map to "bidding" — and without this the
 * caption reads "Bidding and bidding."
 */
function mechanicPhrases(terms) {
  return [...new Set(
    terms.filter((t) => !AUDIENCE.has(t) && !FEEL_ONLY.has(t)).map(phraseFor),
  )];
}

function whatYouDo(terms) {
  const audience = terms.map((t) => AUDIENCE.get(t)).find(Boolean);
  const mechanics = mechanicPhrases(terms);

  if (audience && mechanics.length) return `A ${audience} game of ${mechanics[0]}.`;
  if (mechanics.length >= 2) return sentence(`${mechanics[0]} and ${mechanics[1]}`);
  if (mechanics.length === 1) return sentence(mechanics[0]);
  if (audience) return `A ${audience} game.`;
  return GENERIC;
}

const sentence = (s) => `${s.charAt(0).toUpperCase()}${s.slice(1)}.`;

// ---------------------------------------------------------------------------
// Sentence 2 — how it feels and what it costs you
// ---------------------------------------------------------------------------

function weightPhrase(score) {
  if (!(score > 0)) return 'Easy to get into';
  if (score < 2) return 'Light and quick to teach';
  if (score < 3) return 'Mid-weight, easy to get into';
  if (score < 4) return 'Heavy, tense, and rewarding';
  return 'Very heavy; expect a long night';
}

function timePhrase(time) {
  const longest = Array.isArray(time) ? time[time.length - 1] : time;
  if (!(longest > 0)) return '';
  if (longest < 30) return 'under 30 min';
  if (longest <= 60) return 'about an hour';
  return 'a long session';
}

function feelAndCommitment(game) {
  const weight = weightPhrase(game.weightScore);
  const time = timePhrase(game.time);
  // The heaviest bucket already says "a long night"; adding "a long session"
  // after it just says the same thing twice.
  if (!time || weight.includes('long night')) return `${weight}.`;
  return `${weight}; ${time}.`;
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

/**
 * The caption for one game: plain text, within MAX_CAPTION. Exported so a
 * future BGG sync can call it directly.
 *
 * Prefers the curated description, which is unique and concrete. Falls back to
 * composing from tags and the weight/time buckets, which is always available
 * but says much the same thing about many games — a safety net, not the plan.
 */
export function buildCaption(game) {
  const described = fromDescription(game);
  if (described) return described;

  const terms = sourceTerms(game);
  const tail = feelAndCommitment(game);
  let head = whatYouDo(terms);

  // Trim rather than truncate: drop back to a single mechanic, then to the
  // generic opener, so the result is always a whole sentence.
  if (`${head} ${tail}`.length > MAX_CAPTION) {
    const mechanics = mechanicPhrases(terms);
    if (mechanics.length) head = sentence(mechanics[0]);
  }
  if (`${head} ${tail}`.length > MAX_CAPTION) head = GENERIC;

  return `${head} ${tail}`;
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function sync() {
  const games = JSON.parse(await readFile(GAMES, 'utf8'));

  let generated = 0;
  let kept = 0;
  const tooLong = [];

  for (const game of games) {
    if (typeof game.caption_override === 'string' && game.caption_override.trim()) {
      // Hand-written copy is the author's, not ours. Leave it exactly as is.
      kept += 1;
      continue;
    }
    game.caption = buildCaption(game);
    generated += 1;
    if (game.caption.length > MAX_CAPTION) tooLong.push(game);
  }

  // Nothing may reach the voting screen without a line to show.
  const missing = games.filter(
    (g) => !(g.caption_override || '').trim() && !(g.caption || '').trim(),
  );
  if (missing.length) {
    console.error(`\n✗ ${missing.length} game(s) ended with neither caption nor caption_override:`);
    for (const g of missing) console.error(`    ${g.bggId}  ${g.title}`);
    process.exit(1);
  }

  if (tooLong.length) {
    console.warn(`\n⚠ ${tooLong.length} caption(s) over ${MAX_CAPTION} chars:`);
    for (const g of tooLong) console.warn(`    ${g.caption.length}  ${g.title}: ${g.caption}`);
  }

  await writeFile(GAMES, `${JSON.stringify(games, null, 2)}\n`);

  const lengths = games.map((g) => (g.caption_override || g.caption).length);
  console.log(`✓ ${games.length} games — ${generated} captions generated, ${kept} override(s) kept`);
  console.log(`  longest ${Math.max(...lengths)} chars, average ${Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length)}`);
}

// Only run when invoked directly, so the generator can be imported and tested.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  sync().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

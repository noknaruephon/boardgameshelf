// Localised curated content (docs/claude-code-spec-i18n.md, commit 2).
//
// Nok's curated fields — blurb, caption, the Teach captions — carry a Thai
// sibling next to the English one: `blurb_th`, `caption_th`, and inside
// `teach` a `captions_th` array (one per beat, in beat order) plus
// `frames_th` (the three strip frames, when the turn beat is a strip).
// They live in games.json and travel into games.extras with the rest of the
// curated set; BGG data never carries them.
//
// Fallback is silent: a missing Thai value reads as the English one, with no
// marker. Teach falls back per game, never per caption, so a scene set never
// mixes languages.

import { getLang } from './i18n.js';

const present = (v) => (Array.isArray(v) ? v.length > 0 : !!v);

/** The Thai value of `field` when in Thai and it exists, else the English one. */
export function pickLocalised(obj, field) {
  if (obj && getLang() === 'th') {
    const v = obj[`${field}_th`];
    if (present(v)) return v;
  }
  return obj ? obj[field] : undefined;
}

const complete = (arr, n) => Array.isArray(arr) && arr.length === n && arr.every((s) => typeof s === 'string' && s.trim());

/**
 * The Teach block with its captions in the current language. Returns the
 * English block untouched unless every Thai caption the game needs is there:
 * five beat captions, and three frame captions when the turn beat is a strip.
 * The result is a new object; the game's own data is never mutated.
 */
export function localisedTeach(teach) {
  if (!teach || getLang() !== 'th' || !Array.isArray(teach.beats)) return teach;
  const beats = teach.beats;
  if (!complete(teach.captions_th, beats.length)) return teach;
  const strip = beats.find((b) => b && b.scene === 'strip');
  if (strip && !complete(teach.frames_th, Array.isArray(strip.steps) ? strip.steps.length : -1)) return teach;
  return {
    ...teach,
    beats: beats.map((b, i) => {
      const out = { ...b, caption: teach.captions_th[i] };
      if (b.scene === 'strip') out.steps = b.steps.map((s, j) => ({ ...s, caption: teach.frames_th[j] }));
      return out;
    }),
  };
}

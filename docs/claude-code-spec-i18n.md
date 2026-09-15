# Spec: TH/EN language switch (i18n)

Save as `docs/claude-code-spec-i18n.md`. Mockup: `docs/mockups/i18n-mockup.html` (copy the file provided alongside this spec).

Work in the order below and **stop for review after each commit**. Read the repo first — `css/base.css`, `js/game-modal.js`, the filter sheet, the shelf page and the landing page — before writing anything; the selectors in this spec are illustrative and must be replaced with the real ones.

## Goal

Add a Thai / English switch to BoardgameShelf. UI chrome and Nok's curated content (blurb, caption, Teach captions) become available in Thai. BGG data, generated images and share surfaces stay English.

## Locked decisions

| Decision | Value |
|---|---|
| Scope | UI strings + curated content. **Not** BGG data, poster, share sheets, OG image. |
| Resolution order | `?lang=` → `localStorage["bgs-lang"]` → `navigator.language` starts with `th` → `en` |
| A visited `?lang=` | Writes to localStorage, then is removed from the URL via `history.replaceState` |
| Switch | Swap pill in the header, right side beside the account icon. Shows the **other** language: `TH` while in English, `EN` while in Thai. Label always Latin. |
| Pill flag | Pill is rendered only with `?i18n=1` until the content pass is complete. `?lang=th` works regardless of the flag. |
| Thai typeface | IBM Plex Sans Thai (loopless) 400 / 500 / 600, Google Fonts CDN |
| Fallback | Missing Thai content falls back to English silently. No indicator. |
| Dates in Thai | `Intl.DateTimeFormat("th-TH-u-ca-gregory", …)` — Gregorian year, never พ.ศ. |
| Digits | Latin digits in both languages |

## Hard rules

1. **WebKit rule:** never apply both `animation` and `transition` to the same CSS property on the same element. The pill label crossfade is a `transition` on `opacity` only.
2. Focus rings are `box-shadow` only. No `outline` anywhere.
3. **Never translate:** the wordmark `BoardgameShelf`, `Beta`, `Powered by BGG`, game titles, usernames and shelf slugs, mechanic / category / vibe names (`Party`, `Co-op`, `Strategy`…), BGG terms (`weight`), and the product term `Start game night`. These have **no key in `th.json`**. `Teach me in 60 seconds` **is** translated: `สอนเล่นใน 60 วินาที`.
4. BGG separation: nothing is added to the `games` table. Thai curated fields go next to their English siblings in `game_curation` (and `games.json` while Nok's shelf still reads from it).
5. `games.json` round-trip: `indent=2, ensure_ascii=False`, trailing newline, additive diff only.
6. Poster renderer, share sheets and `/api/og/*` are not touched and always render English.

## Layout constants

| Item | Value |
|---|---|
| Pill font | IBM Plex Mono 11px, `letter-spacing: .02em`, same construction as the Beta pill |
| Pill padding / radius | `5px 7px 4px`, `999px`, `min-width: 34px` |
| Pill border | `1px solid rgba(var(--bgs-ivory-rgb), .22)`; hover: `rgba(var(--bgs-gold-rgb), .7)` + text `--bgs-gold` |
| Pill crossfade | `transition: opacity .16s ease` on the inner `.lbl`; suppressed under `prefers-reduced-motion` |
| Thai body line-height | `1.65` (EN `1.5`) |
| Thai heading line-height | `1.4` (EN `1.2`) |
| Thai display headings | Fraunces → `IBM Plex Sans Thai` 600, `font-style: normal`, `letter-spacing: 0` |
| Thai italic captions | Fraunces italic → `IBM Plex Sans Thai` 500 |
| Thai mono meta | `"IBM Plex Mono", "IBM Plex Sans Thai"` — Latin/digits stay mono, Thai glyphs fall through |
| Chips / buttons in Thai | `min-width` +15% over the EN value |
| localStorage key | `bgs-lang` (`"en"` \| `"th"`) |
| URL param | `lang` ; flag param `i18n` |

---

## Commit 1 — runtime, fonts, pill, UI strings

### 1a. Fonts

Add `IBM+Plex+Sans+Thai:wght@400;500;600` to the existing Google Fonts `<link>` on every page that has a header (landing, shelf, `/welcome`, `/n/:code`, `/bag/:id`, privacy, terms).

### 1b. `css/base.css` — token swap under `[data-lang="th"]`

Before (illustrative — use the real token block):
```css
:root {
  --font-display: "Fraunces", Georgia, serif;
  --font-ui: "Inter", system-ui, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, monospace;
}
```
After:
```css
:root {
  --font-display: "Fraunces", Georgia, serif;
  --font-ui: "Inter", system-ui, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, monospace;
  --lh-body: 1.5;
  --lh-heading: 1.2;
  --chip-minw: 0px;
}
[data-lang="th"] {
  --font-ui: "IBM Plex Sans Thai", "Inter", system-ui, sans-serif;
  --font-mono: "IBM Plex Mono", "IBM Plex Sans Thai", ui-monospace, monospace;
  --lh-body: 1.65;
  --lh-heading: 1.4;
  --chip-minw: 15%;
}
[data-lang="th"] .display,
[data-lang="th"] h1, [data-lang="th"] h2, [data-lang="th"] h3 {
  font-family: var(--font-ui);
  font-style: normal;
  font-weight: 600;
  letter-spacing: 0;
}
[data-lang="th"] .game-caption { font-family: var(--font-ui); font-style: normal; font-weight: 500; }
```
If `body` and headings currently hardcode `line-height`, route them through `--lh-body` / `--lh-heading`. Chips and toolbar buttons get `min-width: calc(<current> + var(--chip-minw))`.

The wordmark keeps its own explicit `font-family: "Fraunces"` so it is never affected by the swap.

### 1c. `js/i18n.js` (new, ES module)

```js
const KEY = "bgs-lang";
const SUPPORTED = ["en", "th"];
let dict = { en: {}, th: {} };
let lang = "en";

export function resolveLang() {
  const url = new URL(location.href);
  const fromUrl = url.searchParams.get("lang");
  if (SUPPORTED.includes(fromUrl)) {
    localStorage.setItem(KEY, fromUrl);
    url.searchParams.delete("lang");
    history.replaceState(null, "", url);
    return fromUrl;
  }
  const stored = localStorage.getItem(KEY);
  if (SUPPORTED.includes(stored)) return stored;
  if ((navigator.language || "").toLowerCase().startsWith("th")) return "th";
  return "en";
}

export async function initI18n() {
  lang = resolveLang();
  const [en, th] = await Promise.all([
    fetch("/i18n/en.json").then(r => r.json()),
    fetch("/i18n/th.json").then(r => r.json()),
  ]);
  dict = { en, th };
  applyLang(lang);
}

export function getLang() { return lang; }

export function t(key, args = {}) {
  const s = dict[lang][key] ?? dict.en[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => args[k] ?? "");
}

export function setLang(next) {
  lang = next;
  localStorage.setItem(KEY, next);
  applyLang(next);
  document.dispatchEvent(new CustomEvent("bgs:langchange", { detail: { lang: next } }));
}

function applyLang(l) {
  document.documentElement.lang = l;
  document.documentElement.dataset.lang = l;
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const args = el.dataset.args ? JSON.parse(el.dataset.args) : {};
    el.textContent = t(el.dataset.i18n, args);
  });
  document.querySelectorAll("[data-i18n-attr]").forEach(el => {
    // data-i18n-attr="aria-label:pill.aria,title:pill.title"
    el.dataset.i18nAttr.split(",").forEach(pair => {
      const [attr, key] = pair.split(":");
      el.setAttribute(attr, t(key));
    });
  });
}

export function fmtDate(date, opts) {
  const locale = lang === "th" ? "th-TH-u-ca-gregory" : "en-GB";
  return new Intl.DateTimeFormat(locale, opts).format(date);
}
```

Static markup uses `data-i18n="key"` (+ optional `data-args='{"n":196}'`). JS-built markup (game modal, filter sheet, game night states, bag packing mode, `/welcome` steps) calls `t()` and re-renders on `bgs:langchange`. Existing `Intl`/`toLocaleDateString` calls route through `fmtDate`.

Call `initI18n()` before first render on every page; it is one small fetch and must not block cover images.

### 1d. `i18n/en.json` and `i18n/th.json` (new)

Extract every user-visible UI string into `en.json` with dotted keys grouped by surface: `landing.*`, `header.*`, `shelf.*`, `filter.*`, `modal.*`, `teach.*`, `night.*`, `bag.*`, `welcome.*`, `meta.*`, `pill.*`, `footer.*`. Thai has no plurals — use templates: `"meta.players": "{range} คน"`, `"meta.time": "{range} นาที"`, `"shelf.count": "{n} เกม"`.

Seed `th.json` with the strings from the mockup and translate the rest in the same register (plain, spoken, no formal particles). Anything on the never-translate list is omitted from `th.json` so it falls back to English by design.

Known Thai values to carry over from the mockup:

| key | th |
|---|---|
| `shelf.title` | `ชั้นของ {name}` |
| `shelf.count` | `{n} เกม` |
| `shelf.search` | `ค้นหาในชั้น` |
| `shelf.filters` | `ตัวกรอง` |
| `modal.close` | `ปิด` |
| `teach.title` | `สอนเล่นใน 60 วินาที` |
| `meta.players` | `{range} คน` |
| `meta.time` | `{range} นาที` |
| `pill.other` | `EN` |
| `pill.aria` | `Switch to English` |
| `pill.title` | `English` |
| `landing.hero` | `ชั้นของคุณ ตัดสินจากหน้ากล่อง` |
| `landing.sub` | `หน้าเพจสำหรับคอลเลกชันของคุณ และการโหวตสำหรับโต๊ะของคุณ จากมือถือเครื่องไหนก็ได้` |

### 1e. Header pill

Insert after the account icon's preceding spacer, before the account icon, on every header page. Rendered only when `new URLSearchParams(location.search).has("i18n")` (flag — see Shipping).

```html
<button class="pill pill--lang" type="button"
        data-i18n-attr="aria-label:pill.aria,title:pill.title">
  <span class="lbl" data-i18n="pill.other">TH</span>
</button>
```
```css
.pill--lang { position: relative; min-width: 34px; text-align: center; cursor: pointer; }
.pill--lang:hover { border-color: rgba(var(--bgs-gold-rgb), .7); color: var(--bgs-gold); }
.pill--lang .lbl { display: inline-block; transition: opacity .16s ease; }  /* transition only */
.pill--lang.is-swapping .lbl { opacity: 0; }
@media (prefers-reduced-motion: reduce) { .pill--lang .lbl { transition: none; } }
```
```js
pill.addEventListener("click", () => {
  const next = getLang() === "en" ? "th" : "en";
  const rm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (rm) return setLang(next);
  pill.classList.add("is-swapping");
  setTimeout(() => { setLang(next); pill.classList.remove("is-swapping"); }, 160);
});
```
The pill inherits the Beta pill's base class; if the Beta pill is a `<span>`, factor the shared rules into `.pill` so both use them.

### Verification — Commit 1

- [ ] `?lang=th` on any header page renders Thai, writes `bgs-lang=th`, and the param disappears from the URL
- [ ] Reload without the param → still Thai (localStorage); clear storage with a Thai browser locale → Thai; with an English locale → English
- [ ] Pill shows `TH` in English mode and `EN` in Thai mode; click swaps with a 160 ms fade; with reduced motion the swap is instant
- [ ] Pill is absent without `?i18n=1`; `?lang=th` still works without it
- [ ] `<html lang>` and `data-lang` update on switch; game modal, filter sheet and game night states re-render in the new language without reopening
- [ ] In Thai: wordmark, `Beta`, `Powered by BGG`, vibe chips, game titles, usernames, `weight`, `Start game night` all remain English
- [ ] Thai text uses IBM Plex Sans Thai (check computed font in DevTools); digits inside mono meta stay in Plex Mono
- [ ] Chips and toolbar buttons do not wrap or clip in Thai on a 375px viewport
- [ ] Focus ring on the pill is `box-shadow`, gold, visible via keyboard
- [ ] Game night dates in Thai show a Gregorian year
- [ ] Poster, share sheets and OG image unchanged in both languages
- [ ] Safari and Chrome: no dropped transition on the pill (WebKit rule)

Suggested commit message: `feat(i18n): TH/EN runtime, Plex Sans Thai type swap, header swap pill behind ?i18n=1`

**Stop for review.**

---

## Commit 2 — curated content plumbing

### 2a. Data fields

Add sibling fields wherever the English ones live. Never add to `games`.

`games.json` entry (additive):
```json
{
  "bggId": "230802",
  "title": "Azul",
  "blurb": "…",
  "blurb_th": "…",
  "caption": "…",
  "caption_th": "…",
  "teach": { "captions": ["…","…","…"], "captions_th": ["…","…","…"] }
}
```

`game_curation` migration:
```sql
alter table game_curation
  add column if not exists blurb_th text,
  add column if not exists caption_th text,
  add column if not exists teach_captions_th text[];
```
Sync must not write these columns (confirm the sync path only touches `games`).

### 2b. Read path

Add one helper and use it at every point that reads blurb / caption / Teach captions (`js/game-modal.js`, Teach section renderer, any card that shows a caption):

```js
import { getLang } from "./i18n.js";
export function pickLocalised(obj, field) {
  if (getLang() === "th") {
    const v = obj[`${field}_th`];
    if (Array.isArray(v) ? v.length : v) return v;
  }
  return obj[field];
}
```
Fallback is silent. For Teach, fall back per game (whole caption set), not per caption, so scenes never mix languages.

### 2c. `scripts/i18n-status.py`

Prints how many games have `blurb_th`, `caption_th`, `captions_th`, and lists `bggId`s missing any, so the content pass can be tracked. Read-only.

### Verification — Commit 2

- [ ] Modal in Thai shows `blurb_th` / `caption_th` / Thai Teach captions when present, English when absent, with no visible marker
- [ ] A game with Thai blurb but no Thai Teach captions shows Thai blurb and all-English Teach scenes
- [ ] `games.json` diff is additive only, `ensure_ascii=False`, trailing newline
- [ ] Migration applied; RLS unchanged; sync run leaves the `_th` columns untouched
- [ ] `scripts/i18n-status.py` reports 0 / 196 for each field (before the content pass)

Suggested commit message: `feat(i18n): blurb_th / caption_th / teach captions_th fields with silent EN fallback`

**Stop for review.**

---

## Stage 3 — content pass (separate session, after review)

Generate Thai for all 196 games in batches of 20, with confidence tagging as used for Teach. Write to `games.json` only; Nok reviews low-confidence entries first.

Prompt constraints for the translation pass:
- Same register as the mockup: spoken, plain, no ครับ/ค่ะ, no formal เอกสาร tone.
- Blurb ≤ 2 sentences; caption ≤ 6 words; Teach caption ≤ 12 words.
- **Do not translate:** game titles, mechanic and category names, component names that are established loanwords (การ์ด, โทเค็น are fine; `worker placement`, `deck building` stay Latin), BGG terms.
- Preserve the meaning of the English caption's joke; do not add explanation.
- Output JSON only: `{ bggId, blurb_th, caption_th, captions_th, confidence: "high"|"medium"|"low", note }`.

Suggested commit message per batch: `content(i18n): Thai curation batch N/10`

## Shipping

- Commit 1 and 2 ship to production; the pill stays behind `?i18n=1` until the content pass is reviewed. Thai browsers therefore still get English until the flag is removed, because auto-detect is gated on the pill being live — implement this as: `resolveLang()` only consults `navigator.language` when the `i18n` flag is present **or** the flag has been removed from code. Leave a `// FLAG` comment at that line.
- Flag removal is a one-line change plus deleting the `has("i18n")` check on the pill.

## Deviations from the mockup

- Mockup token hex values were approximations; use the real `css/base.css` values.
- Mockup card cover-to-title mapping was illustrative; production reads `games.json`.
- The gold "blurb_th missing" note in the mockup is demo-only. Production has no fallback indicator.
- Mockup translated vibe chips in an earlier draft; the shipped rule is that they stay English.

---

## Implementation notes (commits 1 and 2)

Where the repo differed from the illustrative snippets above, the code follows the repo. Recorded here so the content pass and the flag removal land in the right place.

- **No `game_curation` table exists.** Curated fields live in `games.extras` (jsonb), written only by `scripts/migrate-games-json.mjs`; `/api/sync/*` never touches that column. The Thai siblings therefore live there too — `extras.blurb_th`, `extras.caption_th`, and inside `extras.teach` — and no migration was needed. `js/shelf-data.js` passes them through to the legacy game shape; `EXTRA_KEYS` in the migrate script carries them into Supabase.
- **Teach shape.** The real data is `teach.beats[].caption` plus `steps[].caption` on the strip beat, not a flat `captions`. The Thai set is `teach.captions_th` (five strings, beat order) and `teach.frames_th` (three strings, only when the turn beat is a strip). `localisedTeach()` in `js/curation.js` uses the Thai set only when it is complete; otherwise the whole block stays English.
- **Type tokens.** `css/base.css` had no font tokens; `--font-ui` and `--font-mono` were introduced and every page's hardcoded `'Inter',sans-serif` / `'IBM Plex Mono',monospace` now reads them. The display serif stays a literal `'Fraunces'` on purpose. The body had no line-height in English, so `--lh-body` is applied to `body` only under `[data-lang="th"]`; prose that already set `1.5` reads the token. Chip room is `--chip-pad` (1 / 1.15) scaling side padding, because a percentage `min-width` would resolve against the container, not the label.
- **Pill classes.** `.pill` is the shelf's filter-pill class, so the header pills share `.bgs-pill` (the Beta pill's rules, factored out) and the swap pill is `.bgs-pill.bgs-lang`, built by `js/lang-pill.js` inside `.bgs-wordmark` beside Beta. It is only built while `?i18n=1` is present.
- **Where the flag lives.** `resolveLang()` in `js/i18n.js` consults `navigator.language` only when `hasFlag()` is true (the `// FLAG` line), and `js/lang-pill.js` returns early without the flag. Shipping is those two guards.
- **Game-night pages** (`/night/:code/host`, `/vote/:code`, `/vote/:code/swipe`, `/results/:code`) initialise i18n so the shared detail modal and the swipe caption follow the stored language; their own chrome is not yet extracted and stays English. The share sheets, invite poster and `/api/og/*` are untouched.
- **Dates.** No page formats a date today; `fmtDate()` is exported for the first one that does (`th-TH-u-ca-gregory-nu-latn`).
- **Status.** `python3 scripts/i18n-status.py` reports the content pass; before it: `0 / 196` blurbs and captions, `0 / 155` Teach sets.

## Content pass (stage 3) — what shipped

- All 196 games have Thai in `docs/i18n/batch-1.json` … `batch-10.json` (shape: `{ bggId, blurb_th, caption_th, captions_th?, frames_th?, confidence, note }`). `python3 scripts/merge-i18n.py` merges them into `games.json` additively; `python3 scripts/i18n-extract.py <dir>` dumps the English a batch needs.
- Merged by default: `high` and `medium`. `medium` marks games whose English Teach beats are themselves draft placeholders ("Draft — verify …"); the Thai carries the placeholder as written so the two languages stay in step, and both get replaced together when the English beat is fixed.
- Held back (`low`, not in `games.json` until reviewed): **Ironwood** (407343), **King of 12** (302917), **Spyfest** (295646). In each, the English blurb and the English Teach describe different games, so the source needs a look before the Thai does. Merge them with `python3 scripts/merge-i18n.py --include-low` once fixed.
- `python3 scripts/i18n-status.py` lists what is still missing.
- **The live shelf reads `games.extras` from Supabase, not games.json.** After merging, run `node scripts/push-i18n.mjs` (with `.env` holding the service role key; `--dry-run` first) to copy `blurb_th`, `caption_th` and the Teach `captions_th` / `frames_th` into each row's extras. It touches only those keys, so it is safe after a BGG sync and safe to rerun.

# BoardgameShelf

Static HTML/CSS/JS, no build step, deployed on Vercel. Supabase for data and auth.
Two small Node serverless functions in `api/` talk to BoardGameGeek (BGG).

## Layout
- `*.html` at root: one page each. URL routes are in `vercel.json` (e.g. `/u/:slug` -> `shelf.html`).
- `js/`: browser modules, imported directly (esm.sh for deps). `js/config.js` holds the public Supabase URL/anon key.
- `css/`: stylesheets.
- `api/`: Vercel functions. `api/_lib/` has BGG XML parsing, HTTP helpers, server Supabase client.
- `scripts/`: one-off sync/migration scripts (Node and Python).
- `supabase/migrations/`: SQL, applied via Supabase SQL editor or `supabase db push`.
- `docs/`: feature specs. Read one only when working on that feature; do not read the folder wholesale.
- `covers/`, `assets/`, `AppIcon_assets/`, `vendor/`: images, fonts, minified libs. Never read these.
- `games.json`: legacy 400KB seed data (array of `{bggId, title, players, time, weight, ...}`). Do not read it; grep for a field if needed.

## Commands
- `npm test` runs the BGG parser unit tests (`api/_lib/bgg.test.mjs`, `api/cover.test.mjs`).
- `vercel dev` serves the site locally on :3000. Needs `.env` (see `.env.example`).

## Rules
- Secrets: `SUPABASE_SERVICE_ROLE_KEY` and `BGG_API_TOKEN` live in `.env` only and are used by `api/` and `scripts/`. Never put them in `js/` or HTML.
- Keep changes minimal and targeted. Prefer `grep` for a symbol over reading whole files; the big HTML pages (`shelf.html`, `vote-swipe.html`) are 40 to 130KB.
- Run `npm test` after touching `api/_lib/bgg.js` or `api/cover.js`. Nothing else has tests.
- Match existing style: plain ES modules, no framework, no TypeScript.

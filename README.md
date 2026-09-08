# BoardgameShelf

A board-game collection you can hand to friends: sign in, give it your
BoardGameGeek username, sync, and share `/u/<yourname>`. Filters for the
night you're having, a card for every game, and a game-night vote that runs
from any phone at the table.

Static HTML/CSS/JS with no build step, served by Vercel. Supabase holds the
data and handles sign-in. Two small Node functions in `api/` talk to BGG.
Specs for every feature live in `docs/`; the multi-user design is
[`docs/claude-code-multiuser.md`](docs/claude-code-multiuser.md).

## Setting up a local dev environment

You need Node 20+ and the [Vercel CLI](https://vercel.com/docs/cli)
(`npm i -g vercel`) — it serves the static pages, applies the rewrites in
`vercel.json`, and runs the `api/` functions locally.

1. **Install the API dependencies.** They are the only dependencies; the site
   itself imports from esm.sh.

   ```bash
   npm install
   ```

2. **Point the browser at your Supabase project.** Put the project URL and
   anon key in `js/config.js`. The anon key is public by design — row-level
   security is what protects the data.

3. **Create `.env`** from `.env.example` and fill in `SUPABASE_URL` and
   `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Project Settings → API). The
   service role key is read only by `api/` and `scripts/`; it must never be
   committed or shipped to the browser.

4. **Apply the database migration.** Open the Supabase SQL editor and run
   `supabase/migrations/20260908000000_multiuser.sql` (or `supabase db push`
   if you use the Supabase CLI). It is safe to run more than once.

5. **Run it.**

   ```bash
   vercel dev
   ```

   Then open `http://localhost:3000`. `/` is the landing page,
   `/settings` is where you claim a BGG username and sync, and
   `/u/<slug>` is a shelf.

6. **Tests.** The BGG XML parsers have unit tests:

   ```bash
   npm test
   ```

## Enabling Google sign-in in Supabase

Magic-link email works out of the box. Google needs a one-time setup:

1. In [Google Cloud Console](https://console.cloud.google.com/) create an
   OAuth 2.0 Client ID of type *Web application*. Add
   `https://<project-ref>.supabase.co/auth/v1/callback` as an authorised
   redirect URI.
2. In Supabase → Authentication → Providers → Google, turn it on and paste
   the client ID and secret.
3. In Supabase → Authentication → URL Configuration, set the **Site URL** to
   your deployment (e.g. `https://boardgameshelf.vercel.app`) and add
   `https://boardgameshelf.vercel.app/settings`, `http://localhost:3000/settings`
   and any Vercel preview domain you use to **Redirect URLs**. Both sign-in
   methods land on `/settings`, so that path must be on the list.

Nothing in the repo changes for this; `js/auth.js` only asks Supabase for the
`google` provider.

## Running the migration script

`scripts/migrate-games-json.mjs` moves the original `games.json` collection
into the database as the shelf at `/u/noknaruephon`, curated content
included. Run it once, after the migration SQL and before deploying the
multi-user pages.

1. Sign in on the site once (so an auth user exists), then copy your user
   id from Supabase → Authentication → Users.
2. With `.env` filled in:

   ```bash
   node scripts/migrate-games-json.mjs <your-auth-user-uuid> --dry-run
   node scripts/migrate-games-json.mjs <your-auth-user-uuid> --display-name="Nok"
   ```

   The dry run prints the counts and a sample row and writes nothing.

3. Open `/u/noknaruephon` and check the shelf renders as before.

Re-running is harmless before your first BGG sync. After a sync it would
overwrite the synced BGG fields for those games with the `games.json` values,
so treat it as a one-shot.

## Environment variables

See [`.env.example`](.env.example). On Vercel, add `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` under Project → Settings → Environment Variables;
`BGG_API_TOKEN` is optional.

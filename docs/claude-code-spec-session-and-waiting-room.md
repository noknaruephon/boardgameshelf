# Claude Code Spec — Game Night: Session Creation + Waiting Room (static site)

**Replaces** any earlier version of this spec that assumed Next.js. BoardgameShelf
is a static site: one `index.html`, a `covers/` folder, a `vercel.json`. No build
step, no `package.json`, no server. Everything here is vanilla JS loaded from a CDN.

**Scope:** Stages 1 and 2 of the group voting feature. Ends when a host can create a
game night, see a QR code, and watch friends join live on their phones.

**Out of scope (do not build):** the swipe screen, vote submission, results
aggregation. Later specs. Stop at "Start Voting" flipping the session status — the
page it navigates to may 404 for now.

---

## 0. Environment and working rules

- **Branch and open a PR targeting `main`.** Do not push to `main` directly.
- **Ship dark.** This feature merges to `main` in stages but must not be reachable
  by a visitor until every stage is done. Add **no link, button, or nav item**
  pointing at the new pages from `index.html` or anywhere else. The pages exist and
  work; nothing on the site leads to them. The entry point lands in a final PR.
- **Additive only, with one possible exception** (see §3). `index.html` is being
  reworked in parallel for a card-grid redesign and a palette audit — avoid touching
  it. If you believe you must, stop and explain in the PR instead of proceeding.
- **You cannot test the QR flow in the sandbox.** It needs a real phone hitting a
  real URL. Verification happens on the **Vercel preview deployment** the PR creates.
- **The database is fully set up.** Tables, RLS policies, realtime, and three RPC
  functions all exist. Do not write migrations or alter the schema.

---

## 1. Configuration: keys are hardcoded, deliberately

**Important and counterintuitive:** the Vercel environment variables on this project
are useless here. Environment variables are substituted at build time, and a static
site has no build step. The Supabase URL and anon key must be written directly into
the JavaScript.

This is safe and is how Supabase is designed to be used from a browser. The anon key
is a public identifier, not a secret; access is controlled by the row-level security
policies and the RPC functions in the database, not by hiding the key.

**`SUPABASE_SERVICE_ROLE_KEY` must never appear anywhere in this repo.** It is a real
secret. It is also now entirely unused — nothing in this architecture needs it.

Create `js/config.js`:

```js
export const SUPABASE_URL = 'https://<project-ref>.supabase.co';
export const SUPABASE_ANON_KEY = '<anon key>';
```

Ask the user for these two values, or read them from the Supabase dashboard if you
have access. **Do not invent placeholder values and leave them in** — the PR should
either contain the real values or clearly flag that the user must fill them in.

---

## 2. Pretty URLs via `vercel.json`

The QR code encodes a URL that gets read aloud at a table, so it should be legible:
`boardgameshelf.vercel.app/vote/FOX7`.

`vercel.json` already exists and contains configuration for the covers optimisation.
**Merge into it — do not replace it.** Add a `rewrites` array (or extend the existing
one):

```json
{
  "rewrites": [
    { "source": "/night/new",        "destination": "/night-new.html" },
    { "source": "/night/:code/host", "destination": "/night-host.html" },
    { "source": "/vote/:code",       "destination": "/vote.html" }
  ]
}
```

Rewrites keep the pretty URL in the address bar while serving the underlying file.
Each page reads its own session code from `window.location.pathname`, not from a
query string.

If `vercel.json` already has a `rewrites` array, append to it rather than creating a
second one. If it has `routes` instead (the older syntax), the two cannot be mixed —
flag this in the PR rather than guessing at a migration.

---

## 3. Game data and filters — investigate first

The new pages need the game collection and the same player-count / duration / weight
filtering the shelf already does.

**Before writing anything, determine where that data and logic currently live** and
report your finding in the PR. Likely one of:

- **A separate JSON file** fetched by `index.html` — ideal. Fetch the same file from
  the new pages. Purely additive, nothing to change.
- **Inline in `index.html`** — awkward, because reusing it means touching a file
  that's being reworked in parallel.

If it's inline, **do not duplicate the filter logic into a second file.** Two copies
will drift and the shelf and the voting deck will disagree about what "Quick" means.
Instead, stop and describe the situation in the PR with a recommendation. The likely
right answer is a pure extraction into `js/games.js` with no behaviour change, but
that's the user's call to make given the parallel work, not yours.

---

## 4. Files to create

```
js/config.js          — Supabase URL + anon key (§1)
js/supabase.js        — client setup (§5)
js/session.js         — the three database calls (§6)
js/presence.js        — waiting-room presence (§7)
js/waiting-room.js    — shared waiting-room rendering (§10)
night-new.html        — Start Game Night (§8)
night-host.html       — host waiting room (§9)
vote.html             — join + participant waiting room (§9)
```

Load Supabase from a CDN as an ES module:

```js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
```

For QR generation, `https://esm.sh/qrcode@1` renders to a canvas. Any equivalent
library is fine; keep it to one.

Use `<script type="module">` in the HTML files so imports work without a bundler.

---

## 5. `js/supabase.js`

```js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: {
    // Fast enough to notice a dropped phone quickly, slow enough to stay well
    // inside the Supabase free-tier message budget.
    params: { eventsPerSecond: 5 },
  },
});
```

---

## 6. `js/session.js` — the three database calls

There is no application server. The rules that would have lived in API routes are
database functions instead, already created. Call them with `.rpc()`.

```js
import { supabase } from './supabase.js';

/** Returns the new session code, e.g. "FOX7". */
export async function createGameNight({ hostName, mode, revealDeck, gameIds }) {
  const { data, error } = await supabase.rpc('create_game_night', {
    p_host_name: hostName,
    p_mode: mode,
    p_reveal_deck: revealDeck,
    p_game_ids: gameIds,
  });
  if (error) throw error;
  return data;
}

/** Returns the final, disambiguated name — may differ from what was typed. */
export async function joinGameNight(code, name) {
  const { data, error } = await supabase.rpc('join_game_night', {
    p_code: code,
    p_name: name,
  });
  if (error) throw error;
  return data;
}

export async function startVoting(code) {
  const { error } = await supabase.rpc('start_voting', { p_code: code });
  if (error) throw error;
}

export async function fetchSession(code) {
  const { data, error } = await supabase
    .from('sessions')
    .select('code, host_name, mode, reveal_deck, game_ids, status')
    .eq('code', code)
    .maybeSingle();
  if (error) throw error;
  return data; // null when missing or expired
}
```

**Error handling.** The database raises named errors that must become human
sentences, not raw text dumped on screen:

| Raised | Show the user |
|---|---|
| `SESSION_NOT_FOUND` | "That game night has ended or the code is wrong." |
| `VOTING_IN_PROGRESS` | "Voting's already started — you'll catch the next round." |
| `NOT_ENOUGH_PLAYERS` | "Need at least 2 players to start." |
| `ALREADY_STARTED` | (ignore — another device already started it) |

Match on the message containing these tokens; Supabase wraps them in a Postgres
error object.

---

## 7. `js/presence.js` — the delicate part

**This is the highest-risk file in the spec. Implement the behaviour as described.**

Two sources of truth, deliberately separate:

- **Presence** (ephemeral, never stored) answers *who is holding a phone right now*.
  It gates the Start Voting button. There is no "leave session" action by design, so
  a closed tab, dead battery, or lost signal must lower the count on its own — only
  presence does that.
- **The `participants` table** (stored) answers *whose votes count*. It only grows. A
  disconnect must **not** remove anyone, so someone who drops and rejoins keeps their
  identity and their votes.

```js
import { supabase } from './supabase.js';

export const MIN_PLAYERS_TO_START = 2;

/**
 * Joins the session channel and reports changes via callbacks.
 * Returns a controller with a leave() method.
 *
 * @param {object}   opts
 * @param {string}   opts.code
 * @param {string}   opts.participantName  already disambiguated by join_game_night
 * @param {boolean}  opts.isHost
 * @param {function} opts.onPresence  ({ players, count, connected }) => void
 * @param {function} opts.onStatus    (status) => void
 */
export function joinSessionChannel({
  code,
  participantName,
  isHost,
  onPresence,
  onStatus,
}) {
  const channel = supabase.channel(`session:${code}`, {
    config: { presence: { key: participantName } },
  });

  function sync() {
    const state = channel.presenceState();

    // presenceState() returns { [key]: metas[] }. One participant can briefly hold
    // more than one meta — a phone reconnecting before the old socket times out.
    // Collapse to one entry per key, or the count double-reports the same human
    // and the two-player gate unlocks with one person in the room.
    const players = Object.values(state)
      .map((metas) => metas[0])
      .filter(Boolean)
      .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));

    onPresence({ players, count: players.length, connected: true });
  }

  channel
    .on('presence', { event: 'sync' }, sync)
    .on('presence', { event: 'join' }, sync)
    .on('presence', { event: 'leave' }, sync)
    // Status lives in the database, not in presence: it must survive a refresh and
    // be identical on every device. This row change is what moves the whole table
    // from waiting to voting at the same instant.
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'sessions',
        filter: `code=eq.${code}`,
      },
      (payload) => {
        if (payload.new?.status) onStatus(payload.new.status);
      }
    )
    .subscribe(async (status) => {
      if (status !== 'SUBSCRIBED') return;

      // track() MUST run after SUBSCRIBED. Called earlier it fails silently: the
      // person looks connected on their own screen but is invisible to everyone
      // else. This is the single most common way this breaks.
      await channel.track({
        name: participantName,
        isHost,
        joinedAt: new Date().toISOString(),
      });
    });

  return {
    leave() {
      // untrack() before removeChannel() so other devices see the drop promptly
      // instead of waiting out the server-side presence timeout.
      channel.untrack().catch(() => {});
      supabase.removeChannel(channel);
    },
  };
}
```

Also call `leave()` on `pagehide` so a phone locking or a tab closing drops the
count without waiting for a timeout.

---

## 8. `night-new.html` — Start Game Night

Three steps in one page, using local JS state. No navigation between steps.

### Step A — Filters
Reuse the shelf's player count / duration / weight filters (see §3). Show a live
match count: "42 games match".

### Step B — Mode
Two buttons: **Pick games myself** / **Surprise us**.

### Step C1 — Manual
- Filtered games in a selectable grid, matching the shelf's card styling.
- **Soft minimum of 4.** Below that the confirm button is disabled, with the hint
  "Pick at least 4 games to make voting worthwhile." No maximum.
- **Reveal/hide toggle**, default **hidden**. Word it by outcome, not mechanism:
  "Show the games in the waiting room" / "Keep them a surprise."

### Step C2 — Surprise us
- Sample 6 at random from the filtered set.
- Show them with a **Shuffle again** button that re-samples in the browser. Nothing
  is written to the database until confirm — reshuffling must issue zero requests.
- **No reveal/hide toggle here.** The deck is always hidden; revealing your own
  surprise defeats the point. (The database enforces this regardless.)
- **Fewer than 6 games in the pool → take all of them.** Do not pad with off-filter
  games and do not error. Fewer than 2 → block with "Not enough games match these
  filters" and return to step A.

### Host name
One required text input before creating. The host is a voter, not a moderator, so
they need an identity like everyone else.

On confirm: call `createGameNight()`, store the host's name in `sessionStorage` keyed
by the returned code, then navigate to `/night/{code}/host`.

---

## 9. `night-host.html` and `vote.html`

Both read the session code from `window.location.pathname` and call `fetchSession()`.
If it returns null, show "That game night has ended or the code is wrong."

**`night-host.html`** — reads the host name from `sessionStorage`. If it's missing
(the host opened the link on a different device), prompt for a name and call
`joinGameNight()` like anyone else, but keep `isHost` true so the QR panel and Start
Voting button still render. Then render the waiting room with `isHost: true`.

**`vote.html`** — two states:

1. **Not joined** — name input. On submit, call `joinGameNight()`, store the returned
   name in `sessionStorage` keyed by code, then move to state 2.
2. **Joined** — render the waiting room with `isHost: false`.

Reading the stored name on load is what stops a mid-night refresh from creating a
duplicate participant.

---

## 10. `js/waiting-room.js` — shared rendering

**Host sees:**
- QR code encoding `${window.location.origin}/vote/${code}`. Build it from
  `window.location.origin` at runtime so it works on preview and production without
  a hardcoded domain.
- The code large, in IBM Plex Mono, plus a **Copy link** button.
- A recap line: `6 games · Surprise mode · Hidden`.
- Live roster, count, **Start Voting** button.
- Button disabled unless the count is at least 2. When disabled, show
  "Need 1 more player to start." with correct singular/plural.
- On tap: call `startVoting()`. **Do not navigate directly.** Every device including
  the host's moves on the realtime status change, so the whole table lands together.

**Participants see:**
- Live roster and count, no QR.
- "Waiting for {hostName} to start voting…"

**Both:**
- If `reveal_deck` is true, show the deck. If false, show a covered state — six
  face-down card backs — which tells people how many games are coming and is more
  interesting than an empty space.
- Mark the current user ("you") and the host ("host") in the roster.
- When status becomes `voting`, navigate to `/vote/{code}/swipe`. That page doesn't
  exist yet; a 404 is expected at this stage.

Style with the existing tokens — `--bgs-bg`, `--bgs-bg-radial`, `--bgs-plate`,
`--bgs-ivory`, `--bgs-ivory-70`, `--bgs-ivory-45`, `--bgs-gold`. Fonts: Fraunces for
display, Inter for UI, IBM Plex Mono for the session code. Introduce no new hex
values.

---

## 11. Verification

Sandbox:

- [ ] Grep the whole repo for `service_role` — zero results.
- [ ] `js/config.js` contains real values, or the PR clearly states the user must
      fill them in.
- [ ] Reshuffling on the random path issues zero network requests.
- [ ] No link to `/night/new` exists anywhere. Grep to confirm.
- [ ] `git diff --stat` against `main` shows only added files, except `vercel.json`
      (expected) and anything explained in §3.

Preview deployment — state these in the PR for the user to run:

- [ ] `/night/new` loads; **Surprise us** shows 6 games; shuffle changes them;
      confirm lands on a QR screen with a 4-character code.
- [ ] The QR resolves to a pretty URL (`/vote/FOX7`, not `/vote.html?code=FOX7`).
- [ ] Scanning from a phone → name entry → the name appears on the host's screen
      within about a second.
- [ ] Host alone: Start Voting disabled, "Need 1 more player".
- [ ] Two present: enabled. **Close the second tab → it disables again.** This is the
      core presence behaviour; if it doesn't re-disable, presence is wired wrong.
- [ ] Two people both entering "Alex" → roster shows "Alex" and "Alex 2".
- [ ] Start Voting → every device navigates at the same moment (404 expected).
- [ ] Opening `/vote/{code}` after voting started → "catch the next round" message,
      not a crash.
- [ ] The existing shelf at `/` looks and behaves exactly as before.

---

## 12. Do not build

- Swipe screen, vote writes, results, force-results — later specs.
- Accounts or auth. Names are per-session and disposable.
- Any vote-editing affordance. Votes are final by design and by database policy.
- A "leave session" button. Presence handles departures.
- Any framework, bundler, or `package.json`. This site is static and stays static.

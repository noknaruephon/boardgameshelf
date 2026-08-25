# Claude Code Spec — Game Night: Session Creation + Waiting Room

**Scope:** Stages 1 and 2 of the group voting feature. Ends when a host can create a
game night, see a QR code, and watch friends join live on their phones.

**Out of scope (do not build):** the swipe screen, vote submission, results
aggregation. Those are later specs. Stop at "Start Voting" flipping the session
status — the route it navigates to may 404 for now.

---

## 0. Environment notes (Claude Code on cloud)

This runs in a sandboxed cloud environment, which affects how you work:

- **Work on a branch and open a PR targeting `main`.** Do not push to `main` directly.
- **Ship dark: add no entry point.** This feature merges to `main` in stages, but must
  not be reachable by a visitor until every stage is complete. Do **not** add a link,
  button, nav item, or any other affordance pointing at `/night/new` from the shelf or
  anywhere else. The routes exist and work; nothing on the site leads to them. The
  entry point is added in a final PR once the whole flow is done.
- **Do not modify existing pages.** This spec is additive only — new files, new routes.
  If you believe an existing file must change, stop and say so in the PR rather than
  changing it. Shared CSS in particular is being reworked in parallel and must not be
  touched here.
- **You cannot test the QR flow in the sandbox.** QR scanning needs a real device
  hitting a real URL. Verification happens on the **Vercel preview deployment**
  that the PR generates. Build for that; don't burn time on local device testing.
- **Do not run `vercel env pull`** — it needs interactive auth you don't have.
  Environment variables are already configured in Vercel (see §1).
- **The database is already set up.** Tables `sessions`, `participants`, and
  `votes` exist in Supabase, with RLS policies and realtime enabled. Do not write
  migrations or attempt schema changes. Schema reference is in §2 for context only.
- If the dev server won't start without env vars, create a `.env.local` with
  placeholder values so `next build` type-checks; never commit it.

---

## 1. Environment variables

Already present in Vercel. Reference them by these exact names:

| Name | Exposure | Used by |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser | Supabase client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser | Supabase client |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | session-create + join routes |

**Critical:** `SUPABASE_SERVICE_ROLE_KEY` must never be imported into a client
component or any file with `'use client'`. If you find yourself needing it there,
the logic belongs in an API route instead.

**Flag to the user in your PR description if** these variables are scoped to
Production only — preview deployments need them too, and that's a dashboard
change only the user can make.

---

## 2. Database schema (already created — reference only)

```
sessions
  code          text primary key      -- 4 chars, e.g. "FOX7"
  host_name     text not null
  mode          text                  -- 'manual' | 'random'
  reveal_deck   boolean default false
  game_ids      text[] not null
  status        text default 'waiting' -- 'waiting' | 'voting' | 'done'
  created_at    timestamptz
  expires_at    timestamptz           -- defaults to now() + 6 hours

participants
  session_code    text -> sessions(code)
  name            text                 -- already disambiguated
  finished_voting boolean default false
  joined_at       timestamptz
  primary key (session_code, name)

votes
  session_code, participant_name, game_id, liked, created_at
  primary key (session_code, participant_name, game_id)
```

A Postgres function `generate_session_code()` exists and returns an unused
4-character code. **Use it** — call it via RPC rather than generating codes in JS.
It excludes ambiguous characters (no O/0, no I/1) and checks for collisions
against live sessions.

RLS is configured so that:
- Anyone can read a session/participants/votes while the session is unexpired.
- Votes can only be inserted while `status = 'voting'`, and there is **no update
  or delete policy** — votes are final by database design. Do not add code that
  attempts to edit a vote.
- Session and participant **inserts** are not permitted from the browser. They must
  go through server routes using the service-role key.

---

## 3. Dependencies to install

```
@supabase/supabase-js
qrcode.react
```

---

## 4. Repo conventions to follow

Before writing anything:

1. **Confirm the router.** Check whether the app uses the App Router (`app/`) or
   Pages Router (`pages/`). The paths below assume App Router — adapt if needed
   and note the deviation in your PR.
2. **Match the existing import alias.** Check `tsconfig.json` for whether `@/`
   maps to root or to `src/`. Adjust all imports accordingly.
3. **Use existing colour tokens.** The site defines `--bgs-bg`, `--bgs-bg-radial`,
   `--bgs-plate`, `--bgs-ivory`, `--bgs-ivory-70`, `--bgs-ivory-45`, `--bgs-gold`.
   Do not introduce new hex values. Fonts in use: Fraunces (display), Inter (UI),
   IBM Plex Mono (code/monospace — good candidate for the session code display).
4. **Reuse the existing filter logic.** The shelf already filters by player count,
   duration, and weight. Extract or reuse that — do not write a second
   implementation that can drift from the first.
5. **Reuse the existing game card component** for the selection grid where possible.

---

## 5. Files to create

```
lib/supabase-client.ts                        (§6)
lib/supabase-admin.ts                          (§7)
hooks/useSessionPresence.ts                    (§8)
app/night/new/page.tsx                         (§9)
app/api/sessions/route.ts                      (§10)
app/api/sessions/[code]/join/route.ts          (§11)
app/api/sessions/[code]/start/route.ts         (§12)
app/night/[code]/host/page.tsx                 (§13)
app/vote/[code]/page.tsx                       (§14)
components/night/WaitingRoom.tsx               (§15)
```

---

## 6. `lib/supabase-client.ts`

Browser client, anon key only.

```ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    realtime: {
      // Fast enough to detect a dropped phone quickly, slow enough to stay
      // well inside the Supabase free-tier message budget.
      params: { eventsPerSecond: 5 },
    },
  }
);
```

---

## 7. `lib/supabase-admin.ts`

Server-only client. Add a runtime guard so a stray client import fails loudly
rather than silently shipping the key to the browser.

```ts
import 'server-only';
import { createClient } from '@supabase/supabase-js';

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```

Install `server-only` if it isn't already a dependency.

---

## 8. `hooks/useSessionPresence.ts`

**This is the most delicate file in the spec. Implement it as written.**

Two sources of truth, deliberately separate:

- **Presence** (ephemeral, never persisted) answers *who is holding a phone right
  now*. It gates the Start Voting button. There is no "leave session" action by
  design, so a closed tab, dead battery, or lost signal must lower the count on
  its own — only presence does that.
- **The `participants` table** (persisted) answers *whose votes count*. It only
  grows. A disconnect must **not** delete the row, so someone who drops and
  rejoins keeps their identity and their votes.

```ts
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase-client';

export const MIN_PLAYERS_TO_START = 2;

export type SessionStatus = 'waiting' | 'voting' | 'done';

export type PresentPlayer = {
  name: string;
  isHost: boolean;
  joinedAt: string;
};

type UseSessionPresenceArgs = {
  code: string;
  /** Already-disambiguated participant name. Null = don't connect yet. */
  participantName: string | null;
  isHost: boolean;
  initialStatus: SessionStatus;
};

export function useSessionPresence({
  code,
  participantName,
  isHost,
  initialStatus,
}: UseSessionPresenceArgs) {
  const [players, setPlayers] = useState<PresentPlayer[]>([]);
  const [status, setStatus] = useState<SessionStatus>(initialStatus);
  const [connected, setConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const syncPresence = useCallback((channel: RealtimeChannel) => {
    const state = channel.presenceState<PresentPlayer>();

    // presenceState() returns { [key]: metas[] }. One participant can briefly
    // hold more than one meta — a phone reconnecting before the old socket times
    // out, or React StrictMode double-mounting in dev. Collapse to one entry per
    // key, or the count double-reports the same human and the 2-player gate
    // unlocks with one person in the room.
    const next = Object.values(state)
      .map((metas) => metas[0])
      .filter(Boolean)
      .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));

    setPlayers(next);
  }, []);

  useEffect(() => {
    if (!participantName) return;

    const channel = supabase.channel(`session:${code}`, {
      config: { presence: { key: participantName } },
    });
    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => syncPresence(channel))
      .on('presence', { event: 'join' }, () => syncPresence(channel))
      .on('presence', { event: 'leave' }, () => syncPresence(channel))
      // Status lives in Postgres, not presence: it must survive a refresh and be
      // identical on every device. This row change is what moves the whole table
      // from waiting -> voting at the same instant.
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sessions',
          filter: `code=eq.${code}`,
        },
        (payload) => {
          const nextStatus = (payload.new as { status?: SessionStatus }).status;
          if (nextStatus) setStatus(nextStatus);
        }
      )
      .subscribe(async (subStatus) => {
        if (subStatus !== 'SUBSCRIBED') return;

        // track() MUST run after SUBSCRIBED. Called earlier it fails silently:
        // the person looks connected locally but is invisible to everyone else.
        // This is the single most common way this implementation breaks.
        await channel.track({
          name: participantName,
          isHost,
          joinedAt: new Date().toISOString(),
        });
        setConnected(true);
      });

    return () => {
      // untrack() before removeChannel() so other devices see the drop promptly
      // instead of waiting out the server-side presence timeout.
      channel.untrack().catch(() => {});
      supabase.removeChannel(channel);
      channelRef.current = null;
      setConnected(false);
    };
  }, [code, participantName, isHost, syncPresence]);

  const playerCount = players.length;

  return {
    players,
    playerCount,
    status,
    connected,
    // Recomputed on every presence change, so it flips back to disabled on its
    // own if someone wanders off before the host taps start.
    canStartVoting:
      isHost && status === 'waiting' && playerCount >= MIN_PLAYERS_TO_START,
  };
}
```

---

## 9. `app/night/new/page.tsx` — Start Game Night

Three sequential steps in one screen. Keep it a single page with local state;
do not add a router step per stage.

### Step A — Filters
Reuse the shelf's existing filters: player count, duration, weight. Show a live
count of how many games match ("42 games match").

### Step B — Mode choice
Two buttons: **Pick games myself** and **Surprise us**.

### Step C1 — Manual path
- Show filtered games as a selectable grid (reuse existing card component, add a
  selected state).
- **Soft minimum of 4.** Below 4 selected, the confirm button is disabled with the
  hint "Pick at least 4 games to make voting worthwhile." No maximum.
- **Reveal/hide toggle**, default **hidden**. Label it in terms of the outcome, not
  the mechanism — e.g. "Show the games in the waiting room" / "Keep them a surprise".
  This sets `reveal_deck`.

### Step C2 — Random path
- Sample 6 games at random from the filtered set.
- Show what came up, with a **Shuffle again** button that re-samples client-side.
  Nothing is written to the database until confirm — reshuffling must not create
  rows.
- **No reveal/hide toggle on this path.** `reveal_deck` is always `false`. Revealing
  your own surprise defeats the point.
- **If the filtered pool has fewer than 6 games, take all of them.** Do not pad with
  off-filter games and do not error. If the pool has fewer than 2, block with
  "Not enough games match these filters" and send them back to step A.

### Host name
Ask for the host's name before creating the session — the host is a voter, not a
moderator, so they need an identity like everyone else. One text input, required.

On confirm → POST to `/api/sessions` → redirect to `/night/[code]/host`.

---

## 10. `app/api/sessions/route.ts` — create session

`POST` accepting `{ hostName, mode, revealDeck, gameIds }`.

1. Validate: `gameIds` non-empty, `mode` is `'manual' | 'random'`, `hostName` non-empty.
2. Force `revealDeck` to `false` when `mode === 'random'` — don't trust the client
   to have honoured that rule.
3. Get a code: `supabaseAdmin.rpc('generate_session_code')`.
4. Insert the session row with `status: 'waiting'`.
5. Insert the host into `participants` immediately — this is what makes them
   participant #1 and counts them toward the 2-player minimum.
6. Return `{ code, hostName }`.

---

## 11. `app/api/sessions/[code]/join/route.ts` — join session

`POST` accepting `{ name }`.

1. Look up the session. 404 if missing.
2. **If `status !== 'waiting'`, return 409** with a `VOTING_IN_PROGRESS` code. The
   participant list locks once voting starts; late scanners sit the round out
   rather than being dropped into a half-finished deck.
3. Read all existing participant names for the session.
4. **Disambiguate**, case-insensitive and whitespace-normalised, so "alex" and
   "Alex " collide with "Alex":

```ts
function disambiguate(raw: string, taken: string[]): string {
  const base = raw.trim().replace(/\s+/g, ' ');
  const lowerTaken = new Set(taken.map((n) => n.toLowerCase()));
  if (!lowerTaken.has(base.toLowerCase())) return base;
  let n = 2;
  while (lowerTaken.has(`${base} ${n}`.toLowerCase())) n++;
  return `${base} ${n}`;
}
```

5. Insert the participant with the final name.
6. Return `{ name: finalName }`. The client stores this and uses it as its
   presence key from then on — **not** the raw typed name.

---

## 12. `app/api/sessions/[code]/start/route.ts` — begin voting

`POST`, no body.

1. **Re-check the participant count server-side** before flipping status. The
   client-side gate is a UI affordance, not a guarantee — someone could drop
   between render and tap. Reject with 409 if fewer than 2 participants exist.
2. Update `status` to `'voting'`.
3. Return 200. **Do not return a redirect** — every device navigates off the
   realtime status change, including the host's.

---

## 13. `app/night/[code]/host/page.tsx` — host view

Server component. Fetch the session by code; 404 if missing or expired. Pass
`isHost={true}`, the host's name, and the session status into `<WaitingRoom />`.

The host name needs to survive a refresh. Simplest approach: set it in a cookie
when the session is created, read it here. Note your choice in the PR.

---

## 14. `app/vote/[code]/page.tsx` — participant view

Two states in one route:

1. **Not yet joined** — name input, submit to the join API. On a 409, show
   "Voting's already started — you'll catch the next round." rather than a raw error.
2. **Joined** — render `<WaitingRoom />` with `isHost={false}` and the returned
   disambiguated name.

Persist the joined name in `sessionStorage` keyed by session code, so a refresh
mid-night doesn't create a duplicate participant.

---

## 15. `components/night/WaitingRoom.tsx`

Shared by both views, branching on `isHost`.

**Host sees:**
- QR code (`QRCodeSVG` from `qrcode.react`) encoding `${window.location.origin}/vote/${code}`.
  Read `origin` on the client via `useEffect` so it works on localhost, preview, and
  production without a hardcoded domain.
- The code in large monospace, plus a **Copy link** button.
- A recap line: `6 games · Surprise mode · Hidden` — a sanity check on what they set up.
- Live roster, count, and the **Start Voting** button.
- Button disabled unless `canStartVoting`. When disabled and connected, show
  "Need 1 more player to start." (singular/plural correct).

**Participants see:**
- Live roster and count, no QR.
- "Waiting for {hostName} to start voting…"

**Both:**
- If `reveal_deck` is true, show the deck. Otherwise show a covered state — e.g. six
  face-down card backs — which is more fun than hiding the section entirely and
  communicates how many games are coming.
- Mark the current user in the roster ("you") and the host ("host").

**Navigation:** when `status` becomes `'voting'`, push to `/vote/${code}/swipe`.
That route doesn't exist yet — expected, and fine.

---

## 16. Verification checklist

Sandbox checks:

- [ ] `next build` passes with no type errors.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` appears **only** in files under `app/api/` or in
      `lib/supabase-admin.ts`. Grep to confirm.
- [ ] No `'use client'` file imports `lib/supabase-admin.ts`.
- [ ] Reshuffling on the random path issues zero network requests.
- [ ] **No link to `/night/new` exists anywhere in the app.** Grep for it — the only
      occurrences should be the route file itself and this spec.
- [ ] `git diff --stat` against `main` shows **only added files**, no modified ones.
      A modified existing file means the change is no longer additive; explain it in
      the PR.

Preview-deploy checks (state these in the PR for the user to run):

- [ ] Create a night with **Surprise us** → 6 games appear → shuffle changes them →
      confirm → QR screen shows a 4-character code.
- [ ] Scan the QR from a phone → name entry → joining shows the name on the host's
      screen within about a second.
- [ ] With only the host present, Start Voting is disabled and shows "Need 1 more player".
- [ ] With 2 present, it enables. **Close the second tab → it disables again.**
      (This is the core presence behaviour — if it doesn't re-disable, presence is
      wired wrong.)
- [ ] Two people both entering "Alex" → roster shows "Alex" and "Alex 2".
- [ ] Tap Start Voting → **every device navigates at the same moment** (a 404 on the
      swipe route is expected at this stage).
- [ ] Open `/vote/[code]` after voting has started → "catch the next round" message,
      not a crash.

---

## 17. Do not build

- Swipe screen, vote writes, results, force-results button — later specs.
- Accounts, auth, or persistent user identity. Names are per-session and disposable.
- Any vote editing affordance. Votes are final by design and by RLS.
- A "leave session" button. Presence handles departures.

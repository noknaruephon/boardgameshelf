---
name: run-game-night
description: Launch and drive the Game Night pages (night-host.html stage lobby, vote.html waiting room, vote-swipe.html, results.html) in headless Chromium with Supabase, presence and the esm.sh QR import stubbed. Use to see a change on those pages working, to screenshot their states, or to run the lobby-stage verification checklist.
---

# Run the Game Night pages

The game-night pages need Supabase (session rows + realtime presence), an
`esm.sh` import for the QR encoder and Google Fonts. None of those are
reachable from the browser in a Claude Code cloud container, so the pages
never get past their loading shells there. This harness serves the repo root,
opens a page in the pre-installed Chromium at phone size, and answers those
requests locally. Everything else — the HTML pages, `js/waiting-room.js`,
`js/swipe.js`, `js/scroll-lock.js`, `js/cover-light.js`, the game modal, every
stylesheet — is the real code.

Covered: `night-host.html` (host), `vote.html` (vote), `vote-swipe.html`
(swipe), `results.html` (results). Not covered: `tv.html`, which imports
`js/supabase.js` directly and would need a client stub.

Verified 2026-09-26 on a fresh container (Node 22, Playwright 1.63, Chromium
from `/opt/pw-browsers`).

## Setup (once per container)

```bash
cd .claude/skills/run-game-night/harness
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install   # playwright package only; the browser is pre-installed
npm run fonts                                     # curl (through the proxy) fetches Fraunces/Inter/Plex Mono into fonts/
```

Skipping `npm run fonts` still works; pages render in system fonts and
setup.mjs prints a warning.

## Run

```bash
npm run smoke                              # all four pages, one interaction each, ~40 s
node smoke.mjs host '?d=7&reveal=1&theme=navy'   # one page, any fixture/flag query
node smoke.mjs results '?votes=tie&players=Nok,Mai,Ploy'
npm run checklist                          # the lobby-stage spec's verification checklist, ~99 checks, ~90 s
```

Screenshots land in `harness/shots/` (gitignored). Look at them — a blank
frame or the four-card `.deal` loading shell means the page did not boot.
Both scripts exit 1 on any FAIL and print page errors.

### Fixture knobs (query string on the page URL)

| Param | Effect |
| --- | --- |
| `d=5` | deck size (default 5) |
| `status=waiting` | session status; `openPage` adds `voting` for swipe and `done` for results unless set |
| `players=Nok,Mai` | participants from the durable record (results denominators); first is the host |
| `reveal=1` | deck shown (covers are generated SVGs with the title on them) |
| `mode=random` | "picked at random" in the host's sub line |
| `round=1` | session round |
| `myvotes=N` | this device already voted on the first N games (swipe resumes at N+1) |
| `votes=win\|tie\|nobody\|partial` | everyone's votes for the results tally (default `win`) |
| `broken=1` | game 2 gets a 404 cover, to see the `onerror` fallback |
| `lobby=0`, `tv=1`, `theme=navy`, `glass=0` | the pages' own flags, untouched |

`newPage({ name: null })` leaves the device un-joined, to see the name gates.

Presence is driven from the test: `await push(page, ['Nok', 'Mai', 'ปลาย'])`
seats a table (first name is the host), or pass metas
`[{ name, isHost, finished }]` for the swipe/results rosters.
`window.__pushStatus('voting')` and `window.__pushSession({ status, round,
game_ids })` drive the status branches. What the page asked the stubs to do is
on `window`: `__started`, `__cancelled`, `__votes`, `__finished`, `__forced`,
`__rematch`, `__markedFinished`, `__rematchRequested`, `__qrCalls`.

## What is stubbed, what is real

| Request | Served by |
| --- | --- |
| `/night/:code/host`, `/vote/:code`, `/vote/:code/swipe`, `/results/:code` | the matching HTML file from disk (the Vercel rewrites) |
| `/js/session.js`, `/js/presence.js`, `/js/shelf-data.js` | `harness/stubs/` — same exports, fixture data, no network |
| `https://esm.sh/qrcode@1.5.3` | `stubs/qrcode.js`: a deterministic module grid, **not a scannable code** |
| Google Fonts | `fonts/` from `npm run fonts` |
| `/u/nok` (after Cancel) | a one-line page so the navigation resolves |
| anything else off-origin | aborted (the Cast SDK on the TV sheet logs one `ERR_FAILED`; harmless) |

Not verifiable here: real QR scanning, real presence over Supabase, the
database RPC error paths (the stubs never throw), and anything
WebKit/Safari-specific (only Chromium is installed). Say so in the report
when those matter.

## Writing a new check

`setup.mjs` exports `launch, newPage, openPage, open, push, shot, css, text,
has, check, log, sleep, PAGES, ORIGIN, CODE, finish`. Pattern:

```js
import { launch, newPage, openPage, push, shot, text, check, finish } from './setup.mjs';
await launch();
const page = await newPage();               // or newPage({ reducedMotion: 'reduce', name: null })
await openPage(page, 'swipe', '?d=3&myvotes=1');
await page.click('#btnPlay');
check('vote recorded', (await page.evaluate(() => window.__votes.length)) === 1);
await shot(page, 'my-state');
await finish();
```

`open(page, query)` is the host-page shortcut the checklist uses (waits for
the start button too).

## Gotchas that cost time

- **Route globs stop at `?`.** `**/night/*/host` does not match
  `/night/5G37/host?lobby=0`; the page routes are pathname predicates.
- **A hanging stylesheet blocks the module script.** With Google Fonts
  unreachable the page sat 8 s before booting; abort or serve every off-origin
  request, never leave one pending.
- **Rotated cards lie to `getBoundingClientRect`.** Measure fan cards with
  `offsetWidth`/`offsetTop`; the bounding box of a rotated element is bigger.
- **Clipboard feedback is async.** After clicking Copy, `waitForFunction` on the
  `aria-label` before asserting, or the check races the promise.
- **The results reveal is a multi-second count.** Wait for the final headline
  ("Tonight we play" / "It's a tie" / "Nobody's feeling it tonight"), not for a
  class on `#stage`; "The table has decided" is a mid-reveal line.
- **Full-page screenshots follow `scrollWidth`.** A screenshot wider than 390
  CSS px means something overflows horizontally; the swipe smoke checks it.
- **Routes match last-registered-first.** The catch-all abort is registered
  first in `newPage()` so the specific routes win.
- **`pkill -f http.server` kills your own shell** (its command line matches).
  `launch()` reuses a server already listening on 8123; never kill one by pattern.
- **`.claude/*` is gitignored.** The root `.gitignore` un-ignores
  `.claude/skills/` so this skill is tracked; keep that line.

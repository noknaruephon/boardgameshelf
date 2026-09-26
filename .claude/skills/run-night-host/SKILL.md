---
name: run-night-host
description: Launch and drive the Game Night host page (night-host.html, the stage lobby) in headless Chromium with Supabase, presence and the esm.sh QR import stubbed. Use to see a change on that page working, to screenshot its states, or to run the lobby-stage verification checklist.
---

# Run night-host.html

The host's waiting room needs Supabase (session + realtime presence), an
`esm.sh` import for the QR encoder and Google Fonts. None of those are
reachable from the browser in a Claude Code cloud container, so the page never
gets past its loading shell there. This harness serves the repo root, opens the
page in the pre-installed Chromium at phone size, and answers those requests
locally. Everything else — `night-host.html`, `js/waiting-room.js`,
`js/scroll-lock.js`, the game modal, every stylesheet — is the real code.

Verified 2026-09-26 on a fresh container (Node 22, Playwright 1.63, Chromium
from `/opt/pw-browsers`).

## Setup (once per container)

```bash
cd .claude/skills/run-night-host/harness
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install   # playwright package only; the browser is pre-installed
npm run fonts                                     # curl (through the proxy) fetches Fraunces/Inter/Plex Mono into fonts/
```

Skipping `npm run fonts` still works; the page renders in system fonts and
setup.mjs prints a warning.

## Run

```bash
npm run smoke                 # boots the stage, pushes a second player, 2 screenshots, ~10 s
node smoke.mjs '?d=7&reveal=1&theme=navy'   # any fixture/flag query
npm run checklist             # the spec's verification checklist, ~99 checks, ~90 s
```

Screenshots land in `harness/shots/` (gitignored). Look at them — a blank
frame or the four-card `.deal` loading shell means the page did not boot.
Both scripts exit 1 on any FAIL and print page errors.

### Fixture knobs (query string on the page URL)

| Param | Effect |
| --- | --- |
| `d=5` | deck size (default 5) |
| `reveal=1` | deck shown (covers are generated SVGs with the title on them) |
| `mode=random` | "picked at random" in the sub line |
| `broken=1` | game 2 gets a 404 cover, to see the `onerror` fallback |
| `lobby=0`, `tv=1`, `theme=navy`, `glass=0` | the page's own flags, untouched |

Players come from `window.__pushPlayers([...])` (the presence stub), so a
script can seat a table: `await push(page, ['Nok', 'Mai', 'ปลาย'])`. The first
name is the host. `window.__pushStatus('voting')` drives the status branch.
`window.__started`, `window.__cancelled` and `window.__qrCalls` record what the
page asked the stubs to do.

## What is stubbed, what is real

| Request | Served by |
| --- | --- |
| `/night/:code/host` | `night-host.html` from disk (the Vercel rewrite) |
| `/js/session.js`, `/js/presence.js`, `/js/shelf-data.js` | `harness/stubs/` — same exports, fixture data, no network |
| `https://esm.sh/qrcode@1.5.3` | `stubs/qrcode.js`: a deterministic module grid, **not a scannable code** |
| Google Fonts | `fonts/` from `npm run fonts` |
| `/u/nok` (after Cancel) | a one-line page so the navigation resolves |
| anything else off-origin | aborted (the Cast SDK on the TV sheet logs one `ERR_FAILED`; harmless) |

Not verifiable here: real QR scanning, real presence over Supabase, and
anything WebKit/Safari-specific (only Chromium is installed). Say so in the
report when those matter.

## Writing a new check

`setup.mjs` exports `launch, newPage, open, push, shot, css, text, has, check,
log, sleep, finish`. Pattern:

```js
import { launch, newPage, open, push, shot, text, check, finish } from './setup.mjs';
await launch();
const page = await newPage();               // or newPage({ reducedMotion: 'reduce' })
await open(page, '?d=10');
await push(page, ['Nok', 'Mai']);
check('ready label', (await text(page, '#startBtn')) === 'Start voting · 2 players');
await shot(page, 'my-state');
await finish();
```

## Gotchas that cost time

- **Route globs stop at `?`.** `**/night/*/host` does not match
  `/night/5G37/host?lobby=0`; the host route is a URL predicate for that reason.
- **A hanging stylesheet blocks the module script.** With Google Fonts
  unreachable the page sat 8 s before booting; abort or serve every off-origin
  request, never leave one pending.
- **Rotated cards lie to `getBoundingClientRect`.** Measure fan cards with
  `offsetWidth`/`offsetTop`; the bounding box of a rotated element is bigger.
- **Clipboard feedback is async.** After clicking Copy, `waitForFunction` on the
  `aria-label` before asserting, or the check races the promise.
- **Routes match last-registered-first.** The catch-all abort is registered
  first in `newPage()` so the specific routes win.
- **`.claude/*` is gitignored.** The root `.gitignore` un-ignores
  `.claude/skills/` so this skill is tracked; keep that line.

## Extending to other game-night pages

`vote.html`, `vote-swipe.html` and `results.html` import the same three
Supabase modules; the same stubs and `newPage()` routes apply once the
`/vote/:code` rewrite is added next to the host one in `setup.mjs`.

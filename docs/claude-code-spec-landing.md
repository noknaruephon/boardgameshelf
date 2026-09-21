# Spec: New landing page

**Mockup (locked):** `docs/mockups/landing-full.html`. It has a demo bar at the top (hero states, jump links, reduced motion). Its CSS and JS are split by banner comments: `HERO`, `STORY`, `Three steps`, `Rest of the page`, `CLOSING`, and in the script `hero`, `story`, `closing (F8)`, `page glue`. Read it one banner at a time, for the commit you are on. Do not read it whole.
**Data (provided):** `js/landing-data.js` (hand it in as is). Ten real games and thirty real covers. Do not open `games.json`.
**New files:** `landing-next.html`, `css/landing.css`, `js/landing-hero.js`, `js/landing-story.js`, `js/landing-close.js`, `js/landing-data.js`
**Touched:** `vercel.json` (one rewrite, one image size)
**Untouched in this spec:** `landing.html` stays live at `/` until I have tested the new page on my phone. Swapping the route is a separate, one-line task at the end.
**Commits:** four, in order. Stop for review after each.

## How it ships

The new page is built as `landing-next.html` and served at `/next`. Nothing links to it. Add to `vercel.json`:

```json
{ "source": "/next", "destination": "/landing-next.html" }
```

and add `<meta name="robots" content="noindex">` to `landing-next.html` until the swap. No URL flag is needed: the file is the flag.

Also add `160` to `images.sizes` in `vercel.json` (it becomes `[160, 384, 1080]`). The wall, the floor and the mini covers are drawn at 40 to 180px; 384 for each of them is what made the closing section slow in testing.

## What the page is

Top to bottom:

1. **Hero.** Headline "Pick tonight's game, together." and a playable five-card vote with four simulated friends. Behind it, a faint tilted wall of covers with the cover light over it. The vote always ends on exactly one winner.
2. **Story.** "From the shelf to the table in four steps". One phone stays pinned while four steps scroll past (Shelf, Pick, Vote, Play). Pieces of each screen float around the phone.
3. **Also on the shelf.** Five feature cards.
4. **Three steps to your own shelf.** Big outlined numerals on a dashed path. No cards.
5. **Closing.** The real sign-in. A floor of covers in perspective runs to a gold horizon, the cover light drifts over it, and small pieces of a vote float around the headline and the Google button.
6. **Footer.** The existing `.shelf-footer`, unchanged.

Plus one floating Liquid Glass button on phones, "Get your shelf", which scrolls to the closing section and slides away when that section is on screen.

## Hard constraints (house rules)

- **WebKit rule.** Never `animation` and `transition` on the same property of the same element. The mockup already splits every moving thing into an outer element that transitions and an inner one that animates, and says so in comments. Keep the split. The cases:

| Thing | Transition only | Animation only |
|---|---|---|
| Hero deck | `.slot` (stack position), `.card.snap` (fling / snap back) | none |
| Cover light (hero, closing) | `.light img` opacity | none. Never add one |
| Cover wall, floor | none | `.col` drift, `.drift` towards. The floor's tilt is on `.plane`, static |
| Seat chips, pips, minis | `.chip`, `.pips i`, `.mini` | blinking dots `.dots i` (own elements) |
| Winner | none | `.winner` crown, `.flash`, confetti (Web Animations API on fresh elements) |
| Story phone, screens | `.a-phone`, `.scr` | none |
| Floating pieces (story, closing) | outer `.frag` / `.pz` fly-in | inner child `bob` / `bob8` |
| Glass button | `transform` only, per `css/glass.css` | none |

- Focus rings are `box-shadow`, never `outline`. Gold rings are `box-shadow`, never `border` on glass.
- Tokens come from `css/base.css`. Delete the mockup's `:root` block; it only exists because the mockup is a single file. Everything must hold on Walnut, Navy, Mahogany and Oak: every veil and fade uses `--bgs-bg` / `--bgs-bg-rgb`.
- Plain ES modules, absolute import paths.
- Keep the head of `landing.html` as is in the new file: meta and OG tags, icons, the theme resolver script, `base.css`, `beta-tag.js`, Vercel insights. Add `css/glass.css` and `css/landing.css` after `base.css`.

## Images

Every cover goes through `sizedCover(url, width)` from `/js/shelf-data.js`:

| Use | Width |
|---|---|
| Hero deck cards, hero winner, story "crown" and vote card | 384 |
| Hero wall, hero mini covers, story grid tiles, closing floor, closing pieces | 160 |
| Cover light source (hero and closing) | 160 (it is blurred at 160×200 and scaled up) |

The light must use the exact string the visible `<img>` for that cover uses when there is one, so it is a cache hit.

The mockup sets `referrerpolicy="no-referrer"` and falls back to colour stand-ins (`coverFail`, `STANDIN`) when a cover fails. **Production does neither.** A failed cover hides itself (`onerror="this.style.visibility='hidden'"`), and a failed light image loses `.on`.

The wall and the floor are `loading="lazy" decoding="async"`. The five hero deck images are eager.

---

## Commit 1: the static page and the real sign-in

Build the whole page with no demo scripts: every section in its resting state, the real sign-in working.

**Structure of `landing-next.html` body**

```
.hero            header (.bgs-wordmark + Beta button, "Sign in" link to #signin)
                 copy: h1, lede, .cta (glass "Get your shelf" → #signin, text link "See how it works" → #story)
                 .table: seats row, deck showing the first card, ✕ / counter / ✓   (inert in this commit)
section#story    intro, pinned phone showing the Shelf screen, the four steps, tabs
section          "Also on the shelf": five .x cards
section          "Three steps to your own shelf": ol.path
section#signin   closing: headline, sub, THE REAL SIGN-IN BLOCK
footer.shelf-footer   copied verbatim from landing.html
.sticky          the floating glass button (phones only)
```

**The wordmark.** Use the production markup, not the mockup's span:

```html
<p class="mark bgs-wordmark">BoardgameShelf<button type="button" class="bgs-beta" aria-label="Beta — about this label">Beta</button></p>
```

**The sign-in block.** Move `#signIn` and `#signedIn` from `landing.html` into the closing section **with their ids, their children and the whole inline module script unchanged**: `#googleBtn`, `#gsiBtn` inside `.google-wrap`, `#emailToggle`, `#emailPanel`, `#emailForm`, `#email`, `#emailBtn`, `#msg`, `#guestLine`, `#guestLink`, `#hello`, `#shelfLink`. The Google Identity overlay depends on `.google-wrap` being `position:relative` and `#gsiBtn` covering the gold button exactly, so:

- The gold button keeps `.btn.gold` behaviour but takes the mockup's closing look: pill (`border-radius:99px`), `min-height:60px`, `width:min(100%,360px)` centred, the glow halo behind it (`.ctawrap` + `.halo`). `.google-wrap` gets the same width and `border-radius:99px; overflow:hidden` so Google's transparent control cannot spill past the pill.
- `renderButton` is already called with `shape:'pill'` and a measured width. Leave that code alone.
- "Prefer email?" and "Just looking?" become the two centred lines under the button (`.alts` in the mockup). Keep `#guestLine` hidden until `fetchPublicShelves()` resolves, as today. The mockup hard-codes the guest link; production keeps the fetched one.
- The email panel opens under the links, inside the focal block, `max-width:360px`. `#msg` sits under it.

**Signed-in visitors.** Keep today's logic: no profile slug → `location.replace('/welcome')`. With a slug, today's page hides `#signIn` and shows `#signedIn`. Do the same, and also:

- both "Get your shelf" buttons (hero and floating) change to "Open your shelf" and point at `/u/{slug}`; drop their down arrow,
- the closing headline stays; `#signedIn` ("Welcome back, …", Open your shelf, Settings & sync) replaces the sign-in block inside the focal block.

**The glass button.** Do not re-declare the glass material. Use the production class and add one modifier in `css/landing.css`:

```html
<a class="glass fab" href="#signin">Get your shelf <svg …down arrow…></svg></a>
```

```css
/* Primary-on-glass: the .glass recipe with a gold tint and a stronger gold rim. Transform is the only thing that transitions (css/glass.css rule). */
.fab{display:flex;align-items:center;justify-content:center;gap:9px;min-height:56px;border-radius:99px;
  font-weight:700;font-size:16.5px;color:var(--bgs-gold-hover);text-decoration:none}
.fab.glass{
  background:
    linear-gradient(135deg,var(--glass-sheen) 0%,transparent 38%,transparent 70%,rgba(var(--bgs-ivory-rgb),.04) 100%) var(--light-x) 0 / 220% 100% no-repeat,
    linear-gradient(rgba(var(--bgs-gold-rgb),.20),rgba(var(--bgs-gold-rgb),.12)),
    rgba(var(--bgs-plate-rgb),var(--glass-fill-a));
  box-shadow:var(--glass-focus),inset 1px 1px 0 var(--glass-rim-light),inset -1px -1px 0 rgba(0,0,0,.45),
    inset 0 0 0 1px rgba(var(--bgs-gold-rgb),.55),0 0 28px rgba(var(--bgs-gold-rgb),.22),var(--glass-shadow)}
.fab:active{transform:scale(.97)}
.cta .fab{padding:0 30px}
.sticky{position:fixed;left:16px;right:16px;bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:40;display:flex;justify-content:center;pointer-events:none;transition:transform .35s var(--ease-liquid)}
.sticky .fab{pointer-events:auto;width:min(100%,420px)}
.sticky.away{transform:translateY(160%)}
@media (min-width:900px){.sticky{display:none}}
```

The floating button hides (`.away`) while at least 20% of `#signin` is on screen (IntersectionObserver, `threshold:.2`). If `?glass=0` / `localStorage.bgsGlass` has turned glass off on this device, `css/glass.css` is inert and `.fab.glass` still reads correctly because the modifier carries its own background and shadow.

**Copy (final)**

| Where | Text |
|---|---|
| h1 | Pick tonight's game, together. |
| Hero lede | Turn your BoardGameGeek collection into a page your friends vote on. Four friends are at this table. Swipe right to play, left to pass. |
| Hero buttons | Get your shelf · See how it works |
| Story h2 / intro | From the shelf to the table in four steps · The same loop every game night, minus the twenty minutes of "I don't mind, you choose." |
| Steps | copy the four titles and paragraphs from `STEPS` in the mockup's `story` script |
| Extras h2 / intro | Also on the shelf · The parts you find on the second visit. |
| Extras cards | Filter by vibe, Tonight's surprise, Bags for trips, Invite posters, Themes (text from the mockup). **No "Teach me in 60 seconds" card.** |
| Setup h2 / intro | Three steps to your own shelf · Your owned games come straight from BGG. Nothing to upload. |
| Setup steps | 1 Sign in · 2 Enter your BGG username · 3 Get your shelf (descriptions from the mockup) |
| Closing h2 / sub | Your shelf, judged by its covers. · A page for your collection and a vote for your table, from any phone. |

Only the real sign-in button says "Continue with Google".

**Commit message:** `feat(landing): new landing page at /next — static layout with the live sign-in`

**Verify before stopping:** Google sign-in (overlay and redirect fallback), email link, guest link, signed-in redirect to `/welcome`, signed-in "Welcome back" state, Beta tooltip, footer, all four themes, no horizontal scroll at 360px.

---

## Commit 2: the hero demo (`js/landing-hero.js`)

Lift the mockup's `hero` script block and the `HERO` CSS banner. Behaviour to preserve exactly:

**Background.** `.wall` (9 columns of 7 covers from `LANDING_WALL`, 6 columns on phones), `rotate(-9deg)`, `opacity:.26` (locked "Soft"), `grayscale(.75)`, columns drift 60s alternate. `.light` over it: two stacked images, 160×200, `blur(22px) saturate(1.6)`, `scale(5)` phones / `9` desktop, `.on` = `opacity:.5`, fade `.7s`. `.veil` fades to `--bgs-bg` top and bottom (stops in the mockup). The light follows the top card, then the winner.

**The table.** Five seats: two friends, You (gold ring, "You" label), a friend, the late voter. While voting, a friend's chip only says **who has voted on this card** (ivory tick), never what they voted; chips land at 450, 970 and 1490 ms after a card appears and are cancelled if the visitor votes first. The late voter shows blinking dots throughout.

**Voting.** Drag past 80px or tap ✕ / ✓; arrow keys work when the table has focus (scoped listener, not global). Counter "n of 5" sits between the buttons.

**One winner, always.** `FRIENDS` holds the three live friends' votes per game. After the fifth swipe, `pickWinner()` takes the visitor's votes plus the live friends', finds the top score, prefers a game the visitor said play to, and gives the late voter's single play vote to that game. There is never a tie in this demo. Do not "fix" this into real tie handling; the rematch is explained in the story section.

**Reveal timeline** (from the last swipe):

| ms | |
|---|---|
| 260 | table switches to the count: seats show ivory ticks, late voter still blinking; five mini covers with five empty pips each; "One vote to go" |
| +1500 | late voter's tick lands; "All five are in · Votes stay sealed until now." |
| +750 | "Counting the votes"; pips tick in round-robin, 75 ms apart |
| +450 | "The table has decided"; winner mini lifts with a gold ring, others dim, light goes to the winner |
| +900 | result: "Tonight we play", winner cover (`min(68%,31svh)`, desktop `min(78%,42svh)`), crown animation, gold flash, 34-piece confetti, `navigator.vibrate` where available; seats turn over each person's vote on the winner at 650 ms + 140 ms each; result line and buttons rise in last |

Result line: "N of 5 said play. You included." or "N of 5 said play. You passed, and got outvoted. It happens." Buttons: "Deal again" (glass) and "Vote on my shelf" (gold → `#signin`).

On phones the lede hides during the count and the result so the large cover fits; it returns on "Deal again". Reduced motion: no count, straight to the result, no crown, flash or confetti.

**Fit.** `.table{width:min(64vw,29svh,300px)}` keeps headline, deck and buttons on one phone screen; the short-phone block (`max-height:720px`) shrinks deck, type and seats. With the floating button now 56px tall, check that ✕ / ✓ clear it at 390×844 and 360×640; if they touch, reduce the deck's `svh` cap by 1–2 rather than moving the button.

**Commit message:** `feat(landing): playable vote in the hero with cover wall and cover light`

---

## Commit 3: the story (`js/landing-story.js`)

Lift the `STORY` banner and the `story` script block.

- The four screens are built in JS from `LANDING_GAMES` (`SCREEN[0..3]`). They are schematic on purpose; do not try to embed the real pages.
- `.a-pin` is `position:sticky; top:0` in production (the mockup uses `top:var(--demo)` for its demo bar; **`--demo` is 0 in production**, remove the variable). On phones the pin is a full-bleed glass band (`backdrop-filter`) so step text blurs as it passes under; `overflow:hidden` on the pin itself clips the floating pieces at the screen edge. Overflow on the sticky element does not break sticky; do not put it on an ancestor.
- Phone width `min(50vw,24svh,240px)`, desktop 270px in a `400px 1fr` grid. Steps are `min-height:52svh` on phones, `66vh` on desktop.
- **Active step.** Phones: a step is active when its **heading** is inside the readable band between the pinned phone and the floating button: `rootMargin:'-58% 0px -12% 0px'`. Desktop: `'-40% 0px -50% 0px'`. Rebuild the observer when the 900px media query flips.
- `aOn(i)` sets `data-step` on the section, toggles `.on` on screens, tabs, steps and the step's pieces, and the phone leans a little per step (`[data-step] .a-phone` rules).
- Pieces (`FR`): outer `.frag` transitions in, inner child bobs. Positions and contents are in the mockup.

**Commit message:** `feat(landing): pinned-phone story with floating pieces`

---

## Commit 4: the closing section (`js/landing-close.js`)

Lift the `CLOSING` banner and the `closing (F8)` script block. The real sign-in from commit 1 is the focal block; this commit adds what surrounds it.

**Layers, back to front:** `.floor` → `.light` → `.veil` → `.horizon` → `.pieces` → focal block.

**Floor (locked "Full").** `opacity:.85`. `.floor{perspective:900px (1400px desktop); perspective-origin:50% 6%}`; `.plane{width:190vw (124vw desktop); top:4%; rotateX(58deg)}` is static; `.drift` is a grid of 16 rows × 10 columns (14 on desktop) from `LANDING_WALL`, rows repeating every 4 so `translateY(-25%)` over 46s loops with no seam. 160px images.

**Light.** Same recipe as the hero, `scale(6)` / `11`, `.on` `opacity:.5`, fade 1.6s, stepping through `LANDING_WALL` every 3.6s.

**Veil.** A dark ellipse behind the focal block (`120% 44%`, `.92 → .6 → transparent`) plus top and bottom fades, so the wall recedes around the headline and the small pieces stay readable over the bright near tiles.

**Pieces** show a vote: a card mid-swipe with the green "Play" stamp, ✓ and ✕ rounds, five seats (four ticked, one "…"), a four-cover count with pips and the leader ringed, the winner with a gold ring ("Tonight we play" label on desktop only), the "4 of 5 would play" pill, confetti, the "K7QP" join code. Sizes: phones 70px covers / 42px rounds; from 1200px up 132px covers / 58px rounds (full table in the mockup's CSS).

**Placement.**
- Under 1200px: a band above the text and a band below it. Section padding `212px 20px 222px`; nearest piece about 90px from the focal block.
- 1200px and up: pieces sit in the side gutters, **anchored to the focal block, not to the screen** (`left:calc(50% ± Npx)` with `max()` / `min()` guards), so the gap is the same on a laptop and a large monitor (about 70px to the nearest piece). Headline is `76px`, `max-width:10em`, so it wraps to two lines and leaves gutters. Padding `200px 20px 210px`.

**When it runs.** One IntersectionObserver on `#signin` (`threshold:.15`): on entry add `.in` once (pieces fly in, staggered by `--d`), and toggle `.live`; while not `.live`, the floor drift, the pieces' bob, the button halo and the light timer are paused (`animation-play-state:paused`, `clearInterval`). Reduced motion or `navigator.connection?.saveData`: pieces appear in place, floor static, light holds its first cover.

**The focal block must stay clickable.** `.pieces`, `.floor`, `.light`, `.veil`, `.horizon` are all `pointer-events:none` and sit at negative `z-index` inside `#signin{isolation:isolate}`. After this commit re-test the Google overlay, the email panel and the guest link inside the finished section.

**Commit message:** `feat(landing): closing section — the long shelf, the lights, and a vote around the sign-in`

Stop for review. I will test `/next` on my phone before the route swap.

---

## Deliberate deviations from the mockup

- The demo bar, `--demo` offset, `heroDemo` / `heroPress` globals and the "page glue" block are mockup-only.
- Tokens and the glass material come from production CSS, not the mockup's copies.
- Covers go through `sizedCover()` at 160 / 384; no `referrerpolicy`, no colour stand-ins.
- The sign-in, signed-in state, guest link, Beta tag and footer are the production ones; the mockup's are placeholders.
- The mockup's hero "Sign in" and buttons are plain anchors; production changes them for signed-in visitors.
- Strings are English only. The TH/EN work is out of scope here.

## Layout constants (quick reference)

| | Phones | Desktop (≥900px) |
|---|---|---|
| Hero min-height | `100svh` | `min(880px,100svh)` |
| Hero deck width | `min(64vw,29svh,300px)` | `min(360px,40svh)` |
| Vote rounds | 60px (52px short phones) | 64px |
| Seats | 36px (30px short phones) | 42px |
| Winner cover | `min(68%,31svh)` | `min(78%,42svh)` |
| Story phone | `min(50vw,24svh,240px)` | 270px |
| Floating button | 56px tall, 16px side inset, 14px + safe area from the bottom, max 420px | hidden |
| Closing padding | 212 / 222px | 200 / 210px |
| Closing pieces side layout | no | from 1200px |

## Verification checklist

- [ ] `/` is unchanged; `/next` serves the new page with `noindex`
- [ ] Sign in with Google (overlay), with the redirect fallback (block `accounts.google.com`), and by email link; all land where they do today
- [ ] Signed in with a shelf: both "Get your shelf" buttons read "Open your shelf" and go to `/u/{slug}`; closing shows "Welcome back"
- [ ] Signed in without a BGG name: redirected to `/welcome`
- [ ] Guest line appears only after a public shelf is found and links to it
- [ ] Hero at 390×844 and 360×640: headline, lede, seats, deck and ✕ / ✓ fit above the floating button without scrolling
- [ ] Friends' chips never show play or pass while voting; the late voter blinks until the count
- [ ] Every run ends on exactly one winner, including five passes ("outvoted" line) and five plays
- [ ] Reveal order and timing match the table above; "Deal again" restarts cleanly mid-reveal
- [ ] Cover light follows the top card, then the winner; a broken cover means no light, not a broken image
- [ ] Story: steps 1→4 switch in order scrolling down and back up, on a phone and on desktop; the active text is always the text you can read
- [ ] Floating button slides away at the closing section and returns when you scroll back up; never on screen with the real Google button
- [ ] Closing: pieces fly in once, float, and pause when off screen; focal block fully clickable; nearest piece about 90px (phones) / 70px (desktop) from it; same spacing at 1360px and 1920px
- [ ] Reduced motion: no drift, no fly-in, no count, no confetti; everything present in its resting state
- [ ] iOS Safari on a real phone: swipe fling and snap-back animate, chips pop, screens cross-fade, pieces fly in. Anything that snaps instead of moving has an animation and a transition on one property
- [ ] Scrolling stays smooth through the closing section on a mid-range phone; if not, first halve the floor rows (16 → 8, drift `-50%`), then drop the blur on the story pin
- [ ] Walnut, Navy, Mahogany, Oak: all veils fade to the theme's own background
- [ ] No horizontal scroll at any width from 320px to 1920px
- [ ] Lighthouse mobile: no layout shift from the deck or the wall (images have fixed aspect ratios)

## After I approve `/next` (separate task)

1. In `vercel.json` point `/` at `/landing-next.html` (keep `landing.html` for one release as the rollback).
2. Remove the `noindex` meta and the `/next` rewrite.
3. Delete `landing.html` and rename in a later tidy-up.

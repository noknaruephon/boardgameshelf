# Spec: The shelf hero, and the vote demo becomes section 2

**Applies to:** `landing-next.html` as built from `docs/claude-code-spec-landing.md`. This is an addendum; everything in that spec still holds except where this one says otherwise.
**Mockup (locked):** `docs/mockups/landing-full.html`, the `HERO (approved: H11 "The real shelf")` CSS banner and the `<section class="hero h11">` markup. `docs/mockups/landing-hero-h11.html` is the same hero on its own, with the demo bar, if you want it in isolation.
**Data:** `LANDING_GAMES` in `js/landing-data.js`. The hero uses the first nine (desktop) / first six (phones). No new data.
**Files touched:** `landing-next.html`, `css/landing.css`, `js/landing-hero.js` (the vote demo; small copy edits only), new `js/landing-shelf.js` (about ten lines).
**Commits:** two. Stop for review after each.

## What changes

Today `/next` opens on the playable vote. It stays, but as **section 2**. Above it goes a new hero: a real-looking shelf. Two walnut planks on a dark wall, nine real boxes standing on them, each one lit from behind. Centred copy above the shelves. Almost nothing moves: the backlights breathe slowly and a box lifts when you hover or tap it. The point of the hero is to say what the product is in one picture; the vote demo below then lets the visitor try the part that makes it different.

Page order becomes: **shelf hero → vote demo → story → also on the shelf → three steps → closing → footer.**

## Copy (final)

| Where | Text |
|---|---|
| Hero h1 | Every game you own,`<br>`on the shelf. |
| Hero description | A shelf for your boardgame collection.`<br>`Your friends vote for tonight's game. |
| Hero buttons | Get your shelf (glass, → `#signin`) · Try the vote (text link, → `#vote`) |
| Hero scroll cue | Try the vote ↓ (→ `#vote`) |
| Section 2 eyebrow | TRY IT |
| Section 2 heading (now an `h2`) | Pick tonight's game, together. |
| Section 2 lede | Four friends are already at this table. Swipe right to play, left to pass, and watch the table decide. |

The `<br>`s are deliberate: both hero lines break there at every width. Do not let the headline or description reflow.

---

## Commit 1: the shelf hero

Insert the new section before the vote demo. It takes over the page header (wordmark, Beta button, Sign in link) from the vote demo, which loses its own header in commit 2.

### Markup

```html
<section class="shelfhero" id="top">
  <div class="veil"></div>
  <header class="top">
    <p class="mark bgs-wordmark">BoardgameShelf<button type="button" class="bgs-beta" aria-label="Beta — about this label">Beta</button></p>
    <a class="signin" href="#signin">Sign in</a>
  </header>
  <div class="lead">
    <h1>Every game you own,<br>on the shelf.</h1>
    <div class="side">
      <p>A shelf for your boardgame collection.<br>Your friends vote for tonight's game.</p>
      <div class="cta"><a class="glass fab" href="#signin">Get your shelf <svg …down arrow…></svg></a><a class="textlink" href="#vote">Try the vote</a></div>
    </div>
  </div>
  <div class="wall">
    <div class="shelf">…4 boxes…<span class="lamp"></span><span class="plank"></span></div>
    <div class="shelf">…5 boxes…<span class="lamp"></span><span class="plank"></span></div>
  </div>
  <a class="cue" href="#vote"><span class="mono">Try the vote</span><i></i></a>
</section>
```

Each box:

```html
<button class="box" type="button" style="--lean:-7deg;--bd:-1.3s" aria-label="Cascadia">
  <span class="glow"></span>
  <span class="face"><img src="…sizedCover(url,384)…" alt=""></span>
  <span class="foot"></span>
  <span class="name">Cascadia</span>
</button>
```

Build the boxes in `js/landing-shelf.js` from `LANDING_GAMES`: desktop shelves get games 0–3 and 4–8, phone shelves get 0–2 and 3–5. Render both sets and let CSS pick (`.mob{display:contents}.desk{display:none}` and the inverse from 900px), exactly as the mockup does; it is simpler than re-rendering on resize and the extra six thumbnails are cheap. Leans, in order: `-7, 4, -3, 6, -5, 3, -6, 5, -2` degrees. Breathing offsets `--bd: -(i × 1.3 mod 6)s`.

Use the production wordmark and Beta button markup (above), not the mockup's `span.wordmark`/`span.beta`. The mockup's `.h11 .wordmark{color:gold}` is already what `.bgs-wordmark` does.

### CSS

Lift the `HERO (approved: H11 …)` banner from the mockup into `css/landing.css`, renaming the section class from `.h11` to `.shelfhero` throughout (the mockup keeps `.h11` only because it was extracted from an options file). Drop the mockup-only rules: anything mentioning `--demo`, `.demobar`, `html.rm`. Keep the shell rules the mockup adds under the banner (`.shelfhero{position:relative;isolation:isolate;overflow:hidden;min-height:100svh;…}`, the `.mob/.desk` switch, the `.cue`).

What the CSS is doing, so it survives translation:

| Piece | Rule |
|---|---|
| Section | `min-height:100svh` phones, `min(880px,100svh)` desktop; flex column: header → lead → wall → cue |
| Lead (copy) | centred column, `gap:16px` (18px phones). h1 Fraunces 600, `clamp(34px,8.6vw,68px)/1.05` phones, `clamp(46px,4.9vw,72px)/1.02` desktop, `max-width:9.6em`. p Inter 16/1.55 phones, 18/1.5 desktop, `--bgs-ivory-70`. CTA row centred, `margin-top:22px` desktop, `6px` phones |
| Hero button | the shared `.fab.glass` from the landing spec, but `min-height:46px; padding:0 22px; font-size:15px`, arrow 16px. This is the **compact** variant; the floating phone pill keeps 56px |
| Wall | flex column, `justify-content:flex-start`, box size on the wall: `--bw: clamp(96px, min(9.4vw, 13.4svh), 128px)` desktop, `min(25vw, 13svh, 104px)` phones. Padding top `40px` desktop / `44px` phones between the CTA and the first plank. Gap between shelves `clamp(34px,5vh,60px)` desktop / `clamp(24px,6svh,56px)` phones |
| Shelf | `flex:none; align-self:center; width:calc(5 * var(--bw) + 4 * var(--g))` desktop (both planks the same length, sized to the fuller row), `width:max-content` phones. `--g` 34px desktop / 10px phones. `isolation:isolate` |
| Box | `flex:none; width:var(--bw); height:calc(var(--bw) * 4/3)`. **Never let it shrink**: this is what made the two rows unequal once |
| Face | the cover, radius 5px, ivory hairline, `perspective(600px) rotateY(var(--lean))` from the bottom edge, a diagonal sheen overlay |
| Glow | one shared warm light per box, **not** the cover's colours: `radial-gradient(ellipse 46% 46% at 50% 56%, gold .75 → gold .3 at 45% → transparent 100%)`, `blur(8px)`, `opacity:.85`, box `left/right:-22%; top:-26%; bottom:-4%`. The gradient ends inside its own element so the blur has nothing to clip. Breathes `.7 → 1` over 6s (animation only) |
| Lamp | per shelf, the soft ceiling light: `left/right:-16%; top:-95%; height:200%`, `radial-gradient(ellipse 50% 42% at 50% 55%, ivory .07, transparent 100%)`. Same rule: gradient ends inside the element |
| Plank | walnut board 14px tall (18px desktop), gold-lit top edge (`inset 0 1px 0 gold .55`), drop shadow onto the wall; `left/right:var(--over)` where `--over` is `-64px` desktop / `-22px` phones; rounded ends; the shadow below it is inset 4% at each end so it fades out under the board instead of running across the wall |
| Foot | a blurred dark ellipse where the box meets the plank |
| Hover / tap | `.box:hover, .box:focus-visible, .box.up { transform: translateY(-10px) scale(1.04) }`, face straightens to `rotateY(0)`, glow to `opacity:1`, `.name` fades in beneath. Transition `.45s` on the box's `transform` only |
| Cue | bottom centre, mono "Try the vote" over a 26px gold hairline that drifts up and down (animation on the hairline only); the whole cue is a link to `#vote` |
| Veil | `linear-gradient(to bottom, ivory .06, transparent 40%)` for a faint light on the upper wall, plus the usual fade to `--bgs-bg` at top and bottom |

WebKit rule, restated for this section: `.box` transitions `transform`; `.glow` and `.cue i` animate; nothing carries both.

### JS (`js/landing-shelf.js`)

Render the boxes as above, then the tap-lift for phones (hover covers desktop):

```js
document.querySelectorAll('.shelfhero .box').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('.shelfhero .box').forEach((x) => x.classList.remove('up'));
  b.classList.add('up');
  setTimeout(() => b.classList.remove('up'), 1800);
}));
```

A box is a `<button>` so it is focusable; tapping it does nothing else. If you would rather it opened the game modal, that is a separate decision: not in this spec.

**Signed-in visitors:** the landing spec's rule applies to this button too. With a shelf, "Get your shelf" reads "Open your shelf", points at `/u/{slug}` and drops the arrow.

**Commit message:** `feat(landing): shelf hero above the vote demo`

Stop for review.

---

## Commit 2: the vote demo becomes section 2

In the vote section (`.hero` in the build; give it `id="vote"`):

- Remove its `<header class="top">` (wordmark, Beta, Sign in). The shelf hero owns the page header now.
- Remove its `.cta` (the glass button and "See how it works"). The hero and the floating pill cover it.
- Replace the `<h1>` with an eyebrow and an `h2`:
  ```html
  <p class="eyebrow-v">Try it</p>
  <h2 class="v-h">Pick tonight's game, together.</h2>
  <p class="lede">Four friends are already at this table. Swipe right to play, left to pass, and watch the table decide.</p>
  ```
  `.eyebrow-v` is the mono eyebrow style already used elsewhere (`font:400 11px/1 'IBM Plex Mono'; letter-spacing:.16em; uppercase; color:var(--bgs-gold-dim)`). `.v-h` keeps the old h1's size and face, so nothing else about the section moves.
- Section padding becomes `24px 20px calc(var(--sticky) + 12px)`; it keeps `min-height:100svh` so the deck still lands as one full screen when the visitor arrives from the cue.
- Every "Try the vote" link and the cue scroll to `#vote`. "Get your shelf" everywhere still scrolls to `#signin`.
- The page's `scroll-padding-top` is 0 (there is no fixed header), so `#vote` lands flush at the top.

Nothing inside the deck, the seats, the count or the reveal changes. The cover wall and cover light behind the demo stay exactly as built.

**Commit message:** `feat(landing): vote demo moves to section 2 under the shelf hero`

Stop for review.

---

## Deliberate deviations from the mockup

- The mockup's demo bar, `--demo` offset and `html.rm` toggle are mockup-only.
- The mockup's wordmark/Beta are plain spans; production uses `.bgs-wordmark` and the `.bgs-beta` button so the Beta tooltip works.
- Covers go through `sizedCover(url, 384)`; no `referrerpolicy`, hidden on error, no colour stand-ins.
- The mockup renders both phone and desktop shelves from a Python list; production renders them from `LANDING_GAMES` in JS. Same games, same order.

## Layout constants (quick reference)

| | Phones | Desktop (≥900px) |
|---|---|---|
| Shelves × boxes | 2 × 3 | 4 + 5 |
| Box width | `min(25vw,13svh,104px)` | `clamp(96px,min(9.4vw,13.4svh),128px)` |
| Box gap | 10px | 34px |
| Plank overhang | 22px each end | 64px each end |
| Plank height | 14px | 18px |
| Copy → first plank | 44px | 40px |
| Between shelves | `clamp(24px,6svh,56px)` | `clamp(34px,5vh,60px)` |
| Hero button | hidden (floating pill instead) | 46px compact glass |

## Verification checklist

- [ ] `/next` opens on the shelf hero; the vote demo is the second screen; nothing else on the page moved
- [ ] Headline breaks after the comma and the description after the first sentence at 360, 390, 1024, 1360 and 1920 wide
- [ ] Both rows of boxes are the same size at every width (they were once not); planks are equal length and do not reach the screen edges
- [ ] No hard edge anywhere in the lighting above or beside the shelves (the ceiling light and the glows fade to nothing inside their own boxes)
- [ ] Hover (desktop) and tap (phone) lift a box, brighten its light and show its title; a second tap on another box moves the lift
- [ ] "Try the vote" (link and cue) lands with the deck fully on screen; "Get your shelf" lands on the sign-in section
- [ ] Section 2 shows TRY IT / "Pick tonight's game, together." / the new lede; no second wordmark or Sign in; the vote plays through to one winner as before
- [ ] Floating phone pill behaves as before (present from the top, away over the closing section)
- [ ] Signed in with a shelf: hero button reads "Open your shelf" → `/u/{slug}`
- [ ] Beta tooltip works from the hero header
- [ ] Reduced motion: no breathing, no cue drift; lift still works without the transition
- [ ] iOS Safari: box lift animates (transform transition), glows breathe. If a box snaps instead of lifting, something has both an animation and a transition on `transform`
- [ ] Walnut, Navy, Mahogany, Oak: the wall and veil fade to the theme background; the plank's walnut is intentionally the same on every theme (it is furniture, not UI)

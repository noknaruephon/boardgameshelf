# Claude Code Spec — Landing page: "The hand"

**Design source:** `docs/landing-mockup.html`, option C ("The hand").
**Scope:** `landing.html` only. Rebuild the page to match the mockup while
keeping every piece of auth wiring exactly as it is.
**Commit:** `Redesign landing page: fanned covers, centred sign-in, BGG attribution`

---

## Keep unchanged

- `<head>` — fonts, `base.css`, favicons, manifest, insights script.
- All auth JS and element ids: `#googleBtn`, `#emailForm`, `#email`,
  `#emailBtn`, `#msg`, `#signedIn`, `#shelfLink`.
- `.msg` ok/err states, `[disabled]` styling, the `[hidden]` rule.
- The signed-in plate (`#signedIn`) — restyle only, to match the new
  sign-in block.

## Layout

Single column, centred, `max-width:560px`, body padding `40px 20px 0`.
Top to bottom:

1. Wordmark
2. Fanned covers (decorative)
3. Shortlist caption
4. `h1`
5. Sub line
6. Sign-in block (or `#signedIn` when logged in)
7. Footer with Powered by BGG

## Markup

Replace everything inside `<body>` with:

```html
<div class="wrap">
  <p class="mark">BoardgameShelf</p>
  <div class="hand" aria-hidden="true">
    <div class="cover" style="--c:#3E5C3E"><img src="COVER_1" alt="" loading="eager" decoding="async"></div>
    <div class="cover" style="--c:#3B4F76"><img src="COVER_2" alt="" loading="eager" decoding="async"></div>
    <div class="cover" style="--c:#7A3B2E"><img src="COVER_3" alt="" loading="eager" decoding="async"></div>
    <div class="cover" style="--c:#A64B32"><img src="COVER_4" alt="" loading="eager" decoding="async"></div>
    <div class="cover" style="--c:#8B3A3A"><img src="COVER_5" alt="" loading="eager" decoding="async"></div>
  </div>
  <p class="pick">Tonight's shortlist · 5 of 196</p>
  <h1>Your shelf, judged by its covers.</h1>
  <p class="sub">A page for your collection and a vote for your table, from any phone.</p>

  <section class="signin" id="signIn" aria-label="Sign in">
    [existing Google button, .or divider, email form, .msg — unchanged ids;
     drop the "Sign in" h2 and the "Email a sign-in link" label; keep the
     input's aria-label="Email"]
  </section>

  <section class="signin signed-in" id="signedIn" hidden>
    [existing content]
  </section>
</div>

<footer>
  <a class="bgg-badge" href="https://boardgamegeek.com" target="_blank" rel="noopener" aria-label="Powered by BoardGameGeek (opens in a new tab)">
    <img src="/assets/powered-by-bgg.svg" alt="" width="150" height="33">
  </a>
  <p class="primary">Game data and covers come from <a href="https://boardgamegeek.com" target="_blank" rel="noopener">BoardGameGeek</a>.</p>
  <p class="secondary">Not affiliated with or endorsed by BGG.</p>
</footer>
```

`COVER_1`–`5`: the `image` URLs from `games.json` for Cascadia, Ark Nova,
Dune: Imperium – Uprising, Terraforming Mars, Blood on the Clocktower, in
that order. Hotlinked as-is. The count in `.pick` is the current shelf
size; hardcoded to 196 for now with a TODO to read it from the games cache
once the multi-user shelf is live.

## CSS

Replace the `<style>` block. Reuse the existing `.btn`, `.btn.gold`,
`.field`, `.or`, `.row`, `.msg`, `.signed-in`, `[hidden]` rules with these
changes:

- `.btn` and `.field`: `min-height:52px`, `font-size:16px` (prevents iOS
  zoom on focus).
- `.btn:focus-visible` and `.field:focus-visible` →
  `outline:none; box-shadow:0 0 0 2px var(--bgs-bg),0 0 0 4px var(--bgs-gold)`;
  remove the outline rule (project convention: gold rings via box-shadow,
  never outline).
- `.row`: grid, gap 10px; at `min-width:560px` →
  `grid-template-columns:1fr auto` and `.row .btn{width:auto;padding:0 22px}`.

Remove `.eyebrow`, `.pitch`, `.plate`, `.plate h2`, `label`, `.foot`.

Add:

```css
.wrap{max-width:560px;margin:0 auto;text-align:center;}
.mark{font-family:'Fraunces',serif;font-style:italic;font-weight:500;font-size:17px;color:var(--bgs-gold);margin:0;}
.hand{position:relative;height:210px;margin:8px auto 0;max-width:520px;}
.hand .cover{
  position:absolute;left:50%;bottom:0;width:132px;aspect-ratio:1/1;border-radius:6px;overflow:hidden;
  background:var(--c);border:1px solid rgba(var(--bgs-ivory-rgb),.12);
  box-shadow:0 10px 24px rgba(0,0,0,.45);
  transform-origin:50% 160%;
  transform:translateX(-50%) rotate(var(--r)) translateY(var(--y));
  transition:transform .25s ease;
}
.hand .cover img{display:block;width:100%;height:100%;object-fit:cover;}
.hand .cover:hover{transform:translateX(-50%) rotate(var(--r)) translateY(calc(var(--y) - 14px));}
.hand .cover:nth-child(1){--r:-22deg;--y:8px}
.hand .cover:nth-child(2){--r:-11deg;--y:-2px}
.hand .cover:nth-child(3){--r:0deg;--y:-8px;z-index:2;box-shadow:0 0 0 2px var(--bgs-gold),0 16px 30px rgba(0,0,0,.6)}
.hand .cover:nth-child(4){--r:11deg;--y:-2px}
.hand .cover:nth-child(5){--r:22deg;--y:8px}
@media(prefers-reduced-motion:reduce){.hand .cover{transition:none}}
.pick{font-family:'IBM Plex Mono',monospace;font-size:12px;letter-spacing:.02em;color:var(--bgs-gold-dim);margin:14px 0 0;}
h1{font-family:'Fraunces',serif;font-weight:600;font-variation-settings:'opsz' 144;font-size:clamp(38px,9vw,64px);line-height:1.02;letter-spacing:-.015em;margin:14px 0 14px;}
.sub{font-size:17px;line-height:1.45;color:var(--bgs-ivory-70);margin:0 auto 26px;max-width:32ch;}
.signin{max-width:420px;margin:30px auto 0;text-align:left;}
footer{max-width:960px;margin:44px auto 0;padding:24px 20px 40px;text-align:center;font-family:'IBM Plex Mono',monospace;border-top:1px solid rgba(var(--bgs-gold-rgb),.18);}
footer .bgg-badge{display:inline-block;line-height:0;margin:0 0 14px;border-radius:4px;}
footer .bgg-badge img{display:block;}
footer .bgg-badge:focus-visible{outline:none;box-shadow:0 0 0 2px var(--bgs-bg),0 0 0 4px var(--bgs-gold);}
footer .primary{font-size:12px;line-height:1.55;letter-spacing:.015em;color:var(--bgs-gold-dim);margin:0 0 6px;}
footer .primary a{color:var(--bgs-gold);text-decoration:underline;text-underline-offset:3px;}
footer .secondary{font-size:11px;line-height:1.55;letter-spacing:.015em;color:rgba(var(--bgs-gold-rgb),.4);margin:0;}
```

Note: `.hand .cover` has a transition on transform and no animation — do
not add a load animation to the same element (WebKit drops the
transition). If an entrance is wanted later, animate a wrapper.

## Accessibility

- `.hand` is `aria-hidden`; the covers are decorative and the caption is
  the accessible text.
- The footer link carries the name; the badge img alt is empty.
- Focus rings via box-shadow only.
- `h1` remains the only `h1`; no `h2` in the sign-in block.

## Verify

- 375px: hand fits without horizontal scroll, headline wraps to two lines,
  buttons full width.
- 960px: email field and "Send magic link" sit on one row.
- Google and magic-link flows still work end to end; `#msg` still shows
  ok/err.
- Signed-in state shows `#signedIn` styled like the sign-in block.
- Badge is 150×33, links to boardgamegeek.com in a new tab.
- `prefers-reduced-motion`: hover lift disabled.
- Lighthouse accessibility ≥ current score.

---

## Implementation notes

- The `<head>` was kept byte-for-byte, as required. Its Google Fonts
  request loads only upright Fraunces, so the italic wordmark is a
  browser-synthesised oblique rather than the true italic the mockup
  loads. Adding `ital` to the Fraunces axis list in the font URL is a
  one-line follow-up if the synthesised slant looks off.
- The signed-in plate keeps its `#hello` `<h2>` (the JS writes into it)
  and is restyled to sit inside the same 420px `.signin` column as the
  sign-in block.
- The existing `.btn` look (gold-tinted fill, ivory text) is kept rather
  than the mockup's outline-only variant, per "reuse the existing rules".
- Cover URLs were taken from `games.json` at build time; the fan is static
  markup, not fetched, so the page renders with no data dependency.

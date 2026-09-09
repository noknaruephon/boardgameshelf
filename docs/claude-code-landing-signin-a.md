# Claude Code Spec — Landing sign-in: "One primary"

**Design source:** `docs/mockups/signin-section-mockup.html`, option A.
**Scope:** the sign-in section of `landing.html` only. The hero (wordmark,
fanned covers, h1, sub) stays exactly as it is.
**Commit:** `Landing: single primary sign-in, email as progressive disclosure, quiet guest link`

---

## Keep unchanged

- `<head>`, hero markup and CSS, footer, all auth JS logic.
- Element ids the JS relies on: `#googleBtn`, `#emailForm`, `#email`,
  `#emailBtn`, `#msg`, `#signedIn`, `#shelfLink`.
- `.msg` ok/err behaviour and the signed-in plate.

## Markup

```html
<section class="signin" id="signIn" aria-label="Sign in">
  <button class="btn gold" id="googleBtn" type="button">
    <span class="g" aria-hidden="true">[Google G svg, four brand colours, 14px, on a 22px white disc]</span>
    Continue with Google
  </button>

  <p class="more">Prefer email?
    <button class="link" id="emailToggle" type="button" aria-expanded="false" aria-controls="emailPanel">Send me a sign-in link</button>
  </p>

  <div class="email" id="emailPanel" hidden>
    <form class="row" id="emailForm" novalidate>
      <input class="field" id="email" type="email" inputmode="email" autocomplete="email" placeholder="you@example.com" aria-label="Email" required>
      <button class="btn" id="emailBtn" type="submit">Send link</button>
    </form>
  </div>

  <p class="msg" id="msg" aria-live="polite"></p>

  <p class="guestline" id="guestLine" hidden>Just looking?
    <a id="guestLink" href="/u/noknaruephon">Browse as a guest</a>
  </p>
</section>
```

Removed: both "OR" dividers, the "OR BROWSE AS A GUEST" heading, the guest
row card with cover stack, and the old dark Google button styling.

## Behaviour

- `#emailToggle` toggles `#emailPanel`'s `hidden`, sets `aria-expanded`,
  and focuses `#email` when opening. The label stays the same in both
  states.
- After a magic link is sent successfully, the panel stays open and the ok
  message shows under it as before.
- `#guestLine` links to the first row of the existing `public_shelves()`
  RPC: href = `/u/<slug>`. The label is the fixed "Browse as a guest". If
  the RPC fails or returns nothing it stays hidden. Fetched after first
  paint; never blocks the sign-in buttons.
- A user who is already signed in sees `#signedIn` instead of `#signIn`,
  as before.

## CSS

```css
.signin{max-width:420px;margin:30px auto 0;text-align:center;}
.btn{ existing, min-height 52px, font-size 16px, radius 12px }
.btn.gold{background:var(--bgs-gold);color:var(--bgs-bg);border-color:var(--bgs-gold);}
.g{width:22px;height:22px;border-radius:50%;background:#fff;display:grid;place-items:center;flex:none;}
.g svg{width:14px;height:14px;}
.more{margin:18px 0 0;font-size:15px;color:var(--bgs-ivory-70);}
.link{background:none;border:0;padding:0;font:500 15px 'Inter',sans-serif;color:var(--bgs-gold);text-decoration:underline;text-underline-offset:4px;text-decoration-color:rgba(var(--bgs-gold-rgb),.4);cursor:pointer;}
.link:focus-visible{outline:none;border-radius:4px;box-shadow:0 0 0 2px var(--bgs-bg),0 0 0 4px var(--bgs-gold);}
.email{margin-top:14px;text-align:left;}
.row{display:grid;gap:10px;}
@media(min-width:560px){.row{grid-template-columns:1fr auto;}.row .btn{width:auto;padding:0 22px;}}
.field{min-height:52px;font-size:16px;radius 12px; existing colours}
.guestline{margin:32px 0 0;font-size:14px;color:var(--bgs-ivory-45);}
.guestline a{color:var(--bgs-gold-dim);text-decoration:none;border-bottom:1px solid rgba(var(--bgs-gold-rgb),.35);}
.guestline a:focus-visible{outline:none;border-radius:4px;box-shadow:0 0 0 2px var(--bgs-bg),0 0 0 4px var(--bgs-gold);}
```

All focus rings via box-shadow, never outline. `.or`, `.guest`, `.stack`
and divider CSS that is no longer referenced is removed.

## Accessibility

- One h1 on the page; no headings inside the sign-in section.
- `#emailToggle` is a real `<button>` with `aria-expanded` / `aria-controls`.
- The hidden panel uses the `hidden` attribute so it is out of the tab order.
- The Google G is decorative (`aria-hidden`); the button text is the name.
- Colour contrast: `.more` text on the background is ≥ 4.5:1; `.guestline`
  at ivory-45 is ≥ 3:1 and secondary. If Lighthouse flags it, raise to
  ivory-70.

## Verify

- 375px: gold button, one line of "Prefer email?", guest line; no dividers;
  nothing else visible until the toggle.
- The toggle opens the email row with focus in the field; Escape does
  nothing special; a second tap closes it.
- Magic link and Google flows work end to end; `#msg` still shows ok/err.
- The guest link goes to `/u/noknaruephon` with the right name, and hides
  gracefully if the RPC fails.
- The signed-in state still swaps to `#signedIn`.
- Lighthouse accessibility ≥ current.

---

## Implementation notes

- **Google's control stays, transparently.** The site signs people in with
  Google Identity Services so that Google's consent screen names
  `boardgameshelf.vercel.app` rather than the Supabase callback. That
  library must render its own button, so it is laid over the gold button
  at zero opacity inside `.google-wrap`: the gold button is what people
  see, Google's control is what receives the tap. While the overlay is
  live the gold button leaves the tab order and is `aria-hidden`, so
  keyboard and screen-reader users reach Google's control. If the script
  cannot load (or no client ID is configured), the overlay never mounts
  and the gold button runs the redirect flow through Supabase as before.
  Nothing in the auth JS changed.
- The default markup carries `/u/noknaruephon` so the link is right even
  before the RPC answers, but the line is hidden until it does.
- **The shelf picker module** (`js/shelf-picker.js`) is still used by the
  welcome and settings pages; the landing page now imports only its
  `fetchPublicShelves()` helper.
- The landing spec's earlier note about the synthesised italic wordmark
  still applies; the head is untouched here too.

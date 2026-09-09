# Claude Code Spec — Welcome, BGG-name step: "Just the field"

**Design source:** `docs/mockups/welcome-step-mockup.html`, option A.
**Scope:** layout, hierarchy and copy of the BGG-name step in
`welcome.html`. The logic from `docs/claude-code-onboarding-steps.md`
stays.
**Commit:** `Welcome: simplify BGG-name step — no plate, aligned steps, ghost disabled, quiet links`

---

## Keep unchanged

- All state logic (empty → checking → found | missing), profile creation on
  Continue, redirects.
- The syncing and done states and their markup.
- Ids the JS uses: `#bgg`, `#continue`, the help/status element, the steps
  container.

## Step indicator

```html
<div class="steps" aria-label="Progress">
  <div class="line"><b id="stepNum">Step 2 of 3</b><span id="stepName">Your BGG name</span></div>
  <div class="segs" aria-hidden="true"><i class="done"></i><i class="now"></i><i></i></div>
</div>
```

Three equal grid columns, 3px bars, 6px gap. done = gold .45, now = gold,
upcoming = ivory .12. On syncing: "Step 3 of 3" / "Sync", segments
done/done/now. On done: all done, line reads "Done" / "Your shelf". A
visually hidden live region announces the step change once.

## Step-2 content (no wrapper card)

```html
<h1>Connect your collection</h1>
<p class="lede">Your owned games come straight from BGG. Nothing to upload.</p>
<label for="bgg">BoardGameGeek username</label>
<input class="field bgg" id="bgg" placeholder="noknaruephon" autocapitalize="none" autocorrect="off" spellcheck="false" autocomplete="username">
<p class="help" id="bggHelp" aria-live="polite">Same as your BGG login. Not your email.</p>
<div class="act">
  <button class="btn ghost" id="continue" type="button" disabled>Continue</button>
</div>
<p class="links">Just looking? <a id="browseLink" href="#">Browse an existing shelf</a><span class="dot">·</span><a id="laterLink" href="/settings">Do this later</a></p>
```

## State → help text and button

| State | Help | Button |
|---|---|---|
| empty | "Same as your BGG login. Not your email." | ghost, disabled, "Continue" |
| checking | spinner + "Checking BGG…" | ghost, disabled |
| found | input border `--bgs-vote-play`; ok "Found · 196 games owned. Shelf address /u/noknaruephon" (count omitted when null) | `.gold`, enabled, "Continue to sync" |
| missing | input border `--bgs-vote-pass`; err "No account by that name. It's usually a typo — usernames aren't case-sensitive." | ghost, disabled |

Classes are swapped on the same `#continue` element; there is never a
second button.

## Links

- `#browseLink` mounts the existing shelf picker (`js/shelf-picker.js`)
  below the links, replacing the old secondary button.
- `#laterLink` goes to `/settings`; the sign-out paragraph leaves this step
  (sign out lives in settings).

## CSS

```css
.wrap{max-width:520px;margin:0 auto;padding:36px 20px 80px;}
.steps{margin:0 0 26px;}
.steps .line{display:flex;justify-content:space-between;font-family:'IBM Plex Mono',monospace;font-size:12px;letter-spacing:.02em;color:var(--bgs-ivory-45);margin:0 0 8px;}
.steps .line b{font-weight:500;color:var(--bgs-ivory-70);}
.steps .segs{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;}
.steps .segs i{height:3px;border-radius:2px;background:rgba(var(--bgs-ivory-rgb),.12);}
.steps .segs i.done{background:rgba(var(--bgs-gold-rgb),.45);}
.steps .segs i.now{background:var(--bgs-gold);}
h1{font-size:clamp(32px,8vw,44px);line-height:1.05;letter-spacing:-.015em;margin:0 0 10px;}  /* Fraunces 600, opsz 144 */
.lede{font-size:16px;line-height:1.5;color:var(--bgs-ivory-70);margin:0 0 28px;max-width:36ch;}
label{display:block;font-size:13px;color:var(--bgs-ivory-70);margin:0 0 6px;}
.field{min-height:52px;font-size:16px;border-radius:12px;border:1.5px solid rgba(var(--bgs-ivory-rgb),.14);background:rgba(var(--bgs-bg-rgb),.6);}
.help{font-size:13px;line-height:1.5;color:var(--bgs-ivory-45);margin:10px 0 0;min-height:20px;}
.help.ok{color:var(--bgs-vote-play);} .help.err{color:var(--bgs-vote-pass);}
.act{margin-top:22px;}
.btn.ghost{background:transparent;color:var(--bgs-ivory-45);border-color:rgba(var(--bgs-ivory-rgb),.14);cursor:default;}
.links{margin:36px 0 0;font-size:13px;color:var(--bgs-ivory-45);line-height:1.7;}
.links a{color:var(--bgs-gold-dim);text-decoration:none;border-bottom:1px solid rgba(var(--bgs-gold-rgb),.35);}
.links .dot{margin:0 8px;opacity:.5;}
```

Focus rings via box-shadow (`0 0 0 2px var(--bgs-bg), 0 0 0 4px var(--bgs-gold)`),
no outline. The spinner stops under `prefers-reduced-motion`. The old
`.step`/`.steps` styles and the secondary-button and sign-out styles that
are no longer referenced are removed.

## Accessibility

- `#bggHelp` is the single live region for status; state changes replace
  its text, never append.
- The disabled button keeps the `disabled` attribute so it is skipped in
  the tab order.
- Links have ≥ 3:1 contrast; raise to ivory-70 if Lighthouse flags them.
- Step segments are `aria-hidden`; the mono line is the accessible progress.

## Verify

- 375px: steps line and bars align; no card; one field, one button, one
  line of links.
- A real name → green border, ok text, gold "Continue to sync"; a fake
  name → red border, err text, ghost button.
- "Browse an existing shelf" opens the picker inline; "Do this later"
  lands on settings with no slug, and settings offers the link back to
  `/welcome`.
- Syncing and done states unchanged except for the new step indicator.
- Lighthouse accessibility ≥ current.

---

## Implementation notes

- **Validation happens on Continue, not while typing.** That was changed
  at your request just before this spec, so the "lookup debounce" it asks
  to keep no longer exists. The state table above is applied with one
  addition: once the field holds three or more characters, Continue
  becomes an enabled plain button ("Continue") so the check can be
  triggered. Pressing it shows the checking state (ghost, disabled), then
  found (gold "Continue to sync", which a second press turns into the
  claim) or missing (ghost). A found name is claimed in the same press
  that verified it, as before.
- **"Do this later" lands on Settings**, which therefore needs a state for
  a signed-in user with no profile. The "No collection yet" card that was
  removed earlier is back for this one entry path, with the current button
  colours: gold Connect your collection, quiet Sign out, red Delete
  account. Sign-in itself still lands on `/welcome`, so a fresh user never
  sees that card unless they chose "Do this later".
- **The plate stays for syncing and done.** Those states' markup is
  unchanged per the brief; each now sits in its own `.plate` while step 2
  renders with no card. `.plate` therefore remains in the CSS.
- **Claim anyway** (offered only when the check itself fails for a reason
  other than "no such account") is now a third quiet link in the links
  line, shown in that state alone.
- **Steps live region:** `#stepLive` (visually hidden, `aria-live=polite`)
  is updated once per step change: "Step 3 of 3: Sync", then "Done: Your
  shelf".
- Verified in headless Chromium at 375px for the empty and found states
  with static mocks; the live page's script cannot run in this sandbox.

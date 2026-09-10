# Settings page — "Ledger" redesign

**Scope:** the signed-in Settings page only. No changes to shelf, game night, sync logic, auth, or RPCs.
**Mockup:** `docs/mockups/settings-ledger.html` (open in a browser; toggle reduced motion in the top bar).
**Flag:** none — the page is behind sign-in already. If you'd rather stage it, gate the new markup on `?settings=2` and I'll cut the flag in a follow-up.

---

## Why

The current page is four stacked plates. Each plate carries a heading, a paragraph and a button, so a page with five real controls runs to ~2.5 screens on a phone. Sync state is a paragraph of copy; Delete account sits beside Sign out at equal weight.

The Ledger keeps every control and drops the plates. Settings become grouped rows with hairlines. One screen. Sync state becomes a pill. Delete becomes a quiet text row at the foot.

---

## Structure

```
‹ Back to shelf
BOARDGAMESHELF
Settings
Nok.Naruephon

Your shelf
┌ boardgameshelf.app/u/noknaruephon        Copy ┐   ← link plate
  Public                                   [●○]
    Anyone with the link can browse and start a game night

BoardGameGeek
  Username                    noknaruephon    ›
  Collection                    (Synced 9 Sep)
    196 owned games
  Sync now                                    ↻
    Pulls owned games. Takes a minute or two for big shelves.

Account
  Sign out                                      ⇥
    Signed in with Google


─────────────────────────────────────────────
Delete account…
Removes your shelf, synced collection and sign-in. You'll be asked to confirm.
```

Left-aligned throughout. Header drops the slug (it now lives in the link plate — one place, copyable). "Back to shelf" is the way back to the collection; it sits at the top like any back affordance, so the "Your shelf" group is only the link plate and the Public switch.

---

## Markup

Replace the current four `<section class="plate">` blocks with:

```html
<header class="set-head">
  <a class="set-back" href="/u/noknaruephon">
    <svg aria-hidden="true">…chevron-left…</svg>Back to shelf
  </a>
  <div class="brand">BOARDGAMESHELF</div>
  <h1>Settings</h1>
  <div class="set-who">Nok.Naruephon</div>   <!-- display name from profile -->
</header>

<section class="set-group" aria-labelledby="g-shelf">
  <h2 id="g-shelf">Your shelf</h2>

  <div class="linkplate">
    <span class="url" id="shelf-url"><em>boardgameshelf.app/u/</em>noknaruephon</span>
    <button type="button" class="copy" data-copy="https://boardgameshelf.app/u/noknaruephon">Copy</button>
  </div>

  <div class="row">
    <span class="lab" id="lbl-public"><span class="t">Public</span><span class="s">Anyone with the link can browse and start a game night</span></span>
    <button type="button" class="toggle" role="switch" aria-checked="true" aria-labelledby="lbl-public"></button>
  </div>
</section>

<section class="set-group" aria-labelledby="g-bgg">
  <h2 id="g-bgg">BoardGameGeek</h2>

  <button type="button" class="row" data-action="change-username">
    <span class="lab"><span class="t">Username</span></span>
    <span class="val">noknaruephon</span>
    <svg class="chev" aria-hidden="true">…chevron-right…</svg>
  </button>

  <div class="row">
    <span class="lab"><span class="t">Collection</span><span class="s">196 owned games</span></span>
    <span class="pill" id="sync-state" aria-live="polite">Synced 9 Sep</span>
  </div>

  <button type="button" class="row" data-action="sync">
    <span class="lab"><span class="t">Sync now</span><span class="s">Pulls owned games. Takes a minute or two for big shelves.</span></span>
    <svg class="chev" aria-hidden="true">…refresh…</svg>
  </button>
</section>

<section class="set-group" aria-labelledby="g-account">
  <h2 id="g-account">Account</h2>
  <button type="button" class="row" data-action="signout">
    <span class="lab"><span class="t">Sign out</span><span class="s">Signed in with Google</span></span>
    <svg class="chev" aria-hidden="true">…logout…</svg>
  </button>
</section>

<footer class="set-danger">
  <button type="button" class="rust" data-action="delete">Delete account…</button>
  <p class="hint">Removes your shelf, synced collection and sign-in. You'll be asked to confirm.</p>
</footer>

<!-- confirm sheet, hidden until Delete is tapped -->
<div class="scrim" id="delete-scrim" hidden>
  <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="delete-title">
    <h2 id="delete-title">Delete your account?</h2>
    <p>This removes your shelf at <span class="mono">/u/noknaruephon</span>, your 196 synced games and your sign-in. It can't be undone.</p>
    <div class="acts">
      <button type="button" class="btn btn-quiet" data-action="delete-cancel">Keep my account</button>
      <button type="button" class="btn btn-rust" data-action="delete-confirm">Delete account</button>
    </div>
  </div>
</div>
```

Rows that navigate are `<a>`; rows that act are `<button>`; rows that only display are `<div>`. All three share `.row` so they line up.

---

## CSS

Uses existing tokens only. Add `--ink-2`, `--ink-3`, `--line`, `--line-gold` to `:root` if they don't already exist under other names — reuse whatever the shelf already has for muted ink and hairlines.

```css
.set-head { padding-bottom: 22px; }
.set-back {
  display: inline-flex; align-items: center; gap: 4px;
  margin: 0 0 18px -4px; padding: 6px 8px 6px 4px; border-radius: 8px;
  font-size: 14px; font-weight: 500; color: var(--ink-2); text-decoration: none;
}
.set-back svg { width: 16px; height: 16px; }
.set-back:focus-visible { outline: none; box-shadow: inset 0 0 0 2px var(--bgs-gold); }
.linkplate + .row { margin-top: 6px; }
.set-who  { font-size: 15px; color: var(--ink-2); }

.set-group { margin-top: 22px; }
.set-group h2 {
  font-family: var(--serif); font-weight: 500; font-size: 17px;
  color: var(--ink-2); margin: 0 0 4px;
}

.row {
  display: flex; align-items: center; gap: 12px;
  min-height: 56px; padding: 10px 0;
  border-bottom: 1px solid var(--line);
  width: 100%; text-align: left; color: inherit; text-decoration: none;
  background: none; border-left: 0; border-right: 0; border-top: 0;
}
.row:last-child { border-bottom: 0; }
.row .lab { flex: 1; min-width: 0; display: block; }
.row .lab .t { display: block; font-size: 16px; font-weight: 500; }
.row .lab .s { display: block; font-size: 13px; color: var(--ink-2); margin-top: 2px; }
.row .val { font-family: var(--mono); font-size: 14px; color: var(--ink-2); }
.row .chev { width: 18px; height: 18px; color: var(--ink-3); flex: none; }
.row:focus-visible { outline: none; box-shadow: inset 0 0 0 2px var(--bgs-gold); border-radius: 8px; }

.linkplate {
  display: flex; align-items: center; gap: 10px;
  margin-top: 10px; padding: 12px 14px; border-radius: 12px;
  background: var(--bgs-plate);
  box-shadow: inset 0 0 0 1px var(--line-gold);   /* gold ring rule: inset box-shadow, never outline */
}
.linkplate .url { flex: 1; font-family: var(--mono); font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.linkplate .url em { font-style: normal; color: var(--ink-3); }
.linkplate .copy { color: var(--bgs-gold); font-weight: 600; font-size: 14px; }

.pill {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 10px; border-radius: 999px;
  background: rgba(var(--bgs-gold-rgb), .12); color: var(--bgs-gold);
  font-family: var(--mono); font-size: 12px; white-space: nowrap;
}
.pill::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--bgs-gold); }
.pill.is-syncing::before { animation: bgs-pulse 1s ease-in-out infinite; }
.pill.is-stale { background: rgba(var(--bgs-ivory-rgb), .08); color: var(--ink-2); }
.pill.is-stale::before { background: var(--ink-3); }
@keyframes bgs-pulse { 50% { opacity: .3; } }

.toggle {
  position: relative; width: 46px; height: 26px; border-radius: 999px;
  background: var(--bgs-gold); flex: none;
  transition: background .2s cubic-bezier(.2,.7,.2,1);
}
.toggle::after {
  content: ""; position: absolute; top: 3px; left: 23px; width: 20px; height: 20px;
  border-radius: 50%; background: var(--bgs-bg);
  transition: left .2s cubic-bezier(.2,.7,.2,1);   /* transition only — no animation on this element (WebKit) */
}
.toggle[aria-checked="false"] { background: var(--bgs-plate-2, #2f271f); }
.toggle[aria-checked="false"]::after { left: 3px; background: var(--ink-3); }
.toggle:focus-visible { outline: none; box-shadow: inset 0 0 0 2px var(--bgs-ivory); }

.set-danger { margin-top: 56px; padding-top: 18px; border-top: 1px solid var(--line); }
.set-danger .rust { display: block; padding: 10px 0; font-size: 14px; font-weight: 500; color: var(--bgs-rust, #c9705a); opacity: .85; background: none; border: 0; }
.set-danger .hint { margin: 2px 0 0; font-size: 12.5px; line-height: 1.5; color: var(--ink-3); }

/* confirm sheet — reuse the game-night bottom-sheet pattern if one exists */
.scrim { position: fixed; inset: 0; background: rgba(0,0,0,.55); display: flex; align-items: flex-end; z-index: 20; }
.sheet { width: 100%; padding: 22px 20px calc(32px + env(safe-area-inset-bottom)); background: var(--bgs-plate); border-radius: 24px 24px 0 0; box-shadow: inset 0 0 0 1px var(--line-gold); }
.sheet h2 { font-family: var(--serif); font-size: 22px; font-weight: 600; margin: 0 0 8px; }
.sheet p { font-size: 14.5px; line-height: 1.5; color: var(--ink-2); margin: 0; }
.sheet .acts { display: flex; gap: 8px; margin-top: 18px; }
.sheet .acts .btn { flex: 1; }
.btn-rust { background: var(--bgs-rust, #c9705a); color: var(--bgs-bg); }

@media (prefers-reduced-motion: reduce) {
  .toggle, .toggle::after { transition: none; }
  .pill.is-syncing::before { animation: none; }
}
```

If the existing sync button already carries a pulsing icon with `animation`, the pill pulse lives on `::before` (a different element), so the WebKit animation/transition rule is respected.

---

## Behaviour (wire to existing handlers, don't rewrite them)

| Control | Existing hook | Change |
|---|---|---|
| **Copy** | current "Copy link" | `navigator.clipboard.writeText(data-copy)`; button text → `Copied` for 1.5s, then back. Plate gets no colour change. |
| **Back to shelf** | current "Open shelf" | plain `<a href>` to `/u/{slug}` in the header. If the settings page can be reached from elsewhere later, this still points at the shelf, not `history.back()`. |
| **Public** switch | current toggle → RLS/RPC | same call. Flip `aria-checked` optimistically; revert on error and set `.s` text to `Couldn't update — try again`. |
| **Username** row | current "Change" | opens whatever the Change flow is today (inline field or sheet). No new UI. |
| **Sync now** row | current "Sync collection" | same call. While running: row disabled (`aria-disabled="true"`, opacity .6), pill → `.is-syncing` with text `Syncing 40 / 196` updated per page; on done → `Synced 10 Sep`; on error → `.is-stale`, text `Sync failed` and row `.s` text becomes the error. |
| **Sign out** | current | same. Now a row in its own Account group, never adjacent to Delete. |
| **Delete account…** | current | opens the confirm sheet. "Keep my account" is the primary-looking button and receives focus on open; Escape and scrim tap also close. "Delete account" runs the existing delete RPC, then redirects to `/`. |

### Why Sign out and Delete are no longer neighbours

Two destructive-looking actions side by side is how mis-taps happen. Three layers now:

1. **Distance.** Sign out is a normal row inside "Account". Delete is alone at the foot, 56px below, and the only red text on the page.
2. **Ellipsis + hint.** The label says `Delete account…` and the hint says you'll be asked to confirm, so even a mis-tap is a no-cost tap.
3. **Confirm sheet.** One explicit second tap, with "Keep my account" as the focused, prominent button and the consequence spelled out in the copy.

### Pill states

| State | Class | Text |
|---|---|---|
| synced | — | `Synced 9 Sep` |
| syncing | `.is-syncing` | `Syncing 40 / 196` |
| never synced | `.is-stale` | `Not synced` (Collection `.s` reads `Sync to pull your games`) |
| failed | `.is-stale` | `Sync failed` |

Date format: `D MMM`; add the year only if it's not the current year.

### Username missing

Username row `.val` shows `Add` in gold instead of a value; Sync row is `aria-disabled` with `.s` = `Add your BGG username first`.

---

## Accessibility

- Back link is the first focusable element and reads as a link, not a button.
- Every row is ≥ 56px tall — comfortably over the 44px target.
- Interactive rows are real `<a>`/`<button>`; display rows are `<div>`. Screen readers get the right roles without ARIA.
- Public switch uses `role="switch"` + `aria-checked` + `aria-labelledby` pointing at the row label, so the description reads as part of the name.
- Sync pill has `aria-live="polite"` — progress announces without stealing focus.
- Copy confirmation is a text change on the button itself, so it's announced by the same element that was activated.
- Focus ring is inset gold `box-shadow` (per the gold-ring rule), 8px radius on rows so it doesn't clip at the hairline.
- Chevrons/refresh icons are `aria-hidden`; the label text carries meaning.
- Delete is still a 44px-tall button; being visually quiet doesn't make it harder to reach.
- Confirm sheet: `role="dialog"`, `aria-modal`, labelled by its heading. Focus moves to "Keep my account" on open, is trapped inside, and returns to the Delete button on close.

---

## Verify

- [ ] iOS Safari, 390px: whole page visible without scrolling at default text size.
- [ ] Toggle knob slides in Safari (transition only, no dropped animation).
- [ ] Reduced motion: knob snaps, pill doesn't pulse.
- [ ] Copy → button reads `Copied`, clipboard has the full https URL, reverts after ~1.5s.
- [ ] Sync: pill counts up in steps of 20, row disabled during, ends on today's date.
- [ ] Sync failure path shows `.is-stale` and the error in the row.
- [ ] Public off → row still reads correctly, shelf 404s / shows private state for a logged-out visitor.
- [ ] Keyboard: Tab order = Back to shelf → Copy → Public → Username → Sync now → Sign out → Delete. Each shows the inset gold ring.
- [ ] VoiceOver: Public announces as "Public, Anyone with the link…, switch, on".
- [ ] No username: Sync row disabled with helper text; Username row shows `Add`.
- [ ] Delete sheet: opens with focus on "Keep my account"; Escape/scrim/Keep my account all close it; focus returns to Delete; "Delete account" calls the existing RPC once.
- [ ] Sign out row and Delete button are never within one thumb-width of each other at any viewport.
- [ ] Long display name / long BGG username truncate with ellipsis, don't wrap the plate.

---

## Commit

```
settings: replace plates with grouped ledger rows

Single-screen settings. Link plate with inline copy, sync state as a
live pill, sign out moved into an Account group, delete demoted to a
quiet foot link behind a confirm sheet. No RPC changes.
```

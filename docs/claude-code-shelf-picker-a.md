# Claude Code Spec — Shelf picker: "Inline list"

**Design source:** `docs/mockups/shelf-picker-mockup.html`, option A.
**Scope:** the rendered markup and styles of `js/shelf-picker.js`. Data
source and mounting behaviour stay as in
`docs/claude-code-browse-shelves-fallback.md`.
**Commit:** `Shelf picker: inline list, no plate, one-line meta`

---

## Rendered markup

Replaces the plate, heading, lede and nested card:

```html
<div class="picker" id="shelfPicker">
  <p class="kicker">Shelves you can browse as a guest</p>
  <ul class="picker-list" role="list">
    <li>
      <a class="picker-row" href="/u/<slug>">
        <span class="stack" aria-hidden="true">
          <img src="<thumb1>" alt="" loading="lazy"><img src="<thumb2>" alt="" loading="lazy"><img src="<thumb3>" alt="" loading="lazy">
        </span>
        <span class="picker-text">
          <b><display_name or bgg_username></b>
          <span class="picker-meta"><n> games · synced <rel></span>
        </span>
        <span class="chev" aria-hidden="true">›</span>
      </a>
    </li>
  </ul>
  <p class="picker-note">Your own shelf will be here once BGG lets us sync.</p>
</div>
```

- The first 3 thumbnails from `public_shelves()`; with fewer, the stack is
  simply smaller.
- Relative time is compact: "20h ago", "3d ago", "just now"; never
  "20 h ago". With `last_synced_at` null the synced part is omitted:
  "196 games".
- The note line renders only on `/welcome`; `/settings` omits it.
- `mountShelfPicker` keeps its signature; `title` / `lede` are accepted
  but unused.

## CSS (in the module's injected styles)

```css
.picker{margin-top:28px;padding-top:22px;border-top:1px solid rgba(var(--bgs-gold-rgb),.18);}
.kicker{font-family:'IBM Plex Mono',monospace;font-size:12px;letter-spacing:.02em;color:var(--bgs-gold-dim);margin:0 0 6px;}
.picker-list{list-style:none;margin:0;padding:0;}
.picker-row{display:flex;align-items:center;gap:14px;padding:12px 0;text-decoration:none;color:inherit;border-bottom:1px solid rgba(var(--bgs-ivory-rgb),.08);border-radius:6px;}
.picker-list li:last-child .picker-row{border-bottom:0;}
.picker-row:focus-visible{outline:none;box-shadow:0 0 0 2px var(--bgs-bg),0 0 0 4px var(--bgs-gold);}
.stack{position:relative;width:60px;height:54px;flex:none;}
.stack img{position:absolute;width:38px;height:38px;object-fit:cover;border-radius:4px;box-shadow:0 4px 10px rgba(0,0,0,.5);background:var(--bgs-plate);}
.stack img:nth-child(1){left:0;top:14px;transform:rotate(-8deg);}
.stack img:nth-child(2){left:11px;top:7px;transform:rotate(3deg);}
.stack img:nth-child(3){left:22px;top:0;transform:rotate(11deg);}
.picker-text{min-width:0;}
.picker-text b{display:block;font-weight:600;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.picker-meta{font-size:13px;color:var(--bgs-ivory-45);white-space:nowrap;}
.chev{margin-left:auto;color:var(--bgs-gold-dim);font-size:18px;}
.picker-note{font-size:12px;color:var(--bgs-ivory-45);margin:10px 0 0;}
```

The old plate-based picker styles, the h2 and lede styles, and the nested
card styles are removed.

## Accessibility

- The whole row is one link; its accessible name is the display name plus
  meta, in DOM order.
- The cover stack is `aria-hidden` with empty alt.
- The chevron is decorative.
- Focus ring via box-shadow only; the row has a 6px radius so the ring is
  not square against the text.

## Verify

- `/welcome`: tapping "Browse an existing shelf" shows the rule, kicker,
  one row, note. No card, no heading.
- Meta stays on one line at 375px ("196 games · synced 20h ago").
- Long display names truncate with an ellipsis rather than wrapping.
- `/settings`: the same list without the note.
- Keyboard: Tab reaches the row, the ring shows, Enter opens
  `/u/noknaruephon`.
- Lighthouse accessibility ≥ current.

---

## Implementation notes

- The note line is passed as `{ note: true }` by `welcome.html`; settings
  calls `mountShelfPicker(host)` and gets no note. The mount signature is
  otherwise unchanged, and `title` / `lede` are still accepted. The
  earlier `variant` and `limit` options had no remaining callers (the
  landing page now uses only `fetchPublicShelves()` for its guest link)
  and were dropped.
- `relativeTime()` is exported and now returns the compact form for any
  page that wants it; nothing else calls it today.
- Picker styles are scoped under `.picker` so the `.stack` and `.chev`
  names cannot collide with page styles.
- Verified in headless Chromium at 375px with a static mock, since the
  live page's script cannot run in this sandbox.

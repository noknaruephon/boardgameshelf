# Settings — share shelf as QR code

**Scope:** the "Your shelf" group on the Settings page. Nothing else.
**Mockup:** `docs/mockups/settings-ledger.html` — tap **QR** on the "Your shelf" heading row.
**Depends on:** `docs/settings-ledger.md` (shipped).

---

## Why

Copy link assumes the other person is somewhere you can paste to. At a table you just want them to point a camera at your phone. This adds a second share mode alongside the link, in the same place.

Also fixes a truncation bug from the first pass: the plate currently ellipsises the slug (`nokna…`) and keeps the prefix. The slug is the part that matters; the prefix should be what gets cut.

---

## Structure

```
Your shelf                                 ( Link | QR )

Link mode:
┌ …gameshelf.vercel.app/u/noknaruephon        Copy ┐

QR mode:
┌──────────────────────────────────────────┐
│           ┌────────────────┐             │
│           │  QR on ivory   │  220×220    │
│           └────────────────┘             │
│           Point a camera at it           │
└──────────────────────────────────────────┘
```

The segmented switch sits on the heading row, right-aligned, so the "Your shelf" label does double duty as the label for the switch. Only one panel is in the DOM flow at a time; the other is `hidden`.

---

## Markup

Replace the current `<h2>` + `.linkplate` with:

```html
<div class="h2row">
  <h2 id="g-shelf">Your shelf</h2>
  <div class="mode" role="tablist" aria-label="Share as">
    <button type="button" role="tab" aria-selected="true"  aria-controls="share-link" data-mode="link"><svg aria-hidden="true">…link…</svg>Link</button>
    <button type="button" role="tab" aria-selected="false" aria-controls="share-qr"   data-mode="qr"><svg aria-hidden="true">…qrcode…</svg>QR</button>
  </div>
</div>

<div class="linkplate" id="share-link" role="tabpanel">
  <span class="url"><em>boardgameshelf.vercel.app/u/</em><b>noknaruephon</b></span>
  <button type="button" class="copy" data-copy="https://boardgameshelf.vercel.app/u/noknaruephon">Copy</button>
</div>

<div class="qrplate" id="share-qr" role="tabpanel" hidden>
  <div class="ticket" id="share-qr-code" role="img" aria-label="QR code for boardgameshelf.vercel.app/u/noknaruephon"></div>
  <div class="qrhint">Point a camera at it</div>
</div>
```

Icons: Tabler `link` and `qrcode` (line, `currentColor`).

---

## CSS

```css
.h2row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }

.mode { display: flex; padding: 3px; border-radius: 999px; background: var(--bgs-plate); }
.mode button {
  display: inline-flex; align-items: center; gap: 5px;
  height: 28px; padding: 0 10px; border-radius: 999px;
  font-size: 12.5px; font-weight: 500; color: var(--ink-2);
  transition: background .15s cubic-bezier(.2,.7,.2,1), color .15s cubic-bezier(.2,.7,.2,1);
}
.mode button svg { width: 14px; height: 14px; }
.mode button[aria-selected="true"] { background: var(--bgs-bg); color: var(--bgs-ivory); box-shadow: inset 0 0 0 1px var(--line-gold); }
.mode button:focus-visible { outline: none; box-shadow: inset 0 0 0 2px var(--bgs-gold); }

/* truncation fix: cut the prefix, keep the slug */
.linkplate .url { display: flex; min-width: 0; flex: 1; font-family: var(--mono); font-size: 14px; }
.linkplate .url em {
  flex: 1 1 auto; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  direction: rtl; text-align: left;         /* ellipsis lands on the left */
  font-style: normal; color: var(--ink-3);
}
.linkplate .url b { flex: none; font-weight: 500; color: var(--bgs-ivory); }

.qrplate {
  margin-top: 10px; padding: 20px 16px 16px; border-radius: 18px;
  background: var(--bgs-plate); box-shadow: inset 0 0 0 1px var(--line-gold);
  display: flex; flex-direction: column; align-items: center;
}
/* both panels set display:flex, which would override the hidden attribute */
.linkplate[hidden], .qrplate[hidden] { display: none; }
.ticket { width: 220px; height: 220px; padding: 14px; border-radius: 14px; background: var(--bgs-ivory); }
.ticket svg { display: block; width: 100%; height: 100%; }
.qrhint { margin-top: 12px; font-size: 13px; color: var(--ink-3); }
```

The ticket is deliberately ivory with walnut modules. Inverted (light-on-dark) QR codes fail on a lot of camera apps; don't "theme" it dark.

---

## QR generation

- Vendor **`qrcode-generator`** (MIT, ~12 KB, no deps) into `vendor/qrcode.min.js`. Do not CDN it — the site is static and offline support is on the roadmap.
- Error correction `M`. Encode the absolute URL `https://boardgameshelf.vercel.app/u/{slug}`.
- Render as inline SVG built from `isDark(r,c)` — one `<path>` of `M{c} {r}h1v1h-1z` cells, `fill: var(--bgs-bg)`, `shape-rendering="crispEdges"`, `viewBox="0 0 n n"`. No `<canvas>` for the on-screen version; SVG stays crisp at any DPR.
- Generate once on first switch to QR, cache the SVG string. Regenerate only if the slug changes (username change flow).

```js
function buildQrSvg(url) {
  const qr = qrcode(0, 'M'); qr.addData(url); qr.make();
  const n = qr.getModuleCount(); let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  return `<svg viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><path d="${d}"/></svg>`;
}
```

---

## Behaviour

| Control | Does |
|---|---|
| **Link / QR** | Flips `aria-selected`, toggles `hidden` on the two panels. Remember the last mode in `localStorage['bgs.shareMode']` so it sticks across visits. |
| **Copy** | Unchanged from the ledger spec. |

The QR panel has no actions. It exists to be scanned by the person sitting next to you; the link panel already covers sending. No PNG, no share sheet, no URL text under the code.

### States

- **Private shelf** — QR tab is still selectable, but the ticket shows the QR greyed (`opacity: .35`) and the hint reads `Your shelf is private — scanning leads to a locked page.` Don't block; the user may be turning it public in a second.
- **Reduced motion** — switch has no animation to remove; nothing else moves.

---

## Accessibility

- Switch is a real `tablist`/`tab`/`tabpanel` trio; arrow keys move between tabs, Space/Enter activates.
- QR container is `role="img"` with the URL in the label, so a screen-reader user knows what it encodes.
- Ticket contrast: walnut on ivory is ~14:1. Keep 14px quiet-zone padding inside the ticket — scanners need it.

---

## Verify

- [ ] iOS Camera and Android Google Lens both open `/u/noknaruephon` from the on-screen ticket at arm's length.
- [ ] Link mode: long slug shows `…app/u/noknaruephon` — slug intact, prefix cut on the left.
- [ ] Only one panel is visible at a time — QR mode hides the link plate, Link mode hides the ticket.
- [ ] Switch remembers mode after reload.
- [ ] Private shelf: ticket dimmed, hint changes to the warning line.
- [ ] Keyboard: Tab to switch, ←/→ changes mode, focus ring is inset gold.
- [ ] VoiceOver reads the ticket as "QR code for boardgameshelf.vercel.app/u/noknaruephon, image".
- [ ] `vendor/qrcode.min.js` loads with no network call to a CDN.

---

## Commit

```
settings: add QR mode to shelf sharing

Link / QR switch on the Your shelf heading. QR renders as an ivory
ticket (SVG, vendored qrcode-generator) for scanning in person.
Also fixes the link plate truncating the slug instead of the prefix.
```

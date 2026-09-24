# Claude Code spec — Settings page restructure (option A, "grouped cards")

**Repo:** `noknaruephon/boardgameshelf` · **Flag:** `?settings2=1` · **Commits:** 2 (+1 flag removal later)
**Design:** Design canvas "BoardgameShelf Settings — 3 Options", artboard **A · Grouped cards (locked)**
**Depends on:** `claude-code-spec-themes.md` (theme strip), `claude-code-spec-display-name.md` (display-name sheet), `claude-code-spec-empty-shelf-settings.md` (not-connected state). All three are assumed merged. If any is not, stop and report before Commit 1.

---

## 0. Locate and report (no changes)

Before Commit 1, find and list back to me, with file paths and line ranges:

1. The Settings page markup (`settings.html` or wherever the page lives) and its JS module.
2. The existing **Link / QR segmented control** and the QR renderer (library call or canvas) it uses.
3. The existing **Public** and **Show expansions** toggle controls and their persistence calls (RPC / profile column).
4. The **theme strip** from the themes spec (`.settings-theme-strip` or equivalent) and `js/themes.js`.
5. The **display-name row** and the sheet it opens.
6. The **not-connected** Settings state from the empty-shelf spec ("Connect your BGG username" plate).
7. The **Sync now** control and the "Synced {date}" status pill.
8. Existing toggle, plate, hairline and icon-button classes in `css/base.css` (names verbatim).
9. How other flags are read (`?vibes=1` pattern) so `settings2` uses the same helper.

Stop for review after reporting. Do not restructure anything yet.

---

## 1. What changes

The page is regrouped into four **inset cards** with mono eyebrow labels, in this order:

| # | Eyebrow | Rows |
|---|---------|------|
| 1 | `SHARING` | Public toggle · Link block (URL + Copy link + Show QR, with inline QR expand) |
| 2 | `DISPLAY` | Theme strip · Show expansions toggle |
| 3 | `BOARDGAMEGEEK` | Collection summary + Sync now · helper line · Username row |
| 4 | `ACCOUNT` | Display name row · Sign out · Delete account… |

Removed: the standalone QR hero ("Point a camera at it"), the Link/QR segmented control, the Fraunces section headings ("Your shelf", "Look", …). The page title stays `Settings` with the display name as a muted line beneath it.

Everything is **rearrangement plus two behaviours**. No new data, no new RPCs.

### Behaviour 1 — Show QR (inline expand)
- Secondary button beside gold `Copy link`. Click → QR panel expands below the two buttons inside the Sharing card; label becomes `Hide QR`; button gets a gold hairline while open.
- Panel: ivory rounded plate 176×176 with the existing QR render (152 px), and a `Save image` text link beneath. Reuse the existing QR renderer and any existing save/download logic.
- Collapsed by default on every load (no persistence).

### Behaviour 2 — Public off dims the link block
- Public toggle is the **first row** of Sharing (it controls what follows).
- When off: the link block (URL row, Copy link, Show QR, QR panel) goes to `opacity: .4` and `pointer-events: none`; the QR panel collapses if open; a mono `Private` tag appears at the right end of the URL row.
- When on: everything returns. Transition `opacity 200ms`. Toggle persistence unchanged.

---

## 2. Layout constants

| Token / value | Where |
|---|---|
| Page padding | `16px 20px 40px` (mobile); reuse existing desktop max-width |
| Card gap (between groups) | `28px` |
| Eyebrow → card gap | `10px` |
| Card | `background: var(--bgs-plate)`, `border-radius: 16px`, no border |
| Row | `min-height: 56px`, `padding: 0 16px`; rows with helper text `padding: 16px` |
| Row hairline | `1px`, existing hairline token, `margin-left: 16px` (inset, iOS-style) |
| Eyebrow | IBM Plex Mono 12px, `letter-spacing: 1.5px`, `color: var(--bgs-gold)`, `padding-left: 4px`, uppercase |
| Row title | Inter 16px / 600, ivory |
| Row helper | Inter 14px / 400, `line-height: 20px`, muted ivory (≥4.5:1 on plate) |
| Row value (right) | Inter 14px muted; usernames/URL in IBM Plex Mono 13–14px |
| Toggle | existing toggle component (52×32 in mockup; keep the repo's size) |
| Buttons | height 44px, radius 12px; primary gold fill + `--bgs-bg` text; secondary transparent + hairline |
| QR panel | 176×176 ivory plate, radius 14px, QR 152px, `padding-top: 6px` above, `Save image` link 14px/600 gold |
| Theme strip | **unchanged from themes spec**: 5-column grid, 40px dots, plate colour with hairline inner disc, fifth slot empty, name under each |
| Collection summary | Fraunces 28px/600 count + Inter 15px "owned games"; status line 13px sage with 7px dot |
| Sync now | secondary button, 44px, right-aligned in the summary row |
| Delete account | plain row, text `--bgs-vote-pass` (clay); footnote 13px muted under the card |
| Focus rings | `box-shadow` only — never `outline` |

Selected theme ring: `box-shadow: 0 0 0 2px var(--bgs-plate), 0 0 0 4px var(--bgs-gold)` (inset-free double ring, as in the themes spec).

---

## 3. Page structure (after)

```html
<main class="settings settings--v2">
  <a class="settings-back" href="/{slug}">‹ Shelf</a>
  <h1 class="settings-title">Settings</h1>
  <p class="settings-subtitle">{displayName}</p>

  <section class="settings-group">
    <p class="settings-eyebrow">Sharing</p>
    <div class="settings-card">
      <div class="settings-row settings-row--toggle">
        <div><strong>Public shelf</strong><small>Anyone with the link can browse and start a game night</small></div>
        <button class="toggle" role="switch" aria-checked="true" data-setting="public"></button>
      </div>
      <div class="settings-hairline"></div>
      <div class="settings-share" data-share>
        <p class="settings-url"><svg …link icon…/><span>boardgameshelf.vercel.app/{slug}</span><em class="settings-private" hidden>Private</em></p>
        <div class="settings-actions">
          <button class="btn btn--primary" data-copy>Copy link</button>
          <button class="btn btn--secondary" data-qr-toggle aria-expanded="false">Show QR</button>
        </div>
        <div class="settings-qr" data-qr-panel hidden>
          <div class="settings-qr__plate"><canvas … /></div>
          <a href="#" data-qr-save>Save image</a>
        </div>
      </div>
    </div>
  </section>

  <section class="settings-group">
    <p class="settings-eyebrow">Display</p>
    <div class="settings-card">
      <div class="settings-row settings-row--stack">
        <div class="settings-row__head"><strong>Theme</strong><span data-theme-name>Walnut</span></div>
        <!-- existing theme strip, unchanged -->
      </div>
      <div class="settings-hairline"></div>
      <div class="settings-row settings-row--toggle">
        <div><strong>Show expansions</strong><small>Off: only base games appear. Expansions still sync.</small></div>
        <button class="toggle" role="switch" aria-checked="false" data-setting="expansions"></button>
      </div>
    </div>
  </section>

  <section class="settings-group">
    <p class="settings-eyebrow">BoardGameGeek</p>
    <div class="settings-card">
      <div class="settings-row settings-row--summary">
        <div><b class="settings-count">284</b> <span>owned games</span><small class="settings-synced">● Synced 20 Sep</small></div>
        <button class="btn btn--secondary" data-sync>Sync now</button>
      </div>
      <p class="settings-helper">Pulls owned games from BGG. A minute or two for big shelves.</p>
      <div class="settings-hairline"></div>
      <a class="settings-row settings-row--link" href="…"><span>Username</span><code>{bggUsername}</code>›</a>
    </div>
  </section>

  <section class="settings-group">
    <p class="settings-eyebrow">Account</p>
    <div class="settings-card">
      <button class="settings-row settings-row--link" data-display-name><span>Display name</span><span>{displayName}</span>›</button>
      <div class="settings-hairline"></div>
      <button class="settings-row settings-row--link" data-sign-out><span>Sign out</span><span>Google</span><svg …/></button>
      <div class="settings-hairline"></div>
      <button class="settings-row settings-row--danger" data-delete>Delete account…</button>
    </div>
    <p class="settings-footnote">Deleting removes your shelf, synced collection and sign-in. You'll be asked to confirm.</p>
  </section>
</main>
```

Existing IDs / data attributes that the JS module already binds to must be **kept** on the moved elements — move nodes, don't recreate them, so handlers keep working.

### Not-connected state (profile exists, `profile.slug` is null)
- Sharing card: Public row shown as normal (toggle disabled, off). Link block dimmed as in "Public off"; URL text replaced by `Connect BGG to get your link`; no `Private` tag.
- BoardGameGeek card: the summary row + helper + Username row are replaced by the existing **"Connect your BGG username"** plate content from the empty-shelf spec (heading, input, primary button). Same card chrome as the others.
- Display and Account cards unchanged.

---

## 4. Commits

### Commit 1 — `settings: regroup page into inset cards behind ?settings2=1`
- Add `.settings--v2` styles to `css/base.css` (or the settings stylesheet if one exists) using the constants above. Reuse toggle / button / hairline classes; add only what's missing.
- Restructure the markup as in §3. When `settings2` flag is **absent**, the current page renders exactly as today (guard with the same flag helper the other flags use: add the class / swap the template only when the flag is on).
- Remove nothing from the old template yet. Fifth theme slot stays empty.
- Not-connected state mapped as in §3.
- **Stop for review** with screenshots (or a description) of: connected + public, not-connected.

### Commit 2 — `settings: inline QR expand and public-off dimming`
- `data-qr-toggle` shows/hides `data-qr-panel`, flips label and `aria-expanded`, adds gold hairline while open. QR renders lazily on first open using the existing renderer.
- `Save image` wires to existing save/download if present; otherwise `canvas.toDataURL` → temporary `<a download="boardgameshelf-{slug}.png">`.
- Public toggle off → `data-share` gets `is-private` (opacity .4, `pointer-events:none`, unhide `.settings-private`), collapses QR. On → reversed.
- Keyboard: toggle buttons focusable, `box-shadow` focus ring; QR panel content reachable when open.
- **Stop for review.**

### Later — `settings: remove settings2 flag`
Delete the old template path and the flag check once Nok has tested on phone.

---

## 5. Hard rules (repo-wide, restated)
- Never apply `animation` and `transition` to the same property on the same element (WebKit drops the transition). The dimming uses `transition` only.
- Focus rings and gold rings via `box-shadow`; never `outline`.
- `games` table is BGG-owned; this page must not write to it. Sync stays the only writer.
- No new feature has an entry point outside the flag until the flag is removed.
- Tabler Icons for the link, QR, refresh, sign-out and chevron glyphs — no emoji, no inline lookalikes if a Tabler icon exists.

---

## 6. Deliberate deviations from the mockup
- Theme swatches are the **round dots from the themes spec**, not mini-shelf tiles (Nok's decision, 25 Sep).
- The mockup's profile card at the top is **dropped**; Display name lives in Account and the name shows under the title (Nok's decision, 25 Sep).
- Mockup URL `/nok` is a stand-in; real value is `boardgameshelf.vercel.app/{slug}`, truncating with an ellipsis if long.
- Mockup toggle is 52×32; keep the repo's existing toggle dimensions.
- "Sign out — Google" right-hand label only if the provider is available in the session; otherwise omit the label.

---

## 7. Verification checklist
- [ ] Without `?settings2=1` the page is pixel-identical to production.
- [ ] With the flag: four cards in order Sharing → Display → BoardGameGeek → Account, no leftover Fraunces section headers, no QR hero.
- [ ] Public toggle persists as before; off dims the link block, shows `Private`, collapses QR; on restores.
- [ ] Show QR expands inline, label flips to Hide QR, QR scans to the shelf URL, Save image downloads a PNG.
- [ ] Copy link copies `https://boardgameshelf.vercel.app/{slug}` and shows the existing confirmation.
- [ ] Theme strip identical to the themes spec (5 columns, 40px dots, fifth empty), selection still persists and repaints the page.
- [ ] Show expansions persists as before.
- [ ] Sync now works; count and "Synced {date}" update after sync.
- [ ] Display name row opens the existing sheet; subtitle under the title updates after save.
- [ ] Sign out and Delete account behave exactly as before (delete still confirms).
- [ ] Not-connected user sees the Connect plate inside the BoardGameGeek card and a dimmed link block reading "Connect BGG to get your link".
- [ ] Tab order top-to-bottom; every control has a visible `box-shadow` focus ring; toggles announce as switches.
- [ ] 390px wide: nothing wraps awkwardly, URL truncates with ellipsis. Desktop max-width unchanged.
- [ ] Safari iOS: dimming transition plays; no `outline` anywhere in the diff.

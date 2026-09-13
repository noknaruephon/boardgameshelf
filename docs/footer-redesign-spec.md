# Shelf footer redesign — Claude Code spec

**Scope:** one change — restyle the shelf page footer (the block that currently holds the BGG badge, Privacy/Terms links, © line, attribution text, and the Game Night button). No other page, component, or behaviour changes.

**Mockup:** `docs/mockups/footer-options.html` → **Option A** is locked. Options B and C are reference only; do not implement.

Stop for review after Commit 1 before starting Commit 2.

---

## What's wrong today (from screenshot, mobile)

- Legal text is set in mono at the same size/weight as the links → three lines of "paragraph" at the bottom of every shelf.
- BGG badge (full-colour, ~230px wide) is the loudest element on the page.
- Game Night button floats *below* the legal text with nothing anchoring it.
- Everything is centred, so the footer reads as a stack of unrelated items.

## Target structure (Option A)

```
┌──────────────────────────────────────┐
│  [ ● Game Night ]  ← solid gold,     │  ends the shelf; sits ABOVE the rule
│                      full width      │
├──────────────────────────────────────┤  1px hairline, ivory @ 10%
│  BoardgameShelf        ■ POWERED BY BGG │  wordmark left, small badge right
│  Privacy   Terms                     │  13px Inter, muted
│  © 2026 Naruephon Nateprachar.       │  11px Plex Mono, faint
│  All rights reserved.                │
│  Game data and images courtesy of    │
│  BoardGameGeek.                      │
└──────────────────────────────────────┘
```

Left-aligned. No centred text anywhere in the footer.

---

## Commit 1 — Move Game Night above the rule, restyle as primary

**Before (conceptually — match against the current DOM):**

```html
<footer class="shelf-footer">
  <a class="bgg-badge" …>…</a>
  <nav>Privacy policy · Terms of service</nav>
  <p>© 2026 …</p>
  <p>Game data and images …</p>
  <a class="btn-game-night" …>Game Night</a>
</footer>
```

**After:**

```html
<div class="shelf-end">
  <a class="btn-game-night btn-game-night--solid" href="…">
    <svg class="tabler-icon" …><!-- existing dice icon --></svg>
    Game Night
  </a>
</div>
<footer class="shelf-footer">
  …
</footer>
```

**CSS:**

```css
.shelf-end{padding:10px 0 26px}
.btn-game-night--solid{
  display:inline-flex;align-items:center;justify-content:center;gap:10px;
  width:100%;height:48px;padding:0 22px;border-radius:999px;border:0;
  background:var(--bgs-gold);color:var(--bgs-bg);
  font:600 15px/1 Inter,sans-serif;text-decoration:none;
}
.btn-game-night--solid:focus-visible{
  box-shadow:0 0 0 2px var(--bgs-bg),0 0 0 4px var(--bgs-gold);
}
```

If a solid-gold button style already exists in `css/base.css`, reuse it instead of adding `--solid`. Keep the existing href, icon, and any JS hooks on the button unchanged.

Suggested message: `feat(shelf): move Game Night above footer rule as primary action`

**Stop here for review.**

---

## Commit 2 — Rebuild the footer colophon

**After:**

```html
<footer class="shelf-footer">
  <div class="shelf-footer__row">
    <span class="shelf-footer__wordmark">BoardgameShelf</span>
    <a class="bgg-badge bgg-badge--small" href="https://boardgamegeek.com" rel="noopener" target="_blank">
      <!-- existing BGG badge asset, scaled -->
    </a>
  </div>
  <nav class="shelf-footer__links">
    <a href="/privacy">Privacy</a>
    <a href="/terms">Terms</a>
  </nav>
  <p class="shelf-footer__legal">© 2026 Naruephon Nateprachar. All rights reserved.</p>
  <p class="shelf-footer__legal">Game data and images courtesy of BoardGameGeek.</p>
</footer>
```

**CSS:**

```css
.shelf-footer{
  border-top:1px solid rgba(var(--bgs-ivory-rgb),.10);
  padding:22px 0 22px;text-align:left;
}
.shelf-footer__row{display:flex;align-items:center;justify-content:space-between;gap:12px}
.shelf-footer__wordmark{
  font:italic 500 22px/1 Fraunces,serif;letter-spacing:-.01em;color:var(--bgs-ivory);
}
.bgg-badge--small{height:18px;opacity:.72}          /* scale the existing asset */
.bgg-badge--small:hover{opacity:1}
.shelf-footer__links{display:flex;gap:18px;margin:14px 0 20px;font:500 13px/1 Inter,sans-serif}
.shelf-footer__links a{color:rgba(var(--bgs-ivory-rgb),.52);text-decoration:none}
.shelf-footer__links a:hover{color:var(--bgs-ivory)}
.shelf-footer__legal{
  margin:0;font:400 11px/1.55 "IBM Plex Mono",monospace;
  color:rgba(var(--bgs-ivory-rgb),.36);
}
.shelf-footer__legal + .shelf-footer__legal{margin-top:2px}
```

Copy changes:
- "Privacy policy" → **Privacy**; "Terms of service" → **Terms** (labels only; routes unchanged).
- Attribution is exactly one sentence: **"Game data and images courtesy of BoardGameGeek."** Do **not** include a "names and artwork belong to their publishers" line.

Suggested message: `feat(shelf): left-aligned footer colophon with wordmark, small BGG badge, mono legal`

---

## Layout constants

| Token / value | Where | Note |
|---|---|---|
| `48px` | Game Night height | matches existing pill buttons |
| `999px` | Game Night radius | |
| `10px 0 26px` | `.shelf-end` padding | space between last card row and button, and button to rule |
| `1px` ivory @ `.10` | footer top rule | |
| `22px` | footer top/bottom padding | |
| `22px` italic 500 Fraunces | wordmark | |
| `18px` | BGG badge height | opacity `.72`, `1` on hover |
| `13px` 500 Inter, ivory @ `.52` | links | gap `18px` |
| `11px` / `1.55` Plex Mono, ivory @ `.36` | legal lines | |
| `14px 0 20px` | links margin | |

Use the token names from `css/base.css` verbatim; if `--bgs-ivory-rgb` doesn't exist, add it next to `--bgs-ivory` rather than hard-coding an rgba.

## Deliberate deviations from the mockup

- Mockup uses an orange placeholder square for the BGG mark; production uses the real "Powered by BGG" asset already in the repo, scaled to 18px tall. Do not recolour or alter the asset (licence requirement).
- Mockup phone frame, stub cards, and option labels are mockup chrome — ignore.

## Verification checklist

- [ ] Game Night renders above the rule, full width, solid gold, dice icon intact, same destination as before.
- [ ] Footer is left-aligned at 390px and at desktop widths; wordmark and badge on one row.
- [ ] BGG badge still links to boardgamegeek.com and is visibly a BGG mark (attribution requirement).
- [ ] Links read "Privacy" and "Terms" and route to the same pages as before.
- [ ] Exactly two legal lines; no publisher line.
- [ ] Focus ring on Game Night and footer links uses `box-shadow`, never `outline`.
- [ ] No layout shift on the game grid above; page bottom padding unchanged.
- [ ] Tab order: Game Night → BGG badge → Privacy → Terms.
- [ ] Bag pages, `/n/:code`, and any other surface that reuses `.shelf-footer` still render correctly (check before merging).

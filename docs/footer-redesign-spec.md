# Shelf footer redesign — Claude Code spec

**Scope:** one change — restyle the shelf page footer (the block that currently holds the BGG badge, Privacy/Terms links, © line, and attribution text). The Game Night FAB is **not part of this change** — do not move, restyle, or re-parent it.

**Mockup:** `docs/mockups/footer-options.html` → **Option A** is locked. Options B and C are reference only; do not implement.

Single commit. Stop for review after the discovery step described in the Claude Code prompt.

---

## What's wrong today (from screenshot, mobile)

- Legal text is set in mono at the same size/weight as the links → three lines of "paragraph" at the bottom of every shelf.
- BGG badge (full-colour, ~230px wide) is the loudest element on the page.
- Game Night FAB can overlap the last legal line when scrolled to the bottom → footer needs FAB clearance.
- Everything is centred, so the footer reads as a stack of unrelated items.

## Target structure (Option A)

```
┌──────────────────────────────────────┐  1px hairline, ivory @ 10%
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

## The change — rebuild the footer colophon

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
  padding:22px 0 calc(22px + var(--fab-clearance, 88px));text-align:left;
}
/* --fab-clearance = FAB height + its bottom offset + 16px. Reuse the existing
   value if the page already reserves space for the FAB; otherwise define it once. */
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
| `1px` ivory @ `.10` | footer top rule | |
| `22px` | footer top padding | |
| `22px + --fab-clearance` | footer bottom padding | FAB height + bottom offset + 16px |
| `22px` italic 500 Fraunces | wordmark | |
| `18px` | BGG badge height | opacity `.72`, `1` on hover |
| `13px` 500 Inter, ivory @ `.52` | links | gap `18px` |
| `11px` / `1.55` Plex Mono, ivory @ `.36` | legal lines | |
| `14px 0 20px` | links margin | |

Use the token names from `css/base.css` verbatim; if `--bgs-ivory-rgb` doesn't exist, add it next to `--bgs-ivory` rather than hard-coding an rgba.

## Deliberate deviations from the mockup

- Mockup uses an orange placeholder square for the BGG mark; production uses the real "Powered by BGG" asset already in the repo, scaled to 18px tall. Do not recolour or alter the asset (licence requirement).
- Mockup Option A shows Game Night as an inline button above the rule; this was superseded — the production FAB stays exactly as it is. Only the colophon below the rule is implemented.
- Mockup phone frame, stub cards, and option labels are mockup chrome — ignore.

## Verification checklist

- [ ] Game Night FAB is byte-for-byte unchanged (markup, CSS, JS hooks, position).
- [ ] Scrolled to the very bottom, the FAB does not overlap any footer text at 390px width.
- [ ] Footer is left-aligned at 390px and at desktop widths; wordmark and badge on one row.
- [ ] BGG badge still links to boardgamegeek.com and is visibly a BGG mark (attribution requirement).
- [ ] Links read "Privacy" and "Terms" and route to the same pages as before.
- [ ] Exactly two legal lines; no publisher line.
- [ ] Focus ring on footer links uses `box-shadow`, never `outline`.
- [ ] No layout shift on the game grid above; page bottom padding unchanged.
- [ ] Tab order within the footer: BGG badge → Privacy → Terms.
- [ ] Bag pages, `/n/:code`, and any other surface that reuses `.shelf-footer` still render correctly (check before merging).

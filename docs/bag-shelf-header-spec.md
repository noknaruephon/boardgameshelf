# Spec: Bag — shelf header revision (count line + Bags sheet)

**Scope:** replace the Bags row and Share on the shelf (Stage 2 §5.1–5.2) with option 2 from `docs/mockups/bags-home-options.html`, and tidy the shelf header. Bag pages, storage, RPCs, packing mode, and the share sheet component are untouched.

## 1. Remove from the shelf

- The `BAGS` label and the scrolling pill row, with their CSS.
- `SHARE` from the eyebrow. The share-sheet component stays; it's still used on `/bag/{id}`.

## 2. Eyebrow

```
NOK.NARUEPHON                                    [⚙]
```

- Left: owner handle, unchanged.
- Right: **Settings as an icon button** — 18px gear (stroke 1.8, round caps), gold, inside a 44×44 hit area, `aria-label="Settings"`, border-radius 12px, plate background on hover/focus-visible. Vertically centred on the eyebrow text: pull it up with a negative top margin rather than growing the row. Negative right margin so the icon's optical edge aligns with the page gutter, not the hit area's edge.
- No "SETTINGS" word anywhere.

## 3. Count line

Back to a single fact on the left, plus a bags control on the right:

```
196 on the shelf                        ◆ 4 bags ▾
```

- Left: `{total} on the shelf`. **Never** `{n} of {total}` on the shelf — that was Stage 1's active-bag residue. Delete that branch.
- Right: a `<button>` in the same mono 13px, ivory-45, with the gold diamond, `{n} bags` in ivory-70 and a `▾` glyph. `aria-haspopup="dialog"`, `aria-expanded` mirrors the sheet. Min 32px tall via padding.
- **Zero bags:** the same button reads `◆ Pack a bag` and opens packing mode directly, skipping the sheet.
- Singular: `1 bag`.
- Behind `?bag=1` like the rest of the shelf-side feature; with the flag off the count line is just the left half.

## 4. Bags sheet

Same bottom-sheet mechanics as the share sheet (reuse its scaffold: grab handle, scrim, slide 200ms, no motion under `prefers-reduced-motion`, Escape/scrim/Done dismiss, focus trap, focus returns to the count-line button). `aria-labelledby` the title.

| Element | Spec |
|---|---|
| title | `Bags` — Fraunces 20px 500 |
| rows | one per bag, ordered `updated_at desc`: 14px radius, plate-2 background, 12/14 padding; **cover stack** of the first 3 games (30×40, 3px radius, −11px overlap, drop shadow + 1px ivory-14 inset ring); **name** Fraunces 17px 500; **meta** mono 12px ivory-45 `{n} games · {players} · {playtime}`; chevron `›` ivory-45 at right. Each row is an `<a href="/bag/{id}">`. |
| last row | `+ Pack a bag` — same shape, transparent, gold text, gold-45 inset ring; opens packing mode and closes the sheet |
| empty | not reachable (see §3) |
| max height | 70% of viewport, rows scroll inside; the title and grab handle stay put |

Cover stack images use the games' `thumbnail` field (small, already cached by the browser from the grid), through the same cover-proxy path the grid uses.

## 5. Bag names are required

In the packing bar, **"Pack N games" stays disabled until the name field has a non-empty trimmed value**, in addition to the existing `N > 0` condition. Placeholder stays "Name the bag". Remove the `"Bag"` fallback from `bag_create` callers; leave the DB default in place as a safety net.

Existing unnamed bags aren't migrated — Nok renames them via Edit.

## 6. Verification

- [ ] Flag off: eyebrow is handle + gear only; count line reads `196 on the shelf`; no bags control.
- [ ] Flag on, 4 bags: right side reads `◆ 4 bags ▾`; tap opens the sheet; 4 rows in `updated_at desc` order with correct stacks and meta; `+ Pack a bag` last.
- [ ] Row tap navigates to `/bag/{id}`; sheet's Escape/scrim/Done close it and focus lands back on the count-line button.
- [ ] 1 bag → `◆ 1 bag ▾`. 0 bags → `◆ Pack a bag` opens packing mode directly.
- [ ] Packing bar: name empty + 3 games → Pack disabled; type a name → enabled; clear it → disabled again.
- [ ] Gear: 44×44 target, `aria-label="Settings"`, opens the existing settings; optically flush with the right gutter on iPhone.
- [ ] No `SHARE`, no `BAGS` label, no pill row, no `{n} of {total}` anywhere on `/`.
- [ ] `/bag/{id}` unchanged: Share still works there.
- [ ] VoiceOver: bags button announces "4 bags, button, dialog"; sheet title announced on open.

## 7. Commit

```
refactor(shelf): move bags into the count line and tidy the header

Replaces the Bags pill row with a "N bags" control on the count line
that opens a Bags sheet. Drops Share from the shelf (kept on bag
pages), turns Settings into a gear icon button, restores the plain
"N on the shelf" count, and requires a name before packing a bag.
```

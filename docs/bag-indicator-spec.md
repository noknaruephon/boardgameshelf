# Spec: Bag — active-bag indicator revision (count line)

**Scope:** replace the boxed "Bag" chip (Stage 1 §4.4) with option **D** from `docs/mockups/bag-chip-revision.html`: the bag becomes the subject of the existing "N of 196 on the shelf" line. No changes to packing mode, the coverage bar, storage, or scoping.

## 1. Remove

The active chip block — the outlined card with the "Bag" heading, meta line, and the Edit / Unpack buttons — and its CSS.

## 2. Change the count line

When no bag is active, the line stays exactly as today: `196 on the shelf` (or the current wording).

When a bag is active:

```html
<p class="shelf-count shelf-count--bag" aria-live="polite">
  <span class="shelf-count__bag"><i class="diamond" aria-hidden="true"></i>Bali, October</span>
  <span class="shelf-count__sep" aria-hidden="true">·</span>
  <span>5 of 196 on the shelf</span>
  <span class="shelf-count__acts">
    <button type="button" class="shelf-count__act" data-bag-edit>Edit</button>
    <button type="button" class="shelf-count__act shelf-count__act--quiet" data-bag-unpack>Unpack</button>
  </span>
</p>
```

Styles (adapt to the project's naming; use production tokens):

| Part | Spec |
|---|---|
| line | `display:flex; align-items:center; gap:6px; flex-wrap:wrap;` colour `--bgs-ivory` at 70% for the count text; same mono size as the current line |
| bag name | Fraunces 15px 500, `--bgs-ivory`, `display:inline-flex; gap:7px` |
| diamond | 7×7, `border-radius:1.5px`, `--bgs-gold`, `transform:rotate(45deg)` — the same mark used in the wordmark, reused at small size |
| actions | `margin-left:auto; display:inline-flex; gap:2px` |
| Edit | mono 12px, `--bgs-gold`, padding `4px 6px`, no background, no border |
| Unpack | same, `--bgs-ivory` at 45%; hover/focus to full ivory |
| min hit area | give each action a 32px-tall tap target via padding or `::before`; the visible text stays small |

Unnamed bag → the name reads `Bag`.

## 3. Behaviour

- **Edit** → Packing mode with the bag pre-selected (unchanged from Stage 1).
- **Unpack** → `setActive(null)`; the line reverts to the plain count. No confirm.
- The `+ Add more` tile in the grid stays.
- On very narrow widths the actions wrap onto a second line, right-aligned; the name and count never truncate mid-word.

## 4. Accessibility

- The line is the one that already announces the visible count; `aria-live="polite"` on it means unpacking/repacking is announced without a separate region.
- Buttons are real `<button>`s with visible text — no icon-only controls.
- The diamond is decorative (`aria-hidden`).

## 5. Verification

- [ ] No bag active: count line unchanged, no diamond, no actions.
- [ ] Bag active: single line reads `◆ {name} · {n} of {total} on the shelf   Edit  Unpack`; no boxed chip anywhere.
- [ ] Unnamed bag shows `Bag` as the name.
- [ ] Edit opens Packing with the bag's games selected; Unpack restores the full grid and plain count.
- [ ] iPhone SE width: actions wrap cleanly, right-aligned; tap targets ≥ 32px tall.
- [ ] VoiceOver: line announced on change; both buttons reachable and labelled.
- [ ] Diff additive except for the removed chip markup/CSS.

## 6. Commit

```
refactor(bag): fold active-bag indicator into the shelf count line

Replaces the boxed Bag chip with an inline treatment: the bag name
leads the existing "N of total" line, with Edit / Unpack as small
text actions on the right.
```

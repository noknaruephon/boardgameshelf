# Task 2 of 2: Vibe filter — tabbed filter sheet

Depends on Task 1 (games carry `vibes[]`, `VIBES` exported from `js/vibes.js`).

Design source of truth: `docs/mockups/vibe-filter-mockup.html`. Open it and
click through all four toolbar states before writing code. It uses the real
tokens and the real sheet CSS, so match it closely.

Gate behind `?vibes=1` (same pattern as `?gamenight=1`) until Nok signs off;
without the flag the sheet must be byte-for-byte unchanged.

## Behaviour

1. Inside the filter sheet, between the Players group and the Time group,
   add a two-tab switcher: **Vibe** (default) and **Time & weight**.
   Time and Weight groups move inside the second tab, unchanged.
   Players + "Recommended counts only" stay above the tabs and apply in
   both modes.
2. Exactly one tab's criteria are live. **Switching tabs clears the other
   tab's draft** (vibe → null, time/weight → 'any'). A hidden time/weight
   must never keep filtering while the Vibe tab is showing.
3. Vibe is single-select; tapping the active pill deselects it.
4. Each vibe pill shows a live count for the current draft Players
   selection (mono, dimmed, like the mockup). Count 0 → `disabled`, still
   visible. Pills render in `VIBES` order; `other` is last.
5. Hint line under the pills: `<b>Party</b> — Loud, silly…` when selected;
   otherwise "Pick one. Or switch to Time & weight if you already know how
   long you have."
6. Chips row: a vibe chip reads e.g. `Party ✕`; removing it clears the vibe.
   Filter badge counts vibe as one group.
7. Keep the existing sort (BGG rating + sort button). Do **not** add
   shortest-first sorting — the mockup's per-vibe sort was dropped.
8. Reset (header link and empty state) resets mode to `vibe` too.
9. Empty state copy: "Nothing on the shelf for that. Try another vibe, or
   widen the player count." Reuse `.empty-state`.
10. No URL state for filters exists today; don't add it in this task.

## Code changes

### `js/filters.js`

```js
// before
export const DEFAULT_FILTERS = { minPlayers:1, maxPlayers:11, time:"any", weight:"any", bestFit:false };
// after
export const DEFAULT_FILTERS = { minPlayers:1, maxPlayers:11, mode:"vibe", vibe:null, time:"any", weight:"any", bestFit:false };
```

- `isFilterActive`: also `|| filters.vibe !== null`.
- `activeGroupCount`: `if(filters.vibe) n++;` and only count time/weight
  when `filters.mode === "numbers"`.
- `applyFilters`: replace the two time/weight lines with

```js
if(filters.mode === "vibe"){
  if(filters.vibe && !(g.vibes || []).includes(filters.vibe)) return false;
} else {
  if(filters.time!=="any" && timeBucket(g.time)!==filters.time) return false;
  if(filters.weight!=="any" && g.weight!==filters.weight) return false;
}
```

Add `export function vibeLabel(key){ … }` reading from `VIBES`.

### `index.html` — markup

In `#filterSheet .sheet-body`, after the Players `.sheet-group`, insert
`.mode-tabs` (role=tablist, two `role=tab` buttons with `aria-selected`,
`aria-controls`, plus `.mode-ink`), then wrap the vibe group in
`#panel-vibe` and the existing Time + Weight groups in `#panel-numbers`
(`role=tabpanel`, `aria-labelledby`). Copy the exact structure from the
mockup. `#vibePills` is rendered by JS from `VIBES`.

### `index.html` — script

- `syncSheetUI()`: set `data-mode` on `.mode-tabs`, `aria-selected` on tabs,
  toggle `data-show` on panels, render vibe pills with counts computed via
  `applyFilters(games, {...draftFilters, mode:'vibe', vibe:k}, state.search)`,
  set hint text.
- Tab click: `draftFilters.mode = …; draftFilters.vibe = null;
  draftFilters.time = draftFilters.weight = 'any'; syncSheetUI(); updateLiveCount();`
- Vibe pill click: toggle `draftFilters.vibe`, re-sync, update count.
  Reuse the existing `.segmented` click handler pattern but branch on
  `data-vibe` — don't let the time/weight handler swallow vibe pills.
- Chips: add `if(state.filters.vibe) chips.push({key:'vibe', label: vibeLabel(state.filters.vibe)})`
  and in the remove handler `else if(key==='vibe') state.filters.vibe = null;`
- Arrow Left/Right moves between the two tabs when a tab has focus.
- Remove the `?debug=vibes` tally from Task 1.

### CSS (inline `<style>` in `index.html`, under `/* vibe filter */`)

Copy `.mode-tabs`, `.mode-tab`, `.mode-ink`, `.mode-panel`, `.pill .n`,
`.vibe-hint`, `.pill:disabled` from the mockup. Tokens only — no new hex.
Focus ring is `box-shadow: 0 0 0 2px var(--bgs-gold) inset`, **never
`outline`** (paints beneath children).

### Motion

- `.mode-ink` moves with `transform` + `transition` only.
- `.pill` already has `transition:all .15s ease`; don't add `animation` to it.
- **WebKit rule:** never `animation` and `transition` on the same property
  of the same element. If you want a panel entrance, animate a wrapper.
- Add `.mode-ink, .mode-tab` to the existing
  `@media (prefers-reduced-motion:reduce)` block.

## Verification

- [ ] Without `?vibes=1`: sheet, chips, counts identical to production.
- [ ] With flag: open sheet → Vibe tab default, 9 pills with counts, Others
      shows 3.
- [ ] Pick Party → Show N updates → Apply → sheet closes, chip `Party ✕`,
      badge 1, count line reads N of 196.
- [ ] Open sheet → switch to Time & weight → Party pill cleared, Show 196.
      Pick Quick + Light → switch back to Vibe → both cleared.
- [ ] Set players 11 → Co-op pill disabled; apply → empty state with copy above.
- [ ] Reset clears vibe and returns to Vibe tab.
- [ ] Keyboard: Tab into tablist, ←/→ switches tabs, Tab into pills, Space
      toggles, gold inset focus ring visible.
- [ ] iOS Safari + Chrome: ink slides, pill fills; reduced motion → no motion.
- [ ] Narrow (≤400px): tab subtitles wrap or hide cleanly; pills wrap.

Commit: `feat(shelf): vibe filter with vibe / time-and-weight tabs (behind ?vibes=1)`

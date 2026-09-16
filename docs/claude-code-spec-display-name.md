# Claude Code spec — Editable display name in Settings

Mockup: `docs/mockups/settings-display-name-b.html` (option B: Settings row → sheet with eyebrow preview).
Scope: one change. The **display name** (the mono uppercase eyebrow above the `BoardgameShelf` wordmark) becomes editable by the shelf owner from Settings. The URL slug / BGG username is **not** touched by this work.

Work in two commits. Stop for review after each.

---

## Context you need to find first

Before writing code, locate and report back (one short list, then continue):

1. The Supabase table that holds one row per shelf owner (likely `profiles` or `shelves`) and the column currently holding the Google display name.
2. Every place the eyebrow name is rendered: shelf header, `/api/og/[username]`, invite poster host line (if any), share sheets (if any).
3. The existing Settings page/sheet markup and the existing bottom-sheet component/classes (and how other sheets pick up glass material when `?glass=1` is on).
4. The eyebrow's current CSS (font, size, `letter-spacing`, `text-transform`) — the sheet preview must reuse these exact declarations, ideally via the same class.

---

## Rules (product, locked)

- Stored **as typed** (mixed case, any script incl. Thai). Uppercase + tracking stays a CSS transform on the eyebrow only.
- Normalise before validating and saving: trim, collapse internal whitespace to single spaces.
- Valid: 2–32 chars after normalisation; letters (any script), digits, space, `.` `-` `'` `’`. No emoji, no line breaks.
- Not unique. Two shelves may share a display name; the slug is the identity.
- Empty → Save disabled. Never silently fall back to the Google name once the user has set one.
- Never translated (already covered by the i18n content rule — do not add `display_name_th`).
- Server re-validates. Client validation exists only for the inline message.

---

## Commit 1 — data + RPC + render from the new column

### Migration (`supabase/migrations/…_display_name.sql`)

```sql
alter table public.<owner_table>
  add column if not exists display_name text,
  add column if not exists display_name_updated_at timestamptz;

-- backfill from the Google name column found in step 1
update public.<owner_table>
   set display_name = <google_name_column>,
       display_name_updated_at = now()
 where display_name is null and <google_name_column> is not null;

create or replace function public.update_display_name(p_name text)
returns public.<owner_table>
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_row  public.<owner_table>;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  v_name := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');

  if char_length(v_name) < 2 or char_length(v_name) > 32 then
    raise exception 'display name must be 2–32 characters' using errcode = '22023';
  end if;

  -- letters (any script), digits, space, . - ' ’
  if v_name !~ '^[[:alpha:][:digit:] .''’-]+$' then
    raise exception 'display name has unsupported characters' using errcode = '22023';
  end if;

  update public.<owner_table>
     set display_name = v_name,
         display_name_updated_at = now()
   where <user_id_column> = auth.uid()
  returning * into v_row;

  if v_row is null then
    raise exception 'no shelf for this user' using errcode = 'P0002';
  end if;

  return v_row;
end;
$$;

revoke all on function public.update_display_name(text) from public;
grant execute on function public.update_display_name(text) to authenticated;
```

RLS: make sure the client cannot `update` `display_name` directly — writes go through the RPC only. If an existing owner-update policy is broad, add a column-level restriction or a trigger rather than widening anything.

### Render

- Every location found in step 1.2 reads `display_name` (fall back to the Google column only when `display_name` is null, i.e. pre-backfill rows).
- OG route `/api/og/[username]`: read `display_name`. In the page `<head>`, emit the OG image URL with a cache-buster `?v={display_name_updated_at as unix seconds}` so link previews refresh after a rename. Keep the image itself unchanged otherwise (no BGG badge, fanned-hand layout).
- Invite poster: if it prints a host name, use `display_name`. No other poster changes.

Suggested commit message: `feat(profile): display_name column + update_display_name RPC, render eyebrow from it`

**Stop for review.**

---

## Commit 2 — Settings row + edit sheet

Behind `?displayname=1` until reviewed on the deployed preview; the flag gates only the *row* in Settings. Removal is a one-line follow-up.

### Settings row

In the shelf/profile group of the existing Settings surface, add above the BGG username row:

```html
<button class="<existing-row-class>" id="displayNameRow">
  <div class="<row-text-class>">
    <div class="<row-key-class>">Display name</div>
    <div class="<row-value-class>" data-display-name>Naruephon Nateprachar</div>
  </div>
  <!-- existing chevron icon (Tabler) -->
</button>
```

The BGG username row (if not already present) shows the slug with a Tabler `lock` icon instead of a chevron and is not tappable. Helper text below the group:

> Your shelf lives at `boardgameshelf.vercel.app/{slug}`. It follows your BGG username and can’t be changed here.

### Sheet

Use the existing bottom-sheet component. Structure, top to bottom:

1. Header: `<h3>Display name</h3>` (Fraunces 500, 22px) + glass round `×` (44px) top-right. No Cancel text link.
2. **Preview block**: a plate showing the eyebrow and the `BoardgameShelf` wordmark using the *production* eyebrow and wordmark classes. Updates on every keystroke from the normalised value. When the input is empty it shows `Your name` at 28% ivory.
3. Field: label `Shown above your shelf’s name`, then the input (16px, `autocomplete="nickname" autocapitalize="words" spellcheck="false" maxlength="40"`) with a mono counter `{n} / 32` inside the field on the right (tabular numerals; turns `--bgs-danger` when n > 32).
4. Message line (`min-height: 18px`): empty until the value is dirty; shows the validation error in `--bgs-danger`.
5. Save: full-width gold pill, 50px, `Save`. Disabled (35% opacity) unless value is dirty **and** valid. While saving, replace the label with an 18px spinner and keep the button disabled.

Behaviour:

- Open pre-fills the stored value and focuses the input after the open transition (~60ms).
- Enter → save. Esc, scrim tap, `×` → close and revert the input to stored value.
- Save → call `update_display_name`; on success update the stored value, the Settings row value, the header eyebrow if visible, close the sheet, show a glass toast `Display name saved` (check icon in `--bgs-gold`) for 1.8s.
- On RPC error → stay open, show the server message in the message line, re-enable Save.
- Client validation mirrors the RPC exactly (see mockup JS: `norm()`, `validate()`, regex `^[\p{L}\p{M}\p{N} .'\u2019-]+$` with the `u` flag).

### Layout constants

| Token / constant | Value |
|---|---|
| Sheet inset | 10px sides and bottom, radius 28px |
| Sheet padding | 18px 18px 16px |
| Header title | Fraunces 500, 22px |
| Close round | 44px glass round, Tabler `x` |
| Preview plate | radius 18px, padding 22px 18px 18px |
| Eyebrow in preview | **reuse production eyebrow class verbatim** (Plex Mono, uppercase, tracked) |
| Wordmark in preview | reuse production wordmark class, sized 34px |
| Input | 16px text, 14px vertical padding, radius 14px |
| Field focus | `box-shadow: 0 0 0 2px var(--bgs-gold)` on the wrapper — **never `outline`** |
| Field invalid | `box-shadow: 0 0 0 2px var(--bgs-danger)` |
| Counter | Plex Mono 12px, `font-variant-numeric: tabular-nums` |
| Save pill | height 50px, radius 999px, gold, label 15px/600; disabled opacity .35 |
| Toast | glass pill, bottom 34px, 13.5px/500, 1.8s |
| Sheet motion | `transform` 320ms `cubic-bezier(.2,.8,.2,1)`; scrim `opacity` same |
| Reduced motion | all durations 0 under `prefers-reduced-motion: reduce` |

Glass material: when `?glass=1` is on, the sheet, round buttons and toast take glass from `glass.css` exactly as other sheets do. Without the flag they fall back to `--bgs-plate` surfaces. Do not duplicate glass rules into a new file.

**WebKit rule (hard constraint):** never put both `animation` and `transition` on the same CSS property of the same element — WebKit drops the transition. The spinner animates `transform` on its own element; the Save button transitions only `opacity`. Keep it that way.

Suggested commit message: `feat(settings): editable display name — row + edit sheet with eyebrow preview (behind ?displayname=1)`

**Stop for review.**

---

## Deliberate deviations from the mockup

- The mockup's Settings groups other than *Display name* / *BGG username* are placeholders; keep the live Settings content as is.
- Token *values* in the mockup were approximated — use the real ones from `css/base.css`. Token *names* match.
- If the production eyebrow's `letter-spacing` differs from the mockup's `.26em`, production wins.

---

## Verification checklist

- [ ] Backfill: every existing owner row has `display_name` populated; none are null.
- [ ] RPC rejects: empty, 1 char, 33 chars, emoji, newline, `<script>` — each with a readable message. Accepts Thai, accents, `O'Brien`, `Jean-Luc`, `J. Doe`.
- [ ] Anonymous call to `update_display_name` fails. A signed-in user can only change their own row.
- [ ] Direct `update` of `display_name` via the client (bypassing the RPC) is denied by RLS.
- [ ] Shelf header eyebrow shows the new name immediately after save without reload.
- [ ] OG image shows the new name; the `og:image` URL carries a new `?v=` after a rename.
- [ ] Invite poster host line (if present) shows the new name.
- [ ] Settings row hidden without `?displayname=1`, visible with it.
- [ ] Sheet: preview updates per keystroke; counter turns red past 32; Save disabled until dirty + valid; Enter saves; Esc/scrim/× revert.
- [ ] Saving state shows spinner, button disabled, second tap does nothing.
- [ ] Toast appears and clears after ~1.8s.
- [ ] Focus rings via `box-shadow` only — grep confirms no `outline:` added.
- [ ] `prefers-reduced-motion: reduce` → no sheet slide, no spinner rotation.
- [ ] iOS Safari: keyboard does not push the sheet off-screen; input font is 16px (no zoom on focus).
- [ ] No `animation` + `transition` on the same property anywhere in the new CSS.

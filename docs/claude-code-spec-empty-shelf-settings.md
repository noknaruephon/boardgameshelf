# Spec: empty shelf actions + Settings before BGG is connected

Save as `docs/claude-code-spec-empty-shelf-settings.md`.

**Who this is for:** a signed-in user with no BGG username yet. Today `/shelf` shows them two text links and an eyebrow link, and `/settings` bounces them to `/welcome`.

**What changes**

1. `/shelf` empty state: "Connect your collection" becomes a gold primary button, "Sign out" becomes a quiet outlined button, the eyebrow "· Connect your collection" link goes, and the owner's Settings gear appears in the same place it sits on a synced shelf.
2. `/settings` works before BGG is connected: every group is shown and usable. The link plate becomes a connect prompt, and the BoardGameGeek Username row is where the username is added.
3. To make (2) possible, a profile row may exist without a slug.

**Not changing:** `/welcome` stays as the guided path (the gold button still goes there). The synced-shelf header, the connected Settings page, OG images, the poster.

**Flag:** none. Commit 1 is a restyle of an existing state. Commits 2 and 3 have no entry point until the gear lands at the end of commit 3.

**Reference:** Design canvas "Empty shelf — not connected" (three artboards: empty shelf, Settings not connected, Username row opened). All values you need are written out below; the canvas is not in the repo.

---

## House rules that apply here

- Focus rings are `box-shadow` only. Never `outline` (always `outline:none` + a shadow).
- WebKit: never put `animation` and `transition` on the same property of the same element. Nothing in this spec adds an animation; the new buttons only use `transition: background`.
- Token names come verbatim from `css/base.css`. No new tokens.
- Sentence case, no placeholder text.

---

## Commit 1 — empty shelf actions (`shelf.html` only)

### Before (`showError`, `kind === 'empty-own'`)

```js
const a = document.createElement('a');
a.href = '/welcome'; a.className = 'owner-link'; a.textContent = 'Connect your collection';
eyebrow.append(' · ', a);
shelf.innerHTML = `<p class="empty-state">Your shelf is empty.<br>Connect your BoardGameGeek account and your owned games will appear here.<a href="/welcome">Connect your collection</a><a href="#" id="emptySignOut">Sign out</a></p>`;
```

### After

```js
// Eyebrow is the name alone; the gear joins it in commit 3.
shelf.innerHTML = `
  <div class="empty-state empty-state--own">
    <p>Your shelf is empty.<br>Connect your BoardGameGeek account and your owned games will appear here.</p>
    <div class="empty-actions">
      <a class="empty-btn empty-btn--gold" href="/welcome">Connect your collection</a>
      <button type="button" class="empty-btn empty-btn--quiet" id="emptySignOut">Sign out</button>
    </div>
  </div>`;
```

- Delete the three lines that build and append the eyebrow link.
- Sign out is now a real `<button>`; drop the `e.preventDefault()` in its handler, keep the rest.
- The other empty states (`not-found`, `bag-not-found`, `private`, filters) keep their text links. Do not touch `.empty-state a` / `.empty-state button`.

### CSS (next to the existing `.empty-state` rules)

```css
.empty-state--own p{margin:0;line-height:1.5;}
.empty-actions{display:flex;flex-direction:column;gap:10px;width:100%;max-width:320px;margin:24px auto 0;}
/* Two classes so these beat `.empty-state a` and `.empty-state button` (0,1,1). */
.empty-state .empty-btn{
  display:flex;align-items:center;justify-content:center;
  min-height:52px;padding:0 18px;margin:0;border-radius:12px;
  border:1.5px solid transparent;
  font:600 16px/1 'Inter',sans-serif;text-decoration:none;cursor:pointer;
  transition:background .15s ease;
}
.empty-state .empty-btn--gold{background:var(--bgs-gold);border-color:var(--bgs-gold);color:var(--bgs-on-gold);}
.empty-state .empty-btn--gold:hover{background:var(--bgs-gold-hover);border-color:var(--bgs-gold-hover);}
.empty-state .empty-btn--quiet{background:transparent;border-color:rgba(var(--bgs-ivory-rgb),.18);color:var(--bgs-ivory-70);}
.empty-state .empty-btn--quiet:hover{background:rgba(var(--bgs-ivory-rgb),.06);}
.empty-state .empty-btn:focus-visible{outline:none;box-shadow:0 0 0 2px var(--bgs-bg),0 0 0 4px var(--bgs-gold);}
@media (prefers-reduced-motion:reduce){ .empty-state .empty-btn{transition:none;} }
```

These are `/welcome`'s `.btn.gold` and `.btn.quiet` values. Do **not** reuse `/welcome`'s `.btn.ghost`: in this repo that class is the disabled-placeholder look, not a ghost button.

### Layout constants

| Thing | Value |
|---|---|
| Text → actions gap | 24px |
| Actions column | 100% wide, max 320px, centred, 10px gap |
| Button | min-height 52px, radius 12px, border 1.5px, Inter 600 16px |
| Primary | `--bgs-gold` fill, `--bgs-on-gold` text, hover `--bgs-gold-hover` |
| Quiet | transparent, border ivory .18, text `--bgs-ivory-70`, hover ivory .06 |
| Empty-state padding | unchanged (60px 10px) |

**Commit message:** `shelf: primary and quiet buttons on the not-connected empty state; drop eyebrow link`

**Stop for review.**

---

## Commit 2 — a profile can exist before BGG (`supabase/`, `js/auth.js`, `api/_lib/supabase.js`, `welcome.html`, `shelf.html`)

Display name, theme, Public and Show expansions are all columns on `profiles`, and that row is only created when a username is claimed (`slug text not null`). This commit lets the row exist first. **"Connected" now means `profile.slug` is set, never just "a profile exists".**

### Migration `supabase/migrations/20260922000000_profile_before_bgg.sql`

```sql
alter table public.profiles alter column slug drop not null;
alter table public.profiles alter column bgg_username drop not null;

-- Both or neither: a shelf address and the username it comes from travel together.
alter table public.profiles drop constraint if exists profiles_slug_with_username;
alter table public.profiles add constraint profiles_slug_with_username
  check ((slug is null) = (bgg_username is null));
```

- `unique (slug)` and `profiles_slug_format` both pass on null; leave them.
- `public_shelves()`: add `and p.slug is not null` to its `where` (the join on `user_games` already excludes these rows; this makes it explicit). Recreate the function in this migration, body otherwise unchanged.
- `update_display_name()`, `update_theme()`, the display-name guard trigger, RLS policies: unchanged. The guard already lets an INSERT seed `display_name`.
- End with the same PostgREST schema reload the other migrations use.

### `js/auth.js`

Add:

```js
/** The user's profile row, created without a shelf address if they have none yet. */
export async function ensureMyProfile() {
  const existing = await fetchMyProfile();
  if (existing) return existing;
  const user = await getUser();
  if (!user) throw new Error('Not signed in');
  const { error } = await supabase
    .from('profiles')
    .insert({ id: user.id, display_name: userDisplayName(user) || null });
  // 23505: another tab got there first. Either way the row exists now.
  if (error && error.code !== '23505') throw error;
  return fetchMyProfile();
}
```

Change `claimProfile()` so it works with or without a row:

- `const existing = await fetchMyProfile();`
- `existing?.slug` → `return { profile: existing }` (already claimed; never re-claim).
- `existing` without slug → `update({ slug, bgg_username: bgg })` on own id, select `PROFILE_COLUMNS`. Do not send `display_name` (the guard refuses direct updates; it was seeded at insert).
- no row → the insert as today.
- `23505` → `{ error: 'taken' }` in both paths, as today.

### Every "has a shelf" check

| File | Today | After |
|---|---|---|
| `welcome.html` boot | `if (profile) startSync()` | `if (profile?.slug) startSync()`; a slugless row falls through to `setState('empty')` |
| `api/_lib/supabase.js` `requireProfile` | `if (!profile)` | `if (!profile?.bgg_username)`, same 404 message |
| `shelf.html` `loadGames` | `mine?.slug` | already right. Also keep `mine` and call `applyProfileTheme(mine)` before throwing `empty-own`, so the empty shelf wears the chosen theme |
| `landing.html` | `profile?.slug` | already right, no change |
| `settings.html` | handled in commit 3 | |

Grep for any other `fetchMyProfile()` result used as a boolean and report it before changing it.

**Commit message:** `profiles: allow a row before a BGG username is claimed; "connected" means slug`

**Stop for review.** Nok runs the migration by hand in Supabase before commit 3 is tested.

---

## Commit 3 — Settings before BGG + the gear (`settings.html`, `shelf.html`)

### Boot

```js
// before
profile = await fetchMyProfile();
if (profile) { renderSettings(); … } else { location.replace('/welcome'); }

// after
profile = await ensureMyProfile();
renderSettings(); restoreShareMode(); updateBrowseOffer();
```

Opening Settings creates the row. (Deliberate: simpler than creating it on the first saved setting, and every existing handler keeps working against a real `profile` object.)

Add `const connected = () => Boolean(profile?.slug);` and use it below.

### Group by group, when `!connected()`

**Header**
- `#who`: `profile.display_name || userDisplayName(user)`. No `/u/…` fallback.
- `#backLink`: `href="/shelf"`, label unchanged.

**Your shelf**
- Hide `#shareMode` (Link | QR tabs), `#share-link`, `#share-qr`. Skip `renderQr()` and the `shelfHost/shelfSlug/copyLink` writes.
- Show a new plate in the link plate's place. Same `.linkplate` class, so same padding, radius, plate fill and gold hairline:

```html
<div class="linkplate connectplate" id="connectPlate" hidden>
  <span class="cp-text">
    <span class="cp-title">Connect your BGG username</span>
    <span class="cp-desc">to import your collection and generate a shareable link.</span>
  </span>
  <button type="button" class="copy" id="connectBtn">Connect</button>
</div>
```

```css
.connectplate .cp-text{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;}
.connectplate .cp-title{font-size:16px;font-weight:500;color:var(--bgs-ivory);}
.connectplate .cp-desc{font-size:13px;line-height:1.4;color:var(--bgs-ivory-70);}
```

  Copy is exact, including the lowercase "to": the description reads on from the title. `#connectBtn` reuses `.linkplate .copy` (gold, 600, 14px, 44px target). It calls `showBggForm(true)` and scrolls the form to the centre of the viewport (`behavior:'smooth'`, `'auto'` under reduced motion).
- Display name row and sheet, Public, Show expansions: unchanged and live. They save to the row and carry over when the shelf appears.

**Look:** unchanged.

**BoardGameGeek**
- Username row: already renders gold `Add` via `.val.add` when there's no username. Keep.
- Username form in connect mode (`!connected()` when opened):
  - field starts empty, placeholder unchanged;
  - `#bggNewPreview` shows the full address as typed: `boardgameshelf.vercel.app/u/<b>slug</b>` (use `location.host`), instead of "New address: …";
  - the `.hint` paragraph ("Your shelf address changes with it…") is hidden; nothing replaces it;
  - `#bggSave` reads **Connect**. Cancel unchanged.
  - Submit keeps using `changeBggUsername()` (the row exists, so the update is the claim). Same `taken` / `invalid` messages.
  - On success: `renderSettings()` (now the connected page), close the form, then start the sync in place by running the same path as a `#syncBtn` click. Do not write the "Saved. Your shelf is now…" hint on this path; the sync's own step text takes over.
  - In change mode (already connected) the form behaves exactly as today, label "Save", hint shown.
- Collection row: hint `Add your BGG username to sync`, pill `setPill('stale', 'Not connected')`.
- Sync now: already `aria-disabled` without a username. Change `NO_USERNAME_HINT` to `Available once your username is added`.
- Browse an existing shelf: shown (the existing `updateBrowseOffer()` rule already offers it; check it does).

**Account:** unchanged.

**Delete**
- Footer hint: `Removes your sign-in and anything you've set here. You'll be asked to confirm.`
- Confirm sheet body: `This removes your sign-in and anything you've set here. It can't be undone.` (no `/u/…`, no game count).
- Connected users keep today's copy for both.

### The gear on the empty shelf (`shelf.html`)

Lift the gear construction out of `renderOwner`'s `getUser().then` into `appendOwnerGear(eyebrow)` and call it from both places: the owner's synced shelf (unchanged result) and the `empty-own` branch. Same `.owner-gear` class, same `GEAR_ICON`, same `/settings` target, `aria-label="Settings"`. No new CSS.

### Layout constants

| Thing | Value |
|---|---|
| Connect plate | `.linkplate` as is: padding 12px 14px, radius 12px, `--bgs-plate`, inset 1px `--line-gold`, margin-top 10px |
| Plate title | Inter 500 16px, `--bgs-ivory` |
| Plate description | Inter 400 13px / 1.4, `--bgs-ivory-70`, 3px under the title |
| Plate action | `.linkplate .copy` as is |
| Collection pill | `.pill.is-stale`, text "Not connected" |
| Gear | `.owner-gear` as is: 44px target, 18px icon, `--bgs-gold` |

### Deliberate deviations from the canvas

- The canvas shows a typed value in the username field; the real field starts empty.
- The canvas is walnut at 390px only. Other themes and wider screens follow the existing page rules; nothing here is width-specific.

**Commit message:** `settings: usable before BGG is connected; connect plate, connect-mode username form, gear on the empty shelf`

---

## Verification checklist

Commit 1
- [ ] Signed in, no username, `/shelf`: eyebrow shows the name only, no "· Connect your collection".
- [ ] Gold button goes to `/welcome`. Sign out signs out and lands on `/`.
- [ ] Buttons are 52px tall, stop at 320px wide on desktop, full width minus gutters on a phone.
- [ ] Tab to each: double ring (bg then gold), no outline.
- [ ] `/u/nobody-here`, a private shelf, a missing bag and "Clear filters" still show text links.

Commit 2
- [ ] Migration runs twice without error.
- [ ] Existing users: `/u/<slug>`, Settings, sync, browse picker all behave as before.
- [ ] New sign-in → `/welcome` → claim → sync works with no row beforehand (insert path).
- [ ] New sign-in → open Settings first (commit 3) → `/welcome` → claim works (update path), display name kept.
- [ ] A slugless row never appears in the browse picker.
- [ ] `/api/sync/collection` with a slugless row returns the 404 message, not a crash.

Commit 3
- [ ] No username: `/settings` renders, no redirect. Back to shelf goes to `/shelf`.
- [ ] Link/QR tabs and both share panels hidden; connect plate shown with the exact copy.
- [ ] Plate Connect and the Username row both open the form; plate Connect scrolls it into view.
- [ ] Connect mode: empty field, full-address preview, no hint paragraph, button reads Connect.
- [ ] Taken and invalid usernames show today's messages.
- [ ] Successful connect: page becomes the connected Settings (link plate, tabs, real username), sync starts by itself, pill counts up.
- [ ] Change display name, theme, Public, Show expansions before connecting; connect; all four survived.
- [ ] Theme picked before connecting shows on `/shelf`'s empty state.
- [ ] Delete account from the not-connected state: new copy in footer and sheet, deletion works.
- [ ] Gear shows on the empty shelf in the same spot as on a synced shelf, and on the synced shelf it is unchanged.
- [ ] Already-connected user: Settings is pixel-identical to before.
- [ ] VoiceOver: plate reads title, description, then "Connect, button".

---

## Open, not in this spec

- The Settings username form does not check that the BGG user exists (the `/welcome` step does, through `lookupBggUser`). A typo here shows up as a failed sync. Worth adding the live check to the form later, for both connect and change mode.

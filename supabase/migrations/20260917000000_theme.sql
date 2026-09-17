-- Selectable dark themes. Spec: docs/claude-code-spec-themes.md.
--
-- profiles.theme is the shelf owner's chosen theme id (navy / walnut /
-- mahogany / oak), null until they pick one, in which case the site renders
-- navy. Visitors read it with the rest of the public profile, so the shelf
-- looks the way its owner styled it. The check constraint keeps unknown ids
-- out whichever path writes the column; update_theme() is the client's write
-- path, mirroring update_display_name(), and validates before the constraint
-- can complain so the error is a readable one.
--
-- Adding a theme: extend the constraint here (drop + add), the CSS block in
-- css/base.css and the entry in js/themes.js.
--
-- Run in the Supabase SQL editor after 20260916000000_display_name.sql. Safe
-- to run more than once.

alter table public.profiles
  add column if not exists theme text;

alter table public.profiles
  drop constraint if exists profiles_theme_check;

alter table public.profiles
  add constraint profiles_theme_check
  check (theme is null or theme in ('navy', 'walnut', 'mahogany', 'oak'));

-- ---------------------------------------------------------------------------
-- update_theme(p_theme): the client's write path; null clears the choice
-- ---------------------------------------------------------------------------

create or replace function public.update_theme(p_theme text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_theme text;
  v_row   public.profiles;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  v_theme := nullif(btrim(lower(coalesce(p_theme, ''))), '');

  if v_theme is not null
     and v_theme not in ('navy', 'walnut', 'mahogany', 'oak') then
    raise exception 'unknown theme' using errcode = '22023';
  end if;

  update public.profiles
     set theme = v_theme
   where id = auth.uid()
  returning * into v_row;

  if v_row is null then
    raise exception 'no shelf for this user' using errcode = 'P0002';
  end if;

  return v_row;
end;
$$;

revoke all on function public.update_theme(text) from public;
grant execute on function public.update_theme(text) to authenticated;

-- PostgREST only sees schema changes once its cache reloads. Supabase
-- normally does this automatically on DDL; harmless when already current.
notify pgrst, 'reload schema';

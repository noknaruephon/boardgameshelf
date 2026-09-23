-- A profile row may exist before a BGG username is claimed. Spec:
-- docs/claude-code-spec-empty-shelf-settings.md (commit 2).
--
-- Display name, theme, Public and Show expansions are all columns on
-- profiles, and until now that row was only created by the claim step. So
-- Settings could not work before BGG was connected. Dropping the two not
-- nulls lets the row come first; "connected" now means slug is set, never
-- just "a profile exists".
--
-- Run in the Supabase SQL editor after 20260917000000_theme.sql. Safe to
-- run more than once.

alter table public.profiles alter column slug drop not null;
alter table public.profiles alter column bgg_username drop not null;

-- Both or neither: a shelf address and the username it comes from travel together.
alter table public.profiles drop constraint if exists profiles_slug_with_username;
alter table public.profiles add constraint profiles_slug_with_username
  check ((slug is null) = (bgg_username is null));

-- unique (slug) and profiles_slug_format both pass on null; they stay as they are.

-- ---------------------------------------------------------------------------
-- public_shelves(): slugless rows are not browsable shelves
-- ---------------------------------------------------------------------------
-- The join on user_games already excludes them (no slug means no sync means
-- no games); the added predicate makes it explicit. Body otherwise unchanged
-- from 20260909000000_public_shelves.sql.

create or replace function public_shelves()
returns table (
  slug           text,
  display_name   text,
  bgg_username   text,
  game_count     bigint,
  last_synced_at timestamptz,
  thumbnails     text[]
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.slug,
    p.display_name,
    p.bgg_username,
    count(*)::bigint as game_count,
    p.last_synced_at,
    coalesce((
      select array_agg(t.thumbnail_url order by t.name)
      from (
        select g2.thumbnail_url, g2.name
        from user_games ug2
        join games g2 on g2.bgg_id = ug2.bgg_id
        where ug2.user_id = p.id
          and ug2.owned
          and g2.subtype = 'boardgame'
          and g2.thumbnail_url is not null
        order by g2.name
        limit 4
      ) t
    ), '{}'::text[]) as thumbnails
  from profiles p
  join user_games ug on ug.user_id = p.id and ug.owned
  join games g on g.bgg_id = ug.bgg_id and g.subtype = 'boardgame'
  where p.is_public
    and p.slug is not null
  group by p.id, p.slug, p.display_name, p.bgg_username, p.last_synced_at
  having count(*) > 0
  order by count(*) desc, p.slug
  limit 24;
$$;
grant execute on function public_shelves() to anon, authenticated;

-- PostgREST only sees schema changes once its cache reloads. Supabase
-- normally does this automatically on DDL; harmless when already current.
notify pgrst, 'reload schema';

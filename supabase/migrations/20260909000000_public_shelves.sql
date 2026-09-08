-- public_shelves(): the shelves a signed-in user can browse as a guest while
-- their own sync is unavailable (BGG approval pending, 202 cap, 5xx, unknown
-- username). Spec: docs/claude-code-browse-shelves-fallback.md.
--
-- Run in the Supabase SQL editor after 20260908000000_multiuser.sql. Safe to
-- run more than once.
--
-- SECURITY DEFINER so the anon role can call it without needing to read
-- profiles or user_games directly; the body only ever selects public
-- profiles, and returns no ids and no emails — slug, names, a count, the
-- sync time and four thumbnail URLs.

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
  group by p.id, p.slug, p.display_name, p.bgg_username, p.last_synced_at
  having count(*) > 0
  order by count(*) desc, p.slug
  limit 24;
$$;

grant execute on function public_shelves() to anon, authenticated;

-- PostgREST only sees schema changes once its cache reloads. Supabase
-- normally does this automatically on DDL; harmless when already current.
notify pgrst, 'reload schema';

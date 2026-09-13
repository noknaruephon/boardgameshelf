-- "Show expansions" moves from the shelf's filter sheet to Settings, so it
-- becomes a per-shelf preference the owner sets once. Anyone viewing the
-- shelf (or a bag from it) sees it the way the owner chose.
--
-- Run in the Supabase SQL editor after 20260911000000_bags.sql.

alter table profiles
  add column if not exists show_expansions boolean not null default false;

-- profiles already grants select to anon/authenticated and update to the
-- owner (see 20260908000000_multiuser.sql); a new column inherits both.

notify pgrst, 'reload schema';

-- A game night started from a bag page remembers the bag, so "Back to the
-- shelf" and a cancelled vote return to /bag/{id} rather than the shelf.
--
-- Run in the Supabase SQL editor after 20260913000000_show_expansions.sql.

alter table sessions
  add column if not exists bag_id text references bags(id) on delete set null;

-- claim_game_night_owner gains an optional bag. The two-argument form is
-- replaced, not overloaded, so PostgREST has one function to resolve; a call
-- without p_bag_id still works through the default.
drop function if exists claim_game_night_owner(text, uuid);

create or replace function claim_game_night_owner(p_code text, p_owner_id uuid, p_bag_id text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from profiles where id = p_owner_id) then
    raise exception 'OWNER_NOT_FOUND';
  end if;
  -- A bag that is not this shelf's, or does not exist, is simply not recorded.
  if p_bag_id is not null and not exists (
    select 1 from bags b join profiles p on p.slug = b.owner
    where b.id = p_bag_id and p.id = p_owner_id
  ) then
    p_bag_id := null;
  end if;

  update sessions
  set owner_id = p_owner_id, bag_id = p_bag_id
  where code = p_code and owner_id is null;
end;
$$;

grant execute on function claim_game_night_owner(text, uuid, text) to anon, authenticated;

notify pgrst, 'reload schema';

-- Editable display name. Spec: docs/claude-code-spec-display-name.md.
--
-- profiles.display_name already exists (20260908000000_multiuser.sql): the
-- claim step writes the Google account name into it, falling back to the BGG
-- username. There is no separate Google-name column, so the "backfill" here
-- only fills rows that ended up null and stamps display_name_updated_at, the
-- cache-buster the OG image URL carries.
--
-- Writes to display_name go through update_display_name() only. The existing
-- "profiles: update own" policy lets the owner update any column, and every
-- other setting still relies on that, so rather than narrowing the grant a
-- trigger refuses a direct client change to the two columns. The RPC is
-- SECURITY DEFINER, so inside it current_user is the function owner, not
-- anon/authenticated, and the trigger lets it through.
--
-- Run in the Supabase SQL editor after 20260914000000_session_bag.sql. Safe
-- to run more than once.

alter table public.profiles
  add column if not exists display_name text,
  add column if not exists display_name_updated_at timestamptz;

-- Backfill: a null display_name takes the Google name from the auth user's
-- metadata, then the BGG username. Rows that already carry a name only get
-- the timestamp.
update public.profiles p
   set display_name = coalesce(
         nullif(btrim(u.raw_user_meta_data->>'full_name'), ''),
         nullif(btrim(u.raw_user_meta_data->>'name'), ''),
         p.bgg_username),
       display_name_updated_at = now()
  from auth.users u
 where u.id = p.id
   and p.display_name is null;

update public.profiles
   set display_name_updated_at = now()
 where display_name is not null
   and display_name_updated_at is null;

-- ---------------------------------------------------------------------------
-- Guard: the browser roles cannot change display_name directly
-- ---------------------------------------------------------------------------

create or replace function public.profiles_display_name_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    -- The claim step seeds display_name from the Google name; the stamp is
    -- the server's, whatever the client sent.
    if new.display_name is not null then
      new.display_name_updated_at := now();
    else
      new.display_name_updated_at := null;
    end if;
    return new;
  end if;

  if current_user in ('anon', 'authenticated')
     and (new.display_name is distinct from old.display_name
          or new.display_name_updated_at is distinct from old.display_name_updated_at) then
    raise exception 'display_name can only be changed through update_display_name()'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_display_name_guard on public.profiles;
create trigger profiles_display_name_guard
  before insert or update on public.profiles
  for each row execute function public.profiles_display_name_guard();

-- ---------------------------------------------------------------------------
-- update_display_name(p_name): the only write path
-- ---------------------------------------------------------------------------

create or replace function public.update_display_name(p_name text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_row  public.profiles;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  -- Trim (all whitespace, as String.prototype.trim does), refuse a line
  -- break inside the name rather than folding it into a space, then collapse
  -- runs of whitespace to one space. The client mirrors this order.
  v_name := regexp_replace(coalesce(p_name, ''), '^\s+|\s+$', '', 'g');

  if v_name ~ '[\r\n]' then
    raise exception 'display name has unsupported characters' using errcode = '22023';
  end if;

  v_name := regexp_replace(v_name, '\s+', ' ', 'g');

  if char_length(v_name) < 2 or char_length(v_name) > 32 then
    raise exception 'display name must be 2–32 characters' using errcode = '22023';
  end if;

  -- letters (any script), digits, space, . - ' ’
  if v_name !~ '^[[:alpha:][:digit:] .''’-]+$' then
    raise exception 'display name has unsupported characters' using errcode = '22023';
  end if;

  update public.profiles
     set display_name = v_name,
         display_name_updated_at = now()
   where id = auth.uid()
  returning * into v_row;

  if v_row is null then
    raise exception 'no shelf for this user' using errcode = 'P0002';
  end if;

  return v_row;
end;
$$;

revoke all on function public.update_display_name(text) from public;
grant execute on function public.update_display_name(text) to authenticated;

-- PostgREST only sees schema changes once its cache reloads. Supabase
-- normally does this automatically on DDL; harmless when already current.
notify pgrst, 'reload schema';

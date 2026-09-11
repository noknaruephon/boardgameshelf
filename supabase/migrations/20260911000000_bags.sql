-- Bags: a named subset of a shelf, packed for a trip, with its own page at
-- /bag/<id> that anyone with the link can open. Spec: docs/bag-stage2-spec.md
-- (§2 schema, §3 client, §9 the proposals hook this must not get in the way of).
--
-- Run in the Supabase SQL editor after 20260909000000_public_shelves.sql.
-- Safe to run more than once.
--
-- Ownership without auth: creating a bag hands back an edit token exactly
-- once; only its sha256 is stored. Later writes present the token and the
-- database compares hashes. The anon role never touches the table itself —
-- RLS is on with no policies and the grants are revoked — so every read and
-- write below goes through a SECURITY DEFINER function, the same shape as
-- the game-night functions in 20260908000000_multiuser.sql.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. ids
-- ---------------------------------------------------------------------------

-- Eight characters of [a-z0-9], drawn from pgcrypto's randomness. (The spec
-- sketched encode(..., 'base32'); Postgres has no base32 encoding, so the
-- alphabet is applied by hand.) Used as the column default and by bag_create.
create or replace function bag_new_id()
returns text
language sql
volatile
as $$
  select string_agg(
    substr('abcdefghijklmnopqrstuvwxyz0123456789', (get_byte(gen_random_bytes(1), 0) % 36) + 1, 1),
    ''
  )
  from generate_series(1, 8);
$$;

-- ---------------------------------------------------------------------------
-- 2. bags
-- ---------------------------------------------------------------------------

create table if not exists bags (
  id         text primary key default bag_new_id(),
  -- The shelf the bag was packed from: profiles.slug. Not a foreign key yet —
  -- bags predate sign-in, and the Stage 3 move to owner accounts re-keys this.
  owner      text not null default 'noknaruephon',
  name       text not null default 'Bag',
  -- The packed games, as games.json bggIds. Stage 4 attaches a second list
  -- (proposals) in its own table; nothing should assume this is the only one.
  game_ids   text[] not null default '{}',
  -- sha256 of the edit token, hex. Never selected by any function below.
  token_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bags_id_format check (id ~ '^[a-z0-9]{8}$')
);

create index if not exists bags_owner_updated_idx on bags (owner, updated_at desc);

-- RLS on, no policies, grants revoked: the anon and authenticated roles cannot
-- select, insert, update or delete a row directly, whatever a later GRANT
-- might add by mistake. The functions run as the table owner.
alter table bags enable row level security;
revoke all on bags from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. functions
-- ---------------------------------------------------------------------------

-- The shape every reader gets: everything but token_hash.
create or replace function bag_create(p_name text, p_game_ids text[], p_owner text default 'noknaruephon')
returns table (id text, edit_token text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id    text;
  v_token text;
begin
  -- 32 random bytes, hex: the only time the plain token exists outside the
  -- creating browser is on the way back to it in this result.
  v_token := encode(gen_random_bytes(32), 'hex');

  -- Ids are random, so a collision is unlikely but not impossible: try again
  -- rather than fail the pack.
  loop
    v_id := bag_new_id();
    exit when not exists (select 1 from bags b where b.id = v_id);
  end loop;

  insert into bags (id, owner, name, game_ids, token_hash)
  values (
    v_id,
    coalesce(nullif(trim(p_owner), ''), 'noknaruephon'),
    left(coalesce(nullif(trim(p_name), ''), 'Bag'), 120),
    coalesce(array_remove(p_game_ids, null), '{}'::text[]),
    encode(digest(v_token, 'sha256'), 'hex')
  );

  return query select v_id, v_token;
end;
$$;

grant execute on function bag_create(text, text[], text) to anon, authenticated;

create or replace function bag_get(p_id text)
returns table (id text, owner text, name text, game_ids text[], created_at timestamptz, updated_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select b.id, b.owner, b.name, b.game_ids, b.created_at, b.updated_at
  from bags b
  where b.id = p_id;
$$;

grant execute on function bag_get(text) to anon, authenticated;

create or replace function bag_list(p_owner text)
returns table (id text, owner text, name text, game_ids text[], created_at timestamptz, updated_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select b.id, b.owner, b.name, b.game_ids, b.created_at, b.updated_at
  from bags b
  where b.owner = p_owner
  order by b.updated_at desc;
$$;

grant execute on function bag_list(text) to anon, authenticated;

-- Writes: NOT_FOUND for an id nobody has, FORBIDDEN for a token that does not
-- hash to what was stored. The two are told apart so the page can say which.
create or replace function bag_update(p_id text, p_token text, p_name text, p_game_ids text[])
returns table (id text, owner text, name text, game_ids text[], created_at timestamptz, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
begin
  select b.token_hash into v_hash from bags b where b.id = p_id;
  if v_hash is null then
    raise exception 'NOT_FOUND';
  end if;
  if v_hash <> encode(digest(coalesce(p_token, ''), 'sha256'), 'hex') then
    raise exception 'FORBIDDEN';
  end if;

  update bags b
  set name       = left(coalesce(nullif(trim(p_name), ''), 'Bag'), 120),
      game_ids   = coalesce(array_remove(p_game_ids, null), '{}'::text[]),
      updated_at = now()
  where b.id = p_id;

  return query
    select b.id, b.owner, b.name, b.game_ids, b.created_at, b.updated_at
    from bags b
    where b.id = p_id;
end;
$$;

grant execute on function bag_update(text, text, text, text[]) to anon, authenticated;

create or replace function bag_delete(p_id text, p_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
begin
  select b.token_hash into v_hash from bags b where b.id = p_id;
  if v_hash is null then
    raise exception 'NOT_FOUND';
  end if;
  if v_hash <> encode(digest(coalesce(p_token, ''), 'sha256'), 'hex') then
    raise exception 'FORBIDDEN';
  end if;

  delete from bags b where b.id = p_id;
  return true;
end;
$$;

grant execute on function bag_delete(text, text) to anon, authenticated;

-- PostgREST only sees schema changes once its cache reloads. Supabase
-- normally does this automatically on DDL; harmless when already current.
notify pgrst, 'reload schema';

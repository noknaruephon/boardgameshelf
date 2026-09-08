-- Multi-user shelf: profiles, the shared games cache, per-user collections,
-- and owner_id on the game-night tables.
--
-- Run in the Supabase SQL editor (or `supabase db push`) before deploying
-- landing.html / settings.html / shelf.html. Same conventions as the Stage 3
-- and Stage 4 addenda: safe to run more than once, invariants live in
-- SECURITY DEFINER functions, and nothing here hands the service role key to
-- the browser. The sync functions in /api write `games` with the service
-- role; everything the browser does goes through RLS with the anon key or a
-- user JWT.
--
-- Spec: docs/claude-code-multiuser.md (§3 schema, §11 implementation notes).

-- ---------------------------------------------------------------------------
-- 1. profiles
-- ---------------------------------------------------------------------------

create table if not exists profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  -- BGG username lowercased, trimmed, spaces → hyphens. The URL: /u/<slug>.
  slug           text not null unique,
  -- BGG username in its original casing; what /api/sync/collection sends to BGG.
  bgg_username   text not null,
  display_name   text,
  is_public      boolean not null default true,
  last_synced_at timestamptz,
  created_at     timestamptz not null default now(),
  constraint profiles_slug_format check (slug ~ '^[a-z0-9][a-z0-9._-]{0,63}$')
);

-- ---------------------------------------------------------------------------
-- 2. games — the shared cache, one row per BGG thing
-- ---------------------------------------------------------------------------

create table if not exists games (
  bgg_id          text primary key,
  name            text not null,
  year_published  int,
  min_players     int,
  max_players     int,
  min_playtime    int,
  max_playtime    int,
  weight          numeric,
  bgg_rating      numeric,
  subtype         text not null default 'boardgame'
                  check (subtype in ('boardgame', 'boardgameexpansion')),
  mechanics       jsonb not null default '[]'::jsonb,
  categories      jsonb not null default '[]'::jsonb,
  description     text,
  thumbnail_url   text,   -- BGG CDN URL, hotlinked
  image_url       text,   -- BGG CDN URL, hotlinked
  -- Not in the spec's column list; see docs/claude-code-multiuser.md §11.2.
  -- Curated content carried over from games.json (blurb, why, tag, teach, …),
  -- keyed exactly as there. Written by scripts/migrate-games-json.mjs only;
  -- the sync never touches it.
  extras          jsonb,
  -- { "2": "best", "3": "recommended", "4": "not" } from BGG's
  -- suggested_numplayers poll, so the "Recommended counts only" filter works
  -- for every shelf.
  player_recommendations jsonb,
  -- Drives the 30-day staleness check in /api/sync/collection. A placeholder
  -- row inserted from the collection endpoint gets the epoch here so the
  -- thing sync picks it up on the very next batch.
  updated_at      timestamptz not null default now()
);

-- Idempotent column adds, for a `games` table created from an earlier draft.
alter table games add column if not exists extras jsonb;
alter table games add column if not exists player_recommendations jsonb;

-- ---------------------------------------------------------------------------
-- 3. user_games — what each profile owns
-- ---------------------------------------------------------------------------

create table if not exists user_games (
  user_id     uuid not null references profiles(id) on delete cascade,
  bgg_id      text not null references games(bgg_id) on delete cascade,
  owned       boolean not null default true,
  wishlist    boolean not null default false,
  user_rating numeric,
  num_plays   int not null default 0,
  comment     text,
  synced_at   timestamptz not null default now(),
  primary key (user_id, bgg_id)
);

create index if not exists user_games_bgg_id_idx on user_games (bgg_id);

-- ---------------------------------------------------------------------------
-- 4. owner_id on the game-night tables
-- ---------------------------------------------------------------------------

-- A game night is scoped to the shelf its deck came from. Nullable: sessions
-- that predate this migration have no owner and the pages fall back to
-- DEFAULT_SHELF_SLUG (js/config.js) for them.
alter table sessions add column if not exists owner_id uuid references profiles(id) on delete set null;
alter table votes    add column if not exists owner_id uuid references profiles(id) on delete set null;

create index if not exists sessions_owner_id_idx on sessions (owner_id);

-- ---------------------------------------------------------------------------
-- 5. RLS + grants
-- ---------------------------------------------------------------------------

-- RLS is only evaluated after the base GRANT allows the query at all (a lesson
-- Stage 3 and Stage 4 each learned once), so the grants are explicit here.

alter table profiles   enable row level security;
alter table games      enable row level security;
alter table user_games enable row level security;

grant select                         on profiles   to anon, authenticated;
grant insert, update                 on profiles   to authenticated;
grant select                         on games      to anon, authenticated;
grant select                         on user_games to anon, authenticated;
grant insert, update, delete         on user_games to authenticated;

-- profiles: a public profile is readable by anyone; a private one only by its
-- owner. Only the owner can create or change their row, and the row's id must
-- be their own auth id — that is what makes "first claim wins" hold: the
-- unique index on slug rejects the second claim regardless of who makes it.
drop policy if exists "profiles: public or own" on profiles;
create policy "profiles: public or own"
  on profiles for select
  using (is_public or auth.uid() = id);

drop policy if exists "profiles: insert own" on profiles;
create policy "profiles: insert own"
  on profiles for insert
  with check (auth.uid() = id);

drop policy if exists "profiles: update own" on profiles;
create policy "profiles: update own"
  on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- user_games: visible when the owning profile is public or is the caller's;
-- written only by the owner. The sync functions bypass RLS with the service
-- role, so in practice the browser never writes here — but the policy is the
-- contract, not the client.
drop policy if exists "user_games: public shelf or own" on user_games;
create policy "user_games: public shelf or own"
  on user_games for select
  using (
    auth.uid() = user_id
    or exists (select 1 from profiles p where p.id = user_games.user_id and p.is_public)
  );

drop policy if exists "user_games: write own" on user_games;
create policy "user_games: write own"
  on user_games for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- games: public read. No insert/update/delete policy at all, so with RLS on
-- the anon and authenticated roles cannot write even though a GRANT could be
-- added later by mistake. The service role bypasses RLS and is the only writer.
drop policy if exists "games: public read" on games;
create policy "games: public read"
  on games for select
  using (true);

-- sessions / participants / votes keep their current policies untouched.

-- ---------------------------------------------------------------------------
-- 6. Functions
-- ---------------------------------------------------------------------------

-- Sets the owner of a freshly created game night. create_game_night predates
-- this spec and its body is not in the repo, so it is deliberately not
-- redefined; js/session.js calls this immediately after it instead.
-- Only a session whose owner is still unset can be claimed, so an existing
-- game night cannot be re-pointed at another shelf. The host need not be
-- signed in: a guest browsing /u/<slug> hosts from that shelf, as today.
create or replace function claim_game_night_owner(p_code text, p_owner_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from profiles where id = p_owner_id) then
    raise exception 'OWNER_NOT_FOUND';
  end if;

  update sessions
  set owner_id = p_owner_id
  where code = p_code and owner_id is null;
end;
$$;

grant execute on function claim_game_night_owner(text, uuid) to anon, authenticated;

-- submit_vote: the Stage 4 body, plus one thing — the vote row carries the
-- session's owner_id. Nothing else about voting changes.
create or replace function submit_vote(p_code text, p_name text, p_game_id text, p_vote text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round int;
  v_owner uuid;
begin
  select round, owner_id into v_round, v_owner
  from sessions
  where code = p_code and status = 'voting';

  if v_round is null then
    raise exception 'NOT_VOTING';
  end if;

  insert into votes (session_code, participant_name, game_id, vote, round, owner_id)
  values (p_code, p_name, p_game_id, p_vote, v_round, v_owner)
  on conflict (session_code, participant_name, game_id, round) do nothing;
end;
$$;

-- Slug normalisation lives in one place so the client, the migration script
-- and any future server code agree on it. Mirrors slugify() in js/auth.js.
create or replace function slugify_bgg_username(p_username text)
returns text
language sql
immutable
as $$
  select regexp_replace(lower(trim(p_username)), '\s+', '-', 'g');
$$;

-- PostgREST only sees schema changes once its cache reloads. Supabase
-- normally does this automatically on DDL; harmless when already current.
notify pgrst, 'reload schema';

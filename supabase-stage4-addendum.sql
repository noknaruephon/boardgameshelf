-- Stage 4 addendum: results + rematch.
--
-- Run by hand in the Supabase SQL editor before deploying results.html.
-- Same conventions as the Stage 3 addendum: everything callable with the anon
-- key, invariants enforced inside SECURITY DEFINER functions, safe to run
-- more than once.
--
-- Why rounds instead of deleting votes: a rematch must not destroy round 1's
-- result. The tally reads the session's current round; earlier rounds stay on
-- disk untouched.

-- ---------------------------------------------------------------------------
-- 1. round columns
-- ---------------------------------------------------------------------------

alter table sessions add column if not exists round int not null default 1;
alter table votes    add column if not exists round int not null default 1;

-- ---------------------------------------------------------------------------
-- 2. round-aware primary key on votes
-- ---------------------------------------------------------------------------

-- The Stage 3 key was (session_code, participant_name, game_id). Without round
-- in the key, every round-2 insert collides with the round-1 row and
-- `on conflict do nothing` silently swallows it — the rematch would record no
-- votes at all. The constraint name is looked up rather than assumed, since
-- the table predates the specs and may not use the default name.
do $$
declare
  pk text;
begin
  if not exists (
    select 1
    from information_schema.table_constraints c
    join information_schema.key_column_usage k
      on k.constraint_name = c.constraint_name and k.table_schema = c.table_schema
    where c.table_schema = 'public' and c.table_name = 'votes'
      and c.constraint_type = 'PRIMARY KEY' and k.column_name = 'round'
  ) then
    select c.constraint_name into pk
    from information_schema.table_constraints c
    where c.table_schema = 'public' and c.table_name = 'votes'
      and c.constraint_type = 'PRIMARY KEY';
    if pk is not null then
      execute format('alter table votes drop constraint %I', pk);
    end if;
    alter table votes
      add primary key (session_code, participant_name, game_id, round);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. submit_vote learns about rounds
-- ---------------------------------------------------------------------------

-- Replaces the Stage 3 body. The round is read from the session inside the
-- function — the client never sends it, so a stale tab from round 1 cannot
-- write into round 2. First vote per (player, game, round) still wins.
create or replace function submit_vote(p_code text, p_name text, p_game_id text, p_vote text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round int;
begin
  select round into v_round
  from sessions
  where code = p_code and status = 'voting';

  if v_round is null then
    raise exception 'NOT_VOTING';
  end if;

  insert into votes (session_code, participant_name, game_id, vote, round)
  values (p_code, p_name, p_game_id, p_vote, v_round)
  on conflict (session_code, participant_name, game_id, round) do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. start_rematch
-- ---------------------------------------------------------------------------

-- Host only, tie only. One transaction: bump the round, narrow the deck to
-- the tied games, clear everyone's finished_at (or finish_voting would
-- believe the new round is already over), and flip the session back to
-- voting. Every device navigates on the realtime status change — the same
-- mechanism as Start Voting — so nothing here tells clients where to go.
create or replace function start_rematch(p_code text, p_name text, p_game_ids text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from sessions where code = p_code and host_name = p_name
  ) then
    raise exception 'NOT_HOST';
  end if;

  if not exists (
    select 1 from sessions where code = p_code and status = 'done'
  ) then
    raise exception 'NOT_TIED';
  end if;

  if p_game_ids is null or array_length(p_game_ids, 1) < 2 then
    -- A rematch of one game is not a vote; a rematch of none is a bug.
    raise exception 'NOT_TIED';
  end if;

  update sessions
  set round    = round + 1,
      game_ids = p_game_ids,
      status   = 'voting'
  where code = p_code;

  update participants
  set finished_at = null
  where session_code = p_code;
end;
$$;

-- Rematch REQUESTS deliberately have no table and no function: they ride on
-- presence meta (js/presence.js), exactly like `finished` does. A request is
-- a nudge that only matters until the host acts — it should not survive a
-- refresh, so the database is the wrong home for it.

-- ---------------------------------------------------------------------------
-- 5. participants must be readable by the results screen
-- ---------------------------------------------------------------------------

-- Appended while implementing this spec; none of the logic above is changed.
--
-- §5 requires the tally's denominator to be the full participant count, so
-- results.html reads `participants` directly with the anon key. Nothing in
-- Stage 1-3 ever did — every earlier surface got its player list from
-- presence — so this table's anon access has never actually been exercised.
-- Stage 3 lost a debugging round to exactly this on `votes`, so it is granted
-- here rather than discovered on a phone at a table.
--
-- Deliberately does NOT run `alter table participants enable row level
-- security`: if RLS is currently off, switching it on would newly restrict
-- access that works today. A permissive policy is inert while RLS is off and
-- additive when it is on, so this is safe either way.
grant select on participants to anon, authenticated;

drop policy if exists "participants are readable by anyone with the code" on participants;
create policy "participants are readable by anyone with the code"
  on participants for select
  using (true);

-- PostgREST only sees schema changes once its cache reloads. Supabase
-- normally does this automatically on DDL; harmless when already current.
notify pgrst, 'reload schema';

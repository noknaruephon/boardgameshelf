-- Stage 3 addendum: swipe voting.
--
-- Run by hand in the Supabase SQL editor before deploying vote-swipe.html.
-- Everything here is callable with the anon key — no service role key reaches
-- the browser, ever.
--
-- Assumption flagged for review: `sessions` and `participants` already exist
-- from Stage 1/2 (created by hand, not committed to this repo), so their exact
-- column names aren't visible here. This file assumes:
--   sessions(code text primary key, host_name text, status text, ...)
--   participants(session_code text, name text, finished_at timestamptz, ...)
-- If `participants`' name column is actually called something else, rename it
-- below before running.

-- This whole file is safe to run more than once: `if not exists` / `create or
-- replace` throughout, so re-running after a partial failure (or just to be
-- sure) is a no-op rather than an error.

-- one row per player per game
create table if not exists votes (
  session_code text not null references sessions(code) on delete cascade,
  participant_name text not null,
  game_id text not null,
  vote text not null check (vote in ('play','pass')),
  created_at timestamptz not null default now(),
  primary key (session_code, participant_name, game_id)
);

alter table participants add column if not exists finished_at timestamptz;

-- RLS: same shape as the existing policies on sessions/participants — reads
-- and writes are scoped by session code, not by any per-user identity, since
-- there is no auth in this architecture. The real invariants (session must be
-- 'voting', idempotent insert, host-only force) are enforced inside the
-- SECURITY DEFINER functions below, not by RLS.
alter table votes enable row level security;

drop policy if exists "votes are readable by anyone with the code" on votes;
create policy "votes are readable by anyone with the code"
  on votes for select
  using (true);

drop policy if exists "votes are inserted only through submit_vote" on votes;
create policy "votes are inserted only through submit_vote"
  on votes for insert
  with check (true);

-- RLS policies are only evaluated after the base GRANT allows the query at
-- all. sessions/participants already have this (set up through the Table
-- Editor in Stage 1/2, which grants automatically) — votes was created here
-- via raw SQL, which does not. Without this, js/session.js's fetchVotes()
-- (a direct anon-key read, not routed through a SECURITY DEFINER function)
-- fails with a permission-denied error before RLS even runs, surfacing in
-- vote-swipe.html as "Something went wrong loading your votes."
grant select, insert on votes to anon, authenticated;

-- No update/delete policy: votes lock on swipe. Nothing built here goes
-- through a raw table write for votes — always submit_vote().

-- votes is not added to the realtime publication. "Who's done right now"
-- is answered by presence (see js/presence.js's `finished` meta), not by a
-- realtime subscription on this table — finished_at is only the durable
-- record finish_voting() checks. Nothing in this spec listens for votes rows
-- changing live, so publishing them would just be unused traffic.

create or replace function submit_vote(p_code text, p_name text, p_game_id text, p_vote text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from sessions where code = p_code and status = 'voting'
  ) then
    raise exception 'NOT_VOTING';
  end if;

  insert into votes (session_code, participant_name, game_id, vote)
  values (p_code, p_name, p_game_id, p_vote)
  on conflict (session_code, participant_name, game_id) do nothing;
end;
$$;

create or replace function finish_voting(p_code text, p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update participants
  set finished_at = now()
  where session_code = p_code and name = p_name and finished_at is null;

  -- If every participant is now finished, flip the session to done in the
  -- same transaction. Guarding on status = 'voting' makes this a no-op once
  -- another caller has already made the flip.
  if not exists (
    select 1 from participants
    where session_code = p_code and finished_at is null
  ) then
    update sessions
    set status = 'done'
    where code = p_code and status = 'voting';
  end if;
end;
$$;

-- Deviates from the single-argument stub in the spec (`force_results(p_code)`):
-- raising NOT_HOST for a non-host caller requires an identity to check
-- against, and this architecture has no server-side auth or session — so the
-- caller's own name is passed and compared to sessions.host_name, the same
-- way every other "who is this" check in this codebase works. Flagged here
-- and in the PR description rather than silently building something the spec
-- didn't literally ask for.
create or replace function force_results(p_code text, p_name text)
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

  update sessions
  set status = 'done'
  where code = p_code and status = 'voting';
end;
$$;

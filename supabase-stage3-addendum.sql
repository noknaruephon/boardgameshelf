-- Stage 3 addendum: swipe voting.
--
-- Run by hand in the Supabase SQL editor before deploying vote-swipe.html.
-- Everything here is callable with the anon key — no service role key reaches
-- the browser, ever. Safe to run more than once.
--
-- Note on the existing schema: this project's database was set up up-front,
-- before this spec was written, so `votes` may ALREADY exist with a
-- `liked boolean` column where this stage expects `vote text`. The spec
-- assumed it would be creating the table fresh. Section 1 below reconciles
-- the two in place instead of dropping anything.
--
-- Confirmed shape of the tables this depends on:
--   sessions(code text pk, host_name text, status text, ...)
--   participants(session_code text, name text, finished_at timestamptz, ...)

-- ---------------------------------------------------------------------------
-- 1. votes
-- ---------------------------------------------------------------------------

-- Fresh installs only — a no-op where the table already exists.
create table if not exists votes (
  session_code text not null references sessions(code) on delete cascade,
  participant_name text not null,
  game_id text not null,
  vote text not null check (vote in ('play','pass')),
  created_at timestamptz not null default now(),
  primary key (session_code, participant_name, game_id)
);

-- Grants (docs/supabase-conventions.md). Anon only reads: js/session.js's
-- fetchVotes() and fetchSessionVotes() select this table directly with the
-- anon key. Inserts go through submit_vote(), which is SECURITY DEFINER and
-- needs no table grant for the caller. RLS (section 3) is the second layer.
grant select                         on public.votes to anon;
grant select, insert, update, delete on public.votes to authenticated;
grant select, insert, update, delete on public.votes to service_role;

-- Where the table pre-exists with `liked boolean`, migrate the column in
-- place rather than dropping and recreating the table: that preserves the
-- primary key and both foreign keys — including the composite FK to
-- participants(session_code, name), which is stricter than the create above
-- and worth keeping. Existing rows carry across, so this is safe whether the
-- table is empty or not.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'votes' and column_name = 'liked'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'votes' and column_name = 'vote'
  ) then
    alter table votes add column vote text;
    update votes set vote = case when liked then 'play' else 'pass' end;
    alter table votes alter column vote set not null;
    alter table votes add constraint votes_vote_check check (vote in ('play','pass'));
    alter table votes drop column liked;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. participants.finished_at
-- ---------------------------------------------------------------------------

-- The spec calls for a timestamp here. Note that participants may already
-- carry a `finished_voting boolean` from the original setup; finished_at
-- supersedes it (a timestamp answers "when", which the boolean cannot) and is
-- what finish_voting() below reads. Nothing writes finished_voting any more —
-- see the optional cleanup at the bottom of this file.
alter table participants add column if not exists finished_at timestamptz;

-- ---------------------------------------------------------------------------
-- 3. RLS + grants
-- ---------------------------------------------------------------------------

-- Reads and writes are scoped by session code, not by any per-user identity,
-- since there is no auth in this architecture. The real invariants (session
-- must be 'voting', idempotent insert, host-only force) are enforced inside
-- the SECURITY DEFINER functions below, not by RLS.
alter table votes enable row level security;

drop policy if exists "votes are readable by anyone with the code" on votes;
create policy "votes are readable by anyone with the code"
  on votes for select
  using (true);

drop policy if exists "votes are inserted only through submit_vote" on votes;
create policy "votes are inserted only through submit_vote"
  on votes for insert
  with check (true);

-- No update/delete policy: votes lock on swipe. Nothing here goes through a
-- raw table write for votes — always submit_vote().

-- RLS is only evaluated after the base GRANT allows the query at all. The
-- grants sit directly under the CREATE TABLE in section 1.

-- PostgREST only sees schema changes once its cache reloads. Supabase
-- normally does this automatically on DDL; harmless when already current.
notify pgrst, 'reload schema';

-- votes is deliberately NOT added to the realtime publication. "Who's done
-- right now" is answered by presence (js/presence.js's `finished` meta);
-- finished_at is only the durable record finish_voting() checks. Nothing
-- listens for votes rows changing live.

-- ---------------------------------------------------------------------------
-- 4. Functions
-- ---------------------------------------------------------------------------

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

  -- First vote wins: votes lock on swipe, so a double-fire from a flaky
  -- network writes nothing the second time and raises no error.
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
-- way every other "who is this" check in this codebase works.
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

-- ---------------------------------------------------------------------------
-- 5. Optional cleanup
-- ---------------------------------------------------------------------------

-- participants.finished_voting is superseded by finished_at and is no longer
-- written by anything. Left in place by default rather than dropped without
-- asking — uncomment to remove the redundancy.
-- alter table participants drop column if exists finished_voting;

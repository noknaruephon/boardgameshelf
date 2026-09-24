-- Explicit grants on the game-night tables. See docs/supabase-conventions.md.
--
-- sessions and participants were created by hand in the Supabase dashboard
-- before the first addendum was written, so no file in this repo holds their
-- CREATE TABLE and their privileges were never stated anywhere. This puts
-- them on the record with the same shape every other public table uses.
-- Grants only: no policy or function changes. Safe to run more than once,
-- and a no-op wherever the privilege already exists.
--
-- Anon only reads. js/session.js's fetchSession() and fetchParticipants()
-- select these tables directly, and js/presence.js's realtime subscription
-- to sessions UPDATE also needs select. Every write (create_game_night,
-- join_game_night, start_voting, finish_voting, force_results, start_rematch,
-- cancel_game_night, claim_game_night_owner) is a SECURITY DEFINER function
-- and needs no table grant for its caller.

grant select                         on public.sessions to anon;
grant select, insert, update, delete on public.sessions to authenticated;
grant select, insert, update, delete on public.sessions to service_role;

grant select                         on public.participants to anon;
grant select, insert, update, delete on public.participants to authenticated;
grant select, insert, update, delete on public.participants to service_role;

-- PostgREST only sees schema changes once its cache reloads. Supabase
-- normally does this automatically on DDL; harmless when already current.
notify pgrst, 'reload schema';

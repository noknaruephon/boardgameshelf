# Supabase conventions

Cross-cutting rules for anything under `supabase/migrations/` (and the root
`supabase-stage3-addendum.sql`, which predates that folder). Feature specs
still describe their own tables; this file is what every migration follows.

## New Supabase tables

From 30 Oct 2026, Supabase no longer auto-exposes new tables in `public` to
the Data API: the `anon`, `authenticated` and `service_role` roles get no
privileges on a new table until a migration grants them. Tables created
before that date keep the privileges they already have.

So **every `create table` in `public` ships with its grants and its RLS
policies in the same migration file**, with the grants directly under the
`create table` statement:

```sql
create table if not exists public.<table> ( ... );

grant select                         on public.<table> to anon;
grant select, insert, update, delete on public.<table> to authenticated;
grant select, insert, update, delete on public.<table> to service_role;

alter table public.<table> enable row level security;
-- create policy ... (one per verb the roles above are meant to use)
```

Then adjust `anon` to what the browser actually does with the anon key and
no user JWT. In this app that is almost always `select` only: game-night
and shelf pages read tables directly, but every anon write goes through a
`security definer` rpc (`submit_vote`, `bag_create`, ...), and a `security
definer` function needs no table grant for its caller. A table the browser
never touches directly (`bags`) gets no `anon` or `authenticated` grant at
all; say so in a comment next to the `revoke`.

`service_role` always gets all four verbs. It bypasses RLS, and it is what
`api/` and `scripts/` use.

## Grants and RLS are separate layers

Postgres checks them in order, and both must pass:

1. **GRANT** answers "may this role run this verb on this table at all?"
   Without it the query fails with `permission denied` before RLS is even
   looked at. This is the layer the Oct 2026 change removes the default for.
2. **RLS policies** answer "which rows?" With RLS enabled and no policy for
   a verb, the role sees or changes nothing, whatever the GRANT says.

Consequences worth remembering:

- A grant without a policy is inert: `authenticated` has `delete` on
  `profiles` but no delete policy, so it cannot delete anything. That is
  fine, and it is why the standard grant set above is safe to apply as is.
- A policy without a grant is also inert, and the error it produces
  (`permission denied for table`) looks like a bug in the policy. Stage 3
  and Stage 4 each lost time to this once.
- Revoking a grant is the belt to RLS's braces. `bags` does both.

## Also in every migration

- Safe to run more than once: `create table if not exists`,
  `drop policy if exists` before `create policy`, `create or replace
  function`. Re-running a `grant` is harmless.
- `grant execute on function ... to anon, authenticated` for each rpc the
  browser calls, and `revoke ... from public` where the spec limits callers.
- End with `notify pgrst, 'reload schema';`.
- Add the migration as a new numbered file; don't edit earlier migrations
  except to fix them for a fresh install.

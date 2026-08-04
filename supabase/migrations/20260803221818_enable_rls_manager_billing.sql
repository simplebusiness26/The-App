-- Switch row level security on for manager_packages and manager_subscriptions.
-- The last two tables the linter reported as rls_disabled_in_public, and the
-- end of the run that started with 20260803211732_rls_policies_and_grants.sql.
--
-- Depends on 20260803221806_manager_billing_narrow_grants.sql, which revoked
-- the anon and authenticated write grants. That migration is what stops writes;
-- this one is what stops reads.
--
-- DELIBERATELY NO POLICIES
-- Every other table in this run got policies first, because arming RLS on a
-- table with no policy makes it return nothing and would have taken screens
-- down. These two are the exception: nothing reads them. Neither name appears
-- in app/, components/, hooks/, services/, utils/ or supabase/functions/, and
-- no function body, view definition or policy expression in the database
-- references either one. Deny-all is therefore the correct end state, not an
-- oversight -- writing owner-scoped policies for a table with no readers would
-- be inventing an access model for a feature that does not exist.
--
-- The live manager permission model is manager_capabilities and
-- manager_capability_requests (20260801140000_unified_manager_dashboard.sql).
-- These two hold stale duplicated seed data from 2026-07-31 and are candidates
-- for removal; dropping them is a separate decision, not this migration's job.
-- When somebody does build billing, the first step is a policy here, and the
-- SELECT grant left in place by the companion migration makes that a one-liner.
--
-- WHAT CHANGES
-- anon and authenticated see zero rows in both tables. Combined with the
-- revoked write grants, both roles now have no access of any kind. service_role
-- and the table owner still bypass RLS, so any future server-side job is
-- unaffected.
--
-- Verified after applying, by impersonating roles in rolled-back transactions
-- (set local role + request.jwt.claims):
--
--   anon                  sees 0 of 5 packages, 0 of 4 subscriptions
--   authenticated         sees 0 of 5 packages, 0 of 4 subscriptions -- checked
--                         as the one manager who actually owns all 4
--                         subscription rows, who now cannot see his own
--   authenticated insert  refused, "permission denied for table
--                         manager_packages" (42501)
--
-- Row counts are unchanged at 5 and 4 after the verification pass.
--
-- Losing your own rows sounds wrong until you notice no screen ever showed
-- them: app/manager/dashboard.js reads manager_capabilities, not this table.
--
-- REPO DRIFT, WORTH KNOWING
-- Applied to the live project (ref yzpthslwsvesgndzdqai) on 2026-08-03 at
-- 22:18 UTC, before this file was committed, so the remote history already
-- carries this version and `supabase db push` skips it here. The existence
-- check is there because no migration in this repo creates either table -- see
-- the companion migration's note.
--
-- To revert: alter table public.manager_packages disable row level security;
--            alter table public.manager_subscriptions disable row level security;

do $$
begin
  if to_regclass('public.manager_packages') is not null then
    execute 'alter table public.manager_packages enable row level security';
  end if;

  if to_regclass('public.manager_subscriptions') is not null then
    execute 'alter table public.manager_subscriptions enable row level security';
  end if;
end $$;

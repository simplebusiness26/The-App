-- Narrow the grants on manager_packages and manager_subscriptions. Does NOT
-- switch RLS on -- that is the companion migration
-- (20260803221818_enable_rls_manager_billing.sql).
--
-- WHY
-- These are the last two tables Supabase's linter reported as
-- rls_disabled_in_public. Both are exposed to PostgREST with RLS off, and anon
-- held SELECT/INSERT/UPDATE/DELETE/TRUNCATE on each. The anon key ships inlined
-- in every client bundle, so until this lands any caller can read, rewrite or
-- truncate both tables straight through /rest/v1 without going near the app.
-- They are not empty: manager_packages holds 5 rows and manager_subscriptions
-- holds 4.
--
-- WHAT THESE TABLES ARE
-- Legacy. manager_packages lists five capability names (Business, Property,
-- Activity, Event, Analytics) seeded 2026-07-31; manager_subscriptions holds
-- four rows, all for one manager, and is two duplicated pairs written a minute
-- apart -- test data from a signup flow that ran twice. The live manager
-- permission model is manager_capabilities and manager_capability_requests
-- (20260801140000_unified_manager_dashboard.sql), which is what
-- app/manager/dashboard.js and app/manager/requests.js actually read.
--
-- Note that manager_subscriptions.package_id has no foreign key to
-- manager_packages -- only manager_id -> profiles(id) is enforced -- which is
-- further evidence these were never finished.
--
-- CALL SITES CHECKED
-- Neither table name appears anywhere in app/, components/, hooks/, services/,
-- utils/ or supabase/functions/. Confirmed in the database too: no function
-- body, view definition or policy expression references either table. Nothing
-- reads them, so nothing loses anything here.
--
-- WHAT THIS CHANGES
-- anon and authenticated lose INSERT, UPDATE, DELETE, TRUNCATE and REFERENCES
-- on both tables. Unlike the policies in 20260803211732, grants are not inert
-- -- this takes effect on its own, before RLS is armed.
--
-- SELECT is deliberately left in place. The companion migration arms RLS with
-- no policies, which denies every row to anon and authenticated regardless of
-- the grant, so the grant costs nothing; leaving it means a future policy is a
-- one-line change rather than a grant plus a policy.
--
-- Verified after applying, by impersonating roles in rolled-back transactions:
--
--   authenticated insert -> refused outright, "permission denied for table
--                           manager_packages" (42501)
--   anon/authenticated   -> retain SELECT and TRIGGER only; has_table_privilege
--                           reports false for insert, update, delete, truncate
--
-- REPO DRIFT, WORTH KNOWING
-- This was applied to the live project (ref yzpthslwsvesgndzdqai) on
-- 2026-08-03 at 22:18 UTC, before the file itself was committed. The remote
-- migration history already carries this version, so `supabase db push` skips
-- it here; the file exists so a fresh project reaches the same state.
--
-- The statements are wrapped in an existence check because no migration in
-- this repo creates either table -- they predate the migration history and
-- exist only on the live project. An unguarded `revoke` would abort a
-- from-scratch `supabase db push` on the missing relation, which is the
-- provisioning path README.md documents.
--
-- To revert: grant insert, update, delete on public.manager_packages,
-- public.manager_subscriptions to authenticated;

do $$
begin
  if to_regclass('public.manager_packages') is not null then
    execute 'revoke insert, update, delete, truncate, references on public.manager_packages from anon, authenticated';
  end if;

  if to_regclass('public.manager_subscriptions') is not null then
    execute 'revoke insert, update, delete, truncate, references on public.manager_subscriptions from anon, authenticated';
  end if;
end $$;

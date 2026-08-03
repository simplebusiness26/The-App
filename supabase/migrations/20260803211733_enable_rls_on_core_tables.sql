-- Switch row level security on for the five core tables.
--
-- Depends on 20260803210000_rls_policies_and_grants.sql, which defines the
-- policies these tables need. Do not run this one first: a table with RLS on
-- and no policy returns nothing to anyone, which would empty the app's screens.
--
-- THIS IS THE STEP USERS CAN SEE. Everything up to here was preparation and
-- changed no read behaviour. From here the database starts refusing reads and
-- writes that do not match a policy, and a policy that is too strict shows up
-- as data quietly missing from a screen rather than an error.
--
-- Apply one statement at a time and check the screens listed against each
-- table before moving to the next. To back a table out:
--
--   alter table public.<table> disable row level security;
--
-- The policies can stay in place while you do -- they simply stop being
-- evaluated, which is the state the database was in before any of this.

begin;

-- /auth/signup, /profile, /profile/edit, /explorers, /leaderboards,
-- /connections/:id, and the is_admin lookup behind the cog on /
alter table public.profiles enable row level security;

-- /map, /business/:id, /business/add, /business/edit/:id, /manager/dashboard
alter table public.businesses enable row level security;

-- /map, /property/:id, /property/add, /property/edit/:id, /manager/dashboard
alter table public.properties enable row level security;

-- claims is NOT here -- it was armed separately and is already live, see
-- 20260803212021_enable_rls_claims.sql.

-- /business/:id and /property/:id review lists, plus leaving a review end to
-- end via /business/review/:id -- that path writes explorer_reviews and
-- reaches this table through the SECURITY DEFINER sync trigger, which bypasses
-- RLS, so it should be unaffected. Worth confirming on a real submission.
alter table public.reviews enable row level security;

commit;

-- Verification -- expect rls_enabled = true and a non-zero policy count on all
-- five:
--
--   select c.relname, c.relrowsecurity as rls_enabled,
--          (select count(*) from pg_policies p
--            where p.schemaname = 'public' and p.tablename = c.relname) as policies
--     from pg_class c join pg_namespace n on n.oid = c.relnamespace
--    where n.nspname = 'public' and c.relkind = 'r'
--      and c.relname in ('profiles','businesses','properties','claims','reviews')
--    order by c.relname;

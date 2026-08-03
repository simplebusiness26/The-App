-- Enable row level security on the five core tables, and give them policies.
--
-- WHY
-- businesses, claims, profiles, properties and reviews all had
-- relrowsecurity = false while anon and authenticated held
-- SELECT/INSERT/UPDATE/DELETE/TRUNCATE on every one of them. Policies existed
-- on businesses, claims and reviews -- including an "Admins can update claims"
-- policy testing profiles.is_admin -- but Postgres never evaluates policies on
-- a table whose RLS is off, so all of it was decorative. Supabase's linter
-- reports this as rls_disabled_in_public and policy_exists_rls_disabled.
--
-- The anon key is public by design (it ships inlined in every bundle), so
-- until RLS is on, any caller can read and write these tables directly through
-- PostgREST without going near the app. profiles is the sharpest edge: RLS off,
-- zero policies, anon UPDATE, and is_admin is a column on it.
--
-- ORDER MATTERS
-- Every section below defines policies and tightens grants FIRST and enables
-- RLS LAST (section 7). Enabling RLS on a table with no policy makes it return
-- nothing, so arming before the policies exist would take the app down.
--
-- ROLLING OUT INCREMENTALLY
-- Sections 1-6 are safe to apply on their own: with RLS still off they change
-- no behaviour, they only prepare. Then run section 7 one ALTER at a time and
-- check the screens listed against each table. To back a table out, just
-- ALTER TABLE <t> DISABLE ROW LEVEL SECURITY -- the policies can stay.
--
-- NOT COVERED HERE
-- manager_packages and manager_subscriptions are also public with RLS off, and
-- three SECURITY DEFINER views plus an anon-executable create_notification are
-- flagged by the linter. Out of scope for this migration; see
-- docs/SCREEN-INVENTORY.md.

begin;

-- ---------------------------------------------------------------------------
-- 0. Admin helper
-- ---------------------------------------------------------------------------
-- Policies need to ask "is the caller an admin?" without re-entering profiles'
-- own RLS. A SECURITY DEFINER function owned by postgres reads profiles with
-- RLS bypassed, which keeps the admin test stable no matter how profiles'
-- policies evolve. EXECUTE is granted to authenticated only -- anon is never
-- an admin, and the linter (correctly) objects to anon-callable definers.

create or replace function public.guestbook_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

revoke all on function public.guestbook_is_admin() from public, anon;
grant execute on function public.guestbook_is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- 1. profiles
-- ---------------------------------------------------------------------------
-- Reads: every screen that reads profiles does so behind a login
-- (explorers, leaderboards, connections, profile, and the account_type /
-- is_admin lookups in index.js, menu.js, business/[id].js). anon therefore
-- needs no access, which also stops email and phone being world-readable.
--
-- Writes: auth/signup.js upserts {id, full_name, email, phone, account_type};
-- profile/edit.js updates {full_name, phone, bio, profile_photo, area,
-- show_area, leaderboard_opt_in}. Both touch only the caller's own row.
--
-- is_admin is deliberately absent from the UPDATE column grant below, so it
-- cannot be set through the API by anyone -- that is the privilege-escalation
-- path being closed. Note account_type IS still writable, because signup's
-- upsert sets it; a user can therefore still make themselves a "manager".
-- That gates /manager/dashboard only, and locking it down means moving the
-- signup write server-side. Flagged, not fixed here.

drop policy if exists "Profiles are readable by signed-in users" on public.profiles;
create policy "Profiles are readable by signed-in users"
  on public.profiles for select to authenticated
  using (true);

drop policy if exists "Users can create their own profile" on public.profiles;
create policy "Users can create their own profile"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Admins can read all profiles" on public.profiles;
create policy "Admins can read all profiles"
  on public.profiles for select to authenticated
  using (public.guestbook_is_admin());

-- Column-level grants: RLS decides which ROWS, these decide which COLUMNS.
revoke update on public.profiles from anon, authenticated;
grant update (
  full_name, email, phone, bio, profile_photo,
  account_type, area, show_area, leaderboard_opt_in
) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 2. businesses
-- ---------------------------------------------------------------------------
-- Public read is required: /map and /business/:id render signed out.
-- business/add.js inserts with owner_id = auth.uid(), so the existing INSERT
-- policy already fits. The one gap is admin claim approval --
-- admin/claims.js:245 sets businesses.owner_id on a row the admin does not
-- own -- so the UPDATE policy is widened to admins.

drop policy if exists "Allow public read businesses" on public.businesses;
create policy "Allow public read businesses"
  on public.businesses for select to public
  using (true);

drop policy if exists "Authenticated users can create businesses" on public.businesses;
create policy "Authenticated users can create businesses"
  on public.businesses for insert to authenticated
  with check (auth.uid() = owner_id);

drop policy if exists "Owners can update businesses" on public.businesses;
create policy "Owners can update businesses"
  on public.businesses for update to authenticated
  using (auth.uid() = owner_id or public.guestbook_is_admin())
  with check (auth.uid() = owner_id or public.guestbook_is_admin());

drop policy if exists "Owners can delete businesses" on public.businesses;
create policy "Owners can delete businesses"
  on public.businesses for delete to authenticated
  using (auth.uid() = owner_id or public.guestbook_is_admin());

-- ---------------------------------------------------------------------------
-- 3. properties
-- ---------------------------------------------------------------------------
-- properties had no policies at all. Mirrors businesses: property/add.js
-- inserts with owner_id = auth.uid(), and admin/claims.js:298 reassigns
-- owner_id on approval.

drop policy if exists "Allow public read properties" on public.properties;
create policy "Allow public read properties"
  on public.properties for select to public
  using (true);

drop policy if exists "Authenticated users can create properties" on public.properties;
create policy "Authenticated users can create properties"
  on public.properties for insert to authenticated
  with check (auth.uid() = owner_id);

drop policy if exists "Owners can update properties" on public.properties;
create policy "Owners can update properties"
  on public.properties for update to authenticated
  using (auth.uid() = owner_id or public.guestbook_is_admin())
  with check (auth.uid() = owner_id or public.guestbook_is_admin());

drop policy if exists "Owners can delete properties" on public.properties;
create policy "Owners can delete properties"
  on public.properties for delete to authenticated
  using (auth.uid() = owner_id or public.guestbook_is_admin());

-- ---------------------------------------------------------------------------
-- 4. claims
-- ---------------------------------------------------------------------------
-- The existing four policies are already the right shape; they are restated
-- via the helper so the admin test no longer depends on reading profiles under
-- its own RLS, and a DELETE policy is added.

drop policy if exists "Users can create claims" on public.claims;
create policy "Users can create claims"
  on public.claims for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can view their own claims" on public.claims;
create policy "Users can view their own claims"
  on public.claims for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Admins can view all claims" on public.claims;
create policy "Admins can view all claims"
  on public.claims for select to authenticated
  using (public.guestbook_is_admin());

drop policy if exists "Admins can update claims" on public.claims;
create policy "Admins can update claims"
  on public.claims for update to authenticated
  using (public.guestbook_is_admin())
  with check (public.guestbook_is_admin());

drop policy if exists "Admins can delete claims" on public.claims;
create policy "Admins can delete claims"
  on public.claims for delete to authenticated
  using (public.guestbook_is_admin());

-- ---------------------------------------------------------------------------
-- 5. reviews (legacy mirror)
-- ---------------------------------------------------------------------------
-- reviews is no longer written directly by the app: ExplorerReviewForm writes
-- explorer_reviews (RLS already on, 4 policies), and the trigger
-- b_explorer_reviews_sync_legacy mirrors rows across. That trigger runs
-- sync_explorer_review_to_legacy, which is SECURITY DEFINER owned by postgres
-- and therefore bypasses RLS -- so arming this table does NOT break review
-- creation. Verified before writing this migration.
--
-- reviews is still READ directly, by business/[id].js:53 and
-- property/[id].js:53, both filtering moderation_status = 'published' on
-- screens that render signed out. Public read is scoped to that same filter so
-- unpublished rows stop being fetchable, which the client filter never
-- actually prevented.
--
-- The "Allow public review insert" policy granting anon INSERT with
-- check(true) is dropped: nothing in the app inserts here any more.

drop policy if exists "Allow public review insert" on public.reviews;

drop policy if exists "Published reviews are publicly readable" on public.reviews;
create policy "Published reviews are publicly readable"
  on public.reviews for select to public
  using (moderation_status = 'published');

drop policy if exists "Authors and listing owners can read their reviews" on public.reviews;
create policy "Authors and listing owners can read their reviews"
  on public.reviews for select to authenticated
  using (
    auth.uid() = user_id
    or public.guestbook_is_admin()
    or exists (select 1 from public.businesses b
               where b.id = reviews.business_id and b.owner_id = auth.uid())
    or exists (select 1 from public.properties p
               where p.id = reviews.property_id and p.owner_id = auth.uid())
  );

drop policy if exists "Authors can create their own reviews" on public.reviews;
create policy "Authors can create their own reviews"
  on public.reviews for insert to authenticated
  with check (auth.uid() = user_id);

-- Backs /business/review-action and /property/review-action, which write
-- business_response, challenged and challenge_reason. Restricted to the owner
-- of the listing the review is about. Those two screens have no auth check of
-- their own, so this policy is the only thing standing behind them.
drop policy if exists "Listing owners can respond to reviews" on public.reviews;
create policy "Listing owners can respond to reviews"
  on public.reviews for update to authenticated
  using (
    public.guestbook_is_admin()
    or exists (select 1 from public.businesses b
               where b.id = reviews.business_id and b.owner_id = auth.uid())
    or exists (select 1 from public.properties p
               where p.id = reviews.property_id and p.owner_id = auth.uid())
  )
  with check (
    public.guestbook_is_admin()
    or exists (select 1 from public.businesses b
               where b.id = reviews.business_id and b.owner_id = auth.uid())
    or exists (select 1 from public.properties p
               where p.id = reviews.property_id and p.owner_id = auth.uid())
  );

drop policy if exists "Authors and admins can delete reviews" on public.reviews;
create policy "Authors and admins can delete reviews"
  on public.reviews for delete to authenticated
  using (auth.uid() = user_id or public.guestbook_is_admin());

-- ---------------------------------------------------------------------------
-- 6. Remove grants nothing uses
-- ---------------------------------------------------------------------------
-- TRUNCATE and REFERENCES are never needed by a PostgREST client, and no code
-- path deletes through anon. Dropping them shrinks the blast radius
-- independently of RLS.

revoke truncate, references on
  public.profiles, public.businesses, public.properties,
  public.claims, public.reviews
  from anon, authenticated;

revoke insert, update, delete on
  public.profiles, public.businesses, public.properties,
  public.claims, public.reviews
  from anon;

-- Re-grant the column-scoped profile UPDATE dropped by the blanket revoke above.
grant update (
  full_name, email, phone, bio, profile_photo,
  account_type, area, show_area, leaderboard_opt_in
) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Arm it
-- ---------------------------------------------------------------------------
-- Run these one at a time if rolling out incrementally. Screens to re-check
-- after each:
--
--   profiles    -> /auth/signup, /profile, /profile/edit, /explorers,
--                  /leaderboards, /connections/:id, and the admin gate on /
--   businesses  -> /map, /business/:id, /business/add, /business/edit/:id,
--                  /manager/dashboard
--   properties  -> /map, /property/:id, /property/add, /property/edit/:id,
--                  /manager/dashboard
--   claims      -> /admin/claims, /admin/dashboard
--   reviews     -> /business/:id, /property/:id (review lists), and leaving a
--                  review end to end via /business/review/:id

alter table public.profiles    enable row level security;
alter table public.businesses  enable row level security;
alter table public.properties  enable row level security;
alter table public.claims      enable row level security;
alter table public.reviews     enable row level security;

commit;

-- ---------------------------------------------------------------------------
-- Verification
-- ---------------------------------------------------------------------------
-- Expect rls_enabled = true and a non-zero policy count on all five:
--
--   select c.relname, c.relrowsecurity as rls_enabled,
--          (select count(*) from pg_policies p
--            where p.schemaname = 'public' and p.tablename = c.relname) as policies
--     from pg_class c join pg_namespace n on n.oid = c.relnamespace
--    where n.nspname = 'public' and c.relkind = 'r'
--      and c.relname in ('profiles','businesses','properties','claims','reviews')
--    order by c.relname;
--
-- Expect no UPDATE row for is_admin:
--
--   select grantee, privilege_type, column_name
--     from information_schema.column_privileges
--    where table_schema = 'public' and table_name = 'profiles'
--      and grantee in ('anon','authenticated')
--    order by grantee, column_name;
--
-- And the linter should stop reporting rls_disabled_in_public /
-- policy_exists_rls_disabled for these five tables.

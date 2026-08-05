-- Admin dashboard, stage 1: make administrator access one database-owned fact
-- and close the profile-insert privilege escalation found during the audit.
--
-- Before this migration, authenticated could not UPDATE profiles.is_admin,
-- but still held table-wide INSERT on profiles. The own-profile INSERT policy
-- only checked id = auth.uid(), so a new account using the Data API directly
-- could supply is_admin=true when creating its profile. The app's signup form
-- did not do this, but the public client key means the database must reject it.
--
-- The safe INSERT column list below exactly covers app/auth/signup.js. Admin
-- promotion remains a trusted database operation, never a client operation.

begin;

-- RLS and the client gate use this same helper. Pinning an empty search_path
-- prevents a SECURITY DEFINER function from resolving an attacker-controlled
-- object. Every referenced object is therefore schema-qualified.
create or replace function public.guestbook_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select p.is_admin
      from public.profiles p
      where p.id = (select auth.uid())
    ),
    false
  );
$$;

revoke all on function public.guestbook_is_admin() from public, anon;
grant execute on function public.guestbook_is_admin() to authenticated;

-- Defence one: the policy refuses an attempted administrator profile even if
-- a future migration accidentally broadens the column grant again.
drop policy if exists "Users can create their own profile" on public.profiles;
create policy "Users can create their own profile"
  on public.profiles for insert to authenticated
  with check (
    (select auth.uid()) = id
    and coalesce(is_admin,false) = false
  );

-- Defence two: authenticated can insert only the fields used by signup.
-- is_admin is deliberately absent. The column already defaults to false.
revoke insert on public.profiles from anon,authenticated;
grant insert (
  id,
  full_name,
  email,
  phone,
  bio,
  profile_photo,
  account_type,
  area,
  show_area,
  leaderboard_opt_in
) on public.profiles to authenticated;

-- Keep profile edits column-scoped as well. Existing administrators can still
-- edit their ordinary profile fields; nobody can promote themselves.
revoke update on public.profiles from anon,authenticated;
grant update (
  id,
  full_name,
  email,
  phone,
  bio,
  profile_photo,
  account_type,
  area,
  show_area,
  leaderboard_opt_in
) on public.profiles to authenticated;

commit;

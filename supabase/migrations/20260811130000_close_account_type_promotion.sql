-- Packet 5 -- an Explorer cannot promote themselves, and the server stops
-- encoding a second kind of person.
--
-- THE HOLE
--
-- 20260803214309_enable_rls_profiles.sql:39 wrote it down and left it open:
--
--   "STILL OPEN: account_type remains writable, because auth/signup.js sets it"
--
-- It is still open. account_type sits in the client's INSERT grant
-- (20260805132127_admin_security_foundation.sql:58) and its UPDATE grant
-- (:74), so any signed-in Explorer can set their own account_type to anything.
-- The comment directly above the second grant reads "nobody can promote
-- themselves" while granting the column that does it.
--
-- The value has had no meaning since 20260803120000_unify_account_model.sql:10
-- retired 'manager'. Everybody is an Explorer; a Manager is an Explorer with
-- tools unlocked, held in manager_capabilities. So the column does not need to
-- be writable by anyone -- signup can stop sending it and take the default.
--
-- WHY THE COLUMN STAYS
--
-- Dropping it outright would rewrite three security-definer helpers and a
-- review trigger in the same breath as closing a live hole, and public.profiles
-- is one of the untracked tables that predates migration tracking. Pinning the
-- value with a constraint gets the same guarantee -- the fork cannot come back
-- -- without a destructive change to a table whose full shape is not in this
-- repository. Removing the column is its own piece of work.
--
-- TO UNDO
--   alter table public.profiles
--     drop constraint if exists profiles_account_type_explorer_only,
--     alter column account_type drop default;
--   (re-add account_type to both grants at 20260805132127:51-62 and :67-78,
--   and restore the three helpers from their definitions listed below.)

begin;

-- ---------------------------------------------------------------------------
-- 1. Make the column self-maintaining, then pin it
-- ---------------------------------------------------------------------------
-- The default is what lets signup stop naming the column. The constraint is
-- what stops the fork returning: with 'manager' unrepresentable, no future
-- policy, trigger or screen can start branching on the value again, because
-- there is nothing to branch on.

update public.profiles
set account_type = 'explorer'
where account_type is distinct from 'explorer';

alter table public.profiles
  alter column account_type set default 'explorer';

alter table public.profiles
  drop constraint if exists profiles_account_type_explorer_only;

alter table public.profiles
  add constraint profiles_account_type_explorer_only
  check (account_type = 'explorer');

comment on column public.profiles.account_type is
  'Always ''explorer''. Retired as a distinction by 20260803120000; kept only so existing helpers keep resolving. Manager is a capability in manager_capabilities, never an account type. Not writable by any client.';

-- ---------------------------------------------------------------------------
-- 2. Take the column out of both client grants
-- ---------------------------------------------------------------------------
-- Same column lists as 20260805132127:51-62 and :67-78, minus account_type.
-- is_admin stays absent from both for the reason that migration gives.

revoke insert on public.profiles from anon, authenticated;
grant insert (
  id,
  full_name,
  email,
  phone,
  bio,
  profile_photo,
  area,
  show_area,
  leaderboard_opt_in
) on public.profiles to authenticated;

revoke update on public.profiles from anon, authenticated;
grant update (
  id,
  full_name,
  email,
  phone,
  bio,
  profile_photo,
  area,
  show_area,
  leaderboard_opt_in
) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Stop the server asking whether somebody is an Explorer
-- ---------------------------------------------------------------------------
-- These two helpers gate every social and live feature on
-- account_type='explorer'. With the constraint above they can only return "does
-- this profile exist", so that is what they now say. Rewriting them is not
-- cosmetic: left as they were, they are the server half of the fork the client
-- just shed, and the next person reading them would reasonably conclude there
-- is a second kind of account to handle.
--
-- Both keep their signature, their security-definer status and their existing
-- grants, so every caller is unaffected:
--
--   guestbook_private.is_explorer      -- 20260802155202:100, called by the
--                                         social triggers at :182 and :186
--   private.linkup_user_is_explorer    -- 20260802211800:5, called by
--                                         create_linkup, join and check-in

create or replace function guestbook_private.is_explorer(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path='public','pg_temp'
as $$
  select exists(select 1 from public.profiles p where p.id=p_user_id);
$$;

create or replace function private.linkup_user_is_explorer(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public,private
as $$
  select exists(select 1 from public.profiles p where p.id=p_user_id);
$$;

-- NOT CHANGED HERE, on purpose:
--
--   * public.linkup_user_is_explorer (20260802211500:107) -- superseded by the
--     private. copy above; the public one is no longer the definition the
--     policies call.
--   * validate_explorer_review() (20260802152100:139) reads account_type into
--     account_kind and raises 'Only Explorer accounts can publish reviews.'
--     The constraint makes that branch unreachable rather than wrong, and the
--     function is 90 lines of unrelated target validation. It is Packet 10's,
--     which is already rewriting how reviews are read.
--   * The 'manager' predicates at 20260801090000:174, 20260801140000:50 and
--     20260802021015:77 need no retirement: 20260803120000:14-46 already
--     dropped and recreated all three of those policies without them. They are
--     history in old files, not live SQL.

commit;

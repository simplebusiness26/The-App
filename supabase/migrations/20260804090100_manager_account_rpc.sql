-- Close the account_type grant, and give the upgrade a server-side door.
--
-- 20260803214309 recorded this as the one thing left open on profiles:
--
--   STILL OPEN: account_type remains writable, because auth/signup.js sets it
--   in its upsert. A user can still promote themselves to "manager" [...]
--   Closing that means moving the signup write server-side.
--
-- Signup no longer writes it at all -- the column default from the previous
-- migration supplies 'explorer' -- so the grant can go.
--
-- Worth being accurate about what that hole was actually worth, because the
-- earlier note oversells it. Self-promoting to 'manager' unlocked the manager
-- dashboard and the claim buttons, both client-side, over data that was
-- already reachable: businesses and properties have no capability check in
-- RLS at all, and 20260803211732 grants plain authenticated insert on both.
-- What it did NOT unlock was activity clubs or events, which additionally
-- require a capability status of 'trial' or 'active' in manager_capabilities,
-- and that table is admin-writable only. The capability system was always the
-- real control. This migration keeps it that way.
--
-- Which is why enabling a manager account is deliberately self-serve rather
-- than admin-approved: it grants nothing that was not already open. The
-- valuable capabilities stay behind admin approval exactly as before.

begin;

-- ---------------------------------------------------------------------------
-- Narrow the UPDATE grant
-- ---------------------------------------------------------------------------
-- Same ten-column list as 20260803211732:298-301, minus account_type. is_admin
-- was already absent and stays absent; is_manager is never granted, for the
-- same reason -- it is set through the function below or not at all.

revoke update on public.profiles from authenticated;

grant update (
  id, full_name, email, phone, bio, profile_photo,
  area, show_area, leaderboard_opt_in
) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- public.set_manager_account(boolean)
-- ---------------------------------------------------------------------------
-- Follows the house pattern for a privileged, self-scoped write:
-- security definer, pinned search_path, an explicit auth.uid() guard, and
-- EXECUTE granted to authenticated only -- the shape of
-- verify_explorer_review_qr (20260802152200:144) and guestbook_is_admin
-- (20260803211732:56).
--
-- Enabling also creates the manager_capabilities row, which fixes a real gap
-- rather than adding a new step. Nothing has ever created that row for a new
-- manager: the only insert is the one-shot backfill at 20260801140000:74-94,
-- which ran once against the managers who existed that day. Every manager who
-- signed up afterwards has no row, and the dashboard has been carrying them on
-- a client-side fallback (app/manager/dashboard.js:149-154) that quietly
-- assumes businesses and properties are active. Now the row exists and says so.
--
-- Disabling leaves capabilities, listings and claims intact. Turning the
-- account off is meant to hide a dashboard, not to dismantle a business, and
-- turning it back on should restore exactly what was there.

create or replace function public.set_manager_account(p_enabled boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Authentication required.';
  end if;

  update public.profiles
     set is_manager = p_enabled
   where id = v_user;

  if not found then
    raise exception 'No profile found for this account.';
  end if;

  if p_enabled then
    insert into public.manager_capabilities (
      user_id,
      businesses_status, properties_status,
      activity_clubs_status, events_status,
      updated_at
    )
    values (v_user, 'active', 'active', 'inactive', 'inactive', now())
    on conflict (user_id) do nothing;
  end if;

  return p_enabled;
end;
$$;

revoke all on function public.set_manager_account(boolean) from public, anon;
grant execute on function public.set_manager_account(boolean) to authenticated;

commit;

-- Verification
-- ---------------------------------------------------------------------------
-- Impersonate a real user inside a transaction that is rolled back:
--
--   begin;
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"<a real profile id>","role":"authenticated"}';
--
--   -- both of these must fail, the first on the column grant, the second too
--   update public.profiles set account_type = 'manager' where id = auth.uid();
--   update public.profiles set is_manager   = true      where id = auth.uid();
--
--   -- this must succeed, and must leave account_type alone
--   select public.set_manager_account(true);
--   select account_type, is_manager from public.profiles where id = auth.uid();
--   select count(*) from public.manager_capabilities where user_id = auth.uid();
--   rollback;
--
-- Expect: two permission-denied errors, then account_type = 'explorer',
-- is_manager = true, and exactly one capabilities row.

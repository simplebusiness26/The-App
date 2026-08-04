-- Point the three "is this caller a manager?" policies at the new flag.
--
-- These are the only RLS policies in the schema that test
-- account_type = 'manager'. Every other account_type test in the database asks
-- the opposite question -- is this caller an explorer? -- and those are
-- deliberately untouched, because after 20260804090000 every profile answers
-- 'explorer' and they all keep passing exactly as before.
--
-- Each policy is recreated in full rather than patched, so the file reads as
-- the current definition and not as a diff against three other migrations.
-- The capability half of the activity-club and event policies is unchanged:
-- creating a club or an event still requires an admin-granted capability of
-- 'trial' or 'active'. Only the role half moves to is_manager.

begin;

-- ---------------------------------------------------------------------------
-- manager_capability_requests -- originally 20260801140000:43-52
-- ---------------------------------------------------------------------------
-- This is the load-bearing one. It is what a self-serve upgrade has to satisfy
-- before a manager can ask for the activity-club or events add-on.

drop policy if exists "Managers can request capabilities"
  on public.manager_capability_requests;

create policy "Managers can request capabilities"
on public.manager_capability_requests for insert to authenticated
with check (
  user_id = auth.uid()
  and status = 'pending'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_manager
  )
);

-- ---------------------------------------------------------------------------
-- activity_clubs -- originally 20260801090000:167-183
-- ---------------------------------------------------------------------------

drop policy if exists "Activated managers can create activity clubs"
  on public.activity_clubs;

create policy "Activated managers can create activity clubs"
on public.activity_clubs for insert to authenticated
with check (
  manager_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_manager
  )
  and exists (
    select 1 from public.manager_capabilities mc
    where mc.user_id = auth.uid()
      and mc.activity_clubs_status in ('trial','active')
      and (mc.activity_clubs_ends_at is null or mc.activity_clubs_ends_at > now())
  )
);

-- ---------------------------------------------------------------------------
-- events -- originally 20260802021015:68-86
-- ---------------------------------------------------------------------------
-- Keeps the (select auth.uid()) form this policy was written with, which
-- Postgres caches per statement rather than re-evaluating per row.

drop policy if exists "Activated managers can create events"
  on public.events;

create policy "Activated managers can create events"
on public.events for insert to authenticated
with check (
  manager_id = (select auth.uid())
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.is_manager
  )
  and exists (
    select 1
    from public.manager_capabilities mc
    where mc.user_id = (select auth.uid())
      and mc.events_status in ('trial','active')
      and (mc.events_ends_at is null or mc.events_ends_at > now())
  )
);

commit;

-- Verification
-- ---------------------------------------------------------------------------
-- Inside a rolled-back transaction, as a user who was a manager before this
-- rollout (so is_manager = true, account_type = 'explorer'):
--
--   insert into public.manager_capability_requests(user_id,capability,status)
--   values (auth.uid(),'events','pending');            -- expect: allowed
--
-- And as an ordinary explorer (is_manager = false):
--
--   the same insert                                     -- expect: refused
--
-- Then confirm nothing explorer-side regressed for the upgraded user, which is
-- the whole reason for this design:
--
--   insert into public.explorer_reviews(user_id,target_type,target_id,rating)
--   values (auth.uid(),'business','<a real business id>',5);  -- expect: allowed
--
-- Before this rollout that insert would have raised
-- 'Only Explorer accounts can publish reviews.' for a manager.

-- Packet 0 -- stop ordinary Explorers creating businesses and properties.
--
-- THE HOLE
--
-- 20260803211732_rls_policies_and_grants.sql:135-136 and :163-164 let anybody
-- signed in create a business or a property:
--
--   with check (auth.uid() = owner_id)
--
-- That reads as "you may create a business as long as you say it is yours",
-- which every signed-in account can say. Clubs and events have never been open
-- like this -- 20260803120000_unify_account_model.sql:22-46 requires a real
-- capability -- these two just never got the same treatment. Hiding the "Add a
-- business" button in the app changes nothing while this policy stands, which
-- is why this migration comes before any interface work.
--
-- THE SECOND HOLE, FOUND WHILE FIXING THE FIRST
--
-- businesses_status and properties_status were added with `default 'active'`
-- (20260801140000_unified_manager_dashboard.sql:11-14). Meanwhile
-- admin_decide_capability_request creates the row with no statuses at all:
--
--   insert into public.manager_capabilities(user_id)
--   values (v_request.user_id) on conflict (user_id) do nothing;
--
-- (20260810001000_admin_capability_decisions.sql:141-143.) So approving
-- somebody for activity_clubs silently hands them businesses and properties
-- as well, because the row they get is born with both set to 'active'. The
-- capability column therefore cannot be used as-is as the gate: for a large
-- share of rows it already says yes to a question nobody asked.
--
-- Both defaults flip to 'inactive' below, and existing rows are corrected --
-- but only where the access was never used. See the update statement.
--
-- TO UNDO
--   alter table public.manager_capabilities
--     alter column businesses_status set default 'active',
--     alter column properties_status set default 'active';
--   (restore the two `with check (auth.uid() = owner_id)` policies from
--   20260803211732:134-136 and :162-164; the ends_at columns can stay.)

-- ---------------------------------------------------------------------------
-- 1. Expiry columns, so businesses and properties behave like clubs and events
-- ---------------------------------------------------------------------------
-- activity_clubs_ends_at and events_ends_at already exist and are already
-- checked by the policies at 20260803120000:22-46. These two had no equivalent,
-- so a business capability could never be time-limited. Null means "does not
-- expire", which is what every existing row means today.

alter table public.manager_capabilities
  add column if not exists businesses_started_at timestamptz,
  add column if not exists businesses_ends_at timestamptz,
  add column if not exists properties_started_at timestamptz,
  add column if not exists properties_ends_at timestamptz;

-- ---------------------------------------------------------------------------
-- 2. Stop the defaults handing out access nobody granted
-- ---------------------------------------------------------------------------

alter table public.manager_capabilities
  alter column businesses_status set default 'inactive',
  alter column properties_status set default 'inactive';

-- ---------------------------------------------------------------------------
-- 3. Correct the rows the old default already got wrong
-- ---------------------------------------------------------------------------
-- Nobody loses access they are actually using. A row keeps 'active' if any of
-- these is true:
--
--   * the Explorer already owns at least one business (or property) -- taking
--     the capability away would strand a listing they manage;
--   * an administrator explicitly approved that capability, recorded in
--     manager_capability_requests;
--   * they were one of the accounts migrated by the seed at
--     20260801140000:74-90, which only selected profiles that were managers
--     under the old account model -- that is the same test as owning a listing
--     for every row that seed touched, so it needs no separate clause.
--
-- Everything else -- rows born 'active' because admin_decide_capability_request
-- inserted a bare row while approving some other capability -- goes to
-- 'inactive'. That is the hole, and this is the only statement that closes it
-- for data that already exists.

update public.manager_capabilities mc
set
  businesses_status = case
    when exists (select 1 from public.businesses b where b.owner_id = mc.user_id)
      or exists (
        select 1 from public.manager_capability_requests r
        where r.user_id = mc.user_id
          and r.capability = 'businesses'
          and r.status = 'approved'
      )
    then mc.businesses_status
    else 'inactive'
  end,
  properties_status = case
    when exists (select 1 from public.properties p where p.owner_id = mc.user_id)
      or exists (
        select 1 from public.manager_capability_requests r
        where r.user_id = mc.user_id
          and r.capability = 'properties'
          and r.status = 'approved'
      )
    then mc.properties_status
    else 'inactive'
  end,
  updated_at = now()
where mc.businesses_status = 'active' or mc.properties_status = 'active';

-- ---------------------------------------------------------------------------
-- 4. Why admin_decide_capability_request needs no edit
-- ---------------------------------------------------------------------------
-- Its bare insert (20260810001000:141-143) names only user_id, so the other
-- four statuses come from the column defaults. Flipping those defaults in
-- section 2 is what closes the escalation path -- the row it creates from now
-- on is born inactive everywhere, and the UPDATE immediately after it only
-- touches the one capability actually being approved. Rewriting the function
-- would mean reproducing 80 lines to change nothing.

-- ---------------------------------------------------------------------------
-- 5. The gate itself
-- ---------------------------------------------------------------------------
-- One predicate, so businesses and properties cannot drift apart from each
-- other the way they drifted from clubs and events. 'trial' counts as unlocked,
-- matching 20260803120000:29 and :43.

create or replace function public.has_manager_capability(p_capability text)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.manager_capabilities mc
    where mc.user_id = (select auth.uid())
      and case p_capability
        when 'businesses' then
          mc.businesses_status in ('trial','active')
            and (mc.businesses_ends_at is null or mc.businesses_ends_at > now())
        when 'properties' then
          mc.properties_status in ('trial','active')
            and (mc.properties_ends_at is null or mc.properties_ends_at > now())
        when 'activity_clubs' then
          mc.activity_clubs_status in ('trial','active')
            and (mc.activity_clubs_ends_at is null or mc.activity_clubs_ends_at > now())
        when 'events' then
          mc.events_status in ('trial','active')
            and (mc.events_ends_at is null or mc.events_ends_at > now())
        else false
      end
  );
$$;

comment on function public.has_manager_capability(text) is
  'Is the calling Explorer unlocked for this capability right now. The single answer to "may I create one of these"; RLS insert policies call it and nothing else should re-implement it.';

grant execute on function public.has_manager_capability(text) to authenticated;

drop policy if exists "Authenticated users can create businesses" on public.businesses;
drop policy if exists "Unlocked managers can create businesses" on public.businesses;
create policy "Unlocked managers can create businesses"
  on public.businesses for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and public.has_manager_capability('businesses')
  );

drop policy if exists "Authenticated users can create properties" on public.properties;
drop policy if exists "Unlocked managers can create properties" on public.properties;
create policy "Unlocked managers can create properties"
  on public.properties for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and public.has_manager_capability('properties')
  );

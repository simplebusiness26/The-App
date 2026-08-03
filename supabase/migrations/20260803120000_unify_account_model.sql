-- Unify the account model per the product vision: everyone is an Explorer.
-- Management of businesses/properties/clubs/events is an unlocked capability
-- (manager_capabilities + manager_capability_requests), granted on top of an
-- Explorer profile via the claim/request flow -- not a separate account type
-- chosen at signup. Existing "manager" accounts keep their manager_capabilities
-- row untouched and simply fold into the single Explorer identity, which also
-- means they gain the explorer-only features (follows, feed, moments,
-- link-ups, check-ins) they were previously locked out of.

update public.profiles set account_type = 'explorer' where account_type = 'manager';

-- Capability requests are open to any Explorer now; the old "manager"
-- account type this checked for no longer exists.
drop policy if exists "Managers can request capabilities" on public.manager_capability_requests;
create policy "Explorers can request capabilities"
on public.manager_capability_requests for insert to authenticated
with check (user_id = auth.uid() and status = 'pending');

-- Activity club / event creation still requires an active capability grant --
-- it just no longer additionally requires the retired "manager" account type.
drop policy if exists "Activated managers can create activity clubs" on public.activity_clubs;
create policy "Activated managers can create activity clubs"
on public.activity_clubs for insert to authenticated
with check (
  manager_id = auth.uid()
  and exists (
    select 1 from public.manager_capabilities mc
    where mc.user_id = auth.uid()
      and mc.activity_clubs_status in ('trial','active')
      and (mc.activity_clubs_ends_at is null or mc.activity_clubs_ends_at > now())
  )
);

drop policy if exists "Activated managers can create events" on public.events;
create policy "Activated managers can create events"
on public.events for insert to authenticated
with check (
  manager_id = (select auth.uid())
  and exists (
    select 1 from public.manager_capabilities mc
    where mc.user_id = (select auth.uid())
      and mc.events_status in ('trial','active')
      and (mc.events_ends_at is null or mc.events_ends_at > now())
  )
);

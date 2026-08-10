-- Admin Dashboard, Stage 4b: audited decisions for Manager capability access.
--
-- Explorers can still submit and resubmit their own pending request. Only the
-- trusted RPC below can approve or reject one, update the capability grant and
-- append the audit record; all of that happens in one transaction.

begin;

alter table public.manager_capability_requests
  add column if not exists decided_by uuid;

alter table public.manager_capability_requests
  drop constraint if exists manager_capability_requests_admin_note_length,
  add constraint manager_capability_requests_admin_note_length
    check (char_length(admin_note)<=500);

create index if not exists manager_capability_requests_pending_idx
  on public.manager_capability_requests(requested_at,id)
  where status='pending';

-- The old admin ALL policies allowed an administrator to bypass the audit
-- function with a direct table update. Admin reads remain available, while
-- trusted function ownership is now the only write path for decisions.
drop policy if exists "Managers can view their capability requests"
  on public.manager_capability_requests;
drop policy if exists "Admins can manage capability requests"
  on public.manager_capability_requests;
create policy manager_capability_requests_read_authenticated
  on public.manager_capability_requests for select to authenticated
  using (
    (select auth.uid())=user_id
    or (select public.guestbook_is_admin())
  );

drop policy if exists "Managers can view their capabilities"
  on public.manager_capabilities;
drop policy if exists "Admins can manage manager capabilities"
  on public.manager_capabilities;
create policy manager_capabilities_read_authenticated
  on public.manager_capabilities for select to authenticated
  using (
    (select auth.uid())=user_id
    or (select public.guestbook_is_admin())
  );

revoke insert,update,delete on public.manager_capabilities from anon,authenticated;

-- Keep the existing Explorer request flow, but do not expose admin_note or
-- decided_by as writable Data API columns. A resubmission can update only the
-- pending request fields it owns.
revoke insert,update,delete on public.manager_capability_requests from anon,authenticated;
grant insert (
  user_id,
  capability,
  status,
  request_note,
  requested_at,
  updated_at
) on public.manager_capability_requests to authenticated;
grant update (
  status,
  request_note,
  requested_at,
  updated_at
) on public.manager_capability_requests to authenticated;

-- When an Explorer resubmits a rejected or cancelled request, clear the old
-- decision metadata server-side. They cannot write those columns directly.
create or replace function public.reset_resubmitted_capability_request()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  if new.status='pending' and old.status<>'pending' then
    new.admin_note := '';
    new.decided_at := null;
    new.decided_by := null;
  end if;

  return new;
end;
$$;

revoke all on function public.reset_resubmitted_capability_request()
  from public,anon,authenticated;

drop trigger if exists reset_resubmitted_capability_request
  on public.manager_capability_requests;
create trigger reset_resubmitted_capability_request
before update on public.manager_capability_requests
for each row execute function public.reset_resubmitted_capability_request();

create or replace function public.admin_decide_capability_request(
  p_request_id uuid,
  p_decision text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := auth.uid();
  v_request public.manager_capability_requests%rowtype;
  v_decision text := lower(btrim(coalesce(p_decision,'')));
  v_reason text := btrim(coalesce(p_reason,''));
begin
  if v_actor is null then
    raise exception 'Authentication is required.';
  end if;

  if not public.guestbook_is_admin() then
    raise exception 'Administrator access is required.';
  end if;

  if v_decision not in ('approved','rejected') then
    raise exception 'Decision must be approved or rejected.';
  end if;

  if char_length(v_reason) not between 3 and 500 then
    raise exception 'A decision reason between 3 and 500 characters is required.';
  end if;

  select r.*
  into v_request
  from public.manager_capability_requests r
  where r.id=p_request_id
  for update;

  if not found then
    raise exception 'Capability request not found.';
  end if;

  if v_request.status<>'pending' then
    raise exception 'This capability request has already been decided.';
  end if;

  if v_decision='approved' then
    insert into public.manager_capabilities(user_id)
    values (v_request.user_id)
    on conflict (user_id) do nothing;

    update public.manager_capabilities
    set
      businesses_status=case
        when v_request.capability='businesses' then 'active'
        else businesses_status
      end,
      properties_status=case
        when v_request.capability='properties' then 'active'
        else properties_status
      end,
      activity_clubs_status=case
        when v_request.capability='activity_clubs' then 'active'
        else activity_clubs_status
      end,
      activity_clubs_started_at=case
        when v_request.capability='activity_clubs'
          then coalesce(activity_clubs_started_at,now())
        else activity_clubs_started_at
      end,
      activity_clubs_ends_at=case
        when v_request.capability='activity_clubs' then null
        else activity_clubs_ends_at
      end,
      events_status=case
        when v_request.capability='events' then 'active'
        else events_status
      end,
      events_started_at=case
        when v_request.capability='events'
          then coalesce(events_started_at,now())
        else events_started_at
      end,
      events_ends_at=case
        when v_request.capability='events' then null
        else events_ends_at
      end,
      updated_at=now()
    where user_id=v_request.user_id;
  end if;

  update public.manager_capability_requests
  set
    status=v_decision,
    admin_note=v_reason,
    decided_at=now(),
    decided_by=v_actor,
    updated_at=now()
  where id=v_request.id;

  insert into public.admin_audit_log (
    actor_id,
    action,
    target_type,
    target_id,
    reason,
    details
  ) values (
    v_actor,
    'capability_request.' || v_decision,
    'manager_capability_request',
    v_request.id,
    v_reason,
    jsonb_build_object(
      'explorer_id',v_request.user_id,
      'capability',v_request.capability,
      'decision',v_decision
    )
  );

  return jsonb_build_object(
    'request_id',v_request.id,
    'explorer_id',v_request.user_id,
    'capability',v_request.capability,
    'decision',v_decision
  );
end;
$$;

revoke all on function public.admin_decide_capability_request(uuid,text,text)
  from public,anon,authenticated;
grant execute on function public.admin_decide_capability_request(uuid,text,text)
  to authenticated;

commit;

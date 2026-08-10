-- Admin Dashboard, Stage 5: audited state management for clubs and events.
-- Administrators can hide or restore activity without deleting its history.

begin;

create or replace function public.admin_set_activity_state(
  p_target_type text,
  p_target_id uuid,
  p_state text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := auth.uid();
  v_target_type text := lower(btrim(coalesce(p_target_type,'')));
  v_state text := lower(btrim(coalesce(p_state,'')));
  v_reason text := btrim(coalesce(p_reason,''));
  v_previous_state text;
  v_name text;
begin
  if v_actor is null then
    raise exception 'Authentication is required.';
  end if;

  if not public.guestbook_is_admin() then
    raise exception 'Administrator access is required.';
  end if;

  if char_length(v_reason) not between 3 and 500 then
    raise exception 'A decision reason between 3 and 500 characters is required.';
  end if;

  if v_target_type='activity_club' then
    if v_state not in ('draft','open','full','closed') then
      raise exception 'Unsupported activity-club state.';
    end if;

    select c.status,c.name
    into v_previous_state,v_name
    from public.activity_clubs c
    where c.id=p_target_id
    for update;

    if not found then
      raise exception 'Activity club not found.';
    end if;

    if v_previous_state=v_state then
      raise exception 'The activity club is already in that state.';
    end if;

    update public.activity_clubs
    set status=v_state
    where id=p_target_id;
  elsif v_target_type='event' then
    if v_state not in ('draft','published','cancelled') then
      raise exception 'Unsupported event state.';
    end if;

    select e.status,e.name
    into v_previous_state,v_name
    from public.events e
    where e.id=p_target_id
    for update;

    if not found then
      raise exception 'Event not found.';
    end if;

    if v_previous_state=v_state then
      raise exception 'The event is already in that state.';
    end if;

    update public.events
    set status=v_state
    where id=p_target_id;
  else
    raise exception 'Target type must be activity_club or event.';
  end if;

  insert into public.admin_audit_log (
    actor_id,
    action,
    target_type,
    target_id,
    reason,
    details
  ) values (
    v_actor,
    'activity.state_changed',
    v_target_type,
    p_target_id,
    v_reason,
    jsonb_build_object(
      'name',v_name,
      'previous_state',v_previous_state,
      'new_state',v_state
    )
  );

  return jsonb_build_object(
    'target_type',v_target_type,
    'target_id',p_target_id,
    'previous_state',v_previous_state,
    'state',v_state
  );
end;
$$;

revoke all on function public.admin_set_activity_state(text,uuid,text,text)
  from public,anon,authenticated;
grant execute on function public.admin_set_activity_state(text,uuid,text,text)
  to authenticated;

commit;

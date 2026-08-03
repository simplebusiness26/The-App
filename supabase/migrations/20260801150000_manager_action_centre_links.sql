create or replace function public.notify_activity_membership_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  club_name text;
  club_manager_id uuid;
  applicant_display_name text;
  event_stamp text;
  status_title text;
  status_message text;
  should_notify_manager boolean := false;
begin
  select name, manager_id
    into club_name, club_manager_id
    from public.activity_clubs
   where id = new.club_id;

  applicant_display_name := coalesce(nullif(new.applicant_name, ''), 'An explorer');

  if new.status = 'pending' then
    if tg_op = 'INSERT' then
      should_notify_manager := true;
    elsif tg_op = 'UPDATE' then
      should_notify_manager := old.status is distinct from 'pending';
    end if;
  end if;

  if should_notify_manager then
    event_stamp := coalesce(new.applied_at::text, clock_timestamp()::text);

    perform public.create_notification(
      club_manager_id,
      new.user_id,
      'activity_join_request',
      'New membership request',
      applicant_display_name || ' requested to join ' || club_name || '.',
      'activity_club',
      new.club_id,
      '/manager/requests?club=' || new.club_id::text ||
        '&membership=' || new.id::text ||
        '&view=requests',
      jsonb_build_object(
        'membership_id', new.id,
        'club_id', new.club_id,
        'status', new.status
      ),
      'activity_join_request:' || new.id::text || ':' || event_stamp
    );
  end if;

  if tg_op = 'UPDATE' then
    if new.status is distinct from old.status
       and new.status in ('approved', 'rejected', 'removed') then

      if new.status = 'approved' then
        status_title := 'Membership approved';
        status_message := 'Your request to join ' || club_name || ' was approved. The private message board is now unlocked.';
      elsif new.status = 'rejected' then
        status_title := 'Membership request not approved';
        status_message := 'Your request to join ' || club_name || ' was not approved. You can still view the public club profile.';
      else
        status_title := 'Club membership ended';
        status_message := 'You were removed from ' || club_name || ' and no longer have access to its private message board.';
      end if;

      event_stamp := coalesce(new.decided_at::text, clock_timestamp()::text);

      perform public.create_notification(
        new.user_id,
        club_manager_id,
        'activity_membership_' || new.status,
        status_title,
        status_message,
        'activity_club',
        new.club_id,
        '/activity-clubs/' || new.club_id::text,
        jsonb_build_object(
          'membership_id', new.id,
          'club_id', new.club_id,
          'status', new.status
        ),
        'activity_membership_status:' || new.id::text || ':' || new.status || ':' || event_stamp
      );
    end if;
  end if;

  return new;
end;
$$;

update public.notifications
set deep_link = '/manager/requests?club=' ||
  coalesce(data->>'club_id', entity_id::text) ||
  case
    when nullif(data->>'membership_id','') is not null
      then '&membership=' || (data->>'membership_id')
    else ''
  end ||
  '&view=requests'
where type = 'activity_join_request'
  and coalesce(data->>'club_id', entity_id::text) is not null;

create extension if not exists pgcrypto;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  type text not null,
  title text not null,
  message text not null default '',
  entity_type text,
  entity_id uuid,
  deep_link text,
  data jsonb not null default '{}'::jsonb,
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_created_idx
  on public.notifications(recipient_user_id, created_at desc);

create index if not exists notifications_unread_idx
  on public.notifications(recipient_user_id, created_at desc)
  where read_at is null;

create unique index if not exists notifications_recipient_dedupe_idx
  on public.notifications(recipient_user_id, dedupe_key)
  where dedupe_key is not null;

alter table public.notifications enable row level security;

revoke all on public.notifications from anon;
revoke insert, delete, update on public.notifications from authenticated;
grant select on public.notifications to authenticated;
grant update(read_at) on public.notifications to authenticated;

drop policy if exists "Users can view their own notifications" on public.notifications;
create policy "Users can view their own notifications"
on public.notifications
for select
to authenticated
using (recipient_user_id = (select auth.uid()));

drop policy if exists "Users can mark their own notifications read" on public.notifications;
create policy "Users can mark their own notifications read"
on public.notifications
for update
to authenticated
using (recipient_user_id = (select auth.uid()))
with check (recipient_user_id = (select auth.uid()));

create or replace function public.create_notification(
  target_user_id uuid,
  source_user_id uuid,
  notification_type text,
  notification_title text,
  notification_message text,
  target_entity_type text default null,
  target_entity_id uuid default null,
  target_deep_link text default null,
  notification_data jsonb default '{}'::jsonb,
  notification_dedupe_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  created_id uuid;
begin
  if target_user_id is null then
    return null;
  end if;

  insert into public.notifications (
    recipient_user_id,
    actor_user_id,
    type,
    title,
    message,
    entity_type,
    entity_id,
    deep_link,
    data,
    dedupe_key
  )
  values (
    target_user_id,
    source_user_id,
    notification_type,
    notification_title,
    notification_message,
    target_entity_type,
    target_entity_id,
    target_deep_link,
    coalesce(notification_data, '{}'::jsonb),
    notification_dedupe_key
  )
  on conflict do nothing
  returning id into created_id;

  return created_id;
end;
$$;

revoke all on function public.create_notification(uuid,uuid,text,text,text,text,uuid,text,jsonb,text) from public;

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
      '/manager/dashboard?club=' || new.club_id::text,
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

revoke all on function public.notify_activity_membership_change() from public;

drop trigger if exists notify_activity_membership_change_trigger on public.activity_memberships;
create trigger notify_activity_membership_change_trigger
after insert or update of status
on public.activity_memberships
for each row
execute function public.notify_activity_membership_change();

do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

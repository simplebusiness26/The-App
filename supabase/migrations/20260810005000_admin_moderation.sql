-- Admin Dashboard, Stage 6a: one safe moderation queue over the two report
-- systems already used by the app. Reported content is returned for review;
-- private Link-up meeting points and attendee data are never selected.

begin;

alter table public.social_reports
  add column if not exists admin_note text not null default '',
  add column if not exists decided_at timestamptz,
  add column if not exists decided_by uuid;

alter table public.live_safety_reports
  add column if not exists admin_note text not null default '',
  add column if not exists decided_at timestamptz,
  add column if not exists decided_by uuid;

alter table public.social_reports
  drop constraint if exists social_reports_admin_note_length,
  add constraint social_reports_admin_note_length
    check (char_length(admin_note)<=500);

alter table public.live_safety_reports
  drop constraint if exists live_safety_reports_admin_note_length,
  add constraint live_safety_reports_admin_note_length
    check (char_length(admin_note)<=500);

-- Administrators formerly had a direct UPDATE policy on social reports. The
-- decision RPC below now owns that write so every outcome has an audit row.
drop policy if exists social_reports_admin_update on public.social_reports;
revoke update on public.social_reports from authenticated;

create or replace function public.admin_get_moderation_queue(
  p_queue text default 'social',
  p_limit integer default 25,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_queue text := lower(btrim(coalesce(p_queue,'')));
  v_limit integer := least(greatest(coalesce(p_limit,25),1),50);
  v_offset integer := greatest(coalesce(p_offset,0),0);
  v_total bigint;
  v_items jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if not public.guestbook_is_admin() then
    raise exception 'Administrator access is required.';
  end if;

  if v_queue='social' then
    select count(*) into v_total
    from public.social_reports r
    where r.status='open';

    select coalesce(jsonb_agg(to_jsonb(item) order by item.created_at desc),'[]'::jsonb)
    into v_items
    from (
      select
        r.id as report_id,
        'social'::text as queue,
        r.reporter_id,
        coalesce(reporter.full_name,'Unknown Explorer') as reporter_name,
        r.target_type,
        r.target_id,
        target.owner_id as target_owner_id,
        coalesce(owner_profile.full_name,'Unknown Explorer') as target_owner_name,
        r.reason,
        r.details,
        r.status as report_state,
        coalesce(target.summary,'Reported content is no longer available') as target_summary,
        coalesce(target.state,'unavailable') as target_state,
        r.created_at
      from public.social_reports r
      left join public.profiles reporter on reporter.id=r.reporter_id
      left join lateral (
        select
          m.user_id as owner_id,
          coalesce(nullif(left(btrim(m.caption),240),''),'Moment with no caption') as summary,
          m.status as state
        from public.explorer_moments m
        where r.target_type='moment' and m.id=r.target_id
        union all
        select
          c.user_id,
          left(c.body,240),
          c.status
        from public.social_comments c
        where r.target_type='comment' and c.id=r.target_id
        limit 1
      ) target on true
      left join public.profiles owner_profile on owner_profile.id=target.owner_id
      where r.status='open'
      order by r.created_at desc,r.id
      limit v_limit offset v_offset
    ) item;
  elsif v_queue='safety' then
    select count(*) into v_total
    from public.live_safety_reports r
    where r.status in ('open','reviewing');

    select coalesce(jsonb_agg(to_jsonb(item) order by item.created_at desc),'[]'::jsonb)
    into v_items
    from (
      select
        r.id as report_id,
        'safety'::text as queue,
        r.reporter_id,
        coalesce(reporter.full_name,'Unknown Explorer') as reporter_name,
        r.target_type,
        r.target_id,
        target.owner_id as target_owner_id,
        coalesce(owner_profile.full_name,'Unknown Explorer') as target_owner_name,
        r.reason,
        r.details,
        r.status as report_state,
        coalesce(target.summary,'Reported content is no longer available') as target_summary,
        coalesce(target.state,'unavailable') as target_state,
        r.created_at
      from public.live_safety_reports r
      left join public.profiles reporter on reporter.id=r.reporter_id
      left join lateral (
        select
          l.creator_id as owner_id,
          left(l.title,240) as summary,
          l.status as state
        from public.linkups l
        where r.target_type='linkup' and l.id=r.target_id
        union all
        select
          m.user_id,
          left(m.body,240),
          m.status
        from public.linkup_messages m
        where r.target_type='linkup_message' and m.id=r.target_id
        union all
        select
          c.user_id,
          left(concat_ws(' · ',c.place_name,c.activity,nullif(c.message,'')),240),
          c.status
        from public.live_checkins c
        where r.target_type='checkin' and c.id=r.target_id
        union all
        select
          p.id,
          coalesce(nullif(btrim(p.full_name),''),'Explorer profile'),
          'profile'::text
        from public.profiles p
        where r.target_type='user' and p.id=r.target_id
        limit 1
      ) target on true
      left join public.profiles owner_profile on owner_profile.id=target.owner_id
      where r.status in ('open','reviewing')
      order by r.created_at desc,r.id
      limit v_limit offset v_offset
    ) item;
  else
    raise exception 'Moderation queue must be social or safety.';
  end if;

  return jsonb_build_object(
    'queue',v_queue,
    'total',v_total,
    'items',coalesce(v_items,'[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_decide_report(
  p_queue text,
  p_report_id uuid,
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
  v_queue text := lower(btrim(coalesce(p_queue,'')));
  v_decision text := lower(btrim(coalesce(p_decision,'')));
  v_reason text := btrim(coalesce(p_reason,''));
  v_target_type text;
  v_target_id uuid;
  v_report_state text;
  v_rows integer := 0;
begin
  if v_actor is null then
    raise exception 'Authentication is required.';
  end if;

  if not public.guestbook_is_admin() then
    raise exception 'Administrator access is required.';
  end if;

  if v_decision not in ('actioned','dismissed') then
    raise exception 'Decision must be actioned or dismissed.';
  end if;

  if char_length(v_reason) not between 3 and 500 then
    raise exception 'A decision reason between 3 and 500 characters is required.';
  end if;

  if v_queue='social' then
    select r.target_type,r.target_id,r.status
    into v_target_type,v_target_id,v_report_state
    from public.social_reports r
    where r.id=p_report_id
    for update;

    if not found then raise exception 'Social report not found.'; end if;
    if v_report_state<>'open' then raise exception 'This social report has already been decided.'; end if;

    update public.social_reports
    set
      status=v_decision,
      admin_note=v_reason,
      decided_at=now(),
      decided_by=v_actor
    where id=p_report_id;

    if v_decision='actioned' then
      if v_target_type='moment' then
        update public.explorer_moments set status='removed' where id=v_target_id;
        get diagnostics v_rows = row_count;
      elsif v_target_type='comment' then
        update public.social_comments set status='removed' where id=v_target_id;
        get diagnostics v_rows = row_count;
      end if;
    end if;
  elsif v_queue='safety' then
    select r.target_type,r.target_id,r.status
    into v_target_type,v_target_id,v_report_state
    from public.live_safety_reports r
    where r.id=p_report_id
    for update;

    if not found then raise exception 'Safety report not found.'; end if;
    if v_report_state not in ('open','reviewing') then
      raise exception 'This safety report has already been decided.';
    end if;

    update public.live_safety_reports
    set
      status=case when v_decision='actioned' then 'resolved' else 'dismissed' end,
      admin_note=v_reason,
      decided_at=now(),
      decided_by=v_actor
    where id=p_report_id;

    if v_decision='actioned' then
      if v_target_type='linkup' then
        update public.linkups set status='cancelled',updated_at=now() where id=v_target_id;
        get diagnostics v_rows = row_count;
      elsif v_target_type='linkup_message' then
        update public.linkup_messages
        set status='deleted',deleted_at=coalesce(deleted_at,now())
        where id=v_target_id;
        get diagnostics v_rows = row_count;
      elsif v_target_type='checkin' then
        update public.live_checkins
        set status='ended',ended_at=coalesce(ended_at,now())
        where id=v_target_id;
        get diagnostics v_rows = row_count;
      end if;
    end if;
  else
    raise exception 'Moderation queue must be social or safety.';
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
    'report.' || v_decision,
    v_queue || '_report',
    p_report_id,
    v_reason,
    jsonb_build_object(
      'reported_target_type',v_target_type,
      'reported_target_id',v_target_id,
      'target_changed',v_rows>0
    )
  );

  return jsonb_build_object(
    'queue',v_queue,
    'report_id',p_report_id,
    'decision',v_decision,
    'target_changed',v_rows>0
  );
end;
$$;

revoke all on function public.admin_get_moderation_queue(text,integer,integer)
  from public,anon,authenticated;
grant execute on function public.admin_get_moderation_queue(text,integer,integer)
  to authenticated;

revoke all on function public.admin_decide_report(text,uuid,text,text)
  from public,anon,authenticated;
grant execute on function public.admin_decide_report(text,uuid,text,text)
  to authenticated;

commit;

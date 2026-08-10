-- Admin Dashboard, Stage 7: a read-only ownership and canonical-area health
-- report. This function reports discrepancies; it never guesses a repair or
-- changes a live row.

begin;

create or replace function public.admin_get_data_quality_report()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_ownership_issues jsonb;
  v_missing_area_counts jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if not public.guestbook_is_admin() then
    raise exception 'Administrator access is required.';
  end if;

  select coalesce(
    jsonb_agg(to_jsonb(issue) order by issue.created_at desc,issue.issue_id),
    '[]'::jsonb
  )
  into v_ownership_issues
  from (
    select
      c.id as issue_id,
      'approved_claim_mismatch'::text as issue_type,
      'business'::text as listing_type,
      b.id as listing_id,
      b.name as listing_name,
      'Approved claim is not reflected by the business owner or claimed flag.'::text as summary,
      c.created_at
    from public.claims c
    join public.businesses b on b.id=c.business_id
    where c.status='approved'
      and (b.owner_id is distinct from c.user_id or coalesce(b.claimed,false)=false)

    union all

    select
      c.id,
      'approved_claim_mismatch',
      'property',
      p.id,
      p.name,
      'Approved claim is not reflected by the property owner.',
      c.created_at
    from public.claims c
    join public.properties p on p.id=c.property_id
    where c.status='approved'
      and p.owner_id is distinct from c.user_id

    union all

    select
      b.id,
      'business_owner_state',
      'business',
      b.id,
      b.name,
      case
        when b.owner_id is null
          then 'Business is marked claimed but has no owner.'
        else 'Business has an owner but is not marked claimed.'
      end,
      b.created_at
    from public.businesses b
    where (b.owner_id is null and coalesce(b.claimed,false)=true)
       or (b.owner_id is not null and coalesce(b.claimed,false)=false)
  ) issue;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'source_table',item.source_table,
        'row_count',item.row_count
      )
      order by item.source_table
    ),
    '[]'::jsonb
  )
  into v_missing_area_counts
  from (
    values
      ('profiles'::text,(select count(*) from public.profiles where area_id is null)),
      ('businesses',(select count(*) from public.businesses where area_id is null)),
      ('properties',(select count(*) from public.properties where area_id is null)),
      ('public_places',(select count(*) from public.public_places where area_id is null)),
      ('activity_clubs',(select count(*) from public.activity_clubs where area_id is null)),
      ('events',(select count(*) from public.events where area_id is null)),
      ('linkups',(select count(*) from public.linkups where area_id is null)),
      ('live_checkins',(select count(*) from public.live_checkins where area_id is null))
  ) item(source_table,row_count)
  where item.row_count>0;

  return jsonb_build_object(
    'ownership_issues',coalesce(v_ownership_issues,'[]'::jsonb),
    'missing_area_counts',coalesce(v_missing_area_counts,'[]'::jsonb)
  );
end;
$$;

comment on function public.admin_get_data_quality_report() is
  'Administrator-only, read-only report of listing ownership discrepancies and rows without canonical areas.';

revoke all on function public.admin_get_data_quality_report()
  from public,anon,authenticated;
grant execute on function public.admin_get_data_quality_report()
  to authenticated;

commit;

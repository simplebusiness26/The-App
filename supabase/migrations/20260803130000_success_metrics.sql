-- The vision defines success as completed local experiences (a visit, a
-- club session joined, an event attended, a booking finished, a verified
-- review left), not downloads or map views -- and asks to prefer changes
-- that grow that number over changes that just grow browsing. Nothing in
-- the app measured this before. This adds a read-only rollup over the
-- completion signals that already exist in the schema, for admins to see.

create or replace function public.get_success_metrics()
returns table(
  window_label text,
  verified_reviews bigint,
  linkups_joined bigint,
  activity_rsvps bigint,
  total_completed_experiences bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists(select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true) then
    raise exception 'Admin account required.';
  end if;

  return query
  with windows(window_label,since) as (
    values
      ('last_7_days', now() - interval '7 days'),
      ('last_30_days', now() - interval '30 days'),
      ('all_time', '-infinity'::timestamptz)
  )
  select
    w.window_label,
    (select count(*) from public.qr_review_verifications v where v.verified_at >= w.since),
    (select count(*) from public.linkup_attendees a where a.status = 'joined' and a.joined_at >= w.since),
    (select count(*) from public.activity_session_rsvps r where r.status = 'going' and r.created_at >= w.since),
    (select count(*) from public.qr_review_verifications v where v.verified_at >= w.since)
      + (select count(*) from public.linkup_attendees a where a.status = 'joined' and a.joined_at >= w.since)
      + (select count(*) from public.activity_session_rsvps r where r.status = 'going' and r.created_at >= w.since)
  from windows w
  order by case w.window_label when 'last_7_days' then 1 when 'last_30_days' then 2 else 3 end;
end;
$$;

revoke all on function public.get_success_metrics() from public, anon;
grant execute on function public.get_success_metrics() to authenticated;

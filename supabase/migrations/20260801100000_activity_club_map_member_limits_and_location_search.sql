alter table public.activity_clubs
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists member_limit integer not null default 20;

alter table public.activity_clubs
  drop constraint if exists activity_clubs_member_limit_check;

alter table public.activity_clubs
  add constraint activity_clubs_member_limit_check
  check (member_limit between 1 and 10000);

alter table public.activity_memberships
  drop constraint if exists activity_memberships_status_check;

alter table public.activity_memberships
  add constraint activity_memberships_status_check
  check (status in ('pending','approved','rejected','left','blocked','removed'));

create table if not exists public.location_geocode_cache (
  normalized_query text primary key,
  original_query text not null,
  results jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.location_geocode_cache enable row level security;
revoke all on public.location_geocode_cache from anon, authenticated;

create or replace function public.enforce_activity_club_member_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed_members integer;
  current_members integer;
begin
  if new.status = 'approved'
     and (tg_op = 'INSERT' or old.status is distinct from 'approved') then
    select member_limit
      into allowed_members
      from public.activity_clubs
     where id = new.club_id
     for update;

    select count(*)::integer
      into current_members
      from public.activity_memberships
     where club_id = new.club_id
       and status = 'approved';

    if current_members >= allowed_members then
      raise exception 'This Activity Club has reached its member limit of %.', allowed_members;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_activity_club_member_limit_trigger
  on public.activity_memberships;

create trigger enforce_activity_club_member_limit_trigger
before insert or update of status
on public.activity_memberships
for each row
execute function public.enforce_activity_club_member_limit();

create or replace function public.sync_activity_club_full_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_club uuid;
  allowed_members integer;
  current_members integer;
  current_status text;
begin
  target_club := coalesce(new.club_id, old.club_id);

  select member_limit, status
    into allowed_members, current_status
    from public.activity_clubs
   where id = target_club;

  if current_status not in ('open','full') then
    return coalesce(new, old);
  end if;

  select count(*)::integer
    into current_members
    from public.activity_memberships
   where club_id = target_club
     and status = 'approved';

  update public.activity_clubs
     set status = case
       when current_members >= allowed_members then 'full'
       else 'open'
     end
   where id = target_club;

  return coalesce(new, old);
end;
$$;

drop trigger if exists sync_activity_club_full_status_trigger
  on public.activity_memberships;

create trigger sync_activity_club_full_status_trigger
after insert or update of status or delete
on public.activity_memberships
for each row
execute function public.sync_activity_club_full_status();

create or replace view public.activity_club_stats
with (security_invoker = true)
as
select
  c.id as club_id,
  coalesce(m.member_count,0)::integer as member_count,
  coalesce(r.average_rating,0)::numeric as average_rating,
  coalesce(r.review_count,0)::integer as review_count,
  greatest(c.member_limit - coalesce(m.member_count,0),0)::integer as spaces_remaining
from public.activity_clubs c
left join (
  select club_id,count(*)::integer as member_count
  from public.activity_memberships
  where status='approved'
  group by club_id
) m on m.club_id=c.id
left join (
  select club_id,round(avg(rating)::numeric,2) as average_rating,count(*)::integer as review_count
  from public.activity_club_reviews
  group by club_id
) r on r.club_id=c.id;

create or replace view public.activity_session_stats
with (security_invoker = true)
as
select
  s.id as session_id,
  count(r.id) filter (where r.status='going')::integer as booking_count,
  greatest(s.capacity-count(r.id) filter (where r.status='going'),0)::integer as spaces_remaining
from public.activity_sessions s
left join public.activity_session_rsvps r on r.session_id=s.id
group by s.id,s.capacity;

grant select on public.activity_club_stats to anon,authenticated;
grant select on public.activity_session_stats to anon,authenticated;

create index if not exists activity_memberships_user_status_idx
  on public.activity_memberships(user_id,status);
create index if not exists activity_messages_user_idx
  on public.activity_messages(user_id);
create index if not exists activity_club_reviews_user_idx
  on public.activity_club_reviews(user_id);
create index if not exists activity_announcements_club_idx
  on public.activity_announcements(club_id);

drop policy if exists "Explorers can reapply to activity clubs" on public.activity_memberships;
create policy "Explorers can reapply to activity clubs"
on public.activity_memberships
for update to authenticated
using (
  user_id = (select auth.uid())
  and status in ('rejected','left','removed')
)
with check (
  user_id = (select auth.uid())
  and status = 'pending'
);

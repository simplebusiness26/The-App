create extension if not exists pgcrypto;

-- Paid capability foundation. Payments will update this record later.
create table if not exists public.manager_capabilities (
  user_id uuid primary key references auth.users(id) on delete cascade,
  activity_clubs_status text not null default 'inactive'
    check (activity_clubs_status in ('inactive','trial','active','past_due','cancelled')),
  activity_clubs_started_at timestamptz,
  activity_clubs_ends_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_clubs (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text not null default 'Community',
  description text not null default '',
  location text not null,
  address text not null default '',
  image_url text,
  price numeric(10,2) not null default 0 check (price >= 0),
  status text not null default 'open'
    check (status in ('draft','open','full','closed')),
  created_at timestamptz not null default now()
);

create table if not exists public.activity_sessions (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.activity_clubs(id) on delete cascade,
  title text not null default 'Club session',
  starts_at timestamptz not null,
  ends_at timestamptz,
  capacity integer not null check (capacity > 0),
  created_at timestamptz not null default now()
);

-- Explorers apply first. Only approved members unlock the message board.
create table if not exists public.activity_memberships (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.activity_clubs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','left','blocked')),
  application_note text not null default '',
  manager_note text not null default '',
  applied_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (club_id,user_id)
);

create table if not exists public.activity_session_rsvps (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.activity_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'going'
    check (status in ('going','cancelled')),
  created_at timestamptz not null default now(),
  unique (session_id,user_id)
);

create table if not exists public.activity_announcements (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.activity_clubs(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_messages (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.activity_clubs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 1000),
  created_at timestamptz not null default now()
);

-- Club profiles and reviews remain public, including to non-members.
create table if not exists public.activity_club_reviews (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.activity_clubs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id,user_id)
);

create index if not exists activity_clubs_manager_idx
  on public.activity_clubs(manager_id);
create index if not exists activity_sessions_club_start_idx
  on public.activity_sessions(club_id,starts_at);
create index if not exists activity_memberships_club_idx
  on public.activity_memberships(club_id,status);
create index if not exists activity_memberships_user_idx
  on public.activity_memberships(user_id,status);
create index if not exists activity_rsvps_session_idx
  on public.activity_session_rsvps(session_id,status);
create index if not exists activity_messages_club_created_idx
  on public.activity_messages(club_id,created_at);
create index if not exists activity_reviews_club_created_idx
  on public.activity_club_reviews(club_id,created_at desc);

create or replace view public.activity_club_stats as
select
  c.id as club_id,
  count(m.id) filter (where m.status = 'approved')::integer as member_count,
  coalesce(round(avg(r.rating)::numeric,2),0)::numeric as average_rating,
  count(r.id)::integer as review_count
from public.activity_clubs c
left join public.activity_memberships m on m.club_id = c.id
left join public.activity_club_reviews r on r.club_id = c.id
group by c.id;

create or replace view public.activity_session_stats as
select
  s.id as session_id,
  count(r.id) filter (where r.status = 'going')::integer as booking_count,
  greatest(
    s.capacity - count(r.id) filter (where r.status = 'going'),
    0
  )::integer as spaces_remaining
from public.activity_sessions s
left join public.activity_session_rsvps r on r.session_id = s.id
group by s.id,s.capacity;

grant select on public.activity_club_stats to anon,authenticated;
grant select on public.activity_session_stats to anon,authenticated;

alter table public.manager_capabilities enable row level security;
alter table public.activity_clubs enable row level security;
alter table public.activity_sessions enable row level security;
alter table public.activity_memberships enable row level security;
alter table public.activity_session_rsvps enable row level security;
alter table public.activity_announcements enable row level security;
alter table public.activity_messages enable row level security;
alter table public.activity_club_reviews enable row level security;

-- Managers can see their own add-on status. Admins can activate it manually
-- until paid subscriptions are connected.
drop policy if exists "Managers can view their capabilities" on public.manager_capabilities;
create policy "Managers can view their capabilities"
on public.manager_capabilities for select to authenticated
using (user_id = auth.uid());

drop policy if exists "Admins can manage manager capabilities" on public.manager_capabilities;
create policy "Admins can manage manager capabilities"
on public.manager_capabilities for all to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and p.is_admin = true
))
with check (exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and p.is_admin = true
));

-- Everyone can see published club profiles. Drafts are manager-only.
drop policy if exists "Public can view published activity clubs" on public.activity_clubs;
create policy "Public can view published activity clubs"
on public.activity_clubs for select
using (status <> 'draft' or manager_id = auth.uid());

-- A manager needs the Activity Clubs add-on before creating a club.
drop policy if exists "Activated managers can create activity clubs" on public.activity_clubs;
create policy "Activated managers can create activity clubs"
on public.activity_clubs for insert to authenticated
with check (
  manager_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.account_type = 'manager'
  )
  and exists (
    select 1 from public.manager_capabilities mc
    where mc.user_id = auth.uid()
      and mc.activity_clubs_status in ('trial','active')
      and (mc.activity_clubs_ends_at is null or mc.activity_clubs_ends_at > now())
  )
);

drop policy if exists "Managers can update their own activity clubs" on public.activity_clubs;
create policy "Managers can update their own activity clubs"
on public.activity_clubs for update to authenticated
using (manager_id = auth.uid())
with check (manager_id = auth.uid());

drop policy if exists "Managers can delete their own activity clubs" on public.activity_clubs;
create policy "Managers can delete their own activity clubs"
on public.activity_clubs for delete to authenticated
using (manager_id = auth.uid());

-- Sessions are visible on the public profile.
drop policy if exists "Public can view activity sessions" on public.activity_sessions;
create policy "Public can view activity sessions"
on public.activity_sessions for select
using (true);

drop policy if exists "Club managers can create sessions" on public.activity_sessions;
create policy "Club managers can create sessions"
on public.activity_sessions for insert to authenticated
with check (exists (
  select 1 from public.activity_clubs c
  where c.id = club_id and c.manager_id = auth.uid()
));

drop policy if exists "Club managers can update sessions" on public.activity_sessions;
create policy "Club managers can update sessions"
on public.activity_sessions for update to authenticated
using (exists (
  select 1 from public.activity_clubs c
  where c.id = club_id and c.manager_id = auth.uid()
));

drop policy if exists "Club managers can delete sessions" on public.activity_sessions;
create policy "Club managers can delete sessions"
on public.activity_sessions for delete to authenticated
using (exists (
  select 1 from public.activity_clubs c
  where c.id = club_id and c.manager_id = auth.uid()
));

-- Explorers apply. They cannot approve themselves.
drop policy if exists "Members and club managers can view memberships" on public.activity_memberships;
create policy "Applicants and club managers can view memberships"
on public.activity_memberships for select to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.activity_clubs c
    where c.id = club_id and c.manager_id = auth.uid()
  )
);

drop policy if exists "Users can join activity clubs" on public.activity_memberships;
create policy "Explorers can apply to activity clubs"
on public.activity_memberships for insert to authenticated
with check (
  user_id = auth.uid()
  and status = 'pending'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.account_type = 'explorer'
  )
);

drop policy if exists "Users can update their membership" on public.activity_memberships;
create policy "Club managers can decide membership applications"
on public.activity_memberships for update to authenticated
using (exists (
  select 1 from public.activity_clubs c
  where c.id = club_id and c.manager_id = auth.uid()
))
with check (exists (
  select 1 from public.activity_clubs c
  where c.id = club_id and c.manager_id = auth.uid()
));

drop policy if exists "Users can leave activity clubs" on public.activity_memberships;
create policy "Explorers can leave their activity clubs"
on public.activity_memberships for delete to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.activity_clubs c
    where c.id = club_id and c.manager_id = auth.uid()
  )
);

-- Only approved members can book sessions.
drop policy if exists "Users can view their RSVPs and managers can view club RSVPs" on public.activity_session_rsvps;
create policy "Members can view their RSVPs and managers can view club RSVPs"
on public.activity_session_rsvps for select to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.activity_sessions s
    join public.activity_clubs c on c.id = s.club_id
    where s.id = session_id and c.manager_id = auth.uid()
  )
);

drop policy if exists "Users can RSVP themselves" on public.activity_session_rsvps;
create policy "Approved members can RSVP themselves"
on public.activity_session_rsvps for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.activity_sessions s
    join public.activity_memberships m on m.club_id = s.club_id
    where s.id = session_id
      and m.user_id = auth.uid()
      and m.status = 'approved'
  )
);

drop policy if exists "Users can update their own RSVP" on public.activity_session_rsvps;
create policy "Members can update their own RSVP"
on public.activity_session_rsvps for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can delete their own RSVP" on public.activity_session_rsvps;
create policy "Members can delete their own RSVP"
on public.activity_session_rsvps for delete to authenticated
using (user_id = auth.uid());

-- Announcements can be shown publicly on the club profile.
drop policy if exists "Public can view activity announcements" on public.activity_announcements;
create policy "Public can view activity announcements"
on public.activity_announcements for select
using (true);

drop policy if exists "Club managers can post announcements" on public.activity_announcements;
create policy "Club managers can post announcements"
on public.activity_announcements for insert to authenticated
with check (
  author_id = auth.uid()
  and exists (
    select 1 from public.activity_clubs c
    where c.id = club_id and c.manager_id = auth.uid()
  )
);

drop policy if exists "Club managers can manage announcements" on public.activity_announcements;
create policy "Club managers can manage announcements"
on public.activity_announcements for delete to authenticated
using (exists (
  select 1 from public.activity_clubs c
  where c.id = club_id and c.manager_id = auth.uid()
));

-- The message board is private to approved members and the club manager.
drop policy if exists "Members can view club messages" on public.activity_messages;
create policy "Approved members can view club messages"
on public.activity_messages for select to authenticated
using (
  exists (
    select 1 from public.activity_memberships m
    where m.club_id = activity_messages.club_id
      and m.user_id = auth.uid()
      and m.status = 'approved'
  )
  or exists (
    select 1 from public.activity_clubs c
    where c.id = activity_messages.club_id and c.manager_id = auth.uid()
  )
);

drop policy if exists "Members can post club messages" on public.activity_messages;
create policy "Approved members can post club messages"
on public.activity_messages for insert to authenticated
with check (
  user_id = auth.uid()
  and (
    exists (
      select 1 from public.activity_memberships m
      where m.club_id = activity_messages.club_id
        and m.user_id = auth.uid()
        and m.status = 'approved'
    )
    or exists (
      select 1 from public.activity_clubs c
      where c.id = activity_messages.club_id and c.manager_id = auth.uid()
    )
  )
);

drop policy if exists "Authors and club managers can delete messages" on public.activity_messages;
create policy "Authors and club managers can delete messages"
on public.activity_messages for delete to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.activity_clubs c
    where c.id = activity_messages.club_id and c.manager_id = auth.uid()
  )
);

-- Reviews are public. Only approved members can create or change their review.
drop policy if exists "Public can view activity club reviews" on public.activity_club_reviews;
create policy "Public can view activity club reviews"
on public.activity_club_reviews for select
using (true);

drop policy if exists "Approved members can review activity clubs" on public.activity_club_reviews;
create policy "Approved members can review activity clubs"
on public.activity_club_reviews for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.activity_memberships m
    where m.club_id = activity_club_reviews.club_id
      and m.user_id = auth.uid()
      and m.status = 'approved'
  )
);

drop policy if exists "Reviewers can update their activity club review" on public.activity_club_reviews;
create policy "Reviewers can update their activity club review"
on public.activity_club_reviews for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Reviewers can delete their activity club review" on public.activity_club_reviews;
create policy "Reviewers can delete their activity club review"
on public.activity_club_reviews for delete to authenticated
using (user_id = auth.uid());

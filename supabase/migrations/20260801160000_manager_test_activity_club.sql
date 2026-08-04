-- Run this after 20260801_activity_clubs.sql in the Supabase SQL Editor.
-- It activates Activity Clubs for manager@test.com and creates test data.

alter table public.activity_memberships
  add column if not exists applicant_name text not null default 'Explorer';

alter table public.activity_messages
  add column if not exists author_name text not null default 'Member';

alter table public.activity_club_reviews
  add column if not exists reviewer_name text not null default 'Explorer';

create unique index if not exists activity_clubs_manager_name_unique
  on public.activity_clubs(manager_id,name);

do $$
declare
  manager_user_id uuid;
  test_club_id uuid;
begin
  -- Packet 0: this block seeds development data for manager@test.com and must
  -- never run against production. It is opt-in, and silent when not opted in.
  --
  -- To seed a development database:  set guestbook.seed_test_data = 'on';
  --
  -- This also repairs a fresh apply. The block below raises when the test auth
  -- user is absent, so `supabase db reset` on a clean project failed outright
  -- rather than skipping data it was never going to be able to insert.
  if coalesce(current_setting('guestbook.seed_test_data', true), 'off') <> 'on' then
    raise notice 'Skipping test data: set guestbook.seed_test_data to on to seed a development database.';
    return;
  end if;
  select id
  into manager_user_id
  from auth.users
  where lower(email) = lower('manager@test.com')
  limit 1;

  if manager_user_id is null then
    raise exception 'No Supabase Auth user exists for manager@test.com';
  end if;

  update public.profiles
  set account_type = 'manager'
  where id = manager_user_id;

  insert into public.manager_capabilities (
    user_id,
    activity_clubs_status,
    activity_clubs_started_at,
    activity_clubs_ends_at,
    updated_at
  )
  values (
    manager_user_id,
    'active',
    now(),
    null,
    now()
  )
  on conflict (user_id)
  do update set
    activity_clubs_status = 'active',
    activity_clubs_started_at = coalesce(
      public.manager_capabilities.activity_clubs_started_at,
      now()
    ),
    activity_clubs_ends_at = null,
    updated_at = now();

  insert into public.activity_clubs (
    manager_id,
    name,
    category,
    description,
    location,
    address,
    price,
    status
  )
  values (
    manager_user_id,
    'Hastings Weekend Walkers',
    'Walking & Outdoors',
    'A friendly local activity club for relaxed weekend walks, coastal routes and meeting new people. Explorers can view the public profile and reviews, then apply to join the private club community.',
    'Hastings, East Sussex',
    'Hastings Pier, 1-10 White Rock, Hastings',
    5.00,
    'open'
  )
  on conflict (manager_id,name)
  do update set
    category = excluded.category,
    description = excluded.description,
    location = excluded.location,
    address = excluded.address,
    price = excluded.price,
    status = excluded.status
  returning id into test_club_id;

  if not exists (
    select 1
    from public.activity_sessions
    where club_id = test_club_id
      and title = 'Saturday Coastal Walk'
      and starts_at > now()
  ) then
    insert into public.activity_sessions (
      club_id,
      title,
      starts_at,
      ends_at,
      capacity
    )
    values (
      test_club_id,
      'Saturday Coastal Walk',
      date_trunc('day',now()) + interval '3 days 11 hours',
      date_trunc('day',now()) + interval '3 days 13 hours',
      20
    );
  end if;

  if not exists (
    select 1
    from public.activity_announcements
    where club_id = test_club_id
      and title = 'Welcome to our test club'
  ) then
    insert into public.activity_announcements (
      club_id,
      author_id,
      title,
      message
    )
    values (
      test_club_id,
      manager_user_id,
      'Welcome to our test club',
      'Applications are open. Approved members will unlock the private message board.'
    );
  end if;
end $$;

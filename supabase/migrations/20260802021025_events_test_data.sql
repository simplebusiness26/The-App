-- Development preview data for the existing manager test account.
-- Its timestamp matches the applied Supabase migration history.
do $$
declare
  manager_user_id uuid;
  test_event_id uuid;
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
    events_status,
    events_started_at,
    events_ends_at,
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
    events_status = 'active',
    events_started_at = coalesce(
      public.manager_capabilities.events_started_at,
      now()
    ),
    events_ends_at = null,
    updated_at = now();

  select id
  into test_event_id
  from public.events
  where manager_id = manager_user_id
    and name = 'Hastings Community Day'
  order by created_at
  limit 1;

  if test_event_id is null then
    insert into public.events (
      manager_id,
      name,
      category,
      description,
      location,
      address,
      latitude,
      longitude,
      starts_at,
      ends_at,
      price,
      capacity,
      status
    )
    values (
      manager_user_id,
      'Hastings Community Day',
      'Community',
      'A friendly daytime event with local stalls, activities and community groups. This sample listing can be edited or removed from the manager dashboard.',
      'Hastings, East Sussex',
      'Hastings Pier, 1-10 White Rock, Hastings',
      50.8533,
      0.5729,
      date_trunc('day',now()) + interval '4 days 11 hours',
      date_trunc('day',now()) + interval '4 days 15 hours',
      0,
      150,
      'published'
    )
    returning id into test_event_id;
  else
    update public.events
    set
      category = 'Community',
      description = 'A friendly daytime event with local stalls, activities and community groups. This sample listing can be edited or removed from the manager dashboard.',
      location = 'Hastings, East Sussex',
      address = 'Hastings Pier, 1-10 White Rock, Hastings',
      latitude = 50.8533,
      longitude = 0.5729,
      starts_at = date_trunc('day',now()) + interval '4 days 11 hours',
      ends_at = date_trunc('day',now()) + interval '4 days 15 hours',
      price = 0,
      capacity = 150,
      status = 'published'
    where id = test_event_id;
  end if;
end $$;

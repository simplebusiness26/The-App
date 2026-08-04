do $$
declare
  manager_user_id uuid;
  explorer_user_id uuid;
  new_club_id uuid;
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
  select id into manager_user_id
  from auth.users
  where lower(email)=lower('manager@test.com')
  limit 1;

  select id into explorer_user_id
  from auth.users
  where lower(email)=lower('explorer@test.com')
  limit 1;

  update public.activity_clubs
     set address='Alexandra Park, St Helen''s Road, Hastings, East Sussex',
         location='Hastings',
         latitude=50.8680,
         longitude=0.5685,
         member_limit=20
   where manager_id=manager_user_id
     and name='Hastings Weekend Walkers';

  select id into new_club_id
  from public.activity_clubs
  where manager_id=manager_user_id
    and name='Hastings Sunset Running Club'
  limit 1;

  if new_club_id is null then
    insert into public.activity_clubs (
      manager_id,
      name,
      category,
      description,
      location,
      address,
      latitude,
      longitude,
      price,
      member_limit,
      status
    ) values (
      manager_user_id,
      'Hastings Sunset Running Club',
      'Running',
      'A friendly seafront running club for explorers and locals. All abilities are welcome and members arrange weekly social runs through the private message board.',
      'Hastings',
      'The Stade, Rock-a-Nore Road, Hastings, East Sussex, TN34 3DW',
      50.8569,
      0.5925,
      0,
      12,
      'open'
    ) returning id into new_club_id;
  else
    update public.activity_clubs
       set address='The Stade, Rock-a-Nore Road, Hastings, East Sussex, TN34 3DW',
           location='Hastings',
           latitude=50.8569,
           longitude=0.5925,
           member_limit=12,
           status='open'
     where id=new_club_id;
  end if;

  delete from public.activity_memberships
  where club_id=new_club_id
    and user_id=explorer_user_id;

  if not exists (
    select 1 from public.activity_sessions where club_id=new_club_id
  ) then
    insert into public.activity_sessions (
      club_id,title,starts_at,ends_at,capacity
    ) values (
      new_club_id,
      'Sunset Seafront 5K',
      date_trunc('day',now()) + interval '7 days 18 hours 30 minutes',
      date_trunc('day',now()) + interval '7 days 19 hours 30 minutes',
      20
    );
  end if;

  if not exists (
    select 1 from public.activity_announcements where club_id=new_club_id
  ) then
    insert into public.activity_announcements (
      club_id,author_id,title,message
    ) values (
      new_club_id,
      manager_user_id,
      'New members welcome',
      'Open the club profile and send a join request. Once approved, you will unlock the private message board.'
    );
  end if;
end $$;

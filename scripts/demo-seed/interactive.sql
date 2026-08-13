-- Makes the new interactive things visible. NOT a migration.
--
-- Applied 2026-08-13 against yzpthslwsvesgndzdqai, on top of
-- scripts/demo-seed/seed.sql. Everything it does is either a flag flip or a
-- date shift on rows that already exist -- it inserts almost nothing, so
-- interactive-undo.sql puts it back rather than deleting content.
--
-- WHY IT IS NEEDED
-- The database already held plenty: 38 live Moments, 15 Memories, 78 review
-- photos. None of it could be SEEN, because every one of the twenty profiles
-- was on visibility 'nobody' -- the correct default, and the reason the map
-- looked empty. Nothing else in this file matters until that is fixed.
--
-- THE VISIBILITY CHANGE IS THE ONE TO UNDERSTAND
-- It sets DEMO ACCOUNTS ONLY to 'everyone'. It is not a change to the default,
-- not a change to any rule, and not a migration -- a new account created after
-- this still starts at 'nobody' and still gets the prompt explaining it. This
-- is the owner opening up their own test accounts so their own app has
-- something to show.
--
-- hmpchelsea@gmail.com and craig.radband@gmail.com are left alone: they are
-- real people's accounts, and widening a real person's audience is not
-- something a demo script gets to do.

begin;

-- ---------------------------------------------------------------------------
-- 1. Make the demo accounts visible to each other
-- ---------------------------------------------------------------------------

update public.profiles
set visibility='everyone'
where id in (select id from auth.users where email like '%@test.com')
   or id in (select id from auth.users where email in (
        'guest@guestbook.com','tester@guestbook.com','business@business.com',
        'business@teser.com','ladnlord@landlord.com','property@property.com',
        'admin@gustbook.com','guestbooker1@gmail.com','callum@guest.co.uk',
        'radband98@gmail.com','newbusiness@test.com'
      ));

-- ---------------------------------------------------------------------------
-- 2. Live bubbles: the two Manager switches
-- ---------------------------------------------------------------------------
-- Deliberately NOT all of them. The bubble controller shows at most three at a
-- time and skips any that would overlap, and turning everything on would hide
-- that rather than demonstrate it.

update public.activity_clubs
set spaces_available=true
where id in (
  '50000000-0000-4000-8000-000000000001',  -- Brighton Sunrise Runners
  '50000000-0000-4000-8000-000000000003'   -- Coastal Camera Club
);

-- One with a room count and one without, because the map is supposed to say
-- "2 rooms" when it knows and "Available" when it does not.
update public.properties
set show_availability=true, rooms_available=2
where id='30000000-0000-4000-8000-000000000001';

update public.properties
set show_availability=true, rooms_available=null
where id='30000000-0000-4000-8000-000000000002';

-- ---------------------------------------------------------------------------
-- 3. Events in each of the three live states
-- ---------------------------------------------------------------------------
-- Every event in the database is in the past, so none of them could surface at
-- all. Three are moved onto today, one per state, so all three readings appear
-- -- and only the first gets the confetti.

-- Happening now. This is the one that celebrates.
update public.events
set starts_at=now()-interval '40 minutes',
    ends_at=now()+interval '2 hours'
where id='40000000-0000-4000-8000-000000000002';

-- Starting soon: inside the hour.
update public.events
set starts_at=now()+interval '35 minutes',
    ends_at=now()+interval '3 hours'
where id='40000000-0000-4000-8000-000000000004';

-- Tonight: later today, but more than an hour off.
update public.events
set starts_at=now()+interval '5 hours',
    ends_at=now()+interval '8 hours'
where id='40000000-0000-4000-8000-000000000001';

-- ---------------------------------------------------------------------------
-- 4. Memories spread across time, for the slider
-- ---------------------------------------------------------------------------
-- The timeline is a ten-day window moved through history. Fifteen Memories all
-- made on the same afternoon would all appear and disappear together, which
-- demonstrates nothing. Spread over roughly four months, they arrive and leave
-- as the handle moves.
--
-- created_at is the date the Memory is ABOUT, and it is what the timeline
-- reads. Nothing else about the rows changes.

-- created_at and map_until move TOGETHER, keeping the gap between them. The
-- explorer_memories_map_until_after_creation constraint refuses a row whose map
-- window ends before it was made, and moving only created_at does exactly that
-- to every Memory with a window. It rejected the first attempt at this.
with spread as (
  select id, row_number() over (order by id) as n
  from public.explorer_memories
  where latitude is not null
)
update public.explorer_memories m
set created_at = now()-((spread.n-1)*9 || ' days')::interval,
    map_until  = case when m.map_until is null then null
                      else now()-((spread.n-1)*9 || ' days')::interval + (m.map_until-m.created_at) end
from spread
where m.id=spread.id;

-- The Memories' OWN audience, which is a separate thing from their author's.
--
-- Opening the profiles was not enough and that is the ceiling working
-- correctly: every one of these rows was written at visibility 'nobody' with no
-- archive audience at all, and a profile set to 'everyone' cannot widen a post
-- that says "only me". The narrower of the two always wins.
--
-- Both are set, because a Memory has two audiences and which one applies
-- depends on whether its live period has passed -- and spreading them back
-- through time above has put most of them into their archive phase.
update public.explorer_memories
set visibility='everyone',
    archive_visibility='everyone'
where latitude is not null;

-- ---------------------------------------------------------------------------
-- 5. A check-in, so the live layer has something in it
-- ---------------------------------------------------------------------------
-- Through the RPC rather than a raw insert, so it goes through exactly the
-- rules a real check-in does -- including the presence cap at friends
-- (20260812220000). If this succeeds, the real path works.

do $$
declare v_explorer uuid;
begin
  select id into v_explorer from auth.users where email='explorer@test.com';
  if v_explorer is null then return; end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub',v_explorer,'role','authenticated')::text, true);

  if not exists (
    select 1 from public.live_checkins
    where user_id=v_explorer and expires_at>now()
  ) then
    perform public.start_live_checkin(
      'park',
      null,
      'Alexandra Park',
      'Hastings',
      50.87,
      0.57,
      'Walking',
      'Long way round today.',
      'friends',
      180,
      (select id from public.public_places where lower(name)='alexandra park' limit 1)
    );
  end if;
end $$;

commit;

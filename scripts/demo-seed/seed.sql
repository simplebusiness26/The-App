-- Demo seed for the live development project. NOT a migration -- see README.md.
--
-- Applied 2026-08-11 against yzpthslwsvesgndzdqai. Every row it writes carries a
-- `deadbeef-…` UUID prefix so undo.sql can remove exactly this and nothing else.
--
-- It assumes the curated listings are already present: businesses `20000000-…`,
-- properties `30000000-…`, events `40000000-…`, clubs `50000000-…`.
--
-- Written to be re-runnable. Every insert is guarded, either by the fixed id or
-- by a NOT EXISTS against the constraint that would otherwise reject it.

begin;

-- ---------------------------------------------------------------------------
-- 1. The people
-- ---------------------------------------------------------------------------
--
-- Six demo accounts get human names. Their emails do not change, so logging in
-- as any of them works exactly as before. The owner's own account
-- (hmpchelsea@gmail.com) and admin@gustbook.com are left named as they are.

update public.profiles p set full_name = d.name
from (values
  ('business@business.com','Maya Whitfield'),
  ('business@teser.com','Tom Ellery'),
  ('guest@guestbook.com','Priya Raman'),
  ('ladnlord@landlord.com','Jen Hollis'),
  ('property@property.com','Sam Okoro'),
  ('tester@guestbook.com','Nadia Brett')
) as d(email,name)
where p.email = d.email;

-- Pictures, bios and a home town. `coalesce` throughout: anything the account
-- already had is kept.
update public.profiles p set
  profile_photo = coalesce(p.profile_photo,'https://picsum.photos/seed/xplorer-'||substr(p.id::text,1,8)||'/400/400'),
  bio           = coalesce(nullif(p.bio,''), d.bio),
  area          = coalesce(p.area, d.area),
  show_area     = true
from (values
  ('admin@gustbook.com',$b$Lives for a Sunday roast and a proper pub quiz.$b$,'Hastings'),
  ('business@business.com',$b$Live music, small venues, loud guitars.$b$,'Brighton'),
  ('business@teser.com',$b$Third-wave coffee obsessive. Will queue.$b$,'St Leonards'),
  ('callum@guest.co.uk',$b$Sea swimmer, all year, no wetsuit. Regret is temporary.$b$,'Hastings'),
  ('guest@guestbook.com',$b$New to town and eating my way through it.$b$,'Brighton'),
  ('guestbooker1@gmail.com',$b$Hastings based. Mostly coffee, coast paths and whatever is on that night.$b$,'Hastings'),
  ('ladnlord@landlord.com',$b$Weekend markets and long walks.$b$,'St Leonards'),
  ('property@property.com',$b$Old Town regular. Knows every shortcut.$b$,'Hastings'),
  ('radband98@gmail.com',$b$Skate, coffee, repeat.$b$,'Hastings'),
  ('tester@guestbook.com',$b$Runs the coast path most mornings. Knows which cafés open early.$b$,'Hastings')
) as d(email,bio,area)
where p.email = d.email;

-- The owner's own account gets a picture and nothing else. `area`/`show_area`
-- publish a real person's town on a public leaderboard and are theirs to set.
update public.profiles set
  profile_photo = coalesce(profile_photo,'https://picsum.photos/seed/xplorer-'||substr(id::text,1,8)||'/400/400')
where email = 'hmpchelsea@gmail.com';

-- ---------------------------------------------------------------------------
-- 2. Follows
-- ---------------------------------------------------------------------------
--
-- A dense but not complete graph across the eleven non-test accounts, so
-- everybody's Feed has something in it and follower counts differ.

insert into public.explorer_follows(id,follower_id,following_id,created_at)
select ('deadbeef-0001-4000-8000-'||lpad((row_number() over ())::text,12,'0'))::uuid,
       a.id, b.id, now()-(random()*interval '20 days')
from public.profiles a
join public.profiles b on b.id <> a.id
where a.email not ilike '%@test.com' and b.email not ilike '%@test.com'
  and ('x'||substr(md5('follow'||a.id::text||b.id::text),1,8))::bit(32)::bigint % 100 < 55
  and not exists (
    select 1 from public.explorer_follows f
    where f.follower_id = a.id and f.following_id = b.id
  )
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 3. Reviews
-- ---------------------------------------------------------------------------
--
-- Written by hand rather than generated, because a place page full of
-- interchangeable text tells you nothing about whether the page works.
--
-- Two constraints shape which of these actually land:
--   * `activity_club_reviews (club_id,user_id)` is unique, enforced through the
--     legacy sync trigger, so a second club review by the same Explorer aborts
--     the whole statement;
--   * a second review of anything by the same Explorer just reads wrong.
-- The NOT EXISTS below covers both.
--
-- Club reviews additionally need an approved/left/removed membership, and event
-- reviews need the event to have started -- `validate_explorer_review_target`
-- enforces both. The rows below satisfy them against the seeded listings.

with listings as (
  select 'business'::text as t, id, name, coalesce(nullif(image,''),'') as img from public.businesses
  union all select 'property', id, name, coalesce(photos[1],'') from public.properties
  union all select 'activity_club', id, name, coalesce(nullif(image_url,''),'') from public.activity_clubs
  union all select 'event', id, name, coalesce(nullif(image_url,''),'') from public.events
),
seed(email,tt,tid,rating,title,body,verified,days_ago) as (values
 ('tester@guestbook.com','business','20000000-0000-4000-8000-000000000001',5,$t$Best flat white on the seafront$t$,$b$Came in off the beach soaked through and they did not blink. Flat white was properly hot, and the banana bread is the real draw. Corner table by the window is the one to get.$b$,true,3),
 ('callum@guest.co.uk','business','20000000-0000-4000-8000-000000000001',4,$t$Good coffee, gets busy at eleven$t$,$b$Quiet at eight, rammed by eleven. Staff are quick even when it is three deep at the counter. Only knock is there is nowhere to put a bag down.$b$,false,9),
 ('guest@guestbook.com','business','20000000-0000-4000-8000-000000000001',5,$t$Became my Saturday routine$t$,$b$Third weekend running. They have started making my order before I reach the counter, which is either lovely or a warning.$b$,false,16),
 ('guestbooker1@gmail.com','business','20000000-0000-4000-8000-000000000002',4,$t$Worth booking for the window seats$t$,$b$Turned up on spec at seven and waited forty minutes. Worth it, the plaice was excellent, but book ahead.$b$,true,5),
 ('ladnlord@landlord.com','business','20000000-0000-4000-8000-000000000002',5,$t$Genuinely good fish$t$,$b$Everything came out of the kitchen looking like somebody cared about it. The chips are proper chips.$b$,false,12),
 ('business@business.com','business','20000000-0000-4000-8000-000000000003',4,$t$Loud room, better food than it needs to be$t$,$b$It is a bar that happens to cook well. Get there before eight if you want to hear anybody you came with.$b$,false,6),
 ('property@property.com','business','20000000-0000-4000-8000-000000000003',5,$t$Best Friday night in the Laines$t$,$b$Went for one and left at closing. The staff make it.$b$,true,2),
 ('business@teser.com','business','20000000-0000-4000-8000-000000000004',4,$t$Brunch done properly$t$,$b$Eggs were right, coffee was right, bill was reasonable. No notes beyond the queue.$b$,false,8),
 ('tester@guestbook.com','business','20000000-0000-4000-8000-000000000004',3,$t$Fine, but the queue is the whole experience$t$,$b$Food was good. Forty minutes on the pavement in the wind was not.$b$,false,20),
 ('guest@guestbook.com','business','20000000-0000-4000-8000-000000000005',5,$t$Where I now buy every present$t$,$b$Small shop, and everything in it has been chosen by somebody with taste. Got talked into a candle and I am not sorry.$b$,true,4),
 ('callum@guest.co.uk','business','20000000-0000-4000-8000-000000000005',4,$t$Lovely, not cheap$t$,$b$Beautiful stuff. You will spend more than you meant to.$b$,false,14),
 ('ladnlord@landlord.com','business','20000000-0000-4000-8000-000000000006',5,$t$The Tuesday evening class is the one$t$,$b$Instructor actually corrects you instead of shouting encouragement. Left feeling like I had done something.$b$,true,7),
 ('admin@gustbook.com','business','20000000-0000-4000-8000-000000000006',4,$t$Clean, calm, easy to book$t$,$b$Changing rooms are spotless. Booking took thirty seconds.$b$,false,18),
 ('guestbooker1@gmail.com','business','20000000-0000-4000-8000-000000000007',5,$t$Took the kids, stayed three hours$t$,$b$Everything works, which is not a given. Cabinets are on free play once you are in.$b$,false,3),
 ('business@business.com','business','20000000-0000-4000-8000-000000000007',4,$t$Better than it looks from outside$t$,$b$Do not be put off by the frontage. Inside it is immaculate.$b$,true,11),
 ('property@property.com','business','20000000-0000-4000-8000-000000000008',4,$t$Sunset pint, no notes$t$,$b$Sit outside, face west, order whatever is on the third pump. That is the whole review.$b$,false,5),
 ('business@teser.com','business','20000000-0000-4000-8000-000000000008',3,$t$Great view, slow bar$t$,$b$Twenty minutes to get served on a Saturday. The view almost makes up for it.$b$,false,13),
 ('tester@guestbook.com','business','20000000-0000-4000-8000-000000000009',5,$t$They roast it themselves and you can tell$t$,$b$Asked what the guest bean was and got a five minute answer I enjoyed every second of.$b$,true,1),
 ('guest@guestbook.com','business','20000000-0000-4000-8000-000000000009',4,$t$Good work spot until noon$t$,$b$Wifi holds up and there are plugs at three tables. Gets loud after lunch.$b$,false,10),
 ('callum@guest.co.uk','business','20000000-0000-4000-8000-000000000010',5,$t$The one I send people to$t$,$b$If somebody visits Hastings and asks where to eat, it is this.$b$,true,6),
 ('admin@gustbook.com','business','20000000-0000-4000-8000-000000000010',4,$t$Small menu, all of it good$t$,$b$Six things on the board. All six were worth ordering.$b$,false,15),
 ('ladnlord@landlord.com','business','20000000-0000-4000-8000-000000000011',4,$t$Climb up, eat well, roll down$t$,$b$The walk up is the price of entry. Sunday roast was serious.$b$,false,9),
 ('guestbooker1@gmail.com','business','20000000-0000-4000-8000-000000000011',5,$t$Best view of any table in town$t$,$b$Ask for the terrace. Even in August you will want a jumper.$b$,true,4),
 ('business@business.com','business','20000000-0000-4000-8000-000000000012',5,$t$Saturday morning sorted$t$,$b$Bread, cheese, flowers, out in twenty minutes. The bread stall sells out by ten so go early.$b$,false,2),
 ('property@property.com','business','20000000-0000-4000-8000-000000000012',4,$t$Bring cash and a bag$t$,$b$Half the stalls are cash only and nobody hands out carriers.$b$,false,12),
 ('business@teser.com','business','20000000-0000-4000-8000-000000000013',5,$t$Booked on a whim, best day of the month$t$,$b$Guides know the cliffs properly. Felt safe the whole way and still felt like an adventure.$b$,true,8),
 ('tester@guestbook.com','business','20000000-0000-4000-8000-000000000013',4,$t$Great, but dress for it$t$,$b$Went in shorts. Do not go in shorts.$b$,false,17),
 ('admin@gustbook.com','business','20000000-0000-4000-8000-000000000014',4,$t$Proper local, no telly$t$,$b$Conversation and a fire. That is it and that is enough.$b$,false,7),
 ('callum@guest.co.uk','business','20000000-0000-4000-8000-000000000014',5,$t$The back room is the secret$t$,$b$Walk past the front bar. Keep going.$b$,true,3),
 ('guest@guestbook.com','property','30000000-0000-4000-8000-000000000001',5,$t$Right in the middle of everything$t$,$b$Stairs are steep and the street is loud until one in the morning. Both worth it for where you wake up.$b$,false,21),
 ('business@business.com','property','30000000-0000-4000-8000-000000000002',5,$t$Woke up to the sea both mornings$t$,$b$The photos undersell the view. Kitchen had everything we needed.$b$,true,11),
 ('guestbooker1@gmail.com','property','30000000-0000-4000-8000-000000000003',4,$t$Quiet, green, ten minutes out$t$,$b$Lovely garden. You will need the bus.$b$,false,19),
 ('ladnlord@landlord.com','property','30000000-0000-4000-8000-000000000004',5,$t$The courtyard makes it$t$,$b$Had breakfast out there every day. Host left proper coffee.$b$,false,6),
 ('property@property.com','property','30000000-0000-4000-8000-000000000005',4,$t$Full of character, light everywhere$t$,$b$North light through the whole flat. Bed is firmer than I would choose.$b$,true,14),
 ('tester@guestbook.com','property','30000000-0000-4000-8000-000000000006',5,$t$Hard to leave$t$,$b$Log burner, no phone signal, exactly what was needed.$b$,false,8),
 ('callum@guest.co.uk','activity_club','50000000-0000-4000-8000-000000000004',5,$t$Turned up alone and got adopted$t$,$b$Was on a table within five minutes. They teach you the rules properly instead of sighing at you.$b$,false,10),
 ('ladnlord@landlord.com','activity_club','50000000-0000-4000-8000-000000000004',4,$t$Good crowd, bring snacks$t$,$b$Runs later than advertised, in a good way.$b$,false,22),
 ('guestbooker1@gmail.com','activity_club','50000000-0000-4000-8000-000000000001',5,$t$Six in the morning and everyone is cheerful$t$,$b$Three paces so nobody gets dropped. The coffee afterwards is the point.$b$,true,5),
 ('tester@guestbook.com','activity_club','50000000-0000-4000-8000-000000000001',5,$t$Fixed my whole week$t$,$b$Two mornings a week and I sleep better. Genuinely.$b$,false,16),
 ('business@business.com','activity_club','50000000-0000-4000-8000-000000000003',4,$t$Learned more in one walk than a year of videos$t$,$b$Bring a tripod. They will lend you one but bring one.$b$,false,9),
 ('guest@guestbook.com','activity_club','50000000-0000-4000-8000-000000000003',5,$t$Patient with beginners$t$,$b$Turned up with a phone camera and nobody minded.$b$,false,20),
 ('business@teser.com','activity_club','50000000-0000-4000-8000-000000000002',4,$t$Proper game, no egos$t$,$b$Mixed ability and it works. Pitch floods after rain.$b$,false,7),
 ('admin@gustbook.com','activity_club','50000000-0000-4000-8000-000000000006',5,$t$Twenty minutes that fixes your back$t$,$b$Free, on the front, every morning. No reason not to.$b$,false,4),
 ('radband98@gmail.com','activity_club','50000000-0000-4000-8000-000000000006',4,$t$Good start to the day$t$,$b$Windy but worth it.$b$,false,13),
 ('property@property.com','activity_club','50000000-0000-4000-8000-000000000005',5,$t$Real walks, not a stroll$t$,$b$Twelve miles and a pub at the end. Know what you are signing up for.$b$,true,12),
 ('guestbooker1@gmail.com','activity_club','fe89d56c-20a5-44d6-abfa-fe5e3f1043a6',4,$t$Friendly and well organised$t$,$b$Route was posted in advance, which I appreciated.$b$,false,25),
 ('callum@guest.co.uk','event','40000000-0000-4000-8000-000000000008',5,$t$The whole town turned out$t$,$b$Every window had a lantern in it. Kids loved it, adults loved it more.$b$,true,26),
 ('guest@guestbook.com','event','40000000-0000-4000-8000-000000000007',5,$t$Best hour I have spent on the pier$t$,$b$Got there early for the front rail. Worth it.$b$,false,18),
 ('tester@guestbook.com','event','4d2c001c-eb19-47b8-8758-c3bdf7e9ba02',4,$t$Good turnout, bring cash$t$,$b$Lots on. The card machines were struggling.$b$,false,5),
 ('business@business.com','event','40000000-0000-4000-8000-000000000001',5,$t$Exactly what a summer evening should be$t$,$b$Sound was clean, crowd was friendly, sun did its bit.$b$,true,4),
 ('property@property.com','event','40000000-0000-4000-8000-000000000002',4,$t$Queues, but the food justifies them$t$,$b$Six stalls, all good. The dumpling one is the one.$b$,false,2),
 ('admin@gustbook.com','event','40000000-0000-4000-8000-000000000002',5,$t$Go hungry$t$,$b$Ate from four stalls. Regret nothing.$b$,false,2)
),
eligible as (
  select s.*, p.id as user_id, l.name as tname, nullif(l.img,'') as timg
  from seed s
  join public.profiles p on p.email = s.email
  join listings l on l.t = s.tt and l.id = s.tid::uuid
  where not exists (
    select 1 from public.explorer_reviews r
    where r.user_id = p.id and r.target_type = s.tt and r.target_id = s.tid::uuid
  )
),
rows as (
  select
    ('deadbeef-0002-4000-8000-'||lpad((row_number() over (order by days_ago desc, email))::text,12,'0'))::uuid as id,
    user_id, tt, tid::uuid as tid, tname, timg, rating, title, body, verified,
    now() - (days_ago * interval '1 day') - (random()*interval '10 hours') as created_at
  from eligible
)
insert into public.explorer_reviews
  (id,user_id,target_type,target_id,target_name,target_image_url,rating,title,comment,verified_qr,status,legacy_source,created_at,updated_at)
select id,user_id,tt,tid,tname,timg,rating,title,body,verified,'published','demo-seed',created_at,created_at
from rows
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 4. Review photos
-- ---------------------------------------------------------------------------
--
-- Not every review carries one. A place page where every single review has
-- pictures is a page that has never met a real user.

with target as (
  select r.id, r.user_id, r.created_at, row_number() over (order by r.created_at) as n
  from public.explorer_reviews r where r.legacy_source='demo-seed'
),
shots as (
  select t.id, t.user_id, t.created_at, g.i
  from target t
  cross join lateral generate_series(1, case when t.n % 3 = 0 then 0 when t.n % 4 = 0 then 3 else 2 end) as g(i)
)
insert into public.review_media(id,review_id,user_id,media_type,media_url,thumbnail_url,sort_order,moderation_status,created_at)
select
  ('deadbeef-0003-4000-8000-'||lpad((row_number() over (order by s.id, s.i))::text,12,'0'))::uuid,
  s.id, s.user_id, 'image',
  'https://picsum.photos/seed/xr-'||substr(s.id::text,25,12)||'-'||s.i||'/1200/900',
  'https://picsum.photos/seed/xr-'||substr(s.id::text,25,12)||'-'||s.i||'/400/300',
  s.i-1, 'published', s.created_at
from shots s
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 5. Timestamps
-- ---------------------------------------------------------------------------
--
-- `get_explorer_leaderboard` understands only 'weekly' and 'monthly', and
-- measures from `date_trunc`, not from a rolling window. Seed everything "a few
-- days ago" and the default weekly board is empty for six days out of seven.
-- Spread the reviews so all three views have something in them.

with ordered as (
  select id, row_number() over (order by created_at desc) as n
  from public.explorer_reviews where legacy_source='demo-seed'
),
placed as (
  select id,
    case
      when n <= 16 then now() - ((n * 74) * interval '1 minute')                       -- this week
      when n <= 30 then date_trunc('month',now()) + ((n - 16) * interval '15 hours')   -- this month
      else now() - ((18 + n) * interval '1 day')                                       -- last month
    end as at
  from ordered
)
update public.explorer_reviews r
set created_at = p.at, updated_at = p.at
from placed p where r.id = p.id;

-- ---------------------------------------------------------------------------
-- 6. Moments
-- ---------------------------------------------------------------------------
--
-- Explicitly `visibility='public'`: the column defaults to 'friends', and a
-- Feed seeded with friends-only Moments looks broken rather than private.
-- Every row is backdated more than an hour, which keeps the ten-per-hour rate
-- limit trigger out of the way without disabling it.

with seed(email,tt,tid,caption,hours_ago) as (values
 ('tester@guestbook.com','business','20000000-0000-4000-8000-000000000001',$c$Rain outside, this inside. Fair trade.$c$,6),
 ('callum@guest.co.uk','business','20000000-0000-4000-8000-000000000001',$c$Second one of the morning. No regrets.$c$,30),
 ('guest@guestbook.com','business','20000000-0000-4000-8000-000000000001',$c$Corner table finally free.$c$,54),
 ('guestbooker1@gmail.com','business','20000000-0000-4000-8000-000000000002',$c$Plaice, chips, sea. In that order.$c$,20),
 ('ladnlord@landlord.com','business','20000000-0000-4000-8000-000000000002',$c$Window seat, low sun, good day.$c$,44),
 ('business@business.com','business','20000000-0000-4000-8000-000000000003',$c$Half seven and already can barely hear myself.$c$,12),
 ('property@property.com','business','20000000-0000-4000-8000-000000000003',$c$Stayed for one. Obviously.$c$,36),
 ('business@teser.com','business','20000000-0000-4000-8000-000000000004',$c$Worth the pavement wait, just about.$c$,26),
 ('guest@guestbook.com','business','20000000-0000-4000-8000-000000000005',$c$Went in for nothing, came out with three things.$c$,15),
 ('admin@gustbook.com','business','20000000-0000-4000-8000-000000000005',$c$Everything in here is a present for somebody.$c$,62),
 ('ladnlord@landlord.com','business','20000000-0000-4000-8000-000000000006',$c$Tuesday class. Legs already regret it.$c$,10),
 ('guestbooker1@gmail.com','business','20000000-0000-4000-8000-000000000007',$c$Kids have not looked up in an hour.$c$,8),
 ('radband98@gmail.com','business','20000000-0000-4000-8000-000000000007',$c$High score is going to stand for a while.$c$,50),
 ('property@property.com','business','20000000-0000-4000-8000-000000000008',$c$Sunset from the third pump.$c$,5),
 ('business@teser.com','business','20000000-0000-4000-8000-000000000008',$c$Waited twenty minutes for this. Still worth it.$c$,28),
 ('tester@guestbook.com','business','20000000-0000-4000-8000-000000000009',$c$Todays guest bean, explained at length.$c$,4),
 ('callum@guest.co.uk','business','20000000-0000-4000-8000-000000000009',$c$Working from here until it gets loud.$c$,34),
 ('guest@guestbook.com','business','20000000-0000-4000-8000-000000000010',$c$Six things on the board and I want all of them.$c$,18),
 ('admin@gustbook.com','business','20000000-0000-4000-8000-000000000011',$c$Climbed all the way up for this view.$c$,22),
 ('guestbooker1@gmail.com','business','20000000-0000-4000-8000-000000000011',$c$Terrace. Bring a jumper.$c$,46),
 ('business@business.com','business','20000000-0000-4000-8000-000000000012',$c$Bread stall sold out at five past ten again.$c$,7),
 ('property@property.com','business','20000000-0000-4000-8000-000000000012',$c$Flowers, cheese, done by half nine.$c$,55),
 ('business@teser.com','business','20000000-0000-4000-8000-000000000013',$c$Halfway up the cliff and not looking down.$c$,14),
 ('callum@guest.co.uk','business','20000000-0000-4000-8000-000000000014',$c$Back room, fire lit, phone away.$c$,9),
 ('tester@guestbook.com','activity_club','50000000-0000-4000-8000-000000000001',$c$Six in the morning club. Nobody complained.$c$,32),
 ('guestbooker1@gmail.com','activity_club','50000000-0000-4000-8000-000000000001',$c$Coffee afterwards is the actual reason.$c$,58),
 ('business@business.com','activity_club','50000000-0000-4000-8000-000000000003',$c$Long exposure, wrong tripod, still happy.$c$,25),
 ('guest@guestbook.com','activity_club','50000000-0000-4000-8000-000000000003',$c$Phone camera and nobody said a word.$c$,49),
 ('ladnlord@landlord.com','activity_club','50000000-0000-4000-8000-000000000004',$c$Learning a new game every week now.$c$,16),
 ('property@property.com','activity_club','50000000-0000-4000-8000-000000000005',$c$Twelve miles in. Pub is close.$c$,40),
 ('admin@gustbook.com','activity_club','50000000-0000-4000-8000-000000000006',$c$Twenty minutes on the front. Free. Do it.$c$,3),
 ('callum@guest.co.uk','event','40000000-0000-4000-8000-000000000008',$c$Every single window had one.$c$,64),
 ('guest@guestbook.com','event','40000000-0000-4000-8000-000000000007',$c$Front rail, worth getting there early.$c$,42),
 ('business@business.com','event','40000000-0000-4000-8000-000000000001',$c$Sun did exactly what it was supposed to.$c$,11),
 ('property@property.com','event','40000000-0000-4000-8000-000000000002',$c$Dumpling stall. That is the tip.$c$,2),
 ('admin@gustbook.com','event','40000000-0000-4000-8000-000000000002',$c$Four stalls deep and still going.$c$,2),
 ('tester@guestbook.com','property','30000000-0000-4000-8000-000000000006',$c$No signal up here and that is the point.$c$,38),
 ('guestbooker1@gmail.com','property','30000000-0000-4000-8000-000000000003',$c$Garden in the morning. Bus in the afternoon.$c$,60)
),
rows as (
  select
    ('deadbeef-0004-4000-8000-'||lpad((row_number() over (order by s.hours_ago desc, s.email))::text,12,'0'))::uuid as id,
    p.id as user_id, s.tt, s.tid::uuid as tid, s.caption,
    now() - (s.hours_ago * interval '1 hour') as created_at
  from seed s join public.profiles p on p.email = s.email
)
insert into public.explorer_moments
  (id,user_id,caption,media_type,media_url,thumbnail_url,target_type,target_id,status,visibility,actor_type,actor_id,created_at,updated_at)
select
  id, user_id, caption, 'image',
  'https://picsum.photos/seed/xm-'||substr(id::text,25,12)||'/1200/1500',
  'https://picsum.photos/seed/xm-'||substr(id::text,25,12)||'/400/500',
  tt, tid, 'published', 'public', 'explorer', user_id, created_at, created_at
from rows
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 7. Likes, comments and saves
-- ---------------------------------------------------------------------------
--
-- Thinned by hashing the pair rather than by random(), so re-running picks the
-- same rows instead of adding a second, denser layer on top of the first.

with people as (
  select id from public.profiles where email not ilike '%@test.com'
),
pairs as (
  select 'moment'::text as tt, m.id as tid, p.id as uid, m.created_at as base
  from public.explorer_moments m join people p on p.id <> m.user_id
  where m.id::text like 'deadbeef-0004%' and m.status='published'
  union all
  select 'review', r.id, p.id, r.created_at
  from public.explorer_reviews r join people p on p.id <> r.user_id
  where r.legacy_source='demo-seed' and r.status='published'
),
picked as (
  select *, row_number() over (order by tid, uid) as n from pairs
  where ('x'||substr(md5(tid::text||uid::text),1,8))::bit(32)::bigint % 100 < 38
)
insert into public.social_likes(id,user_id,target_type,target_id,created_at)
select ('deadbeef-0005-4000-8000-'||lpad(n::text,12,'0'))::uuid, uid, tt, tid,
       base + (random()*interval '20 hours')
from picked
where base + interval '20 hours' < now()
on conflict (user_id,target_type,target_id) do nothing;

-- A like must not predate the thing it is on.
update public.social_likes l
set created_at = least(now(), r.created_at + (interval '1 hour' * (1 + (('x'||substr(md5(l.id::text),1,8))::bit(32)::bigint % 18))))
from public.explorer_reviews r
where l.target_type='review' and l.target_id=r.id and l.id::text like 'deadbeef-0005%'
  and l.created_at < r.created_at;

with lines(i,body) as (values
 (0,$c$Right, adding this to the list.$c$),
 (1,$c$Been meaning to go for months.$c$),
 (2,$c$That view never gets old.$c$),
 (3,$c$Which one did you get?$c$),
 (4,$c$We were there about an hour after this.$c$),
 (5,$c$Going Saturday if anyone else fancies it.$c$),
 (6,$c$This is the exact table I always try for.$c$),
 (7,$c$Good shout, thanks for posting.$c$),
 (8,$c$Did not know this was even open again.$c$),
 (9,$c$Every time I walk past it is full.$c$),
 (10,$c$Ha, we must have just missed each other.$c$),
 (11,$c$How busy was it?$c$),
 (12,$c$Genuinely the best one round here.$c$),
 (13,$c$Bookmarked. Cheers.$c$),
 (14,$c$That light is unreal.$c$),
 (15,$c$Taking the kids at the weekend now.$c$)
),
people as (select id from public.profiles where email not ilike '%@test.com'),
pairs as (
  select m.id as tid, p.id as uid, m.created_at as base,
         ('x'||substr(md5(m.id::text||p.id::text),1,8))::bit(32)::bigint as h
  from public.explorer_moments m join people p on p.id <> m.user_id
  where m.id::text like 'deadbeef-0004%' and m.status='published'
),
picked as (
  select tid, uid, base, h, row_number() over (order by tid, uid) as n
  from pairs where h % 100 < 16
)
insert into public.social_comments(id,user_id,target_type,target_id,body,status,created_at)
select ('deadbeef-0006-4000-8000-'||lpad(k.n::text,12,'0'))::uuid, k.uid, 'moment', k.tid,
       l.body, 'published', k.base + (random()*interval '16 hours')
from picked k join lines l on l.i = (k.h % 16)
where k.base + interval '16 hours' < now()
on conflict (id) do nothing;

with people as (select id from public.profiles where email not ilike '%@test.com'),
listings as (
  select 'business'::text as t, id, name, coalesce(nullif(image,''),'') as img from public.businesses where id::text like '20000000%'
  union all select 'property', id, name, coalesce(photos[1],'') from public.properties where id::text like '30000000%'
  union all select 'activity_club', id, name, coalesce(nullif(image_url,''),'') from public.activity_clubs where status in ('open','full')
  union all select 'event', id, name, coalesce(nullif(image_url,''),'') from public.events where status='published'
),
picked as (
  select l.t, l.id as tid, l.name, nullif(l.img,'') as img, p.id as uid,
         row_number() over (order by l.id, p.id) as n
  from listings l cross join people p
  where ('x'||substr(md5('fav'||l.id::text||p.id::text),1,8))::bit(32)::bigint % 100 < 22
)
insert into public.explorer_favourites(id,user_id,target_type,target_id,target_name,target_image_url,sort_order,is_public,created_at)
select ('deadbeef-0007-4000-8000-'||lpad(n::text,12,'0'))::uuid, uid, t, tid, name, img, 0, true,
       now() - (random()*interval '40 days')
from picked
on conflict (user_id,target_type,target_id) do nothing;

-- ---------------------------------------------------------------------------
-- 8. Live check-ins
-- ---------------------------------------------------------------------------
--
-- These are the shortest-lived rows here: `live_checkins_one_active_per_user`
-- allows one each, and each expires within four hours. Re-run this section when
-- you want the map lit up again.
--
-- Coordinates are rounded to three decimal places, the same coarsening the app
-- applies before storing. `visibility='public'` is a demo choice so they reach
-- the map -- it is NOT the product default, which is Followers.

with seed(email,tid,activity,message,mins_left) as (values
 ('tester@guestbook.com','20000000-0000-4000-8000-000000000009',$a$Working from the window$a$,$m$Here till about two if anyone is passing.$m$,95),
 ('callum@guest.co.uk','20000000-0000-4000-8000-000000000001',$a$Coffee and a read$a$,$m$Corner table, no rush.$m$,140),
 ('guest@guestbook.com','20000000-0000-4000-8000-000000000005',$a$Present shopping$a$,$m$$m$,60),
 ('guestbooker1@gmail.com','20000000-0000-4000-8000-000000000007',$a$Arcade with the kids$a$,$m$Two hours of this ahead of me.$m$,175),
 ('business@business.com','20000000-0000-4000-8000-000000000003',$a$Early one$a$,$m$Before it gets loud.$m$,110),
 ('property@property.com','20000000-0000-4000-8000-000000000008',$a$Waiting on the sunset$a$,$m$Outside table, west facing.$m$,205),
 ('business@teser.com','20000000-0000-4000-8000-000000000002',$a$Lunch$a$,$m$$m$,45),
 ('ladnlord@landlord.com','20000000-0000-4000-8000-000000000014',$a$In the back room$a$,$m$Fire is lit.$m$,150)
)
insert into public.live_checkins
  (id,user_id,place_type,target_id,place_name,area,latitude,longitude,activity,message,visibility,status,expires_at,created_at)
select
  ('deadbeef-0008-4000-8000-'||lpad((row_number() over (order by s.email))::text,12,'0'))::uuid,
  p.id,'business',b.id,b.name,
  case when b.longitude < 0 then 'Brighton' else 'Hastings' end,
  round(b.latitude::numeric,3)::float8, round(b.longitude::numeric,3)::float8,
  s.activity, s.message, 'public', 'active',
  now() + (s.mins_left * interval '1 minute'),
  now() + (s.mins_left * interval '1 minute') - interval '4 hours'
from seed s
join public.profiles p on p.email = s.email
join public.businesses b on b.id = s.tid::uuid
where not exists (select 1 from public.live_checkins c where c.user_id=p.id and c.status='active')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 9. Link-ups
-- ---------------------------------------------------------------------------

with seed(n,email,title,descr,cat,area,loc,lat,lng,starts_in_hours,dur_hours,maxa) as (values
 (1,'callum@guest.co.uk',$t$Sunday morning coffee walk$t$,$d$Easy loop along the front then coffee at the end. All paces, no drop.$d$,'Walking','Hastings','Old Town Coffee Works',50.857,0.591,20,3,12),
 (2,'tester@guestbook.com',$t$Quiz night, need two more$t$,$d$Team of four wants six. No specialist knowledge required, only enthusiasm.$d$,'Social','Hastings','Lantern Lane Bar',50.857,0.590,32,3,6),
 (3,'guest@guestbook.com',$t$Beach swim before work$t$,$d$In at seven, out at ten past, coffee by half past. Bring a towel you do not mind losing.$d$,'Outdoors','Brighton','Brighton beach, near the pier',50.816,-0.136,44,2,10),
 (4,'guestbooker1@gmail.com',$t$Five a side, two short$t$,$d$Booked the pitch already. Mixed ability, we just want to make up numbers.$d$,'Sport','Hastings','Hastings seafront pitches',50.855,0.577,60,2,10),
 (5,'business@business.com',$t$Photo walk at golden hour$t$,$d$Heading east along the cliffs for the last hour of light. Any camera, phones welcome.$d$,'Photography','Hastings','East Hill lift, bottom entrance',50.861,0.603,72,3,8),
 (6,'property@property.com',$t$Street food night, table for six$t$,$d$Got a table booked and only four of us. Come and eat things.$d$,'Food & Drink','Hastings','Old Town, by the fish huts',50.855,0.594,90,3,6),
 (7,'ladnlord@landlord.com',$t$Board games, beginners very welcome$t$,$d$We will teach you whatever you fancy playing. No experience needed at all.$d$,'Games','Brighton','North Laine Social, back room',50.827,-0.139,110,4,10),
 (8,'business@teser.com',$t$Market run then breakfast$t$,$d$Doing the market at nine then breakfast after. Bring a bag and some cash.$d$,'Social','Hastings','Pelham Street Market entrance',50.855,0.577,130,3,8)
)
insert into public.linkups
  (id,creator_id,title,description,category,starts_at,ends_at,area,location_name,latitude,longitude,max_attendees,attendee_count,visibility,status,created_at,updated_at)
select
  ('deadbeef-0009-4000-8000-'||lpad(s.n::text,12,'0'))::uuid,
  p.id, s.title, s.descr, s.cat,
  now() + (s.starts_in_hours * interval '1 hour'),
  now() + ((s.starts_in_hours + s.dur_hours) * interval '1 hour'),
  s.area, s.loc, s.lat, s.lng, s.maxa, 1, 'public', 'upcoming',
  now() - (s.n * interval '7 hours'), now() - (s.n * interval '7 hours')
from seed s join public.profiles p on p.email = s.email
on conflict (id) do nothing;

-- The creator's own attendance. `role` is 'creator'/'member' and `status` is
-- 'joined'/'left'/'removed' -- not 'host'/'going', which the check rejects.
insert into public.linkup_attendees(id,linkup_id,user_id,role,status,joined_at,updated_at)
select ('deadbeef-000a-4000-8000-'||lpad((row_number() over (order by l.id))::text,12,'0'))::uuid,
       l.id, l.creator_id, 'creator', 'joined', l.created_at, l.created_at
from public.linkups l where l.id::text like 'deadbeef-0009%'
on conflict (linkup_id,user_id) do nothing;

with people as (select id from public.profiles where email not ilike '%@test.com'),
cand as (
  select l.id as lid, p.id as uid, l.created_at, l.max_attendees,
         row_number() over (partition by l.id order by md5(l.id::text||p.id::text)) as pick
  from public.linkups l cross join people p
  where l.id::text like 'deadbeef-0009%' and p.id <> l.creator_id
),
chosen as (
  select *, row_number() over (order by lid, pick) as n from cand
  where pick <= (1 + (('x'||substr(md5(lid::text),1,8))::bit(32)::bigint % 4))
    and pick <= max_attendees - 1
)
insert into public.linkup_attendees(id,linkup_id,user_id,role,status,joined_at,updated_at)
select ('deadbeef-000b-4000-8000-'||lpad(n::text,12,'0'))::uuid, lid, uid, 'member', 'joined',
       created_at + (random()*interval '6 hours'), created_at
from chosen
on conflict (linkup_id,user_id) do nothing;

-- `attendee_count` is maintained by the join/leave RPCs, not by a trigger, so
-- it has to be brought back in step after writing attendees directly.
update public.linkups l
set attendee_count = greatest(1, (select count(*) from public.linkup_attendees a where a.linkup_id=l.id and a.status='joined'))
where l.id::text like 'deadbeef-0009%';

-- ---------------------------------------------------------------------------
-- 10. Memories
-- ---------------------------------------------------------------------------
--
-- Private, with no live period, which is what the archive defaults to and what
-- My Map is: the owner's alone. Eight sit on the owner's account so that map
-- has something on it.

with seed(n,email,tt,tid,title,note,days_ago) as (values
 (1,'hmpchelsea@gmail.com','business','20000000-0000-4000-8000-000000000009',$t$First proper coffee here$t$,$n$Rained the whole way there. Stayed two hours.$n$,34),
 (2,'hmpchelsea@gmail.com','business','20000000-0000-4000-8000-000000000010',$t$Birthday dinner$t$,$n$The whole table ordered the same thing and nobody minded.$n$,27),
 (3,'hmpchelsea@gmail.com','activity_club','50000000-0000-4000-8000-000000000005',$t$Longest walk so far$t$,$n$Twelve miles. Legs gone. Would do again.$n$,21),
 (4,'hmpchelsea@gmail.com','event','40000000-0000-4000-8000-000000000008',$t$Lantern trail$t$,$n$Whole town lit up. Best night of the summer.$n$,26),
 (5,'hmpchelsea@gmail.com','business','20000000-0000-4000-8000-000000000013',$t$Up the East Hill$t$,$n$Did not look down once.$n$,15),
 (6,'hmpchelsea@gmail.com','property','30000000-0000-4000-8000-000000000004',$t$Courtyard breakfast$t$,$n$Three mornings out there with proper coffee.$n$,11),
 (7,'hmpchelsea@gmail.com','business','20000000-0000-4000-8000-000000000002',$t$That window table$t$,$n$Waited forty minutes and it was worth every one.$n$,7),
 (8,'hmpchelsea@gmail.com','business','20000000-0000-4000-8000-000000000014',$t$Back room, fire lit$t$,$n$Phone stayed in the pocket all evening.$n$,3),
 (9,'radband98@gmail.com','activity_club','50000000-0000-4000-8000-000000000006',$t$Started the stretch club$t$,$n$Freezing. Went back the next day anyway.$n$,19),
 (10,'radband98@gmail.com','business','20000000-0000-4000-8000-000000000006',$t$Tuesday class$t$,$n$Could not walk down the stairs after.$n$,12),
 (11,'radband98@gmail.com','business','20000000-0000-4000-8000-000000000007',$t$High score$t$,$n$Still standing as far as I know.$n$,5),
 (12,'callum@guest.co.uk','business','20000000-0000-4000-8000-000000000001',$t$Saturday morning spot$t$,$n$Corner table, paper, no rush.$n$,9),
 (13,'callum@guest.co.uk','business','20000000-0000-4000-8000-000000000010',$t$Sent everyone here$t$,$n$Four separate people have thanked me.$n$,17),
 (14,'tester@guestbook.com','activity_club','50000000-0000-4000-8000-000000000001',$t$First sunrise run$t$,$n$Six in the morning and somehow cheerful.$n$,22),
 (15,'guest@guestbook.com','property','30000000-0000-4000-8000-000000000001',$t$The loft$t$,$n$Steep stairs, loud street, perfect anyway.$n$,20)
)
insert into public.explorer_memories
  (id,user_id,title,note,media_type,media_url,thumbnail_url,target_type,target_id,visibility,live_until,archive_visibility,show_on_profile,status,created_at,updated_at)
select
  ('deadbeef-000c-4000-8000-'||lpad(s.n::text,12,'0'))::uuid,
  p.id, s.title, s.note, 'image',
  'https://picsum.photos/seed/xmem-'||s.n||'/1200/900',
  'https://picsum.photos/seed/xmem-'||s.n||'/400/300',
  s.tt, s.tid::uuid, 'private', null, 'private', true, 'published',
  now() - (s.days_ago * interval '1 day'), now() - (s.days_ago * interval '1 day')
from seed s join public.profiles p on p.email = s.email
on conflict (id) do nothing;

commit;

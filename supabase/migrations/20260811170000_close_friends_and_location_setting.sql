-- Packet 8 -- one setting decides who can see where you are, and it starts at
-- nobody.
--
-- WHAT EXISTS TODAY
--
-- No location setting at all. profiles carries area, show_area and
-- leaderboard_opt_in and nothing else. Who can see a check-in is decided
-- per check-in, at the moment you make one, and the only choices are Public
-- and Friends. There is no way to say "never" other than never checking in,
-- and no way to say "only these few people".
--
-- WHAT THIS BUILDS
--
--   profiles.location_sharing   'nobody' (default) | 'friends' | 'close_friends'
--   public.close_friends        a hand-picked list, one-way, private to its owner
--
-- The setting is a CEILING, not another choice alongside the per-check-in one.
-- Whatever a check-in says, the setting can only narrow it:
--
--   nobody         -> only you, whatever the check-in says
--   friends        -> people you both follow
--   close_friends  -> only the people on your list
--
-- HOW THIS RESOLVES A CONTRADICTION IN THE RULES
--
-- RULES.md defines a check-in as "a public, opt-in presence at a park". The
-- target model says location starts at nobody. Both cannot hold, and this
-- migration makes the setting win: with no setting value above 'friends',
-- a Public check-in can never reach further than friends, so the Public option
-- is a control that does nothing and is removed from the screen in the same
-- packet. RULES.md needs its definition changed to match.
--
-- WHAT THIS EXPOSES: nothing new, and much less than before. Every existing
-- Explorer lands on 'nobody', so every existing check-in becomes invisible to
-- everybody except its author the moment this runs. That is the fail-closed
-- direction, and it is deliberate -- an opt-in default that arrives switched on
-- for people who never chose it is not opt-in.
--
-- WHY close_friends IS ONE-WAY AND PRIVATE
--
-- Being on somebody's close friends list says nothing about what they are on
-- yours, and nobody is told they are on one. A list you can read is a ranking
-- of your friendships, which is a different and worse product. The RLS policies
-- below let an owner read and write only their own rows; the visibility
-- predicate reads it through a SECURITY DEFINER function so it can answer
-- "may this person see me" without ever handing the list over.
--
-- TO UNDO
--   drop table if exists public.close_friends;
--   alter table public.profiles drop column if exists location_sharing;
--   (restore live_checkins_select_visible and get_live_discovery from
--   20260811160000_friends_mean_friends.sql.)

begin;

-- ---------------------------------------------------------------------------
-- 1. The setting
-- ---------------------------------------------------------------------------
-- Default 'nobody', and existing rows get 'nobody' too. RULES.md: "Default
-- every visibility flag to off/hidden. Opt-in is never the fallback branch of
-- an if-statement."

alter table public.profiles
  add column if not exists location_sharing text not null default 'nobody';

alter table public.profiles
  drop constraint if exists profiles_location_sharing_check;
alter table public.profiles
  add constraint profiles_location_sharing_check
  check (location_sharing in ('nobody','friends','close_friends'));

comment on column public.profiles.location_sharing is
  'Ceiling on who may see this Explorer''s live position. Never widened by anything else -- a check-in''s own visibility can only narrow it further. Defaults to nobody.';

-- Writable by its owner, like the other profile preferences. Added to the
-- column grant rather than replacing it: account_type and is_admin stay out,
-- for the reasons given in 20260811130000 and 20260805132127.
grant update (location_sharing) on public.profiles to authenticated;
grant insert (location_sharing) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 2. The list
-- ---------------------------------------------------------------------------

create table if not exists public.close_friends(
  owner_id uuid not null references auth.users(id) on delete cascade,
  friend_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id,friend_id),
  constraint close_friends_not_self check (owner_id <> friend_id)
);

create index if not exists close_friends_owner_idx on public.close_friends(owner_id);

comment on table public.close_friends is
  'A hand-picked subset of an Explorer''s friends. One-way and private: being on somebody''s list says nothing about your own, and nobody is told they are on one.';

alter table public.close_friends enable row level security;

-- Only ever your own rows, read and write. There is deliberately no policy
-- letting anybody see who has added them.
drop policy if exists close_friends_owner_read on public.close_friends;
create policy close_friends_owner_read on public.close_friends
  for select to authenticated using (owner_id = (select auth.uid()));

drop policy if exists close_friends_owner_write on public.close_friends;
create policy close_friends_owner_write on public.close_friends
  for insert to authenticated with check (
    owner_id = (select auth.uid())
    -- Only an actual friend can be a close friend. Without this the list would
    -- be a way to grant yourself a channel to somebody who has not followed
    -- you back.
    and guestbook_private.are_friends(owner_id,friend_id)
  );

drop policy if exists close_friends_owner_delete on public.close_friends;
create policy close_friends_owner_delete on public.close_friends
  for delete to authenticated using (owner_id = (select auth.uid()));

revoke all on public.close_friends from anon, authenticated;
grant select, insert, delete on public.close_friends to authenticated;

-- ---------------------------------------------------------------------------
-- 3. One predicate, used everywhere
-- ---------------------------------------------------------------------------
-- The whole point of this packet is that there is one answer to "may this
-- person see where I am". Packet 7 had to fix the same rule in three places
-- because it had been copied; this is written once and called.
--
-- SECURITY DEFINER so it can read close_friends -- which the viewer must never
-- be able to read directly -- without exposing a single row of it. It returns
-- a boolean and nothing else.

create or replace function guestbook_private.can_see_location(p_owner uuid,p_viewer uuid)
returns boolean
language sql
stable
security definer
set search_path='public','pg_temp'
as $$
  select case
    when p_owner is null or p_viewer is null then false
    when p_owner = p_viewer then true
    else (
      select case coalesce(pr.location_sharing,'nobody')
        when 'friends' then guestbook_private.are_friends(p_owner,p_viewer)
        when 'close_friends' then exists(
          select 1 from public.close_friends cf
          where cf.owner_id = p_owner and cf.friend_id = p_viewer
        )
        else false
      end
      from public.profiles pr where pr.id = p_owner
    )
  end;
$$;

comment on function guestbook_private.can_see_location(uuid,uuid) is
  'The only answer to "may this Explorer see where that one is". Reads close_friends on the caller''s behalf without exposing it, and returns false for anybody whose setting is nobody -- which is everybody by default.';

revoke all on function guestbook_private.can_see_location(uuid,uuid) from public, anon;
grant execute on function guestbook_private.can_see_location(uuid,uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. The two surfaces that show a position
-- ---------------------------------------------------------------------------
-- The setting is the ceiling, so it replaces the friends test rather than
-- sitting beside it. A 'public' check-in no longer reaches past the setting --
-- that is the resolution of the RULES.md contradiction noted at the top.

drop policy if exists live_checkins_select_visible on public.live_checkins;
create policy live_checkins_select_visible on public.live_checkins for select to authenticated using(
  user_id=(select auth.uid()) or (
    status='active' and expires_at>now()
    and not private.linkup_users_blocked(user_id,(select auth.uid()))
    and guestbook_private.can_see_location(user_id,(select auth.uid()))
  )
);

-- Live Nearby reads through this security-invoker function rather than through
-- the policy above, so it carries its own copy of the rule and must be changed
-- with it. Packet 7 is the reason this is not forgotten: the same function was
-- the third of three copies, and the one that would have kept showing what the
-- table refused.

create or replace function public.get_live_discovery(
  p_area text default null,p_latitude double precision default null,p_longitude double precision default null,
  p_radius_km numeric default 25,p_window_hours integer default 24
) returns table(
  item_type text,item_id uuid,title text,subtitle text,area text,starts_at timestamptz,ends_at timestamptz,
  latitude double precision,longitude double precision,distance_km numeric,status text,image_url text,deep_link text,action_label text
)
language plpgsql stable security invoker set search_path=public,private as $$
declare v_user uuid:=auth.uid();
begin
  if v_user is null or not private.linkup_user_is_explorer(v_user) then raise exception 'Explorer account required.'; end if;
  return query
  with items(item_type,item_id,title,subtitle,area,starts_at,ends_at,latitude,longitude,distance_km,status,image_url,deep_link,action_label) as (
    select 'linkup'::text,l.id,l.title,(l.category||' · '||l.attendee_count||'/'||l.max_attendees||' joined')::text,l.area,l.starts_at,l.ends_at,l.latitude,l.longitude,
      public.live_distance_km(p_latitude,p_longitude,l.latitude,l.longitude),l.status,null::text,('/linkups/'||l.id)::text,'View Link-up'::text
    from public.linkups l where private.can_view_linkup(l.id,v_user)
      and l.starts_at<=now()+make_interval(hours=>greatest(1,least(p_window_hours,168))) and l.ends_at>now()
    union all
    select 'checkin',c.id,(coalesce(p.full_name,'Explorer')||' is here')::text,
      (c.activity||case when c.message='' then '' else ' · '||c.message end)::text,c.area,c.created_at,c.expires_at,c.latitude,c.longitude,
      public.live_distance_km(p_latitude,p_longitude,c.latitude,c.longitude),c.status,p.profile_photo,('/profile/'||c.user_id)::text,'View Explorer'::text
    from public.live_checkins c join public.profiles p on p.id=c.user_id
    where c.status='active' and c.expires_at>now() and c.user_id<>v_user and not private.linkup_users_blocked(c.user_id,v_user)
      and guestbook_private.can_see_location(c.user_id,v_user)
    union all
    select 'event',e.id,e.name,(e.category||' · '||e.location)::text,e.location,e.starts_at,e.ends_at,e.latitude,e.longitude,
      public.live_distance_km(p_latitude,p_longitude,e.latitude,e.longitude),e.status,e.image_url,('/events/'||e.id)::text,'View Event'::text
    from public.events e where e.status='published' and e.starts_at<=now()+make_interval(hours=>greatest(1,least(p_window_hours,168)))
      and coalesce(e.ends_at,e.starts_at+interval '3 hours')>now()
    union all
    select 'activity',s.id,(c.name||': '||s.title)::text,'Activity happening now or soon'::text,c.location,s.starts_at,s.ends_at,c.latitude,c.longitude,
      public.live_distance_km(p_latitude,p_longitude,c.latitude,c.longitude),c.status,c.image_url,('/activity-clubs/'||c.id)::text,'View Club'::text
    from public.activity_sessions s join public.activity_clubs c on c.id=s.club_id
    where c.status in ('open','full') and s.starts_at<=now()+make_interval(hours=>least(greatest(p_window_hours,1),24)) and s.ends_at>now()
    union all
    select 'place',b.id,b.name,(coalesce(b.category,'Local place')||' · '||coalesce(b.rating,0)||'★')::text,coalesce(b.address,''),
      null::timestamptz,null::timestamptz,b.latitude,b.longitude,
      public.live_distance_km(p_latitude,p_longitude,b.latitude,b.longitude),'popular',coalesce(b.image,b.photos[1]),('/business/'||b.id)::text,'View Place'::text
    from public.businesses b where coalesce(b.review_count,0)>0
  )
  select i.item_type,i.item_id,i.title,i.subtitle,i.area,i.starts_at,i.ends_at,i.latitude,i.longitude,i.distance_km,i.status,i.image_url,i.deep_link,i.action_label
  from items i
  where (p_area is null or btrim(p_area)='' or lower(i.area) like '%'||lower(btrim(p_area))||'%')
    and (p_latitude is null or p_longitude is null or i.distance_km is null or i.distance_km<=greatest(1,least(p_radius_km,100)))
  order by case i.item_type when 'linkup' then 1 when 'checkin' then 2 when 'event' then 3 when 'activity' then 4 else 5 end,
    i.starts_at nulls last,i.distance_km nulls last
  limit 100;
end;
$$;

revoke all on function public.get_live_discovery(text,double precision,double precision,numeric,integer) from public,anon;
grant execute on function public.get_live_discovery(text,double precision,double precision,numeric,integer) to authenticated;

commit;

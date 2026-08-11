-- One visibility setting for the whole app, and Everyone is one of the answers.
--
-- WHAT THIS REPLACES
--
-- 20260811170000 added profiles.location_sharing with three answers -- nobody,
-- friends, close_friends -- and named it after check-ins because check-ins were
-- what it governed. Two things were wrong with that.
--
-- First the name. This is not a location setting. It is the answer to "who can
-- see what I share", and it should govern presence, posts and anything else
-- that has an audience. A column called location_sharing invites a second
-- column called moment_sharing next to it, and then there is no single answer
-- any more -- which is the exact failure this app has already had twice, with
-- the follow test copied into three places and the review tables copied into
-- four.
--
-- Second the missing answer. There was no way to say "everyone". That made a
-- Public check-in a control that could not do anything, so the button was
-- removed -- which was the right call given a three-value setting, and the
-- wrong shape overall. Everyone belongs in the list.
--
-- WHAT IT BECOMES
--
--   profiles.visibility   'nobody' | 'friends' | 'close_friends' | 'everyone'
--
-- Renamed rather than added beside, so there is never a moment where two
-- columns both claim to answer the question. Every existing value carries over
-- untouched: nobody stays nobody, friends stays friends.
--
-- THE DEFAULT DOES NOT CHANGE. It is still 'nobody'. Adding 'everyone' as an
-- option is not the same as making it the default, and switching people to a
-- wider audience than the one they are on is not a rename -- it is a decision
-- about other people's privacy, and it is not this migration's to take.
--
-- WHAT STILL ONLY COVERS PRESENCE
--
-- can_see_explorer is called by the two surfaces that show where somebody is:
-- the check-in policy and the Live Nearby feed. Moments and Memories have their
-- own per-post visibility and are mid-rework, so they are deliberately not
-- wired to this yet -- pointing them at a setting whose model is about to
-- change would be building on top of a decision that has not been made.
--
-- TO UNDO
--   alter table public.profiles rename column visibility to location_sharing;
--   (restore the three-value constraint and can_see_location from
--   20260811170000_close_friends_and_location_setting.sql.)

begin;

-- ---------------------------------------------------------------------------
-- 1. One column, named for what it decides
-- ---------------------------------------------------------------------------

alter table public.profiles
  rename column location_sharing to visibility;

alter table public.profiles
  drop constraint if exists profiles_location_sharing_check;
alter table public.profiles
  drop constraint if exists profiles_visibility_check;
alter table public.profiles
  add constraint profiles_visibility_check
  check (visibility in ('nobody','friends','close_friends','everyone'));

comment on column public.profiles.visibility is
  'Who can see what this Explorer shares -- nobody, friends, close friends, or everyone. One setting for the whole app rather than one per feature. Defaults to nobody; adding ''everyone'' as an option did not change that.';

-- The rename carries the grants with it, so nothing needs re-granting. Named
-- here so the next reader does not go looking.

-- ---------------------------------------------------------------------------
-- 2. One predicate, named for what it answers
-- ---------------------------------------------------------------------------
-- can_see_location becomes can_see_explorer for the same reason the column was
-- renamed: it answers "may this person see what that one shares", and it is
-- about to be asked by more than one kind of thing.
--
-- 'everyone' still means every signed-in Explorer, not the public internet.
-- Anonymous visitors reach none of this: the function is revoked from anon, and
-- the policies that call it are scoped to authenticated. Somebody choosing
-- Everyone is choosing to be visible inside the app, which is what the word
-- means on the screen they chose it on.

create or replace function guestbook_private.can_see_explorer(p_owner uuid,p_viewer uuid)
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
      select case coalesce(pr.visibility,'nobody')
        when 'everyone' then true
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

comment on function guestbook_private.can_see_explorer(uuid,uuid) is
  'The only answer to "may this Explorer see what that one shares". Reads close_friends on the caller''s behalf without exposing it, and falls through to false for anything unrecognised.';

revoke all on function guestbook_private.can_see_explorer(uuid,uuid) from public, anon;
grant execute on function guestbook_private.can_see_explorer(uuid,uuid) to authenticated;

-- The old name goes, rather than being left as a second way to ask. Dropped
-- after the two callers below are repointed, so there is no window where a
-- policy references a function that does not exist.

-- ---------------------------------------------------------------------------
-- 3. The two surfaces that show where somebody is
-- ---------------------------------------------------------------------------

drop policy if exists live_checkins_select_visible on public.live_checkins;
create policy live_checkins_select_visible on public.live_checkins for select to authenticated using(
  user_id=(select auth.uid()) or (
    status='active' and expires_at>now()
    and not private.linkup_users_blocked(user_id,(select auth.uid()))
    and guestbook_private.can_see_explorer(user_id,(select auth.uid()))
  )
);

-- Live Nearby carries its own copy of the rule because it is a
-- security-invoker function rather than a policy, so it changes with it. This
-- is the third time that has been true in three packets; it is why the gate
-- checks all three surfaces rather than trusting the migration.

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
      and guestbook_private.can_see_explorer(c.user_id,v_user)
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

drop function if exists guestbook_private.can_see_location(uuid,uuid);

commit;

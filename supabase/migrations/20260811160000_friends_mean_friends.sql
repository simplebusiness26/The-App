-- Packet 7 -- "followers only" starts meaning friends.
--
-- WHAT THIS CHANGES, IN PLAIN TERMS
--
-- Before: if you set a check-in or a Link-up to "followers", anybody who
-- followed you could see it -- including somebody you had never followed back,
-- and somebody who followed you purely to watch where you go. Following is
-- one-way and needs no permission, so "followers only" was, in practice,
-- "anybody who chose to".
--
-- After: both people have to follow each other. That is what Friend already
-- means everywhere else in this app -- guestbook_private.are_friends
-- (20260805120300:142) has gated Moments, the feed and Memories since it was
-- written. Presence, the most sensitive thing here, was the one surface still
-- on the weaker test.
--
-- WHAT IT EXPOSES: strictly less than before. Nobody can see anything they
-- could not see yesterday. Some people lose sight of check-ins they could
-- previously see, which is the point.
--
-- THREE PLACES, because the one-way test was copied rather than shared:
--
--   private.can_view_linkup                (20260802211800:36)
--   live_checkins_select_visible policy    (:67)
--   public.get_live_discovery              (:224)
--
-- The third is the one that matters most and is easiest to miss: the policy
-- protects the table, but Live Nearby reads through a security-invoker function
-- with its own copy of the rule. Fixing two of three would have left the feed
-- showing what the table refused.
--
-- NOT CHANGED: 'public' still means public. Somebody who deliberately chose
-- Public is not silently narrowed to friends -- that would be deciding for
-- them, in the opposite direction.
--
-- TO UNDO
--   restore the three predicates from 20260802211800:36, :67 and :224.

begin;

create or replace function private.can_view_linkup(p_linkup_id uuid,p_user_id uuid)
returns boolean language plpgsql stable security definer set search_path=public,private as $$
declare v_linkup public.linkups%rowtype;
begin
  if p_user_id is null then return false; end if;
  select * into v_linkup from public.linkups where id=p_linkup_id;
  if not found then return false; end if;
  if private.linkup_users_blocked(v_linkup.creator_id,p_user_id) then return false; end if;
  if v_linkup.creator_id=p_user_id or private.is_active_linkup_member(p_linkup_id,p_user_id) then return true; end if;
  if v_linkup.status not in ('upcoming','full') or v_linkup.ends_at<=now() then return false; end if;
  if v_linkup.visibility='public' then return true; end if;
  -- Friends, not followers. This used to be a one-way test: anybody who
  -- followed the creator could read a followers-only Link-up, whether or not
  -- the creator followed them back. are_friends requires both directions, which
  -- is what "Friend" has meant everywhere else in this app since
  -- 20260805120300 -- Moments, the feed and Memories all used it already.
  -- Presence was the one thing left on the weaker test.
  return guestbook_private.are_friends(v_linkup.creator_id,p_user_id);
end;
$$;

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
      and (c.visibility='public' or guestbook_private.are_friends(c.user_id,v_user))
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

-- The check-in policy, with the same substitution.
drop policy if exists live_checkins_select_visible on public.live_checkins;
create policy live_checkins_select_visible on public.live_checkins for select to authenticated using(
  user_id=(select auth.uid()) or (
    status='active' and expires_at>now()
    and not private.linkup_users_blocked(user_id,(select auth.uid()))
    and (visibility='public' or guestbook_private.are_friends(user_id,(select auth.uid())))
  )
);

-- are_friends lives in guestbook_private and is granted to authenticated only
-- (20260805120300:154-155). The check-in policy runs as the caller, so that
-- grant is what makes it callable here; anon has no grant and no policy.

commit;

-- ---------------------------------------------------------------------------
-- Telling both people they are now friends
-- ---------------------------------------------------------------------------
-- Following is one-way and silent, so becoming friends currently happens with
-- no signal at all: the second follow just makes more of somebody's life
-- visible to you, and nobody is told. That matters more now than it did an
-- hour ago -- after this migration, a mutual follow is what opens presence.
--
-- A separate trigger rather than another branch inside
-- social_notification_trigger(), which already carries five content types and
-- would need reproducing whole to add a sixth.
--
-- The dedupe key must not depend on who followed first. notifications has a
-- unique index on (recipient_user_id, dedupe_key), so a key built from the
-- pair in a fixed order -- least, then greatest -- is what stops a
-- follow/unfollow/refollow cycle sending the same notice again.

begin;

create or replace function guestbook_private.notify_friendship_formed()
returns trigger
language plpgsql
security definer
set search_path='public','pg_temp'
as $$
declare
  v_key text;
  v_new_name text;
  v_other_name text;
begin
  -- Only when this insert completed the pair.
  if not guestbook_private.are_friends(new.follower_id,new.following_id) then
    return new;
  end if;

  v_key := 'friendship-'
    || least(new.follower_id,new.following_id)::text
    || '-'
    || greatest(new.follower_id,new.following_id)::text;

  select coalesce(nullif(btrim(full_name),''),'An Explorer') into v_new_name
    from public.profiles where id=new.follower_id;
  select coalesce(nullif(btrim(full_name),''),'An Explorer') into v_other_name
    from public.profiles where id=new.following_id;

  insert into public.notifications(
    recipient_user_id,actor_user_id,type,title,message,
    entity_type,entity_id,deep_link,data,dedupe_key
  )
  values
    (new.following_id,new.follower_id,'social_friendship','You are now friends',
     v_new_name||' follows you back. You can both see what the other shares with friends.',
     'profile',new.follower_id,'/profile/'||new.follower_id,
     jsonb_build_object('category','social','social_type','friendship'),v_key),
    (new.follower_id,new.following_id,'social_friendship','You are now friends',
     'You and '||v_other_name||' follow each other. You can both see what the other shares with friends.',
     'profile',new.following_id,'/profile/'||new.following_id,
     jsonb_build_object('category','social','social_type','friendship'),v_key)
  on conflict do nothing;

  return new;
end;
$$;

revoke all on function guestbook_private.notify_friendship_formed() from public,anon,authenticated;

drop trigger if exists explorer_follows_notify_friendship on public.explorer_follows;
create trigger explorer_follows_notify_friendship
after insert on public.explorer_follows
for each row execute function guestbook_private.notify_friendship_formed();

commit;

-- ---------------------------------------------------------------------------
-- NOT renamed here: the stored value is still 'followers'
-- ---------------------------------------------------------------------------
-- The value is now the wrong word -- the rule above is mutual, so the audience
-- is friends -- and leaving a stale name is the rot RULES.md warns about. It is
-- still left, deliberately, because renaming it is not a rename.
--
-- Five separate RPC validators reject anything outside ('public','followers'):
--
--   20260802211600:11, :49, :195
--   20260802211800:88
--   20260802212000:14
--   20260802212100:92
--   20260805120100:225
--
-- Changing the stored value means rewriting each of those functions whole, in
-- the same migration that changes who can see somebody's location. That is two
-- risks at once on the most safety-critical surface in the app, for a change
-- nobody can see. The word on screen is corrected to "Friends" in this packet;
-- the value gets its own piece of work.

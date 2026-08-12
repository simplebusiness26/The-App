-- Presence caps at friends, and stops speaking a dead vocabulary.
--
-- RULES.md, verbatim:
--
--   "`followers` is wider than `friends`, because following is one-way and
--    needs no permission. It is a fine audience for something somebody chose
--    to post. It is **not** an acceptable audience for presence -- check-ins
--    and Link-ups use friends."
--
--   "One audience vocabulary, narrowest first: nobody, selected,
--    close_friends, friends, followers, everyone. Never invent a synonym --
--    not public, not private."
--
-- Neither table obeyed either sentence. Both check constraints allowed exactly
-- `public` and `followers`, which are the two words the vocabulary rule names
-- as forbidden, and the visibility they produced was wider than friends.
--
-- PROVEN, AND THE FIRST ATTEMPT AT PROVING IT WAS WRONG
--
-- Every one of the 27 check-ins in the database expired yesterday, so the first
-- proof -- which counted every check-in a viewer could see -- was really
-- counting the viewer's OWN rows through the `user_id = auth.uid()` branch. It
-- reported a leak that its own query could not have detected either way.
--
-- Done properly: insert one live check-in, set the owner's profile to
-- `everyone`, and run the same viewer against the old rule and the new one on
-- identical data, all inside a rolled-back transaction.
--
--   OLD rule, a ONE-WAY follower     1 row     <- the leak was real
--   NEW rule, the same follower      0 rows    <- closed
--   NEW rule, an actual friend       1 row     <- and it still works
--
-- Nothing is exposed in production today only because all 19 profiles are still
-- `nobody`, and the app invites people to change that in Settings.
--
-- HOW IT IS FIXED, IN ONE CALL
--
-- guestbook_private.can_see_content(owner, viewer, audience) already takes the
-- NARROWER of the post's audience and the owner's profile ceiling. Asking it
-- for 'friends' therefore says exactly what RULES.md says:
--
--   profile nobody        -> nobody sees it
--   profile close_friends -> close friends
--   profile friends       -> friends
--   profile followers     -> friends   (the cap bites)
--   profile everyone      -> friends   (the cap bites)
--
-- Every path is the same or narrower than before. Nothing widens.

-- ---------------------------------------------------------------------------
-- Check-ins
-- ---------------------------------------------------------------------------
-- The column was decorative: the policy never read it, and app/checkins/create.js
-- hardcoded 'followers' while the screen told people their profile setting was
-- what decided. Now it holds the rule it actually follows.

alter table public.live_checkins drop constraint if exists live_checkins_visibility_check;

update public.live_checkins set visibility='friends';

alter table public.live_checkins
  add constraint live_checkins_visibility_check
  check (visibility in ('nobody','selected','close_friends','friends'));

alter table public.live_checkins alter column visibility set default 'friends';

drop policy if exists live_checkins_select_visible on public.live_checkins;

create policy live_checkins_select_visible
on public.live_checkins
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (
    status='active'
    and expires_at > now()
    and not private.linkup_users_blocked(user_id,(select auth.uid()))
    -- 'friends' is the ceiling for presence, and can_see_content narrows it
    -- further when the profile is narrower still.
    and guestbook_private.can_see_content(user_id,(select auth.uid()),'friends')
  )
);

-- ---------------------------------------------------------------------------
-- Link-ups
-- ---------------------------------------------------------------------------
-- A Link-up is not quite the same thing as a check-in: it is a future meeting
-- somebody chose to advertise, at a rounded location, and app/linkups/create.js
-- describes it as "simple, public and easy to join". So the open option stays,
-- as `everyone` rather than `public`.
--
-- What changes is that it can no longer bypass the author's profile ceiling.
-- Somebody whose profile says `nobody` was still broadcasting a Link-up, with
-- its place and time, to every Explorer in the app. And `followers` becomes
-- `friends`, because presence does not use followers.
--
-- The remaining question -- whether an `everyone` Link-up should exist at all,
-- given the rule groups Link-ups with check-ins -- is the owner's to answer.
-- This migration does not answer it; it stops the ceiling being ignored.

alter table public.linkups drop constraint if exists linkups_visibility_check;

update public.linkups
set visibility = case visibility
                   when 'public' then 'everyone'
                   when 'followers' then 'friends'
                   else visibility
                 end;

alter table public.linkups
  add constraint linkups_visibility_check
  check (visibility in ('nobody','selected','close_friends','friends','everyone'));

alter table public.linkups alter column visibility set default 'friends';

create or replace function private.can_view_linkup(p_linkup_id uuid, p_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public','private'
as $$
declare v_linkup public.linkups%rowtype;
begin
  if p_user_id is null then return false; end if;

  select * into v_linkup from public.linkups where id=p_linkup_id;
  if not found then return false; end if;

  if private.linkup_users_blocked(v_linkup.creator_id,p_user_id) then return false; end if;

  -- The creator and anyone already attending always see it. Joining is a
  -- decision the creator or the joiner already made; a later change to a
  -- profile setting must not hide a meeting somebody is going to.
  if v_linkup.creator_id=p_user_id
     or private.is_active_linkup_member(p_linkup_id,p_user_id) then
    return true;
  end if;

  if v_linkup.status not in ('upcoming','full') or v_linkup.ends_at<=now() then
    return false;
  end if;

  -- Everything else goes through the one audience function, so the author's
  -- profile ceiling applies. This used to be `if visibility='public' then
  -- return true`, which ignored it entirely.
  return guestbook_private.can_see_content(
    v_linkup.creator_id,
    p_user_id,
    case v_linkup.visibility
      when 'public' then 'everyone'
      when 'followers' then 'friends'
      else v_linkup.visibility
    end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- The two writers, which would otherwise fail the new constraints
-- ---------------------------------------------------------------------------
-- Caught by reading them rather than by the tests: both still validate against
-- ('public','followers') and insert the word verbatim. With the constraints
-- above in place that is a check violation on every check-in and every Link-up
-- -- the constraint would have closed the leak by breaking half the core loop.
--
-- Both now accept the canonical words AND the two legacy ones, because an
-- installed APK is still sending the old vocabulary and a person mid-week
-- should not get an error for it. Legacy input is translated, never stored.

create or replace function public.start_live_checkin(
  p_place_type text,
  p_target_id uuid,
  p_place_name text,
  p_area text,
  p_latitude double precision,
  p_longitude double precision,
  p_activity text,
  p_message text,
  p_visibility text,
  p_minutes integer default 120,
  p_public_place_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path='public','private'
as $$
declare
  v_user uuid:=auth.uid();
  v_id uuid;
  v_name text:=btrim(coalesce(p_place_name,''));
  v_area text:=btrim(coalesce(p_area,''));
  v_latitude double precision:=p_latitude;
  v_longitude double precision:=p_longitude;
  v_area_id uuid;
  v_visibility text;
begin
  if v_user is null or not private.linkup_user_is_explorer(v_user) then raise exception 'Only Explorer accounts can check in.'; end if;
  if p_place_type not in ('park','public_place') then raise exception 'You can only check in at a public place such as a park.'; end if;
  if p_public_place_id is null then raise exception 'Choose the public place you are at.'; end if;

  -- Presence caps at friends. An older build sending 'public' or 'followers'
  -- is translated rather than rejected, and neither word is ever stored.
  v_visibility:=case p_visibility
                  when 'public' then 'friends'
                  when 'followers' then 'friends'
                  when 'everyone' then 'friends'
                  when 'nobody' then 'nobody'
                  when 'selected' then 'selected'
                  when 'close_friends' then 'close_friends'
                  when 'friends' then 'friends'
                  else null
                end;
  if v_visibility is null then raise exception 'Invalid visibility.'; end if;

  if p_minutes not between 15 and 240 then raise exception 'Check-ins can last between 15 minutes and four hours.'; end if;
  if char_length(btrim(coalesce(p_activity,''))) not between 2 and 80 then raise exception 'Activity must contain between 2 and 80 characters.'; end if;
  if char_length(v_area) not between 2 and 80 then raise exception 'Add a valid public area.'; end if;
  if p_target_id is not null then raise exception 'A check-in names a public place, not a listing.'; end if;

  select pp.name,coalesce(pp.latitude,p_latitude),coalesce(pp.longitude,p_longitude),pp.area_id
    into v_name,v_latitude,v_longitude,v_area_id
  from public.public_places pp where pp.id=p_public_place_id and pp.status='published';
  if not found then raise exception 'Public place not found.'; end if;

  if char_length(v_name) not between 2 and 120 then raise exception 'Add a valid public place name.'; end if;

  if v_area_id is null then
    select a.area_id into v_area_id from public.geo_area_aliases a
    where a.alias_normalised=guestbook_private.normalise_area_text(v_area);
  end if;

  if v_latitude is not null and (v_latitude < -90 or v_latitude > 90) then raise exception 'Invalid latitude.'; end if;
  if v_longitude is not null and (v_longitude < -180 or v_longitude > 180) then raise exception 'Invalid longitude.'; end if;

  update public.live_checkins set status='expired',ended_at=now() where user_id=v_user and status='active' and expires_at<=now();
  if exists(select 1 from public.live_checkins where user_id=v_user and status='active') then raise exception 'End your current check-in before starting another.'; end if;

  insert into public.live_checkins(user_id,place_type,target_id,public_place_id,place_name,area,area_id,latitude,longitude,activity,message,visibility,status,expires_at)
  values(v_user,p_place_type,p_target_id,p_public_place_id,v_name,v_area,v_area_id,
    case when v_latitude is null then null else round(v_latitude::numeric,2)::double precision end,
    case when v_longitude is null then null else round(v_longitude::numeric,2)::double precision end,
    btrim(p_activity),left(coalesce(btrim(p_message),''),240),v_visibility,'active',now()+make_interval(mins=>p_minutes))
  returning id into v_id;
  return v_id;
end;
$$;

-- create_linkup, unchanged except for how it reads the audience. It used to
-- coerce anything unrecognised to 'public' -- a word the new constraint
-- rejects, so every Link-up creation would have failed.

create or replace function public.create_linkup(
  p_title text, p_description text, p_category text,
  p_starts_at timestamptz, p_ends_at timestamptz, p_area text,
  p_location_name text, p_meeting_point_details text,
  p_latitude double precision, p_longitude double precision,
  p_max_attendees integer, p_visibility text
)
returns uuid
language plpgsql
security definer
set search_path to 'public','private'
as $$
declare
  v_user uuid:=auth.uid();
  v_id uuid;
  v_title text:=btrim(coalesce(p_title,''));
  v_description text;
  v_category text;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_profile_area text;
  v_area text;
  v_location_name text;
  v_max_attendees integer;
  v_visibility text;
begin
  if v_user is null or not private.linkup_user_is_explorer(v_user) then
    raise exception 'Only Explorer accounts can create Link-ups.';
  end if;

  if char_length(v_title) not between 3 and 100 then
    raise exception 'Add a title with between 3 and 100 characters.';
  end if;

  select nullif(btrim(p.area),'') into v_profile_area
  from public.profiles p where p.id=v_user;

  v_description:=case
    when char_length(btrim(coalesce(p_description,''))) between 10 and 2000
      then btrim(p_description)
    else 'Details will be added by the organiser.'
  end;

  v_category:=case
    when char_length(btrim(coalesce(p_category,''))) between 2 and 40
      then btrim(p_category)
    when lower(v_title) like '%football%' then 'Football'
    when lower(v_title) like '%walk%' then 'Walking'
    when lower(v_title) like '%run%' then 'Running'
    when lower(v_title) like '%coffee%' then 'Coffee'
    when lower(v_title) similar to '%(food|lunch|dinner)%' then 'Food'
    when lower(v_title) similar to '%(game|quiz)%' then 'Games'
    else 'Social'
  end;

  v_starts_at:=coalesce(p_starts_at,now()+interval '1 day');
  if v_starts_at < now()+interval '15 minutes' or v_starts_at > now()+interval '180 days' then
    raise exception 'Link-up must start between 15 minutes and 180 days from now.';
  end if;

  v_ends_at:=coalesce(p_ends_at,v_starts_at+interval '2 hours');
  if v_ends_at<=v_starts_at or v_ends_at>v_starts_at+interval '24 hours' then
    raise exception 'Link-up duration must be between 1 minute and 24 hours.';
  end if;

  v_area:=case
    when char_length(btrim(coalesce(p_area,''))) between 2 and 80 then btrim(p_area)
    else coalesce(v_profile_area,'Local area')
  end;

  v_location_name:=case
    when char_length(btrim(coalesce(p_location_name,''))) between 2 and 120 then btrim(p_location_name)
    else 'Public meeting place to be confirmed'
  end;

  v_max_attendees:=case
    when p_max_attendees between 2 and 50 then p_max_attendees
    else 8
  end;

  -- The canonical vocabulary, with the two legacy words translated so an
  -- installed build keeps working. `followers` becomes `friends`: presence does
  -- not use followers. The default when nothing recognisable arrives is the
  -- NARROW one, not the open one -- an unreadable audience must fail closed.
  v_visibility:=case p_visibility
                  when 'public' then 'everyone'
                  when 'followers' then 'friends'
                  when 'everyone' then 'everyone'
                  when 'friends' then 'friends'
                  when 'close_friends' then 'close_friends'
                  when 'selected' then 'selected'
                  when 'nobody' then 'nobody'
                  else 'friends'
                end;

  if (select count(*) from public.linkups where creator_id=v_user and created_at>now()-interval '24 hours')>=5 then
    raise exception 'You can create up to five Link-ups in 24 hours.';
  end if;

  if p_latitude is not null and (p_latitude < -90 or p_latitude > 90) then
    raise exception 'Invalid latitude.';
  end if;
  if p_longitude is not null and (p_longitude < -180 or p_longitude > 180) then
    raise exception 'Invalid longitude.';
  end if;

  insert into public.linkups(
    creator_id,title,description,category,starts_at,ends_at,area,location_name,
    latitude,longitude,max_attendees,attendee_count,visibility,status
  ) values(
    v_user,v_title,v_description,v_category,v_starts_at,v_ends_at,v_area,v_location_name,
    case when p_latitude is null then null else round(p_latitude::numeric,3)::double precision end,
    case when p_longitude is null then null else round(p_longitude::numeric,3)::double precision end,
    v_max_attendees,1,v_visibility,'upcoming'
  ) returning id into v_id;

  insert into public.linkup_private_details(linkup_id,meeting_point_details)
  values(v_id,left(coalesce(btrim(p_meeting_point_details),''),500));

  insert into public.linkup_attendees(linkup_id,user_id,role,status)
  values(v_id,v_user,'creator','joined');

  insert into public.notifications(
    recipient_user_id,actor_user_id,type,title,message,entity_type,entity_id,
    deep_link,data,dedupe_key
  )
  select
    f.follower_id,v_user,'linkup_follower_created',
    'New Link-up from someone you follow',v_title,'linkup',v_id,
    '/linkups/'||v_id,jsonb_build_object('linkup_id',v_id),
    'linkup-created-'||v_id||'-'||f.follower_id
  from public.explorer_follows f
  where f.following_id=v_user
    and not private.linkup_users_blocked(f.follower_id,v_user)
    and not exists(
      select 1 from public.notifications n
      where n.dedupe_key='linkup-created-'||v_id||'-'||f.follower_id
    );

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- And the third presence surface, which the strengthened gate found
-- ---------------------------------------------------------------------------
-- get_live_discovery is the read model behind "Happening" on the map and Live
-- Nearby. Its check-in branch called can_see_explorer too, so the same
-- followers-and-everyone exposure applied to the surface people actually look
-- at. I had fixed the policy and missed the read model;
-- scripts/verify-friends-visibility.cjs caught it the moment the rule it
-- enforces was tightened, which is the entire argument for writing the gate
-- before believing the fix.
--
-- Patched in place from pg_get_functiondef rather than retyped, so the other
-- sixty lines of the union are byte-for-byte what they were.

do $$
declare
  def text;
  patched text;
begin
  select pg_get_functiondef(p.oid) into def
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='get_live_discovery';

  if def is null then raise exception 'get_live_discovery not found'; end if;

  patched := replace(
    def,
    'guestbook_private.can_see_explorer(c.user_id,v_user)',
    'guestbook_private.can_see_content(c.user_id,v_user,''friends'')'
  );

  -- Already patched, or the shape changed and this needs a human. Either way,
  -- do not pretend it worked.
  if patched = def and position('can_see_content(c.user_id,v_user,''friends'')' in def) = 0 then
    raise exception 'get_live_discovery: the can_see_explorer call was not found and it is not already capped';
  end if;

  if patched <> def then execute patched; end if;
end $$;

-- Packet 17 -- a check-in is a presence at a public place, and nothing else.
--
-- WHAT IT WAS
--
-- start_live_checkin accepted five place types: park, public_place, business,
-- activity_club and event. It also accepted a typed place name with no
-- canonical reference at all, which meant a check-in could name any address a
-- person cared to write.
--
-- WHY THAT IS WRONG
--
-- RULES.md: "Check-in -- a public, opt-in presence at a park." A check-in at a
-- business is a different act wearing the same word. It broadcasts your
-- position at a private address; the business has no say in whether it happens
-- and no way to turn it off; and it is the shape of a product this app has
-- said it is not.
--
-- DECISION 5, taken as "all public places" rather than "parks only". park and
-- public_place both survive because public_places holds eight types -- beaches,
-- viewpoints, greens -- and letting a person check in at a park but not at a
-- beach would be an arbitrary line through one table. "Park" stays the word in
-- the copy because it is the word people use.
--
-- The free-text path goes too. It was the back door: with no canonical place
-- required, a person could type a private address and get exactly the check-in
-- this packet is removing.
--
-- EXISTING ROWS ARE LEFT ALONE. A check-in at a business made before today
-- stays in the table and expires on its own within four hours, like every
-- check-in. Deleting an Explorer's own records as a side effect of a rule
-- change is what RULES.md forbids under "Never delete an Explorer's content as
-- a side effect of another change".
--
-- TO UNDO
--   restore public.start_live_checkin from
--   20260805120100_area_and_place_references.sql:213-300.

begin;

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
begin
  if v_user is null or not private.linkup_user_is_explorer(v_user) then raise exception 'Only Explorer accounts can check in.'; end if;
  -- Packet 17: a check-in is a presence at a PUBLIC place, and nothing else.
  -- Businesses, clubs and events are gone from this list. Standing outside a
  -- shop is not the same act as being in a park: it broadcasts your position at
  -- a private address, it is what a check-in on a business is in practice, and
  -- there is no way to ask the business whether it wants that.
  if p_place_type not in ('park','public_place') then raise exception 'You can only check in at a public place such as a park.'; end if;
  if p_public_place_id is null then raise exception 'Choose the public place you are at.'; end if;
  if p_visibility not in ('public','followers') then raise exception 'Invalid visibility.'; end if;
  if p_minutes not between 15 and 240 then raise exception 'Check-ins can last between 15 minutes and four hours.'; end if;
  if char_length(btrim(coalesce(p_activity,''))) not between 2 and 80 then raise exception 'Activity must contain between 2 and 80 characters.'; end if;
  if char_length(v_area) not between 2 and 80 then raise exception 'Add a valid public area.'; end if;
  if p_target_id is not null then raise exception 'A check-in names a public place, not a listing.'; end if;

  -- One path now. The place's own name and coordinates become the snapshot, so
  -- twelve check-ins at one park cannot arrive under twelve spellings. There is
  -- no free-text path left either: a typed place name was how a check-in at a
  -- private address used to get in through the back door.
  select pp.name,coalesce(pp.latitude,p_latitude),coalesce(pp.longitude,p_longitude),pp.area_id
    into v_name,v_latitude,v_longitude,v_area_id
  from public.public_places pp where pp.id=p_public_place_id and pp.status='published';
  if not found then raise exception 'Public place not found.'; end if;

  if char_length(v_name) not between 2 and 120 then raise exception 'Add a valid public place name.'; end if;

  -- Whatever the path, an area string that matches an approved alias resolves
  -- to the canonical area. One that does not stays text, exactly as before.
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
    btrim(p_activity),left(coalesce(btrim(p_message),''),240),p_visibility,'active',now()+make_interval(mins=>p_minutes))
  returning id into v_id;
  return v_id;
end;
$$;

commit;

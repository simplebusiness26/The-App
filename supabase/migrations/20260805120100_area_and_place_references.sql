-- Packet 8e, part 2 of 4: canonical references on the tables that already exist.
--
-- WHY
-- Part 1 created the canonical tables. This one points the existing rows at
-- them -- additively. Every text column stays, every value in it stays, and a
-- row whose text cannot be matched to an approved alias keeps area_id null
-- rather than being assigned a guess.
--
-- THE MATCHING RULE, IN FULL
--   normalise(text) = an approved alias  ->  set area_id
--   anything else                        ->  leave null, report it
--
-- There is no distance matching, no prefix matching and no "contains" matching.
-- "Hastings Old Town" is not Hastings: it may become a neighbourhood of its own
-- later, and a migration that decides otherwise now would have to be unpicked
-- from live rows rather than from a file.
--
-- BUSINESSES AND PROPERTIES ARE NOT BACKFILLED, ON PURPOSE
-- Neither table has a town column -- only `address`, a free-text postal address.
-- Reading a town out of an address means parsing it, and a parser that is
-- usually right is a parser that quietly files places in the wrong town. Both
-- tables get the column so a person or a later admin screen can set it; nothing
-- fills it in here.
--
-- REVERSAL
--   alter table public.live_checkins drop column if exists public_place_id, drop column if exists area_id;
--   alter table public.linkups        drop column if exists area_id;
--   alter table public.events         drop column if exists area_id;
--   alter table public.activity_clubs drop column if exists area_id;
--   alter table public.properties     drop column if exists area_id;
--   alter table public.businesses     drop column if exists area_id;
--   alter table public.profiles       drop column if exists area_id;
--   drop function if exists public.get_unmatched_area_report();
--   drop function if exists public.get_unmatched_public_place_report();
--   (start_live_checkin: restore the ten-argument definition from
--    20260802211600_linkups_live_actions.sql as later patched.)

begin;

-- ---------------------------------------------------------------------------
-- 1. The columns
-- ---------------------------------------------------------------------------

alter table public.profiles       add column if not exists area_id uuid references public.geo_areas(id) on delete set null;
alter table public.businesses     add column if not exists area_id uuid references public.geo_areas(id) on delete set null;
alter table public.properties     add column if not exists area_id uuid references public.geo_areas(id) on delete set null;
alter table public.activity_clubs add column if not exists area_id uuid references public.geo_areas(id) on delete set null;
alter table public.events         add column if not exists area_id uuid references public.geo_areas(id) on delete set null;
alter table public.linkups        add column if not exists area_id uuid references public.geo_areas(id) on delete set null;
alter table public.live_checkins  add column if not exists area_id uuid references public.geo_areas(id) on delete set null;

-- The stable public-place reference. Nullable, and additive: place_name and
-- area keep working exactly as they did, and an older row -- or an older app
-- bundle -- simply leaves this null.
alter table public.live_checkins  add column if not exists public_place_id uuid references public.public_places(id) on delete set null;

-- A canonical public place only makes sense for the two place types that mean
-- "somewhere public". A business check-in already has target_id.
do $$
begin
  if not exists(select 1 from pg_constraint where conname='live_checkins_public_place_scope') then
    alter table public.live_checkins
      add constraint live_checkins_public_place_scope
      check (public_place_id is null or place_type in ('park','public_place'));
  end if;
end;
$$;

create index if not exists profiles_area_idx        on public.profiles(area_id)       where area_id is not null;
create index if not exists businesses_area_idx      on public.businesses(area_id)     where area_id is not null;
create index if not exists properties_area_idx      on public.properties(area_id)     where area_id is not null;
create index if not exists activity_clubs_area_idx  on public.activity_clubs(area_id) where area_id is not null;
create index if not exists events_area_idx          on public.events(area_id)         where area_id is not null;
create index if not exists linkups_area_id_idx      on public.linkups(area_id)        where area_id is not null;
create index if not exists live_checkins_area_id_idx on public.live_checkins(area_id) where area_id is not null;
create index if not exists live_checkins_public_place_idx
  on public.live_checkins(public_place_id,status) where public_place_id is not null;

-- ---------------------------------------------------------------------------
-- 2. Backfill -- exact approved matches only
-- ---------------------------------------------------------------------------

update public.profiles t set area_id=a.area_id
from public.geo_area_aliases a
where t.area_id is null and guestbook_private.normalise_area_text(t.area)=a.alias_normalised;

update public.activity_clubs t set area_id=a.area_id
from public.geo_area_aliases a
where t.area_id is null and guestbook_private.normalise_area_text(t.location)=a.alias_normalised;

update public.events t set area_id=a.area_id
from public.geo_area_aliases a
where t.area_id is null and guestbook_private.normalise_area_text(t.location)=a.alias_normalised;

update public.linkups t set area_id=a.area_id
from public.geo_area_aliases a
where t.area_id is null and guestbook_private.normalise_area_text(t.area)=a.alias_normalised;

update public.live_checkins t set area_id=a.area_id
from public.geo_area_aliases a
where t.area_id is null and guestbook_private.normalise_area_text(t.area)=a.alias_normalised;

-- ---------------------------------------------------------------------------
-- 3. The unmatched report
-- ---------------------------------------------------------------------------
-- Everything the backfill refused to guess at, grouped, so a person can decide.
-- It suggests nothing: a suggestion in a report is a guess with a queue, and
-- the whole point of leaving these null is that a person picks.

create or replace function public.get_unmatched_area_report()
returns table(source_table text,source_column text,raw_value text,normalised_value text,row_count bigint)
language plpgsql
stable
security definer
set search_path='public','pg_temp'
as $$
begin
  if not public.guestbook_is_admin() then
    raise exception 'Administrator access required.';
  end if;

  return query
  select r.source_table,r.source_column,r.raw_value,r.normalised_value,count(*) as row_count
  from (
    select 'profiles'::text,'area'::text,p.area,guestbook_private.normalise_area_text(p.area)
      from public.profiles p where p.area_id is null and btrim(coalesce(p.area,''))<>''
    union all
    select 'activity_clubs','location',c.location,guestbook_private.normalise_area_text(c.location)
      from public.activity_clubs c where c.area_id is null and btrim(coalesce(c.location,''))<>''
    union all
    select 'events','location',e.location,guestbook_private.normalise_area_text(e.location)
      from public.events e where e.area_id is null and btrim(coalesce(e.location,''))<>''
    union all
    select 'linkups','area',l.area,guestbook_private.normalise_area_text(l.area)
      from public.linkups l where l.area_id is null and btrim(coalesce(l.area,''))<>''
    union all
    select 'live_checkins','area',k.area,guestbook_private.normalise_area_text(k.area)
      from public.live_checkins k where k.area_id is null and btrim(coalesce(k.area,''))<>''
  ) as r(source_table,source_column,raw_value,normalised_value)
  group by r.source_table,r.source_column,r.raw_value,r.normalised_value
  order by count(*) desc,r.source_table,r.raw_value;
end;
$$;

comment on function public.get_unmatched_area_report() is
  'Administrator-only. Every free-text area string that matched no approved alias, grouped with a count. Deliberately suggests nothing.';

-- The same question for public places: which park and public-place names are
-- people typing that have no canonical row yet? Without this the administrator
-- has no way to discover what to create, and duplicate spellings accumulate.
create or replace function public.get_unmatched_public_place_report()
returns table(place_type text,raw_value text,normalised_value text,row_count bigint)
language plpgsql
stable
security definer
set search_path='public','pg_temp'
as $$
begin
  if not public.guestbook_is_admin() then
    raise exception 'Administrator access required.';
  end if;

  return query
  select k.place_type,k.place_name,guestbook_private.normalise_area_text(k.place_name),count(*) as row_count
  from public.live_checkins k
  where k.public_place_id is null
    and k.place_type in ('park','public_place')
    and btrim(coalesce(k.place_name,''))<>''
  group by k.place_type,k.place_name
  order by count(*) desc,k.place_name;
end;
$$;

comment on function public.get_unmatched_public_place_report() is
  'Administrator-only. Free-text check-in place names with no canonical public_places row, so duplicates can be turned into one place.';

revoke all on function public.get_unmatched_area_report(),public.get_unmatched_public_place_report() from public,anon;
grant execute on function public.get_unmatched_area_report(),public.get_unmatched_public_place_report() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. start_live_checkin gains the canonical reference
-- ---------------------------------------------------------------------------
-- Rebuilt from the definition running on the project, not from the file that
-- first created it -- that file predates the listing-name lookup and the
-- two-decimal rounding, and reproducing it would silently revert both.
--
-- COMPATIBILITY. The new parameter is last and defaults to null, so a caller
-- that still sends the original ten arguments gets exactly the behaviour it had
-- before. The function is dropped and recreated rather than added alongside as
-- an overload: two candidates that differ only by a defaulted argument is how
-- PostgREST ends up unable to choose between them (PGRST203), and a check-in
-- that fails to resolve is worse than a signature that gained a default.

drop function if exists public.start_live_checkin(text,uuid,text,text,double precision,double precision,text,text,text,integer);

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
  if p_place_type not in ('park','public_place','business','activity_club','event') then raise exception 'Invalid public place type.'; end if;
  if p_visibility not in ('public','followers') then raise exception 'Invalid visibility.'; end if;
  if p_minutes not between 15 and 240 then raise exception 'Check-ins can last between 15 minutes and four hours.'; end if;
  if char_length(btrim(coalesce(p_activity,''))) not between 2 and 80 then raise exception 'Activity must contain between 2 and 80 characters.'; end if;
  if char_length(v_area) not between 2 and 80 then raise exception 'Add a valid public area.'; end if;
  if p_public_place_id is not null and p_place_type not in ('park','public_place') then
    raise exception 'A canonical public place can only be used for a park or public place check-in.';
  end if;

  if p_place_type='business' then
    select b.name,coalesce(b.latitude,p_latitude),coalesce(b.longitude,p_longitude),b.area_id
      into v_name,v_latitude,v_longitude,v_area_id
    from public.businesses b where b.id=p_target_id;
    if not found then raise exception 'Business not found.'; end if;
  elsif p_place_type='activity_club' then
    select c.name,coalesce(c.latitude,p_latitude),coalesce(c.longitude,p_longitude),c.area_id
      into v_name,v_latitude,v_longitude,v_area_id
    from public.activity_clubs c where c.id=p_target_id and c.status in ('open','full');
    if not found then raise exception 'Activity Club not found.'; end if;
  elsif p_place_type='event' then
    select e.name,coalesce(e.latitude,p_latitude),coalesce(e.longitude,p_longitude),e.area_id
      into v_name,v_latitude,v_longitude,v_area_id
    from public.events e where e.id=p_target_id and e.status='published';
    if not found then raise exception 'Event not found.'; end if;
  else
    if p_target_id is not null then raise exception 'Manual public places cannot use a listing identifier.'; end if;

    -- The canonical path. The place's own name and coordinates become the
    -- snapshot, so twelve check-ins at one park cannot arrive under twelve
    -- spellings. The free-text columns are still written -- they are the
    -- display value and they keep older readers working.
    if p_public_place_id is not null then
      select pp.name,coalesce(pp.latitude,p_latitude),coalesce(pp.longitude,p_longitude),pp.area_id
        into v_name,v_latitude,v_longitude,v_area_id
      from public.public_places pp where pp.id=p_public_place_id and pp.status='published';
      if not found then raise exception 'Public place not found.'; end if;
    end if;

    if char_length(v_name) not between 2 and 120 then raise exception 'Add a valid public place name.'; end if;
  end if;

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

revoke all on function public.start_live_checkin(text,uuid,text,text,double precision,double precision,text,text,text,integer,uuid) from public,anon;
grant execute on function public.start_live_checkin(text,uuid,text,text,double precision,double precision,text,text,text,integer,uuid) to authenticated;

commit;

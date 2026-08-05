-- Packet 8e, part 1 of 4: canonical geography and canonical public places.
--
-- WHY
-- Everything in this app that has a location carries it as free text today:
-- profiles.area, activity_clubs.location, events.location, linkups.area,
-- live_checkins.area. "Hastings" and "Hastings, East Sussex" are the same town
-- to a person and two different towns to a query, and a park has no identity at
-- all -- live_checkins stores the name a person typed, so Alexandra Park and
-- alexandra park are two places and neither can be followed, opened or attached
-- to anything.
--
-- This migration adds the two canonical tables and nothing that reads them.
-- Parts 2, 3 and 4 add the references, the follows and the Moment columns.
--
-- WHAT IS DELIBERATELY NOT HERE
--   * No text column is dropped or rewritten. Every existing area string stays
--     exactly as it is and keeps rendering as the display fallback.
--   * No area is inferred. The seed below is the launch hierarchy and the alias
--     list is the whole of what may match automatically. Anything else stays
--     unmatched and appears in the report added by part 2.
--   * public_places has no owner, no claim and no official-posting path. It is
--     administrator-managed until a public-place permission model exists;
--     attaching content to a place and speaking as that place are different
--     things and only the first one is built here.
--
-- REVERSAL
--   drop table if exists public.public_places;
--   drop table if exists public.geo_area_aliases;
--   drop table if exists public.geo_areas;
--   drop function if exists guestbook_private.normalise_area_text(text);
--   drop function if exists guestbook_private.validate_geo_area();
--   drop function if exists guestbook_private.touch_place_updated_at();

begin;

-- ---------------------------------------------------------------------------
-- 1. Normalisation, for matching only
-- ---------------------------------------------------------------------------
-- Lower-cases, replaces every run of non-alphanumerics with a single space and
-- trims. "St Leonards-on-Sea", "st leonards on sea" and "ST  LEONARDS ON SEA"
-- all normalise to the same string, so an alias can be written once.
--
-- This is used to decide whether a string matches an approved alias. It is
-- never used to write a display value back over what somebody typed.

create or replace function guestbook_private.normalise_area_text(p_value text)
returns text
language sql
immutable
as $$
  select nullif(btrim(regexp_replace(lower(coalesce(p_value,'')),'[^a-z0-9]+',' ','g')),'');
$$;

revoke all on function guestbook_private.normalise_area_text(text) from public,anon;
grant execute on function guestbook_private.normalise_area_text(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. geo_areas -- towns, cities and counties
-- ---------------------------------------------------------------------------

create table if not exists public.geo_areas(
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  area_type text not null check (area_type in ('town','city','county')),
  parent_area_id uuid references public.geo_areas(id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  centre_lat double precision check (centre_lat between -90 and 90),
  centre_lng double precision check (centre_lng between -180 and 180),
  status text not null default 'active' check (status in ('active','hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint geo_areas_not_own_parent check (parent_area_id is null or parent_area_id<>id)
);

comment on table public.geo_areas is
  'Canonical towns, cities and counties. Seeded launch-area-by-launch-area; existing free-text area strings are matched against geo_area_aliases and are left unmatched when uncertain.';

create unique index if not exists geo_areas_name_type_unique
  on public.geo_areas(lower(btrim(name)),area_type);
create index if not exists geo_areas_parent_idx
  on public.geo_areas(parent_area_id) where parent_area_id is not null;
create index if not exists geo_areas_type_name_idx
  on public.geo_areas(area_type,name) where status='active';

-- A county sits at the top. A town or city may sit inside a county and nowhere
-- else, which keeps the hierarchy two deep and makes a cycle impossible without
-- a recursive check.
create or replace function guestbook_private.validate_geo_area()
returns trigger
language plpgsql
security definer
set search_path='public','pg_temp'
as $$
declare v_parent_type text;
begin
  if new.area_type='county' and new.parent_area_id is not null then
    raise exception 'A county has no parent area.';
  end if;

  if new.parent_area_id is not null then
    select area_type into v_parent_type from public.geo_areas where id=new.parent_area_id;
    if v_parent_type is null then raise exception 'The parent area does not exist.'; end if;
    if v_parent_type<>'county' then raise exception 'A town or city can only sit inside a county.'; end if;
  end if;

  new.updated_at:=now();
  return new;
end;
$$;

drop trigger if exists geo_areas_validate on public.geo_areas;
create trigger geo_areas_validate
before insert or update on public.geo_areas
for each row execute function guestbook_private.validate_geo_area();

-- ---------------------------------------------------------------------------
-- 3. geo_area_aliases -- the whole of what may match automatically
-- ---------------------------------------------------------------------------
-- An alias is an explicit approval that one normalised string means one area.
-- There is no fuzzy matching anywhere in this packet: a string either equals an
-- approved alias or it stays unmatched.

create table if not exists public.geo_area_aliases(
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references public.geo_areas(id) on delete cascade,
  alias_normalised text not null unique check (char_length(alias_normalised) between 2 and 120),
  source text not null default 'seed' check (source in ('seed','admin')),
  created_at timestamptz not null default now()
);

comment on table public.geo_area_aliases is
  'Approved normalised strings that map to a canonical area. A public place name is never an area alias -- "Preston Park" is a park in Brighton, not another word for Brighton.';

create index if not exists geo_area_aliases_area_idx on public.geo_area_aliases(area_id);

-- ---------------------------------------------------------------------------
-- 4. public_places -- parks, beaches and the rest of the non-commercial map
-- ---------------------------------------------------------------------------
-- One general table rather than a parks table. A beach, a viewpoint and a
-- public square need exactly the same fields as a park -- a stable id, a name,
-- an area, coordinates and a description -- and a narrow table would be copied
-- the first time one of them was needed.

create table if not exists public.public_places(
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  place_type text not null check (place_type in (
    'park','beach','viewpoint','landmark','public_square','nature_area','attraction','other'
  )),
  area_id uuid references public.geo_areas(id) on delete set null,
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  location_description text not null default '' check (char_length(location_description)<=200),
  description text not null default '' check (char_length(description)<=1000),
  image_url text,
  status text not null default 'published' check (status in ('draft','published','hidden')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.public_places is
  'Canonical parks, beaches, viewpoints and other non-commercial places. Administrator-managed: there is no claim flow and no official-posting identity for a public place yet.';

-- Two names cannot collide inside one area, and cannot collide among the
-- places that have no area yet. Written as two partial indexes because a
-- unique index over a nullable column treats every NULL as distinct, which
-- would let the same unplaced park be created twice.
create unique index if not exists public_places_name_area_unique
  on public.public_places(lower(btrim(name)),area_id) where area_id is not null;
create unique index if not exists public_places_name_unplaced_unique
  on public.public_places(lower(btrim(name))) where area_id is null;
create index if not exists public_places_area_status_idx
  on public.public_places(area_id,status);
create index if not exists public_places_type_name_idx
  on public.public_places(place_type,name) where status='published';

create or replace function guestbook_private.touch_place_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at:=now();
  return new;
end;
$$;

drop trigger if exists public_places_touch on public.public_places;
create trigger public_places_touch
before update on public.public_places
for each row execute function guestbook_private.touch_place_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Row level security
-- ---------------------------------------------------------------------------
-- Reference data: readable by anyone, writable by an administrator only. The
-- admin test is public.guestbook_is_admin(), the SECURITY DEFINER helper added
-- with the core RLS work, so the policy does not re-enter profiles' own RLS.

alter table public.geo_areas enable row level security;
alter table public.geo_area_aliases enable row level security;
alter table public.public_places enable row level security;

drop policy if exists geo_areas_read_active on public.geo_areas;
drop policy if exists geo_areas_admin_write on public.geo_areas;
create policy geo_areas_read_active on public.geo_areas
  for select to anon,authenticated using (status='active' or public.guestbook_is_admin());
create policy geo_areas_admin_write on public.geo_areas
  for all to authenticated using (public.guestbook_is_admin()) with check (public.guestbook_is_admin());

drop policy if exists geo_area_aliases_read on public.geo_area_aliases;
drop policy if exists geo_area_aliases_admin_write on public.geo_area_aliases;
create policy geo_area_aliases_read on public.geo_area_aliases
  for select to authenticated using (true);
create policy geo_area_aliases_admin_write on public.geo_area_aliases
  for all to authenticated using (public.guestbook_is_admin()) with check (public.guestbook_is_admin());

drop policy if exists public_places_read_published on public.public_places;
drop policy if exists public_places_admin_write on public.public_places;
create policy public_places_read_published on public.public_places
  for select to anon,authenticated using (status='published' or public.guestbook_is_admin());
create policy public_places_admin_write on public.public_places
  for all to authenticated using (public.guestbook_is_admin()) with check (public.guestbook_is_admin());

-- Grants are not RLS: they decide who may attempt a statement at all. anon may
-- read the reference tables (place pages and the map are public) and may write
-- to none of them.
revoke all on public.geo_areas,public.geo_area_aliases,public.public_places from anon,authenticated;
grant select on public.geo_areas,public.public_places to anon,authenticated;
grant select on public.geo_area_aliases to authenticated;
grant insert,update,delete on public.geo_areas,public.geo_area_aliases,public.public_places to authenticated;

-- ---------------------------------------------------------------------------
-- 6. The launch hierarchy
-- ---------------------------------------------------------------------------
-- Four areas, and only four. Guestbook launches town by town, so this is a
-- seeded starting point rather than an attempt at national coverage.
--
-- Brighton is recorded with no parent, as specified. It is a unitary authority
-- and whether it belongs under East Sussex is a real question with two defensible
-- answers -- not one to settle silently inside a migration.

insert into public.geo_areas(name,area_type,parent_area_id,slug,centre_lat,centre_lng)
values('East Sussex','county',null,'east-sussex',50.9000,0.2800)
on conflict (slug) do nothing;

insert into public.geo_areas(name,area_type,parent_area_id,slug,centre_lat,centre_lng)
select 'Hastings','town',a.id,'hastings',50.8552,0.5729
from public.geo_areas a where a.slug='east-sussex'
on conflict (slug) do nothing;

insert into public.geo_areas(name,area_type,parent_area_id,slug,centre_lat,centre_lng)
select 'St Leonards-on-Sea','town',a.id,'st-leonards-on-sea',50.8536,0.5490
from public.geo_areas a where a.slug='east-sussex'
on conflict (slug) do nothing;

insert into public.geo_areas(name,area_type,parent_area_id,slug,centre_lat,centre_lng)
values('Brighton','city',null,'brighton',50.8225,-0.1372)
on conflict (slug) do nothing;

-- The approved aliases, and nothing beyond them.
--
-- Every one of these is the same settlement written differently. None is a
-- neighbourhood, a landmark or a park:
--   "Hastings Old Town", "Hastings Seafront", "Brighton Seafront",
--   "Brighton Pier", "Preston Park", "North Laine", "America Ground" and
--   "Local area" are all present in live data and all stay unmatched.
-- Preston Park in particular is a park, and a park is a public place, not a
-- second name for the city around it.

insert into public.geo_area_aliases(area_id,alias_normalised,source)
select a.id,x.alias,'seed'
from public.geo_areas a
join (values
  ('east-sussex','east sussex'),
  ('hastings','hastings'),
  ('hastings','hastings east sussex'),
  ('st-leonards-on-sea','st leonards'),
  ('st-leonards-on-sea','st leonards on sea'),
  ('brighton','brighton'),
  ('brighton','brighton and hove'),
  ('brighton','brighton hove')
) as x(slug,alias) on x.slug=a.slug
on conflict (alias_normalised) do nothing;

commit;

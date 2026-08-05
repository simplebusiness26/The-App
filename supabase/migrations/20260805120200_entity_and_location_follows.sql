-- Packet 8e, part 3 of 4: following a place, and following a town.
--
-- WHY
-- explorer_follows connects one Explorer to another and is the only follow this
-- app has. There is no way to follow the pub you drink in, the club you train
-- with, the park you walk in or the town you live in -- so a feed can only ever
-- be as local as the people you happen to know.
--
-- TWO TABLES, NOT ONE
-- An entity follow points at a row in one of five tables and needs a type
-- discriminator. A location follow points at geo_areas and needs a real foreign
-- key, which is worth more than the symmetry of a single table: an area that is
-- deleted takes its follows with it, and no type column can be wrong.
--
-- WHAT IS DELIBERATELY NOT HERE
--   * No Link-up follows. A Link-up is one occurrence -- people join, attend or
--     watch it; an ongoing follow relationship with a single afternoon is not a
--     thing anybody wants.
--   * No notifications. The existing Moment fan-out notifies every follower of
--     a person; extending that to entities would mean a business with 400
--     followers sending 400 pushes per post. Followed-entity content belongs in
--     the feed by default, and notification preferences are their own work.
--   * No follower lists. A follow row is readable by the Explorer who created
--     it and nobody else. Counts come from a definer function that returns a
--     number, so "how popular is this place" is answerable without "who exactly
--     follows this place" being answerable with it.
--
-- REVERSAL
--   drop table if exists public.explorer_location_follows;
--   drop table if exists public.explorer_entity_follows;
--   drop function if exists public.get_entity_follow_stats(text,uuid);
--   drop function if exists public.get_location_follow_stats(uuid);
--   drop function if exists guestbook_private.validate_follow_target();
--   drop function if exists guestbook_private.enforce_follow_rate_limit();

begin;

-- ---------------------------------------------------------------------------
-- 1. The tables
-- ---------------------------------------------------------------------------

create table if not exists public.explorer_entity_follows(
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('business','property','activity_club','event','public_place')),
  target_id uuid not null,
  created_at timestamptz not null default now(),
  constraint explorer_entity_follows_unique unique (follower_id,target_type,target_id)
);

comment on table public.explorer_entity_follows is
  'An Explorer following a place, club, event or public place. Link-ups are deliberately absent: they are joined, not followed.';

create table if not exists public.explorer_location_follows(
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references auth.users(id) on delete cascade,
  area_id uuid not null references public.geo_areas(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint explorer_location_follows_unique unique (follower_id,area_id)
);

comment on table public.explorer_location_follows is
  'An Explorer following a canonical town, city or county. Only canonical area ids -- never a free-text area string.';

create index if not exists explorer_entity_follows_follower_idx
  on public.explorer_entity_follows(follower_id,created_at desc);
create index if not exists explorer_entity_follows_target_idx
  on public.explorer_entity_follows(target_type,target_id);
create index if not exists explorer_location_follows_follower_idx
  on public.explorer_location_follows(follower_id,created_at desc);
create index if not exists explorer_location_follows_area_idx
  on public.explorer_location_follows(area_id);

-- ---------------------------------------------------------------------------
-- 2. Validation
-- ---------------------------------------------------------------------------
-- A follow of something that does not exist, or that is not published, is a row
-- that will render as a broken card later. Checked here rather than in the
-- screen, because the screen is not the boundary.

create or replace function guestbook_private.validate_follow_target()
returns trigger
language plpgsql
security definer
set search_path='public','pg_temp'
as $$
declare v_exists boolean:=false;
begin
  if not guestbook_private.is_explorer(new.follower_id) then
    raise exception 'Only Explorer accounts can follow.';
  end if;

  if tg_table_name='explorer_entity_follows' then
    if new.target_type='business' then
      select exists(select 1 from public.businesses where id=new.target_id) into v_exists;
    elsif new.target_type='property' then
      select exists(select 1 from public.properties where id=new.target_id) into v_exists;
    elsif new.target_type='activity_club' then
      select exists(select 1 from public.activity_clubs where id=new.target_id and status in ('open','full')) into v_exists;
    elsif new.target_type='event' then
      select exists(select 1 from public.events where id=new.target_id and status='published') into v_exists;
    elsif new.target_type='public_place' then
      select exists(select 1 from public.public_places where id=new.target_id and status='published') into v_exists;
    else
      raise exception 'Unsupported follow target type.';
    end if;
    if not coalesce(v_exists,false) then raise exception 'This place is unavailable to follow.'; end if;

  elsif tg_table_name='explorer_location_follows' then
    select exists(select 1 from public.geo_areas where id=new.area_id and status='active') into v_exists;
    if not coalesce(v_exists,false) then raise exception 'This area is unavailable to follow.'; end if;

  else
    raise exception 'Unsupported follow table: %',tg_table_name;
  end if;

  return new;
end;
$$;

-- The same ceiling explorer_follows already uses, applied per table so a
-- person cannot spend the person-follow budget on places.
create or replace function guestbook_private.enforce_follow_rate_limit()
returns trigger
language plpgsql
security definer
set search_path='public','pg_temp'
as $$
declare v_count integer;
begin
  if tg_table_name='explorer_entity_follows' then
    select count(*) into v_count from public.explorer_entity_follows
    where follower_id=new.follower_id and created_at>now()-interval '1 hour';
  else
    select count(*) into v_count from public.explorer_location_follows
    where follower_id=new.follower_id and created_at>now()-interval '1 hour';
  end if;

  if v_count>=60 then raise exception 'Follow limit reached. Please try again later.'; end if;
  return new;
end;
$$;

drop trigger if exists explorer_entity_follows_validate on public.explorer_entity_follows;
drop trigger if exists explorer_entity_follows_rate on public.explorer_entity_follows;
create trigger explorer_entity_follows_validate before insert on public.explorer_entity_follows
for each row execute function guestbook_private.validate_follow_target();
create trigger explorer_entity_follows_rate before insert on public.explorer_entity_follows
for each row execute function guestbook_private.enforce_follow_rate_limit();

drop trigger if exists explorer_location_follows_validate on public.explorer_location_follows;
drop trigger if exists explorer_location_follows_rate on public.explorer_location_follows;
create trigger explorer_location_follows_validate before insert on public.explorer_location_follows
for each row execute function guestbook_private.validate_follow_target();
create trigger explorer_location_follows_rate before insert on public.explorer_location_follows
for each row execute function guestbook_private.enforce_follow_rate_limit();

-- ---------------------------------------------------------------------------
-- 3. Row level security
-- ---------------------------------------------------------------------------
-- A person may read, create and delete their own follows and no one else's.
-- explorer_follows lets any authenticated caller read every row because a
-- follower list is a feature there; there is no equivalent feature here, and
-- "which parks does this person visit" is a question about their movements.

alter table public.explorer_entity_follows enable row level security;
alter table public.explorer_location_follows enable row level security;

drop policy if exists explorer_entity_follows_read_own on public.explorer_entity_follows;
drop policy if exists explorer_entity_follows_insert_own on public.explorer_entity_follows;
drop policy if exists explorer_entity_follows_delete_own on public.explorer_entity_follows;
create policy explorer_entity_follows_read_own on public.explorer_entity_follows
  for select to authenticated using (follower_id=(select auth.uid()));
create policy explorer_entity_follows_insert_own on public.explorer_entity_follows
  for insert to authenticated with check (follower_id=(select auth.uid()));
create policy explorer_entity_follows_delete_own on public.explorer_entity_follows
  for delete to authenticated using (follower_id=(select auth.uid()));

drop policy if exists explorer_location_follows_read_own on public.explorer_location_follows;
drop policy if exists explorer_location_follows_insert_own on public.explorer_location_follows;
drop policy if exists explorer_location_follows_delete_own on public.explorer_location_follows;
create policy explorer_location_follows_read_own on public.explorer_location_follows
  for select to authenticated using (follower_id=(select auth.uid()));
create policy explorer_location_follows_insert_own on public.explorer_location_follows
  for insert to authenticated with check (follower_id=(select auth.uid()));
create policy explorer_location_follows_delete_own on public.explorer_location_follows
  for delete to authenticated using (follower_id=(select auth.uid()));

revoke all on public.explorer_entity_follows,public.explorer_location_follows from anon,authenticated;
grant select,insert,delete on public.explorer_entity_follows,public.explorer_location_follows to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Counts without a follower list
-- ---------------------------------------------------------------------------
-- Returns a number and whether the caller is one of them. It cannot be asked
-- who the others are, which is the difference between a place page saying "12
-- Explorers follow this" and a place page leaking twelve names.

create or replace function public.get_entity_follow_stats(p_target_type text,p_target_id uuid)
returns table(follower_count bigint,viewer_following boolean)
language sql
stable
security definer
set search_path='public','pg_temp'
as $$
  select
    (select count(*) from public.explorer_entity_follows f
      where f.target_type=p_target_type and f.target_id=p_target_id),
    exists(select 1 from public.explorer_entity_follows f
      where f.target_type=p_target_type and f.target_id=p_target_id and f.follower_id=auth.uid());
$$;

create or replace function public.get_location_follow_stats(p_area_id uuid)
returns table(follower_count bigint,viewer_following boolean)
language sql
stable
security definer
set search_path='public','pg_temp'
as $$
  select
    (select count(*) from public.explorer_location_follows f where f.area_id=p_area_id),
    exists(select 1 from public.explorer_location_follows f where f.area_id=p_area_id and f.follower_id=auth.uid());
$$;

revoke all on function public.get_entity_follow_stats(text,uuid),public.get_location_follow_stats(uuid) from public,anon;
grant execute on function public.get_entity_follow_stats(text,uuid),public.get_location_follow_stats(uuid) to authenticated;

commit;

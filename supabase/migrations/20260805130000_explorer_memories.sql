-- Packet 8d: Memories.
--
-- WHAT A MEMORY IS, AND WHY IT IS NOT A CHECK-IN
-- The 2026-08-04 privacy review found that "a map of places you have visited"
-- could only be built from `live_checkins` -- the one thing this app promises
-- to forget. A check-in expires between 15 minutes and 4 hours and is
-- deliberately unreadable to anyone else once it does. Plotting a history of
-- them would turn "expires in 4 hours" into "remembered forever, shown back to
-- you on a map".
--
-- A Memory is the owner's answer to that: an explicit, opt-in artifact that a
-- person creates because they want to keep it. It is a separate table with its
-- own lifecycle, and My Map (8b) will read this and never a check-in.
--
-- THE TWO PHASES, WHICH ARE THE WHOLE DESIGN
--
--   Live phase      now() < live_until   ->  `visibility` decides who can read
--   Archive phase   now() >= live_until  ->  `archive_visibility` decides
--
-- and the creator can always read their own, in either phase.
--
-- That split is the point. A public Memory is public *while it is happening*;
-- when its live period ends it leaves the live map, discovery and any future
-- ranking, and it does NOT stay publicly readable unless the creator says so.
-- archive_visibility therefore defaults to 'private' and is never copied from
-- `visibility` -- a person consenting to "everyone can see where I am today"
-- has not consented to "everyone can see where I was, forever".
--
-- Enforced here rather than in a query, because a client-side phase check is a
-- statement about a screen and this needs to be a statement about a row.
--
-- EXPIRY IS REQUIRED FOR ANYTHING SHARED
-- visibility in ('public','friends','selected') requires live_until. A private
-- Memory may sit on the creator's own map forever without one, because nothing
-- about it is ever shown to anybody else. RULES.md: "Anything that reveals
-- position must have an expiry."
--
-- NOT HERE, ON PURPOSE
--   * My Map (8b) -- this packet gives it something to read, nothing more.
--   * The shared activity projection and the living map (8f1).
--   * Ranking and trending (8f2). A Memory has no score and no feed row.
--   * A general sharing or messaging system. `explorer_memory_shares` is a
--     deliberately narrow selected-person list for Memories only, named in the
--     ledger as partial; the general social_shares idea stays unbuilt.
--
-- REVERSAL
--   drop table if exists public.explorer_memory_shares;
--   drop table if exists public.explorer_memories;
--   drop function if exists public.get_explorer_memories(uuid,text);
--   drop function if exists guestbook_private.memory_is_live(timestamptz);
--   drop function if exists guestbook_private.can_read_memory(uuid,uuid);
--   drop function if exists guestbook_private.validate_memory();
--   drop function if exists guestbook_private.snapshot_memory_place();

begin;

-- ---------------------------------------------------------------------------
-- 1. The table
-- ---------------------------------------------------------------------------

create table if not exists public.explorer_memories(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  title text not null default '' check (char_length(title)<=120),
  note text not null default '' check (char_length(note)<=1000),
  media_type text check (media_type is null or media_type in ('image','video')),
  media_url text,
  thumbnail_url text,

  -- Where it happened. Snapshotted from the attached place at creation, the
  -- same way a Moment's location is, so editing the place later cannot rewrite
  -- where a Memory happened.
  target_type text,
  target_id uuid,
  target_name text,
  target_image_url text,
  area_id uuid references public.geo_areas(id) on delete set null,
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),

  -- The lifecycle.
  visibility text not null default 'private'
    check (visibility in ('private','friends','selected','public')),
  live_until timestamptz,
  archive_visibility text not null default 'private'
    check (archive_visibility in ('private','friends','selected','public')),
  show_on_profile boolean not null default false,

  status text not null default 'published' check (status in ('published','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Anything anybody else can see has to stop being live at some point.
  constraint explorer_memories_shared_needs_expiry
    check (visibility='private' or live_until is not null),

  constraint explorer_memories_target_pair
    check ((target_type is null and target_id is null) or (target_type is not null and target_id is not null)),
  constraint explorer_memories_target_type
    check (target_type is null or target_type in ('business','property','activity_club','event','public_place')),
  constraint explorer_memories_media_pair
    check ((media_type is null and media_url is null) or (media_type is not null and media_url is not null)),

  -- A Memory with neither a note nor a picture is not a memory of anything.
  constraint explorer_memories_has_content
    check (char_length(btrim(title))>0 or char_length(btrim(note))>0 or media_url is not null)
);

comment on table public.explorer_memories is
  'An Explorer''s deliberately kept record of somewhere they were. Two phases: `visibility` governs it until live_until, `archive_visibility` after. Never sourced from live_checkins -- a check-in is the thing this app promises to forget.';
comment on column public.explorer_memories.archive_visibility is
  'Who may read this once live_until has passed. Defaults to private and is never copied from `visibility`: consenting to be seen today is not consenting to be seen forever.';

-- The selected-person list. Narrow on purpose: it names who may read one
-- Memory, and it is not a messaging system.
create table if not exists public.explorer_memory_shares(
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references public.explorer_memories(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint explorer_memory_shares_unique unique (memory_id,user_id)
);

create index if not exists explorer_memories_user_created_idx
  on public.explorer_memories(user_id,created_at desc) where status='published';
-- The live public map's access path (8f1 will use it; nothing reads it yet).
create index if not exists explorer_memories_live_public_idx
  on public.explorer_memories(live_until,area_id)
  where status='published' and visibility='public';
create index if not exists explorer_memories_profile_idx
  on public.explorer_memories(user_id,created_at desc)
  where status='published' and show_on_profile=true;
create index if not exists explorer_memory_shares_user_idx
  on public.explorer_memory_shares(user_id,memory_id);

-- ---------------------------------------------------------------------------
-- 2. The phase, and who may read
-- ---------------------------------------------------------------------------

create or replace function guestbook_private.memory_is_live(p_live_until timestamptz)
returns boolean
language sql
immutable
as $$
  select p_live_until is not null and p_live_until > now();
$$;

-- One place decides readability, so the policy, the profile RPC and any later
-- caller cannot drift apart. SECURITY DEFINER because it reads explorer_follows
-- and the share list, which the reader may not be able to read directly.
create or replace function guestbook_private.can_read_memory(p_memory_id uuid,p_viewer uuid)
returns boolean
language plpgsql
stable
security definer
set search_path='public','pg_temp'
as $$
declare
  m public.explorer_memories%rowtype;
  v_rule text;
begin
  select * into m from public.explorer_memories where id=p_memory_id;
  if not found then return false; end if;

  -- The creator can always read their own, in either phase, including a
  -- removed one. Nothing here ever takes a person's own memory away from them.
  if p_viewer is not null and m.user_id=p_viewer then return true; end if;

  if m.status<>'published' then return false; end if;

  -- The phase decides which rule applies. This is the whole packet: a friend
  -- who could read it while it was live loses that when it expires unless the
  -- creator chose to keep the archive open to friends.
  v_rule := case when guestbook_private.memory_is_live(m.live_until)
                 then m.visibility
                 else m.archive_visibility end;

  if v_rule='public' then return true; end if;
  if p_viewer is null then return false; end if;
  if v_rule='private' then return false; end if;
  if v_rule='friends' then return guestbook_private.are_friends(m.user_id,p_viewer); end if;
  if v_rule='selected' then
    return exists(select 1 from public.explorer_memory_shares s
                  where s.memory_id=m.id and s.user_id=p_viewer);
  end if;

  return false;
end;
$$;

revoke all on function guestbook_private.can_read_memory(uuid,uuid) from public,anon;
grant execute on function guestbook_private.can_read_memory(uuid,uuid) to authenticated;
revoke all on function guestbook_private.memory_is_live(timestamptz) from public,anon;
grant execute on function guestbook_private.memory_is_live(timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Validation and the location snapshot
-- ---------------------------------------------------------------------------

create or replace function guestbook_private.snapshot_memory_place()
returns trigger
language plpgsql
security definer
set search_path='public','pg_temp'
as $$
declare
  v_name text; v_image text; v_area uuid; v_lat double precision; v_lng double precision;
  v_found boolean:=false;
begin
  if new.target_type is not null and new.target_id is not null then
    if new.target_type='business' then
      select b.name,coalesce(b.image,b.photos[1]),b.area_id,b.latitude,b.longitude
        into v_name,v_image,v_area,v_lat,v_lng from public.businesses b where b.id=new.target_id;
      v_found:=found;
    elsif new.target_type='property' then
      select p.name,p.photos[1],p.area_id,p.latitude,p.longitude
        into v_name,v_image,v_area,v_lat,v_lng from public.properties p where p.id=new.target_id;
      v_found:=found;
    elsif new.target_type='activity_club' then
      select c.name,c.image_url,c.area_id,c.latitude,c.longitude
        into v_name,v_image,v_area,v_lat,v_lng from public.activity_clubs c where c.id=new.target_id;
      v_found:=found;
    elsif new.target_type='event' then
      select e.name,e.image_url,e.area_id,e.latitude,e.longitude
        into v_name,v_image,v_area,v_lat,v_lng from public.events e where e.id=new.target_id;
      v_found:=found;
    elsif new.target_type='public_place' then
      select pp.name,pp.image_url,pp.area_id,pp.latitude,pp.longitude
        into v_name,v_image,v_area,v_lat,v_lng from public.public_places pp where pp.id=new.target_id;
      v_found:=found;
    end if;

    if v_found then
      new.target_name:=v_name;
      new.target_image_url:=v_image;
      new.area_id:=v_area;
      new.latitude:=v_lat;
      new.longitude:=v_lng;
    end if;
  elsif new.area_id is null then
    select p.area_id into new.area_id from public.profiles p where p.id=new.user_id;
  end if;

  if new.latitude is not null then new.latitude:=round(new.latitude::numeric,3)::double precision; end if;
  if new.longitude is not null then new.longitude:=round(new.longitude::numeric,3)::double precision; end if;
  if new.latitude is null or new.longitude is null then
    new.latitude:=null; new.longitude:=null;
  end if;

  return new;
end;
$$;

create or replace function guestbook_private.validate_memory()
returns trigger
language plpgsql
security definer
set search_path='public','pg_temp'
as $$
declare v_exists boolean:=false;
begin
  if not guestbook_private.is_explorer(new.user_id) then
    raise exception 'Only Explorer accounts can keep Memories';
  end if;

  if new.target_type is not null then
    if new.target_type='business' then select exists(select 1 from public.businesses where id=new.target_id) into v_exists;
    elsif new.target_type='property' then select exists(select 1 from public.properties where id=new.target_id) into v_exists;
    elsif new.target_type='activity_club' then select exists(select 1 from public.activity_clubs where id=new.target_id and status in ('open','full')) into v_exists;
    elsif new.target_type='event' then select exists(select 1 from public.events where id=new.target_id and status='published') into v_exists;
    elsif new.target_type='public_place' then select exists(select 1 from public.public_places where id=new.target_id and status='published') into v_exists;
    else raise exception 'Unsupported attached place type';
    end if;
    if not coalesce(v_exists,false) then raise exception 'The attached place is unavailable'; end if;
  end if;

  -- Said twice on purpose: the table constraint stops a null slipping in, and
  -- this says why in words a person will see.
  if new.visibility<>'private' and new.live_until is null then
    raise exception 'A Memory other people can see needs an end date for its live period';
  end if;

  if new.live_until is not null and tg_op='INSERT' and new.live_until<=now() then
    raise exception 'The live period must end in the future';
  end if;

  -- Changing the archive setting is allowed at any time. Changing it never
  -- puts a Memory back on the live map: `visibility` is what the live phase
  -- reads, and an expired Memory is never live again.
  if tg_op='UPDATE' and old.live_until is not null and old.live_until<=now()
     and new.live_until is distinct from old.live_until then
    raise exception 'The live period has already ended and cannot be restarted';
  end if;

  new.updated_at:=now();
  return new;
end;
$$;

drop trigger if exists explorer_memories_snapshot on public.explorer_memories;
drop trigger if exists explorer_memories_validate on public.explorer_memories;
create trigger explorer_memories_snapshot before insert on public.explorer_memories
for each row execute function guestbook_private.snapshot_memory_place();
create trigger explorer_memories_validate before insert or update on public.explorer_memories
for each row execute function guestbook_private.validate_memory();

-- A share may only be made by the Memory's creator, and only for a Memory that
-- actually uses the selected list.
create or replace function guestbook_private.validate_memory_share()
returns trigger
language plpgsql
security definer
set search_path='public','pg_temp'
as $$
declare v_owner uuid;
begin
  select user_id into v_owner from public.explorer_memories where id=new.memory_id;
  if v_owner is null then raise exception 'This Memory is unavailable'; end if;
  if v_owner<>auth.uid() then raise exception 'Only the Memory''s owner can choose who sees it'; end if;
  if new.user_id=v_owner then raise exception 'You already have access to your own Memory'; end if;
  if not guestbook_private.is_explorer(new.user_id) then raise exception 'You can only share with an Explorer'; end if;
  return new;
end;
$$;

drop trigger if exists explorer_memory_shares_validate on public.explorer_memory_shares;
create trigger explorer_memory_shares_validate before insert on public.explorer_memory_shares
for each row execute function guestbook_private.validate_memory_share();

-- ---------------------------------------------------------------------------
-- 4. Row level security
-- ---------------------------------------------------------------------------
-- Split by role for the same reason 20260805120400 split the Moment policy:
-- anon cannot execute anything in guestbook_private, so its rule must not
-- call into it. A signed-out visitor sees a Memory only while it is live and
-- public, or after expiry if its archive was deliberately made public.

alter table public.explorer_memories enable row level security;
alter table public.explorer_memory_shares enable row level security;

drop policy if exists explorer_memories_read_anon on public.explorer_memories;
drop policy if exists explorer_memories_read_authenticated on public.explorer_memories;
drop policy if exists explorer_memories_insert_own on public.explorer_memories;
drop policy if exists explorer_memories_update_own on public.explorer_memories;
drop policy if exists explorer_memories_delete_own on public.explorer_memories;

create policy explorer_memories_read_anon on public.explorer_memories
for select to anon using (
  status='published'
  and case when live_until is not null and live_until>now()
           then visibility='public'
           else archive_visibility='public' end
);

create policy explorer_memories_read_authenticated on public.explorer_memories
for select to authenticated using (
  user_id=(select auth.uid()) or guestbook_private.can_read_memory(id,(select auth.uid()))
);

create policy explorer_memories_insert_own on public.explorer_memories
for insert to authenticated with check (user_id=(select auth.uid()));

create policy explorer_memories_update_own on public.explorer_memories
for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));

create policy explorer_memories_delete_own on public.explorer_memories
for delete to authenticated using (user_id=(select auth.uid()));

drop policy if exists explorer_memory_shares_read on public.explorer_memory_shares;
drop policy if exists explorer_memory_shares_write_owner on public.explorer_memory_shares;

-- You can see a share row if it is about you, or if you own the Memory.
create policy explorer_memory_shares_read on public.explorer_memory_shares
for select to authenticated using (
  user_id=(select auth.uid())
  or exists(select 1 from public.explorer_memories m where m.id=memory_id and m.user_id=(select auth.uid()))
);

create policy explorer_memory_shares_write_owner on public.explorer_memory_shares
for all to authenticated
using (exists(select 1 from public.explorer_memories m where m.id=memory_id and m.user_id=(select auth.uid())))
with check (exists(select 1 from public.explorer_memories m where m.id=memory_id and m.user_id=(select auth.uid())));

revoke all on public.explorer_memories,public.explorer_memory_shares from anon,authenticated;
grant select on public.explorer_memories to anon,authenticated;
grant insert,update,delete on public.explorer_memories to authenticated;
grant select,insert,delete on public.explorer_memory_shares to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Reading a person's Memories
-- ---------------------------------------------------------------------------
-- SECURITY INVOKER, so the policies above are what decide -- this function
-- shapes a list, it does not grant one. `p_scope` picks the phase; the profile
-- passes 'profile', which is additionally filtered by show_on_profile.
--
-- show_on_profile is not a permission. It means "include this in my profile IF
-- the viewer is allowed to see it", so a private Memory with the flag set is
-- still visible only to its owner -- the policy sees to that, not this list.

create or replace function public.get_explorer_memories(p_user_id uuid,p_scope text default 'all')
returns table(
  id uuid,user_id uuid,title text,note text,media_type text,media_url text,thumbnail_url text,
  target_type text,target_id uuid,target_name text,target_image_url text,area_id uuid,
  latitude double precision,longitude double precision,
  visibility text,archive_visibility text,live_until timestamptz,is_live boolean,
  show_on_profile boolean,created_at timestamptz
)
language sql
stable
set search_path='public','pg_temp'
as $$
  select m.id,m.user_id,m.title,m.note,m.media_type,m.media_url,m.thumbnail_url,
    m.target_type,m.target_id,m.target_name,m.target_image_url,m.area_id,
    m.latitude,m.longitude,
    m.visibility,m.archive_visibility,m.live_until,
    (m.live_until is not null and m.live_until>now()) as is_live,
    m.show_on_profile,m.created_at
  from public.explorer_memories m
  where m.user_id=p_user_id
    and m.status='published'
    and (
      coalesce(p_scope,'all')='all'
      or (p_scope='live' and m.live_until is not null and m.live_until>now())
      or (p_scope='archive' and (m.live_until is null or m.live_until<=now()))
      or (p_scope='profile' and m.show_on_profile=true)
    )
  order by m.created_at desc
  limit 200;
$$;

comment on function public.get_explorer_memories(uuid,text) is
  'SECURITY INVOKER: row level security decides what comes back. Shapes and orders a list, never widens one.';

revoke all on function public.get_explorer_memories(uuid,text) from public;
grant execute on function public.get_explorer_memories(uuid,text) to anon,authenticated;

commit;

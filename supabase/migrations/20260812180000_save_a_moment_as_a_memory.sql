-- Step 7: a Moment becomes a Memory.
--
-- WHAT EXISTED AND WHAT DID NOT
--
-- 20260811210000 added explorer_moments.save_to_memory and .memory_id and
-- described exactly what they would mean. Nothing has ever written either
-- column, and no code anywhere reads them. The intent was recorded; the
-- transition was not built.
--
-- THE RULE, AND IT IS THE WHOLE POINT
--
-- A Moment that becomes a Memory does NOT become visible to more people. The
-- Memory inherits the Moment's audience, for both of its phases. Somebody
-- posted a thing for their friends for one day; turning it into something
-- permanent must not also turn it into something public. If they want it wider
-- afterwards they can widen the Memory themselves, deliberately, on its own
-- screen.
--
-- Moment and Memory stay TWO ROWS. The Moment still expires and still stops
-- being live. The Memory is a new record that happens to have been born from
-- it. RULES.md: "A Moment with Save to Memories on produces a Memory; the
-- Memory is its own record."
--
-- WHY THERE IS NO SCHEDULER
--
-- Nothing in this project runs on a timer. So the transition is a function the
-- owner's own client calls -- settle_my_moments() -- which converts any of the
-- CALLER'S expired, flagged Moments that have not been converted yet. Lazy,
-- deterministic, and it needs no infrastructure that does not exist.
--
-- The alternative was a trigger, and a trigger cannot fire on time passing.
--
-- Both functions are idempotent. Calling them twice produces one Memory,
-- because memory_id is checked first and the unique work is done under it.
--
-- TO UNDO
--   drop function if exists public.settle_my_moments();
--   drop function if exists public.save_moment_as_memory(uuid);

begin;

-- ---------------------------------------------------------------------------
-- 1. One Moment, kept
-- ---------------------------------------------------------------------------

create or replace function public.save_moment_as_memory(p_moment_id uuid)
returns uuid
language plpgsql
security definer
set search_path='public','pg_temp'
as $$
declare
  v_moment public.explorer_moments%rowtype;
  v_memory_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Log in to do this.';
  end if;

  select * into v_moment from public.explorer_moments where id=p_moment_id;
  if not found then
    raise exception 'That Moment could not be found.';
  end if;

  -- Only its owner. Not a manager, not an admin: a Memory is somebody's own
  -- scrapbook page and nobody else gets to write one into it.
  if v_moment.user_id <> auth.uid() then
    raise exception 'Only the Explorer who posted a Moment can keep it.';
  end if;

  -- Already kept. Return the same Memory rather than making a second one.
  if v_moment.memory_id is not null then
    return v_moment.memory_id;
  end if;

  insert into public.explorer_memories(
    user_id,title,note,media_type,media_url,thumbnail_url,
    target_type,target_id,target_name,target_image_url,
    latitude,longitude,
    visibility,archive_visibility,
    show_on_profile,origin
  ) values (
    v_moment.user_id,
    -- A Moment has a caption, not a title. Using the caption for both would
    -- print the same sentence twice on the Memory screen.
    nullif(left(coalesce(v_moment.caption,''),80),''),
    nullif(coalesce(v_moment.caption,''),''),
    v_moment.media_type,
    v_moment.media_url,
    v_moment.thumbnail_url,
    v_moment.target_type,v_moment.target_id,v_moment.target_name,v_moment.target_image_url,
    v_moment.latitude,v_moment.longitude,
    -- THE RULE. Never wider than the Moment was.
    v_moment.visibility,
    v_moment.visibility,
    false,
    -- 20260811240000 defined this value and nothing had ever produced one.
    'from_moment'
  )
  returning id into v_memory_id;

  update public.explorer_moments
  set save_to_memory=true,memory_id=v_memory_id
  where id=p_moment_id;

  return v_memory_id;
end;
$$;

comment on function public.save_moment_as_memory(uuid) is
  'Turns one of the caller''s own Moments into a Memory. The Memory inherits the Moment''s audience for both phases -- keeping something must never widen it. Idempotent: a Moment already kept returns the Memory it already produced.';

revoke all on function public.save_moment_as_memory(uuid) from public,anon;
grant execute on function public.save_moment_as_memory(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Everything the caller asked to keep, once it has expired
-- ---------------------------------------------------------------------------
-- Scoped to auth.uid() and nobody else. Safe to call on every app open.

create or replace function public.settle_my_moments()
returns integer
language plpgsql
security definer
set search_path='public','pg_temp'
as $$
declare
  v_id uuid;
  v_kept integer := 0;
begin
  if auth.uid() is null then
    return 0;
  end if;

  for v_id in
    select id from public.explorer_moments
    where user_id=auth.uid()
      and save_to_memory
      and memory_id is null
      and expires_at <= now()
  loop
    perform public.save_moment_as_memory(v_id);
    v_kept := v_kept + 1;
  end loop;

  return v_kept;
end;
$$;

comment on function public.settle_my_moments() is
  'Converts the caller''s own expired Moments that were marked Save to Memories. Lazy rather than scheduled: nothing in this project runs on a timer, and a trigger cannot fire on time passing. Safe and cheap to call on app open.';

revoke all on function public.settle_my_moments() from public,anon;
grant execute on function public.settle_my_moments() to authenticated;

commit;

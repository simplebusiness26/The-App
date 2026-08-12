-- Step 5 -- a Memory is permanent content with a temporary place on today's map.
--
-- THE DISTINCTION THIS BUILDS
--
--   Audience          decides WHO can see the Memory.        (visibility)
--   Map duration      decides HOW LONG it sits on the        (map_until)
--                     current map.
--   Historical map    decides WHEN an old one resurfaces.    (created_at)
--
-- These are three separate things and the schema now says so. Before this,
-- there was one column doing the first and second jobs at once -- live_until,
-- with archive_visibility taking over afterwards -- which forced a shared
-- Memory to eventually stop being shared. That is the constraint being removed:
--
--   check (visibility='nobody' or live_until is not null)
--
-- A Memory the owner chose to share with friends stays shared with friends
-- until they change it or delete it. It leaves TODAY'S map when map_until
-- passes, and it never leaves the profile gallery, My Map, or the historical
-- map.
--
-- WHAT HAPPENS TO archive_visibility
--
-- It is kept, not dropped, and it stops being required. Its original purpose --
-- "consenting to be seen today is not consenting to be seen forever" -- is a
-- real protection, and the two-phase model is now OPTIONAL rather than forced:
-- leave it null and the Memory keeps one audience for life, which is what the
-- specification describes. Set it and the Memory narrows itself when it leaves
-- the current map, which somebody may still want. Nothing that already relies
-- on it breaks.
--
-- THE 15 MEMORIES THAT EXIST are all 'nobody' (formerly 'private'), so none of
-- them is affected by any of this. Their map_until is backfilled from their
-- own created_at, so none of them appears on today's map either.
--
-- TO UNDO
--   alter table public.explorer_memories drop column if exists map_until,
--     drop column if exists origin;
--   (restore the shared_needs_expiry constraint from 20260811220000.)

begin;

alter table public.explorer_memories
  add column if not exists map_until timestamptz,
  add column if not exists origin text not null default 'direct';

comment on column public.explorer_memories.map_until is
  'When this Memory stops appearing on the CURRENT map. Nothing to do with deletion, with the profile gallery, with My Map, or with the historical map -- it leaves today''s map and stays everywhere else. Null means it was never meant for the current map.';
comment on column public.explorer_memories.origin is
  'direct = created as a Memory. from_moment = produced by a Moment whose Save to Memories was on. The Memory is its own record either way; this only records where it came from.';

alter table public.explorer_memories
  drop constraint if exists explorer_memories_origin_check;
alter table public.explorer_memories
  add constraint explorer_memories_origin_check
  check (origin in ('direct','from_moment'));

-- A map presence that ends before it began is a bug, not a choice.
alter table public.explorer_memories
  drop constraint if exists explorer_memories_map_until_after_creation;
alter table public.explorer_memories
  add constraint explorer_memories_map_until_after_creation
  check (map_until is null or map_until > created_at);

-- THE CONSTRAINT THAT FORCED A SHARED MEMORY TO EXPIRE. This is the line the
-- specification overrides: a Memory is permanent content, so sharing it no
-- longer obliges it to stop being shared.
alter table public.explorer_memories
  drop constraint if exists explorer_memories_shared_needs_expiry;

-- archive_visibility becomes optional. Null means "keep one audience for life".
alter table public.explorer_memories
  alter column archive_visibility drop not null;
alter table public.explorer_memories
  alter column archive_visibility drop default;

-- Existing rows kept their forced two-phase setup; null it out where it just
-- mirrors the live audience, so it only survives where it says something.
update public.explorer_memories
set archive_visibility = null
where archive_visibility = visibility;

-- Backfill the current-map window from each Memory's own date. All 15 existing
-- rows are 'nobody', so this puts none of them on anybody's map.
update public.explorer_memories
set map_until = created_at + interval '7 days'
where map_until is null;

create index if not exists explorer_memories_map_window_idx
  on public.explorer_memories(map_until desc)
  where status='published';
create index if not exists explorer_memories_history_idx
  on public.explorer_memories(created_at desc)
  where status='published';

-- ---------------------------------------------------------------------------
-- Is this Memory on today's map
-- ---------------------------------------------------------------------------
-- One definition, so the current-map layer and the historical layer cannot
-- drift apart. Fading is the app's job -- this returns how far through the
-- window the Memory is, so the pin can fade rather than vanish.

create or replace function guestbook_private.memory_map_age(p_memory_id uuid)
returns numeric
language sql
stable
security definer
set search_path='public','pg_temp'
as $$
  select case
    when m.map_until is null or m.map_until <= now() then null
    when m.map_until <= m.created_at then null
    else greatest(0,least(1,
      extract(epoch from (now() - m.created_at))
      / nullif(extract(epoch from (m.map_until - m.created_at)),0)
    ))
  end
  from public.explorer_memories m
  where m.id = p_memory_id;
$$;

comment on function guestbook_private.memory_map_age(uuid) is
  'How far through its current-map window a Memory is: 0 just posted, 1 about to leave the map, null once it has left or was never on it. The app fades the pin with this rather than dropping it abruptly.';

revoke all on function guestbook_private.memory_map_age(uuid) from public, anon;
grant execute on function guestbook_private.memory_map_age(uuid) to authenticated;

commit;

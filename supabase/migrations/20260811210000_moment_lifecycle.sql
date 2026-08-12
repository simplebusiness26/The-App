-- Step 1 of the Moments and Memories specification -- a Moment is temporary.
--
-- WHAT IS WRONG TODAY
--
-- explorer_moments has no lifecycle at all. Its only states are 'published' and
-- 'removed', there is no expiry column anywhere, and nothing ages. A Moment
-- posted nine days ago is exactly as live as one posted a minute ago.
--
-- Meanwhile explorer_memories DOES have a lifecycle -- live_until, plus a
-- second visibility for after it. The two tables are the product model exactly
-- inverted: the temporary thing is permanent and the permanent thing expires.
-- This migration fixes the first half.
--
-- WHAT A MOMENT BECOMES
--
--   expires_at        when it stops being live. Defaults to 24 hours out.
--   save_to_memory    whether it should persist as a Memory afterwards.
--   memory_id         the Memory it produced, once it has produced one.
--
-- A Moment is LIVE when status='published' and expires_at > now(). Live is what
-- the news feed, the heat layer and the profile story ring all mean. Past
-- Moments are not deleted -- they stay in the table, and whether anything shows
-- them is a question for the surfaces, not for this table.
--
-- WHY 24 HOURS
--
-- It is the convention people already understand from every other app with a
-- story, and it is a column default rather than a hardcoded rule, so a future
-- packet can offer a choice without a migration.
--
-- WHAT HAPPENS TO THE 60 MOMENTS THAT ALREADY EXIST
--
-- Every one of them is public and every one is already older than 24 hours, so
-- backfilling created_at + 24h makes all 60 past immediately. They are NOT
-- deleted and NOT edited -- the rows stay exactly as they are, and they remain
-- readable by anything that asks for past Moments.
--
-- This is a visible change: those 60 stop appearing in the feed. The
-- alternative -- giving old Moments a null or far-future expiry -- would leave
-- them live forever and put nine-day-old posts in a story ring, which is the
-- bug this step exists to remove. Flagged for the owner rather than decided
-- quietly: if those 60 should be preserved as visible content, the right answer
-- is to convert them to Memories, which is step 7's machinery, not a different
-- expiry here.
--
-- TO UNDO
--   alter table public.explorer_moments
--     drop column if exists expires_at,
--     drop column if exists save_to_memory,
--     drop column if exists memory_id;

begin;

alter table public.explorer_moments
  add column if not exists expires_at timestamptz not null default (now() + interval '24 hours'),
  add column if not exists save_to_memory boolean not null default false,
  add column if not exists memory_id uuid references public.explorer_memories(id) on delete set null;

comment on column public.explorer_moments.expires_at is
  'When this Moment stops being live. Live = status published AND expires_at in the future. Past Moments are never deleted by expiry; they simply stop being surfaced as current.';
comment on column public.explorer_moments.save_to_memory is
  'Whether this Moment should persist as a Memory once it stops being live. The Memory is a separate record -- Moment and Memory are different content types.';
comment on column public.explorer_moments.memory_id is
  'The Memory this Moment produced, once it has produced one. Null while live, and null forever if save_to_memory was off.';

-- The backfill. Every existing row keeps its own created_at as the anchor, so
-- nothing gets a lifetime it did not earn.
update public.explorer_moments
set expires_at = created_at + interval '24 hours'
where expires_at is null or expires_at = created_at;

-- A Moment cannot expire before it was posted.
alter table public.explorer_moments
  drop constraint if exists explorer_moments_expiry_after_creation;
alter table public.explorer_moments
  add constraint explorer_moments_expiry_after_creation
  check (expires_at > created_at);

-- memory_id only means something once the Moment asked for a Memory.
alter table public.explorer_moments
  drop constraint if exists explorer_moments_memory_needs_flag;
alter table public.explorer_moments
  add constraint explorer_moments_memory_needs_flag
  check (memory_id is null or save_to_memory);

-- The index the live surfaces will all use: "what is live right now".
create index if not exists explorer_moments_live_idx
  on public.explorer_moments(expires_at desc)
  where status='published';

-- ---------------------------------------------------------------------------
-- One definition of "live"
-- ---------------------------------------------------------------------------
-- Written once here rather than as `status='published' and expires_at>now()`
-- copied into the feed, the heat layer, the story ring and the map. That copying
-- is exactly how the follow test ended up wrong in three places and the review
-- read path in four.

create or replace function guestbook_private.moment_is_live(p_moment_id uuid)
returns boolean
language sql
stable
security definer
set search_path='public','pg_temp'
as $$
  select exists(
    select 1 from public.explorer_moments m
    where m.id = p_moment_id
      and m.status = 'published'
      and m.expires_at > now()
  );
$$;

comment on function guestbook_private.moment_is_live(uuid) is
  'Is this Moment currently live. The single definition -- the feed, the heat layer, the story ring and the map all mean this and must not re-implement it.';

revoke all on function guestbook_private.moment_is_live(uuid) from public, anon;
grant execute on function guestbook_private.moment_is_live(uuid) to authenticated;

commit;

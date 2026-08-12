-- Step 3 -- who has seen whose Moments.
--
-- Nothing tracks this today. It is entirely new, and it is the thing the
-- profile-picture ring is computed from.
--
-- THE THREE STATES, per viewer per Explorer:
--
--   no live Moments                  -> plain profile picture
--   live Moments, at least one unseen -> highlighted
--   live Moments, all seen            -> seen state
--
-- Two rules that are easy to get wrong and are enforced here rather than in the
-- app:
--
--   Privacy is applied BEFORE counting. A Moment the viewer may not see must
--   not make a ring appear -- an unexplained highlight that opens to nothing is
--   itself a disclosure that something exists.
--
--   Seeing one Explorer's Moments marks only that Explorer's. The unique key is
--   (moment_id, viewer_id), so there is no way to mark in bulk by author.
--
-- Reviews and Memories never appear here. Only Moments have this behaviour.

begin;

create table if not exists public.moment_views(
  moment_id uuid not null references public.explorer_moments(id) on delete cascade,
  viewer_id uuid not null references auth.users(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (moment_id,viewer_id)
);

create index if not exists moment_views_viewer_idx on public.moment_views(viewer_id);

comment on table public.moment_views is
  'One row per Explorer per Moment they have watched. Drives the profile-picture ring. Keyed per Moment, so watching one author never marks another.';

alter table public.moment_views enable row level security;

-- You may record and read your own views, and nobody else's. The author does
-- NOT get a read policy here: who watched your Moment is a viewer-count
-- feature nobody has asked for, and handing out the list is not the same thing.
drop policy if exists moment_views_own_read on public.moment_views;
create policy moment_views_own_read on public.moment_views
  for select to authenticated using (viewer_id = (select auth.uid()));

drop policy if exists moment_views_own_write on public.moment_views;
create policy moment_views_own_write on public.moment_views
  for insert to authenticated with check (
    viewer_id = (select auth.uid())
    -- You cannot record having watched something you were never allowed to see.
    and guestbook_private.can_see_content(
      (select m.user_id from public.explorer_moments m where m.id = moment_id),
      (select auth.uid()),
      (select m.visibility from public.explorer_moments m where m.id = moment_id)
    )
  );

revoke all on public.moment_views from anon, authenticated;
grant select, insert on public.moment_views to authenticated;

-- ---------------------------------------------------------------------------
-- Marking one watched
-- ---------------------------------------------------------------------------

create or replace function public.mark_moment_viewed(p_moment_id uuid)
returns void
language sql
security invoker
set search_path=public
as $$
  insert into public.moment_views(moment_id,viewer_id)
  values (p_moment_id,auth.uid())
  on conflict (moment_id,viewer_id) do nothing;
$$;

revoke all on function public.mark_moment_viewed(uuid) from public, anon;
grant execute on function public.mark_moment_viewed(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- The ring state for one Explorer
-- ---------------------------------------------------------------------------
-- Returns what the profile picture needs and nothing more: whether to draw a
-- ring, and whether it is the unseen ring. It deliberately does not return the
-- Moments themselves -- fetching those is a separate call made when somebody
-- actually taps, so a profile listing cannot be used to enumerate content.

create or replace function public.get_moment_story_state(p_owner_id uuid)
returns table(live_count integer,unseen_count integer)
language sql
stable
security invoker
set search_path=public
as $$
  select
    count(*)::integer as live_count,
    count(*) filter (
      where not exists(
        select 1 from public.moment_views v
        where v.moment_id = m.id and v.viewer_id = auth.uid()
      )
    )::integer as unseen_count
  from public.explorer_moments m
  where m.user_id = p_owner_id
    and m.status = 'published'
    and m.expires_at > now()
    -- Privacy first. Row level security on explorer_moments applies as well,
    -- because this is security invoker; the explicit test is the second lock,
    -- the same way the trending function has one.
    and guestbook_private.can_see_content(m.user_id,auth.uid(),m.visibility);
$$;

comment on function public.get_moment_story_state(uuid) is
  'How the profile picture should be drawn for the calling viewer: how many of this Explorer''s Moments are live and visible to them, and how many of those they have not watched. Returns counts only, never content.';

revoke all on function public.get_moment_story_state(uuid) from public, anon;
grant execute on function public.get_moment_story_state(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- The Moments themselves, in order, for the story viewer
-- ---------------------------------------------------------------------------

create or replace function public.get_live_moments(p_owner_id uuid)
returns table(
  id uuid,caption text,media_type text,media_url text,thumbnail_url text,
  duration_seconds numeric,created_at timestamptz,expires_at timestamptz,
  target_type text,target_id uuid,target_name text,viewed boolean
)
language sql
stable
security invoker
set search_path=public
as $$
  select
    m.id,m.caption,m.media_type,m.media_url,m.thumbnail_url,
    m.duration_seconds,m.created_at,m.expires_at,
    m.target_type,m.target_id,m.target_name,
    exists(select 1 from public.moment_views v where v.moment_id=m.id and v.viewer_id=auth.uid()) as viewed
  from public.explorer_moments m
  where m.user_id = p_owner_id
    and m.status='published'
    and m.expires_at > now()
    and guestbook_private.can_see_content(m.user_id,auth.uid(),m.visibility)
  order by m.created_at asc;
$$;

comment on function public.get_live_moments(uuid) is
  'One Explorer''s currently live, visible Moments, oldest first, for the story viewer.';

revoke all on function public.get_live_moments(uuid) from public, anon;
grant execute on function public.get_live_moments(uuid) to authenticated;

commit;

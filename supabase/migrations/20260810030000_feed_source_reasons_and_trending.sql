-- Packet 8f2: why something is in your feed, and what is trending.
--
-- TWO THINGS, BOTH SPECIFIED BY THE OWNER.
--
-- 1. `source_reasons text[]` on every feed item, rather than one lossy label.
--    A Moment can be in your feed because you follow the poster AND because it
--    is at a place you follow; collapsing that to a single reason throws away
--    the more interesting half. The array is deduplicated and the client orders
--    it most-specific-first (utils/trending.js owns that order, so the wording
--    can change without a migration).
--
-- 2. `get_trending_places()` — the counts the ranking needs. The formula itself
--    lives in utils/trending.js and is NOT reproduced here: ranking inside SQL
--    can only be changed by a migration and can only be checked against
--    production. This function's whole job is to return honest counts.
--
-- WHY THE FEED FUNCTION IS DROPPED AND RECREATED
-- CREATE OR REPLACE cannot add a column to a function's RETURNS TABLE. The
-- argument signature is unchanged, so no client call has to change.
--
-- THIS BODY WAS REBUILT FROM `pg_get_functiondef` ON THE LIVE PROJECT, not from
-- the migration that created it. 8c and 8e both record what happens otherwise:
-- 20260802191500 widened an activity-club check and 20260805120300 added the
-- friends-only branch, and reproducing an older file's text would silently
-- revert them. The only change below is the source_reasons column.
--
-- SECURITY INVOKER throughout. Row level security decides what a caller sees,
-- which is also what keeps "public content only" true of trending: a
-- friends-only Moment is invisible to the aggregate because it is invisible to
-- the reader, not because a WHERE clause remembered to exclude it.
--
-- REVERSAL
--   the previous definition of public.get_explorer_social_feed(integer,integer)
--   drop function if exists public.get_trending_places(integer);

begin;

drop function if exists public.get_explorer_social_feed(integer,integer);

create function public.get_explorer_social_feed(p_limit integer default 20,p_offset integer default 0)
returns table(
  item_id uuid,item_type text,actor_id uuid,actor_name text,actor_photo text,created_at timestamptz,
  caption text,rating integer,verified_qr boolean,target_type text,target_id uuid,target_name text,target_image_url text,
  media_type text,media_url text,thumbnail_url text,duration_seconds numeric,like_count bigint,comment_count bigint,
  viewer_liked boolean,source_reasons text[]
)
language sql
stable
set search_path='public','pg_temp'
as $$
  with viewer as (select auth.uid() as id),
  people as (
    select following_id as user_id from public.explorer_follows,viewer where follower_id=viewer.id
    union select id from viewer where id is not null
  ),
  moments as (
    select m.id,'moment'::text,m.user_id,p.full_name,p.profile_photo,m.created_at,m.caption,null::integer,false,
      m.target_type,m.target_id,m.target_name,m.target_image_url,m.media_type,m.media_url,m.thumbnail_url,m.duration_seconds,
      (select count(*) from public.social_likes l where l.target_type='moment' and l.target_id=m.id),
      (select count(*) from public.social_comments c where c.target_type='moment' and c.target_id=m.id and c.status='published'),
      exists(select 1 from public.social_likes l,viewer where l.target_type='moment' and l.target_id=m.id and l.user_id=viewer.id)
    from public.explorer_moments m
    join people pe on pe.user_id=m.user_id
    join public.profiles p on p.id=m.user_id
    cross join viewer v
    where m.status='published'
      and (
        m.user_id=v.id
        or m.visibility='public'
        or guestbook_private.are_friends(m.user_id,v.id)
      )
  ),
  reviews as (
    select er.id,'review'::text,er.user_id,p.full_name,p.profile_photo,er.created_at,
      coalesce(nullif(er.title,''),er.comment),er.rating,er.verified_qr,er.target_type,er.target_id,er.target_name,er.target_image_url,
      rm.media_type,rm.media_url,rm.thumbnail_url,rm.duration_seconds,
      (select count(*) from public.social_likes l where l.target_type='review' and l.target_id=er.id),
      (select count(*) from public.social_comments c where c.target_type='video_review' and c.target_id=er.id and c.status='published'),
      exists(select 1 from public.social_likes l,viewer where l.target_type='review' and l.target_id=er.id and l.user_id=viewer.id)
    from public.explorer_reviews er join people pe on pe.user_id=er.user_id join public.profiles p on p.id=er.user_id
    left join lateral (
      select media_type,media_url,thumbnail_url,duration_seconds from public.review_media
      where review_id=er.id and moderation_status='published'
      order by case when media_type='video' then 0 else 1 end,sort_order asc limit 1
    ) rm on true
    where er.status='published'
  ),
  favourites as (
    select ef.id,'favourite'::text,ef.user_id,p.full_name,p.profile_photo,ef.created_at,
      'Saved '||ef.target_name||' as a favourite place.'::text,null::integer,false,ef.target_type,ef.target_id,ef.target_name,ef.target_image_url,
      case when ef.target_image_url is not null then 'image' else null end,ef.target_image_url,null::text,null::numeric,
      0::bigint,0::bigint,false
    from public.explorer_favourites ef join people pe on pe.user_id=ef.user_id join public.profiles p on p.id=ef.user_id
    where ef.is_public=true
  ),
  -- The three branches select positional columns, so the union has no usable
  -- names -- the original function relied on RETURNS TABLE mapping them by
  -- position. The reason clauses below need to refer to actor_id and target_id
  -- by name, so the CTE names them explicitly. Caught by compiling this against
  -- the live schema before applying it: `column f.actor_id does not exist`.
  feed(item_id,item_type,actor_id,actor_name,actor_photo,created_at,caption,rating,
       verified_qr,target_type,target_id,target_name,target_image_url,media_type,
       media_url,thumbnail_url,duration_seconds,like_count,comment_count,viewer_liked) as (
    select * from moments union all select * from reviews union all select * from favourites
  )
  select f.*,
    -- The reasons, as a set. `array_remove(..., null)` rather than a filtered
    -- list so an item that matches nothing gets an empty array instead of a
    -- null the client would have to special-case.
    array_remove(array[
      case when f.actor_id=v.id then 'Yours' end,
      case when exists(
        select 1 from public.explorer_follows ef
        where ef.follower_id=v.id and ef.following_id=f.actor_id
      ) then 'You follow this Explorer' end,
      case when f.target_id is not null and exists(
        select 1 from public.explorer_entity_follows en
        where en.follower_id=v.id and en.target_type=f.target_type and en.target_id=f.target_id
      ) then 'You follow this place' end,
      case when exists(
        select 1 from public.explorer_location_follows lo
        join public.explorer_moments m2 on m2.id=f.item_id
        where lo.follower_id=v.id and lo.area_id=m2.area_id
      ) then 'In an area you follow' end
    ],null)::text[] as source_reasons
  from feed f cross join viewer v
  order by f.created_at desc
  limit greatest(1,least(coalesce(p_limit,20),50)) offset greatest(coalesce(p_offset,0),0);
$$;

revoke all on function public.get_explorer_social_feed(integer,integer) from public;
grant execute on function public.get_explorer_social_feed(integer,integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Trending: counts only, no ranking
-- ---------------------------------------------------------------------------
--
-- Returns the facts utils/trending.js scores: how many DIFFERENT Explorers
-- posted, how many DIFFERENT Explorers engaged, and how recently. Distinctness
-- is the whole anti-gaming story -- one person posting ten times about their own
-- bar must count as one person, and that can only be established here.
--
-- `per_poster_counts` is returned so the client can apply its cap without this
-- function having to know what the cap is.

create or replace function public.get_trending_places(p_hours integer default 48)
returns table(
  id uuid,target_type text,target_name text,area_id uuid,
  latitude double precision,longitude double precision,
  distinct_posters bigint,distinct_engagers bigint,engagements bigint,
  per_poster_counts bigint[],last_activity_at timestamptz
)
language sql
stable
set search_path='public','pg_temp'
as $$
  with window_start as (
    select now()-make_interval(hours=>greatest(1,least(coalesce(p_hours,48),336))) as since
  ),
  -- Public Moments only. RLS already hides what this viewer may not read; the
  -- explicit visibility test is the second lock, because an aggregate that
  -- moves when one person posts something private is still a disclosure.
  posts as (
    select m.target_type,m.target_id,m.target_name,m.area_id,m.latitude,m.longitude,m.user_id,m.id,m.created_at
    from public.explorer_moments m,window_start w
    where m.status='published' and m.visibility='public'
      and m.target_id is not null and m.created_at>=w.since
  ),
  grouped as (
    -- The place attributes are snapshots taken at post time, so every row in a
    -- group describes the same place and the newest is the one to keep.
    -- `min()` was the first attempt and does not exist for uuid, which is how
    -- this got looked at properly rather than settled by whichever aggregate
    -- happened to compile.
    select p.target_id as id,
      (array_agg(p.target_type order by p.created_at desc))[1] as target_type,
      (array_agg(p.target_name order by p.created_at desc))[1] as target_name,
      (array_agg(p.area_id    order by p.created_at desc))[1] as area_id,
      (array_agg(p.latitude   order by p.created_at desc))[1] as latitude,
      (array_agg(p.longitude  order by p.created_at desc))[1] as longitude,
      count(distinct p.user_id) as distinct_posters,
      max(p.created_at) as last_activity_at
    from posts p group by p.target_id
  ),
  engagement as (
    select p.target_id as id,
      count(distinct l.user_id) as distinct_engagers,
      count(*) as engagements
    from posts p
    join public.social_likes l on l.target_type='moment' and l.target_id=p.id
    group by p.target_id
  ),
  per_poster as (
    select id,array_agg(posts_by_person) as per_poster_counts
    from (
      select p.target_id as id,count(*) as posts_by_person
      from posts p group by p.target_id,p.user_id
    ) counted
    group by id
  )
  select g.id,g.target_type,g.target_name,g.area_id,g.latitude,g.longitude,
    g.distinct_posters,
    coalesce(e.distinct_engagers,0),
    coalesce(e.engagements,0),
    coalesce(pp.per_poster_counts,array[]::bigint[]),
    g.last_activity_at
  from grouped g
  left join engagement e on e.id=g.id
  left join per_poster pp on pp.id=g.id
  -- The anti-spam floor is also applied client-side; enforcing it here as well
  -- means a caller that forgets cannot surface a one-person "trend".
  where g.distinct_posters>=2;
$$;

comment on function public.get_trending_places(integer) is
  'Counts, not ranking. utils/trending.js scores these; SECURITY INVOKER so row level security decides what is counted.';

revoke all on function public.get_trending_places(integer) from public;
grant execute on function public.get_trending_places(integer) to authenticated;

commit;

-- The feed stops loading everything at once.
--
-- WHAT WAS WRONG
-- app/feed.js called this with p_limit:40, p_offset:0 -- hard-coded, both of
-- them. Forty rows was the entire feed, for ever: there was no second page and
-- no way to ask for one. Every one of those forty rendered at once into a
-- ScrollView with no virtualisation, and the screen refetched the lot on every
-- focus.
--
-- WHY KEYSET AND NOT OFFSET
-- p_offset already existed and would have been the one-line change. It is the
-- wrong tool here for a specific reason: this function UNIONS four content
-- types and only then sorts, so the whole union is materialised on every call.
-- `offset 60` re-materialises and re-sorts everything and throws away the first
-- sixty rows, and it gets slower with every page. Worse, the feed is live --
-- somebody posting a Moment while you are reading shifts every row down by one,
-- so page 2 at an offset re-serves a row you already have and skips one you
-- never saw. Duplicates and holes, from a correct query.
--
-- A keyset says "give me what comes after this exact row" and is immune to
-- both. The cursor is (created_at, item_id): created_at is the sort key and
-- item_id breaks ties, so the order is total and the boundary is unambiguous
-- even when two things are posted in the same millisecond.
--
-- THE SIGNATURE CHANGES, SO THE OLD ONE IS DROPPED
-- Adding parameters with defaults would leave two overloads and make a two-
-- argument call ambiguous. p_offset is kept -- unused by the app now, but the
-- admin screens' pattern and any existing caller still work, and removing an
-- argument is a break for no gain.
--
-- WHAT DOES NOT CHANGE
-- The four branches, the union, and every audience decision. can_see_content
-- still decides who sees a Moment and which of a Memory's two audiences is in
-- force. Pagination that quietly widened who could see a row would be a far
-- worse bug than a slow feed.

begin;

drop function if exists public.get_explorer_social_feed(integer,integer);

create or replace function public.get_explorer_social_feed(
  p_limit integer default 20,
  p_offset integer default 0,
  -- The cursor: the created_at and item_id of the LAST row the caller already
  -- has. Null means the first page.
  p_before timestamptz default null,
  p_before_id uuid default null
)
returns table(
  item_id uuid,item_type text,actor_id uuid,actor_name text,actor_photo text,
  created_at timestamptz,caption text,rating integer,verified_qr boolean,
  target_type text,target_id uuid,target_name text,target_image_url text,
  media_type text,media_url text,thumbnail_url text,duration_seconds numeric,
  like_count bigint,comment_count bigint,viewer_liked boolean,source_reasons text[]
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
      -- Live only. A Moment expires; a feed still carrying last week's is a
      -- feed contradicting the word.
      and m.expires_at > now()
      and (
        m.user_id=v.id
        or guestbook_private.can_see_content(m.user_id,v.id,m.visibility)
      )
  ),
  memories as (
    select x.id,'memory'::text,x.user_id,p.full_name,p.profile_photo,x.created_at,
      coalesce(nullif(x.title,''),x.note),null::integer,false,
      x.target_type,x.target_id,x.target_name,x.target_image_url,
      coalesce(x.media_type,case when x.media_url is not null then 'image' end),x.media_url,x.thumbnail_url,null::numeric,
      (select count(*) from public.social_likes l where l.target_type='memory' and l.target_id=x.id),
      (select count(*) from public.social_comments c where c.target_type='memory' and c.target_id=x.id and c.status='published'),
      exists(select 1 from public.social_likes l,viewer where l.target_type='memory' and l.target_id=x.id and l.user_id=viewer.id)
    from public.explorer_memories x
    join people pe on pe.user_id=x.user_id
    join public.profiles p on p.id=x.user_id
    cross join viewer v
    where coalesce(x.status,'published')='published'
      and (
        x.user_id=v.id
        -- Whichever audience is in force RIGHT NOW. A Memory has two on
        -- purpose: agreeing to be seen today is not agreeing to be seen for
        -- ever, so picking one of them here would break that promise in one
        -- direction or the other.
        or guestbook_private.can_see_content(
             x.user_id,v.id,
             case when x.live_until is not null and x.live_until > now()
               then x.visibility else x.archive_visibility end
           )
      )
  ),
  reviews as (
    select er.id,'review'::text,er.user_id,p.full_name,p.profile_photo,er.created_at,
      coalesce(nullif(er.title,''),er.comment),er.rating,er.verified_qr,er.target_type,er.target_id,er.target_name,er.target_image_url,
      rm.media_type,rm.media_url,rm.thumbnail_url,rm.duration_seconds,
      (select count(*) from public.social_likes l where l.target_type='review' and l.target_id=er.id),
      (select count(*) from public.social_comments c where c.target_type='review' and c.target_id=er.id and c.status='published'),
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
  feed(item_id,item_type,actor_id,actor_name,actor_photo,created_at,caption,rating,
       verified_qr,target_type,target_id,target_name,target_image_url,media_type,
       media_url,thumbnail_url,duration_seconds,like_count,comment_count,viewer_liked) as (
    select * from moments
    union all select * from memories
    union all select * from reviews
    union all select * from favourites
  )
  select f.*,
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
  -- The cursor. Both halves or neither: a created_at with no id would put the
  -- boundary in the middle of a tie and drop whatever shared that timestamp.
  where p_before is null
     or p_before_id is null
     or (f.created_at,f.item_id) < (p_before,p_before_id)
  -- item_id is not decoration in this ORDER BY. Without it two rows posted in
  -- the same millisecond have no defined order, the cursor cannot say which one
  -- it meant, and a page boundary landing between them loses or repeats a row.
  order by f.created_at desc, f.item_id desc
  limit greatest(1,least(coalesce(p_limit,20),50)) offset greatest(coalesce(p_offset,0),0);
$$;

revoke all on function public.get_explorer_social_feed(integer,integer,timestamptz,uuid) from public,anon;
grant execute on function public.get_explorer_social_feed(integer,integer,timestamptz,uuid) to authenticated;

comment on function public.get_explorer_social_feed(integer,integer,timestamptz,uuid) is
  'The feed: live Moments, shared Memories, reviews and public favourites from people you follow, plus your own. Paginated by keyset -- pass the created_at and item_id of your last row as p_before/p_before_id to get the next page. Offset pagination is unsafe on a live feed: a post arriving mid-scroll shifts every row and the boundary both repeats and skips. Every audience decision still goes through guestbook_private.can_see_content.';

commit;

-- Step 11: Memories appear in the feed.
--
-- AND TWO LIVE BUGS IN THE SAME FUNCTION, both from renames that landed
-- elsewhere and were never followed through to here.
--
-- 1. MOMENTS WERE FILTERED ON A WORD THAT NO LONGER EXISTS
--
--      or m.visibility='public'
--
--    20260811220000 moved every audience in the app onto one vocabulary and
--    'public' became 'everyone'. explorer_moments.visibility has REFUSED
--    'public' since, so that branch has matched nothing for a day: the feed has
--    been showing your own Moments and your friends', and a Moment somebody
--    deliberately shared with everyone has been invisible to anybody following
--    them who is not also a friend.
--
--    It also hand-rolled the audience test, so it knew nothing about
--    close_friends, followers or selected, and ignored the profile ceiling
--    entirely. It now asks can_see_content, which is the only thing RULES.md
--    allows to answer this question.
--
-- 2. EVERY REVIEW IN THE FEED SHOWED ZERO COMMENTS
--
--      where c.target_type='video_review'
--
--    20260811150000 renamed that to 'review' eight days ago. The count has been
--    reading a value nothing writes, so it has been 0 for every review since.
--
-- WHAT MEMORIES BRING
--
-- A Memory has two audiences on purpose -- one while it is live and one
-- afterwards -- so the feed asks whichever is in force right now rather than
-- picking one. A Memory nobody chose to share stays out of the feed entirely,
-- which is most of them: a scrapbook page is private by default and that is the
-- point of it.
--
-- Moments are also narrowed to LIVE ones. They expire now (20260811210000), and
-- a feed carrying Moments that stopped being live last week is a feed
-- contradicting the word.
--
-- TO UNDO
--   restore the body from 20260810020000 (or whichever migration last defined
--   get_explorer_social_feed before this one).

begin;

create or replace function public.get_explorer_social_feed(p_limit integer default 20,p_offset integer default 0)
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
      -- WAS 'video_review'. Renamed in 20260811150000, so this count has been
      -- reading a value nothing writes and every review showed 0 comments.
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
  order by f.created_at desc
  limit greatest(1,least(coalesce(p_limit,20),50)) offset greatest(coalesce(p_offset,0),0);
$$;

comment on function public.get_explorer_social_feed(integer,integer) is
  'The feed: live Moments, shared Memories, reviews and public favourites from people you follow, plus your own. Every audience decision goes through guestbook_private.can_see_content -- the hand-rolled test this replaced knew nothing about close friends, followers or the profile ceiling, and filtered Moments on a word the schema stopped accepting.';

commit;

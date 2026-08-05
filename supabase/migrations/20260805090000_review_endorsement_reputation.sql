-- Packet 8c: review reputation.
--
-- "How many people found this user's reviews useful?" -- the mechanism this
-- runs on already exists: social_likes with target_type='review' has worked
-- since the explorer social layer shipped. What was missing is (a) a user
-- cannot currently be blocked from endorsing their own review, and (b)
-- nothing aggregates endorsements into the figures the profile is meant to
-- show. Both are fixed here. No new table -- RULES.md's one-table-per-noun
-- rule is not in tension with this: "review endorsement" is not a new noun,
-- it is social_likes, unchanged in shape.

-- ---------------------------------------------------------------------------
-- 1. Block self-endorsement.
-- ---------------------------------------------------------------------------
--
-- guestbook_private.validate_social_target() already rejects a like on a
-- review that does not exist or is not published. It never checked whether
-- the liker is the review's own author -- so, today, a user can mark their
-- own review as useful. This is a full function replacement (Postgres has no
-- ALTER FUNCTION ... ADD BRANCH).
--
-- Reproduced from the function actually live on yzpthslwsvesgndzdqai
-- (read back with pg_get_functiondef before writing this file), not from
-- 20260802155202_explorer_social_layer.sql alone -- that file's activity_club
-- branch still reads status='published', but 20260802191500_fix_activity_club
-- _moment_attachments.sql later widened it to status in ('open','full').
-- Reproducing the older text would have silently reverted that fix.

create or replace function guestbook_private.validate_social_target()
returns trigger
language plpgsql
security definer
set search_path='public','pg_temp'
as $$
declare
  v_actor uuid;
  v_exists boolean:=false;
  v_owner uuid;
begin
  if tg_table_name='explorer_follows' then v_actor:=new.follower_id;
  elsif tg_table_name in ('explorer_moments','social_likes','social_comments') then v_actor:=new.user_id;
  elsif tg_table_name='social_reports' then v_actor:=new.reporter_id;
  else raise exception 'Unsupported social validation table: %',tg_table_name;
  end if;

  if not guestbook_private.is_explorer(v_actor) then raise exception 'Only Explorer accounts can use social features'; end if;

  if tg_table_name='explorer_follows' then
    if new.follower_id=new.following_id then raise exception 'You cannot follow yourself'; end if;
    if not guestbook_private.is_explorer(new.following_id) then raise exception 'You can only follow Explorer accounts'; end if;
  elsif tg_table_name='explorer_moments' then
    if (new.target_type is null)<>(new.target_id is null) then raise exception 'Attached place type and id must be provided together'; end if;
    if new.target_type is not null then
      if new.target_type='business' then select exists(select 1 from public.businesses where id=new.target_id) into v_exists;
      elsif new.target_type='property' then select exists(select 1 from public.properties where id=new.target_id) into v_exists;
      elsif new.target_type='activity_club' then select exists(select 1 from public.activity_clubs where id=new.target_id and status in ('open','full')) into v_exists;
      elsif new.target_type='event' then select exists(select 1 from public.events where id=new.target_id and status='published') into v_exists;
      else raise exception 'Unsupported attached place type';
      end if;
      if not coalesce(v_exists,false) then raise exception 'The attached place is unavailable'; end if;
    end if;
  elsif tg_table_name='social_likes' then
    if new.target_type='moment' then select exists(select 1 from public.explorer_moments where id=new.target_id and status='published') into v_exists;
    elsif new.target_type='review' then
      select exists(select 1 from public.explorer_reviews where id=new.target_id and status='published') into v_exists;
      -- The one addition: a review's own author cannot endorse it as useful.
      if coalesce(v_exists,false) and exists(
        select 1 from public.explorer_reviews where id=new.target_id and user_id=new.user_id
      ) then
        raise exception 'You cannot mark your own review as useful';
      end if;
    else raise exception 'Unsupported like target';
    end if;
    if not coalesce(v_exists,false) then raise exception 'This content is unavailable'; end if;
  elsif tg_table_name='social_comments' then
    if new.target_type='moment' then select exists(select 1 from public.explorer_moments where id=new.target_id and status='published') into v_exists;
    elsif new.target_type='video_review' then
      select exists(
        select 1 from public.explorer_reviews er
        where er.id=new.target_id and er.status='published'
          and exists(select 1 from public.review_media rm where rm.review_id=er.id and rm.media_type='video' and rm.moderation_status='published')
      ) into v_exists;
    else raise exception 'Unsupported comment target';
    end if;
    if not coalesce(v_exists,false) then raise exception 'Comments are unavailable for this content'; end if;
  elsif tg_table_name='social_reports' then
    if new.target_type='moment' then select user_id into v_owner from public.explorer_moments where id=new.target_id and status='published';
    elsif new.target_type='comment' then select user_id into v_owner from public.social_comments where id=new.target_id and status='published';
    else raise exception 'Unsupported report target';
    end if;
    if v_owner is null then raise exception 'This content is unavailable'; end if;
    if v_owner=new.reporter_id then raise exception 'You cannot report your own content'; end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Aggregate reputation.
-- ---------------------------------------------------------------------------
--
-- security invoker, like explorer_profile_stats (20260804013508): the query
-- only ever reads status='published' reviews, which is exactly what
-- explorer_reviews_public_read already grants everyone, signed in or not, so
-- there is nothing here an invoker's own RLS would hide that this function
-- should have shown. No new index: explorer_reviews_user_created_idx(user_id,
-- created_at desc) already covers the user_id lookup, and
-- social_likes_target_idx(target_type,target_id,created_at desc) already
-- covers the join back to each review's endorsements.

create or replace function public.get_explorer_review_reputation(p_user_id uuid)
returns table(
  total_endorsements bigint,
  reviews_with_endorsement bigint,
  most_useful_review_id uuid,
  most_useful_review_target_name text,
  most_useful_review_count bigint,
  average_endorsements_per_review numeric
)
language sql
stable
security invoker
set search_path='public','pg_temp'
as $$
  with review_counts as (
    select
      er.id,
      er.target_name,
      count(l.id) as endorsement_count
    from public.explorer_reviews er
    left join public.social_likes l on l.target_type='review' and l.target_id=er.id
    where er.user_id=p_user_id and er.status='published'
    group by er.id,er.target_name
  ),
  top as (
    select id,target_name,endorsement_count
    from review_counts
    where endorsement_count>0
    order by endorsement_count desc,id asc
    limit 1
  )
  select
    coalesce((select sum(endorsement_count) from review_counts),0)::bigint,
    coalesce((select count(*) from review_counts where endorsement_count>0),0)::bigint,
    (select id from top),
    (select target_name from top),
    (select endorsement_count from top),
    case when (select count(*) from review_counts)>0
      then round(coalesce((select sum(endorsement_count) from review_counts),0)::numeric/(select count(*) from review_counts),2)
      else 0
    end;
$$;

grant execute on function public.get_explorer_review_reputation(uuid) to anon,authenticated;

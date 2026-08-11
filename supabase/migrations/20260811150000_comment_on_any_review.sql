-- Packet 11 -- a review can be answered, whatever it is made of.
--
-- social_comments.target_type allowed ('moment','video_review')
-- (20260802155202:64), so a comment was only possible on a review that happened
-- to carry a published video. A text or photo review could be endorsed but
-- never replied to, which is a strange shape for a product whose point is
-- local conversation: the reviews most people write were the ones nobody could
-- answer.
--
-- 'video_review' is retired rather than kept alongside 'review'. Two names for
-- the same thing is how this schema rots -- RULES.md, "every entity needs one
-- canonical table", and the same reasoning applies to the words. Existing rows
-- are migrated, so no comment is lost.
--
-- TO UNDO
--   update public.social_comments set target_type='video_review'
--     where target_type='review';
--   (restore the constraint and the function body from
--   20260805090000_review_endorsement_reputation.sql:29-95.)

begin;

-- ---------------------------------------------------------------------------
-- 1. One name for the thing
-- ---------------------------------------------------------------------------
-- Constraint dropped first: the rows cannot be renamed while it still forbids
-- the new value.

alter table public.social_comments
  drop constraint if exists social_comments_target_type;

update public.social_comments
set target_type='review'
where target_type='video_review';

alter table public.social_comments
  add constraint social_comments_target_type
  check (target_type in ('moment','review'));

-- ---------------------------------------------------------------------------
-- 2. The validator, with the video requirement removed
-- ---------------------------------------------------------------------------
-- Reproduced whole because create or replace takes a whole body. The only
-- change is the social_comments branch; every other branch is byte-for-byte the
-- definition from 20260805090000:29-95.

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
    elsif new.target_type='review' then
      -- Any published review, whatever it is made of. The old rule additionally
      -- required a published video on the review, so a text or photo review
      -- could be endorsed but never answered.
      select exists(
        select 1 from public.explorer_reviews er
        where er.id=new.target_id and er.status='published'
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

revoke all on function guestbook_private.validate_social_target() from public,anon,authenticated;

commit;

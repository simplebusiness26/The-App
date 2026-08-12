-- Memories can be liked and commented on.
--
-- WHAT WAS WRONG
--
-- social_likes and social_comments both accepted 'review' and 'moment' and
-- nothing else. So a Memory shared with friends -- a permanent thing, in the
-- profile gallery, on My Map, chosen deliberately for an audience -- was the one
-- piece of content in the app nobody could say anything back to. Somebody posts
-- a day out with three friends in it and the friends have no way to respond.
--
-- LIKE, NOT USEFUL
--
-- The owner's words: "its not a useful button for memories or moments its a
-- like button". They are different things and they were sharing one word.
--
--   Useful   an endorsement of a REVIEW. It says "this helped me decide", it
--            pays the reviewer a point (20260812150000), and you cannot use it
--            on your own review -- the database refuses.
--   Like     a response to a MOMENT or a MEMORY. It says "I liked seeing this".
--            It pays nothing and it means nothing beyond itself.
--
-- Same table, because a like and an endorsement are the same row shape and
-- splitting them would be the "second table for the same noun" RULES.md warns
-- about. Different words on screen, because they are different acts.
--
-- THE AUDIENCE RULE
--
-- A Memory has an audience. A Moment's like only ever checked that the Moment
-- existed and was published, which is fine for a Moment: the row is only
-- reachable if row level security let you see it. A Memory gets the check
-- written out anyway, through guestbook_private.can_see_content -- the one
-- predicate RULES.md allows for this question. Anybody holding a Memory id they
-- were never shown cannot like their way into confirming it exists.
--
-- AND A LIVE BUG FOUND WHILE READING THIS
--
-- cleanup_social_interactions deletes a deleted review's comments with
--
--   where target_type='video_review'
--
-- 20260811150000 renamed that value to 'review' eight days ago. So since then,
-- deleting a review has left every comment on it behind, pointing at a row that
-- no longer exists. Fixed here because this migration is already rewriting the
-- function and leaving it would be choosing to.
--
-- TO UNDO
--   restore the two target_type checks to ('review','moment') and
--   ('moment','review'), and drop the explorer_memories cleanup trigger.

begin;

-- ---------------------------------------------------------------------------
-- 1. The vocabulary
-- ---------------------------------------------------------------------------

alter table public.social_likes drop constraint if exists social_likes_target_type;
alter table public.social_likes
  add constraint social_likes_target_type
  check (target_type in ('review','moment','memory'));

alter table public.social_comments drop constraint if exists social_comments_target_type;
alter table public.social_comments
  add constraint social_comments_target_type
  check (target_type in ('review','moment','memory'));

-- ---------------------------------------------------------------------------
-- 2. What may be liked and commented on, and by whom
-- ---------------------------------------------------------------------------

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
  v_audience text;
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
      elsif new.target_type='public_place' then select exists(select 1 from public.public_places where id=new.target_id and status='published') into v_exists;
      else raise exception 'Unsupported attached place type';
      end if;
      if not coalesce(v_exists,false) then raise exception 'The attached place is unavailable'; end if;
    end if;

  elsif tg_table_name='social_likes' then
    if new.target_type='moment' then
      select exists(select 1 from public.explorer_moments where id=new.target_id and status='published') into v_exists;

    elsif new.target_type='memory' then
      -- The audience is checked, not assumed. A Memory is permanent and was
      -- shared with somebody specific; an id on its own is not permission.
      select m.user_id,m.visibility into v_owner,v_audience
      from public.explorer_memories m where m.id=new.target_id;

      if v_owner is null then raise exception 'This content is unavailable'; end if;
      if not guestbook_private.can_see_content(v_owner,new.user_id,v_audience) then
        -- Deliberately the same sentence as a Memory that does not exist.
        -- "You are not allowed to see this" confirms it exists.
        raise exception 'This content is unavailable';
      end if;
      v_exists:=true;

    elsif new.target_type='review' then
      select exists(select 1 from public.explorer_reviews where id=new.target_id and status='published') into v_exists;
      -- Useful is an endorsement, and endorsing yourself is not an endorsement.
      -- It also pays a point now (20260812150000), which is the other reason.
      if coalesce(v_exists,false) and exists(
        select 1 from public.explorer_reviews where id=new.target_id and user_id=new.user_id
      ) then
        raise exception 'You cannot mark your own review as useful';
      end if;
    else raise exception 'Unsupported like target';
    end if;
    if not coalesce(v_exists,false) then raise exception 'This content is unavailable'; end if;

  elsif tg_table_name='social_comments' then
    if new.target_type='moment' then
      select exists(select 1 from public.explorer_moments where id=new.target_id and status='published') into v_exists;

    elsif new.target_type='memory' then
      select m.user_id,m.visibility into v_owner,v_audience
      from public.explorer_memories m where m.id=new.target_id;

      if v_owner is null then raise exception 'Comments are unavailable for this content'; end if;
      if not guestbook_private.can_see_content(v_owner,new.user_id,v_audience) then
        raise exception 'Comments are unavailable for this content';
      end if;
      v_exists:=true;

    elsif new.target_type='review' then
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
    elsif new.target_type='review' then select user_id into v_owner from public.explorer_reviews where id=new.target_id and status='published';
    else raise exception 'Unsupported report target';
    end if;
    if v_owner is null then raise exception 'This content is unavailable'; end if;
    if v_owner=new.reporter_id then raise exception 'You cannot report your own content'; end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Deleting a Memory takes its likes and comments with it
-- ---------------------------------------------------------------------------
-- And the review branch stops looking for a value that stopped existing.

create or replace function guestbook_private.cleanup_social_interactions()
returns trigger
language plpgsql
security definer
set search_path='public','pg_temp'
as $$
begin
  if tg_table_name='explorer_moments' then
    delete from public.social_likes where target_type='moment' and target_id=old.id;
    delete from public.social_comments where target_type='moment' and target_id=old.id;
    delete from public.social_reports where target_type='moment' and target_id=old.id;
    delete from public.notifications where entity_type='moment' and entity_id=old.id and type like 'social_%';

  elsif tg_table_name='explorer_memories' then
    delete from public.social_likes where target_type='memory' and target_id=old.id;
    delete from public.social_comments where target_type='memory' and target_id=old.id;
    delete from public.notifications where entity_type='memory' and entity_id=old.id and type like 'social_%';

  elsif tg_table_name='explorer_reviews' then
    delete from public.social_likes where target_type='review' and target_id=old.id;
    -- WAS 'video_review'. 20260811150000 renamed it to 'review' and this line
    -- was not updated, so since then every comment on a deleted review has been
    -- left behind pointing at nothing.
    delete from public.social_comments where target_type='review' and target_id=old.id;
    delete from public.notifications where entity_id=old.id and entity_type in ('review','video_review') and type like 'social_%';

  elsif tg_table_name='social_comments' then
    delete from public.social_reports where target_type='comment' and target_id=old.id;
  end if;
  return old;
end;
$$;

drop trigger if exists explorer_memories_social_cleanup on public.explorer_memories;
create trigger explorer_memories_social_cleanup after delete on public.explorer_memories
for each row execute function guestbook_private.cleanup_social_interactions();

-- Comments already orphaned by the eight days the rename was live.
delete from public.social_comments sc
where sc.target_type='review'
  and not exists(select 1 from public.explorer_reviews er where er.id=sc.target_id);

commit;

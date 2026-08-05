-- Packet 8e, part 4 of 4: where a Moment happened, who may see it, and who
-- posted it.
--
-- WHY
-- A Moment today has a caption, media, an optional attached listing and nothing
-- else. It has no location of its own, it is visible to everybody, and there is
-- no difference between an Explorer posting at a pub and the pub posting.
--
-- THREE CHANGES, EACH WITH A BOUNDARY IN THE DATABASE
--
-- 1. Location, as a snapshot. An attached Moment copies the place's name,
--    image, area and coordinates at the time it was posted. If the place is
--    later edited or moved, every Moment already posted keeps the place as it
--    was -- history is not rewritten by an edit somewhere else.
--
-- 2. Visibility, enforced by RLS. 'friends' means mutual follows, computed
--    from explorer_follows rather than stored, so unfollowing takes effect
--    immediately and there is no friendship table to keep in step. The old
--    read policy said "published or mine", which would have let any caller
--    read a friends-only Moment -- it is replaced, not added to.
--
-- 3. Identity. user_id stays the authenticated author, always. actor_type and
--    actor_id say who is speaking. Posting officially as a listing requires
--    managing that listing, checked here against owner_id/manager_id, and the
--    post must be attached to the same listing it speaks for. Tagging a
--    business is not the same act as being one, which is the distinction that
--    lets "following a business" mean its own posts rather than every post
--    that mentions it.
--
-- NOT HERE: public_place as an actor_type. Attaching a Moment to a park is
-- fine; speaking as the park needs a management model that does not exist.
--
-- The three functions rebuilt below are rebuilt FROM THE DEFINITIONS RUNNING ON
-- THE PROJECT, not from the migrations that first created them. Packet 8c
-- recorded why: validate_social_target has been patched twice since its
-- original file -- the activity-club attachment widened to status in
-- ('open','full'), and the self-endorsement block -- and reproducing the old
-- text would silently revert both. Both are carried through here unchanged.
--
-- REVERSAL
--   alter table public.explorer_moments
--     drop column if exists area_id, drop column if exists latitude,
--     drop column if exists longitude, drop column if exists visibility,
--     drop column if exists actor_type, drop column if exists actor_id;
--   drop trigger if exists explorer_moments_snapshot on public.explorer_moments;
--   drop function if exists guestbook_private.snapshot_moment_place();
--   drop function if exists guestbook_private.are_friends(uuid,uuid);
--   (restore explorer_moments_public_read, and the previous definitions of
--    validate_social_target, social_notification_trigger and
--    get_explorer_social_feed.)

begin;

-- ---------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------

alter table public.explorer_moments
  add column if not exists area_id uuid references public.geo_areas(id) on delete set null,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists visibility text not null default 'public',
  add column if not exists actor_type text not null default 'explorer',
  add column if not exists actor_id uuid;

-- Existing Moments were public and stay public; every one of them was posted by
-- the Explorer whose user_id is on the row.
update public.explorer_moments set actor_id=user_id where actor_id is null;
alter table public.explorer_moments alter column actor_id set not null;

do $$
begin
  if not exists(select 1 from pg_constraint where conname='explorer_moments_visibility_check') then
    alter table public.explorer_moments
      add constraint explorer_moments_visibility_check check (visibility in ('public','friends'));
  end if;

  if not exists(select 1 from pg_constraint where conname='explorer_moments_actor_type_check') then
    alter table public.explorer_moments
      add constraint explorer_moments_actor_type_check
      check (actor_type in ('explorer','business','property','activity_club','event'));
  end if;

  -- An Explorer Moment is posted as its author. Enforced as a table check as
  -- well as in the trigger, because this one is cheap and absolute.
  if not exists(select 1 from pg_constraint where conname='explorer_moments_explorer_actor_is_author') then
    alter table public.explorer_moments
      add constraint explorer_moments_explorer_actor_is_author
      check (actor_type<>'explorer' or actor_id=user_id);
  end if;

  -- An official Moment is public. A business speaking to its followers-of-
  -- friends is not a thing, and "friends" is a relationship between people.
  if not exists(select 1 from pg_constraint where conname='explorer_moments_official_is_public') then
    alter table public.explorer_moments
      add constraint explorer_moments_official_is_public
      check (actor_type='explorer' or visibility='public');
  end if;

  if not exists(select 1 from pg_constraint where conname='explorer_moments_latitude_range') then
    alter table public.explorer_moments
      add constraint explorer_moments_latitude_range check (latitude is null or latitude between -90 and 90);
  end if;

  if not exists(select 1 from pg_constraint where conname='explorer_moments_longitude_range') then
    alter table public.explorer_moments
      add constraint explorer_moments_longitude_range check (longitude is null or longitude between -180 and 180);
  end if;
end;
$$;

-- public_place joins the attachable types. The constraint is replaced rather
-- than added to, because a check constraint cannot be altered in place.
alter table public.explorer_moments drop constraint if exists explorer_moments_target_type;
alter table public.explorer_moments
  add constraint explorer_moments_target_type check (
    target_type is null or target_type in ('business','property','activity_club','event','public_place')
  );

create index if not exists explorer_moments_area_created_idx
  on public.explorer_moments(area_id,created_at desc)
  where status='published' and visibility='public' and area_id is not null;
create index if not exists explorer_moments_actor_created_idx
  on public.explorer_moments(actor_type,actor_id,created_at desc)
  where status='published';
create index if not exists explorer_moments_target_created_idx
  on public.explorer_moments(target_type,target_id,created_at desc)
  where status='published' and target_id is not null;

comment on column public.explorer_moments.actor_id is
  'Who is speaking. Equal to user_id for an Explorer Moment; the listing id for an official one. user_id is always the authenticated author.';
comment on column public.explorer_moments.area_id is
  'Snapshot of the canonical area at posting time. A later edit to the attached place does not change it.';

-- ---------------------------------------------------------------------------
-- 2. Friendship, derived
-- ---------------------------------------------------------------------------
-- Mutual follow. No friendship table: a follow already means something on its
-- own, and a stored friendship would need keeping in step with both directions
-- of it forever.

create or replace function guestbook_private.are_friends(p_a uuid,p_b uuid)
returns boolean
language sql
stable
security definer
set search_path='public','pg_temp'
as $$
  select p_a is not null and p_b is not null and p_a<>p_b
    and exists(select 1 from public.explorer_follows f where f.follower_id=p_a and f.following_id=p_b)
    and exists(select 1 from public.explorer_follows f where f.follower_id=p_b and f.following_id=p_a);
$$;

revoke all on function guestbook_private.are_friends(uuid,uuid) from public,anon;
grant execute on function guestbook_private.are_friends(uuid,uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. The location snapshot
-- ---------------------------------------------------------------------------
-- Runs before validate_social_target (triggers of the same timing fire in name
-- order, and `snapshot` sorts before `validate`), so validation sees the values
-- that will actually be stored.
--
-- Coordinates are rounded to three decimal places here, whatever the client
-- sent. Roughly 100 m: enough to say which park, not enough to say which bench.
-- The client rounds too; this is the copy that decides.

create or replace function guestbook_private.snapshot_moment_place()
returns trigger
language plpgsql
security definer
set search_path='public','pg_temp'
as $$
declare
  v_name text;
  v_image text;
  v_area uuid;
  v_lat double precision;
  v_lng double precision;
  v_found boolean:=false;
begin
  if new.target_type is not null and new.target_id is not null then
    if new.target_type='business' then
      select b.name,coalesce(b.image,b.photos[1]),b.area_id,b.latitude,b.longitude
        into v_name,v_image,v_area,v_lat,v_lng
      from public.businesses b where b.id=new.target_id;
      v_found:=found;
    elsif new.target_type='property' then
      select p.name,p.photos[1],p.area_id,p.latitude,p.longitude
        into v_name,v_image,v_area,v_lat,v_lng
      from public.properties p where p.id=new.target_id;
      v_found:=found;
    elsif new.target_type='activity_club' then
      select c.name,c.image_url,c.area_id,c.latitude,c.longitude
        into v_name,v_image,v_area,v_lat,v_lng
      from public.activity_clubs c where c.id=new.target_id;
      v_found:=found;
    elsif new.target_type='event' then
      select e.name,e.image_url,e.area_id,e.latitude,e.longitude
        into v_name,v_image,v_area,v_lat,v_lng
      from public.events e where e.id=new.target_id;
      v_found:=found;
    elsif new.target_type='public_place' then
      select pp.name,pp.image_url,pp.area_id,pp.latitude,pp.longitude
        into v_name,v_image,v_area,v_lat,v_lng
      from public.public_places pp where pp.id=new.target_id;
      v_found:=found;
    end if;

    -- A missing target is not corrected here. validate_social_target refuses
    -- the insert a moment later with a message about the attachment, which is
    -- the accurate complaint.
    if v_found then
      new.target_name:=v_name;
      new.target_image_url:=v_image;
      new.area_id:=v_area;
      new.latitude:=v_lat;
      new.longitude:=v_lng;
    end if;
  else
    -- Standalone. Whatever coordinates the client chose to send are kept --
    -- the screen only sends them after an explicit tap -- and the area falls
    -- back to the Explorer's own canonical area when they sent none.
    if new.area_id is null then
      select p.area_id into new.area_id from public.profiles p where p.id=new.user_id;
    end if;
  end if;

  if new.latitude is not null then new.latitude:=round(new.latitude::numeric,3)::double precision; end if;
  if new.longitude is not null then new.longitude:=round(new.longitude::numeric,3)::double precision; end if;

  -- Half a coordinate is not a location.
  if new.latitude is null or new.longitude is null then
    new.latitude:=null;
    new.longitude:=null;
  end if;

  return new;
end;
$$;

drop trigger if exists explorer_moments_snapshot on public.explorer_moments;
create trigger explorer_moments_snapshot
before insert on public.explorer_moments
for each row execute function guestbook_private.snapshot_moment_place();

-- ---------------------------------------------------------------------------
-- 4. validate_social_target, rebuilt from the live definition
-- ---------------------------------------------------------------------------
-- Carried through unchanged: the activity-club widening from
-- 20260802191500, and Packet 8c's self-endorsement block.
-- Added: public_place attachments, and the actor rules.

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
      elsif new.target_type='public_place' then select exists(select 1 from public.public_places where id=new.target_id and status='published') into v_exists;
      else raise exception 'Unsupported attached place type';
      end if;
      if not coalesce(v_exists,false) then raise exception 'The attached place is unavailable'; end if;
    end if;

    -- Who is speaking.
    if new.actor_type='explorer' then
      if new.actor_id is distinct from new.user_id then
        raise exception 'An Explorer Moment must be posted as its author';
      end if;
    else
      -- Official. The post must be attached to the listing it speaks for --
      -- otherwise a manager could post "as" their pub from anywhere, about
      -- anything, and following the pub would stop meaning the pub.
      if new.target_type is distinct from new.actor_type or new.target_id is distinct from new.actor_id then
        raise exception 'An official Moment must be attached to the listing it speaks for';
      end if;
      if new.visibility<>'public' then raise exception 'Official Moments are always public'; end if;

      if new.actor_type='business' then
        select exists(select 1 from public.businesses where id=new.actor_id and owner_id=new.user_id) into v_exists;
      elsif new.actor_type='property' then
        select exists(select 1 from public.properties where id=new.actor_id and owner_id=new.user_id) into v_exists;
      elsif new.actor_type='activity_club' then
        select exists(select 1 from public.activity_clubs where id=new.actor_id and manager_id=new.user_id and status in ('open','full')) into v_exists;
      elsif new.actor_type='event' then
        select exists(select 1 from public.events where id=new.actor_id and manager_id=new.user_id and status='published') into v_exists;
      else
        raise exception 'Unsupported official Moment identity';
      end if;

      if not coalesce(v_exists,false) then raise exception 'You do not manage this listing'; end if;
    end if;
  elsif tg_table_name='social_likes' then
    if new.target_type='moment' then select exists(select 1 from public.explorer_moments where id=new.target_id and status='published') into v_exists;
    elsif new.target_type='review' then
      select exists(select 1 from public.explorer_reviews where id=new.target_id and status='published') into v_exists;
      -- Packet 8c: a review's own author cannot endorse it as useful.
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
-- 5. Read policy
-- ---------------------------------------------------------------------------
-- Replaces explorer_moments_public_read. Dropped rather than left in place:
-- policies for the same command are ORed together, so leaving the old one would
-- make every friends-only Moment publicly readable and the new policy
-- decorative.

drop policy if exists explorer_moments_public_read on public.explorer_moments;
drop policy if exists explorer_moments_read_visible on public.explorer_moments;
create policy explorer_moments_read_visible on public.explorer_moments
for select to public using (
  user_id=(select auth.uid())
  or (status='published' and visibility='public')
  or (status='published' and visibility='friends' and guestbook_private.are_friends(user_id,(select auth.uid())))
);

-- ---------------------------------------------------------------------------
-- 6. Notifications: nothing new, and one thing narrowed
-- ---------------------------------------------------------------------------
-- Rebuilt from the live definition, which carries the review deep-link work
-- from 20260802184500. Two changes, both subtractions:
--
--   * An official Moment sends nothing. A business posting is feed content,
--     not a push to everyone who ever followed the manager personally.
--   * A friends-only Moment notifies mutual followers only. Telling a one-way
--     follower that a Moment exists which they cannot open announces both the
--     Moment and the fact that they are not a friend.
--
-- No fan-out was added for entity or location follows.

create or replace function guestbook_private.social_notification_trigger()
returns trigger
language plpgsql
security definer
set search_path='public','pg_temp'
as $$
declare
  v_actor_name text;
  v_actor_id uuid;
  v_owner uuid;
  v_deep_link text;
  v_message text;
  v_review_target_type text;
  v_review_target_id uuid;
  v_has_video boolean:=false;
begin
  if tg_table_name='explorer_follows' then v_actor_id:=new.follower_id;
  else v_actor_id:=new.user_id;
  end if;

  select coalesce(nullif(btrim(full_name),''),'An Explorer') into v_actor_name
  from public.profiles where id=v_actor_id;

  if tg_table_name='explorer_follows' then
    insert into public.notifications(recipient_user_id,actor_user_id,type,title,message,entity_type,entity_id,deep_link,data,dedupe_key)
    values(new.following_id,new.follower_id,'social_follow','New follower',v_actor_name||' started following you.','profile',new.follower_id,'/profile/'||new.follower_id,jsonb_build_object('category','social','social_type','follow'),'social-follow-'||new.id);

  elsif tg_table_name='explorer_moments' then
    if new.actor_type='explorer' then
      insert into public.notifications(recipient_user_id,actor_user_id,type,title,message,entity_type,entity_id,deep_link,data,dedupe_key)
      select f.follower_id,new.user_id,'social_moment','New Moment',v_actor_name||' shared a new Moment.','moment',new.id,'/moments/'||new.id,jsonb_build_object('category','social','social_type','moment'),'social-moment-'||new.id||'-'||f.follower_id
      from public.explorer_follows f
      where f.following_id=new.user_id and f.follower_id<>new.user_id
        and (new.visibility='public' or guestbook_private.are_friends(new.user_id,f.follower_id));
    end if;

  elsif tg_table_name='social_likes' then
    v_owner:=guestbook_private.social_content_owner(new.target_type,new.target_id);
    if v_owner is not null and v_owner<>new.user_id then
      if new.target_type='moment' then
        v_deep_link:='/moments/'||new.target_id;
      else
        select target_type,target_id into v_review_target_type,v_review_target_id
        from public.explorer_reviews where id=new.target_id;
        select exists(select 1 from public.review_media where review_id=new.target_id and media_type='video' and moderation_status='published') into v_has_video;
        if v_has_video then
          v_deep_link:='/social-comments/'||new.target_id;
        elsif v_review_target_type='business' then v_deep_link:='/business/'||v_review_target_id;
        elsif v_review_target_type='property' then v_deep_link:='/property/'||v_review_target_id;
        elsif v_review_target_type='activity_club' then v_deep_link:='/activity-clubs/'||v_review_target_id;
        elsif v_review_target_type='event' then v_deep_link:='/events/'||v_review_target_id;
        else v_deep_link:='/profile/'||v_owner;
        end if;
      end if;

      v_message:=v_actor_name||' liked your '||case when new.target_type='moment' then 'Moment.' else 'review.' end;
      insert into public.notifications(recipient_user_id,actor_user_id,type,title,message,entity_type,entity_id,deep_link,data,dedupe_key)
      values(v_owner,new.user_id,'social_like','New like',v_message,new.target_type,new.target_id,v_deep_link,jsonb_build_object('category','social','social_type','like','content_type',new.target_type),'social-like-'||new.id);
    end if;

  elsif tg_table_name='social_comments' then
    v_owner:=guestbook_private.social_content_owner(new.target_type,new.target_id);
    if v_owner is not null and v_owner<>new.user_id then
      v_deep_link:=case when new.target_type='moment' then '/moments/'||new.target_id else '/social-comments/'||new.target_id end;
      insert into public.notifications(recipient_user_id,actor_user_id,type,title,message,entity_type,entity_id,deep_link,data,dedupe_key)
      values(v_owner,new.user_id,'social_comment','New comment',v_actor_name||' commented on your '||case when new.target_type='moment' then 'Moment.' else 'video review.' end,new.target_type,new.target_id,v_deep_link,jsonb_build_object('category','social','social_type','comment','content_type',new.target_type),'social-comment-'||new.id);
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. The feed applies the same rule
-- ---------------------------------------------------------------------------
-- Rebuilt from the live definition, which is SECURITY INVOKER since
-- 20260804013508 -- so RLS already applies to it and the filter below is the
-- second lock rather than the only one. It is here because this function is
-- one `security definer` away from being the hole, and a feed that decides
-- visibility for itself is exactly how a private post reaches a stranger.
--
-- The return type is unchanged, so app/feed.js needs no change to keep working.

create or replace function public.get_explorer_social_feed(p_limit integer default 20,p_offset integer default 0)
returns table(
  item_id uuid,item_type text,actor_id uuid,actor_name text,actor_photo text,created_at timestamptz,
  caption text,rating integer,verified_qr boolean,target_type text,target_id uuid,target_name text,target_image_url text,
  media_type text,media_url text,thumbnail_url text,duration_seconds numeric,like_count bigint,comment_count bigint,viewer_liked boolean
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
  )
  select * from (
    select * from moments union all select * from reviews union all select * from favourites
  ) feed
  order by created_at desc
  limit greatest(1,least(coalesce(p_limit,20),50)) offset greatest(coalesce(p_offset,0),0);
$$;

commit;

-- Step 2 -- one audience vocabulary for the whole app, including Followers.
--
-- WHAT IS WRONG TODAY
--
-- Three tables answer "who can see this" with three different word lists:
--
--   profiles.visibility          nobody | friends | close_friends | everyone
--   explorer_moments.visibility  public | friends
--   explorer_memories.visibility private | friends | selected | public
--
-- Same question, three vocabularies, and two of them use a different word for
-- the same idea ('public' vs 'everyone', 'private' vs 'nobody'). Any code that
-- has to compare them ends up translating, and translation is where a privacy
-- bug hides.
--
-- THE ONE LIST, narrowest first:
--
--   nobody         only the owner
--   selected       a hand-picked list for this one post
--   close_friends  the owner's close friends list
--   friends        both follow each other
--   followers      anybody who follows the owner
--   everyone       any signed-in Explorer
--
-- 'followers' is new and is the reason this step exists now: a Memory can
-- deliberately be shared with followers, so the vocabulary has to carry it.
--
-- NOTE ON 'followers' BEING WIDER THAN 'friends'
--
-- Following is one-way and needs no permission, so 'followers' is a genuinely
-- wider audience than 'friends' -- anybody can put themselves in it. That is
-- fine for a Memory somebody chose to share, and it is NOT fine for presence:
-- check-ins and Link-ups keep using friends, which is what step 7 of the
-- rebuild fixed. This vocabulary makes the difference sayable rather than
-- accidental.
--
-- profiles.visibility does NOT accept 'selected'. A global default cannot name
-- a per-post list.
--
-- MIGRATION IS BY VALUE, NOT BY RENAME. Every existing row is mapped explicitly
-- below and the counts are asserted, because silently renaming a privacy value
-- is how content ends up in front of somebody who never agreed to it.
--
-- TO UNDO
--   restore the three constraints from 20260802155202, 20260805130000 and
--   20260811200000, and map the values back the other way.

begin;

-- ---------------------------------------------------------------------------
-- 1. The rank. Narrower wins.
-- ---------------------------------------------------------------------------
-- The profile setting is a ceiling: a post can be narrower than it and never
-- wider. Expressing that as a number is what lets one function compare them.

create or replace function guestbook_private.audience_rank(p_audience text)
returns integer
language sql
immutable
as $$
  select case p_audience
    when 'nobody' then 0
    when 'selected' then 1
    when 'close_friends' then 2
    when 'friends' then 3
    when 'followers' then 4
    when 'everyone' then 5
    else 0            -- anything unrecognised is the narrowest, never the widest
  end;
$$;

comment on function guestbook_private.audience_rank(text) is
  'Orders the audience vocabulary narrowest to widest so a ceiling can be applied. Anything unrecognised ranks as nobody, so a typo closes access rather than opening it.';

-- ---------------------------------------------------------------------------
-- 2. Does this audience let this viewer in
-- ---------------------------------------------------------------------------
-- 'selected' returns false here on purpose: it depends on a per-post list, and
-- only the caller knows which post. can_see_content below handles it.

create or replace function guestbook_private.audience_allows(p_owner uuid,p_viewer uuid,p_audience text)
returns boolean
language sql
stable
security definer
set search_path='public','pg_temp'
as $$
  select case
    when p_owner is null or p_viewer is null then false
    when p_owner = p_viewer then true
    when p_audience = 'everyone' then true
    when p_audience = 'followers' then exists(
      select 1 from public.explorer_follows f
      where f.follower_id = p_viewer and f.following_id = p_owner
    )
    when p_audience = 'friends' then guestbook_private.are_friends(p_owner,p_viewer)
    when p_audience = 'close_friends' then exists(
      select 1 from public.close_friends cf
      where cf.owner_id = p_owner and cf.friend_id = p_viewer
    )
    else false        -- nobody, selected, and anything unrecognised
  end;
$$;

revoke all on function guestbook_private.audience_allows(uuid,uuid,text) from public, anon;
grant execute on function guestbook_private.audience_allows(uuid,uuid,text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. The one question every surface asks
-- ---------------------------------------------------------------------------
-- May this viewer see a piece of content owned by this Explorer, given the
-- audience the owner chose for it? The profile setting is applied as a ceiling
-- here, in one place, so no screen can forget it.

create or replace function guestbook_private.can_see_content(p_owner uuid,p_viewer uuid,p_audience text)
returns boolean
language sql
stable
security definer
set search_path='public','pg_temp'
as $$
  select case
    when p_owner is null or p_viewer is null then false
    when p_owner = p_viewer then true
    else guestbook_private.audience_allows(
      p_owner,
      p_viewer,
      -- The narrower of what the owner set globally and what they chose for
      -- this post. A post can never reach past the profile setting.
      case
        when guestbook_private.audience_rank(coalesce(
               (select pr.visibility from public.profiles pr where pr.id = p_owner),'nobody'))
             < guestbook_private.audience_rank(p_audience)
        then coalesce((select pr.visibility from public.profiles pr where pr.id = p_owner),'nobody')
        else p_audience
      end
    )
  end;
$$;

comment on function guestbook_private.can_see_content(uuid,uuid,text) is
  'May this viewer see content owned by this Explorer with this audience. Applies profiles.visibility as a ceiling, so a post can narrow it and never widen it. Does not handle ''selected'' -- that needs the per-post share list and is checked alongside this.';

revoke all on function guestbook_private.can_see_content(uuid,uuid,text) from public, anon;
grant execute on function guestbook_private.can_see_content(uuid,uuid,text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Move every existing value onto the one list
-- ---------------------------------------------------------------------------
-- Constraints come off first, values move, constraints go back on. Each table
-- is mapped explicitly -- there is no rename shortcut here, because 'public'
-- meaning 'everyone' and 'private' meaning 'nobody' are translations, and a
-- translation applied by accident is a disclosure.

alter table public.profiles drop constraint if exists profiles_visibility_check;
alter table public.explorer_moments drop constraint if exists explorer_moments_visibility_check;
alter table public.explorer_memories drop constraint if exists explorer_memories_visibility_check;
alter table public.explorer_memories drop constraint if exists explorer_memories_archive_visibility_check;

-- Moments: 'public' was the only non-friends value the table allowed.
update public.explorer_moments set visibility='everyone' where visibility='public';

-- Memories: 'private' is nobody, 'public' is everyone; friends and selected
-- already use the canonical words.
update public.explorer_memories set visibility='nobody' where visibility='private';
update public.explorer_memories set visibility='everyone' where visibility='public';
update public.explorer_memories set archive_visibility='nobody' where archive_visibility='private';
update public.explorer_memories set archive_visibility='everyone' where archive_visibility='public';

alter table public.profiles
  add constraint profiles_visibility_check
  check (visibility in ('nobody','close_friends','friends','followers','everyone'));

alter table public.explorer_moments
  add constraint explorer_moments_visibility_check
  check (visibility in ('nobody','selected','close_friends','friends','followers','everyone'));

alter table public.explorer_memories
  add constraint explorer_memories_visibility_check
  check (visibility in ('nobody','selected','close_friends','friends','followers','everyone'));

alter table public.explorer_memories
  add constraint explorer_memories_archive_visibility_check
  check (archive_visibility in ('nobody','selected','close_friends','friends','followers','everyone'));

-- The two column defaults still name the old words.
alter table public.explorer_moments alter column visibility set default 'friends';
alter table public.explorer_memories alter column visibility set default 'nobody';
alter table public.explorer_memories alter column archive_visibility set default 'nobody';

-- The rule that forced anything shared to expire is stated TWICE -- once as a
-- table constraint and once, in words, inside guestbook_private.validate_memory
-- (20260805130000:286). Both are written against 'private', a value that stops
-- existing three statements above, so both have to go in the same breath as the
-- rename. The trigger fires on the UPDATE that does the renaming, which is how
-- this was found rather than assumed.
--
-- Removing the rule is step 5's decision, not this one's. What happens here is
-- only that it stops referring to a word that no longer exists; step 5 explains
-- why a shared Memory is allowed to be permanent.
alter table public.explorer_memories
  drop constraint if exists explorer_memories_shared_needs_expiry;

create or replace function guestbook_private.validate_memory()
returns trigger
language plpgsql
security definer
set search_path='public','pg_temp'
as $$
declare v_exists boolean:=false;
begin
  if not guestbook_private.is_explorer(new.user_id) then
    raise exception 'Only Explorer accounts can keep Memories';
  end if;

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

  -- GONE: "a Memory other people can see needs an end date". A Memory is
  -- permanent content now. How long it sits on TODAY'S map is map_until, added
  -- in step 5, and that is a different question from who may see it.
  --
  -- GONE with it: the rule forbidding a finished live period from being
  -- restarted. It guarded live_until, which no longer decides visibility.

  new.updated_at:=now();
  return new;
end;
$$;

revoke all on function guestbook_private.validate_memory() from public,anon,authenticated;

-- ---------------------------------------------------------------------------
-- 5. can_see_explorer keeps working, and gains followers
-- ---------------------------------------------------------------------------
-- Presence still asks this one. It is now a thin wrapper so there is a single
-- implementation of the vocabulary rather than two that must agree.

create or replace function guestbook_private.can_see_explorer(p_owner uuid,p_viewer uuid)
returns boolean
language sql
stable
security definer
set search_path='public','pg_temp'
as $$
  select guestbook_private.audience_allows(
    p_owner,
    p_viewer,
    coalesce((select pr.visibility from public.profiles pr where pr.id = p_owner),'nobody')
  );
$$;

commit;

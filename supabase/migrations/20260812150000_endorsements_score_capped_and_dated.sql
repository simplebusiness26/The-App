-- Decision 8, settled on option A: an endorsement earns the reviewer a point,
-- capped per review, dated to when it happened. This is Packet 19a.
--
-- WHAT IT FIXES
--
-- A review fifty Explorers found useful and a review nobody read scored exactly
-- the same. There are 155 endorsements on 109 reviews right now and not one of
-- them has ever been worth anything -- social_likes with target_type='review'
-- is read by no scoring function anywhere.
--
-- WHY IT ONLY WORKS NOW
--
-- The old board added up explorer_reviews.points_awarded, a single number on
-- the review row with no date on it. There was nowhere to put "this point
-- arrived on Tuesday", so an endorsement could only ever have been a permanent
-- bonus that ignored the weekly window. The ledger dates every point, so
-- 20260812140000 had to land first.
--
-- THE CAP, AND WHY IT IS PER REVIEW
--
-- Five points per review, whoever endorses it. There are nineteen accounts.
-- Without a per-review cap, two friends could take turns endorsing each other's
-- reviews and top the board in an evening -- the daily and weekly caps
-- (100/400, 20260810040000:86-100) would not stop it because they are generous
-- enough for real activity.
--
-- Endorsements past the fifth still count as endorsements. The review still
-- says "5 people found this useful". They just stop paying.
--
-- place_key BECOMES subject_key
--
-- The column exists so a cap can ask "how many points has this Explorer already
-- had for THIS thing". That was written for places and is now also the answer
-- for reviews, so it gets the name it always meant. Same column, same rule, same
-- promise: it is never returned by any reader, because a list of the places
-- somebody scored at is a movement history.
--
-- TO UNDO
--   drop trigger if exists social_likes_score on public.social_likes;
--   drop trigger if exists social_likes_unscored on public.social_likes;
--   delete from public.explorer_score_events where source='endorsement';
--   alter table public.explorer_score_events rename column subject_key to place_key;
--   (and restore the two-value source check)

begin;

-- ---------------------------------------------------------------------------
-- 1. The column says what it is for
-- ---------------------------------------------------------------------------

alter table public.explorer_score_events rename column place_key to subject_key;

alter index if exists explorer_score_events_place_idx
  rename to explorer_score_events_subject_idx;

comment on column public.explorer_score_events.subject_key is
  'What these points were about -- a place for a check-in, a review for an endorsement. Exists ONLY so caps and diminishing returns can be applied. Never returned by any reader: a list of what somebody scored on is a history of where they went.';

-- ---------------------------------------------------------------------------
-- 2. A third source
-- ---------------------------------------------------------------------------

alter table public.explorer_score_events
  drop constraint if exists explorer_score_events_source_check;

alter table public.explorer_score_events
  add constraint explorer_score_events_source_check
  check (source in ('review','checkin','endorsement'));

-- ---------------------------------------------------------------------------
-- 3. checkin_points follows the rename
-- ---------------------------------------------------------------------------
-- Unchanged behaviour. Restated here because the column it reads has a new
-- name and a function body compiled against the old one would fail on its next
-- call, not on this migration.

create or replace function guestbook_private.checkin_points(p_user uuid,p_place text)
returns integer
language sql
stable
security definer
set search_path='public','pg_temp'
as $$
  select greatest(
    0,
    (10 / power(2,least(coalesce((
      select count(*) from public.explorer_score_events
      where user_id=p_user and source='checkin' and subject_key=p_place
    ),0),4)))::integer
  );
$$;

create or replace function guestbook_private.award_checkin_score()
returns trigger
language plpgsql
security definer
set search_path='public','pg_temp'
as $$
declare
  v_place text;
  v_points integer;
begin
  if new.status<>'active' then return new; end if;

  v_place := coalesce(new.target_id::text,new.public_place_id::text,lower(coalesce(new.place_name,'')));
  if v_place='' then return new; end if;

  v_points := guestbook_private.checkin_points(new.user_id,v_place);
  if v_points<=0 then return new; end if;

  if not guestbook_private.score_within_caps(new.user_id,v_points) then
    return new;
  end if;

  insert into public.explorer_score_events(user_id,source,source_id,subject_key,points)
  values (new.user_id,'checkin',new.id,v_place,v_points)
  on conflict (source,source_id) do nothing;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. How much an endorsement is worth right now
-- ---------------------------------------------------------------------------

create or replace function guestbook_private.endorsement_points(p_review uuid)
returns integer
language sql
stable
security definer
set search_path='public','pg_temp'
as $$
  select case
    when coalesce((
      select sum(points) from public.explorer_score_events
      where source='endorsement' and subject_key=p_review::text
    ),0) >= 5
    then 0
    else 1
  end;
$$;

comment on function guestbook_private.endorsement_points(uuid) is
  'One point per endorsement until a review has earned five, then nothing. The endorsement still counts on screen; it stops paying.';

revoke all on function guestbook_private.endorsement_points(uuid) from public,anon,authenticated;

-- ---------------------------------------------------------------------------
-- 5. Awarding it
-- ---------------------------------------------------------------------------
-- The point goes to whoever WROTE the review, not whoever pressed the button.
--
-- source_id is the social_likes row, not the review: it has to be unique per
-- endorsement or the second one would collide on (source,source_id) and be
-- silently dropped. Un-endorsing deletes that row and takes the point with it.

create or replace function guestbook_private.award_endorsement_score()
returns trigger
language plpgsql
security definer
set search_path='public','pg_temp'
as $$
declare
  v_author uuid;
  v_points integer;
begin
  if new.target_type<>'review' then return new; end if;

  select er.user_id into v_author
  from public.explorer_reviews er
  where er.id=new.target_id and er.status='published';

  if v_author is null then return new; end if;

  -- Endorsing your own review pays nothing. EndorseButton hides itself for the
  -- author and the table refuses it, and this is the third lock -- the one that
  -- holds if either of the other two is ever loosened.
  if v_author=new.user_id then return new; end if;

  v_points := guestbook_private.endorsement_points(new.target_id);
  if v_points<=0 then return new; end if;

  if not guestbook_private.score_within_caps(v_author,v_points) then
    return new;
  end if;

  insert into public.explorer_score_events(user_id,source,source_id,subject_key,points)
  values (v_author,'endorsement',new.id,new.target_id::text,v_points)
  on conflict (source,source_id) do nothing;

  return new;
end;
$$;

drop trigger if exists social_likes_score on public.social_likes;
create trigger social_likes_score after insert on public.social_likes
for each row execute function guestbook_private.award_endorsement_score();

drop trigger if exists social_likes_unscored on public.social_likes;
create trigger social_likes_unscored after delete on public.social_likes
for each row execute function guestbook_private.remove_score_for_source('endorsement');

-- ---------------------------------------------------------------------------
-- 6. The 155 endorsements already sitting there
-- ---------------------------------------------------------------------------
-- Dated to the endorsement's own created_at, not to today. Dumping five months
-- of endorsements onto this week's board would hand the top places to whoever
-- posted earliest, which is the opposite of what a weekly board is for.
--
-- The per-review cap is applied by taking the five oldest endorsements of each
-- review. The daily and weekly caps are NOT applied to the backfill: they exist
-- to stop somebody farming points in a burst, and these points were earned over
-- months by other people pressing a button.

with ranked as (
  select
    sl.id,
    sl.target_id as review_id,
    er.user_id as author,
    sl.created_at,
    row_number() over (partition by sl.target_id order by sl.created_at,sl.id) as nth
  from public.social_likes sl
  join public.explorer_reviews er
    on er.id=sl.target_id and er.status='published'
  where sl.target_type='review'
    and er.user_id<>sl.user_id
)
insert into public.explorer_score_events(user_id,source,source_id,subject_key,points,awarded_on,created_at)
select author,'endorsement',id,review_id::text,1,(created_at at time zone 'utc')::date,created_at
from ranked
where nth<=5
on conflict (source,source_id) do nothing;

commit;

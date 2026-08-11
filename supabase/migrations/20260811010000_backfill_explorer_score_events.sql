-- Packet 9a follow-up: backfill Explorer Score for what already happened.
--
-- The engine in 20260810040000 awards points only from the moment its
-- triggers exist -- a review published last week or a check-in from three
-- days ago earns nothing on its own. Decided: existing activity should
-- count. This is a one-time ledger fill, not a change to how the engine
-- scores anything going forward.
--
-- REVIEWS: same rule as the trigger -- 15 points verified, 5 otherwise --
-- applied directly, not by re-running award_review_score() through an
-- UPDATE on every row. Re-touching every row would move updated_at and,
-- more to the point, would run every insert through score_within_caps()
-- against TODAY's date, so a prolific reviewer's whole history would
-- silently get capped at 100 points. A backfill isn't farming; it should
-- not be throttled like it is.
--
-- CHECK-INS: the diminishing-returns formula depends on how many prior
-- check-ins at the SAME place came before it. This replays that count in
-- chronological order per (user, place) with a window function instead of
-- the trigger's running COUNT(*) -- same formula
-- (10 / 2^least(rank-1,4), rounded to nearest integer), same place key
-- (target_id, then public_place_id, then lower(place_name)), computed over
-- history in one pass instead of one row at a time. Every row in
-- live_checkins was 'active' the moment it was created, so all of them are
-- eligible regardless of current status -- ended and expired both mean the
-- check-in happened.
--
-- Both inserts key off `explorer_score_events_unique (source, source_id)`,
-- so this is safe to run once and safe to re-run: nothing already scored
-- -- by this backfill, or by a trigger firing on a genuinely new row in the
-- meantime -- gets scored twice.
--
-- awarded_on is set to the source's own created_at date, not today. Caps
-- are windowed off awarded_on, so a historical fill dated today would
-- immediately eat into this week's cap for anyone with a heavy past.
--
-- REVERSAL
--   No standalone reversal -- this is a data fill, not a schema change,
--   and once organic scoring runs there is no column marking which rows
--   came from this backfill versus a trigger. If this needs to be undone,
--   do it before any new organic scoring happens:
--     delete from public.explorer_score_events
--     where source='review' and source_id in (select id from public.explorer_reviews)
--        or source='checkin' and source_id in (select id from public.live_checkins);

begin;

insert into public.explorer_score_events(user_id,source,source_id,points,awarded_on,created_at)
select
  er.user_id,
  'review',
  er.id,
  case when er.verified_qr then 15 else 5 end,
  er.created_at::date,
  now()
from public.explorer_reviews er
where er.status='published'
on conflict (source,source_id) do nothing;

with placed as (
  select
    lc.id,
    lc.user_id,
    coalesce(lc.target_id::text,lc.public_place_id::text,lower(lc.place_name)) as place_key,
    lc.created_at,
    row_number() over (
      partition by lc.user_id,coalesce(lc.target_id::text,lc.public_place_id::text,lower(lc.place_name))
      order by lc.created_at
    ) as rn
  from public.live_checkins lc
)
insert into public.explorer_score_events(user_id,source,source_id,place_key,points,awarded_on,created_at)
select
  p.user_id,
  'checkin',
  p.id,
  p.place_key,
  greatest(0,(10/power(2,least(p.rn-1,4)))::integer),
  p.created_at::date,
  now()
from placed p
on conflict (source,source_id) do nothing;

commit;

-- Decision 1, settled: the Leaderboard ranks on Explorer Score.
--
-- WHAT CHANGES
--
-- get_explorer_leaderboard added up explorer_reviews.points_awarded for reviews
-- written inside the period. So the public board measured one thing only: how
-- much you had written. Checking in, going places, being useful to other
-- Explorers -- none of it counted, on a board called Explorer Score.
--
-- It now ranks on public.explorer_score_events, the ledger added by
-- 20260810040000: dated, capped daily and weekly, with diminishing returns for
-- the same place, and awarded only by SECURITY DEFINER triggers that no client
-- can reach.
--
-- Everybody's position moves the day this ships. That was the known cost and
-- it was accepted.
--
-- THE PRIVACY PROBLEM THIS ALSO HAD TO SOLVE
--
-- Not part of the decision as asked, and it would have shipped a leak.
--
-- The old board returned review_count, verified_reviews and video_reviews next
-- to points. Harmless while points came only from reviews. Fatal the moment
-- points come from the ledger, because review points are a known constant --
-- 5 for a review, 15 verified (20260810040000:145) -- so anybody could compute:
--
--   check-in points = points - (5 x unverified) - (15 x verified)
--
-- and, knowing the halving rule, work backwards to roughly how many different
-- places somebody had been. That is a visit count assembled out of a
-- leaderboard, and it is precisely what 20260810040000 refused to expose:
-- "a per-source split is a visit count, so the breakdown is
-- get_explorer_score_breakdown() and is the owner's alone."
--
-- So the public board now returns a position and a total. Nothing else. The
-- three count columns are gone from it. An Explorer can still see their own
-- breakdown -- get_explorer_score_breakdown() is unchanged, SECURITY INVOKER
-- and filtered to auth.uid().
--
-- This is the privacy-reviewer's "leakage through the back door": counts and
-- ordered lists reveal position without a coordinate ever appearing.
--
-- WHAT DOES NOT CHANGE
--
-- The route, the screen, the opt-in (profiles.leaderboard_opt_in), the
-- @test.com exclusion, local scope by area, and the function's name and
-- argument list. Renaming any of it would break two callers for nothing
-- anybody can see.
--
-- TO UNDO
--   restore the body from 20260802152200:30-70 (or the version live before
--   this migration, which is the same shape).

begin;

-- The return type changes, so the old one has to go rather than be replaced.
drop function if exists public.get_explorer_leaderboard(text,text,text,integer);

create function public.get_explorer_leaderboard(
  p_period text default 'weekly',
  p_scope text default 'national',
  p_area text default null,
  p_limit integer default 50
)
returns table(
  rank bigint,
  user_id uuid,
  full_name text,
  profile_photo text,
  area text,
  points bigint
)
language sql
stable
-- SECURITY DEFINER, where the old one was INVOKER, and it is not optional.
-- explorer_score_events has one select policy -- `user_id = auth.uid()`
-- (20260810040000) -- so an invoker function would show every Explorer a
-- leaderboard containing only themselves, and a signed-out visitor an empty
-- one. Definer is what lets it aggregate across people; what it exposes is
-- still only a name, an area somebody chose to show, and a total.
security definer
set search_path='public','pg_temp'
as $$
with settings as (
  select case
    when lower(p_period)='monthly' then date_trunc('month',now() at time zone 'utc')::date
    else date_trunc('week',now() at time zone 'utc')::date
  end as starts_on
), totals as (
  select
    p.id as user_id,
    coalesce(p.full_name,'Explorer') as full_name,
    p.profile_photo,
    case when p.show_area then nullif(trim(p.area),'') end as area,
    sum(e.points)::bigint as points
  from public.explorer_score_events e
  join public.profiles p on p.id=e.user_id
  cross join settings s
  where e.awarded_on >= s.starts_on
    and p.leaderboard_opt_in
    and coalesce(p.email,'') not ilike '%@test.com'
    and (
      lower(p_scope)<>'local'
      or (
        p.show_area
        and nullif(trim(p.area),'') is not null
        and lower(trim(p.area))=lower(trim(coalesce(p_area,'')))
      )
    )
  group by p.id,p.full_name,p.profile_photo,p.show_area,p.area
  having sum(e.points) > 0
), ranked as (
  -- The tiebreak was verified_reviews then video_reviews. Both are gone from
  -- the output, and using a hidden column to order a visible list is the same
  -- leak one step removed -- the order would still encode the split. user_id
  -- is arbitrary and stable, which is all a tiebreak has to be.
  select dense_rank() over(order by points desc,user_id) as rank,*
  from totals
)
select rank,user_id,full_name,profile_photo,area,points
from ranked
order by rank,user_id
limit greatest(1,least(coalesce(p_limit,50),100));
$$;

comment on function public.get_explorer_leaderboard(text,text,text,integer) is
  'Public ranking on Explorer Score for the period. Returns a position and a total and nothing else: publishing a per-source split alongside the total would let anybody derive a check-in count, which is a visit history. The owner''s own split is get_explorer_score_breakdown().';

revoke all on function public.get_explorer_leaderboard(text,text,text,integer) from public;
grant execute on function public.get_explorer_leaderboard(text,text,text,integer) to anon,authenticated;

commit;

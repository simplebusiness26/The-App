-- Stop activity_club_stats and explorer_profile_stats reading past row level
-- security, without breaking the counts they render.
--
-- WHY
-- A view with no security_invoker option runs as its owner. Both of these are
-- owned by postgres, which holds rolbypassrls, so every base-table policy armed
-- in the 20260803 run was simply not evaluated when the app read through them.
-- Supabase's linter reports this as security_definer_view, at ERROR level.
--
-- WHY THE OBVIOUS FIX IS ONLY HALF RIGHT
-- Flipping both to security_invoker is correct for one view and wrong for the
-- other, because their base tables have different policies.
--
-- explorer_profile_stats reads profiles, explorer_reviews and review_media.
-- explorer_reviews_public_read is `status = 'published' OR user_id = auth.uid()`
-- and review_media_public_read follows its parent review. The view already
-- filters every aggregate to status = 'published', so a signed-in caller sees
-- exactly what the owner saw. Measured before and after on the explorer with
-- the most reviews: 6 reviews, 3 with images, 0 verified, 8 points, both ways.
-- Straight flip, no change in behaviour.
--
-- activity_club_stats is the opposite. member_count aggregates
-- activity_memberships, whose only read policy is "Applicants and club managers
-- can view memberships" -- own rows, or rows for a club you manage. Under a
-- naive invoker flip the count collapses to what the caller happens to be able
-- to see. Measured on Hastings Sunset Running Club, true member_count 1:
--
--   anon                     0 members, 12 spaces remaining  (wrong)
--   unrelated signed-in user 0 members, 12 spaces remaining  (wrong)
--   club manager             1 member,  11 spaces remaining  (right, by luck)
--
-- Both /activity-clubs and /activity-clubs/[id] render signed out, so that is a
-- wrong number on a public screen -- and the worst kind, because a club showing
-- "12 spaces" when it has 11 looks entirely plausible.
--
-- THE FIX
-- Move just the membership count behind a SECURITY DEFINER function with a
-- single uuid argument that returns nothing but an integer, and let the view be
-- a true invoker view around it. The caller's RLS now governs which clubs and
-- which reviews they see; only the aggregate over memberships is privileged,
-- and an approved-member headcount is already public information -- it is what
-- the screen has always displayed. Nobody gains the ability to read a
-- membership row, or to learn who the members are.
--
-- Widening activity_memberships with a public read policy would have cleared
-- the same lint with less code, and was rejected: it would expose which
-- Explorer belongs to which club to anyone holding the anon key, which is a
-- privacy regression traded for a lint.
--
-- The review aggregates need no such treatment -- activity_club_reviews has a
-- `using (true)` public read policy, so they are identical under either
-- setting. (There are 0 review rows today, so this is reasoning, not
-- measurement.)
--
-- Verified after applying, by impersonating roles in rolled-back transactions:
--
--   anon                     1 member, 11 spaces -- matches the pre-change value
--   unrelated signed-in user 1 member, 11 spaces
--   signed-in explorer       6 reviews, 3 with images, 8 points -- unchanged
--   anon on profile stats    0 rows
--
-- That last line is expected and costs nothing. profiles is readable only by
-- signed-in users, so a signed-out visitor to /profile/[id] already fails on
-- the profiles select in ExplorerProfileScreen.js:94 and renders "This profile
-- could not be loaded" before it ever looks at the stats.
--
-- WORTH KNOWING LATER
-- The function is called twice per club row (once for member_count, once for
-- spaces_remaining) and Postgres does not inline SECURITY DEFINER functions, so
-- this is two index scans per club on the listing screen. Irrelevant at two
-- clubs; if the club list grows into the hundreds, fold the call into a lateral
-- join so it runs once per row.
--
-- The new function will show up in the linter as
-- anon_security_definer_function_executable. That is deliberate, and trades an
-- ERROR for a WARN on a function whose entire surface is "give me an integer
-- for this club id". It should not be revoked without replacing the count.
--
-- Also revokes the write grants both views carried for anon and authenticated.
-- Neither view is auto-updatable -- both aggregate -- so those grants never did
-- anything except widen the surface.
--
-- To revert:
--   alter view public.activity_club_stats reset (security_invoker);
--   alter view public.explorer_profile_stats reset (security_invoker);
-- (the pre-change member_count was a left join on an approved-membership
-- aggregate, which the function now performs)

create or replace function public.activity_club_approved_member_count(p_club_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.activity_memberships
  where club_id = p_club_id
    and status = 'approved';
$$;

revoke all on function public.activity_club_approved_member_count(uuid) from public;
grant execute on function public.activity_club_approved_member_count(uuid) to anon, authenticated;

create or replace view public.activity_club_stats
with (security_invoker = on) as
select
  c.id as club_id,
  public.activity_club_approved_member_count(c.id) as member_count,
  coalesce(r.average_rating, 0::numeric) as average_rating,
  coalesce(r.review_count, 0) as review_count,
  greatest(c.member_limit - public.activity_club_approved_member_count(c.id), 0) as spaces_remaining
from public.activity_clubs c
left join (
  select
    activity_club_reviews.club_id,
    round(avg(activity_club_reviews.rating), 2) as average_rating,
    count(*)::integer as review_count
  from public.activity_club_reviews
  group by activity_club_reviews.club_id
) r on r.club_id = c.id;

alter view public.explorer_profile_stats set (security_invoker = on);

revoke insert, update, delete, truncate, references
  on public.activity_club_stats, public.explorer_profile_stats
  from anon, authenticated;

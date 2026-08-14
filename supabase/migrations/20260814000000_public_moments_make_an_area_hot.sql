-- What makes an area hot.
--
-- THE OWNER'S DEFINITION, IN THEIR WORDS
--
--   "if people post a public story... if a lot of people do it in that area then
--    that area becomes hot. That's exactly what I want: if people post a public
--    moment it gets hot" -- and "same if a moment is getting a lot of attention
--    it gets hot".
--
-- So: public Moments, and how much attention each one is getting.
--
-- WHAT THIS REPLACES, AND WHY IT IS A PRIVACY IMPROVEMENT
--
-- The heat was built in the app, from whatever the viewer could already see --
-- Moments, Memories and reviews, including friends-only ones. Two consequences
-- nobody intended:
--
--   1. Everybody's heatmap was DIFFERENT. Your warm patch and mine were built
--      from different posts, so a patch that is warm for you and cold for
--      everyone else is a statement about one of your friends.
--   2. It needed a floor -- three contributions from two different Explorers --
--      precisely because of that. The floor was a patch over the leak.
--
-- Public means public: audience 'everyone' AND a profile ceiling of 'everyone'.
-- Both, because guestbook_private.can_see_content takes the NARROWER of the two
-- and a Moment marked 'everyone' by somebody whose profile says 'friends' is a
-- friends Moment. Getting that wrong here would put a friends-only post's
-- location into a layer every Explorer can see.
--
-- With that rule, every point in here is already visible to every signed-in
-- Explorer as a Moment pin, and the heatmap is the same for all of them.
--
-- WHAT IT DOES NOT RETURN
--
-- No moment id, no user id, no created_at, no view count. A position and one
-- blended number. `attention` deliberately mixes views and likes rather than
-- reporting them separately: 20260811230000 decided that who watched your
-- Moment is not something the app hands out, and a raw view count is one step
-- from that. Blended, it cannot be read back.

begin;

create or replace function public.get_moment_heat()
returns table(
  latitude double precision,
  longitude double precision,
  attention integer
)
language sql
stable
security definer
set search_path = 'public','pg_temp'
as $$
  select
    m.latitude,
    m.longitude,
    -- A like is worth more than a view because it took a decision. The curve
    -- that turns this into a colour is utils/heatmap.js, where it can be
    -- tested; this only counts.
    (coalesce(v.views,0) + 3 * coalesce(l.likes,0))::integer as attention
  from public.explorer_moments m
  left join lateral (
    select count(*) as views
    from public.moment_views mv
    where mv.moment_id = m.id
  ) v on true
  left join lateral (
    select count(*) as likes
    from public.social_likes sl
    where sl.target_type = 'moment' and sl.target_id = m.id
  ) l on true
  where m.status = 'published'
    and m.latitude is not null
    and m.longitude is not null
    -- A Moment that has expired is not what is happening now.
    and (m.expires_at is null or m.expires_at > now())
    -- PUBLIC, BOTH WAYS. See the note above: the post's audience and the
    -- author's profile ceiling must BOTH say everyone.
    and m.visibility = 'everyone'
    and coalesce(
          (select pr.visibility from public.profiles pr where pr.id = m.user_id),
          'nobody'
        ) = 'everyone';
$$;

comment on function public.get_moment_heat() is
  'Where public Moments are being posted, and how much attention they are getting. Returns a position and one blended number per Moment -- no id, no author, no view count. Only Moments whose own audience AND whose author''s profile ceiling are both ''everyone'', so the heatmap is identical for every Explorer and can carry nothing a friends-only post said.';

-- Signed in only, like the rest of the living layer. Nothing here is secret,
-- but an anonymous caller has no map to put it on.
revoke all on function public.get_moment_heat() from public, anon;
grant execute on function public.get_moment_heat() to authenticated;

commit;

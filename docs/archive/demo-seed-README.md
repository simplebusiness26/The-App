# Demo seed

Sample content for the live development project (`yzpthslwsvesgndzdqai`) so the
app can be looked at rather than only reasoned about. Applied 2026-08-11.

This is **not** a migration and must never become one. It writes rows, not
schema, into one specific project. `scripts/verify-no-unguarded-seed.cjs` exists
precisely to stop data like this reaching `supabase/migrations/`.

## What it writes

| Kind | Rows | Notes |
|---|---|---|
| Follows | 62 | between the 11 non-`@test.com` accounts |
| Reviews | 37 | handwritten, `legacy_source='demo-seed'` |
| Review photos | 60 | two thirds of reviews carry photos, the rest are text only |
| Moments | 38 | public, attached to a listing, with photos |
| Likes | 231 | on Moments and reviews |
| Comments | 41 | on Moments |
| Saves | 79 | `explorer_favourites` |
| Live check-ins | 8 | active, expiring within four hours |
| Link-ups | 8 | upcoming over the next six days, with attendees |
| Memories | 15 | private, eight of them on the owner's account for My Map |

## How it is removed

Every seeded row carries a `deadbeef-…` UUID prefix, which is valid hex and
cannot collide with `gen_random_uuid()` output in practice. `undo.sql` deletes
on that prefix and restores the profile fields it changed. Run it whole; it is
one transaction.

## Two things it changes that are not rows

1. **Six demo accounts were renamed** so the leaderboard and Feed read as
   people rather than as `Property, Property, Test business owner`. Emails are
   untouched, so logins are unaffected. `undo.sql` restores the originals.

2. **Seeded review timestamps are spread across this week, this month and last
   month.** `get_explorer_leaderboard` only understands `weekly` and `monthly`
   and measures from `date_trunc`, so a seed dated "three days ago" lands
   outside the weekly board whenever the week has just turned over.

## What it deliberately does not touch

- The owner's own account (`hmpchelsea@gmail.com`) gets a profile picture and
  nothing else. `area` / `show_area` publish a real person's town on a public
  board and are theirs to switch on.
- Businesses and properties. The listings were already seeded; this adds the
  life on top of them, which is what was asked for.
- `live_checkins.visibility` is `public` on all eight seeded rows so they reach
  the map. That is a demo choice, not the product default — `app/checkins/create.js`
  still defaults a real check-in to Followers.

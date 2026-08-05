# Packet 8e — canonical places, follows and Moment visibility: manual test plan

The automated gates prove the contracts exist and the screens mount. They prove
nothing about what a person sees. This plan covers the parts a grep and a smoke
test cannot reach — and the privacy parts, which are the ones worth doing
first.

**Nothing in this plan can be run until the four migrations are applied.** They
were written but deliberately not applied in the session that built them. See
"Before you start".

## Before you start

1. Apply the migrations, in this order, to the target project:
   - `20260805120000_geo_areas_and_public_places.sql`
   - `20260805120100_area_and_place_references.sql`
   - `20260805120200_entity_and_location_follows.sql`
   - `20260805120300_moment_place_visibility_and_actor.sql`
2. Confirm the seed landed: four rows in `geo_areas`
   (East Sussex, Hastings, St Leonards-on-Sea, Brighton) and eight in
   `geo_area_aliases`.
3. Create at least two public places as an admin, one of them in Hastings.

## Accounts

- **Explorer A** — follows B, is followed by B. Mutual, so A and B are friends.
- **Explorer B** — the friend.
- **Explorer C** — follows A. One-way. C is not A's friend, and this is the
  account that proves the friends-only rule.
- **Manager M** — manages at least one business.
- **Admin** — `profiles.is_admin = true`.

## 1. Areas were matched, not guessed

Run as the admin:

```sql
select name, area_type from public.geo_areas order by name;
select * from public.get_unmatched_area_report();
```

- [ ] Four areas, and Hastings and St Leonards-on-Sea sit under East Sussex.
- [ ] The report lists `Hastings Old Town`, `Hastings Seafront`,
      `Brighton Seafront`, `Brighton Pier`, `Preston Park`, `North Laine`,
      `America Ground` and `Local area` — every one of them still unmatched.
- [ ] No row anywhere has been assigned to an area whose name it does not
      exactly match through an approved alias.
- [ ] `select count(*) from businesses where area_id is not null` returns 0.
      Addresses were not parsed.

## 2. A park has an identity

As any Explorer:

1. Open the drawer → Public places.
2. Search for a park, open it.

- [ ] The page shows the name, type, area and description.
- [ ] There is no Reviews section — public places have no reviews table, and an
      empty one would invite something the app cannot record.
- [ ] Follow shows a count; pressing it says "Following" and shows a banner.
- [ ] The second, smaller Follow button follows the town, not the park.
- [ ] Reopen the page: both buttons still read "Following".
- [ ] Unfollow: banner, count drops, state persists across a reload.

## 3. Check in at a canonical place

As Explorer A:

1. Create → Check in somewhere → Park.
2. Pick a place from the list rather than typing one.

- [ ] The name fills in from the place.
- [ ] After checking in:
      `select place_name, area, public_place_id, area_id from live_checkins
       order by created_at desc limit 1` — all four are populated.
- [ ] End the check-in. Start another, this time **typing** a park name that is
      not in the list: it still works, `public_place_id` is null and
      `place_name` is exactly what was typed. Nothing broke for the old path.

## 4. Moment visibility — the privacy test

As Explorer A, post a Moment and leave the audience on its default.

- [ ] The audience control opens on **Friends**, not Public.
- [ ] The success banner says only mutual follows can see it.

Then:

- [ ] As **B** (friend): the Moment appears in the feed and opens.
- [ ] As **C** (one-way follower): the Moment does **not** appear in the feed,
      and opening `/moments/<id>` directly says it is unavailable.
- [ ] As a signed-out visitor: the same refusal.
- [ ] As **A**: the Moment shows a FRIENDS badge.

Prove it at the database boundary too, not only in the app — the client could
be filtering:

```sql
-- as C's session (Supabase SQL editor: set the role and claims, or use the
-- app's own network calls with C signed in)
select count(*) from public.explorer_moments where id = '<A's friends-only Moment>';
```

- [ ] Returns 0 for C, 1 for B, 1 for A.

Repeat with a **Public** Moment:

- [ ] C sees it. A signed-out visitor sees it.

## 5. Notifications did not widen

- [ ] After A posts a **friends-only** Moment: B has a notification, C does
      **not**.
- [ ] After A posts a **public** Moment: both B and C do.
- [ ] After following a business or a town: nobody is notified, and no
      notification row is created for it.

## 6. Official posting

As Manager M, on a business M manages:

1. Create → Post a moment → attach that business.

- [ ] A "Post as" control appears offering M's own name or the business.
- [ ] Choosing the business hides the audience control and says official
      Moments are public.
- [ ] After publishing, `/moments/<id>` shows the business name as the author
      with "Official update", and the profile link still goes to M.

As Explorer A, attach the *same* business:

- [ ] No "Post as" control appears at all. Tagging a business is not being one.

Then prove the boundary is the database, not the screen. As A, with A's session:

```sql
insert into public.explorer_moments
  (user_id, caption, media_type, media_url, target_type, target_id,
   actor_type, actor_id, visibility, status)
values (auth.uid(), 'test', 'image', 'https://example.com/x.jpg',
        'business', '<business M manages>', 'business',
        '<business M manages>', 'public', 'published');
```

- [ ] Rejected: `You do not manage this listing`.

And as M, posting officially but attached to something else:

- [ ] Rejected: `An official Moment must be attached to the listing it speaks
      for`.

## 7. Location snapshot

As Explorer A:

1. Post a Moment attached to a business that has coordinates.
2. `select latitude, longitude, area_id, target_name from explorer_moments
    order by created_at desc limit 1`.

- [ ] Coordinates match the business, rounded to three decimal places.
- [ ] As the manager, rename that business and move its coordinates.
- [ ] Re-run the query: the Moment's stored values have **not** changed.

Standalone Moment, no place attached:

- [ ] The location control is a tap, never automatic.
- [ ] Refuse the permission: the Moment still publishes, with no coordinates.
- [ ] Accept it: coordinates are stored at three decimal places.

## 8. Admin management

As the admin: drawer → Manage public places.

- [ ] Create a place: banner, and it appears in the list and in
      `/places`.
- [ ] Edit it: banner, changes persist.
- [ ] Hide it: a confirmation dialog first, then a banner; it disappears from
      `/places` and from the check-in picker, and Moments already attached to
      it are still there.

As a **non-admin** who opens `/admin/public-places` directly:

- [ ] The screen refuses rather than showing a form.
- [ ] And the database refuses independently: signed in as that account, an
      insert into `public_places` changes zero rows.

## 9. Nothing that already worked stopped working

- [ ] `/feed` still loads and still shows reviews, Moments and favourites.
- [ ] Endorsing a review still works, and endorsing your own is still refused
      (Packet 8c).
- [ ] Attaching a Moment to an activity club with status `full` still works
      (the fix from `20260802191500`).
- [ ] A check-in at a business still resolves the business name server-side.
- [ ] Following an Explorer from their profile still works and still notifies
      them.

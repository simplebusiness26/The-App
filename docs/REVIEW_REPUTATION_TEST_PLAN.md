# Review Reputation (Packet 8c) — Manual Test Plan

Branch: `main2.0-Dev`

## Test accounts

- `E` — Explorer, has published at least one review
- `E2` — a different Explorer, has published at least one review
- `E3` — a third Explorer, no reviews required

## 1. Endorsing a review

1. Log in as `E2`.
2. Open `E`'s profile (`/profile/[id]`) and find one of `E`'s reviews.
3. Confirm the review's action row reads **"0 Useful"** (or the real count),
   not "Like".
4. Tap it.

Expected:
- The control becomes "1 Useful" (or count+1) immediately, no reload needed.
- Reopening the profile after a refresh shows the same count — it persisted.
- The accessible label (screen reader / inspect element) reads "Mark as
  useful. N people found this review useful." before the tap and "Remove
  useful mark. N+1 people found this review useful." after.

## 2. Removing an endorsement

1. Continuing from #1, as `E2`, tap the same control again.

Expected:
- Count returns to its original value.
- A second tap does not error or double-decrement.

## 3. One endorsement per user per review

1. As `E2`, endorse one of `E`'s reviews.
2. Refresh the page (full reload, not just re-focus).
3. Confirm the control shows as already endorsed (filled/green state), not
   reset to unendorsed with a duplicate count.

Expected:
- The endorsed state survives a reload — it reads the real row, not
  client-only state.
- No way in the UI to endorse the same review twice from the same account.

## 4. Self-endorsement is blocked

1. Log in as `E`.
2. Open your own profile and find your own review.

Expected:
- No tappable "Mark as useful" control appears on your own review — only a
  static count.
- (Defence in depth, not reachable from the UI:) attempting to insert
  `social_likes(user_id=E, target_type='review', target_id=<E's own review>)`
  directly is rejected by the database with "You cannot mark your own review
  as useful".

## 5. Profile reputation figures

1. Have `E2` and `E3` each endorse two or more of `E`'s different reviews,
   with at least one review endorsed by both.
2. Open `E`'s profile as any signed-in Explorer.

Expected, in the "Review reputation" card:
- **Total useful endorsements** equals the sum across all of `E`'s
  reviews.
- **Reviews found useful** equals the number of distinct reviews with at
  least one endorsement (not the total endorsement count).
- **Most useful review** names the review with the highest count, and its
  count matches.
- **Average per review** equals total endorsements ÷ all of `E`'s
  *published* reviews (including ones with zero endorsements) — this number
  should be lower than "total ÷ reviews found useful".
- If `E` has an unpublished or removed review, it must not appear in any of
  these figures or shift the average.

## 6. Moments are unaffected

1. As `E2`, open the Explorer feed (`/feed`) or a Moment's own page
   (`/moments/[id]`).
2. Find a Moment and tap its like control.

Expected:
- The control still says "Like" behaviour (heart icon, "N" count, no
  "Useful" wording anywhere near a Moment).
- Liking your own Moment still works — Moments were explicitly out of scope
  for this packet and must not have picked up the review restriction.

## 7. Video review comments page

1. Open a video review's comments page (`/social-comments/[id]`) as someone
   other than the reviewer.

Expected:
- The endorse control reads "Useful", behaves identically to #1/#2, and is
  hidden (count-only) when viewed as the review's own author.

## 8. Feed

1. Open `/feed` as an Explorer who follows someone with both a review and a
   Moment in their recent activity.

Expected:
- The review's row shows the "Useful" endorse control.
- The Moment's row shows the "Like" control.
- Endorsing/liking from the feed updates the same underlying counts seen on
  the profile and the dedicated review/moment pages (spot-check one).

## Not covered by this plan

- Full concurrent-request race on removing an endorsement (documented as a
  known edge case, not exercised manually).
- Anything from Packets 8d/8e/8f (Memories, entity/location follows, feed
  ranking) — out of scope for 8c.

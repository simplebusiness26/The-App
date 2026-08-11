# Explorer Social Layer — Approval Test Plan

Branch: `feature/events-mvp`

Do not merge this branch until the complete mobile flow has been tested in Guestbook-Dev and Craig explicitly approves it.

## Test accounts

- `E` — Explorer
- `E2` — Explorer 2
- `M` — Manager
- Real Explorer account — optional final persistence test

## 1. Pull and start

1. Open Guestbook-Dev.
2. Confirm the Git branch is `feature/events-mvp`.
3. Refresh Git and pull the latest commit.
4. Stop the app and press Run.
5. Wait for the build page to change into Guestbook.
6. Confirm there is no crash, blank screen or unmatched route.

## 2. Explorer discovery and following

1. Log in as E.
2. Open Menu → Find Explorers.
3. Confirm Explorer 2 appears, while the logged-in account does not appear in its own results.
4. Search by Explorer name.
5. Open Explorer 2's profile.
6. Tap Follow.
7. Confirm the button changes to Following.
8. Confirm Explorer 2's follower count increases by one.
9. Open Followers and Following lists from the profile social bar.
10. Confirm the correct profiles appear and each profile row opens the correct public profile.
11. Tap Following to unfollow, then follow again for the remaining tests.
12. Confirm a user cannot follow themselves.
13. Log in as M and confirm Manager accounts cannot use the Explorer follow system.

Expected:
- Follow/unfollow is immediate and persistent.
- Duplicate follows are not created.
- Counts remain correct after refresh.
- Only Explorer accounts participate.

## 3. Follow notification

1. Keep E following E2.
2. Log in as E2.
3. Open Notifications → Social.
4. Confirm a New follower notification appears.
5. Tap it.

Expected:
- The notification becomes read.
- It opens E's exact public profile.

## 4. Explorer feed

1. While logged in as E, open Menu → Explorer Feed.
2. Confirm the feed loads without an error.
3. Confirm E's own activity can appear.
4. Confirm reviews, public favourites and Moments from followed Explorers appear newest first.
5. Tap an Explorer name/photo and confirm the correct profile opens.
6. Tap a place card and confirm the correct business, property, club or event opens.
7. Pull to refresh.
8. Unfollow E2, refresh, and confirm E2's future activity is no longer included.
9. Follow E2 again.

Expected:
- Logged-out users are sent to Login.
- Managers cannot use the Explorer feed.
- Empty feeds show a useful Find Explorers action.

## 5. Create an image Moment

1. Log in as E2.
2. Open Menu → Explorer Feed → New Moment.
3. Choose a photo.
4. Add a caption.
5. Publish without attaching a place.
6. Confirm the Moment detail page opens.
7. Open E2's profile → Moments.
8. Confirm the new Moment appears in the grid.
9. Log in as E and refresh the feed.

Expected:
- The image uploads and displays correctly.
- Caption is preserved.
- The Moment appears on E2's profile and E's feed.
- E receives a New Moment social notification.

## 6. Moment place attachments

Create temporary image Moments attached to each available type:

1. Business
2. Property/stay
3. Open or full Activity Club
4. Published Event

For each Moment:
- Confirm the place appears in the picker.
- Publish the Moment.
- Tap the attached-place card.
- Confirm it opens the correct listing.

Expected:
- Open/full clubs are available.
- Draft/unavailable listings are not accepted.
- Removing the place selection publishes a Moment with no attached listing.

## 7. Video Moment limits

1. Create a Moment using a video of 30 seconds or less.
2. Confirm its duration appears.
3. Publish and play it from the Moment detail page.
4. Confirm it appears with a play indicator on the profile and feed.
5. Try a video longer than 30 seconds.
6. Try a file larger than 50 MB when practical.

Expected:
- Valid short video publishes.
- Longer video is rejected before publishing.
- Oversized media is rejected.
- A failed database save removes the uploaded file instead of leaving unused media.

## 8. Moment likes and comments

1. Log in as E.
2. Open E2's Moment from the feed.
3. Tap Like.
4. Add a comment.
5. Refresh the page.
6. Confirm both remain.
7. Remove the like.
8. Delete E's own comment.
9. Add another comment.
10. Log in as E2 and delete E's comment as the Moment owner.

Expected:
- One like per user per Moment.
- Like count never becomes negative.
- Comment maximum is 500 characters.
- Commenter and content owner can delete a comment.
- Other users cannot delete it.

## 9. Video-review likes and comments

1. Open a profile containing a video review.
2. Tap the video review or Comments.
3. Play the video.
4. Like it.
5. Post a comment.
6. Refresh and confirm both remain.
7. Confirm ordinary text/image reviews can be liked but do not show a comment thread.

Expected:
- Video-review discussion opens the exact review.
- Comments are restricted to published reviews containing a published video.

## 10. Reporting

### Report a Moment

1. As E, open E2's Moment.
2. Tap Report.
3. Choose a reason and submit.
4. Try submitting the same report again.

### Report a comment

1. Open a comment written by another Explorer.
2. Tap Report.
3. Choose a reason and submit.

Expected:
- Own content cannot be reported.
- Duplicate reports are blocked with a clear message.
- Other users cannot read someone else's reports.
- Reports do not immediately delete content; they enter moderation status.

## 11. Moment deletion and cleanup

1. Log in as E2.
2. Open one of E2's Moments that has a like, comment and report.
3. Tap Delete.
4. Confirm the warning explains that interactions will also be removed.
5. Cancel once and confirm the Moment remains.
6. Delete permanently.
7. Refresh profile, feed and notifications.

Expected:
- Moment disappears everywhere.
- Likes, comments, reports and obsolete Moment notifications are removed.
- The social-media file is removed from storage.
- Another Explorer cannot delete E2's Moment.

## 12. Profile social design

Check own and public Explorer profiles on a narrow mobile screen.

Confirm:
- Followers, Following and Moments counts are visible.
- Own profile shows Find Explorers and New Moment actions.
- Other profiles show Follow/Following.
- Existing review points, average rating, ranks, favourites and review gallery remain intact.
- Reviews still sort by Recent, Highest and Lowest.
- Reviews display like controls.
- Video reviews open discussion.
- Videos and Moments tabs switch correctly.
- Moment cards do not overlap or cut off text.

## 13. Social notification categories

Generate or inspect:

- Follow notification
- New Moment notification
- Moment like
- Moment comment
- Review like
- Video-review comment

Open Notifications and test:

1. All
2. Social
3. Clubs
4. Account
5. Mark all read

Expected deep links:
- Follow → exact Explorer profile
- New Moment / Moment like / Moment comment → exact Moment
- Video-review like/comment → exact video discussion
- Ordinary review like → exact reviewed listing
- Existing club-history colours and membership states remain unchanged

## 14. Access and security checks

1. Log out and try opening Feed, Find Explorers, Connections and New Moment directly.
2. Confirm protected actions require login.
3. Log in as M and try social creation/follow actions.
4. Confirm Manager social writes are rejected.
5. Confirm one Explorer cannot upload into another Explorer's media folder.
6. Confirm one Explorer cannot delete another Explorer's Moment, like or comment unless they own the content receiving the comment.
7. Confirm social feed/count RPCs are unavailable to anonymous users.

## 15. Persistence and regression

1. Close Guestbook completely.
2. Reopen it.
3. Confirm login persistence.
4. Check follows and counts.
5. Check the feed.
6. Check Moment media.
7. Check likes/comments.
8. Check social notifications.
9. Open Events, Activity Clubs, Map, Manager Dashboard and existing review pages.
10. Test app and browser back buttons.

There must be:
- No crash
- No unmatched route
- No duplicate relationships or interactions
- No blank media cards
- No incorrect account permissions
- No broken existing Events, Activity Club, review, points or leaderboard flow

## Automated evidence completed before manual approval

- Expo Doctor passed.
- Expo web export passed.
- Five-second rollback tests passed for follows, counts, Moments, feed, likes, comments, reports, notification deep links and deletion cleanup.
- Activity Club Moment attachment passed against a real open club.
- Storage-folder isolation passed.
- Anonymous social RPC access is denied.
- Integrity audit returned zero invalid follows, Moments, likes, comments, reports, or duplicates.
- Social-layer security advisor issues were remediated.

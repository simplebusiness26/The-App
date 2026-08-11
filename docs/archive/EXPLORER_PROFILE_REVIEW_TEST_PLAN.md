# Explorer Profile and Review Release Test Plan

Branch: `feature/events-mvp`

This feature must remain unmerged until the complete mobile test passes and Craig explicitly approves the merge.

## Automated evidence

- Expo Doctor and web export: passed on GitHub Actions run 96.
- Points regression: text 1 → image 3 → video 6 → verified video 9.
- Monthly repeat protection: second review for the same listing scored 0.
- QR regression: manager issue, exact-code resolution, Explorer verification and one-time +3 bonus passed.
- Deletion/moderation regression: unified review and points were removed/revoked correctly.
- Data audit: zero orphaned media, point mismatches, duplicate videos, invalid durations, missing posters, broken QR links or missing listing targets.

## Mobile user-flow test

### 1. Pull and launch

1. Open Guestbook-Dev in Replit.
2. Confirm Git branch `feature/events-mvp`.
3. Pull the latest branch.
4. Stop and Run the app.
5. Refresh the preview.

### 2. Explorer profile

1. Log in as a real Explorer account.
2. Open Menu → Profile.
3. Confirm profile photo, name, average rating, points, review count and Videos/Moments tabs load.
4. Edit Profile.
5. Add a broad area such as Hastings, enable Display my area and keep leaderboards enabled.
6. Save, leave the page and reopen it.
7. Confirm the area and settings persist.

### 3. Favourites

Add one of each available listing type to favourites:

- Business
- Property
- Activity Club
- Event

Return to Profile and confirm the Favourite places slider contains the saved listings. Remove one favourite and confirm it disappears after reopening Profile.

### 4. Text review

1. Open a business or property not already reviewed by the account this month.
2. Leave a text-only review.
3. Confirm the success message awards 1 point.
4. Confirm the complete review appears on the listing and Explorer profile.
5. Confirm the total profile score increases by 1.

### 5. Image review

1. Open a different business or property.
2. Add written text and one to three images.
3. Confirm the points preview shows 3.
4. Publish the review.
5. Confirm all images remain inside the complete review card and also appear in the profile Review gallery.
6. Confirm the total score increases by 3.

### 6. Video review

1. Open another eligible listing.
2. Add a title, written review and a video of 30 seconds or less.
3. Confirm the points preview shows 6.
4. Publish and play the video from the listing and profile.
5. Confirm the video appears under the Videos tab with a poster image.
6. Attempt a video longer than 30 seconds and confirm it is rejected.

### 7. Monthly repeat protection

1. Leave another review for a listing already reviewed by the same account this month.
2. Confirm the review publishes.
3. Confirm the message explains that it earns 0 leaderboard points.
4. Confirm the profile score does not increase.

### 8. Activity Club review

Explorer 2 is approved in Hastings Sunset Running Club.

1. Log in using E2.
2. Open Hastings Sunset Running Club.
3. Confirm Leave an Activity Club Review is available.
4. Publish a review and confirm it appears on the club and profile.
5. Log in with an Explorer who is not an approved or former member and confirm the review is blocked.

### 9. Event review timing

Hastings Community Day starts on 6 August 2026 at 11:00 UTC.

Before it starts, confirm the Event page says reviews unlock when the event starts. After it starts, publish an Event review and confirm it appears on the Event and Explorer profile.

### 10. Verified QR review

1. Log in as Manager.
2. Open Manager Dashboard and a printable QR for a managed listing.
3. Use a second device to scan it, or copy the code/link into Menu → Scan Verified Review QR.
4. When logged out, confirm Guestbook asks for login and returns to the same verified-review flow afterward.
5. Publish a review.
6. Confirm the verified badge appears and the review receives its content points plus 3.
7. Confirm reopening the code cannot add the bonus to the same review twice.

### 11. Leaderboards

Test accounts ending in `@test.com` are deliberately excluded.

1. Use a real Explorer account with newly earned points.
2. Open Menu → Explorer Leaderboards.
3. Confirm Weekly and Monthly tabs work.
4. Confirm National works.
5. Confirm Local works only when a public area is enabled.
6. Turn off leaderboard participation in Edit Profile and confirm the account disappears from rankings while its profile score remains.

## Release decision

Only merge PR #4 after all applicable checks pass and Craig says: `Approved — merge it`.

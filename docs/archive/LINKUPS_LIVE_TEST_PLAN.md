# Link-ups and Live Discovery — Approval Test Plan

This plan is the final mobile approval check after the automated release gates pass. It focuses only on real-device behaviour that cannot be fully reproduced by GitHub Actions or database rollback tests.

## Test accounts

Use two Explorer accounts:

- Explorer A: organiser
- Explorer B: attendee

Manager accounts should not be able to create, join or check in.

## 1. Pull and start

1. Open Guestbook-Dev.
2. Confirm branch `feature/linkups-live-discovery`.
3. Pull the latest changes.
4. Stop and restart the app.
5. Confirm the app loads without a blank screen or unmatched route.

## 2. Organiser creates a Link-up

As Explorer A:

1. Open Menu → Link-ups.
2. Tap Create Link-up.
3. Enter a title, description and category.
4. Choose a start time at least 15 minutes in the future.
5. Choose an end time after the start.
6. Enter a broad area and public meeting place.
7. Enter attendee-only meeting instructions.
8. Set capacity to 2.
9. Choose Public visibility.
10. Optionally grant foreground location permission.
11. Create the Link-up.

Expected:

- The detail screen opens.
- Organiser is shown as attendee 1 of 2.
- Exact meeting instructions are visible to the organiser.
- Edit, Cancel and private board controls appear.
- No private home-address prompt or exact-coordinate display appears.

## 3. Explorer joins and capacity becomes full

As Explorer B:

1. Open Menu → Link-ups → Discover.
2. Open the new Link-up.
3. Confirm attendee-only instructions are hidden before joining.
4. Tap Join Link-up.

Expected:

- Attendance becomes 2/2.
- Status becomes Full.
- Exact meeting instructions appear only after joining.
- Private board button appears.
- Explorer A receives a Live notification that someone joined.

## 4. Private board

As Explorer B:

1. Open the private board.
2. Post a normal message.

As Explorer A:

1. Open the board.
2. Confirm Explorer B's message appears.
3. Post an organiser announcement.
4. Remove Explorer B's test message.

Expected:

- Both messages appear without duplication.
- Announcement is visually distinct.
- Removed message changes to the removed state.
- Explorer B receives exact board-message/announcement notifications.

## 5. Leave, rejoin and organiser removal

As Explorer B:

1. Leave the Link-up.
2. Confirm it returns to Upcoming with 1/2 attendees.
3. Rejoin.
4. Confirm it returns to Full.

As Explorer A:

1. Remove Explorer B.

Expected:

- Status returns to Upcoming.
- Count returns to 1/2.
- Explorer B receives a removal notification.
- Explorer B loses private instruction and board access.

## 6. Edit and cancel

As Explorer A:

1. Edit the time or public meeting place.
2. Save.
3. Confirm joined attendees receive an update notification.
4. Cancel the Link-up.

Expected:

- Status becomes Cancelled.
- Joined attendees receive a cancellation notification.
- The private board remains readable for joined attendees but becomes read-only.

## 7. Public check-in and location permission

As Explorer B:

1. Open Menu → Check in.
2. Choose Park.
3. Enter a public place and broad town/neighbourhood area.
4. Tap Add approximate location and grant foreground permission.
5. Choose Other and type a custom activity.
6. Choose 30 minutes.
7. Start the check-in.

Expected:

- The custom activity field remains visible while typing.
- Live Nearby opens.
- A “You are checked in” card appears.
- No exact coordinate is displayed.
- The area remains broad and is not replaced with a street address.

Try to start a second check-in before ending the first.

Expected:

- The second check-in is blocked.

Return to Live Nearby and tap End.

Expected:

- The current check-in card disappears.

## 8. Live Nearby filters

As either Explorer:

1. Open Menu → Live Nearby.
2. Enter a town in the Area field.
3. Confirm the screen does not reload on every typed character.
4. Tap Apply.
5. Test distance filters.
6. Test time-window filters.
7. Test All, Link-ups, People, Events, Activities and Places.
8. Tap cards to open their exact destination.

Expected:

- Results update only after Apply or changing a filter.
- No duplicate cards.
- Deep links open the correct Link-up, profile, Event, club or business.

## 9. Block and report

Create or use a test Link-up where Explorer B is joined.

As Explorer B:

1. Open Explorer A's public profile.
2. Open Safety options.
3. Block Explorer A.

Expected:

- Mutual follow is removed.
- Explorer B no longer sees Explorer A's Link-up/check-in.
- Explorer B loses private board and meeting-instruction access.
- Attendance is recalculated.

Open Menu → Blocked Explorers and unblock Explorer A.

Expected:

- Explorer A appears in the blocked list before unblocking.
- Unblock succeeds.
- Membership is not silently restored; Explorer B must join again.

Also submit one test report from a Link-up or profile.

Expected:

- A success message appears.
- Repeating the report updates the existing report rather than creating duplicates.

## 10. Notifications

Open Notifications → Live.

Expected notification types:

- New Link-up from followed Explorer.
- Joined.
- Left.
- Full.
- Updated.
- Cancelled.
- Removed.
- Message.
- Announcement.
- Starting-soon reminder when applicable.

Tap several notifications.

Expected:

- Each opens the exact Link-up or private board.
- Read state and unread badge update correctly.

## Approval criteria

Approve only when:

- No crash, blank screen or unmatched route occurs.
- Date/time input works on the Samsung browser.
- Foreground location permission works.
- Link-up creation and joining work.
- Private details remain hidden before joining.
- Board messages and announcements work.
- Check-in appears and can be ended.
- Live filters and deep links work.
- Block removes private access.
- No duplicate notifications or attendance counts appear.

Do not merge the draft PR until Craig explicitly says: `Approved—merge it.`

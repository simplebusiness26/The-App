# Admin dashboard: plain-English test plan

This plan checks the admin work from the first access gate through the final
audit record. Run it against a fresh App Preview built from `main2.0-Dev`.

## What the four new areas mean

1. **Claims and Manager access:** an administrator can approve or reject a
   request. A reason and a final confirmation are required. The database makes
   the decision and records who did it, why and when as one operation.
2. **Club and Event management:** an administrator can change a Club or Event
   State without deleting it. Hidden, closed and cancelled items can be moved
   back to a usable State.
3. **Moderation and Explorer directory:** report decisions are kept in one
   place. The moderation queue receives only the information needed to review
   the report; private Link-up meeting details, attendees, coordinates and
   contact fields are excluded. The Explorer directory is read-only.
4. **Areas, data quality and audit history:** administrators can see unmatched
   area text, missing area links and ownership inconsistencies. The report does
   not guess a correction. Audit history is permanent and cannot be edited or
   deleted through the app.

## Before testing

- Rebuild App Preview from `main2.0-Dev`; do not use only a restart.
- Use one administrator account and one ordinary Explorer account.
- Keep the Explorer signed in on a second device or private browser window if
  possible.
- For tests that change data, create clearly named disposable records such as
  `ADMIN TEST Club`. Do not use a real Club, Event, listing or report unless the
  decision is genuinely intended.
- Admin actions create permanent audit records. Use reasons beginning with
  `Manual admin test:` so they are easy to recognise later.

The live baseline immediately after the migrations was 19 Explorers, 4
administrators, 3 approved claims, no pending claims, 1 pending Manager-access
request, 8 open Clubs, 9 published Events, no open social reports, 1 open
safety report and no audit records. These figures are a dated baseline, not
values the app must keep forever.

## Part 1: build and automated checks

Run these before the device checks:

```bash
git branch --show-current
git status --short
npm ci
npm run test:ci
npm run verify:screens
npm run verify:social
npm run verify:live
npm run verify:taxonomy
npm run verify:markers
npm run verify:place
npm run verify:cards
npm run verify:discover
npm run verify:reputation
npm run verify:places
npm run verify:memories
EXPO_NO_TELEMETRY=1 npx expo-doctor
EXPO_NO_TELEMETRY=1 npx expo export --platform web
```

Pass when the branch is `main2.0-Dev`, the worktree is clean, every test and
verification command passes, Expo Doctor reports 20/20 and the web export
finishes.

Also run `npm audit --audit-level=moderate`. At the time of this plan it reports
15 high findings through Metro's `image-size` package. npm proposes fixing them
by forcing Expo SDK 57 down to SDK 53, which is a breaking change and must not be
accepted as part of this test. Record whether the upstream result has changed.

## Part 2: access and overview

| Test | What to do | Pass result |
|---|---|---|
| Signed out | Open an admin URL directly while signed out. | The admin content is not shown. |
| Ordinary Explorer | Sign in as the ordinary Explorer and open Admin Dashboard or another admin URL directly. | `Admin access required` is shown; no admin data appears. |
| Administrator | Sign in as the administrator and open Admin Dashboard. | The overview loads without an access error. |
| Honest totals | Refresh the overview. | All totals appear together. If one database check fails, the screen shows an error instead of mixing old and new totals. |
| Navigation | Open every total card and every admin-tool card, then return. | Each card opens the matching screen and Back returns to the dashboard. |

## Part 3: listing catalogue

1. Open **Browse all listings**.
2. Open Businesses, Properties, Public places, Activity clubs and Events in
   turn.
3. Search for a known item in each type.
4. Try every available State filter.
5. Open one item and return to the same list.

Pass when all five types load, search and filters only change the visible
results, and no listing is changed by browsing it.

## Part 4: claims and Manager access

### Read-only checks first

1. Open **Review claims & Manager access**.
2. With no pending claims, check that **No pending listing claims** appears.
3. Confirm the pending Manager-access request appears. Do not decide the live
   request unless that is the real decision you want.

### Full claim test with a disposable listing

1. As the ordinary Explorer, submit a claim for a disposable unclaimed listing.
2. As the administrator, refresh the claims screen.
3. Press **Approve** or **Reject** with no reason. Pass: the app blocks the
   action and asks for 3–500 characters.
4. Enter `Manual admin test: cancel confirmation`, press the action, then press
   **Cancel** in the confirmation. Pass: nothing changes.
5. Submit two disposable claims so both outcomes can be tested. Approve one and
   reject the other with clear reasons.
6. Pass for approval: the claim leaves the pending list and the approved
   Explorer becomes the listing owner. Pass for rejection: the claim leaves
   the pending list and listing ownership does not change.
7. Open **Audit history**. Pass: both decisions show the administrator, action,
   target, exact reason and time.

### Full Manager-access test

1. As the ordinary Explorer, request one Manager capability on a disposable
   test account.
2. Repeat the missing-reason and cancelled-confirmation checks above.
3. Approve the request. Pass: it leaves the pending list and the capability is
   active in Explorer directory and the Explorer's own settings.
4. Submit a different disposable request and reject it. Pass: it leaves the
   pending list and no capability is activated.
5. Pass: both outcomes have separate audit records.

## Part 5: Club and Event States

Use only disposable test activity. Enter a reason and confirm each change.

### Club

1. From **Open**, choose **Close**. Pass: State becomes Closed.
2. Choose **Reopen**. Pass: State returns to Open.
3. Choose **Hide**. Pass: State becomes Draft.
4. Choose **Publish as open**. Pass: State returns to Open.

### Event

1. From **Published**, choose **Hide**. Pass: State becomes Draft.
2. Choose **Publish**. Pass: State returns to Published.
3. Choose **Cancel event**. Pass: State becomes Cancelled.
4. Choose **Move to draft**, then **Publish**. Pass: the Event returns to
   Published.

For one Club and one Event action, also test a blank reason and cancelling the
confirmation. Pass when neither attempt changes the State. Finally, check that
every completed State change has one audit record and that no Club or Event was
deleted.

## Part 6: moderation and privacy

Create disposable reported content where possible. Do not use the existing
live safety report merely to prove the buttons work.

| Report test | Decision | Pass result |
|---|---|---|
| Any disposable report | Dismiss | Report leaves the open queue; reported item is unchanged; audit record exists. |
| Moment or comment | Remove content | Report is resolved and content State becomes Removed. |
| Link-up | Cancel Link-up | Report is resolved and Link-up State becomes Cancelled. |
| Link-up message | Remove content | Report is resolved and message State becomes Deleted. |
| Check-in | End check-in | Report is resolved and check-in State becomes Ended. |
| Explorer report | Resolve report | Report is resolved; the Explorer account itself is not automatically changed. |

For every action, first check that a blank reason is blocked and cancelling the
confirmation changes nothing. On both Social reports and Safety reports,
inspect every visible field. Pass only if no private meeting point, attendee
list, latitude, longitude, email or phone number appears.

## Part 7: Explorer directory

1. Search for a known Explorer on the current page.
2. Try **All**, **Admins** and **Managers**.
3. Open an Explorer profile and return.
4. Check that capabilities are shown together and that no private contact
   fields are displayed.
5. Check pagination. With fewer than 26 Explorers, Previous and Next should be
   disabled; with more, move forward and back once.

Pass when this screen only reads data and offers no account-editing controls.

## Part 8: areas and data quality

1. Open **Inspect areas & data quality**.
2. Check canonical areas, rows without a canonical area, unmatched area text,
   unmatched public-Place text and ownership inconsistencies.
3. The current live data should report the known historical ownership
   inconsistency unless it has since been intentionally repaired.
4. Open the affected listing from the issue card and return.

Pass when the figures load, the listing link works, and there is no button that
guesses an area or automatically repairs ownership.

## Part 9: audit history

1. Confirm the newest test decision is first.
2. Search by administrator name, action, target or a phrase from the reason.
3. Open Previous and Next if there are more than 25 records.
4. Look for edit, delete or create controls.

Pass when every completed admin decision appears once with administrator,
action, target, reason and time, and there is no way to alter audit history.

## Part 10: regression and finish

As the ordinary Explorer, quickly check login, menu, Discover, map, one Place,
one Club, one Event, profile and any Manager screen the account is entitled to
use. Pass when the admin changes did not break ordinary app use.

Restore disposable Clubs and Events to their starting States. Hide or archive
disposable content through its normal product flow. Audit entries must remain;
that is expected.

Record failures in this format:

```text
Screen:
Account role:
Record used:
Steps:
Expected:
Actual:
Screenshot or video:
Time of test:
```

The full dashboard passes only when Parts 1–10 pass. A build or automated test
alone proves the screen renders; the device steps prove the real behaviour.

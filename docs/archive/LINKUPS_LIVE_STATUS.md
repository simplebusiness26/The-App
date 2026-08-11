# Link-ups and Live Discovery — Release Status

## Release state

- Branch: `feature/linkups-live-discovery`
- Pull request: #6
- Target: `main`
- Status: draft and unmerged
- Database migrations: applied to Supabase and versioned in GitHub

## Completed scope

### Explorer Link-ups

- Public and followers-only Link-ups.
- Title, description, category, date, time, public meeting place and broad area.
- Optional approximate coordinates.
- Attendee-only meeting instructions stored separately from public Link-up data.
- Capacity from 2 to 50 people, including the organiser.
- Discover, Joined and Created lists.
- Upcoming, full, happening, cancelled and completed states.
- Create, edit, join, leave, cancel and organiser attendee-removal flows.
- Database row locks prevent attendance above capacity.
- Link-ups cannot be joined after they start, after cancellation or after completion.

### Private attendee boards

- Joined attendees and the organiser can read the board.
- Joined attendees can post messages.
- Organisers can post highlighted announcements.
- Message author or organiser can remove a message.
- Message reporting.
- Ten-message-per-minute rate limit.
- Board becomes read-only after cancellation or completion.
- Realtime refresh plus manual pull-to-refresh.

### Live public-place check-ins

- Park, public place, business, Activity Club and Event check-ins.
- One active check-in per Explorer.
- 30 minutes, 1 hour, 2 hours or 4 hours.
- Public or followers-only visibility.
- Optional message and activity.
- Custom activity support.
- Automatic expiry and manual checkout.
- Listing-backed check-ins use the canonical listing name and reject fake listing IDs.
- Manual check-ins cannot attach a fake listing ID.
- Coordinates are rounded server-side to two decimal places.
- The UI asks for a broad town/neighbourhood area and warns against private addresses.

### Live Nearby

One filtered screen combines:

- Link-ups happening soon.
- Active public/follower-visible check-ins.
- Published Events.
- Open/full Activity Club sessions.
- Popular reviewed businesses.

Filters:

- Town or broad area.
- 5, 15, 25 or 50 km.
- 6 hours, today, 3 days or 7 days.
- All, Link-ups, People, Events, Activities or Places.

### Safety and moderation

- Block and unblock Explorers.
- Blocking removes mutual follows.
- Blocking an organiser immediately changes the attendee membership to `left`.
- Organiser blocking an attendee changes the membership to `removed`.
- Attendance totals are recalculated.
- Blocked users lose private meeting-detail and board access.
- Blocked users cannot see each other's Link-ups or live check-ins.
- Reports for Link-ups, board messages, check-ins and Explorer profiles.
- Report target existence is verified server-side.
- Users cannot report their own content/profile.
- Duplicate reports update one existing report.
- Maximum 20 reports per day.
- Blocked Explorer management screen.

### Notifications

A dedicated Live category includes:

- Followed Explorer created a Link-up.
- Someone joined.
- Someone left.
- Link-up became full.
- Time/location changed.
- Link-up cancelled.
- Attendee removed.
- Board message.
- Organiser announcement.
- Starting-soon reminder.

Every alert has a validated exact deep link.

## Security design

- All seven new tables have RLS enabled.
- Anonymous table and RPC access is denied.
- Authenticated direct table writes are denied.
- Mutations use server-validated action RPCs.
- Internal policy helper functions live in the `private` schema.
- Public helper execution was revoked.
- Live discovery uses `SECURITY INVOKER`.
- Action RPCs intentionally use `SECURITY DEFINER` because direct writes are revoked; each validates authentication, Explorer role, ownership, state, limits and target existence.
- Attendee-only instructions are separated from public Link-up information.
- Check-in coordinates are neighbourhood-level rather than exact.

## Defects found and fixed during gated development

1. **Live discovery CTE column contract**
   - Failure: PostgreSQL could not resolve `item_type`.
   - Fix: explicit CTE output columns.
   - Exact failed query was rerun successfully.

2. **Board notification test visibility**
   - Failure: organiser could only count their own notifications under RLS.
   - Fix: test each recipient under their own authenticated identity.
   - No product defect; RLS worked correctly.

3. **Custom check-in activity input**
   - Failure: selecting Other would make the custom field disappear after typing.
   - Fix: separate `customActivity` state.
   - Permanent regression check added.

4. **Check-in privacy**
   - Risk: three-decimal coordinates and copying a listing street address into the public area field.
   - Fix: server/client two-decimal rounding, broad-area field, and no street-address copying.

5. **Block/private-board access**
   - Risk: a blocked organiser and attendee could retain membership/private-board access.
   - Fix: membership becomes left/removed, counts recalculate and RLS hides private content.

6. **Repeated join notification collision**
   - Failure: leave and rejoin in the same second reused a unique dedupe key.
   - Fix: unique UUID event suffixes for join, leave, full-again, update and removal alerts.
   - Exact capacity/rejoin test was rerun successfully.

7. **Missing message-author index**
   - Advisor warning: `linkup_messages.user_id` lacked a covering index.
   - Fix: `linkup_messages_user_created_idx`.

8. **Live area filter request churn**
   - Risk: typing could trigger repeated network reloads.
   - Fix: separate draft/applied area values; request runs only on Apply/submit.

## Automated evidence

All database mutation tests used short statement timeouts and automatic rollback.

Passed gates:

- Create Link-up and private details.
- Explorer-only create/join/check-in permissions.
- Manager join rejection.
- Full capacity and row-lock behaviour.
- Leave/reopen/rejoin/full/remove/reopen lifecycle.
- Followers-only visibility.
- Private instructions hidden until joining.
- Non-member board denial.
- Member message and organiser announcement.
- Message removal and board read-only state.
- Cancellation notifications.
- Check-in creation, expiry limits and one-active rule.
- Canonical listing validation and fake-ID rejection.
- Two-decimal coordinate storage.
- Live discovery visibility and filtering.
- Blocking removes private access and recalculates attendance.
- Reports validate targets, reject self-reporting and deduplicate.
- Organiser/member reminders appear once.
- Manager reminder refresh safely no-ops.
- Anonymous action/discovery execution denied.
- Internal public helper execution denied.
- Complete data-integrity audit returned zero problems.
- Final create → join → board → announcement → check-in → discover → remind → leave → cancel journey passed and rolled back.
- Cleanup verification found zero temporary rows.

GitHub release checks passed on the feature code before documentation:

- Clean npm audit at moderate threshold.
- Explorer Social Layer release gate.
- Link-ups and Live Discovery release gate.
- Link-up privacy/hardening release gate.
- Expo Doctor.
- Full Expo web export.

## Separate existing project warnings

Supabase still reports security/performance warnings for older Guestbook tables and functions, including older tables with RLS disabled. Those were not changed in this stage because enabling policies without an app-wide legacy audit could break existing production flows.

The Security Advisor also labels the new write RPCs as signed-in `SECURITY DEFINER` functions. This is an intentional action-RPC design: direct table writes are revoked and each action performs server-side validation. The internal read helper and discovery function warnings introduced during development were removed.

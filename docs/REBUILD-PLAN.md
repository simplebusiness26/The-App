# Rebuild plan

What the app becomes, in what order, and what only you can decide.

This replaces `docs/archive/REDESIGN-BRIEF.md` and its packet numbering.
Packets 0–10 of that brief are built and stay built. Do not resume Packet 11
from the old ledger — the design pass survives here as the last packet, with a
new number. Current state of the code is `docs/SCREEN-INVENTORY.md`.

Everything below was read from the code on `main2.0-Dev`, not remembered. Where
a line number is quoted, that line was opened.

---

## 0. Where this contradicts what is built

### Things you think are broken that are already fixed

**Signup does not fork the account.** `app/auth/signup.js:151` writes
`account_type:"explorer"` and offers no choice. The old note about a binary
Explorer/Manager picker is out of date. The fork survives further in, not at the
front door.

**Friends already exist, correctly.** `guestbook_private.are_friends`
(`20260805120300_moment_place_visibility_and_actor.sql:142-155`) is exactly
"two Explorers who follow each other", computed fresh on every read. There is no
friends table to build and no unfollow cleanup to write — stop following someone
and access is gone on the next query. `block_explorer` already deletes both
directions (`20260802211800:136`).

**Writing a review is already one thing.** All four review routes are eight-line
wrappers around one shared form: `app/business/review/[id].js`,
`app/property/review/[id].js`, `app/activity-clubs/review/[id].js` and
`app/events/review/[id].js` all render `components/ExplorerReviewForm`, which
writes to `explorer_reviews` (`:276`, `:323`). The split is only in **reading**.

### Things that are worse than you think

**Any signed-in Explorer can create a business or a property, today.** The rules
that decide who may add one are
`with check (auth.uid() = owner_id)` — `20260803211732_rls_policies_and_grants.sql:135-136`
for businesses and `:163-164` for properties. That says "you may create a
business as long as you say it's yours", which everybody can say. Clubs and
events do check a real capability (`20260803120000:22-46`); these two never got
the same treatment. Hiding the "Add a business" button changes nothing while
this stands. This is why it is Packet 0.

**An Explorer can still promote themselves.** `account_type` is in the
client-writable column list twice — `20260803211732:113-117` and again at
`20260805132127_admin_security_foundation.sql:58` and `:74`. The second
migration's own comment says "nobody can promote themselves" while granting the
column that does it.

**The Explorer/Manager fork is bigger than the old notes said.** `account_type`
is read in **16 files across 35 places** in `app/` and `components/` — not the
12 files previously recorded. Four `scripts/verify-*.cjs` gates and **five Jest
test files** also assert on it, so removing the checks means editing the gates
and the tests in the same packet. The worst single case is
`components/ExplorerProfileScreen.js:298`, which renders a completely different
screen for anyone whose `account_type` isn't `explorer`.

**"Followers only" is not friends only.** Check-ins and Link-ups test a one-way
follow, not a mutual one — `live_checkins_select_visible`
(`20260802211800:63-69`) and `private.can_view_linkup` (`:36`) both ask
"does the viewer follow the author". So anyone who follows you, unanswered, can
see your followers-only check-in. Moments, the feed and Memories all correctly
use `are_friends`; presence does not. Under the model in section 1 that is a
privacy bug, not a wording difference.

**There is no location setting at all.** `profiles` carries `area`,
`show_area` and `leaderboard_opt_in` and nothing else. The three-way
Friends / Close friends only / No one choice is new: a new column, a new
close-friends table, and a rewrite of the two rules above.

**Two different numbers are both called Explorer Score.** The leaderboard on
screen (`app/leaderboards.js:72` → `get_explorer_leaderboard`,
`20260802152200:29-76`) ranks on review points, 1/3/6 plus 3 for a QR scan.
A separate ledger, `explorer_score_events` (`20260810040000:55-67`), scores a
review at 5, or 15 verified, and a check-in at 10 halving per repeat, with daily
and weekly caps and a date on every point. Nothing in `app/` reads the ledger.
Renaming the leaderboard "Explorer Score" puts the name on the figure that is
not the ledger. See Decision 1.

**Endorsements count for nothing.** Neither scoring function reads
`social_likes`. The point reasons are fixed to
`text_review`, `image_review`, `video_review`, `verified_qr` and the point values
to `1, 3, 6` (`20260802152000:98-99`). See Decision 8.

**You can't comment on a review unless it has video.**
`social_comments` allows `target_type in ('moment','video_review')`
(`20260802155202:64`). A text or photo review takes endorsements but no replies.

**One button already lies.** `app/moments/create.js:376-377` labels its two
buttons "Photo / camera" and "Video / camera". Both open the photo library.
`launchCameraAsync` appears nowhere in the repo; `app/scan.js` is the only
`expo-camera` consumer and it is a QR reader. Also, `package.json:35` pins
`"expo-camera": "latest"` — the only unpinned Expo package in the file. A camera
tab built on a floating version breaks on an unrelated `npm install`.

**The header still says Guestbook.** `components/Header.js:50`, and the file
imports no design tokens — `borderColor:"#ddd"` at `:88` is not a colour in
`docs/design-system.md`. The word appears **33 times across 21 `.js`/`.json`
files**, including `app.config.js` (name, slug, and the camera permission
strings), plus `README.md` and `docs/SCREEN-INVENTORY.md`.

**The riso look is barely in.** The tokens exist — `utils/tokens.js:12` exports
`INK` — but only **29 of the 112 files** in `app/` and `components/` import them.
**83 files** still carry hand-written hex. `components/TabBar.js` is one of the
good ones: it already uses the tokens and already draws a raised centre button.

### Things the target model breaks on purpose

**Dropping `archive_visibility` is a privacy regression.**
`explorer_memories` deliberately has two visibility fields
(`20260805130000:83-87`): one for while it's live, one for after. The file's own
comment (`:25-26`) says a person consenting to "everyone can see where I am
today" has not consented to that forever. "Visibility decided once per post,
time only changes the word" deletes that. See Decision 4.

**Check-ins as "a public, opt-in presence at a park" fights the location
setting.** `RULES.md` says check-ins are public. Section 1 says location
defaults to nobody. Both cannot be true. See Decision 3.

**A review is content, not a person.** You asked to extend the account-reporting
system to cover reviews. That system is `live_safety_reports`
(`20260802211500:82-92`), whose targets are Link-ups, messages, check-ins and
people. The content system, `social_reports` (`20260802155202:69-83`), already
holds Moments and comments and has the identical shape. A review belongs with
Moments. Both already feed the same admin screen. See Decision 6.

### Numbers I could not confirm

The score backfill is reported as 1005 points over 107 reviews and 27 check-ins.
Those figures are not in `20260811010000_backfill_explorer_score_events.sql` —
they were output from running it. Treat them as reported, not verified.

---

## 1. What the app becomes

**Logged out, it is a map.** Open the app and you see your area: places, clubs,
events, and what is happening now. No wall, no signup screen first. Tapping
something that needs an account — reviewing, checking in, joining a Link-up —
asks you to log in at that moment, and only then.

**Logged in, the map gains people.** Your friends, where they said they'd be,
what they've posted, what's on tonight.

**A friend is someone who follows you back.** No requests, no accepting. Follow
someone and if they follow you back you are friends. **Close friends** is a
smaller list you pick by hand; it is one-way and private to you.

**Your location is off until you turn it on.** One setting with three answers:
friends, close friends only, or no one. It starts on no one. Anything that shows
where you are expires by itself. The server decides who can see it — never the
app choosing not to draw a pin.

**One review table.** A review attaches to a business, a property, a park, a
club or an event. Never to a person. Anyone can endorse it. Anyone can reply to
it. Anyone can report it. There is one place a review lives.

**One post.** A photo pinned to where you took it is a Moment while it's new and
a Memory once it's old. Same row, same screen, the wording changes with age.

**One account.** Everybody is an Explorer. Some Explorers have manager tools
unlocked for the places they run. There is no second kind of person, no second
profile, no second screen.

**The footer is five things:** Camera, News Feed, the map in the middle, Explorer
Score, Profile. On the map the middle button becomes Scan QR.

**Direct messages between friends.** Not a general inbox — friends only.

---

## 2. All 77 routes

77 routes across 78 files (`app/` holds 79 `.js` files; `_layout.js` is not a
route, and `map.js` + `map.web.js` are one route). Every route below is declared
in `app/_layout.js`.

Verdicts: **KEEP** stays, **MERGE** folds into another route, **DELETE** goes.

| Route | What it is | Verdict |
|---|---|---|
| `index` | Landing. Becomes the logged-out map entry. | KEEP |
| `map` | The map. Gains live state, filters, the centre Scan button. | KEEP |
| `discover` | Browse surface. Loses its footer slot to News Feed; still reachable. | KEEP |
| `create` | Hub for adding things. Loses the raised centre slot; reached from the map and Profile. | KEEP |
| `feed` | Social feed. Becomes the News Feed tab. | KEEP |
| `leaderboards` | Ranking screen. Becomes the Explorer Score tab — label only, route unchanged. | KEEP |
| `profile` | Your own profile. Footer tab. | KEEP |
| `profile/[id]` | Someone else's profile. | KEEP |
| `profile/edit` | Edit your profile. | KEEP |
| `settings` | Settings. Gains the location setting and the Manager unlock. | KEEP |
| `scan` | QR reader. The map's centre button targets it — see the snag in Packet 6. | KEEP |
| `notifications` | Notification list. Gains the new-friend notice. | KEEP |
| `explorers` | Find other Explorers. | KEEP |
| `connections/[id]` | Someone's followers and following. | KEEP |
| `safety/blocked` | Who you've blocked. | KEEP |
| `live` | The separate live screen. Its content belongs on the map; no packet moves it yet. | KEEP |
| `checkins/create` | Start a check-in. Narrowed to parks in Packet 17. | KEEP |
| `qr/[code]` | Opens whatever a scanned code points at. | KEEP |
| `social-comments/[id]` | Comment thread. Widens to reviews in Packet 11. | KEEP |
| `auth/login` | Log in. The hardcoded test panel goes behind a build flag. | KEEP |
| `auth/signup` | Sign up. Already writes one account type. | KEEP |
| `auth/forgot-password` | Password reset request. | KEEP |
| `auth/update-password` | Set a new password. | KEEP |
| `business/[id]` | A business page. Repointed at `explorer_reviews` in Packet 10. | KEEP |
| `business/add` | Add a business. Gated properly by Packet 0. | KEEP |
| `business/dashboard` | Manager tools for a business. Reachable from the Quick Access drawer. | KEEP |
| `business/edit/[id]` | Edit one business. Linked from the dashboard and the place page. | KEEP |
| `business/edit` | Same form with no business to edit. Nothing links to it. | DELETE |
| `business/review/[id]` | Write a review. Eight lines around the shared form. | KEEP |
| `business/review-action` | Manager reply and challenge. Moves onto `explorer_reviews` in Packet 10. | KEEP |
| `business/reviews` | A business's review list. Nothing links to it. | DELETE |
| `property/[id]` | A property page. Repointed in Packet 10. | KEEP |
| `property/add` | Add a property. Gated properly by Packet 0. | KEEP |
| `property/dashboard` | Manager tools for a property. | KEEP |
| `property/edit/[id]` | Edit one property. Linked from the dashboard and the place page. | KEEP |
| `property/edit` | Same form with no property to edit. Nothing links to it. | DELETE |
| `property/review/[id]` | Write a review. Wrapper around the shared form. | KEEP |
| `property/review-action` | Manager reply and challenge. Writes a column literally named `business_response` on a property review (`:71`) — fixed in Packet 10. | KEEP |
| `property/reviews` | A property's review list. Linked from `property/dashboard.js:225`, so **not** an orphan despite matching its dead business twin. | KEEP |
| `places/index` | Public places list. | KEEP |
| `places/[id]` | A park or other public place. Cannot take reviews today (`:85` passes `showReviews={false}`) — fixed in Packet 10. | KEEP |
| `place` | Two-screen stub from before public places existed. Nothing links to it. | DELETE |
| `activity-clubs/index` | Club list. | KEEP |
| `activity-clubs/[id]` | A club page. Repointed in Packet 10. | KEEP |
| `activity-clubs/add` | Create a club. Already capability-gated. | KEEP |
| `activity-clubs/edit/[id]` | Edit a club. | KEEP |
| `activity-clubs/message-board/[id]` | A club's board. | KEEP |
| `activity-clubs/review/[id]` | Write a club review. Wrapper around the shared form. | KEEP |
| `events/index` | Event list. | KEEP |
| `events/[id]` | An event page. Repointed in Packet 10. | KEEP |
| `events/add` | Create an event. Already capability-gated. | KEEP |
| `events/edit/[id]` | Edit an event. | KEEP |
| `events/review/[id]` | Write an event review. Wrapper around the shared form. | KEEP |
| `linkups/index` | Link-up list. | KEEP |
| `linkups/[id]` | A Link-up page. | KEEP |
| `linkups/create` | Create a Link-up. Reachable from the map after Packet 18. | KEEP |
| `linkups/edit/[id]` | Edit a Link-up. | KEEP |
| `linkups/board/[id]` | A Link-up's private board. | KEEP |
| `moments/create` | Post a Moment. Absorbs memory creation; gains real camera capture. | KEEP |
| `moments/[id]` | One Moment. Absorbs the Memory view; wording changes with age. | KEEP |
| `memories/create` | Post a Memory. Same act as posting a Moment. | MERGE → `moments/create` |
| `memories/[id]` | One Memory. Same object, older. | MERGE → `moments/[id]` |
| `manager/dashboard` | Manager overview across everything you run. | KEEP |
| `manager/requests` | Capability requests you've made. | KEEP |
| `manager/membership-status/[id]` | Club membership state. | KEEP |
| `manager/qr/[type]/[id]` | The printable QR for a place you manage. | KEEP |
| `admin/dashboard` | Admin overview. | KEEP |
| `admin/claims` | Review ownership claims. | KEEP |
| `admin/moderation` | Reports queue. Gains reported reviews in Packet 12. | KEEP |
| `admin/listings` | All businesses and properties. | KEEP |
| `admin/explorers` | All Explorers. | KEEP |
| `admin/activities` | Club and event admin. | KEEP |
| `admin/areas` | Area management. | KEEP |
| `admin/public-places` | Add and edit parks. | KEEP |
| `admin/audit` | Admin action log. | KEEP |
| `guest/[id]` | Old public profile view, superseded by `profile/[id]`. Nothing links to it. | DELETE |
| `saved` | Empty stub. Nothing links to it. | DELETE |

Six deletions, two merges, 69 kept. That leaves **71 routes**.

Every deletion and merge means three edits in the same commit: remove the file,
remove its `<Stack.Screen>` line from `app/_layout.js`, and update the route
inventory in `test/navigation.test.js:95-140`. `test/routes.test.js` discovers
route files from the tree, so it follows automatically.

---

## 3. Work packets

One session each. Dependency-ordered. Every "done means" is a thing that can
fail — if it can't fail, it isn't a check.

### Packet 0 — Close the business and property creation hole

Replace the two insert rules that say `with check (auth.uid() = owner_id)` —
`20260803211732:135-136` for businesses, `:163-164` for properties — with a real
capability check, copying the shape clubs and events already use
(`20260803120000:22-46`). One migration, no UI.

Snag to decide inside this packet: `manager_capabilities.businesses_status` and
`properties_status` both default to `'active'` (`20260801140000:10-16`), so the
capability column cannot be read as-is — every row already says yes. The packet
has to say what "unlocked" means for these two and flip the default.

*Why first:* hiding the button in Packet 5 changes nothing while the database
still accepts the insert.

**Done means:** a plain Explorer's insert is refused by the database, proven
against a real account, and an existing Manager's insert still succeeds.

### Packet 1 — Header

Take `components/Header.js` onto the tokens in `utils/tokens.js` and drop the
"Guestbook" title at `:50`.

**Done means:** no raw hex left in `Header.js`, and the word does not appear on
any screen.

### Packet 2 — Product name sweep

33 occurrences across 21 `.js`/`.json` files, including `app.config.js` (name,
slug, camera permission strings), plus `README.md` and `docs/SCREEN-INVENTORY.md`.

**Done means:** `grep -ri guestbook` returns nothing outside `docs/archive/`.

### Packet 3 — Delete the six orphans

`place`, `saved`, `guest/[id]`, `business/edit`, `property/edit`,
`business/reviews`. Confirmed: zero inbound links from `app/`, `components/`,
`utils/` or `hooks/`. Leave `property/reviews` alone — it is linked.

**Done means:** 71 routes, 71 `<Stack.Screen>` lines, `npm test` passes with the
inventory in `test/navigation.test.js` updated.

### Packet 4 — One permission check point

One function in `utils/permissions.js` and one matching rule in SQL. Today four
unrelated ideas answer overlapping questions and none is the truth:
`profiles.account_type`, `profiles.is_admin` / `guestbook_is_admin()`,
`manages_any_listing()` (`20260804180000:21`), and `manager_capabilities`.

Note that `manages_any_listing()` answers "do you already run something", which
is not "is Manager unlocked" — a freshly-upgraded Manager with nothing yet gets
`false`. The Settings button in Packet 5 needs the capability question, not this
one.

**Done means:** one function answers each question, everything else calls it,
and a grep for `account_type` in `app/` and `components/` returns only the
permission module.

### Packet 5 — Manager unlock, and close the promotion hole

Move the unlock into Settings. Remove the fork at
`components/ExplorerProfileScreen.js:298` so a Manager sees their ordinary
profile with more tools on it. Drop `account_type` from both column grants
(`20260805132127:58` and `:74`). Retire the stale `'manager'` predicates still
in live SQL — `20260801140000:50` and `:90`, `20260801090000:174`,
`20260802021015:77` — and the two test-data migrations that set the value
(`20260801160000:44`, `20260802021025:31`). There is no `CHECK` constraint on
the column anywhere; add one or drop the column.

Four `scripts/verify-*.cjs` gates and five test files assert on `account_type`
and must be edited in the same commit.

**Done means:** an Explorer cannot write `account_type` at all, proven by a
rejected update, and a Manager's profile is the same screen as everyone else's.

### Packet 6 — Footer, logged-out shell, log-in prompts

Five tabs: Camera, News Feed, MAP, Explorer Score, Profile. The tab list is data
at `utils/navigation.js:21-27`, and `components/TabBar.js` already draws the
raised centre correctly. Add the map-only swap so the centre becomes Scan QR on
`/map`, plus a logged-out variant and a Log In button.

**The snag, stated so nobody discovers it late:** `/scan` is in
`FULL_SCREEN_ROUTES` (`utils/navigation.js:46`), so a centre button that
navigates to `/scan` hides the bar it lives in the instant it is pressed. Either
scanning becomes an overlay rather than a route, or `/scan` comes out of that
list. Pick one in this packet.

Four test blocks break and must be updated: the label list
(`test/navigation.test.js:52-55`), the one-raised-tab-at-index-2 assertion
(`:57-61`), the tab-points-at-a-real-file check (`:63-70`), and the route
inventory (`:95-140`).

Also here: put the hardcoded test login behind a build-time flag
(`EXPO_PUBLIC_SHOW_TEST_LOGIN`, default off) so the panel is not in the
production bundle at all. `app.config.js` already reads `EXPO_PUBLIC_*`. Take
`TEST_SETUP_TOKEN` at `app/auth/login.js:15` with it.

**Done means:** a logged-out visitor reaches the map and sees pins, every
account-only action prompts a log-in instead of failing, and the production
export contains no test email addresses.

### Packet 7 — Friends mean friends

Switch the check-in and Link-up rules from the one-way follow test to
`are_friends`: `live_checkins_select_visible` (`20260802211800:63-69`) and
`private.can_view_linkup` (`:36`). Add a notification when a follow becomes
mutual — `notifications.type` is free text, so this is a new value, not a schema
change. The dedupe key must not depend on order
(`least(a,b)||'-'||greatest(a,b)`), because the unique index is on
`(recipient_user_id, dedupe_key)`.

Safety-critical. `RULES.md` privacy gate applies: describe what it exposes
before writing it.

**Done means:** a one-way follower can no longer read a followers-only check-in,
proven with two accounts, and both people get one notice when a follow becomes
mutual.

### Packet 8 — Close friends, and the location setting

A `close_friends` table (one-way, private to the owner) and a three-way setting
on `profiles` defaulting to no one. Rewrite the two rules from Packet 7 to read
it. Nothing here relies on the app choosing what to draw.

Safety-critical. Privacy gate applies. Depends on Decision 3.

**Done means:** a brand-new account shares location with nobody without touching
anything, and each of the three settings is proven from a second account.

### Packet 9 — Direct messages between friends

Genuinely new. The two existing boards (`linkup_messages`, `activity_messages`)
are scoped to a Link-up or a club and have no idea of a pair of people, so there
is nothing to reuse.

**Done means:** two friends can exchange messages, a non-friend cannot open the
thread, and blocking closes it.

### Packet 10 — Reviews read from one table

Repoint the four place pages at `explorer_reviews`: `app/business/[id].js:47`,
`app/property/[id].js:43`, `app/activity-clubs/[id].js:81`,
`app/events/[id].js:51`. Add `public_place` to the `target_type` check
(`20260802152000:48`) and turn reviews on for parks
(`app/places/[id].js:85`). Move manager reply and challenge onto
`explorer_reviews` — `business_response`, `challenged` and `challenge_reason`
exist only on the untracked legacy `reviews` table, which is why
`app/property/review-action.js:71` writes a column called `business_response` on
a property.

Smaller than it looks: writing is already unified through
`components/ExplorerReviewForm`. This is a read-path change plus the reply
columns.

Do not re-key any review. `explorer_score_events.source_id` points at
`explorer_reviews.id` with no foreign key and a unique constraint on
`(source, source_id)` (`20260810040000:55-67`), and the backfill set each row's
`awarded_on` from its own historical date. Changing those ids destroys the
ledger.

**Done means:** all five place types show reviews from `explorer_reviews`, a
park review can be written and read back, and a manager reply survives a reload.

### Packet 11 — Comment on any review

Widen `social_comments_target_type` (`20260802155202:64`) from
`('moment','video_review')` to include plain reviews, and add the matching
branch in `guestbook_private.validate_social_target()`.

**Done means:** a text-only review takes a comment, and the comment appears on
the review, not just in the table.

### Packet 12 — Report a review

Three edits: the `social_reports_target_type` check (`20260802155202:79`), the
branch in `validate_social_target()`, and the lateral join in
`admin_get_moderation_queue` (`20260810005000:83-98`) so a reported review shows
its author and text. It surfaces in the Social tab of `app/admin/moderation.js`,
which already exists.

Depends on Decision 6.

**Done means:** a reported review appears in the admin queue with its text, and
a decision on it sticks.

### Packet 13 — Drop the mirror tables

`reviews`, `activity_club_reviews` and `event_reviews` are copies written by
`sync_explorer_review_to_legacy()` (`20260802152100:267-342`, trigger at `:386`),
sharing primary keys with the real table. There is a reverse sync too
(`20260802152300:30-92`). Drop the triggers first, then the tables.

Last, and only after 10–12 have run in production for long enough that nothing
is still reading them. Depends on Decision 7.

**Done means:** nothing in `app/`, `supabase/functions/` or `scripts/` names the
three tables, and the app works with them gone.

### Packet 14 — One post

Merge `explorer_memories` (`20260805130000:61`) into `explorer_moments`
(`20260802155202:15`). Moments survive, because every social object already
points at them — likes, comments, reports and the feed.

What has to change on the surviving table:

- Media is currently required (`media_type` and `media_url` are `not null`).
  Memories allow text only. The constraint has to relax.
- Moments already accept `target_type='public_place'`
  (`20260805120300:112-117`), so parks are fine. What Moments forbid is
  `public_place` as an *actor* (`:30`) and any non-public visibility for a
  Moment posted as a listing (`:97`, `:301`). Those rules stay.
- Moments carry `actor_type`/`actor_id` — post as a listing you manage.
  Memories don't. The merged table keeps them.
- `explorer_memory_shares` (`20260805130000:117`) is already a hand-picked
  recipient list per post, and is the closest thing to close friends in the
  schema today.

Depends on Decision 4, which decides whether `archive_visibility` survives.

**Done means:** one table, one screen, existing Memories still readable and
still respecting who could see them before the merge.

### Packet 15 — Date filter for the map

Filter posts on the map by when they happened. Depends on Packet 14.

**Done means:** picking a date changes what the map shows, and clearing it
restores everything.

### Packet 16 — The Camera tab actually takes a photo

Real capture — `launchCameraAsync` exists nowhere in the repo today — posting to
where you are. No new dependency: `expo-camera` and `expo-image-picker` are both
installed. Pin `expo-camera` to a real version first (`package.json:35` says
`"latest"`).

Fix the two lying labels at `app/moments/create.js:376-377` in the same packet.

Depends on Packets 6 and 14.

**Done means:** the Camera tab opens a camera, not a photo library, and the
captured photo posts with its location.

### Packet 17 — Check-ins are for parks

Narrow `app/checkins/create.js` to public places. Depends on Decision 5 for what
counts as a park.

**Done means:** a business cannot be checked into, and an existing check-in at a
business either still works or is dealt with explicitly.

### Packet 18 — Link-ups start on the map

Create a Link-up from where you are on the map. Depends on Packet 6.

**Done means:** a Link-up can be made from the map with its location already
filled in.

### Packet 19 — Explorer Score rename

Change what people read: the tab label (`utils/navigation.js:25`), the drawer
entry (`utils/drawer.js:46`), the title, eyebrow and body copy in
`app/leaderboards.js`, and the rank card in
`components/ExplorerProfileScreen.js`.

Leave the internals alone — the `/leaderboards` route, the
`get_explorer_leaderboard` function, `profiles.leaderboard_opt_in` and
`test/leaderboard-rank.test.js`. Renaming the function means a migration that
breaks two callers for nothing anyone can see.

Depends on Decision 1.

**Done means:** the word "Leaderboard" is gone from every screen and the route
still works.

### Packet 19a — Endorsements as dated score events

Only if Decision 8 lands on option B. Not built this round. See Decision 8 for
the full shape and cost.

### Packet 20 — The riso pass

83 of the 112 files in `app/` and `components/` do not import `utils/tokens.js`
and carry hand-written hex instead. Take them onto the tokens in
`docs/design-system.md`. Purely visual, no behaviour change — which is why it is
last and why it is the largest.

**Done means:** no colour outside the token list survives a grep for hex in
`app/` and `components/`.

---

## 4. Decisions only you can make

Eight. Each has a recommendation. Nothing above them is blocked except where
noted.

### Decision 1 — Which number is Explorer Score?

The board people can see ranks on review points and windows on when the review
was written. The ledger nobody can see, `explorer_score_events`, uses a
different scale, includes check-ins, applies caps and dates every point.

**Recommendation:** the ledger. It is the thing that behaves like a score. But
adopting it changes everyone's number on the day it ships — see Decision 8,
option B, which is the same move.

### Decision 2 — Is "close friends" also a post audience?

The setting exists for location. Should a post be able to say close friends
only? `explorer_memories` already has a `'selected'` visibility with a hand-
picked list behind it, so the machinery is half there.

**Recommendation:** yes, and reuse `explorer_memory_shares` rather than
inventing a second list.

### Decision 3 — Does a check-in obey the location setting?

`RULES.md` currently defines a check-in as "a public, opt-in presence at a park".
Section 1 says location starts at nobody. Both cannot hold.

**Recommendation:** the setting wins, and `RULES.md` changes to match. A
check-in you opted into is still a location, and one rule for location is easier
to reason about than two. Blocks Packet 8.

### Decision 4 — Keep the two-phase visibility on posts?

`archive_visibility` exists so that agreeing to be seen today is not agreeing to
be seen forever. The target model deletes it.

**Recommendation:** keep the two phases, change only the words people read.
Dropping it makes already-posted Memories more visible than their authors agreed
to, which is a regression on live data, not a simplification. Blocks Packet 14.

### Decision 5 — What is a park?

`place_type='park'` only, or all eight `public_places` types?

**Recommendation:** all public places. "Park" is the word, `public_places` is
the thing, and picking one type leaves the other seven with no way to be checked
into. Blocks Packet 17.

### Decision 6 — Where do reported reviews go?

You said extend the account-reporting system. That system is
`live_safety_reports` and its targets are Link-ups, messages, check-ins and
people. `social_reports` already holds Moments and comments, has an identical
shape, and feeds the same admin screen.

**Recommendation:** `social_reports`. A review is content. This contradicts what
you asked for, which is why it is a decision and not a packet. Blocks Packet 12.

### Decision 7 — Do the mirror tables die?

Anything outside the app reading `reviews`, `activity_club_reviews` or
`event_reviews` — a dashboard, an export, a report — breaks when they go.

**Recommendation:** drop them, but only after Packets 10–12 have been live long
enough to be sure. If something external does read them, say so now and they
become a view instead. Blocks Packet 13.

### Decision 8 — Should endorsements count towards Explorer Score, and how?

**What happens today, plainly.** Explorer Score ranks on what you wrote, not on
what anyone thought of it. Writing a review earns 1 point for text, 3 with a
photo, 6 with a video, and 3 more if you scanned the QR on site
(`recalculate_explorer_review_points`, `20260802152100:207-265`; the allowed
reasons are fixed to `text_review`, `image_review`, `video_review`,
`verified_qr` and the values to `1, 3, 6`, `20260802152000:98-99`). The board
then adds up those points for reviews written inside the period
(`get_explorer_leaderboard`, `20260802152200:44-46` and `:61`). Endorsements —
`social_likes` rows with `target_type='review'` — are never read by either
function. A review nobody found useful and a review fifty people endorsed score
the same. Endorsements appear only as "Review Reputation", a separate lifetime
figure on the profile
(`get_explorer_review_reputation`, `20260805090000:111`).

There is also a second scale in the database that nothing on screen uses:
`explorer_score_events` (`20260810040000`) scores a review at 5, or 15 if
verified, and a check-in at 10 halving on repeat visits, with a 100-a-day and
400-a-week cap and a date on every point. It was filled in with correct
historical dates. That is what Decision 1 is about, and this decision runs into
it.

**Option A — add an endorsement point to each review's total.** Relax the three
checks, add a trigger on `social_likes` that recalculates `points_awarded`.

*Cost:* moderate — three constraint changes, one new trigger, an extension to
`recalculate_explorer_review_points`.

*Effect on rankings:* recent popular reviews rise, nothing else moves.

*Why not:* the board still windows on when the **review** was written, so an
endorsement earned this week on a review written last year still counts for
nothing — the exact thing you assumed already worked. Worse, an endorsement
arriving next month on a review written this week would retroactively change
last week's finished ranking. A settled week should not move. This option looks
cheapest and is the trap.

**Option B — score endorsements as their own dated events, and rank on the
ledger.** Add `'endorsement'` to the allowed sources on
`explorer_score_events`, keyed on `social_likes.id`, credited to the review's
author, with the date taken from the endorsement itself. Then rewrite
`get_explorer_leaderboard` to add up ledger points where the date falls inside
the period.

*Cost:* highest of the four — one constraint change, two triggers (the removal
side already exists as `remove_score_for_source`, `20260810040000:194`, which
takes the source as an argument), a rewrite of the leaderboard function, and a
backfill of historical endorsements from `social_likes.created_at`.

*Effect on rankings:* everyone's number changes on the day it ships. The
ledger's scale is 5/15 rather than 1/3/6 plus 3, check-ins start counting, and
the daily and weekly caps begin throttling a review that goes viral.

*What it buys:* it is the only option where an endorsement earned this week
counts this week, whenever the review was written — which is what you thought
was happening. It also settles Decision 1 by making the two things called
Explorer Score into one thing.

**Option C — leave points alone, add endorsements to the ranking at query
time.** One extra clause inside `get_explorer_leaderboard`.

*Cost:* smallest. No schema change, no trigger, no backfill.

*Effect on rankings:* a mild reshuffle inside the current window.

*Why not:* it inherits option A's window problem exactly — endorsements only
count if the review they sit on was written inside the period. It also silently
makes the "How points work" card at `app/leaderboards.js:199-203` wrong.

**Option D — change nothing, show endorsements as a second labelled column.**
`get_explorer_review_reputation` already returns the figure.

*Cost:* near zero. *Rankings:* unchanged. Honest, but it does not give you what
you thought you had.

**Recommendation: B, as its own packet, after the rename.** It is the only one
that matches the intent, it runs on a ledger that already exists and already
carries correct historical dates, and it removes the two-numbers-one-name
problem instead of deepening it. The price is real and should be paid
deliberately: every existing weekly and monthly ranking changes the day it
ships. If that is unacceptable, take D now and revisit — but not A or C, because
both let a finished week's ranking keep moving.

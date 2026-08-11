# Rebuild plan

Written 2026-08-11 against `main2.0-Dev` at `499ab8c`.

What the app is now is `docs/SCREEN-INVENTORY.md`. This is what it becomes
and the order it gets there.

This **replaces** the packet numbering in `docs/archive/REDESIGN-BRIEF.md`.
Packets 0–10 of that brief are done and stay done. Do not resume Packet 11
from the old ledger — it is Packet 20 here.

---

## 0. Where the target and the code disagree

The target wins every time. These are the places it costs something, and the
file it costs it in.

**A separate home screen goes.** The target says the app opens on the map.
`app/index.js` is a menu screen with an "Explore Map" button on it. Its only
unique jobs — the log-in buttons and the admin shortcut — move to the map
shell and the drawer.

**The Create tab goes.** `app/create.js` is a launcher for nine actions. The
target footer has no Create. Camera moves to its own tab, Link-ups move to the
map, and the four "add a listing" rows move inside the Manager Dashboard where
a normal Explorer never sees them.

**`/live` gets absorbed.** `app/live.js` is a good screen in the wrong place.
The check-ins, Link-ups and event state it shows are exactly the things the
map is supposed to carry. `CLAUDE.md` already calls this the highest-priority
structural gap.

**`archive_visibility` is at risk, and I want you to look at it.** The target
says a post has one visibility — public, friends, private — and time only
changes the word. `explorer_memories` today has *two*: one while it is live,
and a separate one for afterwards that defaults to private and is never copied
from the first. Its own comment
(`supabase/migrations/20260805130000_explorer_memories.sql:112-113`) says why:
*"consenting to be seen today is not consenting to be seen forever."* Merging
Moments and Memories as literally described deletes that. See Decision 4.

**"Followers only" today does not mean friends.** Check-ins and Link-ups
check a **one-way** follow —
`supabase/migrations/20260802211800_harden_linkups_live_privacy.sql:62-69` and
`:36`. Anyone who follows you, whether you follow back or not, can see your
"followers only" check-in right now. Under the target that is a bug, not a
setting. Fixing it will make some things that are currently visible stop being
visible. That is the correct outcome.

**Manager replies move off the legacy table.** `app/business/review-action.js`
and `app/property/review-action.js` write `business_response`, `challenged` and
`challenge_reason` on the old `reviews` table. Those three columns are not in
**any** migration — they only exist on the live database. A property review's
reply is stored in a column called `business_response`.

### Three things in the brief that are already true

I checked rather than repeating what the old notes said.

**Signup does not force an Explorer/Manager choice.** `app/auth/signup.js` has
four fields — name, email, phone, password — and hard-codes
`account_type:"explorer"` at line 151. There is no picker. The old CLAUDE.md
claim was out of date.

**Mutual-follow friendship already exists and is already correct.**
`guestbook_private.are_friends(uuid,uuid)`
(`20260805120300_moment_place_visibility_and_actor.sql:142-152`) is exactly
"we both follow each other". There is **no `friends` table, no `friendships`
table, no `friend_requests` table and no `close_friends` table** anywhere in
the 66 migrations. Nothing needs unpicking. Moments, the feed and Memories
already use it. Check-ins and Link-ups do not — that is the whole job.

**Nothing needs cleaning up on unfollow.** Friendship is recomputed on every
read, so unfollowing revokes access the same instant. Blocking already deletes
both follow directions (`20260802211800:136`).

### One thing that is worse than the brief assumes

**Any signed-in Explorer can create a business or a property today.** The
insert policies are `with check (auth.uid() = owner_id)` —
`20260803211732_rls_policies_and_grants.sql:135-136` and `:163-164`. That is
not a permission check, it is a check that you did not put someone else's name
on it. Activity clubs and events *do* check for an unlocked capability
(`20260803120000_unify_account_model.sql:22-46`); businesses and properties
never did.

So "a normal Explorer must never see add a business" is not a UI problem.
Hiding the button changes nothing. This is Packet 0 and it ships before the
header.

---

## 1. What the app becomes

Open the app and you are on the map. Not a menu with a map on it — the map.

**Logged out**, the map is the whole product. Businesses, properties, activity
clubs, events and parks are on it. Tap one and its page opens: photos,
description, opening hours, reviews, directions. A Log In button is on screen
at all times. Anything that needs an account — endorsing a review, joining a
Link-up, posting a photo — asks you to log in instead of doing nothing. There
are no greyed-out tabs and no dead buttons. What you cannot do is not there.

**Log in** and the map comes alive. Friends appear on it, if they have chosen
to share where they are. You get a news feed, moments and memories, link-ups,
check-ins, a camera, and an Explorer Score.

**Following is one-way and gives the other person nothing.** When two people
follow each other, that is a friendship — there is no request to accept and
nothing to approve. Friendship unlocks messaging between those two people, and
nothing else. Unfollow and the friendship, the messaging and any location
sharing end immediately, for both of you. You get told when a friendship forms,
so it never happens silently.

**Close friends** is a shorter list you pick by hand from your friends. It is
one-way: I can make you a close friend without you making me one, and being on
my list gives me nothing over you.

**Where you are is off by default.** Location sharing is a single setting with
three answers: friends, close friends only, or no one. A new account shares
with **no one**, and becoming someone's friend never by itself puts you on
their map. You change it deliberately or it does not change. The server
decides who sees you — the app is never trusted to leave a pin out.

**A photo posted where it was taken is one thing.** It is a **Moment** while
it is recent and a **Memory** once it is past. Time decides which word gets
used. One table, one screen, one component. Each post is public, friends only,
or private. Moments appear in the news feed, and the map has a date filter so
you can look back at what has been left on it.

**Check in at a park** to say you are there, so other people can see who is
around. No GPS proof for now.

**Link-ups start on the map.** Drop a pin, set one up. It is not a footer tab.

**Reviews are only ever of a place** — a business, a property, an activity
club, an event, or a park. An Explorer is never reviewed. There is one review
table pointing at any of those five, so endorsing a review, commenting on it,
a manager replying to it and reporting it are each built once. Endorsing and
commenting work on the place's own page, not just on the reviewer's profile.
A manager can reply only to a review of something they manage, and only to
that review. Reporting is separate from replying, and any Explorer can report.

**There is one account.** Everyone is an Explorer. A normal Explorer never sees
"add a business", "add a property", "start a club", "create an event" or "claim
this listing" — not in navigation, not on the map, not on a place page. Those
words do not exist for them. You unlock Manager from Settings, and that reveals
a Manager Dashboard which is the only place those actions live. One permission
check decides all of it, and the database enforces it first.

**The footer, logged in:** Camera · News Feed · **MAP** · Explorer Score ·
Profile. Map is the raised centre button. When you are already on the map it
becomes Scan QR Code, and swiping it up opens Discovery. Logged out it
collapses to the map and a Log In button.

---

## 2. Every route

77 routes across 78 files (`app/map.js` and `app/map.web.js` are one route).
All 77 are declared in `app/_layout.js`.

**MERGE means the file goes and its job moves.** Any deletion also needs its
`<Stack.Screen>` line removed from `app/_layout.js` and the `REMOVED` list in
`test/navigation.test.js:95-140` updated, or the suite goes red.

### Entry and shell

| Route | Verdict | Reason |
|---|---|---|
| `/` `app/index.js` | **MERGE** → `/map` | The app opens on the map. A menu screen in front of it is the thing the target removes. Its log-in buttons become the always-on Log In control; the admin shortcut is already in the drawer. |
| `/map` `app/map.js` | **KEEP** | The product. Gains live pins, friend pins, the date filter and Link-up creation. |
| `app/map.web.js` | **KEEP** | Not a duplicate — a platform split. `react-native-maps` has no web build, so the web file must not import it. Both collapse to one route. |
| `/discover` | **KEEP** | Reached by swiping the centre map button up. Already built and already riso. |
| `/create` | **DELETE** | The target footer has no Create tab. Its nine rows scatter: camera → Camera tab, link-up → the map, check-in → the park page, review → `/scan`, the four "add" rows → Manager Dashboard only. |
| `/scan` | **KEEP** | The centre button becomes this when you are already on the map. See the snag in Packet 6. |
| `/qr/[code]` | **KEEP** | Resolves a scanned code into a verified review. |
| `/notifications` | **KEEP** | Gains the friendship-formed notification. |
| `/settings` | **KEEP** | Gains the location-sharing setting and the Manager upgrade button. |

### The map's live layer

| Route | Verdict | Reason |
|---|---|---|
| `/live` | **MERGE** → `/map` | Everything on it — check-ins, Link-ups, events, club sessions — is what the map is meant to carry. A separate screen for the live layer is the structural gap `CLAUDE.md` names. Its area/distance/time filters become map filters. |
| `/linkups` | **KEEP** | The list of Link-ups you can join, have joined and created. Reached from the map, not the footer. |
| `/linkups/[id]` | **KEEP** | |
| `/linkups/create` | **KEEP** | Entered by dropping a pin on the map rather than from a Create tab. |
| `/linkups/edit/[id]` | **KEEP** | |
| `/linkups/board/[id]` | **KEEP** | The private attendee board. |
| `/checkins/create` | **KEEP** | Narrowed to parks (Packet 17). |

### Places

| Route | Verdict | Reason |
|---|---|---|
| `/business/[id]` | **KEEP** | Gains directions, and its reviews come from the one review table. |
| `/property/[id]` | **KEEP** | Same. |
| `/activity-clubs/[id]` | **KEEP** | Same. |
| `/events/[id]` | **KEEP** | Same. |
| `/places/[id]` | **KEEP** | Parks. Currently the only place page with reviews switched off — it gains them. |
| `/places` | **KEEP** | The parks and public places list. |
| `/events` | **KEEP** | |
| `/activity-clubs` | **KEEP** | |
| `/explorers` | **KEEP** | Find Explorers. |
| `/place` `app/place.js` | **DELETE** | Orphaned, 83 lines, entirely hard-coded — "☕ The Coffee House", three buttons with no `onPress`. Reads nothing. |
| `/guest/[id]` | **DELETE** | Orphaned, 177 lines. A property welcome screen nothing links to; `/qr/[code]` does not route here. Stuck on "Loading..." forever if the read fails. |
| `/saved` | **DELETE** | Orphaned, 38-line placeholder. The working version is the Collections tab on the profile and the `saved` section on `/discover`. |

### Reviews

| Route | Verdict | Reason |
|---|---|---|
| `/business/review/[id]` | **MERGE** → one `/review/[type]/[id]` | Nine lines each, four of them, all wrapping `components/ExplorerReviewForm.js`. One route takes the type as a parameter and gains `park` as a fifth. |
| `/property/review/[id]` | **MERGE** → same | |
| `/activity-clubs/review/[id]` | **MERGE** → same | |
| `/events/review/[id]` | **MERGE** → same | |
| `/business/review-action` | **MERGE** → the review card on `/business/[id]` | A manager reply belongs on the review it answers, not on a separate screen. Also stops writing three columns that exist on no migration. |
| `/property/review-action` | **MERGE** → the review card on `/property/[id]` | Same, and it currently stores a property reply in a column called `business_response`. |
| `/business/reviews` | **DELETE** | Orphaned. Nothing links to it. Its job — a manager seeing reviews of their listings — belongs in the Manager Dashboard. |
| `/property/reviews` | **MERGE** → `/manager/dashboard` | Same job, but this one *is* linked (`app/property/dashboard.js:225`). The asymmetry is the bug; one dashboard section replaces both. |
| `/social-comments/[id]` | **MERGE** → the review card on the place page | It exists only because comments currently work on video reviews and nothing else. Once comments work on any review from the place page, it has no reason to exist. |

### Moments and Memories

| Route | Verdict | Reason |
|---|---|---|
| `/moments/[id]` | **KEEP** | Becomes the one post screen. Shows "Moment" or "Memory" based on age. |
| `/moments/create` | **KEEP** | Becomes the one composer. |
| `/memories/[id]` | **MERGE** → `/moments/[id]` | One thing, not two. |
| `/memories/create` | **MERGE** → `/moments/create` | Same. Its two-phase visibility controls come with it or are dropped — Decision 4. |

### Social

| Route | Verdict | Reason |
|---|---|---|
| `/feed` | **KEEP** | The News Feed tab. |
| `/profile` | **KEEP** | |
| `/profile/[id]` | **KEEP** | |
| `/profile/edit` | **KEEP** | |
| `/connections/[id]` | **KEEP** | Followers and Following. Gains a Friends view, since friends are the mutual set. |
| `/leaderboards` | **KEEP** | Renamed **Explorer Score** everywhere it is visible. Route path stays. |
| `/safety/blocked` | **KEEP** | |

### Manager

| Route | Verdict | Reason |
|---|---|---|
| `/manager/dashboard` | **KEEP** | The one manager surface. Everything a normal Explorer must never see lives here. |
| `/manager/requests` | **KEEP** | Club join approvals. |
| `/manager/qr/[type]/[id]` | **KEEP** | The printable review QR. |
| `/manager/membership-status/[id]` | **KEEP** | No in-app link, but a database trigger writes notifications that deep-link to it. Deleting it breaks those. |
| `/business/dashboard` | **MERGE** → `/manager/dashboard` | The Manager Dashboard already has a Businesses section that does more. Two dashboards for one job. |
| `/property/dashboard` | **MERGE** → `/manager/dashboard` | Same. |
| `/business/add` | **KEEP** | Reachable only from the Manager Dashboard, gated server-side. |
| `/property/add` | **KEEP** | Same. |
| `/activity-clubs/add` | **KEEP** | Same. |
| `/events/add` | **KEEP** | Same. |
| `/business/edit/[id]` | **KEEP** | The real one — owner-scoped by id, 11 fields, taxonomy, location picker, delete. |
| `/property/edit/[id]` | **KEEP** | Same shape. |
| `/activity-clubs/edit/[id]` | **KEEP** | |
| `/events/edit/[id]` | **KEEP** | |
| `/business/edit` `app/business/edit.js` | **DELETE** | Orphaned duplicate. Finds the listing via a `claims` lookup that breaks with two approved claims, has 4 fields instead of 11, no delete, no location picker, no loading state. The `[id]` version is a strict superset. |
| `/property/edit` `app/property/edit.js` | **DELETE** | Same. Address is free text, no coordinates, no delete, and a signed-out visitor gets a permanently blank form. |
| `/activity-clubs/message-board/[id]` | **KEEP** | Members' board. |

### Auth

| Route | Verdict | Reason |
|---|---|---|
| `/auth/login` | **KEEP** | Quick test login stays but gets hidden — Packet 6. |
| `/auth/signup` | **KEEP** | |
| `/auth/forgot-password` | **KEEP** | |
| `/auth/update-password` | **KEEP** | No in-app link by design; it is opened from the emailed reset link. |

### Admin

All nine **KEEP**. They are gated by `useAdminGate`, riso already, and none of
them is user-facing.

`/admin/dashboard` · `/admin/claims` · `/admin/listings` · `/admin/activities`
· `/admin/moderation` · `/admin/explorers` · `/admin/areas` · `/admin/audit` ·
`/admin/public-places`

### Count

**KEEP 56 · MERGE 14 · DELETE 7 — 77.**

The KEEP rows above come to 57 because `app/map.js` and `app/map.web.js` are
listed separately and are one route. Six of the seven deletions are the dead
orphans and happen in Packet 3; the seventh, `/create`, goes in Packet 6 when
the footer loses its Create tab.

---

## 3. Work packets

One packet per session. A packet is not done until its "done means" has been
**run**, not assumed. Dependencies are strict.

---

### Packet 0 — Stop normal Explorers creating businesses and properties

**Ships before everything, including the header.** This is live right now.

Replace the insert policies on `businesses`
(`20260803211732_rls_policies_and_grants.sql:135-136`) and `properties`
(`:163-164`) with a capability check, matching the shape activity clubs and
events already use (`20260803120000_unify_account_model.sql:22-46`).

One migration. No UI in this packet.

Watch out: `manager_capabilities.businesses_status` and `properties_status`
both **default to `'active'`** (`20260801140000_unified_manager_dashboard.sql
:10-16`), so you cannot just read that column. Decide what "unlocked" means for
these two and change the default in the same migration.

**Done means:** a plain Explorer account's insert is refused by the database —
tested against a real account, output pasted. An existing Manager's insert
still succeeds. No existing listing is affected.

---

### Packet 1 — Fix the header

`components/Header.js` uses `#ddd` borders, has no background colour at all,
uses emoji for its icons, and its title is the literal string `Guestbook`
(line 50). It sits above a tab bar and a drawer that are both already riso.

Riso tokens from `utils/tokens.js`. 2px ink border, not 1px. Drop the title
string entirely rather than replacing it — the back arrow, the bell and the
menu are the header; a product name on every screen is not.

**Done means:** no hex value in the file that is not in `INK`. The `designer`
agent passes. Screenshot before and after.

---

### Packet 2 — Take "Guestbook" out

33 occurrences across 21 files, including `app.config.js` (`name`, `slug`, and
both camera permission strings). `app/index.js`, `app/scan.js`,
`app/manager/qr/[type]/[id].js`, `app/settings.js`, `app/places/index.js`,
`components/ExplorerReviewForm.js` and `components/FavouriteButton.js` are the
heaviest.

Mechanical, but read each one — some are error messages where the sentence has
to be rewritten, not word-swapped.

**Done means:** `grep -ri guestbook app/ components/ utils/ hooks/ services/
app.config.js` returns nothing except the `guestbook_private` schema name and
the `guestbook_is_admin` function, which are database identifiers and stay.

---

### Packet 3 — Delete the six dead routes

`app/saved.js`, `app/place.js`, `app/guest/[id].js`, `app/business/edit.js`,
`app/property/edit.js`, `app/business/reviews.js`.

Each also needs its `<Stack.Screen>` line out of `app/_layout.js`, its entry in
the `REMOVED` list in `test/navigation.test.js`, and `"/saved"` out of
`scripts/verify-browser.cjs:50`.

**Done means:** `npm test` green. Route count 71. Nothing in the app 404s —
confirmed by walking the app, not by grep alone.

---

### Packet 4 — One permission check point

There are four unrelated ideas of permission in the codebase and none of them
is the truth:

- `profiles.account_type` — a role string that was retired
  (`20260803120000:10`) but still has stale `'manager'` predicates in five live
  SQL files and ~20 client checks
- `profiles.is_admin` / `guestbook_is_admin()`
- `manages_any_listing()` — "do you manage anything already", which is not the
  same question as "is Manager unlocked"
- `manager_capabilities` — the actual entitlement

Build one: a `utils/permissions.js` that answers *signed in · manager · admin ·
friend of · close friend of*, and one SQL function per question that the
policies use. The client function must never be the only check — every answer
has a server-side twin, and the server one is written first.

`utils/drawer.js:15-22` already has the shape (`GATES`, `allows()`). Generalise
that rather than inventing a second one.

**Done means:** every gate in the app resolves through the new module. A test
proves the client and the database give the same answer for the same person in
all five roles. `scripts/verify-manager-boundary.cjs` and
`verify-screen-gates.cjs` still pass.

---

### Packet 5 — One account, one profile

- Delete the manager branch in `components/ExplorerProfileScreen.js:298-302`.
  One profile screen.
- Add the Manager upgrade button to `/settings`, which reveals the Manager
  Dashboard. Gate it on the capability from Packet 4, **not** on
  `manages_any_listing()` — a freshly-upgraded Manager with no listings gets
  `false` from that and would be locked out of the screen that lets them make
  their first one.
- Remove `account_type` from the INSERT and UPDATE column grants
  (`20260805132127_admin_security_foundation.sql:58,74`). Right now an account
  can promote itself; `20260803214309:39-41` has this written down as still
  open.
- Retire the stale `'manager'` predicates in `20260801140000:50,90`,
  `20260801090000:174`, `20260802021015:77`.
- Take the four "add a listing" entry points off `/create` (which Packet 6
  deletes) and out of every other surface. They exist only inside the Manager
  Dashboard.

**Done means:** a normal Explorer cannot find the words "add a business",
"claim" or "manager" anywhere in the app — walked, not grepped. An `update
profiles set account_type='manager'` from a client session is refused by the
database.

---

### Packet 6 — The footer and the logged-out shell

Footer, logged in: **Camera · News Feed · MAP · Explorer Score · Profile**,
map raised in the centre. Logged out it collapses to the map and a Log In
button, and there are no other tabs.

`utils/navigation.js:21-27` is a data array, so the tab set itself is a small
change. The rest is not:

- `components/TabBar.js:36-61` needs new SVG glyphs — camera, feed, map,
  score, and a QR glyph for the centre button's second state.
- The raised button currently takes one static `route` from
  `TABS.find(t => t.raised)`. It needs its route, glyph and label computed from
  `usePathname()`, which `TabBar` already reads at line 91. This is the only
  genuinely new behaviour in the packet.
- **A snag to solve, not discover later:** `/scan` is in `FULL_SCREEN_ROUTES`
  (`utils/navigation.js:46`), so a centre button that navigates to `/scan`
  hides the bar it lives in the instant it is pressed. Either Scan becomes an
  overlay rather than a route, or `/scan` comes out of that list. Pick one in
  this packet and write down why.
- Swipe-up on the centre button opens `/discover`.
- Delete `app/create.js` and `app/index.js`; `/` becomes the map.
- Locked actions prompt login instead of failing. There are **32 screens** that
  currently `router.replace("/auth/login")` and several more that just `return`
  and leave a blank screen (`app/guest/[id].js`, `app/property/reviews.js:36`,
  `app/business/reviews.js:34`). One shared "log in to do this" prompt replaces
  all of it.
- Hide the quick test login. `app/auth/login.js:17-21` hard-codes four
  `@test.com` accounts. Use a build-time flag —
  `EXPO_PUBLIC_SHOW_TEST_LOGIN`, read the way `app.config.js:1` already reads
  `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` — defaulting off, so the panel is not in
  the production bundle at all rather than merely hidden in it. A runtime check
  would still ship the test emails to every phone.

`test/navigation.test.js` will go red in four places: the label list
(`:52-55`), the raised-tab-at-index-2 assertion (`:57-61`), the tab route
existence check (`:63-70`) and the route inventory (`:95-140`). All four are
meant to be updated, not deleted.

**Done means:** signed out, the app shows a map and a Log In button and nothing
else. Signed in, five tabs. On `/map` the centre button says Scan QR. Every tab
route exists and mounts. Android hardware back behaves.

---

### Packet 7 — Friends mean friends

- Switch `live_checkins_select_visible`
  (`20260802211800_harden_linkups_live_privacy.sql:62-69`) and
  `private.can_view_linkup` (`:36`) from the one-way follow test to
  `guestbook_private.are_friends`, via the Packet 4 check point.
- Rename the visibility value from `followers` to `friends` in both
  `live_checkins` and `linkups`, and in the UI copy.
- Notify both people when a mutual follow forms. The hook is the existing
  `explorer_follows_notify` AFTER INSERT trigger — a friendship can only come
  into being on an insert. Two notification rows, one each way. The
  `dedupe_key` must be order-independent — `least(a,b)||'-'||greatest(a,b)` —
  because the unique index is `(recipient_user_id, dedupe_key)` and a
  per-follow-row key would fire twice if the pair is broken and remade.
- Show Friends as a view on `/connections/[id]`.

`RULES.md` §"Privacy gates" applies: this changes who can see whose location.
Run the `privacy-reviewer` agent before it lands.

**Done means:** a one-way follower can no longer see a friends-only check-in —
proven with two real accounts, before and after. A new mutual follow produces
exactly one notification per person. Unfollowing removes visibility
immediately.

---

### Packet 8 — Close friends, and the location setting

Safety-critical. `RULES.md` §"Privacy gates" — describe what it exposes and
wait before building.

- New `close_friends` table. One-way, hand-picked, and only from your existing
  friends. Being on someone's list gives you nothing over them.
- New location-sharing setting on `profiles`: friends · close friends only ·
  no one. **Default no one.** Not "no one unless", not a fallback branch — the
  column default itself.
- Both go through the Packet 4 check point, so there is one predicate deciding
  who sees a pin and the policies call it.
- Becoming friends must not by itself put anyone on a map. Test that
  explicitly.

`explorer_memory_shares` (`20260805130000:117-123`) is already a hand-picked
per-post recipient list. Read it before designing this — the shape may be
reusable, and if it is not, say why.

**Done means:** a brand-new account shares with nobody, verified by reading the
row not the screen. Each of the three settings shows the right set of people to
the right set of people, tested with three accounts. Turning it down removes
existing pins immediately. `privacy-reviewer` passes.

---

### Packet 9 — Messaging between friends

There is no direct messaging in the app and nothing to reuse. `linkup_messages`
and `activity_messages` are both scoped to a container (`linkup_id`,
`club_id`) with no idea of a pair of people. A 2-person Link-up nearly works
and is the wrong answer: it needs a title, a description of at least 10
characters, a start time between 15 minutes and 180 days away, and it stops
accepting messages once it ends.

So this is a new table. Keep it small: two participants, a body, a timestamp, a
soft-delete. Reuse the rate-limit and blocked-pair helpers that
`post_linkup_message` (`20260802211600:155-174`) already has.

Access is decided by the Packet 4 check point: you may open a conversation with
someone if and only if you are currently friends. Unfriending closes it.

**Done means:** two friends can message. A one-way follower cannot. Unfollowing
ends it for both immediately, verified from the database not the screen. A
blocked person cannot message.

---

### Packet 10 — One review table

Smaller than it looks. **The one table already exists.**

`public.explorer_reviews`
(`20260802152000_explorer_profile_review_schema.sql:46-64`) is the canonical
store and is already polymorphic — `target_type` plus `target_id`. It holds
reviews **written by** an Explorer, never reviews **of** one. It is neither
dead code nor an endorsement mechanism. Only the name is misleading, and
renaming a live table breaks the score ledger for no user-visible gain, so
leave it.

`reviews`, `activity_club_reviews` and `event_reviews` are **copies**, written
by a trigger — `sync_explorer_review_to_legacy()`
(`20260802152100_explorer_review_scoring.sql:267-342`, trigger at `:386`) —
sharing the same primary key. There is a reverse sync too (`20260802152300
:30-92`).

The work:

1. Point the four place pages at `explorer_reviews` instead of their copy:
   `app/business/[id].js:47`, `app/property/[id].js:43`,
   `app/activity-clubs/[id].js:81`, `app/events/[id].js:51`.
2. Add `'public_place'` to the `target_type` CHECK so parks become reviewable,
   and add a fifth entry to `TARGET_CONFIG` in
   `components/ExplorerReviewForm.js:18-41`. Parks are not reviewable today —
   `app/places/[id].js:85` passes `showReviews={false}` because there was
   nowhere to put the row.
3. Collapse the four 9-line review-route wrappers into one
   `/review/[type]/[id]`.
4. Move the manager reply onto `explorer_reviews` as real, migrated columns.
   Today `business_response`, `challenged` and `challenge_reason` exist only on
   the untracked live `reviews` table — no migration ever created them. A
   manager may reply only to a review of something they manage, and only to
   that review; enforce it in RLS via the Packet 4 check point, not in the
   screen.

**The timestamp risk, and why it is small.** `explorer_score_events.source_id`
points at `explorer_reviews.id` with no foreign key and a
`unique(source, source_id)` (`20260810040000:55-67`), and
`20260811010000_backfill_explorer_score_events.sql` set each row's `awarded_on`
from its own historical date. **As long as `explorer_reviews.id` never
changes, nothing needs fixing.** Any approach that re-keys reviews — new ids,
copy-into-a-new-table — destroys 1005 backfilled points and every past week's
Explorer Score. Do not do that. Migrate in place.

**Endorsement is untouched.** It is `social_likes` with `target_type='review'`
pointing at `explorer_reviews.id` (`20260802155202:46-54`). It already points
at the surviving table. Carry it across by changing nothing.

**Done means:** all five place types show reviews from one table. A review
written before this packet still has its original `created_at` and still scores
the same. `get_explorer_leaderboard` returns identical rows before and after —
compare them. Manager reply works from the place page and is refused for a
listing the account does not manage.

---

### Packet 11 — Comment on any review

`social_comments.target_type` is `check in ('moment','video_review')`
(`20260802155202:64`) — you can only comment on a review that happens to have
a published video. Widen it to `'review'`, add the branch in
`guestbook_private.validate_social_target()`, and render the thread on the
place page next to the review, not only on the reviewer's profile.

`components/CommentThread.js` already does everything else.

**Done means:** a text-only review of a park can be commented on from the
park's page. Existing video-review comments still resolve.

---

### Packet 12 — Report a review

There are **two** report systems already, both polymorphic, both feeding one
admin screen with two tabs:

- `social_reports` — content. `target_type check in ('moment','comment')`
  (`20260802155202:69-83`).
- `live_safety_reports` — safety and accounts.
  `target_type check in ('linkup','linkup_message','checkin','user')`
  (`20260802211500:82-92`). This is the one
  `components/ProfileSafetyActions.js:40` uses to report a person.

You said extend the account one. **I would extend `social_reports` instead** —
a review is content, not a person, and the Social tab of
`app/admin/moderation.js` is already where reported content is judged. Same
reasons list, same queue, same admin screen either way. This is Decision 6;
if you want the account system, say so and it is the same three edits on the
other table.

Three edits whichever you pick: the `target_type` CHECK, the branch in
`validate_social_target()`, and the lateral join in
`admin_get_moderation_queue` (`20260810005000:83-98`) plus its action branch
(`:231-238`).

Any Explorer can report any review. A manager can report a review of something
they manage. Reporting is a separate control from replying and is never behind
a menu.

**Done means:** a reported review appears in the existing moderation queue with
a working Dismiss and Remove, and the decision is audited like every other one.

---

### Packet 13 — Drop the copies

Only after 10–12 have been running in production long enough to trust.

Drop `sync_explorer_review_to_legacy()`, the reverse-sync functions, and then
`reviews`, `activity_club_reviews` and `event_reviews`.

`reviews` is not in any migration, so this is the one place in the plan where
the migration has to be written against the live schema rather than a file.
Read the live table first. See Decision 7 — you may want to keep them as a
read-only copy for something outside the app.

**Done means:** no code path reads the three tables. Dropping them changes
nothing on screen. The `explorer_score_events` totals are unchanged.

---

### Packet 14 — Moments and Memories become one thing

Two tables today:

- `explorer_moments` (`20260802155202:15`) — the feed post. Media required.
  `visibility` is `public|friends`. Everything social points at it:
  `social_likes`, `social_comments`, `social_reports`,
  `get_explorer_social_feed`.
- `explorer_memories` (`20260805130000:61`) — the keepsake. Media optional,
  text-only allowed, `public_place` allowed as a target. `visibility` is
  `private|friends|selected|public`, plus `live_until` and a separate
  `archive_visibility`. Feeds `MyMap`.

`explorer_moments` survives, because every social object already points at it.
It needs the union of the two: text-only posts allowed, `public_place`
permitted as a target, and Memories' rows migrated in with their original
`created_at`.

`RULES.md` already says these are one thing. The word shown is decided by age,
in one function, used everywhere.

**Read Decision 4 before starting.** Whether `archive_visibility` survives
changes this packet substantially.

**Done means:** one table, one screen, one composer. A recent post says
"Moment", an old one says "Memory", and nothing anywhere says both. Every
existing Memory is still visible to exactly the people who could see it before
— checked per row, not in aggregate. `MyMap` still works.

---

### Packet 15 — Look back at the map

A date filter on the map that shows Memories left on it. Depends on 14, because
until then there are two tables to read.

**Done means:** picking a past date shows what was posted then, obeying the
same visibility rules as the feed. No date shows the present.

---

### Packet 16 — The Camera tab

There is **no camera capture anywhere in this app.** `launchCameraAsync`
appears nowhere. `app/scan.js` is the only `expo-camera` consumer and it is a
QR reader — no `takePictureAsync`, no camera ref. Everything else opens the
photo library. `app/moments/create.js:376-377` labels its buttons "Photo /
camera" and "Video / camera" and **both open the library**. Fix that label in
this packet; it is currently untrue.

No new dependency — `expo-camera` and `expo-image-picker` are both installed.
But `package.json:35` has `"expo-camera": "latest"`, the only unpinned Expo
package in the file. Pin it before building on it, or an unrelated
`npm install` will change the camera under you.

Capture, then post to your current location as a Moment. Coordinates rounded
server-side, as `start_live_checkin` already does.

**Done means:** the Camera tab takes a photo on a real device and posts it with
a location, and the resulting post is a normal Moment in the feed.

---

### Packet 17 — Check-ins are parks only

`app/checkins/create.js:8-14` currently offers park, public place, business,
activity club and event. Narrow to parks. Narrow the `place_type` CHECK on
`live_checkins` too, or the screen is the only thing stopping it.

Existing check-ins at non-parks: leave them, expire them naturally. Do not
delete anyone's content as a side effect (`RULES.md` §Data).

Decision 3 decides whether a check-in obeys the location setting from Packet 8
or is always public.

**Done means:** you can only check in at a park, refused by the database not
just the form. Existing rows are untouched.

---

### Packet 18 — Link-ups start on the map

Drop a pin, create a Link-up there. Remove the Link-up entry point from
anywhere that reads like a footer action.

`components/LinkupForm.js` already takes coordinates; this is a new entry
point, not a new form.

**Done means:** a Link-up can be created from a long-press on the map and lands
with those coordinates. The old entry points are gone.

---

### Packet 19 — Explorer Score

Two changes only. Do not redesign it.

**Rename it.** User-visible only: the tab label (`utils/navigation.js:25`), the
screen title, eyebrow and copy in `app/leaderboards.js`, the drawer row
(`utils/drawer.js:46`), and the rank card in
`components/ExplorerProfileScreen.js`.

**Left alone deliberately, and say so in the commit:** the route `/leaderboards`,
the RPC `get_explorer_leaderboard`, the column `profiles.leaderboard_opt_in`,
and `test/leaderboard-rank.test.js`. Renaming the RPC means a migration that
breaks two callers and changes nothing anybody sees.

**Does it already rank on the period? Yes — for review points.** I checked
before proposing anything. `get_explorer_leaderboard`
(`20260802152200_explorer_review_security_and_api.sql:29-76`) filters
`er.created_at >= date_trunc('week'|'month', now())`, so only reviews written
inside the period count. It is not summing lifetime totals.

Two things about it you should know, and neither is what you asked for:

1. **Endorsements count for nothing, and never have.** See Decision 8.
2. The window is calendar-truncated, not rolling. On a Monday morning "this
   week" is a few hours wide, and everyone's score is near zero. A rolling
   7 and 30 days would read better, but that is a change you have not asked
   for, so it is not in this packet.

**Done means:** no user-visible "Leaderboard" string remains. The board returns
the same rows as before the rename — compared, not assumed.

---

### Packet 19a — only if Decision 8 lands on Option B

Endorsements as dated score events, leaderboard reads the ledger. Written up
in Decision 8. **Not built until you choose.**

---

### Packet 20 — The riso pass

Last, largest, purely visual. 52 files are not riso: 22 dark purple, 30 light
grey. 20 already are.

The worst of it: `/linkups/[id]` is riso while `/linkups`, `/linkups/create`,
`/linkups/edit/[id]` and `/linkups/board/[id]` are dark purple. `/events` and
`/activity-clubs` are light grey while their detail pages are riso.

`docs/design-system.md` is binding. Every hex gets grepped against the token
table. Accessibility floor: 3px `ink-yellow` focus ring, 44px tap targets,
reduced motion respected, state never carried by colour alone.

**Done means:** no hex outside `INK` anywhere in `app/` or `components/`,
proved by grep. `designer` agent passes on a sample from each area.

---

## 4. Decisions only you can make

Every one of these changes what gets built. I have put a recommendation on each
but none of them is mine to take.

### 1. Which figure is Explorer Score?

There are two, and they disagree.

- The board you can see today ranks on **review points** — 1 text, 3 image,
  6 video, +3 verified — for reviews written this week or month.
- `explorer_score_events` (`20260810040000`) is a separate ledger that scores
  a review at 5, or 15 if verified, and a check-in at 10 halving on repeat
  visits, with daily and weekly caps. It was backfilled with correct historical
  dates. **Nothing in the app reads it.**
  `components/ExplorerProfileScreen.js:320-324` says outright that Explorer
  Score does not exist yet.

Renaming the visible board "Explorer Score" puts the name on the figure that
is *not* the ledger, and leaves a second unused thing with the same name in the
database.

**Recommendation:** decide this together with Decision 8. If you take Option B
there, the two become one and this answers itself. If you do not, delete the
unused ledger rather than leaving two things with one name.

### 2. Is close friends also a post visibility option?

You said you had not decided. The options are public / friends / private as
written, or public / friends / close friends / private.

**Recommendation:** yes, add it. `explorer_memories` already has a four-value
visibility including a hand-picked `selected` list, so people are already
posting at a narrower audience than "friends" and taking it away is a
regression. It is one more value in a CHECK and one more branch in the
permission function.

### 3. Does a check-in respect the location setting, or is it always public?

`RULES.md` currently says "a **public**, opt-in presence at a park", which
reads as always public.

**Recommendation:** always public, and say so at the moment of checking in.
A check-in is a deliberate 30-minute-to-4-hour announcement that you are
somewhere, which is a different act from continuous location sharing. Making it
obey the sharing setting means a person can check in and then be surprised
nobody saw it. Two controls, two clear meanings: the setting is "where I am";
a check-in is "I am here now, on purpose".

### 4. Does `archive_visibility` survive the Moment/Memory merge?

The target says one visibility per post and time decides only the word. Today
a Memory has two: one while it is live, and a separate one for afterwards that
defaults to private and is deliberately never copied from the first.

Dropping it means a post shared with friends today stays visible to friends
forever, on data people have already posted under the other promise.

**Recommendation:** keep the two-phase model and change only the vocabulary.
The target sentence — "it is a Moment while recent, a Memory once past, time
decides" — is about wording, and keeping a separate archive setting does not
contradict it. If you do drop it, existing rows must keep their current archive
setting rather than being folded up to the live one.

### 5. Does "park" mean parks, or all public places?

`public_places` has eight types: park, beach, viewpoint, landmark, public
square, nature area, attraction, other. `RULES.md` lists place types as
business, property, park. Check-ins and reviews both need an answer.

**Recommendation:** all eight, called "public places", with park as the
commonest. A beach and a viewpoint need exactly the same row, page and review
that a park does, and splitting them means building the same thing twice.

### 6. Extend `social_reports` or `live_safety_reports` to cover reviews?

You said extend the account-reporting system, which is `live_safety_reports`.

**Recommendation:** extend `social_reports` instead. A review is content, and
that table is where reported content already goes. Both feed the same admin
screen, so you get the same queue either way — it is only a question of which
tab it lands in. Say the word and it is the same three edits on the other
table.

### 7. Do the legacy review copies get dropped, or kept?

Packet 13 drops `reviews`, `activity_club_reviews` and `event_reviews`. If
anything outside this app reads them — a report, an export, anything — they
have to stay as a read-only copy instead.

**Recommendation:** drop them, unless you know of an outside reader. `reviews`
is not in any migration, so it is untracked schema that nothing can verify.

### 8. Should endorsements count towards Explorer Score, and how?

This is the one you asked me to set out properly.

**What it actually does today.** Explorer Score ranks on what you *wrote*, not
on what anyone thought of it. A review earns 1 point for text, 3 with a photo,
6 with a video, +3 if you scanned the QR on site
(`recalculate_explorer_review_points`, `20260802152100:207-265`; the
constraint is `reason in ('text_review','image_review','video_review',
'verified_qr')` and `points in (1,3,6)` at `20260802152000:98-99`). The board
sums those for reviews written inside the period.

Endorsements — `social_likes` rows with `target_type='review'` — are read by
neither function. **A review nobody found useful and a review fifty people
endorsed score exactly the same.** Endorsements appear only as "Review
Reputation" on the profile, a separate lifetime figure that affects no ranking.

So your instinct was right that it should reflect quality, and wrong about
what it does.

There is also that second scale in the database — `explorer_score_events`,
5 per review, 15 verified, 10 per check-in halving on repeats, capped at 100 a
day and 400 a week, with a real `awarded_on` date on every point and 1005
points already backfilled at their correct historical dates. Nothing displays
it. Decision 1 is about it, and this decision collides with it.

---

**Option A — add an endorsement point to each review's total.**

Relax the three constraints, add a trigger on `social_likes` that recalculates
`points_awarded`.

*Cost:* moderate. Three constraint changes, one trigger, an extension to
`recalculate_explorer_review_points`.

*Effect on rankings:* recent popular reviews rise. Nothing else moves.

*Why not:* the board windows on **the review's** date, so an endorsement earned
this week on a review written last year still counts for nothing — the exact
thing you thought was already happening. Worse, an endorsement arriving next
month on a review written this week would go back and change **last week's
finished leaderboard**. A settled week should not move. This one looks cheapest
and is the trap.

---

**Option B — score endorsements as their own dated events, and rank on the
ledger.**

Add `source='endorsement'` to `explorer_score_events`, keyed on the
`social_likes` row, credited to the review's author, with `awarded_on` set to
the endorsement's own date. Then rewrite `get_explorer_leaderboard` to sum the
ledger where `awarded_on` falls inside the period.

*Cost:* the highest. One constraint change, two triggers — the delete side
already exists as `remove_score_for_source`, which takes the source as an
argument — a rewrite of the leaderboard function, and a backfill of historical
endorsements from `social_likes.created_at`.

*Effect on rankings:* **everyone's numbers change the day it ships.** The
ledger scores 5/15 rather than 1/3/6/+3, check-ins start contributing, and the
100-a-day and 400-a-week caps begin throttling a review that goes viral.

*What it buys:* it is the only option where an endorsement earned this week
counts *this week*, whenever the review was written. It also settles Decision 1
by making the two things called Explorer Score into one thing.

---

**Option C — leave points alone; add endorsements to the ranking sum at query
time.**

One extra CTE inside `get_explorer_leaderboard`.

*Cost:* smallest. No schema change, no trigger, no backfill.

*Effect on rankings:* a mild reshuffle inside the current window.

*Why not:* it inherits Option A's window problem exactly — an endorsement only
counts if the review it sits on was written inside the period. It also quietly
makes the "How points work" card on `app/leaderboards.js:199-203` wrong.

---

**Option D — change nothing; show endorsements as a second, clearly labelled
column.**

`get_explorer_review_reputation` already returns the figure.

*Cost:* near zero. *Effect on rankings:* none.

Honest, but it does not give you what you thought you had.

---

**Recommendation: B, as its own packet, after the rename.**

It is the only one that matches what you meant. It runs on a ledger that
already exists and already carries correct historical dates, so the hard part
is done. And it removes the two-things-one-name problem instead of deepening
it.

The price is real and should be paid on purpose, not discovered: every existing
weekly and monthly ranking changes the day it ships. If that is not acceptable,
take **D** now and revisit later — but **not A and not C**, because both of
them let a finished week's leaderboard keep moving afterwards, and that is
worse than the current behaviour.

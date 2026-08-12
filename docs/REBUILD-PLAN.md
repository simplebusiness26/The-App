# Rebuild plan

What the app becomes, in what order, and what only you can decide.

This replaces `docs/archive/REDESIGN-BRIEF.md` and its packet numbering.
Packets 0–10 of that brief are built and stay built. Do not resume Packet 11
from the old ledger — the design pass survives here as the last packet, with a
new number. Current state of the code is `docs/SCREEN-INVENTORY.md`.

Everything below was read from the code on `main2.0-Dev`, not remembered. Where
a line number is quoted, that line was opened.

---

## Where this stands

Updated at commit `c2f92df`. Everything below section 0 is the original plan and
still reads as if nothing has been built — this section is the correction.

**Two things to know before reading anything else.**

Migrations marked *live* were applied to the **Xplorer** Supabase project
(`yzpthslwsvesgndzdqai`), not the older Guestbook one. Anything pointed at the
wrong project sees none of this.

Code marked *shipped* is on `main2.0-Dev` on GitHub. Replit keeps its own copy
and does not pull on its own.

### Done

| Packet | State |
|---|---|
| 0 — Gate business/property creation | live · `8dbc76f` |
| 1 — Header on tokens, name dropped | shipped · `cfad4c2` |
| 2 — Renamed to Xplorer | shipped · `3b92158` |
| 3 — Six dead routes deleted | shipped · `7844cfa` |
| 4 — One permission check point | live · `2854d6f` |
| 5 — Self-promotion closed | live · `654fa54` |
| 6 — Footer rebuilt around the map | shipped · `c66e3a2` |
| 7 — Friends mean friends | live · `eae0495` |
| 8 — Close friends + the visibility setting | live · `36067a2`, `8c3731e` |
| 10 — Reviews read from one table | live · `b5d3ae6` |
| 11 — Comment on any review | live · `ef15797` |
| 12 — Report a review | live · `fb09ba7` |
| 17 — Check-ins are public places only | live · `7d7c1b5` |
| 19 — Explorer Score / Leaderboard naming | shipped · `53a6820`, corrected in `8c3731e` |
| 16 (part) — expo-camera pinned, labels fixed | shipped · `cb5a947` |
| Review actions everywhere + map camera and swipe-up | shipped · `1a08710` |
| Footer works on the map; centre button drags; black bar gone | shipped · `a23e6e1` |
| Manager reply and challenge inline, green and red | shipped · `70c2fac` |
| Public places: named follows, and a way to leave a review | shipped · `97afbc6` |
| Following becomes Friends when it is mutual | shipped · `e9f910a` |
| Become / stop being a manager, from Settings | live · `19ac73d` |
| 16 — A real camera behind the camera button | shipped · `c1d5c03` |
| Moments expiry backfill that never ran | live · `6476d4f` |
| 1 + 8 — Explorer Score on the ledger, endorsements count | live · `35beee6` |
| Memories take likes and comments | live · `fb46dc7` |
| M&M step 4 — the ring and the story viewer | shipped · `eaafc7f` |
| M&M step 6 — audience ceiling shown, Moment audience locked | live · `092ad70` |
| M&M step 7 — a Moment can be kept as a Memory | live · `47598ba` |
| M&M step 11 — Memories in the feed | live · `07815e4` |
| 9 — Direct messages | live · `235990e` |
| The Living Map's arithmetic, ahead of the map | shipped · `a503ee3` |
| 20 — The riso pass, 1108 colours | shipped · `4340a40` |
| 21 spike — MapLibre survives Metro; v5, not v6 | shipped · `47a8b99` |
| 21 A+B — one Living Map brain, real map on the web | shipped · `73df265` |
| 21 C — MapLibre native, old map on a switch | shipped · `587a48e` |
| 21 D — cross-platform parity, proven | shipped · `c2f92df` |
| 20 second half — 399 colours, 194 unreadable pairs fixed | shipped |

### Not started

**Nothing, except the two follow-ups Packet 21 deliberately left.**

- **Phase E** — remove `react-native-maps`, `components/LivingMap.legacy.js`
  and the Google Maps config. Held back on purpose: the MapLibre map has not
  been opened on a real phone yet, and `EXPO_PUBLIC_LEGACY_MAP=1` brings the old
  one back in one variable. It goes the moment the new one has been seen.
- **iOS is configured and NOT compiled.** The MapLibre plugin covers it and
  `npx expo config` resolves clean, but there is no Mac, no Apple signing and no
  EAS login in this environment. It is one build command away rather than a
  day away, and that is the honest state of it.

Parked by your decision:

- **Packet 13** (drop the mirror review tables) — "leave them for now".

Everything else that was outstanding is done. Packet 18's logic and the four
map-shaped Moments and Memories steps (8, 9, 10, 12) have their rules built and
tested in `utils/mapLayers.js`; they now have a map to draw on, and drawing them
is a small piece of work rather than a packet.

### Packets 14 and 15 are superseded

The Moments and Memories specification replaced them. It is a 12-step plan of
its own, and **Moment and Memory are now explicitly two tables and two content
types** — the opposite of what Packet 14 said. `RULES.md` has been corrected.

Done and live: **step 1** (Moments expire), **step 2** (one audience
vocabulary — `nobody · selected · close_friends · friends · followers ·
everyone` — with the profile setting as a ceiling), **step 3** (`moment_views`
and the story-state RPC), **step 5** (Memories permanent, `map_until` separate
from audience). Commit `030ea48`.

Done since: **step 4** (the ring and the story viewer; the permanent Moments
grid is gone), **6** (the audience ceiling is said out loud before posting, and
a Moment's audience can be narrowed and never widened), **7** (Save to
Memories, with the Memory inheriting the Moment's audience), **11** (Memories
in the feed).

Waiting on the map, with their logic already built and tested in
`utils/mapLayers.js`: **8** (fading Memory pins), **9–10** (historical map and
time slider), **12** (heat layer).

### Still open, and yours to decide

Nothing blocking. The four below are settled and recorded here for the trail.

- **Decision 1 — settled: the ledger.** The Leaderboard ranks on
  `explorer_score_events`. Everybody's position moved the day it shipped, which
  was the known cost.
- **Decision 7 — settled: leave them for now.** The three mirror review tables
  and their sync triggers stay. Packet 13 is deferred, not cancelled.
- **Decision 8 — settled: yes, capped and dated.** An endorsement earns the
  review's author one point, five per review maximum. 142 of the 155 that
  already existed were backfilled to the date they actually happened.
- **Decision 9 — settled: approval is for claiming, creating is free.**
- **The 60 existing Moments — dealt with, and it was worse than this said.**
  The backfill never ran: 20260811210000 added `expires_at` as NOT NULL with a
  default, so Postgres filled all 60 rows with the same value, and the statement
  meant to correct that matched zero rows. Every Moment in the app was going to
  vanish at 00:30 on 13 August, together. Pushed 30 days out. The old text
  follows, and it was wrong:

  ~~Step 1 backfilled a 24-hour expiry from each
  post's own date, so all 60 are past. Nothing was deleted. If they should stay
  visible, the answer is converting them to Memories using step 7's machinery,
  not a different expiry.
- **CI is red on `npm audit`** — 15 high-severity advisories, all transitive
  under `expo`, `react-native` and `react-native-maps`. It has been red since
  before this work started. The step was moved to the end of the workflow so
  every test and gate now runs and reports first, but clearing it needs an Expo
  upgrade.

### Two gaps found by using the app rather than reading it

- The reply screen for businesses had **no inbound link anywhere**, so a
  business manager could not reply to a review at all. Fixed in `1a08710`.
- "Follow each other = friends" had **no visible indicator**. Fixed in
  `e9f910a`: the follow button reads Friends when both directions exist, and
  unfollowing says what it costs.

### Found while building, and fixed

Every one of these was live, none was reported, and all were found by reading
the code next to the thing being changed rather than by looking for them.

- **Every Moment in the app was going to expire at the same minute.** The
  backfill in 20260811210000 matched zero rows and a statement that updates
  nothing is not an error. `6476d4f`.
- **The Leaderboard would have leaked a visit count.** Ranking on the ledger
  while still publishing a review count next to it lets anybody subtract their
  way to how many places somebody has been. The public board returns a position
  and a total now. `35beee6`.
- **Deleting a review orphaned its comments.** `cleanup_social_interactions`
  still looked for `target_type='video_review'`, renamed eight days earlier.
  `fb46dc7`.
- **The feed hid Moments shared with everyone.** It filtered on
  `visibility='public'`, a value the schema stopped accepting. It also
  hand-rolled the audience test, so it knew nothing about close friends,
  followers or the profile ceiling. `07815e4`.
- **Every review in the feed showed zero comments.** Same rename, same missed
  call site. `07815e4`.
- **Posting a Moment publicly was impossible.** The button sent `public`.
  Nothing could trend either, same cause. `c1d5c03`.
- **Nothing anybody posted was visible to anybody.** All nineteen accounts are
  still on `visibility='nobody'`, which is the correct default — and nothing in
  the app said so, which is the shape of a bug report that is not a bug.
  `092ad70`.

### Found by testing the APK, and fixed

Everything in this list came from using the built app rather than reading the
code.

- **Every tab in the footer was dead on the map.** The gesture box around the
  raised centre button spanned the full width of the bar and was drawn last, so
  every touch in the footer landed on it. `a23e6e1`.
- **The black bar above the navigation** was a transparent strip showing what is
  behind the app. `a23e6e1`.
- **Challenging a review did nothing visible.** `challenge_review` set the
  column, `utils/reviews.js` read it back, and no screen in the app drew it.
  `70c2fac`.
- **Replying meant leaving the page**, to a screen with the review nowhere on
  it — and there was no route at all for a club or an event, so a club manager
  could not answer a review. `70c2fac`.
- **Public places had two identical Follow buttons** and no way to write one of
  the reviews the page was already listing. `97afbc6`.
- **Settings said businesses and properties were active** for an account with no
  capability row. That stopped being true when Packet 0 flipped the column
  defaults, so the screen offered something the policy refused. `19ac73d`.
- **The Camera button opened the photo library.** No camera capture existed
  anywhere in the app. `c1d5c03`.
- **Moments could not be posted publicly.** `MOMENT_VISIBILITY` still offered
  `'public'`, a value the check constraint has refused since the audience
  vocabulary was unified. Trending had the same stale word, so nothing could
  trend. `c1d5c03`.

### Decision 9 — the manager gate, settled

**Approval is for claiming. Creating is free.**

Anyone can press Become a manager in Settings and immediately list a business, a
property, a club or an event of their own. There is no queue and no approval,
and that is the intended behaviour, not an oversight — locking it down is a
later job, once there is something worth protecting.

The one thing that still needs an administrator is **taking over a listing that
already exists**. That is a claim, and it is properly closed. Proven live on a
real account inside a rolled-back transaction:

| What was tried | Result |
|---|---|
| Self-service manager creates their own listings | works |
| …grabs an **unclaimed** business by writing `owner_id` | 0 rows |
| …takes over **somebody else's** business the same way | 0 rows |

The reason both fail is the update policy: `USING (auth.uid() = owner_id OR
guestbook_is_admin())`. An unowned row makes that `NULL`, which is not true, so
it is invisible to the update. And `claims` only lets an Explorer insert a row
that is `pending` with every decision field null; only an administrator may
update one.

That matters more now than it did, because `stop_managing('unclaim')` creates
unowned businesses on purpose. Every one of them can only be picked up through a
claim you approve.

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

### Packet 21 — The Living Map on web, Android and iOS

The number is 21 because 0–20 are taken and a packet number is an identity, not
a position. The **position** is here: after 17, before 18 and 20. Both of those
now depend on it — you cannot start a Link-up from the map (18) without a map,
and there is no point taking the map onto the token palette (20) until the map
is the one we are keeping.

#### What is actually there today

Checked on `main2.0-Dev` at `23c441a`, not assumed.

There is no interactive map anywhere in this app on any platform right now.

- `app/map.js:28` reads `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` and returns
  `PlacesList` when it is missing (`:30-32`). Behind that key is a real
  `react-native-maps` `MapView` (`:201`) opening on Brighton
  (`50.8225, -0.1372`, delta `0.12`).
- `app/map.web.js` renders `PlacesList` and nothing else. `react-native-maps`
  has no web build, so web has never had a map.
- **There is a second native map the brief did not mention.**
  `components/MemoryPins.js:4` imports `react-native-maps` as well, for My Map
  on the profile, gated on the same key at `:29`, with
  `components/MemoryPins.web.js` as its list twin. So `react-native-maps` is in
  two files, not one, and both must be migrated or the dependency cannot be
  removed.
- `.github/workflows/build-apk.yml:29` passes `secrets.GOOGLE_MAPS_API_KEY`
  into the APK build. Whether that secret is set is not knowable from the
  repository — if it is, the built APK has been showing the Google map and the
  web preview has not. Check it before Phase A so we know which behaviour we
  are preserving.

The rest of the Living Map is real and works. `utils/liveActivity.js` is
already a pure normaliser over `get_live_discovery` with injected clocks and
Now/Tonight/Weekend windows. `utils/markers.js` already owns marker semantics
(icon = type, ink = state). `utils/placeCards.js` already builds cards and
neighbours. `utils/coordinates.js` already rejects a missing coordinate without
plotting it at 0,0. None of that is platform-specific and none of it needs
rewriting.

**What is duplicated is the loading and the state, not the meaning.**
`app/map.js:47-104` and `components/PlacesList.js:33-91` are the same three
Supabase reads, the same signed-out guard, the same error isolation, the same
search matcher and the same type filter, written twice. That is the thing this
packet extracts — and it is why the packet is affordable: most of the domain
layer in the target diagram already exists.

#### The decision

MapLibre becomes Xplorer's map technology on web, Android and iOS.
OpenFreeMap is the current basemap, style and tile source.

OpenFreeMap is **not** described here as a stopgap. No decision has been made
to move to Google or Mapbox, and this setup may well be what Xplorer keeps. It
asks for no key, no account and no card, it allows commercial use, it states no
request limit, and it can be self-hosted from published planet images if we
ever outgrow the public instance. What the architecture must guarantee is that
swapping the bottom layer later is a configuration change, not a rebuild.

The one obligation it does carry is attribution — "OpenFreeMap © OpenMapTiles,
data from OpenStreetMap" — which has to be on the map on every platform.

#### Sub-phases

**Phase A — one Living Map brain, current map untouched.**
Extract the duplicated loading and state out of `app/map.js` and
`components/PlacesList.js` into one shared module. It owns: the three static
reads, the signed-out branch, the `get_live_discovery` call, error isolation so
a failed live read leaves the static pins alone, coordinate validation, search,
type filter, time window, the card set, marker descriptors and deep links. It
returns a map-ready model and nothing platform-specific — no MapView, no DOM,
no style URL.

The repo's convention points at a hook in `hooks/` over a component
(`useAdminGate`, `useManagerGate`) with the pure parts staying in `utils/`.
`useLivingMap` is the obvious name; take it or better it, but do not put pure
functions inside the hook — `utils/liveActivity.js` proves how much of this
tests better as plain functions with an injected clock.

Nothing renders differently at the end of Phase A. Both existing surfaces
consume the shared model and every current test still passes. If that is not
true, stop — the extraction is wrong.

**Phase B — the web renderer.**
`maplibre-gl` in `app/map.web.js` (or a `LivingMap.web` component behind it),
pointed at the provider config module. This is the first time the browser
preview shows a real map. Web is first because it is where the work can be seen
without a build.

**Phase C — the native renderer.**
`@maplibre/maplibre-react-native` behind a `LivingMap.native`, same shared
model, same markers, same cards. Introduce it **alongside** `react-native-maps`
rather than in place of it, behind a switch, so the working native map is never
the thing being debugged.

**Phase D — parity.**
Walk the whole existing feature list on both renderers, including
`components/MemoryPins.js`, which moves to the same renderer rather than
keeping a private map.

**Phase E — retire the old map.**
Only once D passes: remove `react-native-maps`, the two `apiKey` branches, the
`android.config.googleMaps` block in `app.config.js:22-24`, the workflow env at
`build-apk.yml:29`, and the `react-native-maps` mock in `test/setup.js:157`.
Nothing else Google-related is touched — the map changing is not a reason to go
near anything else.

**Phase F — verification.**
Full Jest suite, every `verify:*` gate, `verify:browser` against a real web
export, and an APK built from the workflow and opened on a phone. iOS is
verified by a build that compiles and runs, not by a screenshot of a simulator
nobody kept.

#### Expo and native build implications — the honest version

- **Expo Go stops being an option for the native map.**
  `@maplibre/maplibre-react-native` is not in the Expo SDK and cannot run in
  Expo Go. It needs a development build with its config plugin
  (`"@maplibre/maplibre-react-native"` in `plugins`).
- **This costs Android nothing new.** `.github/workflows/build-apk.yml:60`
  already runs `npx expo prebuild --platform android --clean` and then Gradle.
  That is a custom native build. The plugin joins `expo-camera` in the existing
  `plugins` array and the same workflow keeps working.
- **iOS has no build at all today.** There is no iOS workflow, no Mac runner,
  and no signing set up. "iOS architecture established and buildable" means a
  build that actually compiles — which means either an EAS build or a Mac.
  Budget it as its own piece of work; it is the largest genuinely new cost in
  this packet and it is not a map problem.
- **Architecture is fine.** Expo removed the legacy architecture in SDK 55; this
  repo is on SDK 57 with React Native 0.86.2, so it is on the New Architecture
  already. MapLibre React Native v11+ is New-Architecture-only and wants RN
  ≥ 0.80. Compatible, with nothing to migrate.
- **Replit stays the web preview.** MapLibre GL JS is a browser library and
  needs no native build, so the browser preview keeps working the way it does
  now — and for the first time will show the same map the phone shows.

#### Risks, worst first

1. **Bundling `maplibre-gl` under Metro.** MapLibre GL JS runs its tile work in
   a web worker, and worker handling is the known rough edge when a bundler
   other than Webpack/Vite is in play. This is the one thing that could turn
   Phase B from a day into a week. **Spike it before committing to the packet**:
   a throwaway branch that renders one OpenFreeMap style in the Expo web build
   and nothing else. If Metro fights, `react-map-gl/maplibre` is the usual
   escape hatch and is still MapLibre underneath.
2. **Reaching a DOM node from inside react-native-web.** The web renderer needs
   a real element to mount into. Part of the same spike.
3. **Losing the working native map mid-migration.** Mitigated by Phase C
   running both side by side and Phase E deleting nothing until D passes.
4. **The gates and tests are written against the current architecture** and
   will fail loudly the moment it changes. That is correct behaviour, not
   breakage. See below.
5. **A second Living Map appearing by accident** — the web renderer growing its
   own Supabase reads because it was easier than threading the model through.
   This is the failure `verify-living-map.cjs` was written to catch and the new
   gate has to keep catching it.
6. **OpenFreeMap availability.** A free public instance with no contract. The
   provider module is the mitigation: swapping the style URL must be a
   one-file change, and self-hosting is available if it ever matters.

#### Provider isolation — the acceptance criterion, not a nicety

One module owns the style URL, the attribution string and any provider-specific
option. Feature code asks it for a style; it never types a hostname. The test
for this is blunt: `tiles.openfreemap.org` appears in exactly one file, and
changing that file changes the map on all three platforms.

#### Testing

`verify:livingmap`, `verify:cards` and `verify:mymap` all currently assert the
architecture being replaced — `verify-map-cards.cjs:98` requires the API-key
branch to exist, `verify-my-map.cjs:193` requires it in `MemoryPins`, and
`verify-living-map.cjs` requires `app/map.web.js` to delegate to `PlacesList`.
`test/map-cards.test.js:163,227` sets and unsets the key, and
`test/living-map.test.js:250` calls `PlacesList` "the shipping path".

**Do not delete any of them ahead of the migration.** They are the description
of what has to survive. Rewrite each assertion into the product guarantee
underneath it, one phase at a time, and keep the count honest — a gate that
loses half its checks during a migration is a gate that stopped working.

What the replacement checks must prove:

- a real map renders on web, and on native
- both consume the shared model, and neither queries Supabase for places itself
- `get_live_discovery` stays the only answer to "what is happening"
- businesses, properties, clubs and live activity all reach both renderers
- search, All/Businesses/Properties/Activity Clubs, Happening, and
  Now/Tonight/Weekend still work
- marker semantics stay shared: icon = type, ink = state, three inks only
- tapping a marker opens an Xplorer place card, not a provider popup
- activity deep links survive
- a signed-out visitor still gets static places
- a failed live read leaves the static places alone
- a row with no coordinates is not plotted at 0,0
- `PlacesList` still exists and still works
- the provider hostname appears in exactly one file
- no Google Maps key and no Mapbox token is required by any map path

Prefer behavioural tests over grep. Some of these — "a real map renders" —
genuinely need a source-level check because a renderer cannot be mounted in
Jest; say so in the gate rather than pretending otherwise.

#### What this packet does not do

No database migration. Every entity already carries coordinates and
`get_live_discovery` already returns positions. If inspection during Phase A
turns up a real missing field, it gets written up on its own with a reason —
not smuggled in behind a renderer change.

No new features. Clustering, viewport queries, user-location display, route
overlays, Moments and Memories on the main map, live presence, guides,
transport — none of them are built here. The architecture must not make them
hard later, which mostly means: markers come from data rather than JSX, the
camera is state rather than a prop nobody controls, and live updates replace a
layer rather than remount the map. That is all.

No change to Explorer location privacy. MapLibre can draw a user's position;
whether anybody else may see it stays `profiles.visibility` and
`can_see_content`, unchanged and unconsulted by the renderer.

`app/discover.js:49-55` reads events, clubs and Link-ups directly as well as
calling `get_live_discovery`. That duplication is real and predates this work.
It is not a map surface, so it is out of scope here — noted so the next person
does not think it was missed.

**Done means:** a person opens Xplorer in the browser, on Android and on iOS
and gets the same real, interactive, pannable Living Map, showing the same
businesses, properties, clubs and live activity, with the same pins, the same
cards, the same filters and the same deep links; `react-native-maps` is gone
from `package.json`; no Google key or Mapbox token is required by any map path;
and moving off OpenFreeMap later means editing one module.

#### What Packet 21 actually turned out to be

Written after doing it, because the packet as planned was right about the shape
and wrong about where the difficulty was.

**The spike was worth every minute and found the opposite of what it looked
for.** The worry was Metro and the worker. Metro bundled MapLibre first try. The
real finding was a version: **maplibre-gl 6 is ESM-only and builds its worker
from an `import.meta.url` Worker construction, which Metro does not support** —
so the map constructs and then sits there for ever with no load, no error and
no styledata at all. Silent. Version 5 ships a UMD build with the worker
inlined and works. `package.json` says `^5` and the reason is in `47a8b99`.

**Three of the four wrong turns were the test harness lying.** The browser gate
ran with `--disable-gpu`, so MapLibre threw before rendering anything; its
request stub matched `*` and answered the style request with a fake row, so
MapLibre reported "object expected, array found"; and the 200 that seemed to
prove the network worked was the stub answering, not the internet. An hour went
on the second one. All three are fixed and the gate is stronger for it — it can
now check one route in seconds, wait longer for a map than for a table, print
what the page actually said, and relay real map data through Node.

**The list stayed, and became honest.** `PlacesList` was the map for the whole
life of this app. It is now a *view* of the same Living Map model, reachable
from a Map/List switch, kept because it works when the map will not, because it
is the better surface for a screen reader, and because browsing without a map is
a real way to use this app.

**What is verified, and what is not.**

- **Web** — all 42 routes render in real Chromium against a real production
  export, with the map drawing its places and carrying its attribution.
- **Android** — a full release APK built green on `ec8cbef`, run
  `31568939140`. `expo prebuild` applied the MapLibre plugin, Gradle compiled
  MapLibre's native SDK, and the artifact uploaded. Twenty-one minutes of
  Gradle, against roughly six before, because the native map SDK is a cold
  first-time compile.
- **iOS** — configured by the same plugin and NOT compiled. No Mac, no Apple
  signing, no EAS login here. One build command away, not a day away.

**`main2.0` is deliberately still on the pre-map snapshot** (`f1f436b`). That is
a clean rollback point while the new map has not been opened on a phone. Fast
forward it once it has.

### Packet 18 — Link-ups start on the map

Create a Link-up from where you are on the map. Depends on Packet 6 — and now
on Packet 21, because until that lands there is no map to start one from.

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

**Finished, and the second half was the half that mattered.**

The first run took 1108 colours onto the tokens and left the five map surfaces
alone, because Packet 21 was about to rebuild them. Packet 21 landed, so the
skip list is gone and `components/PlacesList.js` — the list half of the Living
Map — went through with everything else: 399 more colours, mostly the short hex
(`#ccc`) and the colour words (`white`) the first version of the tool could not
see.

**What the second run actually found.** Those colour words were not a tidiness
problem. The first pass mapped `color:"white"` to `INK.ink` — right for a
paragraph on a pale screen, wrong for the label on a blue button, which is what
nearly all of them were. Ink on `ink-blue` is 2.77:1 against the 4.5:1 a person
needs. **Every filled button in the app shipped with a label you could barely
read**, plus a handful that were literally invisible: `INK.blue` text on an
`INK.blue` pill in the feed, `INK.green` on `INK.green` in Settings and on the
profile.

186 pairs were repaired by the tool and 8 by hand. The tool learned four things
it had been getting wrong, each of which had produced a wrong answer somewhere:

- **Which way up the file is.** Fourteen files were always light-themed. Running
  the dark rules over them turned the *selected* filter chip into the same
  colour as the unselected ones beside it.
- **What is behind a piece of text.** `scripts/style-pairs.cjs` walks the JSX
  and finds the innermost element that paints a ground — a style array is a
  stack, `cond && styles.x` is a state of it, and `cond ? a : b` is one decision
  with two outcomes, not two grounds.
- **How to measure contrast.** It was using a flat brightness average where WCAG
  wants gamma-corrected channels, and the difference was enough to leave every
  green badge alone.
- **When to shut up.** A rewrite that does not land is not a repair, and one
  label on two grounds with no colour readable on both is a design decision, not
  something to guess at. Both are reported now instead of counted.

**The state variants changed shape.** A row that filled itself blue to say
"this one is yours" — the leaderboard, the Link-up board, the profile score
pills — now marks itself with a 2px coloured border and keeps the light fill.
Filling meant every label inside had to change with it, and the ones that were
missed became unreadable.

**Done means, and this is now checked rather than asserted:**
`node scripts/verify-contrast.cjs` reads the real hex out of `utils/tokens.js`,
works out the ground behind all 1041 text/background pairs in `app/` and
`components/`, and fails under 4.5:1 (3:1 for large text). It runs in CI on
every push. `node scripts/riso-pass.cjs --check` reports 0 colours and 0 pairs
left to repair, and running it again changes nothing.

`docs/design-system.md`'s accessibility floor said "ink on all three inks passes
contrast". It does not, and that sentence is what licensed the damage. It has
been replaced with the measured table.

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

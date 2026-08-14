# Screen inventory

What is actually in `app/`. This describes the code. It does not describe the
brief, and where the two disagree the code is what is written down.

**76 routes** across **77 route files** (`app/` holds 78 `.js` files;
`_layout.js` is not a route, and `app/map.js` + `app/map.web.js` are one route).

## ⚠️ How much of this was re-read, and when

Most of this document was written by reading every route file at commit
`36535e9`. It has **not** been re-read wholesale since. What HAS been re-read
and rewritten is listed in **§0 What changed since `36535e9`** below, and those
sections are marked.

Saying which parts are current is the only thing that makes the rest usable. A
document that claims to describe the code and quietly stopped is worse than one
that says where it stopped — and this one had drifted far enough to still
describe a header that no longer exists.

---

## 0. What changed since `36535e9`

Everything in this section was read from the code and is current.

**Deleted**

- `components/PlaceCards.js` — the swipeable "1 of 8 nearby" sheet. Replaced by
  `components/PlacePanel.js`, one panel for the place that was tapped, with
  Directions inside it.

**New route files**

- `app/legal/privacy.js`, `app/legal/terms.js` — both stores require them.
  Text in `utils/legal.js`, drafted from the schema and marked as a draft.

**New shared components**

- `components/MapControls.js` — the map's search and filters, behind two icon
  chips. The map opens clean.
- `components/PlacePanel.js` — hero image, name, type, review score, summary,
  and `Directions` inline.
- `components/DiscoverCard.js` / `components/DiscoverCarousel.js` — Discover's
  sections are sideways now, not forty-two stacked boxes.
- `components/AddLocation.js` — "This spot" (~100m) or "My area only" (~1km),
  shared by Moment and Memory creation. Neither is on by default.
- `components/SocialImage.js` — every picture from a private bucket. Signs the
  URL; falls back to the stored value.
- `components/LegalScreen.js` — the shape both legal screens share.

**Screens whose behaviour changed materially**

- `app/settings.js` — gained account deletion (typed `DELETE`), push
  notification switches (all off), and links to the two legal screens.
- `app/camera.js` — press for a photo, **hold to record** up to 15 seconds with
  sound. QR scanning is on throughout and off only while recording.
- `app/discover.js` — a search bar over businesses, stays and clubs; a "See on
  the map" button; carousels instead of lists.
- `app/moments/create.js`, `app/memories/create.js` — both take a video from the
  camera, and both offer the shared location control. A Memory had no location
  handling at all before.
- The map (`components/LivingMapScreen.js` and the two renderers) — see §1.

---

---

## 1. Navigation configuration

### `app/_layout.js`

A single Expo Router `Stack` with `initialRouteName: "index"`. Every route is
declared explicitly as a `<Stack.Screen>`; there is no `(tabs)` group and no
nested layout file anywhere in `app/`.

Wrapper order, outermost first:

1. `SafeAreaProvider`
2. `ErrorBoundary`
3. `FeedbackProvider`
4. `NotificationProvider`
5. `DrawerProvider`
6. `View` → `Stack`, then `TabBar`, then `QuickAccessDrawer` as siblings

`screenOptions={{headerShown:true, header:()=> <Header/>}}` — every screen gets
the custom header except `index`, which sets `headerShown:false`.

The `TabBar` sits **below** the `Stack`, not around it, so it survives every
push rather than only appearing on five tab roots.

### `components/Header.js` — re-read, current

**Not a bar, and not inside the navigator.** It used to be a 60px card-coloured
strip with a 2px border, supplied to the `Stack` as `header:()=> <Header/>`,
which reserved its height on every screen. It is now one absolutely positioned
layer rendered over the stack in `app/_layout.js`.

Three floating controls, each in its own bordered chip on card so it stays
readable over a map tile or a photograph:

- **Back** (`←`, "Go back") — **only on a child page**. Never on the five tab
  roots or `/`; see `isRootScreen()` in `utils/navigation.js`. On web uses
  `window.history.back()` when `history.length>1`, else `router.replace("/")`.
  On native uses `router.canGoBack()`, else `router.replace("/")`.
- **Bell** (`🔔`, "Open notifications") → `/notifications`, with an ink count
  badge when `unreadCount>0`, capped at `99+`.
- **Hamburger** (`☰`, "Open quick access") → opens the drawer. On every screen.

There is **no title and no Log in button**. The product name was the literal
string `Guestbook`; it is gone. Log in and Create account live together in
`components/FloatingLogin.js`, at the bottom where a thumb reaches.

Space is reserved only on screens the header does not float over —
`headerFloatsOver()` in `utils/navigation.js` lists `/map` and `/camera`. Both
of those clear the chips themselves through `useHeaderClearance()`.

### `components/TabBar.js` + `utils/navigation.js`

Five tabs, in this order, from `TABS`:

| Label | Route | Glyph | Notes |
|---|---|---|---|
| Map | `/map` | map | |
| Discover | `/discover` | compass | |
| Create | `/create` | plus | `raised:true` — drawn outside the bar, above it |
| Leaderboard | `/leaderboards` | trophy | |
| Profile | `/profile` | person | |

Active state is carried by a 3px bar, icon colour and bold label, plus
`accessibilityState={{selected}}`.

`FULL_SCREEN_ROUTES=["/scan"]` — the tab bar is hidden on `/scan` and nowhere
else. `activeTabKey` lights a tab for any path that starts with the tab route
plus `/`, so detail screens keep their tab lit.

### `components/QuickAccessDrawer.js` + `utils/drawer.js`

A right-hand `Modal` sheet, 86% wide / max 380px, `animationType="slide"`
(`"none"` when reduce-motion is on). Contents: title **"Quick access"**, a close
`×`, an optional notice, then the sections below.

Gates are evaluated against `{signedIn, isManager, isAdmin}`, where `isAdmin`
comes from `profiles.is_admin` and `isManager` from the
`manages_any_listing()` RPC. **An unknown gate shows the row** — the drawer
fails open by design, and shows a notice when either lookup fails.

| Section | Row | Route | Gate |
|---|---|---|---|
| Explore | Map | `/map` | always |
| | Discover | `/discover` | always |
| | Live nearby | `/live` | signed in |
| | Events | `/events` | always |
| | Activity clubs | `/activity-clubs` | always |
| | Public places | `/places` | always |
| | Link-ups | `/linkups` | signed in |
| Community | Explorer feed | `/feed` | signed in |
| | Find Explorers | `/explorers` | signed in |
| | Leaderboards | `/leaderboards` | always |
| | Notifications | `/notifications` | signed in |
| My app | Profile | `/profile` | signed in |
| | Check in | `/checkins/create` | signed in |
| | Keep a memory | `/memories/create` | signed in |
| | Scan a review code | `/scan` | signed in |
| | Manager tools | `/manager/dashboard` | **non-manager** |
| Manage | Manager dashboard | `/manager/dashboard` | manager |
| *(section gated on manager)* | Club join requests | `/manager/requests` | manager |
| | Business dashboard | `/business/dashboard` | manager |
| | Property dashboard | `/property/dashboard` | manager |
| Account and safety | Settings | `/settings` | signed in |
| | Blocked Explorers | `/safety/blocked` | signed in |
| | Admin dashboard | `/admin/dashboard` | admin |
| | Listing catalogue | `/admin/listings` | admin |
| | Claims & Manager access | `/admin/claims` | admin |
| | Manage activities | `/admin/activities` | admin |
| | Review reports | `/admin/moderation` | admin |
| | Explorer directory | `/admin/explorers` | admin |
| | Areas & data quality | `/admin/areas` | admin |
| | Audit history | `/admin/audit` | admin |
| | Manage public places | `/admin/public-places` | admin |
| | Log in | `/auth/login` | signed out |
| | Create account | `/auth/signup` | signed out |
| | Log out | *(action, not a route)* | signed in |

### Where gating is actually enforced

- **Admin** — `hooks/useAdminGate.js`, used by all nine `app/admin/*` screens.
  Each renders "Checking admin access…" then "Admin access required".
- **Manager** — `hooks/useManagerGate.js`, used by exactly three screens:
  `app/business/dashboard.js`, `app/property/dashboard.js`,
  `app/manager/requests.js`. It calls `manages_any_listing()`. Deliberately
  **not** used on `/manager/dashboard`, because that screen is where an
  Explorer requests the capability in the first place.
- **Explorer account type** — 12 files check `account_type!=="explorer"`:
  `activity-clubs/[id]`, `checkins/create`, `connections/[id]`, `events/[id]`,
  `feed`, `linkups/create`, `linkups/index`, `live`, `moments/create`,
  `qr/[code]`, `components/ExplorerProfileScreen`, `components/ExplorerReviewForm`.
- **Signed in** — 32 screens call `router.replace("/auth/login")` when there is
  no session.
- **Ownership** — checked per screen against `owner_id` / `manager_id` /
  `creator_id` / `user_id`.

---

## 2. Screens

### 2.1 Entry and tab roots

---

#### `/` — `app/index.js`

**Reached by** app launch; `Header` back button falls back here; log out
redirects here.

**Elements, top to bottom**
1. Title **"Guestbook"** (44px, white on `#19191b`)
2. Subtitle "Discover local places, stays and experiences."
3. *(signed in only)* **🔔 Notifications** button with unread badge
4. **🎉 Explore Events** button
5. **🗺️ Explore Map** button
6. *(signed in)* **☰ Quick access** button — opens the drawer
   *(signed out)* a row of two: **Log in** | **Create account**
7. *(admin only)* **⚙️ Admin Dashboard** button

**Actions** → `/notifications`, `/events`, `/map`, drawer, `/auth/login`,
`/auth/signup`, `/admin/dashboard`.

**States** — full-screen `ActivityIndicator` while checking the session. No
error state: if the `profiles` read fails, `isAdmin` is simply false.

**Gating** — Explorer/signed-out both render; the admin button is the only
conditional destination. This is the only screen with `headerShown:false`.

---

#### `/map` — `app/map.js` (native) / `app/map.web.js` (web) — re-read, current

**Reached by** Map tab, drawer → Map, `/` → Explore Map, and `/map?lat=&lng=`
from a Discover card's "See on the map".

Two files serve one route via Metro's platform extension, and **both are now
eight lines that render `<LivingMapScreen/>`**. Everything below is that screen
and the two renderers it resolves to.

There is **no Google Maps key anywhere**. MapLibre and OpenFreeMap need none,
which is the whole reason for the stack; `react-native-maps` is gone and a gate
fails on any file that imports it.

**On screen**

1. `components/MapControls.js` — two chips under the floating header. A
   magnifier opens the search field; a sliders icon opens the filters. **Both
   closed to start with, both toggle shut, only one open at a time.** A filter
   left on shows as a badge so the map never quietly hides two thirds of itself.
2. Inside the filter panel, three headings rather than one row of fifteen chips:
   - **What** — All · Businesses · Properties · Activity Clubs · **Events**
   - **When** — Happening, then Now · Tonight · Weekend
   - **Layers** — Posts · Busy · Memories
3. The map, full bleed. The header floats over it.

**Map layers**, in draw order:

- **Heat** — a real MapLibre `heatmap` layer, not circles. Built from
  `get_moment_heat()`: **public Moments only**, weighted by attention on a log
  curve, coloured through `HEAT_RAMP`, and faded out as you zoom in.
- **Route** — a line layer, when Directions has one.
- **Clusters** — pins that would overlap become one circle with a count
  (`utils/mapClusters.js`). Tapping one flies the camera in. The live layer is
  deliberately not clustered.
- **Places**, **live activity**, then **Moment/Memory pins**.
- **Bubbles last**, above every pin.

**What the zoom decides** (`utils/mapZoom.js`) — one bubble at county zoom, two
at town, three in a street, and the rotation slows from 4.2s to 9s as you go
out. Clustering is on below street level. A bubble may only attach to a pin
drawn **on its own**, which is what stops one hanging over a heap of pins.

**Memories mode** — the whole map becomes a history. Only Memories are
openable; places stay drawn at 25% and are not tappable; no clusters and no
bubbles. The slider runs from the oldest Memory to the **newest**, with
headroom at both ends.

**Actions** — tapping a pin opens `components/PlacePanel.js` (hero image, name,
type, review score, summary, Directions inline). Tapping a live pin does
`router.push(item.deepLink)`. Tapping open map while Busy is on reveals the
Moments in that patch. Press and hold drops a Link-up point.

**States** — a renderer that cannot run reports through `onUnavailable` and the
screen shows `PlacesList` with a sentence saying why.

**Gating** — none for the static pins. `get_live_discovery` and
`get_moment_heat` are not called at all when signed out.

---

#### `components/PlacesList.js` — the surface when the map cannot run

**No longer "the list that is the map today".** The map runs on every platform
now. This renders when a renderer reports it cannot start — no WebGL, a dead
tile host, a style that will not load — and it is still the better surface for
a screen reader.

The **List button has gone from the map's filter row**: browsing places is
Discover's job. Tapping a row here opens the same `components/PlacePanel.js`
the map opens, so the two surfaces cannot grow two ideas of what a place is.

**Elements**
1. `header` prop (the `🗺️ Guestbook Map` title)
2. Search input
3. Type filter row: All · Businesses · Properties · Activity Clubs
4. **`Happening`** section heading — deliberately first, above the business list
5. Time window row: **Now · Tonight · Weekend**
6. Live activity rows (marker + title + state sentence + subtitle), **or** a
   single card with a per-window instruction:
   - now → "Nothing is happening this minute. Check in somewhere or start a Link-up to change that."
   - tonight → "Nothing is on tonight yet. Start a Link-up and it will show here."
   - weekend → "The weekend is open. Create an Event or a Link-up to put something on it."
7. **Businesses** section — name, classification label, address
8. **Properties** section — name, host, address
9. **Activity Clubs** section — name, `category · status`, address

**Actions** — a live row pushes its `deepLink`; a place row opens the
`PlaceCards` modal, which opens the full page.

**States** — no loading state, no error state, no empty state for the three
place sections (they simply render a heading and nothing).

---

#### `/discover` — `app/discover.js`

**Reached by** Discover tab, drawer → Discover.

**Elements**
1. Title **"Discover"**
2. *(when the profile has an area)* "What is on around {area}."
3. *(on live-read failure)* notice: "Live activity could not be loaded, so Happening now may be incomplete."
4. Then each section from `SECTIONS` in `utils/discover.js`, each with a title,
   a count, and up to 6 cards or an empty instruction. Sections are
   `for-you`, `happening-now`, `events`, `clubs`, `linkups`, `saved`.
5. A final fixed card: **"Explorer feed"** / "What the Explorers you follow have been doing."

**Every card shows a reason line.** Items pass through `recommend()`, which
drops anything with no computable reason, so the reason is never blank.

**Actions** → `item.route` (built per section: `/events/{id}`,
`/activity-clubs/{id}`, `/linkups/{id}`, `get_live_discovery`'s `deep_link`, or
`savedRoute()` for favourites), and `/feed`.

**States** — full-screen spinner on first load; `RefreshControl`; per-section
empty text; a notice band for a failed live read. **Signed out renders an empty
`items` object**, so every section shows its empty state.

---

#### `/create` — `app/create.js`

**Reached by** the raised centre tab only.

A launcher. Builds nothing itself; every row opens an existing screen.

**Elements (signed in)**
1. Title **"Create"**
2. Section **"Share where you are"** — five cards:
   Check in somewhere → `/checkins/create` · Start a link-up → `/linkups/create` ·
   Post a moment → `/moments/create` · Keep a memory → `/memories/create` ·
   Leave a verified review → `/scan`
3. Section **"Add something to the map"** — four cards:
   Add a business → `/business/add` · Add a property → `/property/add` ·
   Start an activity club → `/activity-clubs/add` · Add an event → `/events/add`

**Elements (signed out)** — title, an explanation, then **Log in** and
**Create an account** cards.

**States** — spinner while resolving the session. No error state.

---

#### `/profile` — `app/profile.js` · `/profile/[id]` — `app/profile/[id].js`

Both are thin wrappers. `/profile` renders `ProfileSocialBar ownProfile` +
`ExplorerProfileScreen ownProfile`. `/profile/[id]` renders `ProfileSocialBar` +
**`ProfileSafetyActions`** + `ExplorerProfileScreen profileId`.

**`components/ProfileSocialBar.js`** — Followers / Following / Moments counts
from `get_explorer_follow_counts`; Followers and Following push
`/connections/{id}` with a `tab` param; a **Find Explorers** link → `/explorers`.

**`components/ProfileSafetyActions.js`** — on other people's profiles only:
"Safety options", a report-reason picker, **Submit report**
(`report_live_safety`), and a block control writing `user_blocks`.

##### `components/ExplorerProfileScreen.js` — the body of both profile routes

**Elements, top to bottom**
1. **Profile card**
   - Three figures in a row, each with its own spoken label:
     **AVG SCORE GIVEN** (`stats.average_rating_given`, 1dp) ·
     **REVIEW POINTS** (`stats.total_points`) ·
     **REVIEW REPUTATION** (`reputation.total_endorsements`)
   - Avatar (112px; falls back to the first letter of the name)
   - Name
   - *(if `show_area` and `area`)* `📍 {area}`
   - Bio
   - *(owner only)* **Edit profile** → `/profile/edit` · **＋ New Moment** → `/moments/create`
2. **Stats grid** — Reviews · Verified · Videos · Moments
3. **Monthly leaderboard card** — "See where this Explorer ranks", Local #n /
   National #n (or `—`) → `/leaderboards`
4. *(if reputation exists)* **Review reputation card** — endorsement count,
   "Reviews found useful", "Avg. per review", and the most useful review
5. **Scrapbook tab row**: Adventures · Reviews · **My Map** *(owner only)* ·
   Collections · Clubs
6. The selected tab's body:
   - **Adventures** — "Memories" horizontal row → `/memories/{id}`; *(owner)*
     "＋ Share a new Moment"; a two-column Moment grid → `/moments/{id}`
   - **Reviews** — "Review gallery" horizontal image row; a sort row
     (Recent · Highest · Lowest); review cards with stars, title, comment,
     `✓ VERIFIED ON-SITE REVIEW`, photos, an "Open video review" button, an
     `EndorseButton` and a Comments link; then a "Video reviews" section
   - **My Map** — `components/MyMap.js`, mounted only when `isOwner`
   - **Collections** — "Favourite places" horizontal row (public favourites only)
   - **Clubs** — approved `activity_memberships` only → `/activity-clubs/{id}`
7. *(owner only)* **Logout**

**States**
- Loading spinner.
- **A 15-second timeout.** `loadProfile` races `loadProfileInner()` against a
  `LOAD_TIMEOUT_MS=15000` rejection, and `setLoading(false)` runs in `finally`,
  so the screen always leaves the loading state. On failure it shows
  **"Profile unavailable" / "This profile could not be loaded." / Try again**.
- The Clubs query is wrapped in its own `try`/`catch`, so one failing tab
  cannot cost the whole profile.
- Per-tab empty cards, with different copy for the owner and a visitor.
- A **separate manager-account branch**: if `account_type!=="explorer"` the
  screen renders a stripped card with a `MANAGER ACCOUNT` badge, Edit Profile,
  Open Manager Dashboard and Logout — no scrapbook, no figures.

**Gating** — My Map is `ownerOnly` in `SCRAPBOOK_TABS`, so a visitor is not
offered the tab at all; `MyMap` re-checks `ownerId===viewerId`, and
`get_explorer_memories` is SECURITY INVOKER.

---

#### `/leaderboards` — `app/leaderboards.js`

**Reached by** the Leaderboard tab, drawer, the profile rank card.

**Elements**
1. Eyebrow "EXPLORER RANKINGS", title **"Leaderboards"**, subtitle noting test
   accounts are excluded
2. Period tabs: **Weekly · Monthly**
3. Scope tabs: **Local · National**
4. *(local, with a public area)* an area pill `📍 {area}`
5. **"WHERE YOU STAND" card** — `#rank` plus "{n} points · {n} reviews this
   week/month", or `—` with either "Publish a review of somewhere you went and
   you will appear here." or, when opted out, "You have opted out of
   leaderboards…". Derived from the rows already fetched; **no second query**,
   and it never invents a position for somebody outside the window.
6. The list — rank circle (top 3 highlighted), avatar, name (`· You` for the
   viewer), `{area} · {n} reviews`, `{n} verified · {n} videos`, points
7. **"How points work"** card: text 1 · image 3 · video 6 · verified QR +3, and
   the one-per-place-per-month note

**Actions** — a row pushes `/profile/{user_id}`; the notice card pushes
`/profile/edit`.

**States** — spinner; error card; "No points yet" when the period is empty; and
a distinct **"Add a public area to join local rankings"** notice when the scope
is Local but the viewer has no public area.

**Gating** — redirects to `/auth/login` when signed out.

---

### 2.2 Place pages

Five routes share `components/PlaceLayout.js`. The layout's own sections, in
order: photo strip (or `photosEmptyLabel`), title card (name, type label,
verification label, description, info rows, stats row, favourite/follow slot),
`beforeActions` slot, **Actions** section, `beforeReviews` slot, **Reviews**
section, `afterReviews` slot, **Similar nearby** section, footnote. Plus a
full-screen photo `Modal`.

`PlaceLayout` renders `loadingLabel` with a spinner, or `error` as centred text.
`showPhotos` and `showReviews` are capability flags, so a page without reviews
**omits the section rather than emptying it**.

Deliberately absent from the layout: Directions, Book a table, Get tickets.

---

#### `/business/[id]` — `app/business/[id].js`

**Reached by** `PlacesList` / map cards, `/business/dashboard`,
`/manager/dashboard`, and its own "Similar nearby".

Reads `businesses` and the legacy `reviews` table
(`moderation_status='published'`).

- **Type label** — `typeLabelForBusiness()`, the same function the map pin uses
- **Verification** — `✓ VERIFIED BUSINESS` when `owner_id` is set
- **Info** — ADDRESS, OPENING HOURS
- **Rating** — average of the reviews, count, plus `FavouriteButton` and
  `EntityFollowButton`
- **Owner action** — an **Edit** button → `/business/edit/{id}`
- **Actions** — 📞 Call (`tel:`) · 🌐 Website (both only when present) ·
  **⭐ Leave a Business Review** → `/business/review/{id}` · `ClaimButton` when
  signed in and unclaimed
- **Similar nearby** — up to 4, same `category`, ordered by `nearestFirst`

**States** — "Loading business...", "This business could not be loaded.",
reviews empty → "No reviews yet" / "Be the first to share your experience."

---

#### `/property/[id]` — `app/property/[id].js`

Same shape. Type label `PROPERTY_TYPE_LABEL`; verification `✓ VERIFIED
PROPERTY`; info rows HOST and ADDRESS. Actions: **Open Booking Page** (when
`booking_url` is set) · **⭐ Leave a Property Review** · *(owner)* **Open
Printable Verified-Review QR** → `/manager/qr/property/{id}` · `ClaimButton`.
"Other stays nearby". A footnote states the on-site QR is only on the manager's
printable sign and is not shown publicly.

---

#### `/activity-clubs/[id]` — `app/activity-clubs/[id].js`

Reads `activity_clubs`, `activity_sessions` (future only),
`activity_announcements`, `activity_club_reviews`, `activity_club_stats`, and
the viewer's `activity_memberships` row.

- **Type label** `CLUB_TYPE_LABEL`; info rows WHAT / WHERE / COST
- **Stats** — members · spaces left · review score (replacing the default pair)
- **`beforeReviews`** carries the membership state machine, one card per state
  rather than one merged status card:
  - *(manager)* **Open Manager Dashboard**
  - *(can apply, not full)* "Request to join" / "Apply again" + an optional
    note field + **Send Join Request**
  - *(can apply, full)* "Club currently full"
  - *pending* → `PENDING APPROVAL` / "Application submitted" + sent date + the
    submitted message
  - *approved* → `MEMBERSHIP APPROVED` / "You're a member"
  - *rejected* → "Application not approved"
  - *removed* → `MEMBERSHIP ENDED` / "Membership ended"
  - *(manager or approved)* **Open Members' Message Board**
  - *(approved/left/removed)* **⭐ Leave an Activity Club Review**
  - **Upcoming sessions** — title, date, capacity, or "No sessions are
    scheduled yet…"
  - **Club announcements** — or "Nothing announced yet…"
- Review rows are normalised (`reviewer_name` → `name`) so one review card
  serves every place type

**Blocking `Alert`s** — not an Explorer account, club full, or no membership,
each explaining why the action is refused.

---

#### `/events/[id]` — `app/events/[id].js`

Info rows WHAT / WHEN / WHERE / PRICE / CAPACITY. `event_reviews` normalised
the same way.

The review button is **state, not a disabled control**: before `starts_at` it
reads **🔒 Reviews unlock when the event starts** and stays pressable,
explaining itself via an `Alert`; after, **⭐ Leave an Event Review**.

*(manager)* a "Manager controls" box with **Edit event** and **Dashboard**, and
the event's status as the verification label.

---

#### `/places/[id]` — `app/places/[id].js`

Public places (parks, beaches, viewpoints). `showReviews={false}` — there is no
`public_place_reviews` table, so the section is omitted rather than emptied.

Info rows AREA and WHERE TO FIND IT. `beforeActions` holds two
`EntityFollowButton`s — the place and its `geo_area`. Action: **Post a Moment
here** → `/moments/create?target_type=public_place&target_id={id}`.
`afterReviews` holds a **"Moments here"** grid (RLS decides which are visible)
or "No Moments here yet". Footnote explains nobody posts as the place itself.

---

#### `/linkups/[id]` — `app/linkups/[id].js`

`showPhotos={false}` and `showReviews={false}` — a Link-up has neither, and
there is no `linkup_reviews` table.

Info rows WHAT / WHEN / WHERE; stats `{joined}/{max}` and Public/Followers.
`beforeActions` holds an **ORGANISED BY** card → `/profile/{creator_id}`, and —
only when `joined` — an **ATTENDEE MEETING DETAILS** card from
`linkup_private_details`. That check is a second lock; RLS already returns no
row to a non-member.

**Actions** — Join Link-up · Leave Link-up · 💬 Open private board →
`/linkups/board/{id}` · *(owner)* Edit Link-up · *(owner)* Cancel Link-up with
an inline "Cancel this Link-up?" confirmation.

**`beforeReviews`** — an **Attendees** list (each → `/profile/{id}`, with
*Remove* for the owner), then **Report Link-up** and **Block organiser** for
non-owners, and a six-reason report panel. Report and block sit at the end of
the page and are never behind a menu.

---

### 2.3 Discovery lists

| Route | File | Reached by | Shape |
|---|---|---|---|
| `/events` | `app/events/index.js` | drawer, `/`, admin listings | Purple hero "WHAT'S ON / Upcoming Events", search, cards (category, price, name, 📅 date, 📍 location, description, capacity, "View event →"). Only `status='published'` and `starts_at >= now`. Spinner; "Events unavailable" + **Try again**; "No upcoming events found". |
| `/activity-clubs` | `app/activity-clubs/index.js` | drawer, admin listings | Title, subtitle, search, cards (category badge, Open/Full, name, 📍 location, description, 👥 members / ⭐ rating / price, "View club profile →"). Only `status in ('open','full')`. Spinner; a **"Supabase setup required"** notice on error; "No clubs found". |
| `/places` | `app/places/index.js` | drawer, admin listings | Riso. Title "Public places", subtitle, search, a type chip row from `PUBLIC_PLACE_TYPES` plus **All**, then cards (name, type · area, location description). Spinner "Loading public places…"; error card; empty state explaining public places are added by the team. |
| `/explorers` | `app/explorers.js` | drawer, feed, connections, social bar | "EXPLORER COMMUNITY / Find Explorers", search by name or area, cards (avatar, name, 📍 area, 2-line bio) + a `FollowButton`, then a result count. Excludes the viewer, non-Explorers and admins. Spinner; "Could not load Explorers"; "No Explorers found". |
| `/linkups` | `app/linkups/index.js` | drawer, `/linkups/[id]` | Hero "MEET LOCALLY / Link-ups" + **＋ Create Link-up**; tabs **Discover · Joined · Created**; cards (category pill, status pill, title, when + countdown, 📍 place, description, creator, `n/max joined`, "Followers only"); a trailing **📡 Open Live Nearby**. Spinner; error card; per-tab empty card. Explorer-only. |
| `/live` | `app/live.js` | drawer, `/linkups`, after a check-in | See below. |

---

#### `/live` — `app/live.js`

**Elements**
1. Hero "HAPPENING NEARBY / Live Nearby" with **Create Link-up** and **Check in**
2. *(on error)* an error card
3. *(when checked in)* a **"YOU ARE CHECKED IN"** card — place, activity,
   expiry, and an **End** action (`end_live_checkin`)
4. A filters card: **Area** text input + **Apply**; **Use approximate
   location** (Expo Location, rounded to 2dp); **Distance** chips 5/15/25/50 km;
   **Time window** chips 6h/Today/3 days/7 days
5. A horizontal type tab row: All · Link-ups · People · Events · Activities · Places
6. Result cards — icon, item type, title, distance, subtitle, 📍 area, time, an
   **open** button using the row's own `action_label` and `deep_link`, and a
   **Report** link on check-ins (`report_live_safety`)

**States** — full-screen spinner; `RefreshControl`; error card; empty card
"Nothing live in this view / Widen the area or time filters, or create the first
Link-up."

**Gating** — signed in, and `account_type==='explorer'`; otherwise "Only
Explorer accounts can use Live Nearby." Calls `refresh_live_system` before
reading.

---

### 2.4 Social

#### `/feed` — `app/feed.js`

**Elements**
1. "YOUR EXPLORER COMMUNITY / Feed" + subtitle
2. Quick actions: **＋ New Moment** → `/moments/create`, **Find Explorers** → `/explorers`
3. Feed cards from `get_explorer_social_feed` (limit 40), each with:
   - actor row (avatar, name, "shared a Moment" / "posted a review" / "saved a
     favourite" + relative time) → `/profile/{actor_id}`
   - **reason pills** from `reasonsFor(item)` — rendered only when the list is
     non-empty, which is the case until the 8f2 migration is applied
   - caption, star rating, a `📍 target` pill, image or video poster
   - `✓ Verified on-site review`
   - action row: `LikeButton` (Moments) or `EndorseButton` (reviews), a 💬
     comment count, and **Open place**

**States** — spinner; `RefreshControl`; "Feed unavailable" with the error; and
an empty card "Build your Explorer feed" + **Find Explorers**.

**Gating** — redirects to login; non-Explorer accounts get "The Explorer feed is
available to Explorer accounts."

---

#### `/moments/[id]` — `app/moments/[id].js`

Author row (→ profile) with a `FRIENDS` badge when `visibility==='friends'`; for
an official Moment the listing name comes first and "Official update · {date}"
below. Then the media (image, or a video poster that opens the URL), caption, an
**ATTACHED PLACE** card → the listing, and an action row: `LikeButton`,
**Report** (non-owner) or **Delete** (owner). Inline report and delete
confirmation panels. Finally `CommentThread`.

**States** — spinner; "Moment unavailable". Deleting also removes the storage
object and redirects to `/feed`.

---

#### `/social-comments/[id]` — `app/social-comments/[id].js`

Video reviews only. Author row, video poster, stars, title, comment,
`✓ Verified on-site review`, a **REVIEWED PLACE** card, an `EndorseButton`, then
`CommentThread`. Errors: "This video review is unavailable." or "Comments are
only available for published video reviews."

#### `components/CommentThread.js`

"Comments" heading, a composer with **Post**, comment rows (→ profile) with
**Report** / **Delete**, a five-reason report panel, and
"No comments yet. Start the conversation." 500-character limit.

---

#### `/connections/[id]` — `app/connections/[id].js`

**Reached only from `ProfileSocialBar`.** Tabs **Followers** and **Following**
(the initial tab comes from a param), rows with `FollowButton`, and a **Find
Explorers** link. States: spinner, "Connections unavailable", four distinct
error strings. Explorer-only.

---

#### `/notifications` — `app/notifications.js`

**Reached by** the header bell, drawer, `/`, manager screens.

Heading + **Mark all read** (only when something is unread), then a horizontal
category tab row with counts: **All · Live · Social · Clubs · Account**.
Category is derived from the notification `type`/`entity_type`.

Cards carry an emoji icon chosen per type, title, category label, an optional
membership status badge (Needs action / Approved / Rejected / Membership ended /
Left club, prefixed "Past update · " for historical rows), message and relative
time. Unread rows get a distinct background and a dot.

**Actions** — tapping marks read then pushes `deep_link` (unless it is
`/notifications` itself). Subscribes to `postgres_changes` for live updates.

**States** — spinner; per-category empty card; a signed-out state with
**Log in**.

---

### 2.5 Creating things

| Route | File | Reached by | Notes |
|---|---|---|---|
| `/checkins/create` | `app/checkins/create.js` | Create tab, drawer, `/live` | Place-type chips (Park · Public place · Business · Activity club · Event), a searchable canonical place picker, free-text place name + broad area, **Add approximate location** (2dp), activity chips + custom, a 240-char message, duration chips **30m/1h/2h/4h**, and a visibility pair — **Followers (recommended, default)** / Public. A "Location safety" card. Calls `start_live_checkin`, then `router.replace("/live")`. Explorer-only. |
| `/linkups/create` | `app/linkups/create.js` | Create tab, `/linkups`, `/live` | "MAKE A PLAN / Create Link-up" + `LinkupForm` in `titleOnly` mode. Calls `create_linkup`; on success replaces to the new `/linkups/{id}` with "Any blank details were safely marked as to be confirmed." |
| `/linkups/edit/[id]` | `app/linkups/edit/[id].js` | `/linkups/[id]` | "ORGANISER CONTROLS / Edit Link-up". Refuses a non-creator: "Only the organiser can edit this Link-up." |
| `/moments/create` | `app/moments/create.js` | Create tab, feed, profile, `/places/[id]` | "SHARE YOUR DAY / New Moment". Photo or ≤30s video picker with size and duration validation, caption (500), a searchable place attachment, a **Post as** choice (Yourself / officially as the listing, when the viewer manages it), a visibility choice, and **Publish Moment**. Explorer-only. |
| `/memories/create` | `app/memories/create.js` | Create tab, drawer, `MyMap` | Riso. TITLE, NOTE, PHOTO, WHERE (type chips + searchable list), **WHO CAN SEE IT WHILE IT IS LIVE**, **HOW LONG IT STAYS LIVE** (hidden when private), **AFTERWARDS** (archive visibility, which always starts at "Only me"), and a **Show on my profile** switch. On failure the uploaded object is removed again. |
| `/business/add` · `/property/add` · `/activity-clubs/add` · `/events/add` | | Create tab, `/manager/dashboard`, the dashboards | Plain forms using `LocationPicker`, `ClassificationPicker` (business) or `EventFormFields` (event). All replace to `/manager/dashboard` on success, except `/events/add`, which replaces to the new `/events/{id}`. |

#### `components/LinkupForm.js`

Fields in order: Title, Description, Category, Starts, Ends, Area, **Public
meeting place** (with "Use a public place. Never publish a private home
address."), **Exact meeting instructions** (shown only to joined attendees),
optional coordinates with **Remove location**, Maximum attendees ("The organiser
counts as one attendee."), **Who can see this?** (Public / Followers only), and
a Safety note. Six distinct validation messages.

#### `components/ExplorerReviewForm.js`

The body of all four `*/review/[id]` routes, which are 9-line wrappers:
`/business/review/[id]`, `/property/review/[id]`,
`/activity-clubs/review/[id]`, `/events/review/[id]`.

Elements: a per-type subtitle, a **POINTS PREVIEW**, a star Rating, a title
field (required for video), the review body, **Review media** (up to 3 images
and one 30-second video) with **📷 Add image** / **🎥 Add video** / **Remove**,
and a publish button. Calls `verify_explorer_review_qr` when a scanned code is
carried in. Explorer-only, with 13 distinct validation and error messages.

---

### 2.6 Memories

#### `/memories/[id]` — `app/memories/[id].js`

Photo, then a card with the phase label, title, note, an attached-place row, and
**WHO CAN SEE IT NOW**. For the owner only: a "While it is live" card, an
**Afterwards** archive-visibility picker, a **Chosen Explorers** share list
(when either visibility is `selected`), a **Show on my profile** switch, and
**Delete this Memory** behind an `Alert`.

Every write is `.eq("user_id", viewer.id).select(...)` and reports "The database
refused the change." when nothing comes back. Error: "This Memory is
unavailable, or is not shared with you."

#### `components/MyMap.js`

Owner-only. Heading **"My Map"**, the line "Only you can see this map.", the
pins, and a **Keep a Memory** button → `/memories/create`. Empty state: "Keep a
Memory of a place you went and it will appear here on your own map." Error:
"Your map could not be loaded."

Pin drawing is delegated to `components/MemoryPins.js` / `MemoryPins.web.js` —
a platform split, where the `.web.js` file contains no `react-native-maps`
import at all.

---

### 2.7 Manager

#### `/manager/dashboard` — `app/manager/dashboard.js` (734 lines)

**Reached by** the drawer (both the non-manager "Manager tools" row and the
manager section), Settings, the profile manager branch, `GateNotice`, and eight
listing screens.

**Not** behind `useManagerGate` — this is where an Explorer requests the
capability in the first place.

**Elements**
1. "Manager Dashboard" + subtitle
2. **MANAGER ACTION CENTRE** card → `/manager/requests`
3. Four capability sections — Businesses, Properties, Activity Clubs, Events.
   Each has a `CapabilityHeader` with the capability status and a **Request
   access** button when it is not active, and then either the listings or a
   `LockedCard` ("Request this capability to create and manage business
   listings.", "Request this paid capability to create clubs and approve
   explorer members.", etc.)
4. Each listing card shows its details, a **QR block** with `QRCodeGenerator`
   and **Open printable QR** → `/manager/qr/{type}/{id}`, then **Edit** and
   **Public profile** / **View listing**
5. Activity club cards additionally get **Open private message board**, an
   **Approved members** list with a **Remove member** action, and a pointer to
   review decisions in the Action Centre
6. Each section ends with **➕ Add …**

**States** — "Loading manager dashboard...", "Manager capabilities could not be
loaded.", and a per-section empty card ("No businesses yet / Create your first
business listing.").

---

#### `/manager/requests` — `app/manager/requests.js` (668 lines)

Manager-gated. "Manager Action Centre / Review approvals and decisions without
searching through your listings." Handles club membership requests: an
`OPENED FROM NOTIFICATION` banner when arrived via deep link, the
`APPLICATION MESSAGE`, club capacity, "What happens next?", and **Approve** /
**Reject**. States: "Loading pending actions...", "Action Centre unavailable",
"This request is no longer pending", and "All caught up / There are no Activity
Club membership requests waiting for a decision." Links to `/notifications` and
`/manager/dashboard`.

#### `/manager/membership-status/[id]` — `app/manager/membership-status/[id].js`

**No in-app link exists.** It is reached only through a notification
`deep_link`, which is written by a database trigger in
`20260801211500_route_handled_memberships_to_current_status.sql`. Shows the
current membership status, club capacity, "What this means now", and links to
review the request or view members. Refuses: "You do not manage the Activity
Club linked to this membership."

#### `/manager/qr/[type]/[id]` — `app/manager/qr/[type]/[id].js`

A printable sign: "Guestbook", "Scan while you're here to leave a verified
review.", the QR, `✓ VERIFIED VISIT`, the points rules, and **Print Verified
Review QR**. Calls `ensure_listing_qr_code`. Errors: "Unsupported listing
type.", "Please log in to print this QR code.", "This listing could not be
loaded or is not owned by your account."

#### `/business/dashboard` · `/property/dashboard`

**Reached only from the drawer.** Both use `useManagerGate` + `GateNotice`.

Business: per-listing name, classification, **Customer QR Code**
(`QRCodeGenerator`), **View Public Profile**, **Edit Business**, then
**➕ Add Business Listing**. Its only loading signal is a `status` string
initialised to `"Loading..."`.

Property: the same shape with **Guest Review QR Code**, **View Public Profile**,
**Manage Reviews** → `/property/reviews`, **Edit Property**, **➕ Add Property
Listing**.

`app/business/dashboard.js` is written in a one-attribute-per-line style unlike
every other file in `app/`.

#### `/business/reviews` · `/property/reviews`

Both list reviews for listings the viewer claims, with **Business response:** /
**Review challenged** states and a **Manage Review** action →
`/{type}/review-action?id={id}`.

**`/property/reviews` is linked from `/property/dashboard`.
`/business/reviews` is linked from nowhere — see §3.**

#### `/business/review-action` · `/property/review-action`

Reached from the two review lists. A response field and a challenge-reason
field, with **Save Reply** and **Challenge Review**. Both refuse a non-owner:
"Only the owner of this listing can respond to its reviews."

---

### 2.8 Admin

All nine screens are riso-styled, use `useAdminGate`, and share the same
skeleton: an eyebrow, a title, a loading line "Checking admin access…", an
"Admin access required" refusal, a per-screen loading line, a per-screen error
card with **Try again**, then the content.

| Route | Title | Content |
|---|---|---|
| `/admin/dashboard` | Admin overview | "What needs attention" — live counts (pending claims, access requests, businesses, properties, public places, activity clubs, events, open social reports, open safety reports, Explorers, canonical areas, audit records), then eight tool cards linking to every other admin screen, then **Refresh overview**. Error: "One or more database checks failed, so no totals are shown." |
| `/admin/claims` | Claims & Manager access | Two sections — **Listing claims** and **Manager capability requests**. Each row shows EXPLORER, CLAIM NOTE / REQUEST NOTE, a required **DECISION REASON** field, and **Approve** / **Reject**. Calls `admin_decide_claim` and `admin_decide_capability_request`. "Every decision is audited." |
| `/admin/listings` | Find every listing | One search across businesses, properties, public places, activity clubs and events. "No listings match". Error: "One or more listing reads failed, so no partial catalogue is shown." |
| `/admin/activities` | Manage clubs & events | Paged, per-type (Activity clubs / Events), with state filters and a **CHANGE REASON** field. Actions: Publish as open, Reopen, Hide, Close, Publish, Move to draft, Cancel event. Calls `admin_set_activity_state`. |
| `/admin/moderation` | Review reports | Social and safety report tabs, paged. Each shows REPORTED ITEM, PEOPLE, REPORT DETAILS, a **DECISION REASON** field, and **Dismiss**. Calls `admin_get_moderation_queue` and `admin_decide_report`. |
| `/admin/explorers` | Explorer directory | Paged, searchable, with Managers / Admins filters. Rows → `/profile/{id}`. Marks "Administrator account". Reads no private contact fields. |
| `/admin/areas` | Areas & data quality | Four reports: canonical areas, rows without a canonical area, unmatched Place values, ownership issues. Each has an all-clear line ("Every supported row has a canonical area.", "No listing ownership inconsistencies were found."). |
| `/admin/audit` | Audit history | Paged, searchable list of `admin_audit_log` with the **RECORDED REASON**. |
| `/admin/public-places` | Public places | The only admin screen that writes rows directly. Editable NAME, TYPE, AREA, LATITUDE, LONGITUDE ("Rounded to three decimal places, the same precision a check-in is stored at."), WHERE TO FIND IT, DESCRIPTION, IMAGE URL, STATUS, with **Edit** / **Hide** / **Cancel**. Four validation messages. |

---

### 2.9 Auth, settings and safety

#### `/auth/login` — `app/auth/login.js`

Title "Login", subtitle "Continue your Guestbook action", a note that login
returns you to the page you opened, Email and Password inputs, **Login**,
**Forgot password?** → `/auth/forgot-password`, and "Don't have an account?
Create one" → `/auth/signup`.

**It also ships a "Quick test login" panel** — "Tap an account below. No
password typing is needed." — with **Manager**, **Explorer** and **Explorer 2**
buttons, and the note "You can also type m, e, events or e2 in the email box and
tap Login."

Errors: "Incorrect email or password", "Enter your email and password, or use a
quick test login.", "{account} quick login failed. Please tap the button again."

#### `/auth/signup` — `app/auth/signup.js`

Name, Email, Phone number, Password, **Create Account**. Errors: "This email
already has an account", "Please enter a valid email address", "Something went
wrong". Writes `profiles`, including **`account_type`**, and returns early
without writing a profile row when email confirmation is on — which
`/settings` compensates for ("No profile was found for this account.").

#### `/auth/forgot-password` · `/auth/update-password`

Forgot: an email field and **Send reset link**, then a "Check your email"
state with **Send another email** and **Back to login**.

Update: "Checking your reset link...", then either "Reset link unavailable" +
**Request a new link**, or the form (New password / Confirm new password /
**Update and verify password**), then "Password updated and verified" +
**Return to login**. Five distinct error messages. **No in-app screen links to
it** — it is opened from the emailed recovery link.

#### `/profile/edit` — `app/profile/edit.js`

**Choose Profile Photo**, Name, Phone, Bio, **Save Profile**, and an "Area and
privacy" card stating that town, public display and leaderboard visibility "now
live in Settings" → `/settings`.

#### `/settings` — `app/settings.js`

Sections in order: **Profile** (Edit profile link), **Privacy** (area input,
**Display my area** switch, **Appear on leaderboards** switch, **Save privacy
settings**), **Managing places** (a capability card listing Businesses,
Properties, Activity clubs and Events with an active/inactive pill, plus an
**Open manager dashboard** link), **Safety** (Blocked Explorers), **Sign in**
(**Send me a password reset link**, behind an `Alert` warning it signs you out),
and **Account** (**Log out**, behind an `Alert`).

#### `/safety/blocked` — `app/safety/blocked.js`

"SAFETY CONTROLS / Blocked Explorers", an explanation, rows with **Unblock**
(`unblock_explorer`), and the empty state "Nobody blocked / You can block an
organiser from a Link-up or a nearby Explorer from their profile."

---

### 2.10 QR

#### `/scan` — `app/scan.js`

The only route where the tab bar is hidden. A camera scanner with a permission
state ("Camera access is needed" / **Allow camera access**), a `VERIFIED VISIT`
banner, and a **"Testing on one phone?"** fallback: a text field for the code or
link plus **Open verified review**. On a valid code, `router.replace`s to
`/qr/{code}`. Error: "This is not a Guestbook verified-review QR code."

#### `/qr/[code]` — `app/qr/[code].js`

Resolves the code via `resolve_listing_qr_code`, then replaces into the
listing's review route carrying the verification. Shows "ON-SITE GUESTBOOK
SCAN / Verified visit ready". Signed-out users are sent to login with a `next`
param. Four error strings, including "Only Explorer accounts can claim verified
review points."

---

## 3. Orphaned screens

Six routes have **no inbound navigation anywhere** in `app/`, `components/`,
`utils/` or `hooks/`. Each is declared in `app/_layout.js`, so the route exists
and can be typed into a URL bar, but nothing in the app links to it.

| Route | File | Lines | What it is |
|---|---|---|---|
| **`/saved`** | `app/saved.js` | 39 | **ORPHANED.** A stub: the heading "❤️ Saved Places" and the line "Your favourite places will appear here". Reads nothing. The working equivalent is the Collections tab on the profile and the `saved` section on `/discover`. |
| **`/place`** | `app/place.js` | 84 | **ORPHANED.** A hardcoded mock of a single place — "☕ The Coffee House" — with **Leave Review**, **Get Directions** and **Visit Website** buttons. Reads no database. `Get Directions` is a Stage Four surface that exists nowhere else in the app. |
| **`/guest/[id]`** | `app/guest/[id].js` | 178 | **ORPHANED.** A property welcome screen — "Welcome 👋 / Your local Guestbook" — with **🏠 View Property**, a review link and **📍 Explore Local Area** → `/map`. Reads `properties`. Nothing links to it; presumably intended as a QR landing page, but `/qr/[code]` does not route here. |
| **`/business/edit`** | `app/business/edit.js` | 254 | **ORPHANED.** A second business edit form. See §4. |
| **`/property/edit`** | `app/property/edit.js` | 301 | **ORPHANED.** A second property edit form. See §4. |
| **`/business/reviews`** | `app/business/reviews.js` | 269 | **ORPHANED.** A working review-management list — "Customer Reviews", business responses, challenged reviews, **Manage Review** → `/business/review-action`. Its property twin `/property/reviews` **is** linked from `/property/dashboard`; `/business/dashboard` has no equivalent link. |

Two more are reachable but not from any in-app control:

- **`/auth/update-password`** — reached only by opening an emailed recovery link.
- **`/manager/membership-status/[id]`** — reached only via a notification
  `deep_link` written by a database trigger.

---

## 4. Screens that exist in two versions

### 4.1 `/map` — two files, one route

`app/map.js` and `app/map.web.js`. Metro's platform extension means
**`map.web.js` is the file that runs on web**, and it renders `PlacesList` only.
`app/map.js` additionally branches internally on
`EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`, so on native without a key it also renders
`PlacesList`. The `MapView` branch runs only on native with a key set.

The living-map layer (Now/Tonight/Weekend, live pins) is implemented **twice** —
once in `app/map.js` for the `MapView` and once in `components/PlacesList.js`
for the list.

### 4.2 Business and property editing — two forms each

| | Linked-to version | Orphaned version |
|---|---|---|
| Business | `app/business/edit/[id].js` (183 lines) | `app/business/edit.js` (254 lines) |
| Property | `app/property/edit/[id].js` (168 lines) | `app/property/edit.js` (301 lines) |

The `[id]` versions take the listing id from the route, use `LocationPicker`,
`ClassificationPicker` (business) and `utils/coordinates.js`, offer **Delete**,
and replace to `/manager/dashboard`. They are the ones linked from the place
pages, the dashboards and the manager dashboard.

The id-less versions read `claims` to find the listing, have no delete, do not
use `utils/coordinates.js`, and are linked from nowhere.

### 4.3 Profiles — Explorer and manager branches in one component

`components/ExplorerProfileScreen.js` renders two entirely different screens
depending on `profile.account_type`. The Explorer branch is the full scrapbook;
the `!=="explorer"` branch is a short card with a `MANAGER ACCOUNT` badge and
three buttons. Both are live in the same file.

### 4.4 Review tables — two systems behind one card

`components/PlaceLayout.js` renders one `PlaceReview` card, but the rows come
from four different tables with different column names:

- `/business/[id]` and `/property/[id]` read the legacy **`reviews`** table
- `/activity-clubs/[id]` reads **`activity_club_reviews`** (normalised
  `reviewer_name` → `name`)
- `/events/[id]` reads **`event_reviews`** (same normalisation)
- The profile and feed read **`explorer_reviews`**, a fifth shape with its own
  card markup in `ExplorerProfileScreen`

---

## 5. Two design systems

Every one of the 78 route files falls into one of four groups. The split does
not follow feature areas — it runs straight through them.

**Riso** (`utils/tokens.js` `INK.*`: paper `#E7E8E1`, card `#F3F3ED`, ink
`#16181C`, 2px ink borders, 3px hard offset shadows) — **20 files**

`/create`, `/discover`, `/places`, `/places/[id]`, `/business/[id]`,
`/property/[id]`, `/activity-clubs/[id]`, `/events/[id]`, `/linkups/[id]`,
`/memories/create`, `/memories/[id]`, and all nine `/admin/*`.

**Dark purple** (`#18181b` screen, `#222226` cards, `#3212b6` primary) —
**22 files**

`/` (`#19191b`), `/profile`, `/profile/[id]`, `/profile/edit`, `/settings`,
`/feed`, `/explorers`, `/connections/[id]`, `/leaderboards`, `/notifications`,
`/live`, `/linkups`, `/linkups/create`, `/linkups/edit/[id]`,
`/linkups/board/[id]`, `/moments/create`, `/moments/[id]`,
`/social-comments/[id]`, `/checkins/create`, `/safety/blocked`, `/scan`,
`/qr/[code]`.

**Light grey / white** (`#f5f7fb` or `#f5f6f8`, white cards, `#ddd` borders) —
**30 files**

`/map`, `/events`, `/activity-clubs`, all four `/auth/*`, all of
`/manager/*`, both dashboards, every `add` / `edit` form, both `reviews` lists,
both `review-action` screens, `/activity-clubs/message-board/[id]`, `/guest/[id]`,
`/place`.

**No styles of their own** — **6 files**: the four `*/review/[id]` wrappers
(which inherit `ExplorerReviewForm`), `app/map.web.js`, and `app/saved.js`.

### Where the split is most visible

- **The chrome disagrees with itself.** `components/TabBar.js` and
  `components/QuickAccessDrawer.js` use riso `INK` tokens. `components/Header.js`,
  which sits above them on every screen, uses `#ddd` borders and emoji buttons,
  and its title is the literal string **"Guestbook"**.
- **Link-ups are split down the middle.** `/linkups/[id]` is riso via
  `PlaceLayout`; `/linkups`, `/linkups/create`, `/linkups/edit/[id]` and
  `/linkups/board/[id]` are dark purple.
- **Place pages are riso, but the lists that lead to them are not.**
  `/events` and `/activity-clubs` are light grey; `/events/[id]` and
  `/activity-clubs/[id]` are riso.
- **`/places` is the exception** — both the list and the detail page are riso.
- **The map is light grey and its cards are riso.** `app/map.js` and
  `PlacesList` use white cards and `#ddd` borders, while the `PlaceCards` modal
  they open and every place page they lead to use riso.

### Product vocabulary in the code

The user-facing name **"Guestbook"** appears in the header title, the home
screen, `/scan`, `/manager/qr/[type]/[id]`, `/guest/[id]`, `/settings`,
`/places/index`, `/places/[id]` and several error strings in
`ExplorerReviewForm` and `moments/create`. The riso screens generally avoid a
product name; `memories/create` uses **"Xplorer"** in one error message
("The photo picker could not return to Xplorer."), which is the only occurrence
of that name in `app/`.

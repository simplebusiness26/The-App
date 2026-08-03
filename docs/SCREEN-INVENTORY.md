# Screen Inventory

Every route in the app, what renders it, what it does, what you can press, and
what it requires to open.

Compiled by reading `app/_layout.js`, all 66 route files under `app/`, and the
shared components under `components/`. The route graph, the orphan list and the
broken-link list were computed from the source rather than eyeballed: routes were
derived from the `app/` file tree using expo-router's file-based conventions, and
link targets were extracted from every `router.push` / `router.replace` /
`pathname:` / `href=` in `app/` and `components/`, then matched segment by segment.

**Nothing here has been exercised at runtime.** Every Status cell reads UNTESTED
by design — this document records what the code says, not what the app does.

- Commit: `ddd27be`
- Routes: 64 (66 files; `map.js`/`map.web.js` share one route)
- Navigation calls found: 212

## How to read the Auth column

| Value | Meaning in code |
|---|---|
| **Public** | No user lookup. Renders for anyone. |
| **Reads user** | Calls `auth.getUser()` and changes what it shows, but never redirects. Signed-out users still get the screen. |
| **Auth — prompt** | Signed-out users see the screen with a "Log in" call to action, or are pushed to login only when they act. |
| **Auth — redirect** | `router.replace("/auth/login")` on load when there is no session. |
| **+ owner** | Additionally compares the row's `manager_id` / `creator_id` / `user_id` against the current user to decide what renders. |
| **+ manager** | Additionally requires `profiles.account_type === "manager"`. |
| **+ admin** | Additionally requires `profiles.is_admin`. |

Roles come from two fields on `profiles`: `account_type`, set at signup to either
`explorer` or `manager` (`app/auth/signup.js:20-26`), and the separate boolean
`is_admin`.

## The global header

`app/_layout.js` renders `components/Header.js` as the header for **every screen
except `/`**, which sets `headerShown:false` and draws its own. So three controls
exist on nearly every row below and are not repeated in each one:

| Control | Goes to |
|---|---|
| `←` Go back | `router.back()`, falling back to `/` when there is no history |
| `🔔` Notifications (with unread badge) | `/notifications` |
| `☰` Open menu | `/menu` |

---

## Shell

| Route | File | Purpose | Buttons and links | Auth | Status |
|---|---|---|---|---|---|
| `/` | `app/index.js` | Landing screen and entry point; `unstable_settings.initialRouteName`. | `🔔` → `/notifications` · `🎉` Events → `/events` · `🗺️` Map → `/map` · `Open Menu` → `/menu` · `Log in` → `/auth/login` *(signed out only)* · `Create account` → `/auth/signup` *(signed out only)* · `⚙️` → `/admin/dashboard` *(rendered only when `is_admin`)* | Auth — prompt | UNTESTED |
| `/menu` | `app/menu.js` | Primary navigation list; entries are gated by account type. | `🗺 Map` → `/map` · `🏃 Explore Activity Clubs` → `/activity-clubs` · `🎉 Explore Events` → `/events` · `👤 Profile` → `/profile` · `📡 Live Nearby` → `/live` · `🤝 Link-ups` → `/linkups` · `📍 Check in` → `/checkins/create` · `✨ Explorer Feed` → `/feed` · `🧭 Find Explorers` → `/explorers` · `📷 Scan Verified Review QR` → `/scan` · `🏆 Explorer Leaderboards` → `/leaderboards` · `🛡️ Blocked Explorers` → `/safety/blocked` · `📊 Manager Dashboard` → `/manager/dashboard` *(manager only)* · `⚙️ Admin Dashboard` → `/admin/claims` *(admin only)* · `Login` → `/auth/login` · `Create Account` → `/auth/signup` · `Logout` → signs out, then `/` | Auth — prompt | UNTESTED |

---

## Auth

| Route | File | Purpose | Buttons and links | Auth | Status |
|---|---|---|---|---|---|
| `/auth/login` | `app/auth/login.js` | Email/password sign-in; redirects to a `next` destination when supplied. | `Login` → runs `login()`, then `router.replace(destination)` · `Forgot password?` → `/auth/forgot-password` · `Don't have an account? Create one` → `/auth/signup` · `Manager` / `Explorer` / `E2` → `quickLogin()` **test-account shortcuts** | Public | UNTESTED |
| `/auth/signup` | `app/auth/signup.js` | Account creation; choice of Explorer or Manager sets `profiles.account_type`. | Account-type tiles → `setAccountType()` · `Create Account` → `signup()`, then `/auth/login` (or `/` when a session is returned) | Public | UNTESTED |
| `/auth/forgot-password` | `app/auth/forgot-password.js` | Requests a password-reset email. | `Send reset link` → `sendResetEmail()` · `Send another email` → resets the form · `Back to login` → `/auth/login` (both states) | Public | UNTESTED |
| `/auth/update-password` | `app/auth/update-password.js` | Sets a new password from a reset link; validates the recovery session. | `Update and verify password` → `savePassword()` · `Return to login` → `/auth/login` · `Request a new link` → `/auth/forgot-password` | Public (needs a recovery session) | UNTESTED |

---

## Places — businesses

| Route | File | Purpose | Buttons and links | Auth | Status |
|---|---|---|---|---|---|
| `/business/:id` | `app/business/[id].js` | Public business profile: photos, details, reviews. | `Edit` → `/business/edit/:id` *(owner only)* · `📞 Call` → dialler · `🌐 Website` → external browser · `⭐ Leave a Business Review` → `/business/review/:id` · each review card → `/profile/:user_id` · photo thumbnails → lightbox · `Play video review` → inline player | Reads user + owner | UNTESTED |
| `/business/add` | `app/business/add.js` | Creates a business listing. | `Create Business Listing` → `addBusiness()`, then `/manager/dashboard` | Reads user | UNTESTED |
| `/business/edit/:id` | `app/business/edit/[id].js` | Edits a business by id — the flow the manager dashboard uses. | `Save Changes` → `save()`, then `/manager/dashboard` · `Delete Business` → `deleteBusiness()`, then `/manager/dashboard` | Reads user + owner | UNTESTED |
| `/business/edit` | `app/business/edit.js` | Legacy edit screen that finds the business through the `claims` table instead of a route param. Superseded — see Abandoned. | `Save Changes` → `save()` | Reads user | UNTESTED |
| `/business/dashboard` | `app/business/dashboard.js` | Standalone business-owner dashboard with listings and a customer QR code. Superseded by `/manager/dashboard` — see Abandoned. | `View Public Profile` → `/business/:id` · `Edit Business` → `/business/edit/:id` · `➕ Add Business Listing` → `/business/add` | Reads user + owner | UNTESTED |
| `/business/reviews` | `app/business/reviews.js` | Lists customer reviews for the owner's businesses. Unreachable — see Abandoned. | `Manage Review` → `/business/review-action?id=:reviewId` | Reads user | UNTESTED |
| `/business/review-action` | `app/business/review-action.js` | Owner replies to, or challenges, a single review. Takes `?id=`. | `Save Reply` → `saveResponse()` · `Challenge Review` → `challenge()` · both return via `router.back()` | **Public — no gate in the screen** | UNTESTED |
| `/business/review/:id` | `app/business/review/[id].js` | Review submission form; thin wrapper over `ExplorerReviewForm` with `targetType="business"`. Accepts `?qr=` for verified visits. | Form controls only; the shared form redirects to `/auth/login` when signed out (`components/ExplorerReviewForm.js:110`) | Auth — redirect *(enforced in the shared form)* | UNTESTED |

## Places — properties

| Route | File | Purpose | Buttons and links | Auth | Status |
|---|---|---|---|---|---|
| `/property/:id` | `app/property/[id].js` | Public property profile: photos, details, reviews. | `Edit` → `/property/edit/:id` *(owner only)* · `Open Booking Page` → external browser · `⭐ Leave a Property Review` → `/property/review/:id` · `Open Printable Verified-Review QR` → `/manager/qr/property/:id` *(owner only)* · each review card → `/profile/:user_id` · photo thumbnails → lightbox · `Play video review` → inline player | Reads user + owner | UNTESTED |
| `/property/add` | `app/property/add.js` | Creates a property listing. | `Create Property Listing` → `addProperty()`, then `/manager/dashboard` | Auth — redirect | UNTESTED |
| `/property/edit/:id` | `app/property/edit/[id].js` | Edits a property by id — the flow the manager dashboard uses. | `Save Changes` → `save()`, then `/manager/dashboard` · `Delete Property` → `deleteProperty()`, then `/manager/dashboard` | Auth — redirect + owner | UNTESTED |
| `/property/edit` | `app/property/edit.js` | Legacy edit screen resolving the property through `claims`. Superseded — see Abandoned. | `Save Changes` → `save()` | Reads user | UNTESTED |
| `/property/dashboard` | `app/property/dashboard.js` | Standalone property-owner dashboard with a guest review QR. Superseded by `/manager/dashboard` — see Abandoned. | `View Public Profile` → `/property/:id` · `Manage Reviews` → **`/property/reviews/:id` — broken, see Broken links** · `Edit Property` → `/property/edit/:id` · `➕ Add Property Listing` → `/property/add` | Reads user | UNTESTED |
| `/property/reviews` | `app/property/reviews.js` | Lists guest reviews for the owner's properties. Unreachable — see Abandoned. | `Manage Review` → `/property/review-action?id=:reviewId` | Reads user | UNTESTED |
| `/property/review-action` | `app/property/review-action.js` | Owner replies to, or challenges, a guest review. Takes `?id=`. | `Save Reply` → `saveResponse()` · `Challenge Review` → `challenge()` · both return via `router.back()` | **Public — no gate in the screen** | UNTESTED |
| `/property/review/:id` | `app/property/review/[id].js` | Review submission form; wrapper over `ExplorerReviewForm` with `targetType="property"`. Accepts `?qr=`. | Form controls only; shared form redirects when signed out | Auth — redirect *(in shared form)* | UNTESTED |
| `/guest/:id` | `app/guest/[id].js` | Guest welcome screen for a property stay. Unreachable — see Abandoned. | `🏠 View Property` → `/property/:id` · `⭐ Leave Review` → `/property/review/:id` · `📍 Explore Local Area` → `/map` | Public | UNTESTED |

## Places — static leftovers

| Route | File | Purpose | Buttons and links | Auth | Status |
|---|---|---|---|---|---|
| `/place` | `app/place.js` | Hardcoded mock of a single venue ("The Coffee House", 4.8 stars). No data layer. See Abandoned. | `Leave Review`, `Get Directions`, `Visit Website` — all three are `TouchableOpacity` with **no `onPress`**, so they do nothing | Public | UNTESTED |
| `/saved` | `app/saved.js` | Placeholder for saved/favourite places. Renders a heading and the sentence "Your favourite places will appear here". See Abandoned. | None | Public | UNTESTED |

---

## Clubs

| Route | File | Purpose | Buttons and links | Auth | Status |
|---|---|---|---|---|---|
| `/activity-clubs` | `app/activity-clubs/index.js` | Browsable list of activity clubs. | Each club card → `/activity-clubs/:id` | Public | UNTESTED |
| `/activity-clubs/:id` | `app/activity-clubs/[id].js` | Public club profile with membership state machine (apply / pending / approved / rejected / removed / full). | `Open Manager Dashboard` → `/manager/dashboard` *(manager only)* · `Apply to join` → `applyToJoin()` *(hidden when full)* · `Open Members' Message Board` → `/activity-clubs/message-board/:id` *(manager or approved member)* · `⭐ Leave an Activity Club Review` → `openReview()` → `/activity-clubs/review/:id` *(non-managers with approved/left/removed membership)* · each review card → `/profile/:user_id` · `Play video review` → inline player | Auth — prompt + owner | UNTESTED |
| `/activity-clubs/add` | `app/activity-clubs/add.js` | Creates a club. | `Create Activity Club` → `createClub()`, then `/manager/dashboard` | Auth — redirect | UNTESTED |
| `/activity-clubs/edit/:id` | `app/activity-clubs/edit/[id].js` | Edits a club, including its open/full/closed status. | Status options → `setStatus()` · `Save Changes` → `saveClub()`, then `/manager/dashboard` | Auth — redirect + owner | UNTESTED |
| `/activity-clubs/message-board/:id` | `app/activity-clubs/message-board/[id].js` | Private members' message board. | `Post` → `postMessage()` · `Return to Public Profile` → `/activity-clubs/:id` | Auth — redirect + owner | UNTESTED |
| `/activity-clubs/review/:id` | `app/activity-clubs/review/[id].js` | Club review form; wrapper over `ExplorerReviewForm`. | Form controls only; shared form redirects when signed out | Auth — redirect *(in shared form)* | UNTESTED |

---

## Events

| Route | File | Purpose | Buttons and links | Auth | Status |
|---|---|---|---|---|---|
| `/events` | `app/events/index.js` | Upcoming events list. | Each event card → `/events/:id` · `Try again` → `loadEvents()` | Public | UNTESTED |
| `/events/:id` | `app/events/[id].js` | Public event detail with manager controls when you own it. | `Browse Events` → `/events` *(error state)* · `Open booking website` → external browser · `⭐ Leave a review` → `openReview()` → `/events/review/:id`, or `/auth/login` when signed out · `Edit event` → `/events/edit/:id` *(manager only)* · `Dashboard` → `/manager/dashboard` *(manager only)* · each review card → `/profile/:user_id` · `Play video review` → inline player | Auth — prompt + owner | UNTESTED |
| `/events/add` | `app/events/add.js` | Creates an event. | `Create Event` → `createEvent()`, then `/events/:id` | Auth — redirect | UNTESTED |
| `/events/edit/:id` | `app/events/edit/[id].js` | Edits or deletes an event. | `Save Changes` → `saveEvent()`, then `/manager/dashboard` · `Delete` → `confirmDelete()`, then `/manager/dashboard` | Auth — redirect + owner | UNTESTED |
| `/events/review/:id` | `app/events/review/[id].js` | Event review form; wrapper over `ExplorerReviewForm`. | Form controls only; shared form redirects when signed out | Auth — redirect *(in shared form)* | UNTESTED |

---

## Map

| Route | File | Purpose | Buttons and links | Auth | Status |
|---|---|---|---|---|---|
| `/map` | `app/map.js` (native) · `app/map.web.js` (web) | Map of businesses, properties and clubs. **Native branches on `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`**: with a key it renders `MapView` with markers; without one it falls back to `components/PlacesList`, which is also what the web build always renders. | *Map mode:* category filter chips → `setTypeFilter()` · business marker callout → `/business/:id` · property marker callout → `/property/:id` · club marker callout → `/activity-clubs/:id`. *List mode (`PlacesList`):* search field · `All` / `Businesses` / `Properties` / `Activity Clubs` filters · business card → `/business/:id` · property card → `/property/:id` · club card → `/activity-clubs/:id` | Public | UNTESTED |

---

## Social

| Route | File | Purpose | Buttons and links | Auth | Status |
|---|---|---|---|---|---|
| `/feed` | `app/feed.js` | Activity feed of moments and video reviews from people you follow. | `＋ New Moment` → `/moments/create` · `Find Explorers` → `/explorers` (header and empty state) · actor row → `/profile/:actor_id` · feed item → `/moments/:id` or `/social-comments/:id` · `💬` → comments · `Open place` → the item's listing route | Auth — redirect | UNTESTED |
| `/explorers` | `app/explorers.js` | Directory of explorer profiles; excludes admins. | Each profile card → `/profile/:id` | Auth — redirect | UNTESTED |
| `/profile` | `app/profile.js` | Own profile. Composes `ProfileSocialBar` + `ExplorerProfileScreen`. | Via the shared components: `Edit Profile` / `Edit profile` → `/profile/edit` · `Open Manager Dashboard` → `/manager/dashboard` · `＋ New Moment` / `＋ Share a new Moment` → `/moments/create` · rank card → `/leaderboards` · followers count → `/connections/:id?tab=followers` · following count → `/connections/:id?tab=following` · `Find Explorers` → `/explorers` · favourite cards → the listing route · review cards → the listing route · `💬 Comments` → `/social-comments/:reviewId` · moment cards → `/moments/:id` | Auth — redirect *(in `ExplorerProfileScreen`)* | UNTESTED |
| `/profile/:id` | `app/profile/[id].js` | Someone else's profile. Adds `ProfileSafetyActions` (block/report) to the same composition. | Same as `/profile`, minus the owner-only actions, plus follow and block/report controls | Auth — redirect *(in `ExplorerProfileScreen`)* | UNTESTED |
| `/profile/edit` | `app/profile/edit.js` | Edits display name, bio, area, photo and privacy toggles. | `Choose Profile Photo` → `pickImage()` · `Save Profile` → `saveProfile()` | Auth — redirect | UNTESTED |
| `/connections/:id` | `app/connections/[id].js` | Followers/following lists; opens on the tab given by `?tab=`. | `Followers` / `Following` tabs → `setActiveTab()` · `Find Explorers` → `/explorers` *(following tab)* · each profile card → `/profile/:id` | Auth — redirect | UNTESTED |
| `/moments/create` | `app/moments/create.js` | Composes a moment with optional photo/video and an attached place. | `Photo / camera` → `pickImage()` · `Video / camera` → `pickVideo()` · `Remove selected media` → `clearAsset()` · place-type chips incl. `None` → `choosePlaceType()` · place results → `setSelectedPlace()` · `Publish Moment` → `publish()`, then `/moments/:id` | Auth — redirect | UNTESTED |
| `/moments/:id` | `app/moments/[id].js` | Single moment with comments, report and delete. | Author row → `/profile/:user_id` · place card → the listing route · `Report` → report sheet → reason options → `Submit report` · `Cancel` → closes sheet · `Delete` → confirm → `Delete permanently` → `deleteMoment()`, then `/feed` · `Keep Moment` → cancels · comment authors → `/profile/:user_id` | Auth — prompt | UNTESTED |
| `/social-comments/:id` | `app/social-comments/[id].js` | Comment thread on a video review. | Author row → `/profile/:user_id` · place card → the listing route · comment authors → `/profile/:user_id` (via `CommentThread`, which pushes `/auth/login` when signed out) | Reads user | UNTESTED |
| `/leaderboards` | `app/leaderboards.js` | Explorer rankings by period and scope. | Period options → `setPeriod()` · scope options → `setScope()` · `Edit Profile` → `/profile/edit` · each row → `/profile/:user_id` | Auth — redirect | UNTESTED |
| `/notifications` | `app/notifications.js` | Notification centre with category tabs; each notification carries its own destination. | `Log in` → `/auth/login` *(signed out)* · `Mark all read` → `markAllRead()` · category tabs → `setActiveCategory()` · each notification → its stored `destination` (suppressed when that is `/notifications`) | Auth — prompt | UNTESTED |
| `/safety/blocked` | `app/safety/blocked.js` | Lists blocked explorers and unblocks them. | Each profile row → `/profile/:blocked_id` · `Unblock` → `unblock()` | Auth — redirect | UNTESTED |

---

## Link-ups

| Route | File | Purpose | Buttons and links | Auth | Status |
|---|---|---|---|---|---|
| `/linkups` | `app/linkups/index.js` | Browse link-ups with status filters. | `＋ Create Link-up` → `/linkups/create` *(expo-router `<Link>`)* · filter tabs → `setFilter()` · each card → `/linkups/:id` · `📡 Open Live Nearby` → `/live` | Auth — redirect | UNTESTED |
| `/linkups/create` | `app/linkups/create.js` | Creates a link-up. Renders `LinkupForm` in `titleOnly` mode — title is the only required field. | `LinkupForm` submit → `create()`, then `/linkups/:id` | Auth — redirect | UNTESTED |
| `/linkups/:id` | `app/linkups/[id].js` | Link-up detail: attendees, join/leave, organiser controls, safety actions. | `Back to Link-ups` → `/linkups` *(error state)* · organiser card → `/profile/:creator_id` · `Join Link-up` / `Leave Link-up` → `callRpc()` · `💬 Open private board` → `/linkups/board/:id` *(when open)* · `Edit Link-up` → `/linkups/edit/:id` *(owner, not cancelled/completed)* · `Cancel Link-up` → confirm → `Cancel it` / `Keep it` · attendee rows → `/profile/:user_id` · `Remove` → `remove_linkup_attendee` *(owner)* · `Report Link-up` → reason picker → `Submit report` · `Block organiser` → `blockCreator()` | Auth — redirect + owner | UNTESTED |
| `/linkups/edit/:id` | `app/linkups/edit/[id].js` | Edits a link-up via `LinkupForm` with `submitLabel="Save changes"`. | Form submit → `update()`, then `/linkups/:id` | Auth — redirect | UNTESTED |
| `/linkups/board/:id` | `app/linkups/board/[id].js` | Private attendee message board. | `Back to Link-up` → `/linkups/:id` *(error state)* · header card → `/linkups/:id` · `Send` → `post()` · announcement toggle → `setAnnouncement()` · `Remove` → `remove()` · `Report` → reason picker → `Submit report` | Auth — redirect + owner | UNTESTED |

---

## Check-ins and live discovery

| Route | File | Purpose | Buttons and links | Auth | Status |
|---|---|---|---|---|---|
| `/checkins/create` | `app/checkins/create.js` | Publishes a time-boxed check-in at a place. | Place-type chips → `setPlaceType()` · place results → `selectPlace()` · `Use my location` → `useLocation()` · `Remove location` → clears it · activity chips → `setActivity()` · duration options → `setMinutes()` · `Public` / `Followers` → `setVisibility()` · `Start check-in` → `publish()`, then `/live` | Auth — redirect | UNTESTED |
| `/live` | `app/live.js` | Live Nearby: check-ins and link-ups around you, with distance/time/type filters. | `Create Link-up` → `/linkups/create` · `Check in` → `/checkins/create` · `End` → `endCheckin()` · `Apply` → `applyArea()` · `Use my location` → `useLocation()` · radius options → `setRadius()` · time-window options → `setWindowHours()` · type filters → `setType()` · each result's action button → that item's `deep_link` · `Report` → `reportCheckin()` *(check-ins only)* | Auth — redirect | UNTESTED |

---

## Manager

| Route | File | Purpose | Buttons and links | Auth | Status |
|---|---|---|---|---|---|
| `/manager/dashboard` | `app/manager/dashboard.js` | The manager hub — businesses, properties, clubs and events you own, plus capability requests. Hard-fails with "A manager account is required to open this dashboard." when `account_type !== "manager"` (`:121`). Accepts `?club=` and `?view=` to focus a section. | `Request access` → `onRequest()` · `Open printable QR` → `/manager/qr/:type/:id` · action-centre link → `/manager/requests` · per club: requests → `/manager/requests?club=:id&view=requests`, `Edit` → `/activity-clubs/edit/:id`, `Public profile` → `/activity-clubs/:id`, `Open private message board` → `/activity-clubs/message-board/:id`, remove member → `confirmRemoveMember()` · per business: `Edit` → `/business/edit/:id`, `Public profile` → `/business/:id` · per property: `Edit` → `/property/edit/:id`, `Public profile` → `/property/:id` · per event: `Edit` → `/events/edit/:id`, `View listing` → `/events/:id` · `➕ Add Business` → `/business/add` · `➕ Add Property` → `/property/add` · `➕ Add Activity Club` → `/activity-clubs/add` · `➕ Add Event` → `/events/add` | Auth — redirect + manager | UNTESTED |
| `/manager/requests` | `app/manager/requests.js` | Action centre for club membership requests. Accepts `?club=`, `?view=`, `?membership=`. | `Approve` / `Reject` → `decideMembership()` · member links → `/manager/dashboard?club=:id&member=:userId&view=members` · club links → `/manager/dashboard?club=:id&view=members` · club tabs → `/manager/requests?club=:id&view=requests` · `Notifications` → `/notifications` · `Manager Dashboard` and `Return to Manager Dashboard` → `/manager/dashboard` | Auth — redirect + manager + owner | UNTESTED |
| `/manager/membership-status/:id` | `app/manager/membership-status/[id].js` | Status detail for one membership request. Unreachable — see Abandoned. | `Open Manager Dashboard` → `/manager/dashboard` · `Review this request` → `/manager/requests?club=:id&membership=:id&view=requests` · `View current club members` → `/manager/dashboard?club=:id&view=members` · `Notifications` → `/notifications` · `Manager Dashboard` → `/manager/dashboard` | Auth — redirect + manager + owner | UNTESTED |

---

## Admin

| Route | File | Purpose | Buttons and links | Auth | Status |
|---|---|---|---|---|---|
| `/admin/claims` | `app/admin/claims.js` | Reviews ownership claims over businesses and properties. Reached from the menu's admin-only entry. | `Approve` → `updateClaim()` · `Reject` → `updateClaim()` | **Public — no gate in the screen** | UNTESTED |
| `/admin/dashboard` | `app/admin/dashboard.js` | Second admin surface over the same claims data. Reached from the `⚙️` button on `/`, which renders only when `is_admin`. | `Approve` → `updateClaim()` · `Reject` → `updateClaim()` | **Public — no gate in the screen** | UNTESTED |

---

## QR

| Route | File | Purpose | Buttons and links | Auth | Status |
|---|---|---|---|---|---|
| `/scan` | `app/scan.js` | Camera scanner for Guestbook QR codes. | `Allow camera access` → `requestPermission()` · `Open verified review` → `openScan()` · `Scan another code` → resets · on a successful scan → `/qr/:code` | Public | UNTESTED |
| `/qr/:code` | `app/qr/[code].js` | Resolves a scanned code to a listing and forwards to its review form with the verified-visit bonus. | `Continue to review` → `continueToReview()` → `/business/review/:id`, `/property/review/:id`, `/activity-clubs/review/:id` or `/events/review/:id`, each with `?qr=:code` (routes come from the `_config` table at `:15-18`) · `Return home` → `/` *(error state)* · when signed out, pushes `/auth/login` with a `next` param | Auth — prompt | UNTESTED |
| `/manager/qr/:type/:id` | `app/manager/qr/[type]/[id].js` | Printable verified-review QR poster for a listing. Reached from `/manager/dashboard` and from `/property/:id`. | `Print Verified Review QR` → `printPage()` | Reads user + owner | UNTESTED |

---

# Findings

## Routes nothing links to

Eleven routes have no inbound navigation anywhere in `app/` or `components/`. They
are reachable only by typing the URL (web) or a deep link.

| Route | File | Why it appears to be stranded |
|---|---|---|
| `/auth/update-password` | `app/auth/update-password.js` | Expected. It is entered from a link in a password-reset email, not from inside the app. **Not a defect.** |
| `/business/dashboard` | `app/business/dashboard.js` | Superseded by `/manager/dashboard`, which owns the business section now. |
| `/business/edit` | `app/business/edit.js` | Superseded by `/business/edit/:id`. |
| `/business/reviews` | `app/business/reviews.js` | No route links here, so its `Manage Review` button — the only way into `/business/review-action` — cannot be reached either. |
| `/guest/:id` | `app/guest/[id].js` | A guest-welcome flow with no entry point. Plausibly intended to be reached from a property QR code or a booking link. |
| `/manager/membership-status/:id` | `app/manager/membership-status/[id].js` | Fully built, 300+ lines, links out to four places, but nothing links in. The most substantial stranded screen. |
| `/place` | `app/place.js` | Static mock. See Abandoned. |
| `/property/dashboard` | `app/property/dashboard.js` | Superseded by `/manager/dashboard`. |
| `/property/edit` | `app/property/edit.js` | Superseded by `/property/edit/:id`. |
| `/property/reviews` | `app/property/reviews.js` | Same shape as `/business/reviews` — and the one link that *does* aim at it is malformed, see below. |
| `/saved` | `app/saved.js` | Placeholder. See Abandoned. |

`/business/review-action` and `/property/review-action` are each linked exactly
once — from `/business/reviews` and `/property/reviews` respectively. Since both
of those parents are themselves unreachable, all four screens form a stranded
cluster.

## Links pointing at routes that don't exist

| Link | Written at | Problem |
|---|---|---|
| `/property/reviews/:id` | `app/property/dashboard.js:215` (`Manage Reviews`) | **Genuine dead link.** The file is `app/property/reviews.js`, a static route taking no parameter. `/property/reviews/<uuid>` matches nothing and will not resolve. Either the button should push `/property/reviews`, or the screen should become `app/property/reviews/[id].js`. Note the equivalent button on `/business/dashboard` pushes the parameterless `/business/:id`, so the two dashboards disagree. |
| `auth/verify` | `app/_layout.js:44` | A `<Stack.Screen name="auth/verify"/>` is declared but **no `app/auth/verify.js` exists**. Nothing navigates to it, so it is inert, but it points at an email-verification screen that was planned and never built. |

One candidate was checked and cleared: the dynamic `router.replace` at
`app/qr/[code].js:91` builds its path from `_config.route`, whose four possible
values (`business/review`, `property/review`, `activity-clubs/review`,
`events/review`) all resolve to real routes. **Not broken.**

## Anything that looks abandoned or half-built

**Static mockups with no data layer**

- `app/place.js` — hardcoded "☕ The Coffee House" with a fixed 4.8 rating and
  fixed description. All three buttons (`Leave Review`, `Get Directions`,
  `Visit Website`) are `TouchableOpacity` elements with **no `onPress` prop at
  all**, so they are inert. Uses `TouchableOpacity` and a flat indentation style
  found nowhere else in `app/`, which suggests early scaffolding that predates
  the current codebase conventions.
- `app/saved.js` — 38 lines. Renders "❤️ Saved Places" and "Your favourite places
  will appear here". No query, no state, no controls. Favourites *are* implemented
  elsewhere (`components/FavouriteButton.js`, and the favourites grid inside
  `ExplorerProfileScreen`), so this screen was superseded rather than never
  started.

**Two parallel generations of the same screens**

The owner-facing surfaces exist twice, and the older generation is the stranded one:

| Older, unreachable | Current, linked from `/manager/dashboard` |
|---|---|
| `/business/dashboard`, `/property/dashboard` | `/manager/dashboard` |
| `/business/edit`, `/property/edit` | `/business/edit/:id`, `/property/edit/:id` |

The distinction is how they find their target. `app/business/edit.js:53-75` looks
up a row in `claims` and follows `claim.business_id`; `app/business/edit/[id].js`
takes the id straight from the route. The same split exists for properties. This
is consistent with a migration from a claim-centred model to a manager-centred one
that left the old screens in the tree.

**Two admin screens over the same data**

`/admin/claims` (625 lines) and `/admin/dashboard` (335 lines) both list and
approve/reject ownership claims, and each is reached from a different place — the
menu links to the former, the `⚙️` button on `/` to the latter. Nothing in the code
distinguishes their responsibilities.

**No in-screen auth check on four sensitive routes — and nothing behind them either**

`app/admin/claims.js`, `app/admin/dashboard.js`, `app/business/review-action.js`
and `app/property/review-action.js` contain no `auth.getUser()` call, no
`is_admin` test and no redirect. Their entry points are hidden — the admin buttons
render only when `is_admin`, and the review-action screens sit behind unreachable
parents — but the routes themselves are not gated, so anything that can navigate
directly reaches a working Approve/Reject or review-response form.

The database was checked, and at the time of writing **row-level security did
not cover them**. On project `yzpthslwsvesgndzdqai` (pinned at
`supabase/config.toml:7`), `relrowsecurity` was `false` on all five tables these
screens touch. **This has since been fixed** — see the remediation below — but
the finding is recorded as it stood:

| Table | RLS (then) | Policies (then) | RLS (now) | Policies (now) |
|---|---|---|---|---|
| `claims` | off | 4 | **on** | 5 |
| `businesses` | off | 4 | **on** | 4 |
| `reviews` | off | 1 | **on** | 5 |
| `properties` | off | 0 | **on** | 4 |
| `profiles` | off | 0 | **on** | 4 |

Policies were written — including `Admins can update claims`, which tests
`profiles.is_admin` exactly as the admin screens assume — but Postgres does not
evaluate policies on a table whose RLS is disabled, so none of them apply.
Supabase's linter reports this as `rls_disabled_in_public` and
`policy_exists_rls_disabled`. The second project, `nyyljcdrmbdavamgcydw`, is
configured identically, so this is not one stale copy.

Both `anon` and `authenticated` hold `SELECT, INSERT, UPDATE, DELETE, TRUNCATE`
on all five tables. Because the anon key is public by design — it sits in
`.github/workflows/build-apk.yml:25` and is inlined into every shipped bundle —
the client screens are not the meaningful control surface: the PostgREST
endpoint is reachable directly, and whether a screen calls `getUser()` makes no
difference to a caller who never opens the app.

The sharpest edge is `profiles`: RLS off, zero policies, `anon` UPDATE, and
`is_admin` is a column on it. Every other admin gate in the app depends on a
flag that is writable without authentication.

Remediation is split across two migrations, because arming a table before its
policies exist makes it return nothing:

- `supabase/migrations/20260803211732_rls_policies_and_grants.sql` — defines 22
  policies across the five tables and narrows the grants. **Applied.** `anon`
  is now down to `SELECT` on all five, and `profiles.is_admin` was dropped from
  the `UPDATE` column grant, so it can no longer be written through the API by
  anyone. That closes the escalation path. The policies themselves are still
  inert, because RLS remains off.
- `supabase/migrations/20260803212021_enable_rls_claims.sql` — arms `claims`.
  **Applied**, verified by impersonating real users in rolled-back
  transactions: an admin sees all rows and can update them, a claim owner sees
  only their own, an unrelated signed-in user sees none and updates none, and
  `anon` sees none.
- `supabase/migrations/20260803212705_enable_rls_businesses_properties.sql` —
  arms `businesses` and `properties`. **Applied**: `anon` still reads all 12
  businesses and 3 properties (so `/map` is unaffected), an owner's update
  reaches only their own rows, an unrelated user changes nothing, an admin
  reaches everything, and an insert claiming someone else's `owner_id` is
  refused outright.
- `supabase/migrations/20260803214126_enable_rls_reviews.sql` — arms `reviews`.
  **Applied**: `anon` reads all 15 published rows, a listing owner's response
  update reaches their 10, an unrelated user's reaches none. The risk here was
  the `explorer_reviews` → `reviews` sync trigger; it runs `SECURITY DEFINER` as
  `postgres` (which holds `rolbypassrls`), and a real review submission was
  confirmed to still mirror across with RLS on.
- `supabase/migrations/20260803214309_enable_rls_profiles.sql` — arms
  `profiles`. **Applied**: a signed-in user sees all 19 profiles and can update
  exactly one — their own; `anon` sees none, so `email` and `phone` are no
  longer readable by anyone holding the public key; editing another user's row
  changes 0 rows; and setting `is_admin` on your own row is **refused outright**
  with `permission denied for table profiles`.

All five are now armed, and Supabase's linter no longer reports
`rls_disabled_in_public` or `policy_exists_rls_disabled` against any of them.

Two side effects worth recording:

- 1 business and 2 properties have a null `owner_id`, so no `auth.uid()`
  matches them and only an admin can now edit those rows. They were already
  unreachable through the app, which finds listings by `owner_id`.
- `moments/[id].js:75` and `social-comments/[id].js:52` read the author's
  profile without an `if (user)` guard, so a signed-out visitor arriving by deep
  link now gets null. Both render `profile?.full_name || "Explorer"` with an "E"
  avatar fallback, so they degrade rather than break, and both are only linked
  from `/feed` and `/profile`, which require a session.

`manager_packages` and `manager_subscriptions` were the last two
`rls_disabled_in_public` ERRORs and have since been closed as well, by
`20260803221806_manager_billing_narrow_grants.sql` and
`20260803221818_enable_rls_manager_billing.sql`. Both are **deny-all**: RLS on,
no policies. They are the superseded entitlement model — the live manager
screens use `manager_capabilities` and `manager_capability_requests` — and
nothing in `app/`, `components/`, `hooks/`, `services/`, `utils/`,
`supabase/functions/`, any function body or any view reads them. Writing
owner-scoped policies would have meant inventing an access model for code that
does not exist. The rows are untouched and still reachable to `service_role` and
the SQL editor; only the public API surface closed. Verified: `anon`,
`authenticated` and admin all read 0 rows, writes are refused outright, and 5
packages / 4 subscriptions remain present service-side.

**The project now reports no `rls_disabled_in_public` errors at all.**

Still open, and deliberately not addressed: `account_type` remains writable, so
a user can still promote themselves to `manager` and reach
`/manager/dashboard`. Closing that means moving the signup write server-side.
Also out of scope: three `SECURITY DEFINER` views, an anon-executable
`create_notification`, the listable `review-image` bucket, and leaked-password
protection being off.

**Layout declarations out of step with the file tree**

`app/_layout.js` names 63 screens. One (`auth/verify`) has no file, and eleven
files are absent from it: `admin/dashboard`, `business/[id]`, `business/edit`,
`business/edit/[id]`, `business/review-action`, `guest/[id]`,
`manager/membership-status/[id]`, `place`, `property/[id]`, `property/edit`,
`property/review-action`. Expo-router registers routes from the file tree
regardless, so the undeclared ones still work and only miss their explicit
`Stack.Screen` options — but the drift is a reliable marker of which screens were
added or abandoned without the layout being revisited. Note that
`business/[id]` and `property/[id]` are heavily used, so absence from the layout
does not by itself imply a screen is dead.

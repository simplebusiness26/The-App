# Xplorer

## What this app is

A live, interactive map of local life. Not a static map of where places
are — a map of what is *happening* right now and what a person could
actually go and do.

**Mission:** make local life visible, connected and accessible.

**Core promise:** open the map and see your local world come alive.

The app should answer, in order:
1. What is around me?
2. What is happening now?
3. Who else is going?
4. How do I join?
5. How do I get there?

## What it is not

Not a review app, business directory, event listings site, social feed,
taxi app or delivery app. Those are layers inside the product. The
product is the living local map.

If a feature makes sense as a standalone listing page but adds nothing
to the map, it's probably drifting off-concept. Say so.

## Core loop

See → Decide → Join → Get There → Experience → Share

Every completed experience should feed information back into the map.
When reviewing or building a feature, ask which step of this loop it
serves. If it serves none, flag it.

## Current stage: Stage One complete, Stage Two/Three underway

Stage One shipped:

- Explorer profiles
- Businesses and properties
- Reviews and photos
- Claims, ownership and QR-code verification
- Manager tools
- Activity club pages
- Event pages
- Map discovery (static businesses/properties/clubs only so far — see
  Phase 1 gap below)

Stage Two/Three also already shipped, ahead of the original staged
plan: opt-in live check-ins, public Link-ups (with private attendee
boards/chat), a "Live Nearby" discovery screen, and an Explorer social
layer (follows, Feed, Moments, likes/comments, leaderboards). These
were accepted as done rather than rolled back — the staged discipline
below now applies to what's genuinely still ahead, not to relitigating
what's already built.

Also in scope, as the remainder of that accepted Stage Two work:
scheduled and live state carried on map pins, and Now / Tonight /
Weekend time filters.

Known structural gap: the "live" data (check-ins, Link-ups, event
state) lives on a separate `/live` screen and never reaches the main
map (`app/map.js`), which still only renders static business/property/
club pins. That contradicts the core promise below and is the highest-
priority fix — see the alignment plan.

## Later stages (do not build yet)

- **Remaining Three:** deeper club membership/booking flows, reminders
- **Four:** directions, public transport, taxi partner links
- **Five:** ordering, ticketing, payments
- **Six:** the full local operating system

If asked to build something from these, say it's out of scope for now
and explain what groundwork it needs first.

## Approved exceptions

Navigation replacement and UI redesign are APPROVED as of 2026-08-04,
scoped to docs/REDESIGN-BRIEF.md. AGENTS.md §13 does not apply to
packets listed in that brief.

This approval covers structure and navigation only. It does not
license the Stage Four and Stage Five surfaces the brief draws in
passing: directions, "Book a table" and "Get tickets" stay out, per
the list above and the no-placeholder-UI rule in RULES.md.

## Account model

Everyone is an Explorer. There is no separate business account.

Managers of businesses, properties, clubs or events unlock extra tools
on top of their normal Explorer profile, keeping their social identity
and reviews. Their profile can optionally surface what they manage.

Do not build parallel user types. One identity, unlocked capabilities.

Known gap: `app/auth/signup.js` currently forces a binary Explorer/
Manager choice at signup (`profiles.account_type`), which is exactly
the parallel-user-type model this rule forbids. Fix planned — see the
alignment plan.

## Privacy principle

The map must be alive without being invasive.

Users always control whether location is shared, who sees it, how
precise it is, how long a check-in lasts, and whether they appear on
the public map at all. Location sharing is opt-in, temporary and
plainly explained.

Visibility states: at this venue / in this general area / attending
this event / available for a link-up / hidden.

Default to hidden. Never make a person a permanent trackable marker.
Treat anything touching live location as a safety-critical surface and
raise concerns rather than quietly implementing.

Audited 2026-08-03. What already holds up: check-ins are opt-in only
(no passive tracking), expire on their own (15min-4hr, enforced
server-side), are capped at one active check-in per user, and
coordinates are rounded to ~3 decimal places before storage; blocking
and reporting both work. `app/checkins/create.js` now defaults new
check-ins to "Followers" instead of "Public" to match "default to
hidden."

Real gaps, not yet fixed: the schema only has two visibility values
(`public`/`followers`) for `live_checkins` and `linkups` -- there is no
"in this general area" (coarser precision) tier and no true "hidden"
state distinct from simply not checking in. `create_linkup` also
defaults visibility to `public` server-side when unspecified, which
the quick-create UI relies on. Building the full five-state visibility
model is a real feature addition, not a defaults fix -- treat it as its
own scoped piece of work before Live/Link-ups go further.

## Map feel

Places and pins should carry state, not just position — open, busy,
hosting something, promoting an offer, taking bookings. Clubs signal an
approaching session. Events move through upcoming, starting soon, live,
busy, finished.

Playful and readable. Not childish, not cluttered.

## Success metric

Completed local experiences, not downloads or map views. A visit, a
club session joined, an event attended, a booking finished, a verified
review left afterwards.

Prefer changes that increase completed experiences over changes that
increase browsing.

## Working with me

- Read the codebase before proposing changes
- Be blunt; I want real criticism, not encouragement
- Point to specific files and lines
- Ask before adding a new dependency
- One feature at a time — no broad half-built sweeps

## Development branch

`main2.0-Dev` is the authoritative and active Xplorer development
branch.

The ordinary `main` branch is outdated and must not be used.

Follow the complete workflow in `AGENTS.md`.

Unless the user explicitly requests otherwise:

- work directly on `main2.0-Dev`;
- do not create another branch;
- do not open a pull request;
- commit and push completed, tested work directly to
  `origin/main2.0-Dev`.

Before editing, fetch the remote state and confirm local `main2.0-Dev`
has not diverged.

Never reset, force-push or discard commits to solve divergence.

## Project specifics

- **Stack:** Expo + Expo Router (file-based routes) + React Native
  (plain JS, no TypeScript in the app). Backend is Supabase (Postgres,
  Auth, Storage, Edge Functions) — no custom server, no REST API layer.
  `services/supabase.js` is the only client, reads
  `EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- **Run locally:** `npm install`, then `npx expo start --web` (or
  `android`/`ios`). On Replit, `bash scripts/replit-start.sh` does a
  static production build (`expo export --platform web`) served by
  `scripts/serve-preview.cjs` — not a dev server. See `replit.md` for
  required secrets.
- **Run tests:** No unit/integration test framework is installed (no
  jest, no `__tests__`). CI (`.github/workflows/quality-checks.yml`)
  runs standalone Node scripts instead: `scripts/verify-*.cjs`, plus
  `npm audit`, `expo-doctor`, and a production web export. Manual QA is
  documented as checklists in `docs/*_TEST_PLAN.md`.
- **Key directories:** `app/` (routes), `components/` (shared UI),
  `context/` (FeedbackContext, NotificationContext), `hooks/`,
  `services/supabase.js`, `utils/`, `supabase/migrations/` (the real,
  authoritative schema — 29+ files), `supabase/functions/` (Edge
  Functions), `docs/` (feature status + test-plan docs). `database/`
  is an explicitly-marked legacy stub, not the live schema.
- **Data sources for places/events:** All from the app's own Supabase
  Postgres tables (`businesses`, `properties`, `activity_clubs`,
  `events`, `live_checkins`, `linkups`, etc.) populated via manager/
  admin tooling and the claim workflow — no external places/events API
  is integrated.
- **Known constraints or gotchas:** `businesses`, `properties`,
  `reviews`, `claims`, and `profiles` are NOT in tracked migrations —
  they predate migration tracking and were provisioned directly
  against the live project, so schema changes to them aren't
  version-controlled like the rest. Older tables have incomplete RLS
  (flagged in `docs/LINKUPS_LIVE_STATUS.md` as a deferred audit).
  `app/place.js` and `app/saved.js` are dead/stub screens not linked
  from any nav.

  Two entries that used to be here are **no longer true**, corrected
  2026-08-10 after checking rather than repeating them:
  `app/business/dashboard.js` and `app/property/dashboard.js` are
  reachable — Packet 4's Quick Access drawer added them, gated on the
  Manager capability, and `scripts/verify-manager-boundary.cjs` now
  fails if either is dropped again. `app/admin/claims.js` and
  `app/admin/dashboard.js` are no longer duplicates: the admin
  workstream made the dashboard an overview and left claims as the one
  review screen.

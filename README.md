Xplorer

«Discover what is happening around you, connect with local people and places, and turn any town into something you can explore.»

Xplorer is a map-led local discovery and participation platform.

It brings businesses, stays, events, activity clubs, link-ups, reviews, social moments and live local activity into one experience. Instead of only searching for places, Explorers can see what is happening, decide what to do, join in and share what they discover.

---

The Vision

Xplorer is building a living, interactive map of towns and cities.

The long-term goal is to create one place where people can:

- Discover businesses, places, events and activities.
- See what is happening nearby.
- Find people with similar interests.
- Join clubs and community activities.
- Create or attend public link-ups.
- Share reviews, photos, videos and moments.
- Build a personal scrapbook of places and experiences.
- Earn reputation through useful local contributions.
- Manage businesses, properties, clubs and events.
- Eventually access local transport, delivery and other town services.

Xplorer will launch town by town, starting with locations in East Sussex.

---

Core Product Areas

Interactive Map

The map is the centre of Xplorer.

It displays local places and activity using different marker types, including:

- Businesses
- Properties and stays
- Activity clubs
- Events
- Live check-ins
- Link-ups

Native builds can use "react-native-maps". Web builds and native builds without a configured maps key use the place-list fallback.

Discover

The Discover experience brings together:

- Recommended places
- Events
- Activity clubs
- Link-ups
- Social activity
- Saved places
- Things happening nearby

Recommendations are designed to explain why an item is being shown rather than presenting unexplained results.

Explorer Profiles

Every user has an Explorer identity.

Explorer profiles can include:

- Reviews
- Moments
- Favourites and collections
- Club memberships
- Link-ups
- Explorer reputation
- Leaderboard activity
- An optional local area
- A personal history of discoveries

Reviews and Reputation

Explorers can review:

- Businesses
- Properties
- Activity clubs
- Completed events

Reviews support:

- Star ratings
- Titles and written comments
- Images
- Video review support
- QR-verified visits
- Useful-review endorsements
- Server-calculated contribution points
- Moderation states
- Manager replies and challenges

QR verification allows Xplorer to distinguish an ordinary review from a confirmed visit.

Social Layer

The social system includes:

- Explorer follows
- Moments
- Likes
- Comments
- Notifications
- Favourites
- User blocking
- Social reporting and moderation

Moments can be attached to a business, property, activity club or event.

Live Local Activity

Explorers can choose to appear on the live local map through temporary check-ins.

A check-in can show:

- The place
- The general area
- What the Explorer is doing
- A short message
- Public or followers-only visibility
- An automatic expiry time

Check-ins are temporary and must remain optional.

Link-ups

Link-ups let Explorers arrange informal local plans such as:

- Casual football
- Coffee meet-ups
- Walks
- Photography sessions
- Food crawls
- Board-game meet-ups

Each link-up can include:

- A creator
- Time and location
- Attendee limits
- Public or followers-only visibility
- Attendee membership
- Private meeting details
- Group messages
- Safety reporting

Activity Clubs

Activity clubs support recurring communities and organised groups.

Club features include:

- Public club profiles
- Membership applications
- Member limits
- Approval and rejection
- Upcoming sessions
- Session RSVPs
- Announcements
- Private member message boards
- Club reviews
- Manager controls

Events

Managers with the appropriate capability can create and manage events.

Events support:

- Categories
- Descriptions
- Coordinates and addresses
- Start and end times
- Pricing
- Capacity
- Booking links
- Images
- Published, draft and cancelled states
- Reviews after the event begins

---

Account Model

Xplorer uses one universal identity.

Every user is an Explorer.

Management is not a completely separate identity. It is an additional capability layer added to an Explorer account.

An Explorer may be granted the ability to manage:

- Businesses
- Properties
- Activity clubs
- Events

Manager capabilities are stored separately and can be active, inactive, requested, in trial, past due or cancelled.

Administrative access is controlled separately through the "is_admin" profile field.

---

Current Development Status

Xplorer is under active MVP development.

The "main2.0-Dev" branch contains the current redesign and product work.

Implemented or actively represented in the codebase

- Expo Router navigation
- Bottom navigation shell
- Quick Access drawer
- Interactive map and list fallback
- Discover screen
- Business profiles
- Property profiles
- Activity clubs
- Events
- Link-ups
- Live check-ins
- Explorer feed
- Explorer profiles
- Reviews and review media
- QR-verified reviews
- Review reputation and endorsements
- Leaderboards
- Favourites
- Notifications
- Manager dashboard
- Claims and admin moderation
- Safety reporting and blocking
- Business classification and marker assignment
- Automated verification scripts
- Jest test suite
- GitHub Actions workflows

This remains a development build and should not yet be treated as a production-ready public release.

---

Technology Stack

Application

- React Native
- Expo
- Expo Router
- React
- React Native Web
- React Native Maps

Backend

- Supabase
- PostgreSQL
- Supabase Authentication
- Row Level Security
- Supabase Storage
- Supabase Edge Functions

Testing and Verification

- Jest
- jest-expo
- React Test Renderer
- Expo Doctor
- Custom source and architecture verification scripts
- GitHub Actions

---

Repository Structure

The-App/
├── app/                    # Expo Router screens and routes
│   ├── activity-clubs/
│   ├── admin/
│   ├── auth/
│   ├── business/
│   ├── checkins/
│   ├── events/
│   ├── linkups/
│   ├── manager/
│   ├── profile/
│   └── property/
├── components/             # Shared UI and feature components
├── context/                # React context providers
├── docs/                   # Product, design and development documentation
├── hooks/                  # Shared application hooks
├── scripts/                # Verification scripts
├── services/               # Supabase and external service clients
├── supabase/
│   ├── functions/          # Supabase Edge Functions
│   ├── migrations/         # Authoritative database migrations
│   └── config.toml         # Supabase project link
├── test/                   # Jest tests
├── utils/                  # Navigation, map, taxonomy and helper logic
├── .env.example
├── package.json
└── README.md

---

Local Development

Requirements

- Node.js
- npm
- Expo-compatible development environment
- Access to the Xplorer Supabase project
- Android, iOS or web development environment

Installation

Clone the repository:

git clone https://github.com/simplebusiness26/The-App.git
cd The-App
git checkout main2.0-Dev

Install the exact locked dependencies:

npm ci

Create a local environment file:

cp .env.example .env

Add the required values:

EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_APP_URL=

Start Expo:

npm start

Other start commands:

npm run android
npm run ios
npm run web

---

Environment Variables

"EXPO_PUBLIC_SUPABASE_URL"

The public API URL for the Xplorer Supabase project.

"EXPO_PUBLIC_SUPABASE_ANON_KEY"

The public client key used by the Expo application.

Only a publishable or legacy anonymous key may be used in the client.

Never place a Supabase service-role key in the Expo application, ".env" file committed to GitHub, or any "EXPO_PUBLIC_*" variable.

"EXPO_PUBLIC_APP_URL"

The base application URL used for authentication redirects, including password recovery.

The matching recovery URL must also be allowlisted in Supabase Authentication URL Configuration.

---

Database

This repository is linked to the dedicated Xplorer Supabase project.

It is separate from the older Guestbook Supabase project.

Before running any command that writes to a remote database, verify the project reference in:

supabase/config.toml

The authoritative schema is:

supabase/migrations/

Migrations must be applied in filename order.

Do not treat legacy schema stubs as authoritative.

Database areas

The current schema includes data for:

- Profiles and authentication-linked identities
- Manager capabilities and subscriptions
- Businesses
- Properties
- Claims
- Reviews
- Review media
- QR verification
- Review reputation points
- Events
- Activity clubs
- Sessions and RSVPs
- Link-ups and attendees
- Live check-ins
- Moments
- Follows
- Likes and comments
- Favourites
- Notifications
- Safety reports
- User blocks
- Business categories and types

Row Level Security

Tables exposed through the Supabase Data API must have Row Level Security enabled.

Policies should enforce ownership and capability checks rather than relying only on whether a user is authenticated.

---

Development Sample Data

The connected Xplorer development database contains sample content for testing the application.

The sample dataset covers:

- Brighton and Hastings locations
- Businesses and properties
- Events and activity clubs
- Club sessions and memberships
- Link-ups and group messages
- Explorer reviews
- QR-verified reviews
- Review images
- Moments
- Follows
- Likes and comments
- Favourites
- Live check-ins
- Notifications
- Leaderboard contribution points

This sample content is for development and demonstration purposes only. It must not be treated as genuine customer, venue or user activity.

Sample businesses use a dedicated seed marker so they can be identified separately from manually created records.

---

Verification

Run the Jest suite:

npm test

Run the CI-oriented test command:

npm run test:ci

Feature verification commands include:

npm run verify:social
npm run verify:live
npm run verify:screens
npm run verify:taxonomy
npm run verify:markers
npm run verify:place
npm run verify:cards
npm run verify:discover
npm run verify:reputation

Before merging substantial work, also run:

npx expo-doctor

and verify that the production-style web export completes.

---

Development Principles

Protect user privacy

Location and social features must remain optional and privacy-conscious.

Do not expose:

- Exact historical movement unnecessarily
- Private meeting details to non-attendees
- Blocked-user content
- Private check-ins outside their intended audience
- Sensitive notification data to another account

Enforce permissions in the database

Hiding a button is not sufficient security.

Manager, owner, membership and administrative restrictions must also be enforced through database policies or trusted server-side logic.

Preserve the universal Explorer identity

Management capabilities are added to an Explorer account.

Do not recreate separate user identities for Explorer and Manager functionality.

Keep sample data out of production

Development seed records must remain clearly identifiable and must not be silently inserted by ordinary production migrations.

Keep secrets out of the client

Never expose:

- Service-role keys
- Database passwords
- Private signing secrets
- Administrative API credentials

---

Near-Term Priorities

- Complete and verify the redesigned navigation system.
- Continue improving Discover recommendations.
- Expand the shared place-page experience.
- Strengthen Explorer profiles and scrapbook sections.
- Continue leaderboard and anti-abuse work.
- Improve manager review-management tools.
- Expand automated route and permission testing.
- Remove or formally retire superseded screens.
- Complete runtime testing on Android, iOS and web.
- Prepare production-safe analytics, moderation and operational tooling.

---

Longer-Term Direction

The broader Xplorer vision may eventually include:

- Live local transport discovery
- Taxi booking
- Food ordering and local delivery
- Home-based food sellers
- Local offers and promotions
- AI-assisted local recommendations
- Town-specific launches and community events
- Booking and affiliate integrations
- A broader local-services marketplace

These are future product directions, not promises of functionality in the current build.

---

Documentation

Important project documents include:

CLAUDE.md
RULES.md
DOC-AMENDMENTS.md
docs/PROJECT-LOG.md
docs/REDESIGN-BRIEF.md
docs/REDESIGN-STATE.md
docs/SCREEN-INVENTORY.md
docs/design-system.md
docs/REVIEW_REPUTATION_TEST_PLAN.md

Read the relevant project documentation before making broad architectural or interface changes.

---

Branches

- "main" — original baseline
- "main2.0" — versioned development line
- "main2.0-Dev" — active Xplorer redesign and development branch

Changes should be developed and tested away from the stable branch before being merged.

---

Project Status

Xplorer — active MVP development

The product, architecture and interface are evolving quickly. Documentation and migrations should be updated whenever behaviour changes so that the repository remains the source of truth.
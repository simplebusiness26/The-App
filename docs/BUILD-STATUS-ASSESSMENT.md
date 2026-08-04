# Build Status Assessment — "Disruptor 3 / 3D World Mode" mockup vs. the actual app

Assessed at commit `34af2a8` on branch `claude/app-progress-assessment-x7nf1l`.

**Method and its limits.** This is a source, schema and live-database read. The app
was **not run** — `node_modules` is absent in this environment and there is no
runtime test suite to execute. Every claim below comes from reading `app/`,
`components/`, `supabase/migrations/`, the CI workflows, and querying the live
Supabase project `yzpthslwsvesgndzdqai` directly. Where the answer depends on
runtime behaviour, that is said explicitly rather than guessed.

---

## 1. What the mockup is actually asking for

The image is one screen with eleven distinct capabilities in it:

| # | Element in the mockup | What it requires |
|---|---|---|
| 1 | Photorealistic tilted 3D city | A 3D tile renderer (Google Photorealistic 3D Tiles / Cesium / Mapbox) |
| 2 | `18°C Brighton ⌄` | Live weather API + a city/area model with a switcher |
| 3 | `Exploring as Craig` + avatar | Session identity chip on the map surface |
| 4 | Pills: All / Food / Drinks / Activities / Stays / Parks | A consumer-facing category taxonomy |
| 5 | Card-shaped pins with live state (`Busy now`, `12 Explorers`, `Starts 8:00pm`, `Table for 2`) | Custom map markers + per-place live aggregation |
| 6 | `2.1km` on a pin | Device-location distance maths on the map |
| 7 | `Your Stay` pin with check-in info | Booking/stay linkage to the signed-in guest |
| 8 | Locate-me and `2D/3D` toggle | Map camera controls |
| 9 | Bottom sheet: photo, verified badge, `4.8 (236)`, `0.3km`, `Busy now · 6 Explorers here`, bookmark | Gesture bottom sheet, place imagery, review volume, live presence |
| 10 | Bottom tab bar: Map / Discover / Scan (raised) / Saved / Profile | A persistent tab navigator |
| 11 | Coherent dark design language throughout | A design token system |

---

## 2. What exists today

The app is **not** thin. There are 64 routes across 66 files, 37 migrations, and
genuine end-to-end depth in several areas:

- **Auth** — signup/login/forgot/update-password, `explorer` vs `manager` account
  types, `is_admin` flag.
- **Listings** — businesses, properties, activity clubs, events; add/edit/detail
  screens; ownership claims with an admin approval queue.
- **Reviews** — including QR-verified visits (`listing_qr_codes`,
  `qr_review_verifications`), review media, a scoring/points system.
- **Social layer** — follows, moments, comments, likes, leaderboards, blocking,
  reporting.
- **Link-ups and live discovery** — `linkups`, `linkup_attendees`,
  `live_checkins`, `live_safety_reports`, and a `get_live_discovery` RPC.
- **Manager surface** — dashboard, capability requests, QR generation.
- **Notifications** — table, triggers, deep links, unread badge.
- **Security** — RLS was disabled on the five core tables until 2026-08-03 and has
  since been armed across seven migrations, verified by user impersonation.

That backend depth is the real asset. It is also the part the mockup doesn't show.

---

## 3. Element-by-element gap

| Mockup element | State in the codebase | Gap |
|---|---|---|
| 3D photoreal city | `app/map.js` uses `react-native-maps` with default 2D Google tiles. No Mapbox, MapLibre, Cesium, three.js or deck.gl anywhere in the dependency tree. | **Not started** |
| 2D/3D toggle | Does not exist | **Not started** |
| Weather + city switcher | No weather call anywhere. No `locations`/`cities` table in the live DB (the one in `database/schema.sql` is a documented dead stub). Map hardcodes Brighton at `50.8225, -0.1372`. | **Not started** |
| `Exploring as Craig` chip | Not on the map | **Not started** |
| Category pills | `app/map.js` has four *type* filters — All / Businesses / Properties / Activity Clubs. That's the internal data model, not Food/Drinks/Parks. `components/Categories.js` has consumer categories but is imported by nothing. | **Wrong axis; needs a real taxonomy** |
| Card-shaped pins | Default `<Marker>` teardrops with `pinColor` and a title string | **Not started** |
| `Busy now` / `N Explorers here` | The primitive exists — `live_checkins` + `get_live_discovery` — but it drives a separate list screen (`/live`), never the map, and there is no per-place aggregation or realtime subscription. **0 rows in the table.** | **Data primitive ~30%, surface 0%** |
| Distance on pins | `expo-location` is used in `/live`, not on the map | **Not started** |
| `Your Stay` pin | No booking/stay model links a guest to a property | **Not started** |
| Locate-me button | Not on the map | **Not started** |
| Bottom sheet hotspot card | No sheet. No gesture-sheet dependency. `businesses` does have `rating`, `review_count`, `image`, `photos`. | **Not started (data mostly ready)** |
| Bottom tab bar | **There is no tab bar.** Navigation is an expo-router `Stack` with a header `←/🔔/☰`, where `☰` opens `/menu`, a scrolling list of links. | **Not started** |
| Map tab | Exists at `/map`, 2D. On **web it is not a map at all** — `app/map.web.js` renders a plain list. | **~25%** |
| Discover tab | No such screen. `/live` and `/events` are the nearest things. | **Not started as a tab** |
| Scan tab | `app/scan.js` is real and well built — camera, QR parse, manual fallback. But it is scoped to *verified-review* codes, not general scanning. | **~80%, different purpose** |
| Saved tab | `app/saved.js` is a **38-line placeholder** — "Your favourite places will appear here". No query, no state. Favourites genuinely work elsewhere (`explorer_favourites`, `FavouriteButton`, the grid in `ExplorerProfileScreen`), so this is a screen that was superseded, not one that's hard. | **~5% (but cheap to finish)** |
| Profile tab | `/profile` exists and is substantial | **Exists, needs restyle** |
| Dark design language | `hooks/useColors.js` defines light/dark tokens — and is imported by **1 of 66 screens** (`app/admin/claims.js`). Everything else hardcodes hex. `/` is dark; `/map`'s chrome is white; `Header` is white with a grey border; `PlacesList` is light grey. | **No design system in practice** |

---

## 4. The content problem

Live database, right now:

| Table | Rows |
|---|---|
| businesses | 12 (all 12 with coordinates; 5 with an image; 0 with `photos`) |
| properties | 3 |
| events | 1 |
| activity_clubs | 2 |
| reviews | 15 |
| profiles | 19 |
| linkups | 1 |
| live_checkins | **0** |

The mockup shows a city that feels alive: six pins in one viewport, "12 Explorers",
"236 reviews", "6 Explorers here". Today's database renders roughly eight pins
across the whole of Brighton and would show "0 Explorers" on every one of them.

This is the gap that code cannot close. Populating it means either a POI import
(Google Places' terms restrict caching and display outside Google Maps; OSM or
Foursquare are the licensable routes) or manual/partner onboarding — and the
"Explorers here" numbers need real concurrent users, which is a distribution
problem, not an engineering one.

---

## 5. Foundation debt that will slow any rebuild

- **No runtime tests of any kind.** No jest, vitest, detox or playwright. CI runs
  `npm ci`, `npm audit`, `expo-doctor`, an `expo export --platform web`, and five
  `verify-*.cjs` scripts — which are `fs.readFileSync` + `String.includes()`
  assertions against source text, not executions. `docs/SCREEN-INVENTORY.md` states
  it plainly: *"Nothing here has been exercised at runtime."* All 64 routes read
  UNTESTED.
- **11 orphan routes** with no inbound navigation.
- **1 genuinely dead link** — `/property/reviews/:id` at `app/property/dashboard.js:215`
  resolves to nothing.
- **1 phantom route** — `<Stack.Screen name="auth/verify"/>` declared with no file.
- **Two parallel generations** of the owner dashboards and edit screens, both still
  in the tree; **two admin screens** over the same claims data.
- **Two static mockups still shipping** — `app/place.js` (hardcoded "The Coffee
  House", buttons with no `onPress` at all) and `app/saved.js`.
- **Known open security item** — `account_type` is still self-writable, so a user
  can promote themselves to `manager`. Closing it means moving the signup write
  server-side.

---

## 6. Honest distance estimate

Three separate numbers, because they are three separate problems:

**a) The plumbing behind that screen — roughly 40–50% there.**
Places, reviews, favourites, presence, QR, notifications and auth all exist with
real schemas and RLS. What's missing is per-place live aggregation, a category
taxonomy, a city/area model, and a stay↔guest link.

**b) The screen itself — roughly 5% there.**
A 2D Google map with teardrop pins and four internal-jargon filters. No tab bar,
no sheet, no card pins, no 3D, no weather, no design system. Ten of the eleven
elements above are not started.

**c) The "feels alive" part — 0%.**
12 businesses, 0 live check-ins, 19 profiles, all seed data. Never in front of a
real user.

### Time, for one competent full-time developer

| Workstream | Estimate |
|---|---|
| Tab navigator + shell restructure | 1–2 weeks |
| Design token system, then retrofit ~66 screens | 3–5 weeks (the long tail) |
| Finish `/saved` against `explorer_favourites` | 2–3 days |
| Custom card markers, clustering, locate-me, distance | 2–3 weeks |
| Gesture bottom sheet + hotspot card | 1 week |
| Per-place live presence + realtime + privacy rules | 1–2 weeks |
| Weather + city/area model + switcher | 1 week |
| Consumer category taxonomy + re-tagging existing data | 1 week |
| Web map parity (currently a list) | 1 week, or accept mobile-only |
| Paying down test debt so a rebuild is safe | 2–3 weeks, ideally in parallel |
| **Subtotal — a credible 2D version of this screen** | **≈ 3–4 months** |
| The literal photoreal 3D world | **+2–4 months, high risk** |

### On the 3D specifically

This deserves a blunt paragraph, because it is the headline of the mockup and the
single most misleading part of it.

Google's Photorealistic 3D Tiles have **no React Native SDK**. The routes are: a
WebView running CesiumJS or deck.gl (workable, but janky gestures, heavy battery
drain, and awkward two-way state bridging), a Mapbox native module
(`@rnmapbox/maps` — real 3D terrain and extruded buildings, but stylised, not
photoreal), or writing custom native modules against the tile renderers. Google
bills Photorealistic 3D Tiles per session, so a discovery app whose home screen is
3D carries recurring per-user cost that scales with success.

The realistic outcome is that a shipped 3D mode will look like Mapbox's extruded
buildings, not like the rendered image. **The mockup is an illustration, not a
screenshot of an achievable UI.** Planning against it as if it were a spec will
produce a schedule that cannot be met.

---

## 7. What I'd do next, in order

1. **Decide whether 3D is a launch requirement or a later flourish.** Everything
   else in the mockup is achievable in months; 3D is the item that turns a 3-month
   plan into an open-ended one with recurring cost. Recommendation: ship the 2D
   version of this exact layout first — card pins, sheet, tabs, dark system. It
   captures most of the perceived quality.
2. **Run the app and record what actually works.** 64 routes are UNTESTED. Before
   re-skinning 66 screens, know which ones function. This is days of work and
   changes every estimate below it.
3. **Build the tab bar and the token system first.** They touch everything; doing
   them after the screens means restyling twice.
4. **Delete the dead weight** — `place.js`, the superseded dashboards and edit
   screens, one of the two admin screens, the `auth/verify` declaration. Fix the
   `/property/reviews/:id` link. Fewer screens to restyle.
5. **Finish `/saved`.** It's 2–3 days against a table that already exists and would
   remove a visibly broken tab from the very first build of the new shell.
6. **Solve content before polish.** A beautiful map over 12 businesses still looks
   empty. Decide the POI source and its licensing now, because it constrains what
   can be displayed and cached.
7. **Close `account_type` self-promotion.** Small, and it's a live privilege
   escalation.

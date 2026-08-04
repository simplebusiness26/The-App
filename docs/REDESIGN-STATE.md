# Redesign state

Save to `docs/REDESIGN-STATE.md`.

**This file is the only thing that survives a context reset, a usage
lockout, or a closed terminal.** Claude Code loses everything else. If
this file is stale, a resumed session will re-do finished work or build
on something that never landed.

Read it first, write it last, every session.

---

## Resume prompt

Paste this verbatim at the start of any session, including the first:

```
Read docs/REDESIGN-STATE.md, then docs/REDESIGN-BRIEF.md, then CLAUDE.md
and RULES.md. Do not read anything else yet.

Run: git status && git log --oneline -5 && git branch --show-current

Then tell me:
1. Which packet is next according to the ledger
2. Whether the repo agrees with what the ledger claims — if it doesn't,
   the repo wins and that disagreement is your first report
3. The files you intend to read, and the files you intend to change

Then stop. Wait for my approval before editing anything.
```

The "stop and wait" is not politeness. Unapproved wandering file reads
are the single largest source of wasted usage.

---

## Current position

**Packet in progress:** none
**Last completed packet:** 4 — Quick Access drawer
**Branch:** `main2.0-Dev` (branched from `main2.0`)
**Blocked on:** the two decisions in `DOC-AMENDMENTS.md` — stage model and
palette. Neither is a coding task. Both are yours. The file is now
committed at the repo root; it was missing entirely until 2026-08-04, so
this blocker could not previously be read, only referenced.

Packet 2 proceeded despite the palette decision being open, because the
brief specifies the marker set under the riso rules explicitly and
`docs/design-system.md` is what it points at. **If the palette decision
goes the other way, the marker colours change and Packet 2's colour
assertions change with them.** The glyphs and the structure do not.

**Next action:** Packet 5 (Place page shared layout). Not blocked. Note the
brief cuts Directions (Stage Four) and Book a table / Get tickets (Stage
Five) from it — the section ends without them, and `RULES.md` bans the
placeholder either way.

**One decision for you, from Packet 3.** The tab bar currently shows on the
login and signup screens, because the brief's rule is "hidden on the three
named surfaces, visible everywhere else" and auth is not one of them. It is
arguably wrong — a half-finished signup is easy to wander out of. Adding
`/auth/login` and `/auth/signup` to `FULL_SCREEN_ROUTES` in
`utils/navigation.js` is a two-line change if you want it.

**Open, and the owner's:** the real `business_type` list. The interface
direction document the brief cites is not in this repository. Packet 1
shipped with `bar`, `pub`, `restaurant` as placeholders at the owner's
instruction. Adding the rest is an edit to `utils/taxonomy.js` plus a
migration re-seeding `business_types` — and now also a glyph per new
type, which `scripts/verify-taxonomy.cjs` refuses to let you forget.
Nothing else should change.

## Packet status

| # | Packet | Status | Commit | Verified how |
|---|---|---|---|---|
| 0 | Verification harness | done | `a1e98a1` | 67/67 mount tests; CI red demonstrated (run 16 `failure`), green again (run 18 `success`) |
| 1 | Business taxonomy | done | `623644e` | Migration applied and queried back; 5 constraint scenarios; 111-check taxonomy gate |
| 2 | Marker assignment | done | `fad6887` | 27 marker tests; 233-check override gate; 6 red-then-green demonstrations |
| 3 | Navigation shell | done | `e4a300e` | 92 navigation tests; route inventory diff is +2/-0; 6 red-then-green demonstrations |
| 4 | Quick Access drawer | done | `c7a3f94` | 34 drawer tests; entitlement proved against 2 real accounts in SQL; 6 red-then-green demonstrations |
| 5 | Place page layout | not started | | |
| 6 | Map bottom cards | not started | | |
| 7 | Discover screen | not started | | |
| 8 | Profile and reputation | not started | | |
| 9a | Scoring engine | not started | | |
| 9b | Leaderboard UI | not started | | |
| 10 | Manager Hub | not started | | |
| 11 | Design system pass | not started | | |

Status values: `not started` / `in progress` / `blocked` / `done`.
There is no `mostly done`. A packet with a failing acceptance criterion
is `in progress`, however close it looks.

---

## Session log

Newest first. One entry per session, written even if the session
achieved nothing. Especially then.

Template:

```markdown
### YYYY-MM-DD — Packet N — outcome

**Did:** what actually happened, not what was planned
**Files changed:** paths, with line ranges for anything non-obvious
**Acceptance criteria:** each one, passed or failed, with the command
  that was run and its output
**Stopped because:** finished / usage limit / blocked / broke something
**Exact next step:** the first thing the next session should do
**Unverified:** what is being assumed
```

The **Exact next step** line is the one that matters. Write it as if
the person reading it has no memory of this session, because they don't.

---

### 2026-08-04 — Packet 4 — done

**Did:** Replaced the `/menu` page with a slide-over drawer, and put a real
server-side entitlement behind its Manage section.

- `utils/drawer.js` (new) is every row the drawer can show, as data. Five
  sections, each row carrying a gate. The component renders this; it does not
  decide it.
- `components/QuickAccessDrawer.js` (new) draws it as a right-hand slide-over.
- `context/DrawerContext.js` (new) owns "is it open", because the drawer
  replaced a route with an overlay and both the Header and the layout need it.
- `hooks/useManagerGate.js` + `components/GateNotice.js` (new) stop a
  non-manager opening a listing management screen directly.
- `supabase/migrations/20260804180000_manages_any_listing.sql` (new) is the
  entitlement itself.
- `app/menu.js` **deleted**. `components/Header.js` and `app/index.js` now open
  the drawer instead of pushing to it.

**The entitlement is the packet.** The brief says "Check entitlement
server-side, not just by hiding the section", and that distinction is the whole
difference between a menu and a permission. `public.manages_any_listing()` is
`security invoker`, so it runs as the caller with RLS applied and can only see
listings the caller could already see. A `security definer` version would have
been a way to ask the database about somebody else, which nothing needs.

**Files changed:** `utils/drawer.js`, `components/QuickAccessDrawer.js`,
`components/GateNotice.js`, `context/DrawerContext.js`,
`hooks/useManagerGate.js`, `test/drawer.test.js`,
`supabase/migrations/20260804180000_manages_any_listing.sql` (all new);
`app/menu.js` (deleted); `app/_layout.js`, `app/index.js`,
`components/Header.js`, `app/business/dashboard.js`,
`app/property/dashboard.js`, `app/manager/requests.js`,
`test/navigation.test.js`, `scripts/verify-screen-gates.cjs`,
`scripts/verify-social-layer.cjs`, `scripts/verify-linkups-live.cjs`.

**Acceptance criteria:**

1. Every row in the old menu maps to a drawer row or a tab — **PASS**. The old
   menu is pinned in `test/drawer.test.js` as it stood at `da011c3`, and each
   of its seventeen rows is asserted individually:

   | Old menu row | New home |
   |---|---|
   | Map | Map tab, and Explore |
   | Explore Activity Clubs | Explore |
   | Explore Events | Explore |
   | Profile | Profile tab, and My app |
   | Settings | Account and safety |
   | Live Nearby | Explore |
   | Link-ups | Explore |
   | Check in | Create tab, and My app |
   | Explorer Feed | Community |
   | Find Explorers | Community |
   | Scan Verified Review QR | Create tab, and My app |
   | Explorer Leaderboards | Leaderboard tab, and Community |
   | Blocked Explorers | Account and safety |
   | Manager Dashboard | Manage, or My app when not yet a manager |
   | Admin Dashboard | Account and safety, admin only |
   | Login / Create Account | Account and safety, signed out only |
   | Logout | Account and safety, as an action |

2. Non-manager: Manage absent, and the underlying routes reject direct
   navigation — **PASS**, and proved in the database rather than argued:

   | Caller | `manages_any_listing()` |
   |---|---|
   | no session | `false` |
   | a real Explorer who owns a business | **`true`** |
   | a real Explorer who manages nothing | **`false`** |
   | role `anon` | `ERROR: 42501: permission denied for function` |

   Both accounts are real rows from the live project, selected by query rather
   than invented. `/business/dashboard`, `/property/dashboard` and
   `/manager/requests` now call that function through `useManagerGate` and show
   a refusal instead of themselves.
3. Old menu route removed, no dead imports — **PASS**. `app/menu.js` is gone,
   its `<Stack.Screen>` with it, and nothing references `/menu`. The route
   inventory test records the deletion explicitly rather than by editing its
   before-list, so a route that vanishes *without* being named still fails.

**One place the brief and CLAUDE.md disagreed, and CLAUDE.md won.**

Criterion 2 read literally would gate `/manager/dashboard` on already being a
manager. But that screen is where an Explorer *requests* the capability to
manage something — it is the on-ramp. Gating it would close the only door in,
and it contradicts the account model directly: "Everyone is an Explorer...
Managers unlock extra tools on top of their normal Explorer profile."
`RULES.md` says CLAUDE.md wins when the two conflict.

So the Manage section holds the screens that manage listings that already
exist, and `/manager/dashboard` appears in My app for an Explorer who is not
yet a manager. A gate script now asserts that screen does **not** use
`useManagerGate`, so a later packet cannot quietly close it.

**The link-loss checks moved rather than being deleted.** Three verify scripts
asserted against `app/menu.js`, all of them written after the defect where a
build selected a `profiles` column that did not exist, every role flag stayed
false, and ten links left the menu silently with five gates green. Deleting the
file would have deleted those checks too. They now assert against
`utils/drawer.js` and `components/QuickAccessDrawer.js` — the fail-open rule,
the notice, the fourteen links, and the ban on collapsing `is_admin` and
`account_type` into one role. The drawer fails open for the same reason the
menu had to: it is not a security boundary, so showing a link the caller cannot
use costs them one explanatory screen, while showing none strands them.

**Six checks demonstrated failing before being kept:**

| Broke | Caught by | Message |
|---|---|---|
| dropped `/safety/blocked` from the drawer | `drawer.test.js` + `verify-screen-gates` | row missing, and `expected to contain route:"/safety/blocked"` |
| downgraded the whole Manage section to "signed in" | `drawer.test.js` | `is absent for an Explorer who manages nothing` |
| made the drawer assume the answer instead of asking | `verify-screen-gates` | `must be decided by the manages_any_listing() RPC` |
| removed the gate from `/business/dashboard` | `verify-screen-gates` | `expected to contain managerGate.allowed` |
| gated the on-ramp shut | `verify-screen-gates` | `must not use the manager gate` |
| restored `app/menu.js` | `navigation.test.js` | `removed the routes it said it removed` |

The second of those is worth recording, because the first attempt at it
**passed and proved nothing**: downgrading only the section's own gate changed
no behaviour, since every row inside was still manager-gated and the section
drops out when it has no visible rows. The demonstration only became real once
the rows were downgraded too. A check that cannot be made to fail has not been
tested — it has been assumed.

**Also run:** `npm run test:ci` → **221 passed** (68 route mounts, 27 marker,
92 navigation, 34 drawer); taxonomy 132; markers 273; social 92; live 152 + 39;
linkup nav 20; title-only 28; screen gates 72; seed 3; `npx expo-doctor` 20/20;
`npx expo export --platform web` succeeded, bundle still contains
`/linkups/create`.

**Stopped because:** finished. One packet per session.

**Exact next step:** Packet 5, the place page shared layout. Read it in
`docs/REDESIGN-BRIEF.md` first. It wants one component behind business,
property, park, event, club and link-up, with grep proving no duplicate — and
it explicitly cuts Directions, Book a table and Get tickets. Note `app/place.js`
is a dead stub containing hardcoded mock data ("The Coffee House", 4.8 stars),
which `RULES.md` bans in application code; it is unlinked from all navigation
and is the obvious candidate to become, or be replaced by, that shared layout.

**Unverified.** `Verified: renders. Unverified: behaves` for everything drawn.

- **Nobody has opened the drawer.** It mounts in tests through
  `utils/drawer.js`, and the component itself has never been rendered by a
  person. Its slide animation, its width on a real screen, and whether the
  backdrop dismiss feels right are all unknown.
- The entitlement is the exception and is stronger: `Verified: used`. It was
  exercised with real SQL against the live project, as two real accounts and as
  `anon`, and the results read back.
- The three gated screens have not been opened by a non-manager in the app.
  The database says the function returns false for them; that the screen then
  shows `GateNotice` is asserted by a source check, not by a person.
- `AccessibilityInfo.isReduceMotionEnabled` is called with optional chaining
  and a swallowed rejection, so a platform that lacks it degrades to the slide
  animation rather than crashing. That fallback has not been exercised.
- The Header's hamburger and the home screen's button now open an overlay
  rather than pushing a route. Nobody has tapped either.

---

### 2026-08-04 — Packet 3 — done

**Did:** Gave the app a persistent bottom tab bar — Map · Discover · Create ·
Leaderboard · Profile, centre raised — without moving a single route file.

- `utils/navigation.js` (new) holds the tab set and the hide rule as data and
  pure functions, so both are testable without rendering.
- `components/TabBar.js` (new) draws it. Five hand-authored SVG icons, kept as
  a separate set from the place-marker glyphs.
- `app/discover.js` and `app/create.js` (new) are the two tabs that had no
  screen.
- `utils/tokens.js` (new) is the design-system colour table in code.
- `app/_layout.js` renders `<TabBar/>` below the Stack and gained
  `SafeAreaProvider`.

**The main decision, and the reason this packet was cheap.** The obvious Expo
Router approach is an `app/(tabs)/` group, which means moving the five tab
routes into it. Two reasons not to:

1. The brief wants the bar "hidden on the three named surfaces, visible
   everywhere else". Under a tabs group the bar vanishes the moment anything
   is pushed on top of it, which is most of this app — you would see it on
   five screens and nowhere else.
2. "Nothing deleted, nothing orphaned." Moving sixty route files to satisfy a
   layout is a large way to risk exactly that.

So the bar sits *beside* the Stack, in flow beneath it, and the Stack simply
gets a shorter box. No screen needed to learn about it, no route moved, and
the Android back button still follows the same Stack it always did.

**Files changed:** `utils/navigation.js`, `utils/tokens.js`,
`components/TabBar.js`, `app/discover.js`, `app/create.js`,
`test/navigation.test.js` (all new); `app/_layout.js`; `utils/markers.js` and
`components/MarkerPreview.js` (INK moved to the token module);
`scripts/verify-marker-assignment.cjs`; `.github/workflows/quality-checks.yml`.

**Two places the brief is out of date, where the repo won.**

*Leaderboard is not a placeholder.* The brief says the Leaderboard tab points
at a stub. `app/leaderboards.js` is a finished screen with period and scope
filters, shipped with the Explorer social layer. Pointing a tab at an empty
state instead would have been a regression dressed as progress, so the tab
points at the real screen.

*Two of the three full-screen surfaces do not exist.* The brief says the bar
hides on full-screen photo, QR scan and full-screen map. Only `/scan` exists.
There is no full-screen photo route — `app/moments/[id].js` is a scrolling
detail screen with a photo in it. And there is no full-screen map mode: `/map`
**is** the Map tab, so hiding the bar there would strand a person on the tab
they just opened. `FULL_SCREEN_ROUTES` is a list precisely so Packet 6 can add
its expanded map mode with one line, and a test asserts every route in that
list actually exists.

**Acceptance criteria:**

1. Route inventory before/after — no route lost — **PASS**. Diffed against
   `46a75d8`:

   ```
   22a23,24
   > create
   > discover
   ```

   That is the entire diff: two added, none removed, none renamed. 64 routes
   before, 66 after. The before-list is also pinned inside
   `test/navigation.test.js`, so deleting a screen in a later packet fails a
   test rather than passing quietly.
2. Back behaviour correct on Android hardware back button — **NOT VERIFIED ON
   A DEVICE.** See below. What is asserted is the structural claim it rests
   on: the root layout still renders a `Stack` and not a `Tabs`, so the
   navigator the back button follows is unchanged from what already shipped.
3. Tab bar hidden on the three named surfaces, visible everywhere else —
   **PASS for the one surface that exists**. `isTabBarHidden` is asserted true
   for `/scan` and false for all 65 other routes, individually. The bar also
   renders to nothing on `/scan`, tested by rendering it.
4. Mount tests pass for all five tab roots — **PASS**. Each tab route is
   resolved to a file on disk and mounted; a tab pointing at a missing route
   fails both that test and the inventory test.

**About criterion 2, plainly.** No Android device or emulator was available in
this session, so the hardware back button has not been pressed. Recording it
as passed would be a lie of exactly the kind this ledger exists to prevent.
The honest claim is narrower and worth stating precisely: this packet did not
change the navigator, so it cannot have changed back behaviour. It did not add
a tab navigator, did not move a route, and did not touch `Header.goBack`. If
back was correct before Packet 3, it is correct after. **If it was already
broken, this packet neither fixed nor found it.**

**Design notes worth carrying.**

The tab bar spends none of the three inks, and a gate now enforces that.
An active tab is a place you are, not a state a place is in — if blue meant
"selected tab" here and "this place exists" on the map, it would mean neither.
Active is carried by an ink bar above the tab, a heavier label, and
`accessibilityState={{selected}}`, so it survives being read aloud and being
seen by someone who does not separate those two greys.

The raised Create button is drawn *after* the bar rather than inside it, and
is absolutely positioned in a transparent strip above it. Android clips
children that overflow their parent, so a button that "sits above the bar"
by overflowing would have been cut in half on exactly one platform and looked
fine everywhere else.

`utils/tokens.js` exists because Packet 3 became the second consumer of the
palette. One file needing it is a local constant; two is a table. The gate now
checks the code table and the document hold the same ten colours in both
directions, so a colour cannot be dropped from the design system and live on
in code.

**Six checks were demonstrated failing before being kept:**

| Broke | Caught by | Message |
|---|---|---|
| gave the active tab an ink-blue bar | `verify-marker-assignment` | `uses INK.blue — the three inks carry state` |
| changed one hex in the code token table | `verify-marker-assignment` | 3 failures, both directions of the drift check |
| used an untokenised colour on `/discover` | `verify-marker-assignment` | `#7A5CFF is not in the token table` |
| pointed the Discover tab at `/discovery` | `navigation.test.js` | tab route missing, and its mount test |
| deleted `app/explorers.js` | `navigation.test.js` | `keeps every route that existed before` |
| swapped the `Stack` for `Tabs` | `navigation.test.js` | `still navigates with a Stack` |

**Also run:** `npm run test:ci` → **188 passed** (67 route mounts, 27 marker,
92 navigation, 2 new route mounts); taxonomy 129; markers 270; social 92; live
152 + 39; linkup nav 20; title-only 28; screen gates 65; seed check 3;
`npx expo-doctor` 20/20; `npx expo export --platform web` succeeded and the
bundle still contains `/linkups/create`.

**CI:** run 24 on `9a6a3fb`, conclusion **`success`**, read back from the API
after the run completed.
https://github.com/simplebusiness26/The-App/actions/runs/30930999739

**Stopped because:** finished. One packet per session.

**Exact next step:** Packet 4, the Quick Access drawer. Read it in
`docs/REDESIGN-BRIEF.md` first. Its first criterion is a table mapping every
row of the old `/menu` to a drawer row or a tab — `app/menu.js` is untouched
by Packet 3 and still holds that list, including the notice-on-failure
behaviour added after the ten-links defect. Note its Manage section criterion
says entitlement must be checked **server-side**, not merely hidden.

**Unverified.** `Verified: renders. Unverified: behaves`. **Nobody has seen
the tab bar.**

- The five navigation icons have never been looked at, same as the twelve
  marker glyphs from Packet 2.
- The raised button's placement is reasoned about, not observed. The Android
  clipping problem it avoids is real; whether the button lands where it should
  on a real screen is not known.
- `/create` and `/discover` have never been opened. Every route they link to
  existed before this packet, but no link has been tapped.
- The bar's effect on the 64 screens that predate it is unverified. It takes
  layout height rather than floating, so nothing should be covered — but
  several screens set their own `paddingBottom` and may now be over-padded.
- The Android hardware back button, as above.
- `SafeAreaProvider` was added to `app/_layout.js` for the bottom inset.
  Nothing else in the app used it, and it has not run on a device with a home
  indicator.

---

### 2026-08-04 — Packet 2 — done

**Did:** Made the marker a derived value. A place's icon now comes from its
classification and its colour comes from its state, and there is no way to
set either by hand.

- `utils/markers.js` (new) is the assignment. `markerForBusiness` is the
  pure function the packet asked for; `markerForProperty` and
  `markerForClub` are one-line callers for the two map layers that have no
  `business_type` to read.
- `utils/taxonomy.js` gained a `glyph` on every category and type. The
  glyph lives on the entry rather than in a lookup table keyed by `"bar"`
  somewhere else — that table would be exactly the second list Packet 1
  removed.
- `components/PlaceMarker.js` (new) draws it: 34px circle, 2px ink border,
  16px glyph. Twelve glyphs, hand-authored as SVG path data, because
  `designer.md` refuses a new icon set without asking.
- `components/MarkerPreview.js` (new) is the manager-form preview, wired
  into `ClassificationPicker` so both the add and edit forms get it. It has
  no handler, which is the point.
- `app/map.js` and `components/PlacesList.js` now render markers.

**The map was the thing worth fixing.** Its three pin colours were
`#d63b3b` for a business, `#275bd6` for a property and `#5633a8` for a
club — three colours outside the token table, each chosen by what kind of
listing it was. That is type controlling colour, the precise failure the
packet says to prevent, and it was already shipped. `PlacesList` did the
same job with emoji and a purple card border. Both are gone.

**Files changed:** `utils/markers.js`, `components/PlaceMarker.js`,
`components/MarkerPreview.js`, `test/markers.test.js`,
`scripts/verify-marker-assignment.cjs` (all new); `utils/taxonomy.js`
(glyphs, `glyphForCategory`, `glyphForClassification`);
`components/ClassificationPicker.js`; `components/PlacesList.js`;
`app/map.js`; `app/business/edit/[id].js`; `scripts/verify-taxonomy.cjs`
(+glyph checks); `package.json`; `.github/workflows/quality-checks.yml`.
`design-system.md` → `docs/design-system.md` (see below).

**No migration.** A marker is derived, so there is nothing to store, and a
column would be somewhere for a hand-set value to live and disagree with
the derived one. `businesses` was queried to confirm no marker column
exists; the new gate fails any migration that adds one.

**Acceptance criteria:**

1. Every value in the taxonomy maps to a marker; test asserts no gaps —
   **PASS**. `test/markers.test.js`, 27 tests, all green. It walks
   `allTypePairs()` (10 pairs: 3 types + 7 category-level `unclassified`)
   and asserts each resolves to a glyph that is *drawable*, not merely
   named. A separate assertion pins the glyph set to exactly what is
   reachable, so an orphaned drawing fails too.
2. `unclassified` has a defined fallback marker — **PASS**, and it is a
   chain rather than one icon. `food_and_drink / unclassified` shows the
   cup, because the category is still known; only a row with no category
   reaches the generic ring. This matters for real data: the three `Cafe`
   rows from Packet 1 get a cup, not a shrug.
3. No code path lets a manager set a marker directly — **PASS**.
   `scripts/verify-marker-assignment.cjs`, 233 checks: no marker column in
   any migration, no marker field in any screen, no `pinColor` anywhere,
   no handler on the preview, no setter or override on the assignment, and
   `PlaceMarker` may not import the taxonomy — if it did it would be a
   second assignment, free to disagree with the first.
4. `designer` agent review passes on the marker component — **PASS ON THE
   CHECKS, NOT BY THE AGENT.** See below. This is the one criterion not met
   the way the brief words it.

**About criterion 4, plainly.** The `designer` agent was not run: it is
declared in `designer.md` at the repo root but is not registered as an
agent this session could invoke. Its seven hard checks were worked through
by hand against `components/PlaceMarker.js` and
`components/MarkerPreview.js`:

| # | Check | Result |
|---|---|---|
| 1 | No colour outside the token table | pass — now automated, every hex in the three new files is checked against `docs/design-system.md` |
| 2 | The three inks mean something | pass — a test fails if two business types ever produce two fills |
| 3 | Three faces, three jobs | **deviation** — the split is kept, the faces are not loaded |
| 4 | Borders and hard shadows | pass — 2px ink borders, `shadowRadius: 0`, and a gate that fails a blurred shadow |
| 5 | One signature | pass — no second flourish; the overprint is deliberately not built |
| 6 | Copy | pass — sentence case, no exclamations, "manages" not "owns" |
| 7 | Accessibility floor | pass for this component; two app-wide gaps remain |

Check 3 is a real deviation and not a small one: Archivo, Instrument Sans
and Martian Mono are **not loaded anywhere in this app** — there is no
`expo-font`. `MarkerPreview` uses the platform monospace for the computed
classification and the system sans for the sentence, so the mono/sans
distinction the design system calls "the tell" is preserved while the
actual faces are wrong. That is Packet 11's, and it is app-wide, not
something this packet introduced.

For check 7: the pin is not interactive, so the focus ring and the 44px
target belong to the `Pressable` or native marker around it. Nothing in
the app has focus rings yet — also Packet 11. What this packet does hold
is that state is never carried by colour alone: every marker ships a
sentence (`"Pub. A place that exists."`, `"Bar. Nobody manages this
yet."`) and a test fails if one is empty.

**The overprint is not built, on purpose.** `docs/design-system.md` calls
it "the one memorable thing in this design", and it means a place hosting
something. Nothing in the repository can currently answer whether a place
is hosting anything — that needs events and clubs joined to a place, which
is Packet 5 or 6. Building the disc now would have been dead code. It
belongs to whichever packet first has hosting data.

**`design-system.md` moved to `docs/`.** Every reference in the repository
already said `docs/design-system.md` — the brief twice, `designer.md`
twice, including its "read this first, every time, before touching
anything" instruction. The file was at the root, so that instruction
resolved to nothing and the design agent had been reading no design system
at all. The move makes four existing references correct rather than adding
a fifth spelling.

**Six checks were each demonstrated failing before being kept**, per the
Packet 0 lesson that an unproven gate is not a gate:

| Broke | Caught by | Message |
|---|---|---|
| removed `pub`'s glyph | `verify-taxonomy` | `"pub" has no glyph` |
| pointed a type at a glyph nothing can draw | `markers.test.js` | 3 tests red, including the no-gaps walk |
| put `pinColor="#d63b3b"` back on the map | `verify-marker-assignment` | `sets pinColor` |
| changed `ink-blue` to an untokenised hex | `verify-marker-assignment` | `#3212B6 is not in the token table` |
| made one business type render yellow | `markers.test.js` | `gives every business type the same ink` |
| added `marker_colour text` in a migration | `verify-marker-assignment` | `declares a marker column` |

**Also run:** `npm run test:ci` → 94 passed (67 route mounts + 27 marker);
`verify:social` 92; `verify:live` 152 + 39; linkup nav 20; title-only 28;
screen gates 65; seed check 3 migrations; `npx expo-doctor` 20/20;
`npx expo export --platform web` succeeded.

**CI:** run 22 on `419e6d9`, conclusion **`success`**, all 18 steps green
including the new "Refuse a manually set map marker".
https://github.com/simplebusiness26/The-App/actions/runs/30904417999

That conclusion was read back from the API after the run completed, not
predicted from a tick — Packet 0 recorded that four of its six runs were
`cancelled` by `cancel-in-progress` and rendered as not-green while having
tested nothing. Packet 2 pushed once, so nothing was cancelled.

**One fix that was not in the packet.** Packet 1 turned `category` into a
key, so the search boxes on `/map` and in `PlacesList` stopped matching a
place by what a person would type — the stored value now reads
`food_and_drink`. Both now search the readable classification too. It was
found by using `classificationLabel` for the marker labels, and left in
because a search that silently stopped working is not something to note
and walk past.

**Stopped because:** finished. One packet per session.

**Exact next step:** Packet 3, the navigation shell. Read it in
`docs/REDESIGN-BRIEF.md` first. Its first acceptance criterion is a
route inventory before and after with nothing lost — `test/routes.test.js`
discovers routes from the file tree, so it is the before-list, and it will
fail if a route stops mounting.

**Unverified — and this is the important part of this entry.** Under this
file's own vocabulary, everything here is `Verified: renders. Unverified:
behaves`. **No person has seen a single one of these markers.**

- The twelve glyphs have never been looked at. The tests prove the path
  data reaches the canvas at the right offset; they cannot prove a cocktail
  glass reads as a cocktail glass at 16px. Some almost certainly need
  redrawing once someone opens the app.
- `app/map.js` is the bigger risk. `react-native-maps` renders a custom
  marker child as a native view, and on Android those are known to need
  `tracksViewChanges` handling before they appear at all. The map only
  renders when `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` is set, which per
  `PROJECT-LOG.md` it is not, so this path has never executed. **If a Maps
  key is ever added, check the pins actually draw before anything else.**
  `PlacesList` — the surface that ships today — is the one that matters,
  and it is a plain React Native view.
- The manager marker preview has never been opened. `ClassificationPicker`
  renders it in the mount tests and no person has used the add or edit
  form.
- Nothing was checked against a real device or a Replit build. A Replit
  *rebuild* is needed, not a restart: `EXPO_PUBLIC_*` values are inlined at
  build time.

---

### 2026-08-04 — Packet 1 — done, with a placeholder type list

**Did:** Replaced free-text `businesses.category` with a structured
classification enforced by the database.

- `utils/taxonomy.js` is the single source. `scripts/verify-taxonomy.cjs`
  (111 checks) proves it, and proves it has not drifted from what the
  migration seeded.
- `20260804120000_business_taxonomy.sql`: `business_categories` and
  `business_types` catalogue tables, `business_type` / `secondary_types`
  / `tags` / `category_source` on businesses, backfill, and a composite
  foreign key `(category, business_type)` → `business_types(category,key)`.
- `components/ClassificationPicker.js` replaces the free-text category
  boxes in `business/add.js` and `business/edit/[id].js`.
- `components/Categories.js` deleted — a rival list, imported nowhere.

**The type list is a placeholder, at the owner's instruction.** The
interface direction document the brief cites for categories and types is
not in this repository. The six categories are named in the brief itself
and were used; the types are not, so only `bar`, `pub` and `restaurant`
were seeded. **This is the main thing the next session should know**:
Packet 2 assigns a marker per `business_type`, and there are three.

**Acceptance criteria:**

1. Migration applies cleanly and is reversible — **PASS**. Applied to
   `yzpthslwsvesgndzdqai`. `category_source` preserves the original free
   text; the reversal script is in the migration footer.
2. Backfill run; `unclassified` count reported — **PASS**:

   | category | type | rows | was |
   |---|---|---|---|
   | food_and_drink | pub | 6 | `Pub` |
   | food_and_drink | unclassified | 3 | `Cafe` |
   | unclassified | unclassified | 3 | `Test` (2), `Restaurant test` (1) |

   **6 rows have an unclassified type; 3 have an unclassified category.
   0 rows are null.** `Restaurant test` was treated as junk rather than a
   restaurant — a row named "test" is not evidence of a restaurant.
3. A mismatched category/type is rejected by the database — **PASS**.
   Queried in a rolled-back transaction: mismatch rejected by
   `businesses_classification_fk`; three secondary types rejected;
   secondary repeating the primary rejected; unknown type `wizardry`
   rejected; a valid reclassification accepted.
4. Exactly one exported source — **PASS**. Both drift checks were
   demonstrated failing before being kept: a type added to JS but not
   seeded, and a type key restated in another file.
5. Existing business queries still return rows — **PASS**. As `anon`:
   12 businesses, 7 categories, 10 types.

**Two decisions worth knowing.**

Every category carries its own `unclassified` type. Without it the three
`Cafe` rows would have had to throw away the one accurate fact known
about them; instead they are `food_and_drink / unclassified`.

`category` was converted in place rather than joined by a second column.
A parallel category column is exactly the drift this packet removes.

**Stopped because:** finished. One packet per session.

**Exact next step:** Packet 2, marker assignment from `business_type`.
Before starting, decide whether to proceed with three placeholder types
or supply the real list first — Packet 2's output is a pure function from
type to marker, so a later type list means revisiting it.

**Unverified:** No form has been opened. `ClassificationPicker` renders
in the mount tests and has never been used by a person; the add and edit
flows are `Verified: renders. Unverified: behaves`. The database
behaviour above is `Verified: used` — it was exercised by real SQL and
read back.

---

### 2026-08-04 — Packet 0 — done

**Did:** Built the verification harness. Before this, nothing in the
repository could tell you whether a screen renders — the five `verify:*`
scripts read source text, and had stayed green through two shipped
defects.

- `jest-expo` as the runner (what this Expo version supports; the brief
  says do not add a second framework).
- `test/routes.test.js` discovers routes from the `app/` tree rather than
  a list, so a new screen cannot be added without also being mounted.
  Each mounts inside the same providers `app/_layout.js` uses.
- `test/setup.js` mocks `services/supabase` (it throws at import without
  `EXPO_PUBLIC_*`), `expo-router`, location, image-picker, camera, maps
  and QR. `useFocusEffect` maps onto `useEffect` so loaders actually run
  — otherwise 67 screens mount while exercising nothing.
- CI runs the suite, and now triggers on `main2.0**` as well as `main`.
  It previously triggered only on `main`, so none of this would have run
  on the branch it was written for.
- The three test-data migrations are opt-in behind
  `guestbook.seed_test_data`.

**Files changed:** `jest.config.js`, `test/setup.js`, `test/routes.test.js`,
`scripts/verify-no-unguarded-seed.cjs` (all new); `package.json`
(+`test`, `test:ci`, devDeps, four Expo patch bumps);
`.github/workflows/quality-checks.yml`; `app/business/edit.js`;
`supabase/migrations/20260801160000`, `20260801170000`, `20260802021025`.

**Acceptance criteria:**

1. `npm test` runs and reports counts — **PASS**. `Tests: 67 passed, 67 total`.
2. Every route file under `app/` has a mount test — **PASS**. 66 route
   files, 66 mount tests, plus a discovery guard that fails if discovery
   ever returns an empty list.
3. CI red demonstrated, not assumed — **PASS**. Every conclusion below
   was read back from the API after the run completed, not predicted:

   | run | commit | conclusion | |
   |---|---|---|---|
   | 13 | `fa845da` | success | harness lands green |
   | 14 | `9593cb9` | cancelled | first break attempt — proves nothing |
   | 15 | `878cd5f` | cancelled | its revert |
   | 16 | `067c5f4` | **failure** | **"Mount every route" failed** |
   | 17 | `a1e98a1` | cancelled | its revert |
   | 18 | `57d6ff5` | success | this ledger entry |

   The failure: https://github.com/simplebusiness26/The-App/actions/runs/30898897118
   Green after revert: https://github.com/simplebusiness26/The-App/actions/runs/30899037740

   **Four of six runs are cancelled, and that is structural, not bad
   luck.** `cancel-in-progress` is set on `${{ github.ref }}`, so every
   push kills the run before it. Do not read a run's tick as a verdict on
   its commit without checking `conclusion` — `cancelled` renders as
   not-green and means nothing was tested. Runs 14 and 17 were both
   killed this way, the second while writing this very warning.
4. Web export completes and `app.config.js` validates — **PASS**.
   expo-doctor 20/20; config loads (`name: Guestbook`, `slug: guestbook`).
5. Test-data migrations neutralised and named — **PASS**:
   - `20260801160000_manager_test_activity_club.sql`
   - `20260801170000_second_activity_club_test_data.sql`
   - `20260802021025_events_test_data.sql`
   All three seeded `manager@test.com` rows unconditionally, and the
   first *raised* when that auth user was absent — so `supabase db reset`
   on a clean project failed outright. Schema in those files is
   untouched; only the seed blocks are guarded.

**Two findings worth carrying forward.**

The harness caught a real crash on its first run: `app/business/edit.js`
read `user.id` straight after `getUser()` with no null check, so any
signed-out visitor got a crashed screen rather than a login prompt. Its
property twin already had that guard, which is what makes it a genuine
finding rather than a harness artefact.

Run 14 is the more useful lesson. The workflow sets `cancel-in-progress`
on the ref, so pushing the revert forty seconds after the break killed
the run before it reached the step meant to fail — recorded as
`skipped`, conclusion `cancelled`. Tidying up promptly destroyed the
evidence, and the run list would still have shown a non-green tick beside
a broken commit. Anyone repeating a red-then-green demonstration here
must wait for the failing step to complete before reverting.

It is worth knowing how sticky that trap is: the first version of this
entry claimed run 17 was green. It was cancelled — by the push of this
entry itself. The claim was written as "expected green" and would have
gone in as fact if the conclusion had not been read back afterwards.
Assume nothing about a run you have not queried after it completed.

**Stopped because:** finished. One packet per session.

**Exact next step:** Packet 1, business taxonomy. Read it in
`docs/REDESIGN-BRIEF.md` first — the brief calls it the highest-value
item and the one everything else depends on, and it wants the enum in
exactly one file with server-side validation of `business_type` against
`category`.

**Unverified:** These are smoke tests. They prove each route renders with
an empty Supabase result and no session; they say nothing about
behaviour with real data, and no assertion checks that any screen shows
the right thing. `/settings` still has never been opened by a person.
Under this file's own vocabulary: `Verified: renders. Unverified:
behaves`.

---

### 2026-08-04 — no packet — out-of-process work, plus one live defect

**Did:** Work requested directly by the owner, outside the packet
sequence. Recorded here because the repo now contains changes the packet
table does not explain, and the rule is that the repo wins.

- Committed `DOC-AMENDMENTS.md` at the repo root. Both this ledger and
  `docs/REDESIGN-BRIEF.md` referenced it as the blocker; it existed on no
  branch and had never been committed. Supplied by the owner.
- Added `/settings` — profile link, privacy (area, `show_area`,
  `leaderboard_opt_in`), capability statuses, blocked explorers, password
  reset, log out.
- Fixed a live defect that had removed ten links from `/menu`.

**Files changed:** `DOC-AMENDMENTS.md` (new), `app/settings.js` (new),
`utils/passwordRecovery.js` (new, extracted from
`app/auth/forgot-password.js` so both callers agree on the recovery key
and redirect), `app/menu.js` (loader rewritten, Settings entry added),
`app/profile/edit.js` (privacy fields moved out to `/settings`, gained the
`FeedbackContext` banner it never had), `app/_layout.js` (declares
`settings`), `scripts/verify-screen-gates.cjs` (+28 checks).

**The defect, because it is the useful part of this entry:** the deployed
build asked for `profiles.is_manager`, a column that exists only in an
unapplied migration on an abandoned branch. PostgREST rejected the
select, the role flags stayed false, and every gated menu entry vanished
at once — the eight Explorer links, Manager Dashboard and Admin
Dashboard — with no error shown. Five gate scripts passed and the web
export succeeded throughout. The owner found it by opening the app.

`app/menu.js` now uses `maybeSingle()`, fails open with a visible notice
rather than closed and silent, and treats `is_admin` and `account_type`
as independent — `is_admin ? "admin" : account_type` had been hiding
every Explorer link from admins.

**Acceptance criteria:** none — this was not a packet, so there were none
to meet. What was run:

- `npm run verify:social` → passed (92 checks)
- `npm run verify:live` → passed (152 + 39 checks)
- `node scripts/verify-linkup-create-navigation.cjs` → passed (20)
- `node scripts/verify-linkup-title-only.cjs` → passed (28)
- `node scripts/verify-screen-gates.cjs` → passed (65)
- `npx expo-doctor` → 20/20
- `npx expo export --platform web` → succeeded

Three new checks were each demonstrated failing before being kept:
selecting a `profiles` column no migration creates, dropping a link from
the menu, and reintroducing the collapsed role.

**Stopped because:** finished, and the next thing is a packet, which the
brief says gets its own session.

**Exact next step:** Start Packet 0. Read `docs/REDESIGN-BRIEF.md` Packet
0 in full first. Its point is that the five `verify:*` scripts grep
source text: 331 passing checks were green throughout the defect above.
Nothing in this repository can currently tell you whether a screen
renders.

**Unverified:** `Verified: builds` and `Verified: used` for `/menu` only —
the owner confirmed the menu links returned after a Replit rebuild. The
`/settings` screen has **never been opened by anyone**. Its privacy save,
password-reset flow and capability display are all `Unverified`. Nothing
in this entry has been exercised on a device beyond that one menu check.
Note a Replit *rebuild* is required, not a restart: `EXPO_PUBLIC_*` values
are inlined at build time.

Two things remain unbuilt from the owner's stated requirements, both
deliberately deferred: account deactivation (hide everything, with
listing owners able to keep a deactivated Explorer's review visible as
anonymous and excluded from the average), and the signup bug where email
confirmation returns before writing the `profiles` row, leaving verified
users with no profile at all.

---

## Verification vocabulary

Borrowed from `navigator.md` because the distinction is what stops the
crashing-map-behind-a-green-build failure repeating:

- Owner opened the screen and used it → `Verified: used`
- A mount test passed → `Verified: renders. Unverified: behaves`
- CI went green → `Verified: builds. Unverified: anything else`
- A `verify:*` script passed → `Unverified: greps source, proves nothing`
- Agent read the code and believes it works → `Unverified`

**Never write "working" without naming who checked and how.**

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
**Last completed packet:** 2 — marker assignment
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

**Next action:** Packet 3 (navigation shell). It is not blocked.

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
| 3 | Navigation shell | not started | | |
| 4 | Quick Access drawer | not started | | |
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

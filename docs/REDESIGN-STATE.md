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
**Last completed packet:** 8d — Memories, **applied and verified live**
**Admin dashboard workstream:** Stages 1–7 are live and database-verified.
Stages 4–7 provide audited claim and Manager-capability decisions, recoverable
Club/Event State changes, privacy-bounded moderation, the read-only Explorer
directory, areas/data-quality reporting and append-only audit history. The five
planned migrations and one forward correction are applied to Xplorer. The new
screens still need the owner's start-to-finish device test.
**Last session:** Reconciled this ledger against the repository and the live
database after the admin workstream, then applied 8d. The reconciliation found
the ledger wrong on one point: it claimed 8d's was the only unapplied migration
in the repository, and **there were two** — `20260805140000_pin_search_path_on_
place_helpers.sql` had been committed on `c9356c2` and never applied or
recorded here. Both are now live, plus one forward correction. The archive
boundary — the whole reason 8d exists — is verified against real accounts.
**Branch:** `main2.0-Dev` — the only development branch. Before new development,
the confirmed `ba97d32` baseline was synchronised to `main2.0` and `main` at the
owner's request. All newer work remains only on `main2.0-Dev`; no feature branch
or pull request was created.
**Packet order from here:** 8f2. 8b and 8f1 are done. The owner split the ledger's old
8f into **8f1** (shared activity read model + living-map integration) and
**8f2** (feed ranking and trending), and put 8f1 first so the map gets the
activity before the ranking does. 8b (My Map) is now unblocked: it reads
`explorer_memories`, which exists.
**Blocked on:** the stage-model decision in `DOC-AMENDMENTS.md`. **The palette
decision is resolved as of 2026-08-10 — riso stays**, the owner having deferred
the call; see that file and the entry below. Nothing in the redesign is blocked
on colour any more.

Packet 2 proceeded despite the palette decision being open, because the
brief specifies the marker set under the riso rules explicitly and
`docs/design-system.md` is what it points at. **If the palette decision
goes the other way, the marker colours change and Packet 2's colour
assertions change with them.** The glyphs and the structure do not.

**Both decisions below have been answered by the owner and are resolved —
kept here as a record, not as open questions.**

1. **Should your own My Map remember check-ins after they expire? — resolved.**
   The owner's answer was to introduce **Memories**: an explicit, opt-in,
   separately-created artifact distinct from the ephemeral check-in itself.
   My Map (8b, still not started) will read Memories, never `live_checkins`
   history — this sidesteps the "surfacing something promised to be
   temporary" problem entirely rather than picking a retention window.
   Memories is scoped as its own packet, 8d, with a full revised design owed
   before it is coded (see "Exact next step" below).
2. **What does "Review Reputation" mean? — resolved, and built (8c).** Not
   QR-verification share as I'd guessed — the owner confirmed **endorsement**:
   "how many people found this user's reviews useful", using `social_likes`
   with `target_type='review'`, surfaced as total endorsements, reviews with
   ≥1, most useful review, and average per review. Done, see the 8c entry
   below.

Also note **Explorer Score does not exist yet** and belongs to Packet 9a.
8a should not label `total_points` as one.

**The 5c privacy review is in the session log** and its conclusion is worth
carrying: the meeting point is enforced by RLS, verified against the live
project with real accounts. The client-side check is a second lock, and a
gate now fails if either is removed.

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
| 5a | Place layout: business, property | done | `893a182` | 14 place-page tests written before the refactor and green after; 35-check layout gate; 8 red-then-green demonstrations |
| 5b | Place layout: events, clubs | done | `8d843fb` | 32 place-page tests, 18 new, written before the rewrite and green after; 75-check layout gate; 7 red-then-green demonstrations |
| 5c | Place layout: link-ups (privacy gate) | done | `26cb608` | Privacy review verified in SQL (creator sees 1 row, non-member 0); 42 place-page tests; 96-check layout gate; 7 red-then-green demonstrations |
| 6 | Map bottom cards | done | `f4a02da` | 19 map-card tests; 16-check gate; map position asserted from MapView's own props; 6 red-then-green demonstrations |
| 7 | Discover screen | done | `6d95c5a` | 24 discover tests; 30-check gate; 8 red-then-green demonstrations |
| 8a | Profile: three figures and tabs | done | | 9 tests; 8 red-then-green demonstrations; Explorer Score deliberately absent until 9a builds it |
| 8b | Profile: My Map, sourced from Memories | done | | 21-check gate; 12 tests; 10 red-then-green demonstrations; three independent owner locks; **never opened by a person** |
| 8c | Review reputation and endorsements | done | `93baa0e` | 32-check gate; 5 jest tests; 6 red-then-green demonstrations; self-endorsement block, duplicate rejection, live figures and cleanup verified against real rows on `yzpthslwsvesgndzdqai`; CI run 38 `success` |
| 8d | Memories (two-phase lifecycle, private archive) | done, **applied and verified live** | `42b695d` | 57-check gate; 13 tests; 409 total; migration + 1 forward correction applied to `yzpthslwsvesgndzdqai`; the phase boundary proved from 4 callers with RLS on, including a friend losing access at expiry |
| 8e | Canonical places and areas, entity/location follows, Moment visibility | done, **applied and verified live** | `0578aec` | 136-check gate; 17 tests; 12 red-then-green demonstrations; 5 migrations applied to `yzpthslwsvesgndzdqai`; 15 behaviours verified against real accounts with RLS on, including the friends-only boundary from four callers |
| 8f1 | Shared activity read model + living-map integration | done | | 36-check gate; 21 tests; 9 red-then-green demonstrations; no migration needed — the read model already existed; live shape confirmed on `yzpthslwsvesgndzdqai` |
| 8f2 | Feed ranking and trending (source reasons, place activity) | designed, not started | | |
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

### 2026-08-10 — Palette resolved, and the overprint finally built

**Did:** Closed the palette blocker that has been open since 2026-08-04, and
implemented the signature `docs/design-system.md` has specified from the start
and nothing had ever drawn.

**The decision: riso stays.** The owner deferred it. That is what
`DOC-AMENDMENTS.md` already recommended, and the case has only strengthened —
twelve packets are built on that token table, and `utils/tokens.js`, the marker
gate and every tokenised screen encode it. Switching would invalidate all of
them to gain a palette the document itself calls "like every other local app".
The brief's structural ideas were already ported; its colours now never will be.

**The consequence, and how it is paid.** The product names more states than the
palette has inks — an Event moves through upcoming, starting soon, live, busy,
finished, and there are three inks with one reserved for offers. 8f1 shipped
with every activity pin the same pink, and recorded honestly that the map
therefore could not show "happening right now" apart from "on Saturday".

**The answer was already written down.** `design-system.md` line 77:

> "**Overprint** — a place hosting something. A second pink disc sits behind,
> offset `translate(4px, -4px)` ... Deliberate misregistration, like a flyer run
> through the press twice."

Named there as "the one memorable thing in this design", and never built. So
liveness is a second **channel**, not a fourth colour: same ink, offset disc.
The redesign brief wanted "pulse/glow on active markers" — a glow is banned
outright — so the brief's intent survives in the design system's own vocabulary
rather than against it.

**Built in `components/PlaceMarker.js`.** `react-native-svg` has no
`mix-blend-mode`, so the multiply is approximated with opacity; the ink is
unchanged, which is what keeps it inside the table. Only pins carrying the
overprint get the extra 4px of canvas, so **every existing pin keeps its exact
geometry** rather than being nudged for a feature it does not use.

Derived in `utils/markers.js` from `state === "live"`, never passed in. Four new
gate checks: the flag must be derived, the pin must read it, the disc must reuse
the marker's own ink, and no pulse/glow/halo may appear.

**Also:** `REQUIRE_BROWSER=1` is now set in CI. The browser gate could
previously skip silently when no Chromium was found, which is precisely the
weakness it exists to remove. GitHub's ubuntu runners ship Chrome; if one ever
does not, this now fails loudly, which is the right way to learn that.

**Ran:** `npm run test:ci` → **467 passed across 23 suites**; marker gate 342;
every other gate green; browser gate 42/42 in binding mode.

**Unverified:** **nobody has seen the overprint.** It is asserted as a descriptor
flag and as SVG structure, not looked at. Whether 4px of offset at 0.55 opacity
reads as deliberate misregistration or as a rendering fault is a judgement only
the owner can make, and it is the first visual change in this project that is
purely aesthetic. The opacity is one number in `PlaceMarker.js` if it wants
tuning.

---

### 2026-08-10 — The 0,0 bug, found in the save paths as well as the reads

**Did:** Extracted `utils/coordinates.js` and fixed the same defect in eight
places. `Number(null)` and `Number("")` are both `0`, and `Number.isFinite(0)`
is true, so the obvious coordinate check —

```js
Number.isFinite(Number(row.latitude)) && Number.isFinite(Number(row.longitude))
```

— accepts a row with **no** location and treats it as one sitting in the Gulf of
Guinea.

**The reads were the half already known.** Packet 8b hit it on Memories and
recorded that `app/map.js` carried the same shape. Three copies existed, which
is exactly the point RULES.md says to extract at.

**The save paths were not known, and are worse.** Four guards existed
specifically to stop a listing being written without a location, and none of
them worked:

| File | What it let through |
|---|---|
| `app/business/edit/[id].js` | an empty coordinate field saved the business at 0,0 |
| `app/property/edit/[id].js` | same, for a property |
| `app/activity-clubs/edit/[id].js` | same, for a Club |
| `utils/events.js` | same, for an Event |
| `components/LocationPicker.js` | centred the picker at 0,0 for a listing with no location |

A guard that does not guard is worse than no guard, because it is the reason
nobody looks again.

**The distinction the helper exists to hold:** `0` is a real coordinate and must
be kept; the *absence* of a value must be rejected. After `Number()` those are
indistinguishable, which is the whole trap.

**Live data check before deciding severity:** businesses, properties, activity
clubs and events all have complete coordinates today, so nothing is currently
mis-plotted. One `public_place` has none, and no map surface renders public
places yet. **This was a landmine, not an active fault** — recorded that way
rather than claimed as a live fix.

**Files:** `utils/coordinates.js`, `test/coordinates.test.js` (10 tests) — new.
Changed: `app/map.js`, `components/MyMap.js`, `utils/liveActivity.js`,
`components/LocationPicker.js`, `utils/events.js`, and the three edit screens.

**Two red demonstrations:** restoring the naive `coordinate()` fails 3 tests;
restoring the old Event guard fails the one that matters — an empty coordinate
being accepted.

**Ran:** `npm run test:ci` → **465 passed across 23 suites** (455 before, +10);
every source gate green; the browser gate passes 42/42 routes.

---

### 2026-08-10 — A browser gate, closing the hole every packet fell through

**Did:** Built `scripts/verify-browser.cjs`. It serves the exported bundle,
drives real Chromium, loads **42 routes** and fails on an uncaught render error.

**This is the check that was missing for twelve packets.** Every packet has
shipped screens marked "Verified: renders. Unverified: behaves", and the
`react-native-maps` crash survived all of them while 455 tests passed. It could
not have been otherwise: `test/setup.js` **mocks** `react-native-maps`, because
the module cannot load under Node — and that mock is exactly what makes a
native-only import look healthy. Jest was structurally incapable of seeing it.

**Zero new dependencies.** Node 22 ships a WebSocket client, so it drives Chrome
DevTools Protocol directly. Adding puppeteer or playwright needs asking, and a
verification tool that itself needs a new dependency tends never to get run.
`playwright-core` is present in this container but absent from `package.json`,
so depending on it would have broken on the next `npm ci`.

**It caught the real bug.** Reintroducing the `react-native-maps` import into
`MyMap` fails the gate on `/profile` and `/profile/[id]` — the exact two routes,
from the exact defect that produced the black screen.

**Two versions of this gate proved nothing, and both were caught before it
shipped.**

1. The first run reported 13 CORS failures that were entirely the harness's own
   doing: the stub answered no preflight. A gate that cries wolf gets switched
   off. Fixed by echoing the requested headers rather than enumerating them —
   enumerating broke again the moment supabase-js sent `x-supabase-api-version`.
2. **The more dangerous one: it passed 42 routes while rendering the login page
   twenty times.** With no session, every signed-in route redirects to
   `/auth/login`. The giveaway was identical 285-character bodies. It now
   installs a session before the first script runs, and **fails any non-auth
   route that lands on the login screen** — the trap is now the assertion.

Also: the admin gate asks the database, not the profile row, so all eight admin
screens rendered the same 121-character "Admin access required" notice and none
of their content was exercised. The stub answers `guestbook_is_admin` as true;
those screens now render 252–846 characters of real content.

**Wired in** as `npm run verify:browser` and a CI step (`DIST_DIR=dist-ci`). It
**skips loudly** when no Chromium is found rather than failing the build, since
this runner's browser availability is unconfirmed. **Set `REQUIRE_BROWSER=1` in
the workflow once that is checked** — until then this is a gate that can be
silently absent, which is the weakness it exists to remove.

**Ran:** 42/42 routes render with no uncaught error, against the same bundle the
published deployment serves.

**Unverified:** it asserts a screen does not *throw*; it does not assert a screen
is *correct*. Content still needs a person. The stub returns one generic row
shape for every table, so a screen can pass here and still be wrong about real
data — as `/live` showed, where a stub row missing `item_type` produced a crash
the real RPC could never cause.

---

### 2026-08-10 — The preview was never rebuilt, and that cost a whole session

**Three rounds of "still blank" were spent on a preview running old code.**

`serve-preview.cjs` serves a static `dist/`. Pulling the branch does nothing;
restarting the preview does nothing. Only `expo export` changes what is served,
and `replit.md` says so plainly at line 60. Nobody checked.

It was settled the moment `/health` returned `{"status":"ready"}` with no
`commit` and no `builtAt` — fields added in `356eea3`. The preview was not just
serving a stale bundle, it was running a stale *server process*, so none of the
fix, the error boundary or the build stamp had ever been on that device.

**The rule this earns:** before debugging any reported screen failure, confirm
which commit the preview is serving. `/health` now answers that in one tap.
A bug report from an unknown build is not evidence.

**Second lesson, about verification.** Two wrong diagnoses were reached by
reading code and one by a bundle-diff that could not have detected the problem.
The thing that actually worked, both times, was building the real web bundle and
loading it in Chromium — which is available in this environment and had never
been used in twelve packets. Jest mounting a component proves it does not throw
in Node with mocked native modules. It says nothing about a browser.

**The owner published the app**, and that settled it. The deployment serves
`entry-235a23372d0408d9149c9f0e3903ad58.js` — **byte-identical to the bundle
built and crawled locally in Chromium**, where `/profile` renders correctly. It
contains every marker of the fixes (`Something broke on this screen`,
`Only you can see this map`, `AVG SCORE GIVEN`, `Happening`).

So the fix was live and working the whole time on the deployment. The URL being
tested was the workspace preview, whose long-running node process still had the
old `serve-preview.cjs` — which is why its `/health` had no `commit` field.

**`/health` now reports the entry bundle filename as well.** A deployment has no
`.git` and no git binary, so both `.git` and `replit-start.sh` record the commit
as "unknown" there. Expo hashes the bundle name from built content, so it always
survives and is the identity that actually matters: two servers reporting the
same `bundle` are running byte-identical code. That comparison is what proved
the deployment matched a verified build, and it is now available in one request.

**Every route was crawled in a real browser for the first time.** 26 routes
loaded against the production bundle; all render. The one crash the crawl
produced (`/live`, `item.item_type.replace`) came from the crawl's own stub
rows omitting `item_type`, which `get_live_discovery` always sets — a fixture
artifact, not a live defect, and recorded as such rather than "fixed". The
error boundary caught it and printed it, which is the boundary doing its job.

---

### 2026-08-10 — Blank profile screen — investigated in a browser, not guessed

**The owner reported that profiles open to a blank screen with nothing
accessible.** This entry records the investigation because two confident
diagnoses were wrong before the right one, and the method that found it is
worth more than the fix.

**Wrong diagnosis 1: the `activity_memberships` query 8a added.** Checked
against the live project — the foreign key to `activity_clubs` exists, RLS is
on with 5 policies, and `get_explorer_leaderboard`, `get_explorer_memories` and
`get_explorer_review_reputation` all exist and are executable. The query
returns rows or `[]`; it does not throw.

**Diagnosis 2 was right, and the test of it was wrong — twice over.**
`app/map.web.js` exists precisely so the web map never imports
`react-native-maps`, and 8b imported `MapView` straight into
`components/MyMap.js`, which the profile imports. I then "disproved" it by
building with and without the import and finding byte-identical bundles, and
moved on.

**That test was meaningless.** Metro *bundles* a module but only *evaluates* it
when something requires it. `react-native-maps` is in the web bundle either
way, via the route manifest; it only runs when an imported module pulls it in —
and `MyMap` did. Comparing bundle contents could never have shown that.

Proven properly afterwards, by loading the built page in Chromium with
`MapView` actually used in `MyMap`:

```
TypeError: (0 , r(...).codegenNativeComponent) is not a function
```

react-native-maps evaluating on web and failing. With the platform split in
place the same page renders the full profile with zero console errors. **That
crash is the black screen**, and it explains the symptom exactly: React 18
unmounts the whole root, so the header and tab bar disappear too.

**What actually found it: loading the built page in Chromium.** The profile
route rendered its header and tab bar and then nothing — no message, no
spinner text, nothing to tap. `loadProfile` had **no `try`/`catch`**, so any
rejected or never-settling promise skipped `setLoading(false)` and left the
screen on a textless spinner permanently. That is indistinguishable from a
blank screen, and it is a defect that predates 8a — 8a only added another
await to an already unprotected chain.

**Fixed, and confirmed in the browser under the original failing conditions:**
the same page now reads "Profile unavailable / This profile could not be
loaded. / Try again" instead of rendering nothing.

- Every await is inside a `try`, with `setLoading(false)` in `finally`.
- A 15s timeout, because a request that never settles fires nothing at all —
  a rejection is not the only route to a blank screen.
- The timeout is cleared in `finally`. Left running it outlived every
  successful load and kept Jest from exiting, which is how the leak was found.
- The error state gained a **Try again** control; it previously offered no way
  out at all.
- The Clubs read is caught separately: one tab failing must not cost the whole
  profile.

**The fix.** `MyMap` no longer imports `react-native-maps`; the map moved to a platform-split
`MemoryPins.js` / `MemoryPins.web.js` with a shared `MemoryRow.js`, matching the
`app/map.web.js` convention the repo already had. The gate now enforces the
general rule: **a file may import `react-native-maps` only if a `.web.js`
sibling exists**, over every file in `app/` and `components/`. Demonstrated by
deleting `app/map.web.js` and by putting the import back into `MyMap.js`.

**The lesson worth keeping: jest cannot catch this class at all.**
`test/setup.js` mocks `react-native-maps`, and the mock is what makes a
native-only import look fine. Every profile test passed throughout. A screen
that renders in `react-test-renderer` has not been shown to render in a
browser, and this project has twelve packets of screens in that state.

**Files:** `components/MemoryPins.js`, `components/MemoryPins.web.js`,
`components/MemoryRow.js` — new. Changed: `components/ExplorerProfileScreen.js`,
`components/MyMap.js`, `scripts/verify-my-map.cjs`,
`scripts/verify-living-map.cjs`, `test/profile-scrapbook.test.js`.

**Ran:** `npm run test:ci` → **455 passed across 22 suites** (451 before, +4);
every gate green; production web export succeeds.

**An error boundary now exists, and there was none anywhere before.** React 18
unmounts the entire root when a render throws uncaught, which is why a crash on
one screen produced a completely black page — no header, no tab bar, no
message, nothing to tap, and no way for the person looking at it to report
anything more useful than "it's blank". `components/ErrorBoundary.js` wraps the
app in `app/_layout.js` and prints the error and the component stack as
selectable text. It is deliberately plain so it cannot itself throw. It is the
floor under everything that gets missed, not a substitute for handling errors
where they happen.

**Unverified:** the owner has not yet confirmed the fix on their device. The
crash and the fix are both reproduced in Chromium against the real bundle.

---

### 2026-08-10 — Packet 8a — three honest figures and the scrapbook

**Did:** Replaced the profile's two ambiguous pills with three separately
labelled figures, and its flat run of sections with the brief's five scrapbook
tabs.

**Explorer Score is deliberately not one of them.** The brief names Explorer
Score, Average Review Score and Review Reputation. Explorer Score does not
exist — it belongs to 9a, which builds the scoring engine and awards points
server-side. `total_points` is review points and nothing else, so labelling it
"Explorer Score" would name a thing 9a then has to contradict. The three
shipped are **Avg score given**, **Review points** and **Review reputation**,
each saying exactly what it counts. The brief's criterion is "three figures
visually distinct and individually labelled", which this meets; its *naming* of
the third is what 9a still owes.

"Avg score given" carries the brief's other instruction. An Explorer cannot
receive a review — RULES.md: reviews attach to places, clubs and events — so
"AVG RATING" was ambiguous in a way that mattered.

**The tabs:** Adventures (Memories + Moments), Reviews (gallery, reviews, video
reviews), My Map, Collections, Clubs. The old Videos/Moments toggle is gone;
Moments belong with Adventures and videos with Reviews, and the toggle was a
third navigation idea on a screen that now has one.

**My Map is `ownerOnly` in the tab list**, which is how "a profile of another
Explorer shows strictly less than your own" holds by construction. A visitor is
not shown an empty My Map — the tab is not in their list.

**Clubs reads approved memberships only.** A pending application is this
Explorer asking, not a Club they are in; listing it on a profile any visitor can
read would publish a request that was never accepted.

**Files:** `test/profile-scrapbook.test.js` (9 tests) — new. Changed:
`components/ExplorerProfileScreen.js`.

**Eight checks demonstrated failing before being kept.** Three of the first
attempts proved nothing: two substitutions hit an explanatory comment rather
than the rendered label, and one perl escaping error meant the file was never
modified at all — a demonstration that "passes" because the mutation silently
failed is worse than none, because it reads as evidence.

**One test was genuinely weak and was rewritten.** It asserted the third figure
by looking for "REVIEW REPUTATION" anywhere in the page text — and the
reputation *card* further down carries that same phrase, so deleting the figure
entirely left it green. The three figures now each carry their own
`accessibilityLabel` and the test asserts those. **That is the twelfth time in
this project a check has looked convincing and proved nothing.** The rewrite
also gave the figures spoken labels they should have had anyway.

**A structural near-miss worth recording.** The first attempt at this refactor
was made as a sequence of Edits and left the file with a duplicated render
block — 1004 lines, two `return(` for the same branch — while `routes.test.js`
still passed 77 of 79. It was thrown away with `git checkout` and redone as one
scripted pass with asserted anchors and an ordering check. **A large JSX
restructure done as incremental string edits is not reviewable and the smoke
tests do not catch it.**

**Ran:** `npm run test:ci` → **451 passed across 22 suites** (442 before, +9);
every gate green; `npx expo export --platform web` succeeded.

**Stopped because:** finished.

**Unverified:** nobody has opened a profile. The tabs, the three figures and the
Clubs list are `Verified: renders` only. `activity_memberships` has **no rows
for any test account**, so the Clubs tab is proved by fixture and has never
returned a real Club. The reputation card below the figures now repeats the
endorsement total that the third pill shows — that is duplication a designer
should look at, not a defect.

---

### 2026-08-10 — Packet 8f1 — the living map, with no migration

**Did:** Closed the gap `CLAUDE.md` calls the highest-priority fix in the
project: live data "lives on a separate `/live` screen and never reaches the
main map".

**The read model already existed, and finding that out changed the packet.**
`get_live_discovery` has returned Link-ups, check-ins, events and club sessions
in one uniform shape — type, position, start, end, status, deep link — since
`20260802211700`. Nothing needed building in the database. What was missing was
a normaliser and the map calling it. **So 8f1 ships with no migration at all.**
Writing a second RPC for data the first one already returns would have been
RULES.md's "second table for the same noun", one layer up.

**The part that would have been easy to get wrong.** `EXPO_PUBLIC_GOOGLE_MAPS_
API_KEY` is not set, so `app/map.js` renders `PlacesList` and the `MapView`
branch never runs. Adding the living layer only to `app/map.js` would have
closed the gap in a file nobody renders, passed every test, and left the
shipping path exactly as it was. **Both surfaces get it, and the gate fails if
either loses it.**

**Verified against the live project before trusting the shape.** Called
`get_live_discovery` as a real Explorer inside a rolled-back transaction: 4
Link-ups, 3 Events, 1 club session — all with positions and start times — and
**15 `place` rows with positions and no start time**. Those 15 are businesses
the map already draws statically, so without the `STATIC_KINDS` exclusion the
map would have stacked a second pin on fifteen existing ones and called each
duplicate "happening". That exclusion is the difference between a living map
and a visibly broken one, and it was confirmed by real data rather than reasoned
about.

**The ink problem is real and is not solved, only stated.** design-system.md
gives three inks and reserves one for offers. `CLAUDE.md` describes events
moving through "upcoming, starting soon, live, busy, finished". Five into two
does not go. Every activity pin is therefore pink — "something is scheduled or
happening here", which is true of all of them — and live / soon / scheduled is
carried by the pin's spoken label and the row, never by colour. The
accessibility floor already required those words. **But the map cannot show
"live now" and "on Saturday" apart at a glance, and that is a product decision
the owner has to make, not one to paper over with a fourth colour.** See the
question at the end of this entry.

**Files:** `utils/liveActivity.js`, `scripts/verify-living-map.cjs` (36 checks),
`test/living-map.test.js` (21 tests) — all new. Changed: `app/map.js` and
`components/PlacesList.js` (the living layer and the Now/Tonight/Weekend
filters), `utils/markers.js` (`markerForActivity`, and `buildMarker` gained an
optional `stateSentence` that cannot touch fill, glyph or state),
`package.json`, `.github/workflows/quality-checks.yml`.

**Nine checks demonstrated failing before being kept**, the load-bearing one
being the living layer removed from the shipping path while `app/map.js` kept
it.

**Three of those first demonstrations proved nothing, all the same weakness.**
`get_live_discovery` still matched inside `get_live_discovery_DISABLED`, and
`toActivities` and `ACTIVITY_STATE_SENTENCE` were each satisfied by the import
line alone after every call site was deleted. All three now match a *use* —
`rpc("...")`, `name(`, `NAME[` — not a mention. **That is the ninth, tenth and
eleventh time a check in this project has looked convincing and proved
nothing.** Every one was found by trying to break it.

**Every time window takes an injected clock.** A time filter that reads the wall
clock passes on a Tuesday and fails on a Saturday. The gate asserts that the
only readings of `Date.now()` in the model are default parameter values.

**Ran:** `npm run test:ci` → **442 passed across 21 suites** (421 before, +21);
living-map 36; my-map 21; memories 57; screens 342; markers 330; taxonomy 154;
places 136; social 92; live 152 + 39; place 96; cards 16; discover 30;
reputation 32; `npx expo export --platform web` succeeded with
`get_live_discovery` present in the bundle.

**Stopped because:** finished.

**Unverified:**
- **Nobody has opened the map since this landed.** Both surfaces are `Verified:
  renders` only, and the `MapView` branch has never rendered at all because no
  key is set.
- The map does **not** call `refresh_live_system()` before reading, although
  `app/live.js` does. That function writes, and a write on a map read path is
  the wrong trade; expiry is enforced by `get_live_discovery`'s own
  `expires_at > now()` predicates. If stale rows ever appear on the map and not
  on `/live`, this is the difference.
- Distance is not used. The map passes `p_latitude`/`p_longitude` as null, so
  the 25km radius never applies and the window is the full 168 hours. Location
  permission on the map is its own piece of work.
- No check-in appeared in the live sample, so the `checkin` branch of the
  normaliser is proved by fixture only.

---

### 2026-08-10 — Packet 8b — My Map, owner-only

**Did:** Built My Map on the profile, sourced from Memories. The 2026-08-04
privacy review is the spec, and its three rules are now source contracts rather
than a paragraph in this file: own profile only, never `live_checkins`, and no
publication flag, share control or sort order.

**Absent, not empty.** A visitor gets no element — `tree.toJSON()` is null, and
the request is never issued. An empty section is a thing a later change can
accidentally populate; a section that was never mounted is not.

**Three locks, deliberately redundant.** `ExplorerProfileScreen` mounts it only
for the owner; `MyMap` compares `viewerId` to `ownerId` again and returns null;
`get_explorer_memories` is SECURITY INVOKER so RLS refuses a third time. Any one
suffices, which is exactly why the gate fails if either client lock is removed.

**A Memory's phase is not a fourth ink.** It would have been easy to colour an
archived Memory differently, but the three inks describe what is true of a
*place*, and a Memory's phase is a fact about who may read a row. It is said in
words, which is also the only form a screen reader gets.

**Files:** `components/MyMap.js`, `scripts/verify-my-map.cjs` (21 checks),
`test/my-map.test.js` (12 tests) — all new. Changed: `utils/markers.js`
(`markerForMemory`, `MEMORY_TYPE_LABEL`), `components/ExplorerProfileScreen.js`
(the owner-gated mount), `scripts/verify-marker-assignment.cjs` (MyMap joins the
tokenised list), `package.json`, `.github/workflows/quality-checks.yml`.

**Ten checks demonstrated failing before being kept**, including both locks
removed independently, the scope narrowed to the profile shelf, an `is_public`
flag introduced, the maps-key fallback deleted, and the source swapped to
`live_checkins`.

**Two of those first demonstrations proved nothing, and both were my fault.**
One was a bad demonstration — the substitution hit a comment, so the code never
changed. The other was a genuinely weak check: `markerForMemory` matched the
*import line*, so deleting every call site left the gate green. It counts call
sites now. **That is the eighth time in this project a check has looked
convincing and proved nothing**, and again it was found by trying to break it
rather than by reading it.

**A real bug, caught by a test rather than by review.** `hasCoordinates` used
`Number.isFinite(Number(row.latitude))`, and `Number(null)` is `0`, which is
finite — so a Memory with no location was plotted at 0,0 in the Gulf of Guinea.
A private Memory is allowed to have no location, so that null is the common case
here, not the edge one. **`app/map.js` has the same shape and the same bug** for
businesses, properties and clubs with null coordinates; it is recorded here and
deliberately not fixed in this packet, which does not own that file.

**Ran:** `npm run test:ci` → **421 passed across 20 suites** (409 before, +12);
my-map 21; memories 57; screens 342; markers 330; places 136; social 92; live
152 + 39; taxonomy 153; place 96; cards 16; discover 30; reputation 32.

**Stopped because:** finished.

**Unverified:** nobody has opened a profile and looked at My Map. The map
branch in particular is `Verified: renders` only — `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`
is not set, so the **list fallback is the shipping path** and the MapView branch
has never rendered on a device. No Memory exists in the live database, so every
assertion here is against fixtures, not real rows.

---

### 2026-08-10 — Packet 8d — applied live, archive boundary verified

**Did:** Reconciled this ledger against the repository and the live project
after the admin workstream, then applied 8d. No admin work was repeated,
reverted or re-applied; the two workstreams touch no common file.

**The reconciliation found one thing this ledger had wrong.** It said 8d's was
the only unapplied migration in the repository. There were two:
`20260805140000_pin_search_path_on_place_helpers.sql` landed on commit
`c9356c2` as an 8e follow-up and was never applied, never recorded, and never
mentioned again. It was found by comparing every repository migration against
live history rather than by trusting this file — the two 8e helpers still had
`proconfig = null` on the live project, which is exactly the condition that
migration exists to remove.

**A defect fixed before applying, not after.** `guestbook_private.memory_is_live`
was declared `immutable` while calling `now()`. That is wrong by definition and
Postgres does not check it, so it would have applied silently. Harmless in
today's call paths — the argument always comes from a row, never a constant —
but a wrongly-immutable function is legal in an index predicate or a generated
column, where the planner may cache one answer permanently, and 8f1 is slated
to query `explorer_memories_live_public_idx`. Changed to `stable` in the file
before it ran, which is the last moment editing it is allowed.

**Applied, in order, each verified before the next:**

| Migration | Recorded live as |
|---|---|
| `20260805130000_explorer_memories.sql` | `20260810015402_explorer_memories` |
| `20260805140000_pin_search_path_on_place_helpers.sql` | `20260810015412_pin_search_path_on_place_helpers` |
| `20260810020000_pin_search_path_on_memory_is_live.sql` (new) | `20260810015710_pin_search_path_on_memory_is_live` |

**The third one is a forward correction, and 8d caused it.** Pinning the two 8e
helpers closed both `function_search_path_mutable` findings, and the advisor run
immediately reported a third: `memory_is_live` had no `search_path` either.
`can_read_memory` in the same migration has one; this was missed the same way
the 8e pair was. `20260805130000` had already run and was **not** edited —
a new forward migration pins it, on the same reasoning `20260805140000` already
recorded.

**Every column and function the migration touches was checked against the live
schema before it ran** — `businesses.image`/`photos`, all five
`area_id`/`latitude`/`longitude` sets, `are_friends`, `is_explorer`. This is the
check that would have caught the admin workstream's `businesses.created_at`
assumption, and it is cheap.

**Acceptance criteria: the phase boundary, proved from four callers with RLS on.**
Real accounts, one transaction, no commit path — it ends in a deliberate
`RAISE EXCEPTION` carrying the results, so it cannot be a `commit;`/`rollback;`
typo. Owner `198295b9`, Friend `b91375b3` (real mutual follow), Follower
`7ccc2494` (one-way, created inside the transaction because no real one-way
follower of the Owner exists), and signed out.

| Memory state | Owner | Friend | Follower | Signed out |
|---|---|---|---|---|
| live, `visibility=public` | 1 | 1 | 1 | 1 |
| live, `visibility=friends` | 1 | 1 | **0** | 0 |
| archived, `archive=private` | **1** | **0** | **0** | **0** |
| archived, `archive=friends` | 1 | 1 | 0 | 0 |
| archived, `archive=public` | 1 | 1 | 1 | 1 |

Row 3 is the packet. A Memory everyone could read a minute earlier is nobody's
but its creator's, with no one having done anything. Row 2 confirms a one-way
follow is not a friendship. The creator never loses their own, in any phase.

Also refused, with the exact messages the screens rely on: a shared Memory with
no expiry (`A Memory other people can see needs an end date for its live
period`) and a non-owner adding themselves to the selected list (`Only the
Memory's owner can choose who sees it`).

**The transaction left nothing behind:** 0 Memories, 0 shares, the probe follow
row gone, follows back to 34, 0 audit records, 19 Explorers.

**Files changed:** `supabase/migrations/20260805130000_explorer_memories.sql`
(volatility label, before applying),
`supabase/migrations/20260810020000_pin_search_path_on_memory_is_live.sql`
(new), and this ledger.

**Also ran:** `npm run test:ci` → **409 passed across 19 suites**; memories 57;
screens 342; social 92; live 152 + 39; taxonomy 152; markers 327; place 96;
cards 16; discover 30; reputation 32; places 136; `npx expo export --platform
web` succeeded with `explorer_memories` and `/linkups/create` both present in
the bundle.

**Two recorded numbers did not reproduce, and neither is a regression:**

- **Expo Doctor is 19/20, not 20/20.** Four *patch* drifts inside SDK 57
  (`expo` 57.0.10 vs ~57.0.11, plus `expo-image-picker`, `expo-location`,
  `expo-router`). Expo published these after the last session; `package.json`
  and `package-lock.json` are untouched. Bumping them is a dependency decision
  and was not taken unasked.
- The marker gate reports **327** checks; the previous handoff said 326. The
  gate reads screens, not migrations, so nothing this session could move it —
  327 is what `0d5f166` already produced.

`npm audit` is unchanged and still blocked upstream: 15 high findings through
Metro's `image-size`, whose only complete npm fix is the incompatible Expo
57 → 53 downgrade. Not applied.

**Stopped because:** 8d is finished — applied, verified and recorded. One packet
per session, and 8b is a new packet.

**Exact next step:** 8b (My Map). It is now genuinely unblocked:
`get_explorer_memories` exists in the database, not just in a file. Read
`components/ExplorerProfileScreen.js`, `utils/memories.js`, `app/memories/[id].js`,
the Packet 8 section of `docs/REDESIGN-BRIEF.md` and the 2026-08-04 privacy
review below before writing anything. That review's conclusion is a hard
constraint on 8b: My Map renders **only on your own profile** — absent for other
viewers, not empty — with no `is_public` flag and no share control.

**Unverified:**
- **Nobody has opened `/memories/create` or `/memories/[id]`.** The screens are
  `Verified: renders. Unverified: behaves`. Sections 1, 6, 7 and 8 of
  `docs/MEMORIES_TEST_PLAN.md` (default-private UI, show-on-profile as a filter,
  the location snapshot surviving a business edit, and delete) are proved by
  gate and test, not by a person.
- Sections 3–5 are proved at the database boundary from real sessions, which is
  where the privacy promise actually lives, but not through the app.
- The Memories section on `components/ExplorerProfileScreen.js:104` was calling
  `get_explorer_memories` against a database where it did not exist, on every
  profile load, since `42b695d`. It degraded quietly to an empty list rather
  than breaking the screen. That is fixed by this migration existing, but it
  means the profile's Memories section has never once returned a real row.
- `guestbook_private.memory_is_live` is `stable` and pinned, but no test asserts
  either property; a future `create or replace` could drop both silently.

---

### 2026-08-10 — Admin dashboard Stages 4–7 — migrations live and verified

**Did:** Received the owner's approval and applied the five prepared migrations
to Xplorer project `yzpthslwsvesgndzdqai` in order. Supabase recorded them as:

1. `20260810005302_admin_claim_decisions`
2. `20260810005338_admin_capability_decisions`
3. `20260810005416_admin_activity_states`
4. `20260810005443_admin_moderation`
5. `20260810005740_admin_data_quality`

The first execution of the final report found that `businesses` has no
`created_at` column. No data had changed. Preserved the applied migration and
added the forward-only
`20260810008000_admin_data_quality_business_timestamp_fix.sql`, recorded live
as `20260810005923_admin_data_quality_business_timestamp_fix`. It gives
business-owner-State findings an explicit null sort timestamp and sorts those
after dated claim findings. Added a regression assertion so the unsupported
column cannot return unnoticed.

Added `docs/ADMIN-DASHBOARD-TEST-PLAN.md`, a plain-English Parts 1–10 test from
branch/build checks through access, overview, catalogue, decisions, activity,
moderation/privacy, directory, data quality, audit and ordinary-app regression.
It separates safe read-only checks from actions that must use disposable data
because real admin actions leave permanent audit history.

**Files changed:**
`supabase/migrations/20260810008000_admin_data_quality_business_timestamp_fix.sql`,
`test/admin-areas.test.js`, `docs/ADMIN-DASHBOARD-TEST-PLAN.md` and this ledger.

**Acceptance criteria:** live database checks pass.

- Final repository verification passes 19 suites / 409 tests, the 342-check
  screen gate, every other workflow source gate, Expo Doctor 20/20 and a
  production web export containing `/linkups/create`.
- All six new history rows exist exactly once. All six admin RPCs are
  `SECURITY DEFINER`, use an empty `search_path`, deny `anon` execute and run an
  administrator check before reading or changing data.
- A real ordinary Explorer was refused by every read and write admin RPC; a
  signed-out caller was also refused. These access checks created no audit row.
- Successful claim rejection, capability approval, Club State, Event State and
  moderation-dismiss paths were exercised against real table shapes inside one
  explicit transaction. Each changed all of its related rows and added exactly
  one audit record inside the transaction. The transaction was rolled back;
  claim, request, Club, Event, report and audit counts were all restored.
- Direct authenticated writes cannot decide claims, grants or social reports
  and cannot insert, update or delete audit history. Audit RLS is enabled.
- The moderation function definitions contain none of the private Link-up
  meeting, attendee, coordinate, email or phone fields.
- The read-only data-quality RPC now executes successfully and reports 1 known
  ownership inconsistency plus 6 groups containing 62 rows without canonical
  areas. It contains no table mutation statement.
- Live data remained 3 approved claims, 1 pending capability request, 8 open
  Clubs, 9 published Events, 0 open social reports, 1 open safety report and 0
  audit records after verification.
- Supabase advisors were run after the DDL. The six admin functions receive the
  generic authenticated-`SECURITY DEFINER` warning by design: the Data API must
  let a signed-in caller reach the function, then the function checks
  `guestbook_is_admin()`; the real non-admin simulation proved the second gate.
  No admin function has the mutable-search-path warning and the audit table has
  an RLS policy. Performance advice also identifies two pre-existing
  per-row-auth policies on capability-request submission/resubmission and marks
  the three newly unused indexes as informational while the tables are nearly
  empty. See the Supabase linter references for
  [authenticated SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable),
  [RLS init plans](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan)
  and [unused indexes](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).
- `npm audit --audit-level=moderate` still reports the same 15 high findings
  through Metro's `image-size`. Its proposed full fix still requires the
  incompatible Expo 57 → 53 downgrade, so no forced dependency change was made.

**Stopped because:** database implementation and non-destructive verification
are complete. The remaining work is the owner's real-device test; actions in
that test should use disposable records because audit history is append-only.

**Exact next step:** rebuild App Preview from `main2.0-Dev`, then follow
`docs/ADMIN-DASHBOARD-TEST-PLAN.md` from Part 1 through Part 10. Record any
failure with its screen, account role, record, exact steps, expected result,
actual result, screenshot/video and test time.

**Unverified:** the new screens are still `Verified: renders. Unverified:
behaves` on a real device. No genuine production admin decision has been made,
so the live audit history is correctly empty.

---

### 2026-08-10 — Admin dashboard Stages 4–7 — code complete, migrations not applied

**Did:** Inspected the clean `main2.0-Dev` checkout, its latest commits and the
live Xplorer Supabase project `yzpthslwsvesgndzdqai` before changing anything.
The live migration history already contained the verified Stage 1 security
foundation and Stage 3 catalogue policies, so none was repeated. The live data
survey found 19 Explorers, 4 administrators, 3 approved claims, 1 pending
Manager-capability request, 26 businesses, 9 properties, 1 public Place,
8 activity clubs and 9 Events. It also found one historical approved business
claim whose listing still has no owner and is not marked claimed; this is now
reported as a data-quality issue and was deliberately not repaired silently.

Before development, moved the confirmed `ba97d32` contents of `main2.0-Dev` to
both `main2.0` and `main`, as requested, and verified both comparisons were
0 commits ahead / 0 behind. New development then stayed on `main2.0-Dev`.

Published the implementation as `8a3c497` on `main2.0-Dev`, containing these
five tested checkpoints from the local development history:

- Stage 4: claim and Manager-capability decisions now require a 3–500
  character reason and confirmation, run as atomic SECURITY DEFINER RPCs and
  create append-only audit records. Direct claim/capability decision writes are
  removed from Data API clients.
- Stage 5: administrators can publish, hide, close, reopen or cancel clubs
  and Events through one audited RPC. No activity is deleted.
- Stage 6: one moderation screen reads the two report systems the app already
  uses, excludes Link-up meeting points, attendee data, coordinates and contact
  fields, and records dismiss/action decisions atomically. Added a read-only,
  paginated Explorer directory with batched Manager capabilities.
- Stage 7: added read-only canonical-area, unmatched-value and ownership
  integrity reports plus a paginated append-only audit view. Reports never
  guess or auto-repair data, and the audit screen does not select arbitrary
  JSON details.
- Dependency checkpoint: moved transitive `nanoid` from vulnerable 3.3.16 to patched
  3.3.18 after the final dependency audit surfaced a new advisory.

**Files changed:** new routes `app/admin/activities.js`,
`app/admin/moderation.js`, `app/admin/explorers.js`, `app/admin/areas.js` and
`app/admin/audit.js`; refactored `app/admin/claims.js` and expanded
`app/admin/dashboard.js`; navigation/drawer registrations; five versioned
admin migrations; five new behaviour suites plus expanded dashboard,
navigation and drawer coverage; the screen/security verifier; `package-lock.json`;
and this ledger.

**Acceptance criteria:** PASS for the feature code. Each stage was tested before
its commit. Final `npm run test:ci` passes 19 suites / 408 tests. The screen and
route gate passes 342 checks. Every other workflow source gate passes; Expo
Doctor passes 20/20; the production web export succeeds and contains
`/linkups/create`.

The dependency audit is **BLOCKED upstream**, not green: after fixing `nanoid`,
`npm audit --audit-level=moderate` reports 15 high findings, all flowing from
Metro's `image-size` dependency and advisories `GHSA-w3rx-r6r6-pgpr` and
`GHSA-5p2g-fcmc-qvqq`. The newest published `image-size` is 2.0.2 and the
advisories cover every version through 2.0.2. npm's only proposed complete fix
would downgrade Expo from SDK 57 to SDK 53, a breaking and incompatible change,
so it was not applied. CI will remain blocked at its audit step until Expo/Metro
publishes a compatible patched dependency or the project deliberately changes
SDK after a separate compatibility review.

**Stopped because:** all repository work that can be completed safely is done.
Applying the five live migrations requires the owner's explicit approval, and
the remaining audit finding has no compatible published fix.

**Exact next step:** with explicit owner approval, apply these migrations to
Xplorer project `yzpthslwsvesgndzdqai`, in order, one at a time:

1. `20260809235500_admin_claim_decisions.sql`
2. `20260810001000_admin_capability_decisions.sql`
3. `20260810003000_admin_activity_states.sql`
4. `20260810005000_admin_moderation.sql`
5. `20260810007000_admin_data_quality.sql`

After each application, verify its migration-history row and contract; after
all five, simulate administrator/non-administrator/signed-out roles, confirm
audit records cannot be forged through the Data API, run security and
performance advisors, then device-test every new admin route. Separately,
rerun `npm audit` when Expo/Metro publishes an `image-size` fix.

**Unverified:** none of the five migrations is live, so the new decision,
moderation, data-quality and audit RPCs have not run against Postgres. The new
screens are `Verified: renders. Unverified: behaves` on a real device. No live
row or schema was changed in this session.

---

### 2026-08-05 — Admin dashboard Stage 3 — migrations live and verified

**Did:** Applied the prepared Stage 3 listing-catalogue policy migration to
Supabase project `yzpthslwsvesgndzdqai`; Supabase recorded it as
`20260805152040_admin_listing_catalogue_read_access`. Administrator and ordinary
Explorer role simulations passed, but the signed-out simulation correctly
caught a `42501` error: PostgreSQL evaluated the restricted
`guestbook_is_admin()` subquery in a policy scoped to `public`, despite the
surrounding CASE intended to keep anonymous callers away from it.

Added and applied a corrective migration rather than editing the migration
that had already run. Supabase recorded the correction as
`20260805152354_admin_listing_catalogue_anon_split`. It replaces each broad
SELECT policy with disjoint `anon` and `authenticated` policies. Signed-out
rules contain no administrator helper; signed-in rules preserve public,
manager-owned and administrator visibility. No data row and no write or delete
permission changed.

**Files changed:**
`supabase/migrations/20260805152300_admin_listing_catalogue_anon_split.sql`,
`scripts/verify-screen-gates.cjs`, and this ledger.

**Acceptance criteria:** PASS. The second live role-simulation run proved that
`Guestbooker1@gmail.com` is signed in, the database helper returns true, and the
administrator sees all 8 activity clubs and all 9 events. A non-administrator
Explorer returned false from the helper and saw exactly the public rows. A
signed-out caller also saw exactly the public rows without calling the secure
helper or raising an error. The current data has no draft clubs and no
unpublished events, so the hidden-row difference could not be demonstrated
with an existing row; the installed policy definitions were queried back and
contain the administrator branch only on the authenticated policies.

Supabase now reports exactly four relevant SELECT policies: one `anon` and one
`authenticated` policy on each table. The advisors show no new
multiple-permissive-policy warning for activity clubs or events. The expected
notice for signed-in access to the secure yes/no administrator helper remains;
anonymous EXECUTE is still revoked. Full Jest passes 366/366 across 13 suites,
the expanded screen gate passes 136/136, every other source gate passes,
`npm audit` reports 0 vulnerabilities, and Expo Doctor passes 20/20.

**Stopped because:** Stage 3's database work is complete and verified.

**Exact next step:** pull `main2.0-Dev` in Replit, restart App Preview, sign in
as the administrator and device-test Browse all listings, search, all five type
filters and one detail link from each listing type.

**Unverified:** the Stage 3 catalogue has not yet been tapped on a device.
There is currently no draft activity club or unpublished event in the live
data, so those two future-row cases are proven by the installed policy
definitions and administrator result, not by reading an existing hidden row.

---

### 2026-08-05 — Admin dashboard Stage 3 — code complete, migration not applied

**Did:** Recorded the owner's successful Stage 2 Replit/device pass, then built
the Stage 3 Admin Listing Catalogue. The dashboard's six total cards are now
buttons, and the five listing totals open the catalogue already filtered to
that type. The catalogue loads businesses, properties, public places, activity
clubs and events in parallel, selects only the non-sensitive columns it
displays, searches names/details, filters by type and opens the existing
canonical detail route. If any table read fails, it shows one error and no
partial catalogue. It contains no update, delete, owner-id or manager-id read.

The live policy audit found that administrators can already inspect all
businesses, properties and public places, but the activity-club and event read
policies only included public records or the listing's own manager. Prepared a
versioned migration that extends those two existing policies with the shared
`guestbook_is_admin()` check. It deliberately alters the existing policies
instead of adding duplicate permissive policies. The migration was not applied
because live migrations require separate owner approval.

**Files changed:** `app/admin/listings.js`, `app/admin/dashboard.js`,
`app/_layout.js`, `utils/drawer.js`, `scripts/verify-screen-gates.cjs`,
`test/admin-listings.test.js`, `test/admin-dashboard.test.js`,
`test/drawer.test.js`, `test/navigation.test.js`,
`supabase/migrations/20260805150624_admin_listing_catalogue_read_access.sql`,
and this ledger.

**Acceptance criteria:** the new behaviour suite was first demonstrated red
because `/admin/listings` did not exist, then passes 4/4. The focused admin,
drawer and navigation run passes 145/145. Full Jest passes 366/366 across 13
suites. The expanded screen/security gate passes 126/126, every other source
gate passes, `npm audit` reports 0 vulnerabilities, Expo Doctor passes 20/20,
and a production web export completes. The five live table shapes and their RLS
policies were read directly from project `yzpthslwsvesgndzdqai`; no live row,
policy or schema was changed.

**Stopped because:** Stage 3 code is complete, but its live read-policy
migration needs explicit owner approval.

**Exact next step:** ask the owner to approve applying
`20260805150624_admin_listing_catalogue_read_access.sql`. If approved, apply it
to project `yzpthslwsvesgndzdqai`, verify an administrator can see all five
listing types while a normal Explorer gains no extra rows, rerun the advisors,
then pull `main2.0-Dev` into Replit and device-test search, filters and links.

**Unverified:** the migration is not live; therefore complete administrator
visibility of draft clubs and unpublished events is unverified. The new screen
has not yet been rendered or tapped in Replit/on a device.

---

### 2026-08-05 — Admin dashboard Stage 2 — built and live reads verified

**Did:** Replaced `/admin/dashboard`'s second copy of claim approval with one
admin overview. The old screen asked PostgREST to infer
`claims.user_id -> profiles.id`; the real foreign key points to `auth.users`,
so that query failed with the schema-cache relationship error before showing a
truthful total. The new screen makes six count-only reads for pending claims,
businesses, properties, public places, activity clubs and events. It shows no
totals if any read fails, offers a retry, and links to the existing dedicated
claim-review and public-place management screens. The Quick Access drawer now
has a canonical Admin dashboard row without removing either direct shortcut.
No schema change or live migration was needed.

The required full Jest command was already red on untouched
`origin/main2.0-Dev`: two older suites mounted `FeedbackProvider`, triggered
its dismissal timer and never unmounted it. Their assertions all passed, but
the timers updated React after Jest had torn down. Those two test helpers now
unmount their own trees after each test, allowing the provider's existing
cleanup to run; production code is unchanged by that repair.

**Files changed:** `app/admin/dashboard.js`, `utils/drawer.js`,
`scripts/verify-screen-gates.cjs`, `test/admin-dashboard.test.js`,
`test/drawer.test.js`, `test/place-follows.test.js`, `test/memories.test.js`,
and this ledger.

**Acceptance criteria:** the new source gate was demonstrated red against the
old screen (89 checks passed, 13 intended Stage 2 failures), then green at
102/102. The new behaviour suite passes 4/4: exact real-shaped totals, no
relational profile join, both tool destinations, and an honest all-or-nothing
error state. Full Jest passes 359/359 across 12 suites. Every CI source gate
passes; `npm audit` reports 0 vulnerabilities; Expo Doctor passes 20/20; and a
production web export completes. A rolled-back live role simulation for the
owner returned admin `true` and the same six reads returned 1 pending claim,
26 businesses, 9 properties, 1 public place, 8 activity clubs and 9 events.
No live row or schema was changed.

**Stopped because:** Stage 2 is complete in code and no migration is required.

**Exact next step:** pull `main2.0-Dev` in Replit, rebuild the App Preview, log
in as `Guestbooker1@gmail.com`, open Admin dashboard, confirm the six cards and
open both admin tools. Do not begin Stage 3 until that device pass is recorded.

**Unverified:** the owner has not yet opened this Stage 2 interface on a device,
so its Replit rendering and touch behaviour remain `Unverified: behaves` even
though its code, tests, bundle and live read permissions are verified.

---

### 2026-08-05 — Admin dashboard Stage 1 — deployed and verified

**Did:** With the owner's explicit approval, applied repository migration
`20260805132127_admin_security_foundation.sql` to the live Xplorer Supabase
project. Supabase recorded it as migration
`20260805134032_admin_security_foundation`. The migration removed broad
authenticated INSERT access to `profiles`, kept only the ordinary signup and
profile fields insertable/updateable, excluded `is_admin`, strengthened the
own-profile INSERT policy, and locked `guestbook_is_admin()` to an empty
`search_path` with execution for `authenticated` but not `anon`.

**Files changed:** live database schema and permissions; this deployment entry
in `docs/REDESIGN-STATE.md`. The migration SQL itself was already committed.

**Acceptance criteria:** migration appears in live history; RLS remains on for
`profiles`; broad profile INSERT is gone; the five required signup columns
remain insertable; `is_admin` is neither insertable nor updateable by
`authenticated`; the INSERT policy independently rejects `is_admin=true`;
the helper is callable by `authenticated`, not `anon`, and returns `true` for
an admin and `false` for a normal user. A normal signup-shaped INSERT planned
successfully inside a rolled-back transaction, while the same attempt with
`is_admin` was refused. All 4 admin and 15 non-admin profiles remained
unchanged. The security advisor has no mutable-search-path or anonymous-call
finding for this helper; it retains the expected signed-in SECURITY DEFINER
notice because the app intentionally calls this tightly scoped boolean helper.

**Stopped because:** finished. Admin dashboard Stage 1 is complete in code and
live.

**Exact next step:** identify which existing profile belongs to the owner,
confirm or grant its administrator role through a trusted database operation,
then begin Admin dashboard Stage 2.

**Unverified:** a signed-in admin UI pass in Replit/on a device. The database
boundary and client gate are verified, but the owner's login account has not
yet been identified and Replit has not been synchronised in this workstream.

---

### 2026-08-05 — Admin dashboard Stage 1 — code complete, migration not applied

**Did:** Audited the live administrator boundary before building the new
dashboard. RLS was enabled on every table in the dashboard survey, and the
existing `guestbook_is_admin()` helper returned `true` for an administrator
and `false` for a non-administrator. The audit also found a real privilege
escalation gap: `authenticated` could not update `profiles.is_admin`, but its
table-wide profile INSERT grant still allowed that column on first profile
creation. Added a migration that restricts profile INSERT and UPDATE to the
ordinary signup/profile fields, excludes `is_admin`, and makes the insert
policy independently reject `is_admin=true`. The same migration pins the
SECURITY DEFINER helper to an empty `search_path`. Changed `useAdminGate()` to
call that database helper, so admin screens and RLS no longer implement
separate checks. Expanded the verifier to discover every `/admin/*` route and
require the shared gate, and added four behavioural gate tests.

**Files changed:** `hooks/useAdminGate.js`,
`supabase/migrations/20260805132127_admin_security_foundation.sql`,
`scripts/verify-screen-gates.cjs`, `test/admin-security.test.js`,
`test/place-follows.test.js`, `docs/REDESIGN-STATE.md`.

**Acceptance criteria:** Red demonstration: screen gate verifier reported
75 passed / 3 intended failures, and the new gate suite reported 2 passed / 2
failed before implementation. Green: screen gate verifier 90/90; gate tests
4/4; full Jest suite 355/355 across 11 suites (the existing delayed
FeedbackProvider timer warnings remain after Jest completes); every CI source
gate passed; `npm audit` found 0 vulnerabilities; Expo Doctor passed 20/20;
the production web export completed; live read-only probes returned admin
`true` and non-admin `false` without changing data.

**Stopped because:** the repository rule requires explicit approval before a
migration is applied to the live Supabase project. No live database change was
made.

**Exact next step:** with explicit approval, apply
`20260805132127_admin_security_foundation.sql` to project
`yzpthslwsvesgndzdqai`, then verify that authenticated has no INSERT or UPDATE
privilege on `profiles.is_admin`, ordinary signup columns still insert, an
attempted `is_admin=true` profile is refused, the helper still returns the
right answer for both roles, and the security advisors introduce no new
finding.

**Unverified:** SQL syntax and behaviour against the live database, because
the migration has not been applied. Stage 1 is therefore not marked done.

---

### 2026-08-05 — Packet 8e deployed, workflow corrected, Packet 8d built

**Did:** Three things, in one continuous run with the owner's explicit
approval for each: merged 8e to `main2.0-Dev` and applied its migrations to
the live project, rewrote the branch workflow, and built 8d.

---

#### The workflow changed, because the old one caused a real failure

`AGENTS.md` said "start from the latest `main` branch". Every packet since the
redesign began has landed on `main2.0-Dev`, so following step 1 produced a
checkout with no `CLAUDE.md`, no `RULES.md` and no ledger — which is exactly
what happened at the start of this session, and led to a confident report that
those files did not exist anywhere in the repository. They did. The clone was
single-branch.

`AGENTS.md` is now the direct workflow: `main2.0-Dev` only, no feature
branches, no pull requests, a state report before editing, and never reset or
force-push out of a divergence. `CLAUDE.md` gained a pointer, not a copy.
`RULES.md` is untouched — it governs how the work is done, not where it lands.

---

#### 8e applied live, and one defect found by doing it

Five migrations, in order, one at a time:

| # | Migration | Result |
|---|---|---|
| 1 | `geo_areas_and_public_places` | 4 areas, 8 aliases, 3 tables, RLS on all three |
| 2 | `area_and_place_references` | `area_id` on 7 tables, backfill as predicted |
| 3 | `entity_and_location_follows` | 2 tables, 6 policies, 2 count RPCs |
| 4 | `moment_place_visibility_and_actor` | 6 columns, 22 rows backfilled public/explorer |
| 5 | `moment_read_policy_anon_split` | **the correction below** |

The backfill matched exactly what a read-only survey had predicted before any
of it ran: profiles 2/2, activity clubs 6/8, events 2/9, link-ups 6/7,
check-ins 19/19, and **businesses and properties 0** — deliberately, because
neither has a town column and parsing a postal address is guessing. All eight
uncertain values (`Hastings Old Town`, `Preston Park`, `Local area` and the
rest) are still unmatched and still in `get_unmatched_area_report()`.

**Migration 4 broke signed-out reading of every Moment, and Phase 3 caught
it before a person did.** The new read policy was one policy `for select to
public`; `public` includes `anon`; the friends branch calls
`guestbook_private.are_friends`, which anon can neither execute nor reach; and
Postgres does not promise to short-circuit an OR in a policy. So a signed-out
read raised `42501` instead of returning the public Moments.
`20260805120400` splits the policy by role. **The lesson generalises and was
applied to 8d the same day: a policy that has to be safe for both anon and
authenticated should usually be two policies.**

**Verified live, with RLS on, from four callers reading the same friends-only
Moment:** author 1, mutual friend 1, non-friend Explorer 0, signed out 0 —
and the non-friend and signed-out callers still see all 22 public Moments.
Ten more behaviours were exercised inside a transaction and rolled back:
following a place and a town both work, following a missing place and
following a Link-up are both refused, an official post by someone who does not
manage the listing is refused (`You do not manage this listing`), an official
post attached to something else is refused, an Explorer Moment cannot claim
another author, 8c's self-endorsement block still fires, another Explorer sees
0 of your follow rows while the count RPC still answers, and both the ten- and
eleven-argument `start_live_checkin` calls work.

**A mistake of mine, recorded because it wrote to the live database.** The
first verification block ended in `commit;` where I meant `rollback;`, so a
probe park, a probe Moment and one follow row were committed. I removed all of
it, then checked whether the `on conflict do nothing` insert had masked a
pre-existing row my cleanup would then have deleted. It had not: only two
accounts have ever followed that Explorer, from 17 July and 2 August, and
neither is the probe account — the row was mine and so was the notification.
Post-cleanup counts match the pre-probe state exactly (22 Moments, 19
check-ins, 0 public places, 0 follows of either kind). **A destructive typo in
a verification script is still a destructive typo**, and the reason it was
recoverable is that the data it touched could be identified afterwards.

---

#### 8d — Memories

**The design is the two phases, and everything else follows from them.**
`visibility` decides who may read a Memory until `live_until`;
`archive_visibility` decides afterwards; the creator can always read their own
in either phase. `archive_visibility` defaults to `private` and is **never**
copied from `visibility` — a person who agrees to be seen today has not agreed
to be seen forever. `guestbook_private.can_read_memory` is the single place
that picks the rule, so the policy and the profile list cannot drift.

Anything other people can see requires `live_until`; a private Memory may sit
on its owner's map with none, because nothing about it is shown to anybody.
`show_on_profile` is a filter, not a permission: `get_explorer_memories` is
`SECURITY INVOKER`, so a private Memory with the flag on reaches its owner and
nobody else.

**Files:** `supabase/migrations/20260805130000_explorer_memories.sql`,
`utils/memories.js`, `app/memories/create.js`, `app/memories/[id].js`,
`scripts/verify-memories.cjs` (57 checks), `test/memories.test.js` (13 tests),
`docs/MEMORIES_TEST_PLAN.md`. Changed: `components/ExplorerProfileScreen.js`
(a Memories section through the RPC), `app/_layout.js`, `app/create.js`,
`utils/drawer.js`, `test/navigation.test.js`, `package.json`, the workflow and
the tokenised-colour list.

**Six checks demonstrated failing before being kept:** archive defaulting to
public, the phase branch collapsed to `visibility`, the expiry requirement
removed, the anon policy calling `can_read_memory`, the create screen
defaulting the archive to the live audience, and `private` losing its place as
the first option.

**One test of mine was wrong before the code was.** The create-screen
assertions used the pressable finder on a text field, which has `onChangeText`
and no `onPress`, and failed on a null. That is a broken test reading as a
broken screen — the seventh time in this project a check has needed a second
look, and the first where the check failed loudly rather than passing quietly.

**Ran:** `npm run test:ci` → **351 passed** (334 before, +13); memories 57;
places 136; markers 304; taxonomy 143; place layout 96; cards 16; discover 30;
reputation 32; social 92; live 152 + 39; linkup nav 20; title-only 28; seed 3;
screen gates 72; `npx expo-doctor` 20/20; `npm audit` 0 vulnerabilities;
`npx expo export --platform web` succeeded with `explorer_memories` present in
the bundle.

**Stopped because:** finished. 8e is deployed, 8d is committed.

**Exact next step:** apply `20260805130000_explorer_memories.sql` — it is the
only unapplied migration in the repository — then work
`docs/MEMORIES_TEST_PLAN.md` section 4 first, which is the archive boundary
and the only part of this packet that would be expensive to get wrong. After
that, 8b (My Map) is unblocked and reads `explorer_memories`, never
`live_checkins`.

**Unverified:**
- **8d's migration has never run.** Same standing as 8e had this morning:
  every statement is verified by reading. The phase-aware policy in particular
  has been reasoned about and never executed.
- Nobody has opened `/memories/create`, `/memories/[id]`, `/places` or
  `/admin/public-places`. Twelve packets in.
- 8e is verified live but through SQL and RLS probes, not through the app. The
  screens are still `Verified: renders. Unverified: behaves`.
- `businesses.area_id` and `properties.area_id` are live and empty. Location
  follows will not surface business content until something sets them, and
  there is no admin screen for it.
- `geo_area_aliases` has an admin write policy and no admin screen.
- Brighton is seeded with no parent area. Whether it sits under East Sussex is
  still the owner's call.
- The selected-Explorer picker on a Memory lists only people the owner
  follows, capped at 50, with no search.

---

### 2026-08-05 — Packet 8e — built and committed, not deployed

**Did:** Built the place, location and follow foundation. Four migrations
written, three screens added, four place pages given a Follow control, and the
Moment gained a location, an audience and an identity.

**The session started in the wrong repository state, and that is worth
recording.** The container's clone was single-branch — `main` only — so
`CLAUDE.md`, `RULES.md`, this ledger and `docs/REDESIGN-BRIEF.md` were all
genuinely absent from the checkout, and I reported that they did not exist
anywhere. The owner corrected it: the work lives on `main2.0-Dev`, and a
`git fetch origin --prune` brought back twelve branches. **A missing file in a
shallow or single-branch clone looks exactly like a file that was never
written.** The first 8e plan was drafted against the old `main` and was wrong
about the test harness, the design tokens, the account model and half the
screens; it was thrown away rather than adapted.

**Files created:**
- `supabase/migrations/20260805120000_geo_areas_and_public_places.sql` —
  `geo_areas`, `geo_area_aliases`, `public_places`,
  `guestbook_private.normalise_area_text()`, hierarchy validation, RLS, grants,
  and the four-area launch seed.
- `supabase/migrations/20260805120100_area_and_place_references.sql` —
  `area_id` on seven tables, `live_checkins.public_place_id`, the exact-match
  backfill, `get_unmatched_area_report()`,
  `get_unmatched_public_place_report()`, and `start_live_checkin` gaining an
  eleventh, defaulted argument.
- `supabase/migrations/20260805120200_entity_and_location_follows.sql` —
  `explorer_entity_follows`, `explorer_location_follows`, validation and rate
  limits, own-rows-only RLS, and two count RPCs.
- `supabase/migrations/20260805120300_moment_place_visibility_and_actor.sql` —
  six columns on `explorer_moments`, `are_friends()`, the snapshot trigger, the
  replaced read policy, and rebuilt `validate_social_target()`,
  `social_notification_trigger()` and `get_explorer_social_feed()`.
- `utils/places.js`, `components/EntityFollowButton.js`, `app/places/index.js`,
  `app/places/[id].js`, `app/admin/public-places.js`,
  `scripts/verify-place-follows.cjs` (132 checks),
  `test/place-follows.test.js` (17 tests),
  `docs/PLACE_FOLLOW_TEST_PLAN.md`.

**Files changed:** `app/moments/create.js` (audience, official identity,
explicit location, public-place attachment), `app/moments/[id].js` (official
byline, FRIENDS badge, `/places/` deep link), `app/checkins/create.js`
(canonical place picker), the four place pages (Follow beside Save),
`app/_layout.js`, `utils/drawer.js`, `test/navigation.test.js` (the three new
routes named in `ADDED`), `scripts/verify-marker-assignment.cjs` (the new
screens join the tokenised list), `package.json`,
`.github/workflows/quality-checks.yml`.

**The three functions were rebuilt from `pg_get_functiondef` on the live
project, not from the migrations that created them** — the same discipline 8c
recorded. It mattered again: `get_explorer_social_feed` is `SECURITY INVOKER`
since `20260804013508`, not the definer the original file declared, and
`start_live_checkin` had gained listing-name lookups and two-decimal rounding
that the 20260802211600 text knows nothing about. Copying either file's source
would have reverted work silently. 8c's self-endorsement block and the
activity-club `status in ('open','full')` widening both survive, and the gate
fails if either disappears.

**Ten checks demonstrated failing before being kept:**

| Broke | Message |
|---|---|
| left `explorer_moments_public_read` in place | `policies OR together, so every friends-only Moment would stay publicly readable` |
| dropped the friends filter from the feed RPC | `RLS is the first lock and this is the second` |
| stopped checking the official poster manages the listing | `missing required contract "You do not manage this listing"` |
| reverted 8c's self-endorsement block while rebuilding the trigger | `missing required contract "You cannot mark your own review as useful"` |
| seeded `preston park` as an alias for Brighton | `it must stay unmatched for a person to decide` |
| opened every follow row to any signed-in Explorer | `a follow list is a movement history, only the follower may read theirs` |
| defaulted a Moment to public | `missing required contract DEFAULT_MOMENT_VISIBILITY="friends"` |
| offered official posting to anyone | `without comparing the viewer to the listing's manager` |
| removed the row-changed check from the admin save | `an RLS refusal returns no error, only zero rows` |
| let a typed check-in name keep a canonical id | `the id and the text could disagree` |

**One of those checks was weak and was rewritten.** The admin row-changed check
matched `if(!data || !data.length)` anywhere in the file — and the file has two
write paths, so deleting the check from `save()` left the one in `hide()` and
the gate stayed green. It now counts occurrences. **That is the sixth time in
this project a check has looked convincing and proved nothing**, and again it
was found by trying to break it rather than by reading it.

**Ran:** `npm run test:ci` → **334 passed** (317 before, +17); `verify:places`
132; markers 296; taxonomy 143; place layout 96; cards 16; discover 30;
reputation 32; social 92; live 152 + 39; linkup nav 20; title-only 28; seed 3;
screen gates 72; `npx expo-doctor` 20/20; `npm audit --audit-level=moderate` 0
vulnerabilities; `npx expo export --platform web` succeeded, with
`/linkups/create`, the public places screen and `explorer_entity_follows` all
confirmed present in the bundle.

**Stopped because:** finished, to the limit of what can be finished without a
database. One packet per session.

**Exact next step:** apply the four migrations, in filename order, to
`yzpthslwsvesgndzdqai`, then work `docs/PLACE_FOLLOW_TEST_PLAN.md` — section 4
first, because that is the friends-only privacy boundary and it is the one
thing here that would be expensive to get wrong. Only after that is 8d
(Memories) available.

**Unverified — and this list is longer than usual, on purpose:**
- **No migration has been applied and no SQL in this packet has ever run.**
  Every statement is verified by reading. A syntax error, a constraint that
  rejects existing rows, or a trigger that fires in the wrong order would all
  show up on first apply, not here. There is no local Postgres in this
  environment and the live project was explicitly out of bounds.
- The backfill is expected to match `Hastings`, `Brighton`, `St Leonards` and
  `Hastings, East Sussex` against today's rows, and to leave the other eight
  values null. **That expectation comes from a read-only query of the live
  data, not from running the backfill.**
- `start_live_checkin` was dropped and recreated with an eleventh defaulted
  argument rather than added as an overload, because two candidates differing
  only by a default is how PostgREST ends up unable to choose (PGRST203). An
  older client sending the original ten arguments should still resolve. **Not
  proven against a running PostgREST.**
- Nobody has opened `/places`, `/places/[id]` or `/admin/public-places`. Eleven
  packets in, the screens are still `Verified: renders. Unverified: behaves`.
- The Moment audience default is asserted as a constant and as a rendered
  label. **No test drives a publish end to end**, because that needs a media
  upload; the audience actually written to the row is covered by the gate
  reading the insert payload, which is a source check, not a behaviour one.
- `businesses.area_id` and `properties.area_id` exist and are empty. Until
  something sets them, a Moment attached to a business snapshots a null area,
  and location follows will not surface business content. That is deliberate —
  parsing a town out of a postal address is guessing — but it is a real gap and
  an admin screen for it is not in this packet.
- The `geo_area_aliases` table has an admin write policy and **no admin screen**.
  New aliases are a SQL statement today.
- Brighton is seeded with no parent area. It is a unitary authority and whether
  it sits under East Sussex is a real question that was left to the owner
  rather than settled in a migration.

---

### 2026-08-05 — Packet 8c — done

**Did:** Between the last session and this one, the owner answered both open
8-track questions and, in doing so, issued a much larger spec for the whole
social layer (Moments as a ranked live feed, Memories as a map-attached
permanent scrapbook, mutual-follow-derived friendship, canonical geography,
official-entity posting, trending with anti-spam rules). Per the owner's
explicit instruction, that spec was answered first with an inspect-then-plan
write-up (no code) covering what exists, conflicts, DB/RLS/index needs, files,
phasing and risks — not recorded as its own ledger entry because no packet
number was assigned to it and nothing landed in the repo.

The owner then approved a revised split (8a/8b/8c/8d/8e/8f) and asked for 8c —
Review Reputation — built now, in isolation, with 8d/8e/8f redesigned against
six numbered product decisions before any of them are coded. This entry is
8c only.

**What 8c is:** the mechanism was already there. `social_likes` with
`target_type='review'` has worked since the social layer shipped
(`20260802155202_explorer_social_layer.sql`) — nothing new was invented, one
real gap was closed (a reviewer could endorse their own review; nothing
stopped it), and the aggregation + a second, review-specific button were
built on top.

**Files changed:**
- `supabase/migrations/20260805090000_review_endorsement_reputation.sql`
  (new) — `guestbook_private.validate_social_target()` replaced with one
  addition (reject a `social_likes` insert where `target_type='review'` and
  the inserting user owns the review); `public.get_explorer_review_reputation
  (uuid)` (new, `security invoker`, no new table, no new index).
- `components/EndorseButton.js` (new) — not `LikeButton` with a label prop.
  Fixed to `social_likes`/`target_type="review"`, says "Useful", renders a
  disabled count-only view when `viewerId === ownerId` rather than a control
  the database would only reject.
- `components/ExplorerProfileScreen.js` — `LikeButton` import removed
  entirely (was only ever used for reviews here); review cards use
  `EndorseButton`; new "Review reputation" card calling
  `get_explorer_review_reputation`.
- `app/feed.js` — review rows use `EndorseButton`, Moment rows still use
  `LikeButton`, branch is explicit (`isMoment ? <LikeButton.../> :
  <EndorseButton.../>`).
- `app/social-comments/[id].js` (video review comments) — `LikeButton`
  replaced with `EndorseButton`; added a `viewerId` state the file never
  tracked before.
- `app/moments/[id].js` — **untouched**, verified by the gate.
- `components/LikeButton.js` — **untouched**, verified by the gate (still
  says "Like"/"Remove like").
- `scripts/verify-review-reputation.cjs` (new, 32 checks), wired into
  `package.json` (`verify:reputation`) and
  `.github/workflows/quality-checks.yml`.
- `test/endorse-button.test.js` (new, 5 tests).
- `docs/REVIEW_REPUTATION_TEST_PLAN.md` (new) — manual QA script.

**Acceptance criteria, against the owner's list:**

1. Self-endorsement blocked — **PASS**. UI hides the control for the owner;
   DB rejects it independently (defence in depth, not just a client check —
   see live verification below).
2. One endorsement per user per review — **PASS**, pre-existing
   `social_likes_unique unique(user_id,target_type,target_id)`, confirmed
   live (see below), `EndorseButton` treats `23505` as "already endorsed"
   rather than surfacing an error.
3. Endorsements removable — **PASS**, `EndorseButton` deletes the row, test
   `"removing an endorsement deletes the row and decrements the count"`.
4. Uses `social_likes`/`target_type='review'` — **PASS**, no new table.
5. Wording is "Useful", not "Like" — **PASS** for reviews; gate independently
   asserts `LikeButton.js` still says "Like" so Moments could not have
   drifted the other way.
6. Profile shows total endorsements, reviews-with-≥1, most useful review +
   its count, average per review — **PASS**, all four rendered from
   `get_explorer_review_reputation`, gate checks each figure by name.
7. Moment likes unchanged — **PASS**. `app/moments/[id].js` still imports and
   renders only `LikeButton`; gate fails if it ever references
   `EndorseButton`.
8. Separate `EndorseButton`, not a relabelled `LikeButton` — **PASS**, two
   components, `LikeButton.js` has zero diff.
9. Removed/unpublished reviews excluded from reputation totals — **PASS**,
   `get_explorer_review_reputation` filters `er.status='published'` in the
   same CTE that computes both the sum and the per-review denominator, so an
   unpublished review is invisible to the average, not just the total.
10. Migration, RLS/security checks, indexes only where needed, verify
    script, manual test plan — **PASS**. No new RLS policy was required: the
    existing `social_likes_insert_own` policy (ties `user_id` to
    `auth.uid()`) plus the new trigger check together are the actual
    boundary, matching how self-follow prevention already works in this
    schema. No new index — `explorer_reviews_user_created_idx` and
    `social_likes_target_idx` already cover every access path the reputation
    query needs, confirmed present on the live project before writing the
    function rather than assumed.
11. Isolated packet, no Memories/location-follows/feed-ranking — **PASS**,
    grep confirms nothing under this diff touches `explorer_moments` schema,
    `explorer_follows`, or `get_explorer_social_feed`.

**A real bug caught before it shipped, not after.** The migration originally
reproduced `guestbook_private.validate_social_target()` from
`20260802155202_explorer_social_layer.sql`, the migration that first created
it. Before applying, I read the function actually live on `yzpthslwsvesgndzdqai`
with `pg_get_functiondef` and found it had already been patched by
`20260802191500_fix_activity_club_moment_attachments.sql`, which widened the
`activity_club` Moment-attachment check from `status='published'` to `status
in ('open','full')`. A straight reproduction of the 155202 file's text would
have silently reverted that fix the moment this migration applied — the same
"read source, not the running system" mistake the ledger has already
recorded once (`app/menu.js` and `profiles.is_manager`, 2026-08-04). Fixed by
rebuilding the function body from the live definition instead, with the one
intended addition on top.

**Five checks demonstrated failing before being kept, plus the empirical DB
run:**

| Broke | Caught by | Message |
|---|---|---|
| removed the owner-guard branch from `EndorseButton.js` | gate **and** test | `does not compare viewerId to ownerId`; test `hides the endorse action...` failed on the label assertion |
| changed `Useful` wording to `Like` | gate | `must say "Useful", not a generic "Like"` |
| removed the self-endorsement block from the migration | gate | `missing the self-endorsement rejection` |
| reverted `ExplorerProfileScreen.js`'s review card to a placeholder | gate | `does not render EndorseButton on review cards` |
| removed the `average_endorsements_per_review` figure from the profile | gate | `does not render the "average_endorsements_per_review" reputation figure` |
| collapsed `app/feed.js`'s moment/review branch to always render `EndorseButton` | gate | `Moments must still render LikeButton in the feed` |

Each was restored from a pre-break backup and re-verified clean before
moving on.

**Empirical verification against real rows on `yzpthslwsvesgndzdqai`**
(applied migration, then, against a real published review and two real
Explorer accounts — not the accounts that own the review):
- Inserting a `social_likes` row where the inserting user is the review's own
  author: **rejected**, `P0001: You cannot mark your own review as useful`.
- `get_explorer_review_reputation` on a review with zero endorsements:
  `{total_endorsements:0, reviews_with_endorsement:0, most_useful_review_id:
  null, average:0.00}`.
- After a different Explorer endorsed one review: `total_endorsements:1,
  reviews_with_endorsement:1, most_useful_review_id` matching, count `1`,
  average `0.17` (1 endorsement ÷ 6 published reviews for that user — over
  *all* published reviews, not just endorsed ones, per the owner's spec).
- Endorsing the same review twice from the same account: **rejected**,
  `23505 duplicate key value violates ... social_likes_unique` — the exact
  code `EndorseButton.js` treats as "already endorsed".
- Removing the endorsement: figures returned to the zero state above. No
  test data left behind.
- Self-liking your own Moment (`target_type='moment'`): **still succeeds**,
  confirming the review-only restriction did not leak onto Moments.

**Also run:** `npm run test:ci` → **311 passed** (306 before, +5 new);
`verify:reputation` 32; `verify:taxonomy` 138; `verify:markers` 280;
`verify:place` 96; `verify:cards` 16; `verify:discover` 30; `verify:social`
92; `verify:live` 152 + 39; linkup-nav 20; linkup-title-only 28; seed 3;
screen-gates 72; `npx expo-doctor` 20/20; `npm audit --audit-level=moderate`
0 vulnerabilities; `npx expo export --platform web` succeeded, `/linkups/
create` confirmed present in the bundle.

**CI:** run 38 on `93baa0e`, conclusion **`success`**, read back from the API
after the run completed.
https://github.com/simplebusiness26/The-App/actions/runs/30969526636

**Stopped because:** finished. One packet per session, and the owner was
explicit that 8d/8e/8f need a revised design, not code, next.

**Exact next step:** the owner's six product decisions (canonical
`geo_areas` for locations rather than free-text `area`; Moments gaining
`area_id`/`lat`/`lng` with inheritance from an attached entity;
`actor_type`/`actor_id` so an official business post is distinguishable from
an Explorer tagging that business, with server-side authorisation checked;
Memory lifecycle split into `live_until` / `visibility` / `archive_visibility`
/ `show_on_profile` rather than the two flags this session's earlier plan
proposed; `are_friends` kept derived, no friendship table, with
`explorer_memory_shares` explicitly named as partial and a future
`social_shares` sketched but not built; followable entity types reviewed
against the real schema rather than hardcoded to the four Moment-attachment
types; feed items carrying `source_reasons text[]` rather than one lossy
label, deduplicated; a trending formula defined — recency, engagement
velocity, distinct posters, distinct engagers, geographic relevance,
moderation signals, anti-spam, public-content-only — before any trending
code is written) need a full revised design for 8d/8e/8f, in the same
inspect-then-plan form as before, covering the ten points the owner listed.
**No code for 8d, 8e or 8f until that design is delivered and approved.**
8a and 8b are unaffected by any of this and remain available to build
independently first if preferred — 8a has no dependency on the social-layer
redesign at all, and 8b now explicitly depends on 8d rather than being
blocked on a retention question.

**Unverified:**
- Nobody has opened `/feed`, a profile, or `/social-comments/[id]` in a
  browser this session. The reputation card, the endorse control's visual
  states, and the feed's per-row button choice are `Verified: renders.
  Unverified: behaves` at best — proven by test and by direct SQL, not by a
  person looking at the screen.
- The "most useful review" tie-break (`order by endorsement_count desc, id
  asc`) is arbitrary and undocumented in the UI — two reviews tied at the top
  will silently prefer the lower UUID with no explanation shown.
- Average endorsements per review is rounded to 2 decimal places
  server-side; no test asserts the exact rounding behaviour at a boundary
  (e.g. `x.005`).
- `docs/REVIEW_REPUTATION_TEST_PLAN.md` has not been run by a person.

---

### 2026-08-04 — Packet 8 — privacy review done, packet split, no code written

**Did:** Wrote the `privacy-reviewer` pass the brief demands on "My Map",
before building it. It changed the packet. Nothing under `app/` or
`components/` was touched.

---

#### The privacy review: My Map

The brief's own criterion: "`privacy-reviewer` agent review passes on My Map —
a personal map of visited places is a movement history. Check what is exposed
to other Explorers viewing the profile."

**Finding 1: there is no such thing as a visit in this database.**
`RULES.md` distinguishes them carefully — a **Visit** is "a private, verified
presence at a place (Stage One, via QR)" and a **Check-in** is "a public,
opt-in, expiring presence (Stage Two)". Only one of those exists. The tables
matching `%visit%`, `%checkin%` or `%scan%` are exactly one: `live_checkins`.

So "a map of places you have visited" can only be built from check-ins, and a
check-in is not a visit. Building My Map from them silently redefines a word
`RULES.md` sets aside two lines to keep separate.

**Finding 2: check-ins are the one thing the app promises to forget.**
`CLAUDE.md`: check-ins are "opt-in, temporary and plainly explained", expire on
their own between 15 minutes and 4 hours, and "Never make a person a permanent
trackable marker." A map that plots every check-in you have ever made is a
permanent record assembled out of things that were each promised to be
temporary. The rows do persist — `live_checkins` keeps `status`, `expires_at`
and `ended_at` rather than deleting — so the history is already there. My Map
would not create it. It would *surface* it, and turn "expires in 4 hours" into
"remembered forever, shown back to you on a map".

**Finding 3: the exposure question the brief asks is already answered, and
answered well.** The `SELECT` policy on `live_checkins`, read from the live
project:

```
user_id = auth.uid()
OR (status = 'active' AND expires_at > now()
    AND NOT blocked(user_id, auth.uid())
    AND (visibility = 'public' OR viewer follows user_id))
```

Another Explorer can therefore only ever read a check-in that is **active and
unexpired**. Expired rows are invisible to everyone except their owner. And
because one active check-in per Explorer is enforced, the most another Explorer
can ever see is a single current position — not a history, and not a map.

**So the answer to "what does My Map expose to other Explorers" is: nothing,
provided it is never given a share control.** The database will not serve
another Explorer the rows a map would need. That is a strong position and it
was not built by accident.

**What I would build, and the one thing I will not decide alone.**

Safe, and I am confident in it:
- My Map renders **only on your own profile**. Not empty for other viewers —
  absent, so no later change can accidentally populate it.
- It is sourced from your own `live_checkins` and nothing else.
- It gets **no `is_public` flag, no share control, no sort order**.
  `explorer_favourites` has `is_public` and Collections uses it; the equivalent
  here would be a published movement history, and it must not exist.

Not mine to decide, and the reason this packet stops here:

> **Should your own map remember check-ins after they expire?**
>
> Showing them is useful and exposes nothing to anyone else. It also quietly
> converts a feature sold as temporary into a personal history you did not ask
> to be kept. The alternatives are (a) show all of it, (b) show a bounded
> window such as the last 30 days, (c) show only places you also saved, or
> (d) do not build My Map from check-ins at all and wait for Stage One Visits,
> which is what `RULES.md` says the map of visited places is actually made of.
>
> My own read is **(d), then (b)**: the tab the brief describes wants Visits,
> and there are none yet. If it must ship now, a bounded window keeps the word
> "temporary" closer to true than an unbounded one. But this is a promise to
> users about their own location history, and `RULES.md` says to stop and ask
> rather than pick one.

**No code was written for My Map. No policy, table or RPC was touched.**

---

#### The rest of Packet 8, and a second finding

The other half of the packet has no privacy weight and is ready to build:

**Three separately labelled figures.** The profile currently shows two pills,
`AVG RATING` and `REVIEW POINTS`, from the `explorer_profile_stats` view
(`review_count`, `average_rating_given`, `verified_review_count`,
`video_review_count`, `image_review_count`, `total_points`).

The brief wants three: Explorer Score, Average Review Score, Review Reputation.
**Two of them are a problem, in different ways.**

*Explorer Score does not exist yet, and belongs to Packet 9a.* The brief says
9a builds the scoring engine and that points must be awarded server-side.
`total_points` is review points, not an Explorer Score. Labelling it "Explorer
Score" now would name a thing 9a has to build and then contradict.

*Review Reputation cannot mean what it sounds like.* `RULES.md`: "Reviews
attach to places, clubs and events — not to Explorers." **An Explorer cannot
receive a review score**, so "Review Reputation" cannot be the average rating
somebody was given. The defensible reading from data that exists is *how
trustworthy this Explorer's reviews are* — the share that are QR-verified,
which `verified_review_count / review_count` already supports. That is a real
measure and an honest label, but it is my interpretation of an ambiguous phrase
and should be confirmed.

The brief is right that merging these is confusing. It is right for a bigger
reason than it says: two of the three do not currently mean anything.

---

**Acceptance criteria:** none met. The packet was not built.

**Stopped because:** the privacy review turned up a question that is the
owner's, and `RULES.md` says to stop and ask on exactly this kind of change.

**The split:**

- **8a — the three figures and the scrapbook tabs.** Adventures, Reviews,
  Collections, Clubs. No My Map. Needs the Review Reputation reading confirmed
  and needs to not borrow Packet 9a's Explorer Score.
- **8b — My Map**, after the retention decision above.

**Exact next step:** answer the retention question, and confirm or correct the
Review Reputation reading. Then 8a, which does not depend on either but should
not ship a figure whose meaning is still open. If both answers are wanted
before any of it moves, 8a can be built with **two** honest figures and the
third added when it means something — that is better than three where one is
mislabelled.

**Unverified:** nothing was built. The RLS policy and the table list were read
out of the live project rather than remembered; the counts of expired rows were
zero because no check-in exists in the database today, so the policy's
behaviour on expired rows is read from its definition rather than exercised.

---

### 2026-08-04 — Packet 7 — done

**Did:** Built the Discover screen, replacing the placeholder Packet 3 left
there, around the rule the packet turns on.

- `utils/discover.js` (new) issues the reason. `reasonFor` returns a sentence
  or `null`; `recommend` drops everything that got `null`.
- `app/discover.js` rewritten. Six sections, every one passed through
  `recommend`.
- `test/discover.test.js` (new), 24 assertions.
- `scripts/verify-discover.cjs` (new), 30 checks.

**The reason is the admission ticket, not a caption.** "Every recommendation
must carry a visible reason string. If the reason cannot be computed, the item
does not appear." The ordering is the whole thing: a reason computed *after*
selection ends up being written to justify whatever was already on screen,
which is how "Recommended for you" comes to mean "we had this row handy". So
nothing reaches the screen except through the function that can refuse.

**Every reason is derived from something the database holds** — a saved row, a
start time, a measured distance, a matching area. There are five, tried in that
order, most specific first. **None claims popularity**, because nothing in this
app measures it, and the gate fails on the words.

**Files changed:** `utils/discover.js`, `test/discover.test.js`,
`scripts/verify-discover.cjs` (all new); `app/discover.js` (rewritten);
`package.json`, `.github/workflows/quality-checks.yml`.

**Acceptance criteria:**

1. No recommendation renders without a reason — **PASS**, from both ends. The
   engine cannot produce a reasonless item, and the gate reads the screen's
   `setItems` call and fails if any section is assigned an array that did not
   go through `recommend()`. The card's accessible name is
   `"<title>. <reason>."`, so a reasonless card would be detectable by its name
   alone.
2. Empty state per section is an instruction, not a mood — **PASS**. All six
   are asserted to name an action and to avoid "nothing here" / "no results".
3. Saved reads the same store as the profile Collections tab — **PASS, with a
   deliberate difference in the filter.** Both read `explorer_favourites`. The
   Collections tab filters `is_public`, because that is somebody else looking
   at your profile; Discover shows your own list unfiltered, because hiding
   your own private saves from you is that filter applied to the wrong person.
   The gate fails if Discover ever copies it, and also fails if the profile
   stops reading the table at all.

**Two departures from the brief's section list, both recorded rather than
quietly taken.**

*No Feed section.* `app/feed.js` already is that screen, built on
`get_explorer_social_feed` and reachable from the drawer. A strip of the same
rows here would be a second place to maintain one thing. Discover ends with a
row pointing at it.

*"For You" is not a recommender.* It is your recent saves and what is live near
you, both of which produce honest reasons. Nothing in this repository could
support a personalised ranking, and inventing one would have meant inventing
reasons for it.

**Eight checks demonstrated failing before being kept:**

| Broke | Caught by | Message |
|---|---|---|
| engine blanked instead of dropping | test **and** gate | `must drop an item with no reason` |
| screen rendered a section straight from its query | test **and** gate | `section "events" is not passed through recommend()` |
| an empty state became a mood | test | `instructs in every empty state` |
| a live-feed failure was swallowed | test | `says so when live activity could not be loaded` |
| a reason claimed popularity | gate | `nothing in this app measures that` |
| Saved copied the profile's `is_public` filter | gate | `the filter for somebody else looking at your profile` |

**Two mistakes of mine worth recording, because both nearly passed as work.**

*The gate was failing for the wrong reason.* Its first version matched the
first `setItems({...})` in the file — which is the signed-out branch's
`setItems({})` — found no sections in an empty object, and reported "no
sections found". It looked like a real failure about the screen and was a
failure about the regex. It now picks the call that actually has sections in
it. **A check that fails for the wrong reason is as misleading as one that
passes for the wrong reason**, and this one would have been "fixed" by
someone changing the screen.

*I clobbered `app/discover.js` with a bad backup.* The demonstration script
copied `utils/discover.js` and `app/discover.js` into one directory, where they
share a basename; the second copy was refused, and a later restore wrote the
utils module over the screen. It was caught immediately by the test run, and
the screen was rewritten. Nothing was lost, but the near-miss is the point:
**the backup that protects a demonstration has to be as carefully named as the
code it protects.**

**Also run:** `npm run test:ci` → **306 passed**; discover 30; map cards 16;
place layout 96; taxonomy 137; markers 277; screen gates 72; social 92; live
152 + 39; linkup nav 20; title-only 28; seed 3; `npx expo-doctor` 20/20; web
export succeeded.

**CI:** run 36 on `e898ea8`, conclusion **`success`**, read back from the API
after the run completed.
https://github.com/simplebusiness26/The-App/actions/runs/30965510547

**Stopped because:** finished. One packet per session.

**Exact next step:** Packet 8, Explorer profile and reputation. Read it in
`docs/REDESIGN-BRIEF.md`. It wants Explorer Score, Average Review Score and
Review Reputation as **three separately labelled figures**, with Average Review
Score labelled explicitly as scores this Explorer *gave*. Its second criterion
is a `privacy-reviewer` pass on "My Map" — a personal map of visited places is
a movement history, and the brief says to check what it exposes to other
Explorers viewing the profile. Treat that the way 5c was treated: the review
comes first, and `components/ExplorerProfileScreen.js` is where it lands.

**Unverified.**

- **Nobody has seen the Discover screen.** Ten packets in.
- The reason strings have never been read in place. "300 m from you" and
  "Starts in 40 minutes" are asserted as strings; whether a screen full of them
  reads as useful or as noise is unknown.
- `get_live_discovery` is called with the Explorer's area and a 24-hour window
  and **has never returned a real row in this work**. Its failure path is
  handled and tested; its success path is shaped from the migration's `returns
  table(...)` declaration, not from an observed response.
- The six-hour cutoff on "Starts in..." is a judgement, not a measurement.
  Nobody has checked whether it leaves the Events section empty in practice.
- "For you" mixes saves and live items with no ranking between them beyond the
  order they were concatenated.

---

### 2026-08-04 — Packet 6 — done

**Did:** Built the bottom card, on both surfaces, with no new dependency.

- `utils/placeCards.js` (new) turns a row from any of the three map tables into
  a card, and builds the swipeable set around a tapped place.
- `utils/geo.js` (new) is the distance ordering, extracted on its third caller.
- `components/PlaceCards.js` (new) is the sheet: drag to dismiss, swipe between
  places, reduced-motion aware.
- `app/map.js` and `components/PlacesList.js` both open it.
- `scripts/verify-map-cards.cjs` (new), 16 checks. `test/map-cards.test.js`
  (new), 19 assertions.

**Nothing was installed.** The brief asks for a draggable card that swipes
between places, which sounds like `react-native-gesture-handler` and a bottom
sheet library. It is `PanResponder` and a `pagingEnabled` ScrollView, both from
react-native. `RULES.md` says ask before adding a dependency; nothing needed
asking for, and the gate now fails if a gesture or sheet library appears.

**The card is used in the list, not only on the map.** This is the point the
brief is emphatic about and it is easy to get wrong: no Google Maps API key is
set, so `PlacesList` is the shipping path and a card that only worked on
`react-native-maps` would be a feature nobody could reach. Tapping a list row
now opens the same card the map would, and the card offers the full page rather
than replacing it. The gate fails if either surface stops offering it, or if
the card or the list imports the map library.

**Files changed:** `utils/placeCards.js`, `utils/geo.js`,
`components/PlaceCards.js`, `test/map-cards.test.js`,
`scripts/verify-map-cards.cjs` (all new); `app/map.js`,
`components/PlacesList.js`, `app/business/[id].js`, `app/property/[id].js`
(now share `nearestFirst`), `test/setup.js`, `package.json`,
`.github/workflows/quality-checks.yml`.

**Acceptance criteria:**

1. Map position unchanged after opening, swiping and dismissing — **PASS**, and
   asserted rather than reasoned about. The test reads the `MapView`'s own
   props before a marker tap and again after, and checks `initialRegion` is
   identical and that no `region` prop has appeared. An uncontrolled map keeps
   where it was left; a `region` prop is what would drag it back on every
   render. The card is a `Modal`, so it is outside the map's view tree
   entirely. Both facts are also gated in the source.
2. Works with the list fallback when no Maps API key is set — **PASS**. Both
   paths are exercised: with a key the screen renders a `MapView` and a marker
   tap opens a card; with no key it renders the list and a row tap opens the
   same card. The API key is now read inside the component rather than at
   module scope, which is what made the fallback testable at all.
3. `prefers-reduced-motion` respected — **PASS in code, unverified in
   behaviour.** `AccessibilityInfo.isReduceMotionEnabled` decides whether the
   sheet slides, and the gate requires it. Nobody has turned reduced motion on
   and watched.

**Six checks demonstrated failing before being kept:**

| Broke | Caught by | Message |
|---|---|---|
| gave MapView a `region` prop | test **and** gate | `does not move when a card is opened` |
| dropped the tapped place from its own set | test | `puts the tapped place first` + 2 more |
| removed the card from the list fallback | test | `opens the same card from a list row` |
| made the card always open at index 0 | test | `opens on the place that was tapped` |
| added `react-native-gesture-handler` | gate | `a new dependency needs asking for first` |
| imported `react-native-maps` into the card | gate | `the card is shown with and without a map` |

**Two of those needed a second attempt, and both were my test being wrong.**
Dropping the tapped place from its own set first "passed", because I broke it
by re-sorting a list that still contained the tapped card — which is always
zero distance from itself and therefore still first. And the start-index check
could not fail while its fixture opened on the first card; it now opens on the
second. **That is the fourth and fifth time in this run a check has looked
convincing and proved nothing.** Every one was found by trying to break it, and
none would have been found by reading it.

**One change beyond the packet, taken because the rule said so.** `RULES.md`:
"Two similar things stay duplicated until there are three." The distance sort
was written twice in Packet 5a and left alone deliberately. Packet 6 is the
third caller, so it moved to `utils/geo.js` and the two place pages now import
it.

**Also run:** `npm run test:ci` → **282 passed**; map cards 16; place layout 96;
taxonomy 136; markers 277; screen gates 72; social 92; live 152 + 39; linkup nav
20; title-only 28; seed 3; `npx expo-doctor` 20/20; web export succeeded.

**CI:** run 35 on `d489c2f`, conclusion **`success`**, read back from the API
after the run completed.
https://github.com/simplebusiness26/The-App/actions/runs/30964920405

**Stopped because:** finished. One packet per session.

**Exact next step:** Packet 7, the Discover screen. It replaces
`app/discover.js`, which Packet 3 left as a placeholder listing the discovery
surfaces that already work. Its hard rule is the interesting one: "Every
recommendation must carry a visible reason string. If the reason cannot be
computed, the item does not appear." Note the Saved section "reads the same
store as the profile Collections tab" — that is `explorer_favourites`, which
`components/FavouriteButton.js` already writes to.

**Unverified.**

- **Nobody has seen the card.** Nine packets in, still nothing has been opened
  by a person.
- **The drag is the least verified thing in this packet.** `PanResponder` with
  `Animated` is exercised only by mounting: no test moves a finger. Whether the
  threshold feels right, whether a downward drag steals a sideways swipe, and
  whether the spring-back looks correct are all unknown. The gesture rule tries
  to claim only clearly-downward drags, but that is a judgement written into a
  comparison, not a measurement.
- **Swiping between places is equally untested as a gesture.** The test proves
  every card is rendered so a swipe has somewhere to land; it does not scroll.
- `Dimensions.get("window").width` is read once at render. On a rotation the
  page width would be stale until the next render, which nobody has tried.
- Tapping a list row no longer goes straight to the place page. That is a real
  change to a shipped behaviour, made deliberately so the card is reachable
  without a map, and it costs a list user one extra tap to reach a full page.
  **If that reads badly in use, the fix is to keep row taps navigating and open
  the card only from the map — but then the card ships to nobody until a Maps
  key exists.**

---

### 2026-08-04 — Packet 5c — done, after a privacy review

**Did:** Wrote the privacy review `RULES.md` requires, found it cleared the
conversion, then moved link-ups onto `PlaceLayout`. All five place page types
now share one component.

---

#### The privacy review

`RULES.md`: "Any change that touches location, presence, visibility or another
Explorer's whereabouts is safety-critical. For these: Stop. Describe what you'd
build and what it would expose. Wait."

**What the page exposes, and to whom.** `app/linkups/[id].js` shows four things
that are not public: the meeting point (`linkup_private_details.
meeting_point_details`), the attendee list with names and photos, the private
board, and the organiser's area when they have opted to show it.

**What decides that, and it is not this file.** The policy
`linkup_private_select_members` restricts `linkup_private_details` to the
creator, or an active member who has not been blocked. `linkups`,
`linkup_attendees` and `linkup_messages` each carry their own policy.
**All four have RLS armed on the live project** — checked, not assumed:

| Table | RLS enabled | Policies |
|---|---|---|
| `linkups` | true | 1 |
| `linkup_private_details` | true | 1 |
| `linkup_attendees` | true | 1 |
| `linkup_messages` | true | 1 |

And the boundary was exercised rather than read. A real link-up was given a
meeting point inside a transaction, read back as two real accounts, and rolled
back:

| Caller | Rows visible |
|---|---|
| the creator | **1** |
| a real Explorer who has not joined | **0** |

**So the conclusion is that this conversion cannot widen exposure.** What a
person can see is decided in the database before any component runs. Rendering
the page differently cannot reveal a meeting point, because a non-member's
query returns nothing to render. That is what made it safe to proceed in the
same session rather than stopping — the thing the rule protects against is not
present here.

**Two consequences taken from that, rather than in spite of it.** The
client-side `joined &&` check stays, and is now pinned by both a test and a
gate. It is not the boundary, but a boundary with one lock is one mistake from
being open. And a gate check now fails if the RLS policy is ever dropped from
the migration, because at that point the client check *would* be the only thing
left.

**What I did not do:** touch any policy, any RPC, or `linkups/board/[id].js`.
The review covers the detail page only.

---

**Files changed:** `app/linkups/[id].js` (rewritten); `components/PlaceLayout.js`
(`showPhotos`, `showReviews`, `beforeActions`); `utils/markers.js`
(`LINKUP_TYPE_LABEL`); `test/place-page.test.js` (+10);
`scripts/verify-place-layout.cjs` (75 → 96 checks).

**Photos and reviews are omitted, not emptied.** Link-ups have no photos, and
there is **no `linkup_reviews` table anywhere in the migrations**. Passing
`reviews={[]}` would have rendered "No reviews yet" on a page where reviewing
is not a thing — an invitation to do something the app cannot record. Two
capability flags, not page-type branches: a link-up has no photos and no
reviews, which is a fact about link-ups rather than a special case in the
layout.

**Acceptance criteria:**

1. All page types use one component; grep proves no duplicate — **PASS, and now
   complete.** Five of five: business, property, event, activity club, link-up.
   96 checks. The brief said six; `park` has no table, no row and no page, as
   recorded when Packet 5 was split.
2. Listing type matches the map marker — **PASS where a marker exists.** Clubs
   and businesses genuinely match. Events and link-ups are not on the map at
   all, so their labels exist in `utils/markers.js` only so that whichever
   packet puts them there inherits the word instead of inventing a second.
3. Loading, empty, error, unauthorised — **PASS, and link-ups are the one page
   with a real unauthorised state.** A signed-out visitor is redirected to
   login, and an Explorer who cannot see the link-up gets "This Link-up is
   unavailable or no longer visible to you" — which is deliberately the same
   message whether it was cancelled, is followers-only, or the organiser has
   blocked them. Distinguishing those would leak the thing the visibility rule
   is protecting.
4. No disabled or "coming soon" controls — **PASS.**

**Seven checks demonstrated failing before being kept, four of them privacy:**

| Broke | Caught by | Message |
|---|---|---|
| meeting point rendered for everyone | test | `hides the meeting point from someone who has not joined` |
| safety controls removed | test | `keeps the safety controls in reach of everyone but the organiser` |
| private board opened to strangers | test | `opens the private board only to someone who has joined` |
| attendee removal offered to everyone | test | `lists attendees and offers removal only to the organiser` |
| the second lock removed | gate **and** test | `must stay behind a joined check` |
| RLS policy dropped from the migration | gate | `policy is missing — the meeting point would have no server-side boundary` |
| reviews section turned on | gate **and** test | `link-ups have no reviews table` |

**The attendee-removal check needed writing twice, and the first version was
worse than useless.** Its fixture put only the viewer in the attendee list, so
the removal control was suppressed by "not me" rather than by "not the
organiser" — deleting the organiser check changed nothing and the test passed.
It now seeds a second attendee. **That is the third time in this run a check has
looked convincing and proved nothing**, and all three were found only by trying
to break them.

**On the line count, honestly.** 143 lines became 398, which looks terrible and
is mostly formatting: the original was written in a compressed style with an
849-character line. By characters it is 14,691 to 17,968, about +22%, and the
growth is accessibility labels the original did not have and comments recording
the privacy reasoning. Across all five pages plus the layout the total is now
1,806 lines against 1,336 before Packet 5 began.

**Also run:** `npm run test:ci` → **263 passed**; place layout 96; taxonomy 133;
markers 275; screen gates 72; social 92; live 152 + 39; linkup nav 20;
title-only 28; seed 3; `npx expo-doctor` 20/20; web export succeeded.

**CI:** run 33 on `880cb5a`, conclusion **`success`**, read back from the API
after the run completed.
https://github.com/simplebusiness26/The-App/actions/runs/30946819933

**Stopped because:** finished. Packet 5 is now complete in all three parts.

**Exact next step:** Packet 6, map bottom cards. Read it in
`docs/REDESIGN-BRIEF.md`. Two things it says that matter here: the map position
must survive opening, swiping and dismissing a card, and it must work with the
**list fallback**, because `PROJECT-LOG.md` records that no Google Maps API key
is set and `PlacesList` is what actually ships. Packet 6 is also where a
full-screen map mode would be added — if one is, it goes in
`FULL_SCREEN_ROUTES` in `utils/navigation.js`, not `/map`, which is the Map tab.

**Unverified.**

- **Nobody has opened any of the five place pages.** That is the whole of
  Packet 5 verified by assertions and never by a person.
- The privacy conclusion is `Verified: used` — real SQL, real accounts, read
  back. Everything drawn on the page is `renders, not behaves`.
- `join_linkup`, `leave_linkup`, `cancel_linkup`, `remove_linkup_attendee`,
  `report_live_safety` and `block_explorer` were all moved verbatim and none
  has been called. A regression in any of them is a data or safety path.
- The report form's reason chips now carry `accessibilityState`; the original
  had none. Untested beyond rendering.
- All five place pages are now riso while most of the app is still dark.
  Packet 11 remains blocked on the palette decision, and the gap is now as wide
  as it will get before that decision is made.

---

### 2026-08-04 — Packet 5b — done

**Did:** Moved events and activity clubs onto `PlaceLayout`, in the same order
5a used: assertions written against the **original** screens, watched failing,
then re-run unchanged after the rewrite.

- 18 new assertions in `test/place-page.test.js` (32 total across four page
  types).
- `components/PlaceLayout.js` gained three things and no branches: a `stats`
  prop, and `beforeReviews` / `afterReviews` slots.
- `app/events/[id].js` and `app/activity-clubs/[id].js` rewritten.
- `utils/markers.js` gained `EVENT_TYPE_LABEL`.
- `scripts/verify-place-layout.cjs` now covers four page types, 75 checks.

**No branches were added to the layout, on purpose.** Clubs need three stat
boxes where a business needs two, and both new pages need blocks the shared
sections do not describe — an event's manager box, a club's membership state,
its sessions, its announcements. All of it arrives as slots. A `kind` prop with
branches inside would have made the layout grow a limb per page type, which is
the duplication it exists to remove wearing a different coat.

**The lines finally came down.** 5a went up: 476 to 745. 5b: the two pages were
717 lines and are now 638, while the layout grew only 14 (348 to 362). Net for
this packet, 1,065 to 1,000. That is the saving 5a predicted arriving on
schedule, and 5c should improve it again.

**Four review tables, one review card.** `reviews` uses `name`;
`event_reviews` and `activity_club_reviews` both use `reviewer_name`. Rather
than widening `PlaceReview` to know about three column names, each screen
normalises its rows into the shape the card already renders. The layout stays
ignorant of which table a review came from, which is what will let 5c decide
what a link-up does about having no reviews at all.

**Acceptance criteria:**

1. Converted page types use one component; grep proves no duplicate — **PASS**,
   75 checks across four pages. The 5b additions to the forbidden list are
   `reviewPhoto:`, `pointsBadge:` and `emptyStars:` — the event and club
   screens had spelled the same pieces differently, which is how four copies of
   a review card came to exist in the first place.
2. Listing type matches the map marker — **PASS for clubs, vacuous for
   events, and recorded as such.** The club page now shows `CLUB_TYPE_LABEL`,
   the same constant `markerForClub` builds its spoken label from, with the
   club's own category moved into the info rows. **Events are not on the map at
   all** — `app/map.js` renders businesses, properties and clubs — so there is
   no marker for an event page to match. `EVENT_TYPE_LABEL` exists anyway so
   that whichever packet puts an event on the map inherits the word instead of
   inventing a second one. There is deliberately no `markerForEvent()` until
   something renders it.
3. Loading, empty, error, unauthorised — **PASS for three; unauthorised still
   does not exist.** Same as 5a: these pages are public. A club's *private*
   parts are gated (board, review) and the gates are asserted, but the page
   itself refuses nobody.
4. No disabled or "coming soon" controls — **PASS, with one judgement call
   recorded.** The event page keeps its locked review button: before the event
   starts it reads "🔒 Reviews unlock when the event starts". That is not a
   later-stage placeholder and not a dead control — the button stays pressable
   and explains itself, and reviews genuinely do open when the event starts.
   Saying which it is now is state, which is what this app is built on. An
   assertion pins both halves so neither can quietly become the other.

**Seven checks demonstrated failing before being kept:**

| Broke | Caught by | Message |
|---|---|---|
| club board shown to non-members | `place-page.test.js` | `opens the private board only to approved members` |
| club review gate dropped | `place-page.test.js` | `offers the review control only to a member or former member` |
| join form removed | `place-page.test.js` | `invites a non-member to request a place` |
| event review time-gate removed | `place-page.test.js` | `says when reviews unlock instead of offering them early` |
| event manager controls leaked | `place-page.test.js` | `shows manager controls only to the manager` |
| club kept its own star rendering | `verify-place-layout` | `still defines the star rating` |
| club hardcoded its type label | `verify-place-layout` | `typeLabel must be CLUB_TYPE_LABEL` |

**Also run:** `npm run test:ci` → **253 passed**; taxonomy 133; markers 275;
place layout 75; screen gates 72; social 92; live 152 + 39; linkup nav 20;
title-only 28; seed 3; `npx expo-doctor` 20/20; `npx expo export --platform
web` succeeded.

**CI:** run 31 on `b42f2da`, conclusion **`success`**, read back from the API
after the run completed.
https://github.com/simplebusiness26/The-App/actions/runs/30945397313

**Stopped because:** finished. One packet per session.

**Exact next step:** Packet 5c — link-ups. **It does not start with code.**
`app/linkups/[id].js` renders `linkup_private_details.meeting_point_details`
behind a `joined` check and owns the report and block controls, so `RULES.md`
requires writing down what a shared layout would expose and waiting for the
owner before building. Write that description first. Note link-ups have no
reviews table at all, so the layout's reviews section has to be omitted rather
than emptied — passing `reviews={[]}` would render "No reviews yet" on a page
where reviewing is not a thing.

**Unverified.** `Verified: renders. Unverified: behaves`.

- **Nobody has opened either page.** Four of the five place pages have now been
  rewritten and none has been seen by a person.
- The club membership state machine has six states and the assertions cover
  four of them (none, pending, approved, manager). `rejected`, `removed` and
  `left` render blocks that are asserted only by mounting.
- `applyToJoin` was moved verbatim and is untested beyond compiling. It writes
  to `activity_memberships`, so a regression there is a data path, not a
  cosmetic one.
- The event page's start-time comparison uses the device clock. Unchanged from
  before, but now the only thing deciding which of two buttons a person sees.
- Both pages changed appearance completely, dark to riso. **Four of five place
  pages, the drawer, Discover and Create are now riso; everything else is still
  dark.** The split is widening with each packet, as predicted, and Packet 11
  is still blocked on the palette decision.

---

### 2026-08-04 — Packet 5a — done

**Did:** Built the harness this refactor needed, then the shared place layout
behind it, and moved business and property onto it.

The order matters and was the point of splitting Packet 5. The assertions were
written against the **original** screens, watched fail by deleting controls
from those screens, and then re-run **unchanged** after the rewrite. A refactor
test written after the refactor only proves the new code does what the new code
does.

- `test/fixture.js` (new) lets a test say "here is a business, here is who is
  looking at it" and then assert what appears.
- `test/place-page.test.js` (new), 14 assertions.
- `components/PlaceLayout.js` (new): hero, title and verification, listing
  type, rating, primary action, essential info, photos, reviews, similar
  nearby.
- `app/business/[id].js` and `app/property/[id].js` rewritten onto it.
- `scripts/verify-place-layout.cjs` (new), 35 checks.
- `utils/markers.js` now exports the type labels its own markers are built
  from, so a page and its pin read the same source.

**The harness is the part worth keeping.** Before this, the only thing that
could see a place page was `routes.test.js`, which mounts it against an empty
Supabase result. With no data, none of the conditional controls render at all —
so the claim button, the favourite button, the review link and the owner's edit
button were invisible to every existing test. Each was deleted in turn to prove
the new assertions catch it:

| Control removed | Result |
|---|---|
| the review link | 1 failed, 13 passed |
| the claim button | 1 failed, 13 passed |
| the favourite button | 1 failed, 13 passed |
| owner-only edit leaked to every visitor | 1 failed, 13 passed |
| the property page's "not displayed publicly" QR note | 1 failed, 13 passed |

Each failure is isolated to its own assertion, which is what makes them useful
rather than a single tripwire that goes off for any reason.

**Files changed:** `test/fixture.js`, `test/place-page.test.js`,
`components/PlaceLayout.js`, `scripts/verify-place-layout.cjs` (all new);
`app/business/[id].js`, `app/property/[id].js` (rewritten); `utils/markers.js`,
`test/setup.js`, `package.json`, `.github/workflows/quality-checks.yml`.

**Acceptance criteria** (as scoped by the 5a/5b/5c split recorded in the
previous session):

1. All converted page types use one component; grep proves no duplicate —
   **PASS**. `verify-place-layout.cjs`, 35 checks: both screens import and
   render `PlaceLayout`, and neither still defines the review date formatter,
   the review card, the photo viewer, the hero strip or the rating block —
   each of which existed twice before. The layout must define all five.
2. Listing type displayed matches the map marker for the same record —
   **PASS**, and by construction rather than coincidence. `utils/markers.js`
   exports `typeLabelForBusiness()` and `PROPERTY_TYPE_LABEL`, the pages read
   them, and the markers build their spoken labels from the same values. The
   gate matches at the point of use.
3. Loading, empty, error, unauthorised states all present — **PASS for three,
   and the fourth does not exist here.** Loading, error and empty are each
   asserted. There is no unauthorised state on a place page: a business page is
   public, and a signed-out visitor sees the page without the controls that
   need an account. Inventing a refusal screen would be wrong, not thorough.
4. No disabled or "coming soon" controls anywhere — **PASS**, twice over: a
   test asserts the rendered text contains no Directions, Book a table, Get
   tickets or coming soon, and the gate asserts the source does not either.

**Total lines went up, not down, and that is the honest number.** 476 before
(236 + 240), 745 after (199 + 198 + 348). The duplicated parts genuinely exist
once now, but the layout is a superset of what it replaced: it adds "similar
nearby", which did not exist on either screen, and accessibility labels the
originals never had. The saving arrives in 5b and 5c, which add page types
without adding markup.

**Similar nearby, since it is new.** For a business it is the same *category*,
not the same type — with three types seeded, matching on type would return
nothing for most places, and someone looking at a pub is usually open to the
bar next door. For a property it is any other property. Both order by squared
coordinate distance, which is rough but adequate for ranking a dozen places in
one town, and both keep rows with no coordinates rather than dropping them.

**Three checks demonstrated failing before being kept**, beyond the five
control deletions above:

| Broke | Caught by | Message |
|---|---|---|
| left a copy of the review card on the page | `verify-place-layout` | `still defines the review card style` |
| put a Directions control on the shared layout | gate **and** test | `Directions is Stage Four`, and `shows no later-stage controls` |
| hardcoded the property type label | `verify-place-layout` | `typeLabel must be PROPERTY_TYPE_LABEL` |

The third of those is worth recording because **the first version of that check
passed and proved nothing.** It tested whether `PROPERTY_TYPE_LABEL` appeared
anywhere in the file, and replacing the prop with a literal left the import
behind, so the identifier was still there. It now matches at the point of use.
That is the second time in this run a check has needed breaking twice before it
was real.

**Also run:** `npm run test:ci` → **235 passed** (68 route mounts, 27 marker,
92 navigation, 34 drawer, 14 place page); taxonomy 133; markers 275; place
layout 35; screen gates 72; social 92; live 152 + 39; linkup nav 20;
title-only 28; seed 3; `npx expo-doctor` 20/20; `npx expo export --platform
web` succeeded.

**CI:** run 29 on `cd8bf69`, conclusion **`success`**, read back from the API
after the run completed.
https://github.com/simplebusiness26/The-App/actions/runs/30936611611

**One incidental fix.** `test/setup.js` never mocked `supabase.channel`.
`NotificationContext` opens a realtime channel, but only once a user is signed
in, and no test had ever supplied a session — so the gap was invisible until
this one did. Every place-page test failed on it before it was added.

**Stopped because:** finished. One packet per session.

**Exact next step:** Packet 5b — events and activity clubs onto `PlaceLayout`.
Both bring their own reviews table (`event_reviews`, `activity_club_reviews`)
which must be normalised into the shape `PlaceReview` already renders rather
than widening the layout. Clubs also bring membership, sessions, announcements,
stats and the message board, and at 421 lines are the largest single screen in
the app. Write the fixture-backed assertions for both screens **first**, watch
them fail, then convert. Add each converted path to `CONVERTED` in
`scripts/verify-place-layout.cjs`. Do not touch `app/linkups/[id].js` — that is
5c and it needs the privacy write-up before any code.

**Unverified.** `Verified: renders. Unverified: behaves`.

- **Nobody has opened either page.** The assertions prove the controls are in
  the tree with fixture data; they do not prove the page is usable, that the
  photo viewer opens, or that "similar nearby" returns anything sensible
  against real rows.
- Both pages changed appearance completely — they were dark (`#18181b`) and are
  now riso paper and ink, like `/discover`, `/create` and the drawer. The rest
  of the app is still dark. **The app is now visibly two designs**, and will be
  until Packet 11. That is a deliberate consequence of building to the design
  system as each packet lands, but nobody has seen how jarring it is.
- `similar nearby` runs a second query after the page has already rendered. Its
  failure path is silent by design (a missing section, not an error), which
  also means a broken query would look like "no similar places".
- The photo viewer modal is now reachable from the hero strip as well as from
  review photos, which is new behaviour. Untested beyond mounting.

---

### 2026-08-04 — Packet 5 — split, not started

**Did:** Read the five detail screens, found the packet is three packets and
one of them is a privacy gate, and stopped without editing anything. Rule 5 of
the brief: "Never edit a packet's scope mid-session to make it fit. If it's too
big, split it in the ledger and stop."

Nothing in `app/` was changed. This entry is the whole output.

**First, a correction to the brief.** It says "One layout used by business,
property, park, event, club, link-up" — six page types. **There are five.**
`park` has no table, no row and no page. It exists only as a `place_type`
string on a check-in (`app/checkins/create.js`, and the `place_type` check
constraint in `20260802211500_linkups_live_tables.sql`), where it means "I am
at a park" with no listing behind it. `RULES.md` calls a park a Place, but
nothing has ever created one. A shared layout cannot be used by a page type
that does not exist, so the criterion "all six page types use one component"
is unmeetable as written.

**Why it is three packets.** These are not one page with six skins. Sizes and
distinct behaviour:

| Screen | Lines | Carries |
|---|---|---|
| `business/[id]` | 236 | claim, favourite, call, website, review, owner edit, photo modal |
| `property/[id]` | 240 | claim, favourite, review, owner edit, printable QR |
| `events/[id]` | 296 | favourite, auth-gated review, manager edit, manager dashboard |
| `activity-clubs/[id]` | 421 | membership application with a note, sessions, announcements, stats, message board, manager surface |
| `linkups/[id]` | 143 | join/leave, **private meeting-point details**, attendee list, private board, **report**, **block**, cancel |

They also do not share a reviews table. `reviews` covers business and property
(via `business_id` / `property_id`), events use `event_reviews`, clubs use
`activity_club_reviews`, and **link-ups have no reviews at all** — there is no
`linkup_reviews` table anywhere in the migrations. A "reviews" section in a
shared layout is therefore four different queries and one absence, not one
component with a prop.

**The blocking reason, and it is not size.** The verification harness cannot
protect this refactor. `test/routes.test.js` mounts each screen with an empty
Supabase result and asserts it does not throw. That would stay green if the
rewrite silently dropped the ClaimButton, the FavouriteButton, the review link,
or the report control — every one of them renders conditionally on data or
session state that the smoke test does not supply. Packet 0 built the harness
so that refactors would stop being blind, and for *this* refactor it is not
sufficient. Rewriting 1,336 lines of shipped behaviour behind tests that cannot
see the behaviour is how the crashing map got shipped behind a green build.

**The second blocking reason: `linkups/[id]` is a privacy gate.** `RULES.md`:
"Any change that touches location, presence, visibility or another Explorer's
whereabouts is safety-critical. For these: Stop. Describe what you'd build and
what it would expose. Wait." That screen renders
`linkup_private_details.meeting_point_details`, gated on `joined && privateDetails!==""`
(line 112), and owns the report and block controls. Folding it into a layout
shared with public place pages is exactly the change the rule says to stop and
describe rather than quietly implement. It does not go in the same packet as a
business page, and it does not go in any packet without a `privacy-reviewer`
pass on what the shared layout would expose.

**The proposed split.**

- **5a — the shared layout, plus the harness it needs.** Build
  `components/PlaceLayout.js` and convert `business/[id]` and `property/[id]`,
  which are genuinely the same page: same reviews table, same claim flow, same
  owner-edit, differing only in the claim target and the QR button. First add
  content assertions to the harness — a screen rendered with a fixture that has
  an owner, a session and reviews, asserting the claim, favourite and review
  controls are present — because without that, 5a cannot be verified and
  neither can 5b.
- **5b — events and clubs.** Both bring their own review table and a manager
  surface; clubs add membership, sessions, announcements, stats and the board.
  Onto the layout from 5a with type-specific slots.
- **5c — link-ups, only after a privacy review.** Write down what the shared
  layout would expose about a meeting point and an attendee list before any of
  it is built.

**On "listing type displayed matches the map marker".** This one is already
half-solved and worth knowing: `business/[id]` line 112 renders
`classificationLabel(business)`, the same function `markerForBusiness` uses to
build the marker's spoken label, so business pages and business pins cannot
disagree. The other four types have no equivalent — `markerForProperty` and
`markerForClub` hardcode "Property." and "Club." in `utils/markers.js` while the
screens write their own headings. 5a should give the layout its type label from
`utils/markers.js` so that stays true by construction rather than by
coincidence.

**Acceptance criteria:** none met, none attempted. The packet was not started.

**Stopped because:** too big, and one third of it is a privacy gate that
`RULES.md` says to stop and describe rather than implement.

**Exact next step:** Packet 5a. Start with the harness, not the layout: add a
test that renders `business/[id]` with a fixture containing an owner, a
session and at least one review, and assert the claim, favourite, review and
edit controls appear for the right viewer. Watch it fail by deleting one of
those controls, then build `components/PlaceLayout.js` behind it. Do not touch
`linkups/[id]` in 5a or 5b.

**Unverified:** Nothing was built, so there is nothing to verify. The line
counts, the review-table split and the absence of `linkup_reviews` were read
out of the repository rather than remembered.

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

**CI:** run 26 on `32976c4`, conclusion **`success`**, read back from the API
after the run completed.
https://github.com/simplebusiness26/The-App/actions/runs/30933493402

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

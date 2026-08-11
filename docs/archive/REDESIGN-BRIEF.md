# Redesign brief — work packets

Save to `docs/REDESIGN-BRIEF.md`.

This turns the interface direction document into packets an agent can
finish inside one session. Each packet is independently shippable,
ends in a commit, and has acceptance criteria that can fail.

## Rules for working this brief

1. **One packet per session.** Never start a second packet in the same
   session. A half-landed packet is worse than an unstarted one.
2. **A packet is not done until its acceptance criteria pass, run, with
   output pasted into the ledger.** Not "should pass". Ran.
3. **If a packet cannot be finished, stop and write the ledger entry
   anyway.** Record exactly where it stopped and what the next step is.
4. **Update `docs/REDESIGN-STATE.md` at the end of every packet,**
   pass or fail. This is the only thing that survives a context reset.
5. **Never edit a packet's scope mid-session to make it fit.** If it's
   too big, split it in the ledger and stop.

Dependencies are strict. Do not reorder.

---

## Packet 0 — Build the verification harness

**Nothing else in this brief may start until this passes.** There is
currently no test suite, and the `verify:*` scripts grep source files —
they prove text exists, not that anything runs.

Scope:
- Add a test runner (whatever the repo's package manager and Expo
  version support — do not add a second framework).
- Write smoke tests that *mount* the top-level routes and assert they
  render without throwing. Every route under `app/`. Not string greps.
- Add a CI job that runs: the smoke tests, `npx expo-doctor`, a
  production-style Expo web export, and lint/type checks if configured.
- Fix or quarantine the three migration files that insert test data.
  They must not run against production. Report which files.
- Make the CI job fail loudly. Confirm it fails by deliberately breaking
  a route, watching red, then reverting.

Acceptance criteria:
- [ ] `npm test` (or repo equivalent) runs and reports pass/fail counts
- [ ] Every route file under `app/` has a mount test
- [ ] CI red is demonstrated, not assumed — paste the failing run URL
- [ ] Web export completes and `app.config.js` validates
- [ ] Test-data migrations identified and neutralised, named in the ledger

Do not proceed to Packet 1 without a red-then-green demonstration.

---

## Packet 1 — Business type taxonomy (data layer)

The highest-value item in the whole brief, and the one everything else
depends on. Do it before any UI.

Scope:
- Migration adding a structured classification to businesses:
  `category` (broad), `business_type` (specific), `secondary_types`
  (max 2), `tags` (free-form, additive only).
- The enum lives in **one** file, exported, used everywhere. If a second
  list of business types appears anywhere in the codebase, that's a bug.
- Backfill existing rows. Anything unclassifiable gets an explicit
  `unclassified` value, never null — you need to be able to count them.
- Server-side validation: `business_type` must belong to `category`.
  Enforce in the database, not the form.

Categories and types: use the list in the interface direction document
(Food and drink / Entertainment and nightlife / Health and wellbeing /
Shopping / Attractions and experiences / Essential local services).

Acceptance criteria:
- [ ] Migration applies cleanly and is reversible
- [ ] Backfill run; count of `unclassified` rows reported in the ledger
- [ ] A row with mismatched category/type is rejected by the database
- [ ] Exactly one exported source for the taxonomy — grep proves it
- [ ] Existing business queries still return rows (regression test)

---

## Packet 2 — Marker assignment from type

Scope:
- Pure function: `business_type` → marker. No manual marker override
  anywhere in the manager form.
- Marker set per `docs/design-system.md` pin rules. Under the riso
  system, colour carries *state* (exists / scheduled / offer) and the
  icon carries *type*. Do not let type start controlling colour — that
  breaks the three-ink rule.
- Marker preview component for the manager form.

Acceptance criteria:
- [ ] Every value in the taxonomy maps to a marker; test asserts no gaps
- [ ] `unclassified` has a defined fallback marker
- [ ] No code path lets a manager set a marker directly
- [ ] `designer` agent review passes on the marker component

---

## Packet 3 — Navigation shell

Bottom tabs: Map · Discover · Create · Leaderboard · Profile.

Scope:
- Tab bar component, five tabs, centre raised.
- Every existing route still reachable. Nothing deleted, nothing
  orphaned.
- Tab bar hides on: full-screen photo, QR scan, full-screen map.
- Leaderboard and Discover tabs point at placeholder routes that render
  a real empty state ("Nothing here yet" is banned — write an
  instruction, per design-system copy rules). They get filled in later
  packets.

Acceptance criteria:
- [ ] Route inventory before/after — no route lost. Paste both lists.
- [ ] Back behaviour correct on Android hardware back button
- [ ] Tab bar hidden on the three named surfaces, visible everywhere else
- [ ] Mount tests pass for all five tab roots

---

## Packet 4 — Quick Access drawer

Replaces the hamburger menu page with a slide-over / bottom sheet.

Scope:
- Sections: Explore, Community, My App, Manage, Account and safety.
- Manage section renders only when the Explorer manages ≥1 listing.
  **Check entitlement server-side, not just by hiding the section.**
- Delete the old menu page once every link has a new home.

Acceptance criteria:
- [ ] Every row in the old menu maps to a drawer row or a tab — table it
- [ ] Non-manager account: Manage section absent, and the underlying
      routes reject direct navigation
- [ ] Old menu route removed, no dead imports

---

## Packet 5 — Place page shared layout

One layout used by business, property, park, event, club, link-up.

Scope: hero, title + verification, listing type, rating, primary action,
essential info, photos, reviews, similar nearby.

**Cut from the brief:** Directions (Stage Four), Book a table / Get
tickets (Stage Five). The section ends without them.

Acceptance criteria:
- [ ] All six page types use one component; grep proves no duplicate
- [ ] Listing type displayed matches the map marker for the same record
- [ ] Loading, empty, error, unauthorised states all present
- [ ] No disabled or "coming soon" controls anywhere

---

## Packet 6 — Map bottom cards

Draggable card on marker tap, swipe between nearby places, map position
preserved.

Acceptance criteria:
- [ ] Map position unchanged after opening, swiping and dismissing
- [ ] Works with the current list fallback when no Maps API key is set
      (per PROJECT-LOG, this is the shipping state — do not assume a map)
- [ ] `prefers-reduced-motion` respected on the sheet transition

---

## Packet 7 — Discover screen

Sections: For You, Happening Now, Events, Clubs, Link-ups, Feed, Saved.

Every recommendation must carry a visible reason string. If the reason
cannot be computed, the item does not appear.

Acceptance criteria:
- [ ] No recommendation renders without a reason
- [ ] Empty state per section is an instruction, not a mood
- [ ] Saved section reads the same store as the profile Collections tab

---

## Packet 8 — Explorer profile and reputation

Scope:
- Explorer Score, Average Review Score, Review Reputation as **three
  separately labelled** figures. The brief is right that merging them is
  confusing. Label Average Review Score explicitly as scores this
  Explorer *gave*.
- Scrapbook tabs: Adventures, Reviews, My Map, Collections, Clubs.

Acceptance criteria:
- [ ] Three figures visually distinct and individually labelled
- [ ] `privacy-reviewer` agent review passes on My Map — a personal map
      of visited places is a movement history. Check what is exposed to
      other Explorers viewing the profile.
- [ ] Profile of another Explorer shows strictly less than own profile

---

## Packet 9 — Leaderboard and scoring

The largest new build. Do not start it until Packets 0–8 are green.

Split into 9a (scoring engine + anti-abuse, backend only) and 9b
(leaderboard UI). 9a first.

**9a acceptance criteria:**
- [ ] Points awarded server-side only; client cannot write a score
- [ ] Diminishing returns on repeat check-ins at the same place — test
      asserts the 5th check-in scores less than the 1st
- [ ] Daily and weekly contribution caps enforced in the database
- [ ] Deleting a contribution removes its points — test asserts this
- [ ] Leaderboard queries do not expose location, exact timestamps, or
      anything that reconstructs movement. `privacy-reviewer` mandatory.

**9b:** filters (area / community / time / category), rank card,
achievements.

---

## Packet 10 — Manager Hub

Capability cards, listing management form (with marker preview from
Packet 2), QR management.

Acceptance criteria:
- [ ] Manager access enforced at the database boundary, tested with a
      non-manager account
- [ ] Claim flow requires category, type, primary/secondary, tags,
      hours, location, status before verification completes
- [ ] QR codes not surfaced on public place pages

---

## Packet 11 — Design system pass

Only after the palette decision in `DOC-AMENDMENTS.md` is made.

Acceptance criteria:
- [ ] Grep the whole app for hex values; every one is in the token table
- [ ] `designer` agent review passes on all screens touched by 3–10
- [ ] Accessibility floor: focus rings, 44px targets, reduced motion,
      no state carried by colour alone

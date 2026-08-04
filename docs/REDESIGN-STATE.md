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
**Last completed packet:** 0 — verification harness
**Branch:** `main2.0-Dev` (branched from `main2.0`)
**Blocked on:** the two decisions in `DOC-AMENDMENTS.md` — stage model and
palette. Neither is a coding task. Both are yours. The file is now
committed at the repo root; it was missing entirely until 2026-08-04, so
this blocker could not previously be read, only referenced.

**Next action:** Packet 1 (business taxonomy) is next in sequence and
depends on neither open decision. Note the brief calls it "the highest-
value item in the whole brief, and the one everything else depends on".

## Packet status

| # | Packet | Status | Commit | Verified how |
|---|---|---|---|---|
| 0 | Verification harness | done | `a1e98a1` | 67/67 mount tests; CI red demonstrated (run 16 failure), then green |
| 1 | Business taxonomy | not started | | |
| 2 | Marker assignment | not started | | |
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
3. CI red demonstrated, not assumed — **PASS**:
   - run 13 `fa845da` success — harness landing green
   - run 14 `9593cb9` **cancelled** — first attempt, proves nothing
   - run 16 `067c5f4` **failure**, step "Mount every route" failed
   - run 17 `a1e98a1` — revert, expected green
   https://github.com/simplebusiness26/The-App/actions/runs/30898897118
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

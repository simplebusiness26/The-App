# Project log

Running record of what happened, what was decided, and what is actually
known versus assumed. Newest first.

The `navigator` agent reads this before recommending anything, and
writes to it after each task. Keep the verified/unverified split
honest — it is the only thing standing between this project and
another crashing-map-behind-a-green-build situation.

---

## 2026-08-03 — Repo untangled, map crash landed, CI unblocked

**Did:** Granted the Claude GitHub App write access to The-App and
confirmed push access with a commit round-trip. Changed the repo's
default branch from `claude/guest-book-v3-migration-lw2fj3` to `main`.
Reviewed and merged the map crash fix from
`claude/map-crash-apk-b1b3bw` into main as a clean fast-forward.
Retargeted the APK workflow trigger, then reconsidered and moved it to
`workflow_dispatch` plus a tag trigger. Ran `npm audit fix` to clear a
dependency advisory blocking Quality Checks.

**Found:** The default branch held only documentation and the APK
workflow — no application code — while all 148 commits of the real app
sat on `main`, invisible on the repo landing page. Every APK built to
that point crashed the moment the map opened, because
`react-native-maps` mounts `MapView` without a Google Maps API key and
the native SDK throws fatally. The fix existed but was stranded on its
own branch and had never landed. Separately: the codebase is far past
what CLAUDE.md describes — check-in creation, a live discovery feed
with radius filters, a People tab and `linkups_live_*` migrations are
all built and shipping, while CLAUDE.md still scopes the project to
Stage One "what exists around me".

**Decided:** Defer the Google Maps API key on cost grounds. Accepted
that the map tab therefore shows a searchable list rather than a map —
the fix working as designed, not a bug. Left the repo public for now.
Left `claude/app-vision-alignment-32x51h` stranded for a separate
session; it conflicts with the map fix on `app/map.js` and
`app/map.web.js`. Left the Supabase publishable key in the workflow.

**Now blocked:** Nothing on the critical path.

**Now unblocked:** APKs build from main. CI can run past the audit gate,
so `expo-doctor` and the web export can finally validate
`app.config.js`.

**Deliberately not done:** Maps API key — cost, and it's a product
call. Making the repo private — undecided. Landing the vision-alignment
branch — needs its own session because of the map file conflicts.
Removing the Supabase key from the workflow — publishable, so not a
leak, but it makes RLS the only protection on a public repo.

**Verified:** Write and push access, by commit round-trip. Default
branch changed, confirmed in GitHub settings. Merge is a clean
fast-forward with no conflicts, confirmed by inspection of all six
changed files. APK workflow run #5 succeeded from a push to main, all
11 steps green, 61.9 MB artifact published. The built APK's
`AndroidManifest.xml` contains no `com.google.android.geo.API_KEY`,
confirmed by reading the manifest out of the artifact — so
`GOOGLE_MAPS_API_KEY` is not set as a repo secret and users get the
list fallback.

**Unverified:** Whether any screen in the app works. Nobody has
installed the APK and used it. The five `verify:*` scripts pass 331
checks, but they grep source files for expected strings — they confirm
code was written, not that it runs. There is no test suite. The web
build path has still not validated `app.config.js`. RLS policies have
never been audited, and the app ships live location features on a
public repo. Three migration files insert test data and will run
against production.

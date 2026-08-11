# Xplorer

## What this is

A map-led local discovery app. Explorers see local businesses,
properties, activity clubs and events on a map, discover what's
happening live (check-ins, Link-ups, event state), and review or check
in after visiting. Managers are Explorers with unlocked tools for the
places, clubs or events they run — there is no separate account type.

## Stack, running, testing

- **Stack:** Expo + Expo Router (file-based routes) + React Native
  (plain JS, no TypeScript in the app). Backend is Supabase (Postgres,
  Auth, Storage, Edge Functions) — no custom server, no REST API layer.
  `services/supabase.js` is the only client, reads
  `EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- **Run locally:** `npm install`, then `npx expo start --web` (or
  `android`/`ios`).
- **Run tests:** `npm test` (or `npm run test:ci`) runs the Jest suite
  in `test/`. `npm run verify:<name>` runs the individual gate scripts
  in `scripts/verify-*.cjs` — grep-based checks against source, not
  covered by Jest. `.github/workflows/quality-checks.yml` runs both,
  plus `npm audit`, `expo-doctor`, and a production web export, on
  every push.

## Key directories

`app/` (routes), `components/` (shared UI), `context/`
(FeedbackContext, NotificationContext), `hooks/`, `services/supabase.js`,
`utils/`, `supabase/migrations/` (the real, authoritative schema),
`supabase/functions/` (Edge Functions), `scripts/` (verify-*.cjs gates
plus one-off tooling), `test/` (Jest), `docs/` (current docs plus
`docs/archive/` for everything superseded). `database/` is an
explicitly-marked legacy stub, not the live schema.

## How I want you to work

- Read the code before proposing changes
- Be blunt; I want real criticism, not encouragement
- Point to specific files and lines
- Ask before adding a new dependency
- One thing at a time — no broad half-built sweeps

Current state of the app is `docs/SCREEN-INVENTORY.md`. Current work is
`docs/REBUILD-PLAN.md`.

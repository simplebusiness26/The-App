# Guestbook

A travel discovery platform connecting Airbnb guests with local towns.

## Stack

- **Frontend:** React Native + Expo (Expo Router, file-based routing)
- **Backend:** Supabase (auth, database, storage)
- **Database:** PostgreSQL (schema in `supabase/migrations/`)

## How to run

The app runs as a web preview using Expo's Metro bundler:

```
BROWSER=none npx expo start --web --port 5000
```

The `Start application` workflow handles this automatically.

## Project structure

```
app/           Expo Router screens (file-based routes)
  auth/        Login, signup, verify
  business/    Business owner dashboard
  property/    Property owner dashboard
  admin/       Admin claims review
components/    Shared UI components
hooks/         Custom React hooks (useColors)
services/      Supabase client (supabase.js)
utils/         Helpers (QR code, location)
supabase/      Migrations (the real schema) + edge functions + project link
database/      Legacy stub, not the live schema — see the note in that file
```

## Supabase

Credentials are read from the environment, not hardcoded. `services/supabase.js`
requires `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` and throws
at startup if either is missing. On Replit these come from the Secrets pane; locally
they come from `.env` (see `.env.example`).

This repo points at its own Supabase project, separate from the one Guest-book-V3
uses. The project ref is pinned in `supabase/config.toml`.

The real schema lives in `supabase/migrations/`, not in `database/schema.sql`.

## User preferences

- Keep existing project structure and stack.

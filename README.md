# Guestbook

Guestbook is a travel discovery platform connecting Airbnb guests with local towns.

## Features

- Airbnb discovery
- Local business discovery
- Interactive maps
- Reviews
- QR code guest reviews
- Local recommendations

## Tech Stack

Frontend:
- React Native
- Expo

Backend:
- Supabase

Database:
- PostgreSQL

## Local Setup

1. Install the exact dependencies:

   ```bash
   npm ci
   ```

2. Copy `.env.example` to `.env`.
3. Add the Supabase project values (dashboard -> Project Settings -> API):

   ```env
   EXPO_PUBLIC_SUPABASE_URL=
   EXPO_PUBLIC_SUPABASE_ANON_KEY=
   EXPO_PUBLIC_APP_URL=
   ```

4. Start the app:

   ```bash
   npm start
   ```

Never commit `.env`. It is intentionally excluded by `.gitignore`.

## Database

This repo has its own Supabase project, separate from the one Guest-book-V3 uses.
The project ref is pinned in `supabase/config.toml` — check it before running any
command that writes to a remote project.

The authoritative schema is `supabase/migrations/`, applied in filename order.
`database/schema.sql` is a legacy stub and must not be run.

Only ever put the **anon** key in `.env` or any Expo variable. `EXPO_PUBLIC_*` values
are inlined into the client bundle and are therefore public. The `service_role` key
must never appear in this repo or in the app.

### Provisioning a new project from scratch

```bash
npm i -g supabase          # requires a PostgreSQL 17 client for dump/restore
supabase link --project-ref <ref>
supabase db push
```

Then, in the dashboard:

- Add `{EXPO_PUBLIC_APP_URL}/auth/update-password` under
  Authentication -> URL Configuration, or password reset will not redirect back.
- Keep email confirmation **on** — `app/auth/signup.js` branches on the
  "confirm your email" state and will behave incorrectly without it.
- Deploy the edge functions in `supabase/functions/`.

Note that three migrations (`..._manager_test_activity_club.sql`,
`..._second_activity_club_test_data.sql`, `..._events_test_data.sql`) seed test
content and `raise exception` unless the auth users `manager@test.com`,
`explorer@test.com` and `explorer2@test.com` already exist. Create those accounts
in Authentication -> Users first, or skip those files.

## Verification

- Expo Doctor: 20/20 checks passed
- Clean dependency install: passed
- Production web export: passed

## Development Status

Guest-book V3 - Building MVP

# Guestbook

A travel discovery platform connecting Airbnb guests with local towns.

## Stack

- **Frontend:** React Native + Expo (Expo Router, file-based routing)
- **Backend:** Supabase (auth, database, storage)
- **Database:** PostgreSQL (schema in `supabase/migrations/`)

## How to run

The `Start application` workflow runs `bash scripts/replit-start.sh`, which does a
**static production build**, not a dev server: it runs `npx expo export --platform web`
and then serves the resulting `dist/` on port 5000 via `scripts/serve-preview.cjs`.

Set the secrets below before running, or the build aborts with a clear message.

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

### Replit Secrets

| Secret | Value |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → `anon` `public` |
| `EXPO_PUBLIC_APP_URL` | this Repl's public URL, no trailing slash |

Only ever use the **anon** key. It is public by design — it is inlined into the
client bundle and access is governed by row-level security. The `service_role` key
bypasses RLS entirely and must never be set here.

**These are build-time values, not runtime ones.** Expo inlines every `EXPO_PUBLIC_*`
variable into the bundle during `expo export`, and `serve-preview.cjs` is a plain
static file server with no access to the environment. So after adding or changing a
secret you must **re-run the workflow**; restarting the server alone keeps serving the
old bundle. `scripts/replit-start.sh` checks the two required secrets before building
so this fails loudly rather than shipping a broken page.

`EXPO_PUBLIC_APP_URL` also has to be allowlisted in Supabase → Authentication → URL
Configuration as `{EXPO_PUBLIC_APP_URL}/auth/update-password`, or password-reset links
will not come back to the app.

## User preferences

- Keep existing project structure and stack.

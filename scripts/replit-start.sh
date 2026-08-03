#!/usr/bin/env bash
set -euo pipefail

BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
MESSAGE="$(git log -1 --pretty=%s 2>/dev/null || echo unknown)"

echo "[Guestbook] Building branch: ${BRANCH}"
echo "[Guestbook] Building commit: ${COMMIT} - ${MESSAGE}"

if ! grep -q 'HOME_LAYOUT_VERSION="compact-v2"' app/index.js 2>/dev/null; then
  echo "[Guestbook] ERROR: Expected compact-v2 home layout was not found. Pull the latest main branch before running."
  exit 1
fi

# EXPO_PUBLIC_* values are inlined into the bundle by `expo export` below, not read
# at runtime -- serve-preview.cjs only serves static files. `expo export` does NOT
# fail when they are missing, because it never evaluates services/supabase.js, so a
# misconfigured deploy would build green and then break in the browser with
# "Missing Supabase environment variables". Fail here instead, where it is visible.
missing=""
for var in EXPO_PUBLIC_SUPABASE_URL EXPO_PUBLIC_SUPABASE_ANON_KEY; do
  if [ -z "${!var:-}" ]; then
    missing="${missing} ${var}"
  fi
done
if [ -n "${missing}" ]; then
  echo "[Guestbook] ERROR: missing required Supabase secret(s):${missing}"
  echo "[Guestbook] Set them in the Replit Secrets pane, then re-run the workflow."
  echo "[Guestbook] They are baked in at build time, so a restart alone will not pick them up."
  exit 1
fi

if [ -z "${EXPO_PUBLIC_APP_URL:-}" ]; then
  echo "[Guestbook] WARNING: EXPO_PUBLIC_APP_URL is not set. Password-reset emails will"
  echo "[Guestbook]          fall back to the browser origin, which is wrong once deployed."
fi

echo "[Guestbook] Supabase project: ${EXPO_PUBLIC_SUPABASE_URL}"

echo "[Guestbook] Stopping stale preview processes..."
pkill -f "expo start" 2>/dev/null || true
pkill -f "serve -s dist" 2>/dev/null || true
pkill -f "serve-preview.cjs" 2>/dev/null || true

rm -rf dist .expo node_modules/.cache

echo "[Guestbook] Installing dependencies..."
npm install

echo "[Guestbook] Building web preview from current source..."
npx expo export --platform web --clear

if [ ! -f dist/index.html ]; then
  echo "[Guestbook] ERROR: dist/index.html was not created."
  exit 1
fi

cat > dist/build-info.json <<EOF
{
  "branch": "${BRANCH}",
  "commit": "${COMMIT}",
  "message": "${MESSAGE}",
  "homeLayout": "compact-v2"
}
EOF

echo "[Guestbook] Preview build verified: ${BRANCH} @ ${COMMIT}"
echo "[Guestbook] Home layout verified: compact-v2"
echo "[Guestbook] Starting no-cache preview server on port 5000..."
exec node scripts/serve-preview.cjs

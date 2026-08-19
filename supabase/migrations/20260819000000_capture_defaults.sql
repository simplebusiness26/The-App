-- Capture defaults: the three answers the viewfinder should not ask for twice.
--
-- The locked spec's configuration rung for the Camera surface is "Grid overlay,
-- save-to-library, default video quality/compression live in Account & Safety >
-- Capture defaults". There was nowhere to put them: no table, no module, and a
-- viewfinder with no grid.
--
-- COLUMNS RATHER THAN ROWS, AND EVERY DEFAULT OFF
--
-- The same shape as public.push_preferences and for the same reason: the
-- default lives in the schema, so a missing row cannot mean something was
-- switched on for somebody who never asked. RULES.md: opt-in is never the
-- fallback branch. A grid nobody asked for is a grid over every photograph, and
-- a copy nobody asked for is storage spent on somebody's behalf.
--
-- The video quality values are expo-camera's own `videoQuality` prop values, so
-- the column cannot hold something the camera would reject. '4:3' is
-- deliberately not in the list -- see utils/capturePreferences.js.

begin;

create table if not exists public.capture_preferences(
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- Drawn in the viewfinder, honoured by components/CameraCapture.js.
  grid_overlay boolean not null default false,
  -- Keeps a copy of every capture in the app's own document directory, which
  -- the OS does not sweep. NOT the phone's photo library: that needs
  -- expo-media-library, which this app does not depend on.
  save_to_library boolean not null default false,
  video_quality text not null default '1080p'
    check (video_quality in ('720p','1080p','2160p')),
  updated_at timestamptz not null default now()
);

alter table public.capture_preferences enable row level security;

-- Your own camera settings, and nobody else's.
drop policy if exists capture_preferences_own_all on public.capture_preferences;
create policy capture_preferences_own_all on public.capture_preferences
  for all to authenticated
  using (user_id=(select auth.uid()))
  with check (user_id=(select auth.uid()));

comment on table public.capture_preferences is
  'Account & Safety > Capture defaults. One row per Explorer; a missing row means the defaults in utils/capturePreferences.js, which are the same defaults as the column defaults here.';

grant select, insert, update on public.capture_preferences to authenticated;

commit;

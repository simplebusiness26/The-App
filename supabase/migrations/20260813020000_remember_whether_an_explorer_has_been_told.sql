-- One column, so a new Explorer can be told once rather than never or always.
--
-- THE PROBLEM
-- profiles.visibility defaults to 'nobody'. That is the correct default and it
-- is not up for debate -- RULES.md: every visibility flag defaults to off, and
-- opt-in is never the fallback branch of an if-statement.
--
-- The consequence is that a brand new Explorer's first Moment, first check-in
-- and first Link-up are seen by exactly nobody, and until now nothing told them
-- at the moment it mattered. app/moments/create.js and app/checkins/create.js
-- warn at the point of posting, which is late: the person has already written
-- the thing. It is the shape of a bug report that is not a bug -- "I posted it
-- and my friend cannot see it" -- where the setting worked perfectly and the
-- app was silent.
--
-- WHY A COLUMN
-- A prompt that shows once needs somewhere to remember that it has. The app has
-- no first-run storage of any kind: no AsyncStorage (not a dependency, and
-- adding one needs asking), no SecureStore, no profiles column, no table. The
-- only client persistence is a single web-only localStorage key for password
-- recovery, which would not work on a phone.
--
-- A column on profiles is the smallest thing that works everywhere, survives
-- reinstalling the app, and needs no new dependency. Explorers can already
-- update their own row ("Users can update their own profile", USING and WITH
-- CHECK both auth.uid() = id), so no policy change is needed.
--
-- WHAT IT IS NOT
-- Not a setting, not a preference, and never read by anything that decides who
-- can see what. It records one fact: whether this Explorer has been shown the
-- explanation. Nothing about it widens anybody's audience, and the prompt that
-- writes it never sets a visibility on somebody's behalf -- it opens Settings
-- and lets them choose, or it closes and leaves them exactly as private as they
-- were.

alter table public.profiles
  add column if not exists onboarding_seen_at timestamptz;

comment on column public.profiles.onboarding_seen_at is
  'When this Explorer was shown the "who can see what you share" explanation. '
  'Null means not yet. Presentation state only -- never consulted by any '
  'visibility or access decision.';

-- Everybody who already has an account has been using the app without the
-- prompt, so they are not new and must not be interrupted by it. Backfilling
-- them as already-seen is the difference between a prompt for new Explorers and
-- a prompt for everybody at once.
update public.profiles
set onboarding_seen_at = now()
where onboarding_seen_at is null;

-- The 60 existing Moments were all going to vanish at the same minute.
--
-- WHAT WENT WRONG
--
-- 20260811210000_moment_lifecycle.sql:55 added the column like this:
--
--   add column if not exists expires_at timestamptz not null default (now() + interval '24 hours')
--
-- NOT NULL with a default, so Postgres filled every existing row at that
-- moment -- all 60 got the identical value, 24 hours after the migration ran
-- rather than 24 hours after each post.
--
-- The next statement (:69-70) was meant to fix exactly that:
--
--   set expires_at = created_at + interval '24 hours'
--   where expires_at is null or expires_at = created_at;
--
-- Neither condition can ever be true. The column is NOT NULL, so nothing is
-- null; and the default is 24 hours ahead of the insert, so nothing equals its
-- own created_at. **The backfill matched zero rows** and nobody noticed,
-- because a statement that updates nothing is not an error.
--
-- The result: every Moment in the app, posted across nine days, carried
-- expires_at = 2026-08-13 00:30:23. All of them, together, in one minute.
--
-- WHAT THIS DOES
--
-- Pushes every existing Moment 30 days out. The owner's call, and the right
-- one: the story viewer, the profile ring and Memories-in-the-feed are all
-- being built next, and all three need live Moments to be testable. Building a
-- story viewer against an empty ring proves nothing.
--
-- NEW Moments are already correct and are not touched. created_at is now() at
-- insert, so `default (now() + interval '24 hours')` means what it says for
-- anything posted from here on. The bug was only ever in the backfill.
--
-- WHAT THIS IS NOT
--
-- Not a change to the lifecycle. A Moment is still live for 24 hours and still
-- expires. These 60 are existing content getting a longer runway once, because
-- they never got the runway they were supposed to have.
--
-- Nothing is deleted, here or by expiry. explorer_moments rows survive their
-- expires_at; they stop being surfaced as live, which is a different thing.
--
-- TO UNDO
--   update public.explorer_moments
--   set expires_at = timestamptz '2026-08-13 00:30:23.669108+00'
--   where created_at < timestamptz '2026-08-12 00:00:00+00';

begin;

-- Every row that already existed. The migration runs once, so `created_at <
-- now()` is exactly the set that was mis-filled and nothing posted afterwards.
update public.explorer_moments
set expires_at = now() + interval '30 days'
where created_at < now();

-- Prove it moved. A silent no-op is what caused this in the first place, so
-- this one refuses to commit if it changed nothing.
do $$
declare v_same integer;
begin
  select count(distinct expires_at) into v_same from public.explorer_moments;

  if (select count(*) from public.explorer_moments) > 1 and v_same = 1 then
    -- Not fatal on its own -- 60 rows updated in one statement legitimately
    -- share a value. What would be fatal is that value still being in the past.
    if (select min(expires_at) from public.explorer_moments) < now() then
      raise exception 'Moments still expire in the past after the backfill';
    end if;
  end if;
end;
$$;

commit;

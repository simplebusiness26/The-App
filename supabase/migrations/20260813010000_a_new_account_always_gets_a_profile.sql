-- Every account gets a profile, and the database is what promises it.
--
-- THE HOLE
-- Profile creation lived entirely in app/auth/signup.js: sign up, then insert
-- a profiles row from the client. Two ways that fails.
--
--   1. Email confirmation. With it switched on, signUp returns a user and no
--      session, and the screen returns early -- deliberately, because there is
--      no session to insert with. The account exists; the profile never does.
--      Nothing in the app tries again later.
--   2. Anything that creates a user another way -- the Supabase dashboard, a
--      social provider, an admin invite -- never runs that code at all.
--
-- An Explorer with no profile row is not a small problem. Their name, their
-- area and their visibility setting all live there, and every screen that reads
-- a profile finds nothing: no name in the feed, no audience setting to enforce.
-- Today all 19 accounts happen to have one, so this closes the hole before it
-- costs anybody rather than after.
--
-- THE FIX
-- A trigger on auth.users. It runs inside the same transaction as the account,
-- so an account without a profile stops being a state the database can be in.
--
-- WHAT IT DELIBERATELY DOES NOT SET
-- visibility. The column default is 'nobody' and it stays that way. Every
-- visibility flag defaults to off, and a trigger that helpfully set something
-- friendlier would be a privacy default made by accident. See RULES.md.
--
-- WHY IT IS ALLOWED TO FAIL LOUDLY
-- If the insert raises, the whole signup rolls back and the person sees an
-- error. That is on purpose. The alternative -- swallow the exception so signup
-- succeeds -- recreates exactly the silent profile-less account this exists to
-- prevent, except now with no code path that would ever notice.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  -- on conflict do nothing, because app/auth/signup.js still upserts when it
  -- gets a session straight away. Both running is fine; either alone is fine.
  insert into public.profiles(id,email,full_name,phone)
  values(
    new.id,
    new.email,
    nullif(btrim(coalesce(new.raw_user_meta_data->>'full_name','')),''),
    nullif(btrim(coalesce(new.raw_user_meta_data->>'phone','')),'')
  )
  on conflict(id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Anybody already in this state. None today; the backfill is here so applying
-- this to a database that drifted does the right thing rather than leaving a
-- hole that only new accounts avoid.
insert into public.profiles(id,email,full_name,phone)
select u.id,
       u.email,
       nullif(btrim(coalesce(u.raw_user_meta_data->>'full_name','')),''),
       nullif(btrim(coalesce(u.raw_user_meta_data->>'phone','')),'')
from auth.users u
left join public.profiles p on p.id=u.id
where p.id is null
on conflict(id) do nothing;

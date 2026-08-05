-- Packet 8e, correction: split the Moment read policy by role.
--
-- WHAT BROKE
-- 20260805120300 replaced explorer_moments_public_read with one policy
-- `for select to public`:
--
--   user_id = auth.uid()
--   or (status='published' and visibility='public')
--   or (status='published' and visibility='friends'
--       and guestbook_private.are_friends(user_id, auth.uid()))
--
-- `to public` includes anon, and anon has neither USAGE on guestbook_private
-- nor EXECUTE on are_friends -- deliberately, since 20260803000100 granted that
-- schema to authenticated only. Postgres does not guarantee OR short-circuits,
-- so a signed-out read of any Moment evaluated the third branch and raised
-- `42501: permission denied for function are_friends` rather than returning
-- rows. Every Moment became unreadable to a signed-out visitor, including the
-- public ones, which is a regression on behaviour that shipped with the social
-- layer.
--
-- Caught by the live verification in Phase 3, before anyone opened the app.
--
-- THE FIX
-- Two policies, split by role, rather than one that has to be safe for both.
-- anon gets the branch that needs no function call at all; authenticated keeps
-- the full rule. Policies for the same command are ORed, and these two are
-- scoped to disjoint roles, so no caller gains anything from the other's.
--
-- The alternative -- granting anon EXECUTE on are_friends -- was rejected. It
-- would mean granting USAGE on guestbook_private to anon to reach it, widening
-- a schema that exists precisely to keep helpers away from the public API, for
-- a function that can only ever return false for a caller with no auth.uid().
--
-- REVERSAL
--   drop policy if exists explorer_moments_read_anon on public.explorer_moments;
--   drop policy if exists explorer_moments_read_authenticated on public.explorer_moments;
--   (then restore explorer_moments_read_visible from 20260805120300)

begin;

drop policy if exists explorer_moments_read_visible on public.explorer_moments;
drop policy if exists explorer_moments_read_anon on public.explorer_moments;
drop policy if exists explorer_moments_read_authenticated on public.explorer_moments;

-- Signed out: published and public, and nothing else. No friends test, because
-- a caller with no identity can never pass one.
create policy explorer_moments_read_anon on public.explorer_moments
for select to anon using (
  status='published' and visibility='public'
);

-- Signed in: your own Moments whatever their state, everything public, and a
-- friend's friends-only Moments.
create policy explorer_moments_read_authenticated on public.explorer_moments
for select to authenticated using (
  user_id=(select auth.uid())
  or (status='published' and visibility='public')
  or (status='published' and visibility='friends' and guestbook_private.are_friends(user_id,(select auth.uid())))
);

commit;

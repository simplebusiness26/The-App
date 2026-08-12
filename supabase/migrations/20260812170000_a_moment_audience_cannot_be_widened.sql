-- Step 6, the locked-visibility half: a Moment's audience can be narrowed and
-- never widened.
--
-- WHY
--
-- A Moment is live for a day. Somebody posts one for friends, twenty people
-- watch it, and then the poster switches it to everyone -- and it is now in
-- front of an audience that never existed while it was being watched. Worse in
-- reverse: moment_views records who watched. Widening after the fact means the
-- viewer list was built under one promise and read under another.
--
-- Narrowing is always allowed. Taking something back is not a betrayal of
-- anybody; showing it to more people than you said is.
--
-- This is not the profile ceiling. can_see_content already stops a post
-- reaching past profiles.visibility. That is about the OWNER'S current setting.
-- This is about the POST'S own promise, and the two are independent: an
-- Explorer can widen their profile whenever they like, and it will not retro-
-- actively widen a Moment they marked friends-only.
--
-- MEMORIES ARE NOT COVERED, DELIBERATELY
--
-- explorer_memories has two settings on purpose -- `visibility` while it is
-- live and `archive_visibility` afterwards -- because agreeing to be seen today
-- is not agreeing to be seen forever. That model already says what happens over
-- time and adding a lock on top would fight it. A Memory is a scrapbook page
-- somebody curates; a Moment is a thing that happened.
--
-- TO UNDO
--   drop trigger if exists explorer_moments_audience_lock on public.explorer_moments;

begin;

create or replace function guestbook_private.lock_moment_audience()
returns trigger
language plpgsql
security definer
set search_path='public','pg_temp'
as $$
begin
  if new.visibility is not distinct from old.visibility then
    return new;
  end if;

  -- audience_rank orders the vocabulary narrowest to widest and returns 0 for
  -- anything it does not recognise, so a typo narrows rather than widens.
  if guestbook_private.audience_rank(new.visibility)
     > guestbook_private.audience_rank(old.visibility) then
    raise exception 'A Moment can be shown to fewer people, never more. Delete it and post it again if you want a wider audience.';
  end if;

  return new;
end;
$$;

revoke all on function guestbook_private.lock_moment_audience() from public,anon,authenticated;

drop trigger if exists explorer_moments_audience_lock on public.explorer_moments;
create trigger explorer_moments_audience_lock
before update of visibility on public.explorer_moments
for each row execute function guestbook_private.lock_moment_audience();

commit;

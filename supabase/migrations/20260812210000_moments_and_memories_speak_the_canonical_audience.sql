-- Moments and Memories: read rules that speak the vocabulary the app writes.
--
-- WHAT WAS WRONG
--
-- 20260811220000 made one audience vocabulary for the whole app:
--
--   nobody < selected < close_friends < friends < followers < everyone
--
-- The app writes it. All 60 Moments in the database say 'everyone'. But the
-- row level security that decides who may READ them was never updated, and
-- still asked for the word 'public':
--
--   explorer_moments_read_authenticated:  visibility = 'public'
--   guestbook_private.can_read_memory:    'public' / 'private' / 'friends'
--
-- No row says 'public'. So every Moment in the app was visible to its author
-- and to nobody else, silently, and any Moment layer built on top of it would
-- have drawn an empty map for ever. This is the same 'public' versus
-- 'everyone' mismatch that hid every Moment in the feed, in the other half of
-- the system.
--
-- THE OTHER HALF OF THE BUG, WHICH IS THE PRIVACY ONE
--
-- Both rules also ignored the owner's PROFILE visibility. A post's audience is
-- a request, not a grant: somebody whose profile says 'friends' has said that
-- about everything they post, and a Moment marked 'everyone' must not escape
-- that ceiling. guestbook_private.can_see_content() already applies the
-- ceiling and has since 20260811220000 -- it takes the narrower of the post's
-- audience and the profile's -- and neither of these two rules called it.
--
-- Nothing here widens anything. Every path returns false where it used to
-- return false, and the ceiling can only narrow.

-- ---------------------------------------------------------------------------
-- Memories
-- ---------------------------------------------------------------------------
-- Kept as its own function rather than folded into can_see_content, because a
-- Memory has two audiences -- one while it is live, another once it is
-- archived -- and 'selected' means an explicit share list that
-- can_see_content has no way to check.

create or replace function guestbook_private.can_read_memory(p_memory_id uuid, p_viewer uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public','pg_temp'
as $$
declare
  m public.explorer_memories%rowtype;
  v_rule text;
begin
  select * into m from public.explorer_memories where id=p_memory_id;
  if not found then return false; end if;

  if p_viewer is not null and m.user_id=p_viewer then return true; end if;
  if m.status<>'published' then return false; end if;

  -- Live Memories use `visibility`; archived ones use `archive_visibility`.
  -- A null archive rule stays null and therefore stays invisible. Falling back
  -- to the live rule would WIDEN a Memory the moment it archived, which is the
  -- one direction this function must never move in.
  v_rule := case when guestbook_private.memory_is_live(m.live_until)
                 then m.visibility
                 else m.archive_visibility end;

  if v_rule is null then return false; end if;

  -- Two words from the old vocabulary, translated rather than dropped, so a
  -- row written before 20260811220000 keeps the meaning its author chose.
  v_rule := case v_rule
              when 'public' then 'everyone'
              when 'private' then 'nobody'
              else v_rule
            end;

  if v_rule='nobody' then return false; end if;
  if p_viewer is null then return false; end if;

  -- An explicit share list. Still subject to the profile ceiling below.
  if v_rule='selected' then
    return exists(
      select 1 from public.explorer_memory_shares s
      where s.memory_id=m.id and s.user_id=p_viewer
    ) and guestbook_private.audience_rank(
      coalesce((select pr.visibility from public.profiles pr where pr.id=m.user_id),'nobody')
    ) >= guestbook_private.audience_rank('selected');
  end if;

  return guestbook_private.can_see_content(m.user_id,p_viewer,v_rule);
end;
$$;

-- ---------------------------------------------------------------------------
-- Moments
-- ---------------------------------------------------------------------------

drop policy if exists explorer_moments_read_authenticated on public.explorer_moments;

create policy explorer_moments_read_authenticated
on public.explorer_moments
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (
    status='published'
    and guestbook_private.can_see_content(user_id,(select auth.uid()),
          case visibility when 'public' then 'everyone'
                          when 'private' then 'nobody'
                          else visibility end)
  )
);

-- ---------------------------------------------------------------------------
-- And nothing personal to a signed-out visitor
-- ---------------------------------------------------------------------------
-- A signed-out visitor gets the map: businesses, properties, activity clubs.
-- They do not get people. That is already how the living layer behaves --
-- get_live_discovery is not even called without a session -- and these two
-- policies were the only place the app said otherwise.
--
-- In practice they granted nothing: they asked for the word 'public' and no
-- row has ever said it. Removing them makes the rule explicit rather than
-- accidental, and if public sharing to the open web is ever wanted it should
-- be a deliberate new policy rather than a leftover.

drop policy if exists explorer_moments_read_anon on public.explorer_moments;
drop policy if exists explorer_memories_read_anon on public.explorer_memories;

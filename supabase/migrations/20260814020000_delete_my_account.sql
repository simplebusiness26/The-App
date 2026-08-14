-- Deleting your account, from inside the app.
--
-- Apple and Google both require this before you can publish, and there was none
-- -- nothing in the repository matched delete_account. That is the reason it
-- exists. What it DOES is a set of decisions, and they are written here rather
-- than left to whatever the foreign keys happen to do.
--
-- WHAT THE FOREIGN KEYS ALREADY DO, AND WHY THAT IS NOT ENOUGH
--
-- Thirty-four columns cascade from auth.users, which covers most of it: posts,
-- messages, follows, likes, memberships, notifications, the score ledger. Three
-- things it does not cover, each for a different reason:
--
--   claims.user_id is NO ACTION, so it would BLOCK the delete outright. An
--   unresolved claim is an admin's queue item; it is released rather than kept.
--
--   explorer_reviews and businesses have no foreign key to auth.users at all,
--   so a deleted Explorer's reviews would survive with a dangling author. Their
--   reviews are theirs and go with them.
--
--   activity_clubs.manager_id and events.manager_id CASCADE -- which means
--   deleting one manager would silently destroy a club with thirty members in
--   it, and every membership, message and RSVP inside. Nobody decided that.
--   See the refusal below.
--
-- WHAT IS KEPT
--
-- Anything OTHER PEOPLE wrote. A review somebody left on your business is
-- theirs. A Link-up other people came to still happened. Their words stay;
-- your name comes off them.
--
-- WHAT IT REFUSES TO DO
--
-- Delete an account that still manages a club, an event, a business or a
-- property. Destroying other people's memberships as a side effect of one
-- person leaving is not a decision this function is entitled to make on its
-- own, and quietly orphaning a listing is not better. It says what to hand over
-- or close first. That is deliberately conservative and it is one branch to
-- change.

begin;

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = 'public','pg_temp'
as $$
declare
  v_user uuid := auth.uid();
  v_clubs integer;
  v_events integer;
  v_businesses integer;
  v_properties integer;
begin
  if v_user is null then
    raise exception 'You must be signed in to delete your account.';
  end if;

  select count(*) into v_clubs      from public.activity_clubs where manager_id = v_user;
  select count(*) into v_events     from public.events         where manager_id = v_user;
  select count(*) into v_businesses from public.businesses     where owner_id   = v_user;
  select count(*) into v_properties from public.properties     where owner_id   = v_user;

  if v_clubs + v_events + v_businesses + v_properties > 0 then
    raise exception
      'Hand over or close what you manage first: % club(s), % event(s), % business(es), % property(ies). Deleting your account would take other people''s memberships and bookings with it.',
      v_clubs, v_events, v_businesses, v_properties;
  end if;

  -- Their own words, gone. These two have no foreign key to auth.users, so
  -- nothing else would remove them.
  delete from public.review_media where review_id in (
    select id from public.explorer_reviews where user_id = v_user
  );
  delete from public.explorer_reviews where user_id = v_user;

  -- An unresolved claim is an admin's queue item about an account that is about
  -- to stop existing. NO ACTION would block the delete; releasing it is the
  -- only honest option.
  delete from public.claims where user_id = v_user;

  -- And the account itself. Everything with a cascade goes with it -- posts,
  -- messages, follows, likes, memberships, notifications, the score ledger --
  -- and storage objects under the Explorer's own folder go with their rows.
  delete from auth.users where id = v_user;
end;
$$;

comment on function public.delete_my_account() is
  'Deletes the caller''s account and everything they wrote. Refuses while they still manage a club, event, business or property, because that would destroy other people''s memberships as a side effect. Content other people wrote is kept.';

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

commit;

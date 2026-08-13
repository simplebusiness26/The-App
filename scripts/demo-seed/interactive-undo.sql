-- Puts back what scripts/demo-seed/interactive.sql changed.
--
-- That file flipped flags and moved dates on rows that already existed; it
-- created one check-in and nothing else. So this closes the flags rather than
-- deleting content, and the only delete is that check-in.
--
-- WHAT IT CANNOT PUT BACK: the original dates. interactive.sql overwrote
-- created_at on fifteen Memories and starts_at/ends_at on three events, and
-- their old values were not recorded anywhere. This returns them to a sensible
-- state, not to the exact one -- which is the honest reason a data script
-- should be applied to a development project and nothing else.

begin;

-- Every visibility flag back to the default. This is the setting a new account
-- gets, and the one every one of these was on before.
update public.profiles
set visibility='nobody'
where id in (select id from auth.users where email like '%@test.com')
   or id in (select id from auth.users where email in (
        'guest@guestbook.com','tester@guestbook.com','business@business.com',
        'business@teser.com','ladnlord@landlord.com','property@property.com',
        'admin@gustbook.com','guestbooker1@gmail.com','callum@guest.co.uk',
        'radband98@gmail.com','newbusiness@test.com'
      ));

update public.explorer_memories
set visibility='nobody',
    archive_visibility='nobody'
where latitude is not null;

-- The two Manager switches, off -- which is what they default to.
update public.activity_clubs set spaces_available=false;
update public.properties set show_availability=false, rooms_available=null;

-- The check-in interactive.sql made. Keyed on the account and the place rather
-- than a date range, so it cannot take a real one with it.
delete from public.live_checkins
where user_id=(select id from auth.users where email='explorer@test.com')
  and place_name='Alexandra Park'
  and message='Long way round today.';

commit;

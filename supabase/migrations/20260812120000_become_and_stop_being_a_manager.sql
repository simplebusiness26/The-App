-- Becoming a manager, and stopping.
--
-- WHAT THIS CHANGES, PLAINLY
--
-- Until now the only way to get manager tools was to ask an administrator and
-- wait (manager_capability_requests + admin_decide_capability_request), and
-- there was no way at all to hand them back. The owner asked for a button in
-- Settings: press it, confirm, and the tools are on -- and a matching one to
-- turn them off again, with a choice about what happens to anything already
-- listed.
--
-- SO THIS IS SELF-SERVICE, AND THAT IS A REAL CHANGE
--
-- Packet 0 (20260811120000) closed a hole where any signed-in Explorer could
-- create a business. This does NOT reopen it. The difference is deliberate
-- versus accidental: before, creating a business needed no decision from
-- anybody, and a row granted for one capability silently switched on three
-- others. Now it takes a person choosing it, on a screen that says what it
-- means, recorded with a timestamp. The policies are untouched -- creating a
-- business still requires has_manager_capability('businesses'), which still
-- reads the same column. The only thing that changed is who may switch it on.
--
-- Claiming somebody else's real business is a separate thing and still goes
-- through public.claims and an administrator. Being a manager lets you list a
-- place; it does not let you take one over.
--
-- THE THREE THINGS THAT MADE THIS MORE THAN TWO UPDATE STATEMENTS
--
-- 1. Clubs and events have a NOT NULL manager (activity_clubs.manager_id,
--    events.manager_id), so there is no such thing as an unclaimed club. A
--    business or property CAN be unowned -- owner_id is nullable and that is
--    exactly what an unclaimed listing on the map is. So "unclaim" can only
--    mean what it says for two of the four, and stop_managing reports what it
--    actually did rather than pretending otherwise.
--
-- 2. Deleting a listing does NOT delete other people's Moments and Memories
--    taken there. A Memory belongs to the Explorer who made it, not to the
--    business it happens to be attached to. Those are detached -- the photo and
--    the words survive, the place link goes.
--
-- 3. Reviews go, and everything hanging off them goes with them, but not
--    because this function deletes it: explorer_reviews already cascades
--    review_media, review_point_events and qr_review_verifications, and its
--    delete triggers already remove the legacy mirror row, the social likes and
--    comments, and the Explorer Score that review earned. Writing those deletes
--    out again here would do the work twice and drift the moment a trigger
--    changes.
--
-- TO UNDO
--   drop function public.become_manager();
--   drop function public.stop_managing(text);
--   drop function guestbook_private.purge_listing(text,uuid);

begin;

-- ---------------------------------------------------------------------------
-- 1. Switch the tools on
-- ---------------------------------------------------------------------------
-- All four together. A manager who can list a business but has to write to an
-- administrator for a club is the half-state that made this confusing in the
-- first place -- and the four are the same job, not four products.
--
-- ends_at is cleared: a capability somebody has just chosen does not expire on
-- a date set by a trial that ended months ago. started_at keeps its original
-- value where there is one, so the record of when they FIRST managed anything
-- survives coming back.

create or replace function public.become_manager()
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Log in to do this.';
  end if;

  insert into public.manager_capabilities as mc (
    user_id,
    businesses_status,businesses_started_at,businesses_ends_at,
    properties_status,properties_started_at,properties_ends_at,
    activity_clubs_status,activity_clubs_started_at,activity_clubs_ends_at,
    events_status,events_started_at,events_ends_at,
    updated_at
  ) values (
    v_user,
    'active',now(),null,
    'active',now(),null,
    'active',now(),null,
    'active',now(),null,
    now()
  )
  on conflict (user_id) do update set
    businesses_status='active',
    businesses_started_at=coalesce(mc.businesses_started_at,now()),
    businesses_ends_at=null,
    properties_status='active',
    properties_started_at=coalesce(mc.properties_started_at,now()),
    properties_ends_at=null,
    activity_clubs_status='active',
    activity_clubs_started_at=coalesce(mc.activity_clubs_started_at,now()),
    activity_clubs_ends_at=null,
    events_status='active',
    events_started_at=coalesce(mc.events_started_at,now()),
    events_ends_at=null,
    updated_at=now();
end;
$$;

comment on function public.become_manager() is
  'Switches all four manager capabilities on for the caller. Self-service and deliberate: the interface confirms first. Does not let anybody claim an existing listing -- that is public.claims and an administrator.';

revoke all on function public.become_manager() from public,anon;
grant execute on function public.become_manager() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Removing one listing and everything that only exists because of it
-- ---------------------------------------------------------------------------
-- Private, because nothing outside stop_managing should be able to reach it.

create or replace function guestbook_private.purge_listing(p_type text,p_id uuid)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  -- Somebody else's Moment or Memory taken at this place is theirs. It loses
  -- the place it was attached to and keeps everything else.
  update public.explorer_moments
    set target_type=null,target_id=null
    where target_type=p_type and target_id=p_id;
  update public.explorer_memories
    set target_type=null,target_id=null
    where target_type=p_type and target_id=p_id;

  -- One delete, and the triggers on explorer_reviews do the rest: media,
  -- point events, QR verifications, the legacy mirror row, the likes and
  -- comments on the review, and the Explorer Score it earned.
  delete from public.explorer_reviews where target_type=p_type and target_id=p_id;

  delete from public.explorer_entity_follows where target_type=p_type and target_id=p_id;
  delete from public.explorer_favourites where target_type=p_type and target_id=p_id;
  delete from public.listing_qr_codes where target_type=p_type and target_id=p_id;
  delete from public.social_reports where target_type=p_type and target_id=p_id;

  -- live_checkins carries a target_id and no target_type, so it is matched on
  -- the id alone. Ids are uuids, so there is nothing else it could hit.
  delete from public.live_checkins where target_id=p_id;

  if p_type='business' then
    -- The legacy mirrors. The reviews mirror is normally emptied by the trigger
    -- above; this catches any row that never had a modern twin, because the
    -- foreign key is NO ACTION and would otherwise block the delete.
    delete from public.reviews where business_id=p_id;
    delete from public.favourites where business_id=p_id;
    delete from public.claims where business_id=p_id;
    delete from public.businesses where id=p_id;

  elsif p_type='property' then
    delete from public.reviews where property_id=p_id;
    delete from public.favourites where property_id=p_id;
    delete from public.claims where property_id=p_id;
    delete from public.qr_codes where property_id=p_id;
    delete from public.properties where id=p_id;

  elsif p_type='activity_club' then
    -- Sessions, memberships, messages, announcements and club reviews are all
    -- ON DELETE CASCADE already.
    delete from public.activity_clubs where id=p_id;

  elsif p_type='event' then
    delete from public.events where id=p_id;

  else
    raise exception 'Unknown listing type: %',p_type;
  end if;
end;
$$;

revoke all on function guestbook_private.purge_listing(text,uuid) from public,anon,authenticated;

-- ---------------------------------------------------------------------------
-- 3. Switch the tools off
-- ---------------------------------------------------------------------------
-- p_listings says what happens to anything already listed:
--
--   'unclaim'  businesses and properties stay on the map with no owner, exactly
--              like every listing nobody has claimed yet. Somebody else can
--              claim them later. Clubs and events cannot be unowned, so they
--              are removed -- the interface says that before asking.
--
--   'delete'   all four go, along with everything that only existed because
--              they did.
--
-- Returns what it did, so the app can say it rather than guess.

create or replace function public.stop_managing(p_listings text)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  v_count integer := 0;
  v_unclaimed integer := 0;
  v_removed integer := 0;
begin
  if v_user is null then
    raise exception 'Log in to do this.';
  end if;

  if p_listings is null or p_listings not in ('unclaim','delete') then
    raise exception 'Say what happens to your listings: unclaim or delete.';
  end if;

  if p_listings='unclaim' then
    update public.businesses set owner_id=null where owner_id=v_user;
    get diagnostics v_count = row_count;
    v_unclaimed := v_unclaimed + v_count;

    update public.properties set owner_id=null where owner_id=v_user;
    get diagnostics v_count = row_count;
    v_unclaimed := v_unclaimed + v_count;
  else
    for v_id in select id from public.businesses where owner_id=v_user loop
      perform guestbook_private.purge_listing('business',v_id);
      v_removed := v_removed + 1;
    end loop;

    for v_id in select id from public.properties where owner_id=v_user loop
      perform guestbook_private.purge_listing('property',v_id);
      v_removed := v_removed + 1;
    end loop;
  end if;

  -- Clubs and events have a NOT NULL manager either way. There is no unowned
  -- club to leave behind.
  for v_id in select id from public.activity_clubs where manager_id=v_user loop
    perform guestbook_private.purge_listing('activity_club',v_id);
    v_removed := v_removed + 1;
  end loop;

  for v_id in select id from public.events where manager_id=v_user loop
    perform guestbook_private.purge_listing('event',v_id);
    v_removed := v_removed + 1;
  end loop;

  -- 'inactive', not 'cancelled'. Cancelled reads as something that was paid for
  -- and lapsed; this is somebody who decided they are not a manager.
  update public.manager_capabilities
  set
    businesses_status='inactive',businesses_ends_at=null,
    properties_status='inactive',properties_ends_at=null,
    activity_clubs_status='inactive',activity_clubs_ends_at=null,
    events_status='inactive',events_ends_at=null,
    updated_at=now()
  where user_id=v_user;

  return jsonb_build_object('unclaimed',v_unclaimed,'removed',v_removed);
end;
$$;

comment on function public.stop_managing(text) is
  'Turns all four manager capabilities off for the caller. p_listings is unclaim (businesses and properties stay on the map with no owner) or delete. Clubs and events are removed either way -- their manager column is NOT NULL, so an unowned club cannot exist.';

revoke all on function public.stop_managing(text) from public,anon;
grant execute on function public.stop_managing(text) to authenticated;

commit;

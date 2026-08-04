-- Stop anyone holding the public anon key from forging notifications.
--
-- WHY
-- public.create_notification is SECURITY DEFINER and was executable by anon, so
-- it was reachable unauthenticated at /rest/v1/rpc/create_notification. Every
-- field it writes is a caller argument: recipient, actor, type, title, message,
-- and deep_link. A stranger could therefore deliver a notification to any user,
-- attributed to any other user, with any wording and any in-app link -- arriving
-- through the app's own notification list, which is exactly what makes it
-- credible. That is a phishing route into Guestbook, built out of Guestbook.
--
-- The notifications table itself was never the hole. RLS is on with only
-- own-row select and own-row update policies, and no insert policy at all, so a
-- direct PostgREST insert is refused -- confirmed as anon: "new row violates
-- row-level security policy". The SECURITY DEFINER function was the one way in,
-- because a definer function bypasses the very RLS that was blocking the insert.
--
-- CALLERS CHECKED
-- No client code calls it. The name appears nowhere in app/, components/,
-- hooks/, services/, utils/ or supabase/functions/ -- app/notifications.js only
-- selects and updates. In the database exactly one function references it:
-- notify_activity_membership_change, a SECURITY DEFINER trigger owned by
-- postgres. A definer function's own calls are authorised as its owner, so it
-- keeps working after anon and authenticated lose EXECUTE. The Link-up
-- notifications take a different route entirely -- create_linkup, join_linkup,
-- post_linkup_message and friends insert into notifications directly, and none
-- of them was ever anon-executable.
--
-- authenticated loses it too, not just anon. Nothing in the app calls it, and a
-- signed-in caller could otherwise still forge a notification from any actor to
-- any recipient. service_role keeps EXECUTE for server-side work; it already
-- bypasses RLS and could insert into notifications directly, so this grants it
-- nothing new.
--
-- ALSO REVOKED: three trigger functions
-- enforce_activity_club_member_limit, notify_activity_membership_change and
-- sync_activity_club_full_status all return trigger and were anon-executable.
-- Postgres refuses to run a trigger function outside a trigger, so the
-- practical risk was nil, but nothing should be able to reach them over HTTP
-- and revoking is free.
--
-- DELIBERATELY LEFT ALONE
-- resolve_listing_qr_code stays anon-executable. It is the signed-out QR scan
-- path (app/qr/[code].js:48) and returns two columns, target_type and
-- target_id -- no listing detail, no owner, no contact. Public is correct.
-- activity_club_approved_member_count, added in
-- 20260804013508_stats_views_respect_caller_rls.sql, also stays: it returns a
-- single integer and is what keeps club member counts correct for signed-out
-- visitors now that activity_club_stats respects caller RLS.
--
-- The remaining ~15 definer functions the linter flags for authenticated
-- (create_linkup, join_linkup, block_explorer and so on) are owner-checked RPCs
-- meant to be called by signed-in users. They are not in scope here.
--
-- Verified after applying, in rolled-back transactions:
--
--   anon / authenticated calling create_notification
--     -> refused, "permission denied for function create_notification" (42501)
--   anon inserting into notifications directly
--     -> refused by RLS, as it already was
--   a real explorer applying to an activity club
--     -> trigger still fires, club manager still receives "New membership
--        request" with its /manager/requests deep link intact
--
-- That last check is the one that matters: the forgery path is closed without
-- taking the genuine notification path down with it.
--
-- To revert:
--   grant execute on function public.create_notification(
--     uuid, uuid, text, text, text, text, uuid, text, jsonb, text
--   ) to anon, authenticated;

revoke execute on function public.create_notification(
  uuid, uuid, text, text, text, text, uuid, text, jsonb, text
) from public, anon, authenticated;

grant execute on function public.create_notification(
  uuid, uuid, text, text, text, text, uuid, text, jsonb, text
) to service_role;

revoke execute on function public.enforce_activity_club_member_limit() from public, anon, authenticated;
revoke execute on function public.notify_activity_membership_change() from public, anon, authenticated;
revoke execute on function public.sync_activity_club_full_status() from public, anon, authenticated;

-- Defence in depth: RLS already refuses these inserts, but no client path
-- writes notifications, so the grant is surface with no purpose.
revoke insert on public.notifications from anon, authenticated;

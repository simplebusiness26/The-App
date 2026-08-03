-- Grants `authenticated` USAGE on the guestbook_private schema.
--
-- The live database had this grant, but no migration ever created it -- it was
-- applied by hand in the dashboard. A freshly provisioned project therefore
-- ended up without it, and any non-SECURITY-DEFINER function that reaches into
-- guestbook_private failed at runtime with "permission denied for schema".
--
-- The equivalent grant for the `private` schema is already in
-- 20260802211800_harden_linkups_live_privacy.sql; this is the missing twin.
--
-- USAGE on the schema alone does not expose anything: EXECUTE on every function
-- inside it is explicitly revoked from public/anon/authenticated (see
-- 20260802190000_harden_explorer_social_rpc_permissions.sql), so these helpers
-- remain reachable only through the SECURITY DEFINER functions and triggers
-- that call them.

grant usage on schema guestbook_private to authenticated;

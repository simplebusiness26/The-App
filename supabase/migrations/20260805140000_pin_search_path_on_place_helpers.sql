-- Packet 8e follow-up: pin the search_path on the two helpers that shipped
-- without one.
--
-- Supabase's security advisor flags both after 20260805120000:
--
--   function_search_path_mutable  guestbook_private.normalise_area_text
--   function_search_path_mutable  guestbook_private.touch_place_updated_at
--
-- Neither reads a table, so neither is exploitable in the usual way -- the risk
-- the lint describes is a function resolving an unqualified name against a
-- caller-controlled search_path. But "not exploitable today" is a property of
-- the current body, not of the function, and the rest of this schema sets it
-- everywhere. These two were simply missed.
--
-- pg_catalog and pg_temp only: they call built-ins and nothing else, so they
-- have no reason to see `public` at all.
--
-- No behaviour changes. Verified before writing this: normalise_area_text uses
-- lower/btrim/regexp_replace/nullif and touch_place_updated_at uses now(), all
-- of which live in pg_catalog.
--
-- REVERSAL
--   alter function guestbook_private.normalise_area_text(text) reset search_path;
--   alter function guestbook_private.touch_place_updated_at() reset search_path;

begin;

alter function guestbook_private.normalise_area_text(text) set search_path='pg_catalog','pg_temp';
alter function guestbook_private.touch_place_updated_at() set search_path='pg_catalog','pg_temp';

commit;

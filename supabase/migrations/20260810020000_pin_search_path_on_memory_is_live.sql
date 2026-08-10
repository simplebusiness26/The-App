-- Packet 8d follow-up: pin the search_path on memory_is_live.
--
-- Forward correction. `20260805130000_explorer_memories.sql` has already run
-- and is not edited -- RULES.md: never edit a migration that has already run.
--
-- Applying 8d closed two function_search_path_mutable findings (the 8e helpers
-- pinned by 20260805140000) and immediately opened a third:
--
--   function_search_path_mutable  guestbook_private.memory_is_live
--
-- It is the same gap for the same reason: the function was written without a
-- SET search_path clause. `can_read_memory` in the same migration has one;
-- this one was simply missed, exactly as the two 8e helpers were.
--
-- The argument for pinning is the one 20260805140000 already made and is worth
-- not re-deciding: the body calls only now(), which lives in pg_catalog, so it
-- is not exploitable today -- but "not exploitable today" is a property of the
-- current body, not of the function, and the rest of this schema pins it
-- everywhere. A later edit that adds an unqualified table reference would
-- inherit a caller-controlled search_path silently.
--
-- pg_catalog and pg_temp only: it has no reason to see `public` at all.
--
-- No behaviour change. The volatility label is left as STABLE, which is what
-- 20260805130000 applied and what reading now() requires.
--
-- REVERSAL
--   alter function guestbook_private.memory_is_live(timestamptz) reset search_path;

begin;

alter function guestbook_private.memory_is_live(timestamptz)
  set search_path='pg_catalog','pg_temp';

commit;

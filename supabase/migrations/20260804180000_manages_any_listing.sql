-- Packet 4: the Quick Access drawer's Manage section.
--
-- The brief is specific: "Check entitlement server-side, not just by hiding the
-- section." Hiding a section is a statement about a screen; this is a statement
-- about a person, and the database is the only thing that can make it.
--
-- security invoker, deliberately. The function runs as the caller, so row level
-- security applies to every table it touches and it can only ever see listings
-- the caller could already see. A security definer version would be a way to
-- ask the database about somebody else, which nothing needs.
--
-- The four tables are the four things a person can manage. They are checked
-- with exists() rather than counted because the answer is a yes or no and
-- counting rows a caller owns is work for no reason.
--
-- Reversal:
--   drop function if exists public.manages_any_listing();

begin;

create or replace function public.manages_any_listing()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select auth.uid() is not null and (
    exists (select 1 from public.businesses      where owner_id   = auth.uid())
    or exists (select 1 from public.properties     where owner_id   = auth.uid())
    or exists (select 1 from public.activity_clubs where manager_id = auth.uid())
    or exists (select 1 from public.events         where manager_id = auth.uid())
  );
$$;

comment on function public.manages_any_listing() is
  'True when the calling Explorer manages at least one business, property, activity club or event. Used by the Quick Access drawer to decide whether the Manage section exists, and by hooks/useManagerGate.js to decide whether the listing management screens open at all.';

-- Signed-out callers get false from auth.uid() being null rather than an error,
-- but they have no reason to ask, so only authenticated may execute.
revoke execute on function public.manages_any_listing() from public;
revoke execute on function public.manages_any_listing() from anon;
grant execute on function public.manages_any_listing() to authenticated;

commit;

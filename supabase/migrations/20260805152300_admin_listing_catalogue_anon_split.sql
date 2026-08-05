-- Admin dashboard, Stage 3 correction: keep the administrator-only helper out
-- of policies evaluated for signed-out visitors.
--
-- The first Stage 3 migration added guestbook_is_admin() to SELECT policies
-- scoped to `public`. Although its CASE expression tested auth.uid() first,
-- PostgreSQL is free to prepare/evaluate subexpressions without short-circuiting
-- the way application code would. A live `anon` verification therefore raised
-- 42501 because anon deliberately has no EXECUTE permission on the secure
-- administrator helper.
--
-- Split each policy by role. The anon rules contain no privileged function.
-- The authenticated rules retain public visibility, manager visibility and
-- administrator visibility. These roles are disjoint, so each caller evaluates
-- one SELECT policy and no caller gains another role's access.

begin;

drop policy if exists "Public can view published activity clubs"
  on public.activity_clubs;
drop policy if exists activity_clubs_read_anon
  on public.activity_clubs;
drop policy if exists activity_clubs_read_authenticated
  on public.activity_clubs;

create policy activity_clubs_read_anon
  on public.activity_clubs
  for select to anon
  using (status <> 'draft');

create policy activity_clubs_read_authenticated
  on public.activity_clubs
  for select to authenticated
  using (
    status <> 'draft'
    or manager_id = (select auth.uid())
    or (select public.guestbook_is_admin())
  );

drop policy if exists "Published events are public and managers see their own"
  on public.events;
drop policy if exists events_read_anon
  on public.events;
drop policy if exists events_read_authenticated
  on public.events;

create policy events_read_anon
  on public.events
  for select to anon
  using (status = 'published');

create policy events_read_authenticated
  on public.events
  for select to authenticated
  using (
    status = 'published'
    or manager_id = (select auth.uid())
    or (select public.guestbook_is_admin())
  );

commit;

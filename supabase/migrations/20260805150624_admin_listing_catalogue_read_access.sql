-- Admin dashboard, Stage 3: an administrator needs to inspect every listing,
-- including draft clubs and unpublished events. Extend each existing SELECT
-- policy rather than adding a second permissive policy, so ordinary reads still
-- evaluate one policy. Manager-owned writes remain unchanged.

alter policy "Public can view published activity clubs"
  on public.activity_clubs
  using (
    status <> 'draft'
    or manager_id = (select auth.uid())
    or case
      when (select auth.uid()) is null then false
      else (select public.guestbook_is_admin())
    end
  );

alter policy "Published events are public and managers see their own"
  on public.events
  using (
    status = 'published'
    or manager_id = (select auth.uid())
    or case
      when (select auth.uid()) is null then false
      else (select public.guestbook_is_admin())
    end
  );

-- Packet 10 -- one review table, and parks can be reviewed.
--
-- WHAT WAS ALREADY TRUE
--
-- Writing a review has been unified for a while. All four review routes are
-- eight-line wrappers around components/ExplorerReviewForm, which writes to
-- public.explorer_reviews. Reading was not: each place page read a different
-- table -- reviews, activity_club_reviews, event_reviews -- and those three are
-- copies written by sync_explorer_review_to_legacy() (20260802152100:267-342),
-- sharing primary keys with the real row.
--
-- The copies were never really storage. They were a view maintained by a
-- trigger, carrying a flattened shape the place cards were built against.
-- utils/reviews.js is now that view, computed at read time, which is what lets
-- the copies be dropped in a later packet once nothing reads them.
--
-- THIS MIGRATION DOES TWO THINGS
--
-- 1. Parks become reviewable. explorer_reviews.target_type allowed exactly four
--    values, none of them public_place, and there is no public_place_reviews
--    table anywhere -- which is why app/places/[id].js:85 passes
--    showReviews={false}. A park is a place (RULES.md: "Types: business,
--    property, park. A park is a place, not its own concept"), so it belongs in
--    the same table as the other places rather than in a fifth one.
--
-- 2. A manager's reply moves onto the real row. business_response, challenged
--    and challenge_reason exist only on the untracked legacy `reviews` table --
--    no migration ever created them -- which is why
--    app/property/review-action.js:71 writes a column literally called
--    business_response onto a review of a property. On explorer_reviews the
--    column is named for what it is.
--
-- WHAT IT DELIBERATELY DOES NOT DO
--
-- No review changes id. explorer_score_events.source_id points at
-- explorer_reviews.id with no foreign key and a unique constraint on
-- (source,source_id) (20260810040000:55-67), and 20260811010000 set every row's
-- awarded_on from its own historical date. Re-keying reviews would break the
-- scoring ledger silently, and no part of this packet needs to.
--
-- The three copy tables and the sync triggers stay for now. Dropping them is
-- its own packet, deliberately last, after this read path has run in production
-- long enough to be sure nothing outside the app still reads them.
--
-- TO UNDO
--   alter table public.explorer_reviews
--     drop column if exists manager_response,
--     drop column if exists challenged,
--     drop column if exists challenge_reason,
--     drop constraint if exists explorer_reviews_target_type_check;
--   alter table public.explorer_reviews add constraint explorer_reviews_target_type_check
--     check (target_type in ('business','property','activity_club','event'));

begin;

-- ---------------------------------------------------------------------------
-- 1. public_place joins the reviewable types
-- ---------------------------------------------------------------------------
-- Replaced rather than widened in place, because the original constraint was
-- written inline in the create table (20260802152000:49) and therefore carries
-- the system-generated name.

alter table public.explorer_reviews
  drop constraint if exists explorer_reviews_target_type_check;

alter table public.explorer_reviews
  add constraint explorer_reviews_target_type_check
  check (target_type in ('business','property','activity_club','event','public_place'));

-- ---------------------------------------------------------------------------
-- 2. The manager's reply, on the row it is about
-- ---------------------------------------------------------------------------
-- manager_response, not business_response: the same reply is written about
-- properties, clubs and events, and naming it after one of the five was how a
-- property review ended up with a business column.
--
-- A challenge and a reply are different states and stay separate columns, per
-- the vocabulary rules -- a manager disputing a review has not answered it.

alter table public.explorer_reviews
  add column if not exists manager_response text not null default '',
  add column if not exists challenged boolean not null default false,
  add column if not exists challenge_reason text not null default '';

alter table public.explorer_reviews
  drop constraint if exists explorer_reviews_manager_response_length;
alter table public.explorer_reviews
  add constraint explorer_reviews_manager_response_length
  check (char_length(manager_response) <= 1000);

alter table public.explorer_reviews
  drop constraint if exists explorer_reviews_challenge_reason_length;
alter table public.explorer_reviews
  add constraint explorer_reviews_challenge_reason_length
  check (char_length(challenge_reason) <= 1000);

comment on column public.explorer_reviews.manager_response is
  'A reply from whoever manages the reviewed place, club or event. Named for what it is: the same column carries replies about properties, clubs and events, not only businesses.';

-- Carry across whatever the legacy table already holds, so no manager loses a
-- reply they have already written. The copies share primary keys with the real
-- rows, which is what makes this a straight join.
update public.explorer_reviews er
set
  manager_response = coalesce(r.business_response,''),
  challenged = coalesce(r.challenged,false),
  challenge_reason = coalesce(r.challenge_reason,'')
from public.reviews r
where r.id = er.id
  and (
    coalesce(r.business_response,'') <> ''
    or coalesce(r.challenged,false)
  );

-- ---------------------------------------------------------------------------
-- 3. Only a manager of the reviewed thing may reply to or challenge a review
-- ---------------------------------------------------------------------------
-- Not done with a policy, and the reason is worth writing down.
--
-- 20260802152200:301 grants insert, update and delete on explorer_reviews to
-- authenticated at table level, so a column grant restricts nothing -- the
-- table grant already covers every column. The restriction is RLS, and RLS
-- policies are OR'd: adding a "managers may update" policy would let a manager
-- update ANY column of a review about their listing, including its rating and
-- its text. A policy cannot express "only these three columns changed", because
-- WITH CHECK sees the new row and never the old one.
--
-- So the reply goes through functions, which is the pattern the rest of this
-- schema already uses for anything with a rule attached, and a trigger stops
-- the columns being written any other way.

create or replace function public.respond_to_review(p_review_id uuid,p_response text)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_review public.explorer_reviews%rowtype;
begin
  select * into v_review from public.explorer_reviews where id=p_review_id;
  if not found then raise exception 'Review not found.'; end if;

  if not public.listing_is_managed_by_user(auth.uid(),v_review.target_type,v_review.target_id) then
    raise exception 'Only whoever manages this listing can reply to its reviews.';
  end if;

  perform set_config('xplorer.review_manager_write','on',true);
  update public.explorer_reviews
  set manager_response=coalesce(btrim(p_response),''),updated_at=now()
  where id=p_review_id;
  perform set_config('xplorer.review_manager_write','off',true);
end;
$$;

create or replace function public.challenge_review(p_review_id uuid,p_reason text)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_review public.explorer_reviews%rowtype;
begin
  select * into v_review from public.explorer_reviews where id=p_review_id;
  if not found then raise exception 'Review not found.'; end if;

  if not public.listing_is_managed_by_user(auth.uid(),v_review.target_type,v_review.target_id) then
    raise exception 'Only whoever manages this listing can challenge its reviews.';
  end if;

  if coalesce(btrim(p_reason),'')='' then
    raise exception 'A challenge needs a reason.';
  end if;

  perform set_config('xplorer.review_manager_write','on',true);
  update public.explorer_reviews
  set challenged=true,challenge_reason=btrim(p_reason),updated_at=now()
  where id=p_review_id;
  perform set_config('xplorer.review_manager_write','off',true);
end;
$$;

revoke all on function public.respond_to_review(uuid,text) from public,anon;
revoke all on function public.challenge_review(uuid,text) from public,anon;
grant execute on function public.respond_to_review(uuid,text) to authenticated;
grant execute on function public.challenge_review(uuid,text) to authenticated;

-- The other half. explorer_reviews_update_own (20260802152200:190) lets an
-- Explorer update their own review, and these three columns sit on that row --
-- so without this an author could erase a manager's reply to their own review,
-- or un-challenge it.
--
-- The two functions above are exempt through a transaction-local flag, not
-- through being SECURITY DEFINER: a trigger fires for the definer exactly as it
-- does for anybody else, so without the flag these functions would be blocked
-- by their own guard. set_config's third argument is `is_local`, so the setting
-- dies with the transaction and cannot be left switched on. A client cannot set
-- it -- reaching set_config at all needs SQL execution, which PostgREST does
-- not expose.

create or replace function guestbook_private.guard_review_manager_fields()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if coalesce(current_setting('xplorer.review_manager_write',true),'off')='on' then
    return new;
  end if;

  if new.manager_response is distinct from old.manager_response
     or new.challenged is distinct from old.challenged
     or new.challenge_reason is distinct from old.challenge_reason then
    raise exception 'A reply or challenge can only be written by whoever manages this listing, through respond_to_review or challenge_review.';
  end if;
  return new;
end;
$$;

drop trigger if exists explorer_reviews_guard_manager_fields on public.explorer_reviews;
create trigger explorer_reviews_guard_manager_fields
before update on public.explorer_reviews
for each row execute function guestbook_private.guard_review_manager_fields();

commit;

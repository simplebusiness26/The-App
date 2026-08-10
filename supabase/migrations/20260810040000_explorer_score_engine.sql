-- Packet 9a: the scoring engine. Backend only, and deliberately so.
--
-- THE PRIVACY REVIEW THAT THE BRIEF MAKES MANDATORY, AND WHAT IT CHANGED.
--
-- The brief's criterion is that "leaderboard queries do not expose location,
-- exact timestamps, or anything that reconstructs movement". The existing
-- `get_explorer_leaderboard` already holds up: it is opt-in
-- (`profiles.leaderboard_opt_in`), it shows `area` only when `show_area` is
-- true, and it exposes no coordinate, no timestamp and no contact field.
--
-- The new risk is arithmetic, not a column. Once a check-in earns points:
--
--   * a per-source breakdown ("142 points, 60 from check-ins") is a VISIT
--     COUNT, and
--   * a LOCAL leaderboard is scoped to an area, so the same figure says "this
--     Explorer was in this area roughly this many times this week".
--
-- Neither needs a location column to reconstruct movement. So:
--
--   1. The leaderboard exposes ONE OPAQUE TOTAL. `get_explorer_score_breakdown`
--      is SECURITY INVOKER and filtered to `auth.uid()`, so the split is
--      visible only to the Explorer it belongs to.
--   2. Check-in points diminish sharply on repeat visits to the same place, so
--      the total cannot be read back as a count of anything.
--   3. `explorer_score_events` carries `source_id` but NO coordinate and no
--      area, and its RLS lets an Explorer read only their own rows.
--
-- POINTS ARE AWARDED SERVER-SIDE ONLY.
-- `authenticated` gets no insert, update or delete on `explorer_score_events`.
-- The only way a row appears is a trigger on a real contribution, so a client
-- cannot write itself a score even with a valid session.
--
-- WHAT THIS IS NOT. `explorer_profile_stats.total_points` is REVIEW points and
-- keeps its meaning; this adds Explorer Score alongside it rather than
-- redefining a figure eleven packets already display. Packet 9b renders it.
--
-- REVERSAL
--   drop function if exists public.get_explorer_score(uuid);
--   drop function if exists public.get_explorer_score_breakdown();
--   drop trigger if exists explorer_review_scores on public.explorer_reviews;
--   drop trigger if exists live_checkin_scores on public.live_checkins;
--   drop table if exists public.explorer_score_events;

begin;

-- ---------------------------------------------------------------------------
-- 1. The ledger
-- ---------------------------------------------------------------------------
--
-- One row per scoring contribution. `source_id` is deliberately NOT a foreign
-- key with a cascade: the delete rule is a trigger, so removing points is a
-- thing this file states out loud rather than a side effect of a constraint
-- somebody could change later without noticing.

create table if not exists public.explorer_score_events(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('review','checkin')),
  source_id uuid not null,
  -- The place a check-in was at, used ONLY to apply diminishing returns. It is
  -- never returned by any function in this file.
  place_key text,
  points integer not null check (points>=0),
  awarded_on date not null default (now() at time zone 'utc')::date,
  created_at timestamptz not null default now(),
  constraint explorer_score_events_unique unique (source,source_id)
);

comment on table public.explorer_score_events is
  'Append-only scoring ledger. Written only by triggers; authenticated has no write grant. place_key exists for diminishing returns and is never exposed.';

create index if not exists explorer_score_events_user_idx
  on public.explorer_score_events(user_id,awarded_on desc);
create index if not exists explorer_score_events_place_idx
  on public.explorer_score_events(user_id,place_key) where place_key is not null;

-- ---------------------------------------------------------------------------
-- 2. The rules
-- ---------------------------------------------------------------------------

-- Caps, per the brief: "Daily and weekly contribution caps enforced in the
-- database". Enforced here rather than in a screen, because a cap a client
-- applies is a cap an attacker skips.
create or replace function guestbook_private.score_within_caps(p_user uuid,p_points integer)
returns boolean
language sql
stable
security definer
set search_path='public','pg_temp'
as $$
  select
    coalesce((
      select sum(points) from public.explorer_score_events
      where user_id=p_user and awarded_on=(now() at time zone 'utc')::date
    ),0)+p_points <= 100
    and
    coalesce((
      select sum(points) from public.explorer_score_events
      where user_id=p_user and awarded_on>=((now() at time zone 'utc')::date-6)
    ),0)+p_points <= 400;
$$;

-- Diminishing returns, per the brief: "the 5th check-in scores less than the
-- 1st". Halving per prior visit to the SAME place, measured on live data:
--
--   1st visit 10 · 2nd 5 · 3rd 2 · 4th 1 · 5th and after 1
--
-- The exponent is capped at four, so it bottoms out at a single point rather
-- than at zero. An earlier version of this comment claimed it reached zero;
-- running it showed 10/16 rounds to 1, and the floor is the better behaviour
-- anyway -- somebody's local should still be worth something, just not worth
-- farming. The score rewards breadth of local life, not one habit.
create or replace function guestbook_private.checkin_points(p_user uuid,p_place text)
returns integer
language sql
stable
security definer
set search_path='public','pg_temp'
as $$
  select greatest(
    0,
    (10 / power(2,least(coalesce((
      select count(*) from public.explorer_score_events
      where user_id=p_user and source='checkin' and place_key=p_place
    ),0),4)))::integer
  );
$$;

-- ---------------------------------------------------------------------------
-- 3. Awarding, server-side only
-- ---------------------------------------------------------------------------

create or replace function guestbook_private.award_review_score()
returns trigger
language plpgsql
security definer
set search_path='public','pg_temp'
as $$
declare v_points integer;
begin
  if new.status<>'published' then return new; end if;

  -- A verified review is worth more because it is evidence somebody actually
  -- went. CLAUDE.md's success metric is completed experiences.
  v_points := case when new.verified_qr then 15 else 5 end;

  if not guestbook_private.score_within_caps(new.user_id,v_points) then
    return new;
  end if;

  insert into public.explorer_score_events(user_id,source,source_id,points)
  values (new.user_id,'review',new.id,v_points)
  on conflict (source,source_id) do nothing;

  return new;
end;
$$;

create or replace function guestbook_private.award_checkin_score()
returns trigger
language plpgsql
security definer
set search_path='public','pg_temp'
as $$
declare
  v_place text;
  v_points integer;
begin
  if new.status<>'active' then return new; end if;

  -- Keyed by the listing where possible so "the same place" means the same
  -- place, not the same rounded coordinate.
  v_place := coalesce(new.target_id::text,new.public_place_id::text,lower(coalesce(new.place_name,'')));
  if v_place='' then return new; end if;

  v_points := guestbook_private.checkin_points(new.user_id,v_place);
  if v_points<=0 then return new; end if;

  if not guestbook_private.score_within_caps(new.user_id,v_points) then
    return new;
  end if;

  insert into public.explorer_score_events(user_id,source,source_id,place_key,points)
  values (new.user_id,'checkin',new.id,v_place,v_points)
  on conflict (source,source_id) do nothing;

  return new;
end;
$$;

-- "Deleting a contribution removes its points." Stated as its own trigger
-- rather than left to a cascade, so it cannot be quietly dropped by a change
-- to a foreign key.
create or replace function guestbook_private.remove_score_for_source()
returns trigger
language plpgsql
security definer
set search_path='public','pg_temp'
as $$
begin
  delete from public.explorer_score_events
  where source=tg_argv[0] and source_id=old.id;
  return old;
end;
$$;

drop trigger if exists explorer_review_scores on public.explorer_reviews;
create trigger explorer_review_scores after insert or update on public.explorer_reviews
for each row execute function guestbook_private.award_review_score();

drop trigger if exists explorer_review_unscored on public.explorer_reviews;
create trigger explorer_review_unscored after delete on public.explorer_reviews
for each row execute function guestbook_private.remove_score_for_source('review');

drop trigger if exists live_checkin_scores on public.live_checkins;
create trigger live_checkin_scores after insert on public.live_checkins
for each row execute function guestbook_private.award_checkin_score();

drop trigger if exists live_checkin_unscored on public.live_checkins;
create trigger live_checkin_unscored after delete on public.live_checkins
for each row execute function guestbook_private.remove_score_for_source('checkin');

-- ---------------------------------------------------------------------------
-- 4. Reading it
-- ---------------------------------------------------------------------------

alter table public.explorer_score_events enable row level security;

drop policy if exists explorer_score_events_read_own on public.explorer_score_events;
create policy explorer_score_events_read_own on public.explorer_score_events
for select to authenticated using (user_id=(select auth.uid()));

-- No insert, update or delete grant at all. The triggers are SECURITY DEFINER,
-- so they write regardless; a client cannot.
revoke all on public.explorer_score_events from anon,authenticated;
grant select on public.explorer_score_events to authenticated;

-- The public figure: one opaque total. No breakdown, no dates, no places.
create or replace function public.get_explorer_score(p_user_id uuid)
returns bigint
language sql
stable
security definer
set search_path='public','pg_temp'
as $$
  select coalesce(sum(points),0)::bigint
  from public.explorer_score_events
  where user_id=p_user_id;
$$;

comment on function public.get_explorer_score(uuid) is
  'One opaque total. A per-source split is a visit count, so the breakdown is get_explorer_score_breakdown() and is the owner''s alone.';

-- The breakdown, for its owner only. SECURITY INVOKER and filtered to
-- auth.uid(): row level security refuses other people's rows, and the filter
-- says so a second time.
create or replace function public.get_explorer_score_breakdown()
returns table(source text,points bigint,contributions bigint)
language sql
stable
set search_path='public','pg_temp'
as $$
  select e.source,sum(e.points)::bigint,count(*)::bigint
  from public.explorer_score_events e
  where e.user_id=(select auth.uid())
  group by e.source;
$$;

revoke all on function public.get_explorer_score(uuid) from public,anon;
grant execute on function public.get_explorer_score(uuid) to authenticated;
revoke all on function public.get_explorer_score_breakdown() from public,anon;
grant execute on function public.get_explorer_score_breakdown() to authenticated;

commit;

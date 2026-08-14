-- Push notifications: the plumbing.
--
-- There were none. Nothing in the repository matched expo-notifications,
-- ExpoPushToken or push_token, so a notification only existed if you opened the
-- app to look at it.
--
-- WHAT IS HERE AND WHAT IS NOT
--
-- Here: where a device token lives, what somebody has agreed to be interrupted
-- about, and the queue an Edge Function drains.
--
-- NOT here: the thing that FIRES it. This project has no pg_net, no pg_cron and
-- no http extension, so the database cannot call out on its own -- which means
-- the queue is written by a trigger and drained by something outside Postgres.
-- Enabling pg_net is a decision about this project's infrastructure and is not
-- one to make quietly inside a migration. Written down rather than half-done.
--
-- EVERY CATEGORY STARTS OFF
--
-- RULES.md: every visibility flag defaults to off, and opt-in is never the
-- fallback branch. That applies to a phone buzzing as much as to a map pin. A
-- new account gets no pushes at all until somebody turns one on, and there is a
-- single switch that stops all of them whatever else is set.

begin;

-- ---------------------------------------------------------------------------
-- Where to send
-- ---------------------------------------------------------------------------

create table if not exists public.push_tokens(
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios','android','web')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id,token)
);

create index if not exists push_tokens_user_idx on public.push_tokens(user_id);

alter table public.push_tokens enable row level security;

-- Your own devices, and nobody else's. A token is a way to make somebody's
-- phone light up; a list of them is a list of that person's devices.
drop policy if exists push_tokens_own_all on public.push_tokens;
create policy push_tokens_own_all on public.push_tokens
  for all to authenticated
  using (user_id=(select auth.uid()))
  with check (user_id=(select auth.uid()));

-- ---------------------------------------------------------------------------
-- What somebody has agreed to be interrupted about
-- ---------------------------------------------------------------------------
--
-- Columns rather than rows, so the default is expressed in the schema itself
-- and a missing row cannot mean "on". The category names are utils/
-- pushCategories.js, and scripts/verify-push.cjs checks the two against each
-- other -- a category in one and not the other is a switch that controls
-- nothing or a push nobody can stop.

create table if not exists public.push_preferences(
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- The master switch. Off here means off, whatever the six below say.
  enabled boolean not null default false,
  messages boolean not null default false,
  friends boolean not null default false,
  posts boolean not null default false,
  linkups boolean not null default false,
  clubs boolean not null default false,
  reviews boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.push_preferences enable row level security;

drop policy if exists push_preferences_own_all on public.push_preferences;
create policy push_preferences_own_all on public.push_preferences
  for all to authenticated
  using (user_id=(select auth.uid()))
  with check (user_id=(select auth.uid()));

-- ---------------------------------------------------------------------------
-- The queue
-- ---------------------------------------------------------------------------

create table if not exists public.push_queue(
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null default '',
  deep_link text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  failed_reason text
);

create index if not exists push_queue_unsent_idx
  on public.push_queue(created_at) where sent_at is null;

alter table public.push_queue enable row level security;

-- NOBODY reads this from the app. It is drained by an Edge Function using the
-- service role, which bypasses RLS. No policy at all is the correct amount of
-- access for a client: a queue of everybody's notifications is not something a
-- phone should be able to ask for.
revoke all on public.push_queue from anon, authenticated;

-- ---------------------------------------------------------------------------
-- What gets queued
-- ---------------------------------------------------------------------------

create or replace function guestbook_private.queue_push_notification()
returns trigger
language plpgsql
security definer
set search_path = 'public','pg_temp'
as $$
declare
  v_category text;
  v_wanted boolean;
begin
  -- social_moment is deliberately never pushed. It is the most common
  -- notification by a distance and it fires every time somebody you follow
  -- posts; as a push that is a phone buzzing all evening, and the first thing
  -- anybody does then is turn everything off, including what they wanted.
  v_category := case new.type
    when 'linkup_message' then 'messages'
    when 'activity_message' then 'messages'
    when 'direct_message' then 'messages'
    when 'social_friendship' then 'friends'
    when 'social_follow' then 'friends'
    when 'social_like' then 'posts'
    when 'social_comment' then 'posts'
    when 'linkup_joined' then 'linkups'
    when 'linkup_reminder' then 'linkups'
    when 'linkup_follower_created' then 'linkups'
    when 'activity_membership_approved' then 'clubs'
    when 'activity_membership_rejected' then 'clubs'
    when 'activity_membership_removed' then 'clubs'
    when 'activity_join_request' then 'clubs'
    when 'membership_request' then 'clubs'
    when 'new_review' then 'reviews'
    when 'review_response' then 'reviews'
    when 'manager_summary' then 'reviews'
    else null
  end;

  if v_category is null then return new; end if;

  -- A missing preferences row means every switch is off, because that is what
  -- the defaults say and because opt-in is never the fallback branch.
  select p.enabled and case v_category
      when 'messages' then p.messages
      when 'friends'  then p.friends
      when 'posts'    then p.posts
      when 'linkups'  then p.linkups
      when 'clubs'    then p.clubs
      when 'reviews'  then p.reviews
      else false
    end
    into v_wanted
  from public.push_preferences p
  where p.user_id=new.recipient_user_id;

  if coalesce(v_wanted,false) is not true then return new; end if;

  -- And no device to send to is nothing to queue.
  if not exists(select 1 from public.push_tokens t where t.user_id=new.recipient_user_id) then
    return new;
  end if;

  insert into public.push_queue(notification_id,user_id,title,body,deep_link)
  values(new.id,new.recipient_user_id,new.title,coalesce(new.message,''),new.deep_link);

  return new;
end;
$$;

drop trigger if exists queue_push_notification on public.notifications;
create trigger queue_push_notification
  after insert on public.notifications
  for each row execute function guestbook_private.queue_push_notification();

comment on function guestbook_private.queue_push_notification() is
  'Puts a notification on the push queue when its recipient has that category switched on AND has a device registered. A missing preferences row means every category is off.';

revoke all on function guestbook_private.queue_push_notification() from public, anon, authenticated;

grant select, insert, update, delete on public.push_tokens to authenticated;
grant select, insert, update on public.push_preferences to authenticated;

commit;

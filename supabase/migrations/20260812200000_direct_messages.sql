-- Packet 9: direct messages.
--
-- WHO MAY OPEN A CONVERSATION, decided by the owner:
--
--   FRIENDS -- two Explorers who follow each other. No requests, no inbox from
--   strangers, nothing to moderate on day one.
--
--   ANYBODY, TO A MANAGER, ABOUT A LISTING THEY RUN -- a question about opening
--   hours, whether a club has space. This is the half that opens an inbox a
--   stranger can write to, so it carries three things the friend case does not
--   need: it is scoped to one listing, it cannot be started with somebody who
--   has blocked you or whom you have blocked, and a message in it can be
--   reported into the existing moderation queue.
--
-- NOTHING IS INSERTED DIRECTLY. Every write goes through a function, because
-- the interesting rules are relational ("are you still friends", "do you still
-- manage this") and a WITH CHECK clause sees one row at a time. The tables
-- carry select policies and no write grants at all.
--
-- BLOCKING ENDS IT
--
-- public.block_explorer already deletes both follow directions, so a block ends
-- a friendship and with it the right to send. The listing case needs its own
-- test, because it never depended on following -- send_message checks
-- user_blocks in both directions for every message, not only at the start.
--
-- HISTORY IS NOT RETRACTED
--
-- Ending a friendship stops you SENDING. It does not delete what was already
-- said or hide it from either person. Deleting somebody's messages out from
-- under them because a follow changed would be the app editing a conversation
-- two people had, and RULES.md is explicit that an Explorer's content is not
-- deleted as a side effect of something else.
--
-- TO UNDO
--   drop table if exists public.direct_messages, public.conversation_members,
--     public.conversations cascade;
--   drop function if exists public.start_friend_conversation(uuid),
--     public.start_listing_conversation(text,uuid),
--     public.send_message(uuid,text), public.mark_conversation_read(uuid),
--     public.get_conversations();

begin;

-- ---------------------------------------------------------------------------
-- 1. The tables
-- ---------------------------------------------------------------------------

create table if not exists public.conversations(
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('friend','listing')),
  -- Only a listing conversation is about something. A friend conversation is
  -- about whatever two people want.
  target_type text,
  target_id uuid,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  constraint conversations_shape check (
    (kind='friend' and target_type is null and target_id is null)
    or (kind='listing' and target_type is not null and target_id is not null)
  )
);

create table if not exists public.conversation_members(
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (conversation_id,user_id)
);

create table if not exists public.direct_messages(
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  status text not null default 'sent' check (status in ('sent','removed')),
  created_at timestamptz not null default now(),
  constraint direct_messages_body_length
    check (char_length(btrim(body)) >= 1 and char_length(btrim(body)) <= 2000)
);

create index if not exists direct_messages_conversation_idx
  on public.direct_messages(conversation_id,created_at desc);
create index if not exists conversation_members_user_idx
  on public.conversation_members(user_id);
-- One friend conversation per pair, and one listing conversation per person per
-- listing. Enforced by the start functions; these make the lookup cheap.
create index if not exists conversations_listing_idx
  on public.conversations(target_type,target_id) where kind='listing';

-- ---------------------------------------------------------------------------
-- 2. Membership, answered once
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER because every policy below asks it, and a policy on
-- conversation_members that reads conversation_members is infinite recursion.

create or replace function guestbook_private.in_conversation(p_conversation uuid,p_user uuid)
returns boolean
language sql
stable
security definer
set search_path='public','pg_temp'
as $$
  select exists(
    select 1 from public.conversation_members m
    where m.conversation_id=p_conversation and m.user_id=p_user
  );
$$;

revoke all on function guestbook_private.in_conversation(uuid,uuid) from public,anon;
grant execute on function guestbook_private.in_conversation(uuid,uuid) to authenticated;

-- Are these two blocked from each other, in either direction.
create or replace function guestbook_private.either_blocked(p_a uuid,p_b uuid)
returns boolean
language sql
stable
security definer
set search_path='public','pg_temp'
as $$
  select exists(
    select 1 from public.user_blocks b
    where (b.blocker_id=p_a and b.blocked_id=p_b)
       or (b.blocker_id=p_b and b.blocked_id=p_a)
  );
$$;

revoke all on function guestbook_private.either_blocked(uuid,uuid) from public,anon,authenticated;

-- Who manages a listing, or null if nobody does.
create or replace function guestbook_private.listing_manager(p_type text,p_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path='public','pg_temp'
as $$
declare v_manager uuid;
begin
  if p_type='business' then select owner_id into v_manager from public.businesses where id=p_id;
  elsif p_type='property' then select owner_id into v_manager from public.properties where id=p_id;
  elsif p_type='activity_club' then select manager_id into v_manager from public.activity_clubs where id=p_id;
  elsif p_type='event' then select manager_id into v_manager from public.events where id=p_id;
  else return null;
  end if;
  return v_manager;
end;
$$;

revoke all on function guestbook_private.listing_manager(text,uuid) from public,anon,authenticated;

-- ---------------------------------------------------------------------------
-- 3. Row level security: read what you are in, write nothing directly
-- ---------------------------------------------------------------------------

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.direct_messages enable row level security;

drop policy if exists conversations_read_own on public.conversations;
create policy conversations_read_own on public.conversations
for select to authenticated
using (guestbook_private.in_conversation(id,(select auth.uid())));

drop policy if exists conversation_members_read_own on public.conversation_members;
create policy conversation_members_read_own on public.conversation_members
for select to authenticated
using (guestbook_private.in_conversation(conversation_id,(select auth.uid())));

drop policy if exists direct_messages_read_own on public.direct_messages;
create policy direct_messages_read_own on public.direct_messages
for select to authenticated
using (
  status='sent'
  and guestbook_private.in_conversation(conversation_id,(select auth.uid()))
);

revoke all on public.conversations,public.conversation_members,public.direct_messages from anon,authenticated;
grant select on public.conversations,public.conversation_members,public.direct_messages to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Opening one
-- ---------------------------------------------------------------------------

create or replace function public.start_friend_conversation(p_friend uuid)
returns uuid
language plpgsql
security definer
set search_path='public','pg_temp'
as $$
declare
  v_me uuid := auth.uid();
  v_id uuid;
begin
  if v_me is null then raise exception 'Log in to do this.'; end if;
  if p_friend is null or p_friend=v_me then raise exception 'Choose somebody to message.'; end if;

  if guestbook_private.either_blocked(v_me,p_friend) then
    raise exception 'You cannot message this Explorer.';
  end if;

  if not guestbook_private.are_friends(v_me,p_friend) then
    raise exception 'You can only message Explorers you are friends with. Follow each other first.';
  end if;

  -- One conversation per pair, whoever opens it.
  select c.id into v_id
  from public.conversations c
  where c.kind='friend'
    and guestbook_private.in_conversation(c.id,v_me)
    and guestbook_private.in_conversation(c.id,p_friend)
  limit 1;

  if v_id is not null then return v_id; end if;

  insert into public.conversations(kind) values ('friend') returning id into v_id;
  insert into public.conversation_members(conversation_id,user_id)
  values (v_id,v_me),(v_id,p_friend);

  return v_id;
end;
$$;

revoke all on function public.start_friend_conversation(uuid) from public,anon;
grant execute on function public.start_friend_conversation(uuid) to authenticated;

create or replace function public.start_listing_conversation(p_target_type text,p_target_id uuid)
returns uuid
language plpgsql
security definer
set search_path='public','pg_temp'
as $$
declare
  v_me uuid := auth.uid();
  v_manager uuid;
  v_id uuid;
begin
  if v_me is null then raise exception 'Log in to do this.'; end if;

  v_manager := guestbook_private.listing_manager(p_target_type,p_target_id);

  if v_manager is null then
    raise exception 'Nobody manages this listing yet, so there is nobody to message.';
  end if;

  if v_manager=v_me then
    raise exception 'You manage this listing.';
  end if;

  if guestbook_private.either_blocked(v_me,v_manager) then
    raise exception 'You cannot message this Explorer.';
  end if;

  -- One per person per listing, so a manager gets one thread per customer
  -- rather than a new one for every question.
  select c.id into v_id
  from public.conversations c
  where c.kind='listing'
    and c.target_type=p_target_type
    and c.target_id=p_target_id
    and guestbook_private.in_conversation(c.id,v_me)
  limit 1;

  if v_id is not null then return v_id; end if;

  insert into public.conversations(kind,target_type,target_id)
  values ('listing',p_target_type,p_target_id) returning id into v_id;

  insert into public.conversation_members(conversation_id,user_id)
  values (v_id,v_me),(v_id,v_manager);

  return v_id;
end;
$$;

revoke all on function public.start_listing_conversation(text,uuid) from public,anon;
grant execute on function public.start_listing_conversation(text,uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Sending
-- ---------------------------------------------------------------------------
-- The relationship is checked on EVERY message, not only when the conversation
-- was opened. Somebody who unfollows, or is blocked, or stops managing the
-- listing the thread is about, stops being able to write to it.

create or replace function public.send_message(p_conversation uuid,p_body text)
returns uuid
language plpgsql
security definer
set search_path='public','pg_temp'
as $$
declare
  v_me uuid := auth.uid();
  v_kind text;
  v_type text;
  v_target uuid;
  v_other uuid;
  v_manager uuid;
  v_id uuid;
begin
  if v_me is null then raise exception 'Log in to do this.'; end if;
  if coalesce(btrim(p_body),'')='' then raise exception 'Write something first.'; end if;

  if not guestbook_private.in_conversation(p_conversation,v_me) then
    raise exception 'This conversation is not yours.';
  end if;

  select kind,target_type,target_id into v_kind,v_type,v_target
  from public.conversations where id=p_conversation;

  select user_id into v_other from public.conversation_members
  where conversation_id=p_conversation and user_id<>v_me limit 1;

  if v_other is null then raise exception 'There is nobody in this conversation.'; end if;

  if guestbook_private.either_blocked(v_me,v_other) then
    raise exception 'You cannot message this Explorer.';
  end if;

  if v_kind='friend' and not guestbook_private.are_friends(v_me,v_other) then
    raise exception 'You are not friends any more, so this conversation is closed. What was already said stays.';
  end if;

  if v_kind='listing' then
    v_manager := guestbook_private.listing_manager(v_type,v_target);
    -- Either the manager is still one of the two, or the listing changed hands
    -- and this thread is finished.
    if v_manager is null or (v_manager<>v_me and v_manager<>v_other) then
      raise exception 'Nobody manages this listing any more, so this conversation is closed.';
    end if;
  end if;

  insert into public.direct_messages(conversation_id,sender_id,body)
  values (p_conversation,v_me,btrim(p_body))
  returning id into v_id;

  update public.conversations set last_message_at=now() where id=p_conversation;
  update public.conversation_members set last_read_at=now()
  where conversation_id=p_conversation and user_id=v_me;

  return v_id;
end;
$$;

revoke all on function public.send_message(uuid,text) from public,anon;
grant execute on function public.send_message(uuid,text) to authenticated;

create or replace function public.mark_conversation_read(p_conversation uuid)
returns void
language sql
security definer
set search_path='public','pg_temp'
as $$
  update public.conversation_members set last_read_at=now()
  where conversation_id=p_conversation and user_id=auth.uid();
$$;

revoke all on function public.mark_conversation_read(uuid) from public,anon;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. The inbox
-- ---------------------------------------------------------------------------
-- One row per conversation with who it is with and what was last said. The
-- unread count is the caller's own; nobody learns whether somebody else has
-- read their message, which is a presence signal nobody asked for.

create or replace function public.get_conversations()
returns table(
  conversation_id uuid,
  kind text,
  target_type text,
  target_id uuid,
  other_id uuid,
  other_name text,
  other_photo text,
  last_message text,
  last_message_at timestamptz,
  unread_count integer
)
language sql
stable
security definer
set search_path='public','pg_temp'
as $$
  select
    c.id,
    c.kind,
    c.target_type,
    c.target_id,
    o.user_id,
    coalesce(p.full_name,'Explorer'),
    p.profile_photo,
    (select d.body from public.direct_messages d
      where d.conversation_id=c.id and d.status='sent'
      order by d.created_at desc limit 1),
    c.last_message_at,
    (select count(*)::integer from public.direct_messages d
      where d.conversation_id=c.id and d.status='sent'
        and d.sender_id<>auth.uid()
        and (me.last_read_at is null or d.created_at>me.last_read_at))
  from public.conversations c
  join public.conversation_members me on me.conversation_id=c.id and me.user_id=auth.uid()
  join public.conversation_members o on o.conversation_id=c.id and o.user_id<>auth.uid()
  left join public.profiles p on p.id=o.user_id
  order by c.last_message_at desc;
$$;

revoke all on function public.get_conversations() from public,anon;
grant execute on function public.get_conversations() to authenticated;

-- ---------------------------------------------------------------------------
-- 7. A message can be reported
-- ---------------------------------------------------------------------------
-- The manager inbox is the one a stranger can write to, so it does not ship
-- without this. It goes into social_reports, the same queue reviews, Moments
-- and comments already use, so there is one moderation screen and not two.

alter table public.social_reports drop constraint if exists social_reports_target_type_check;
alter table public.social_reports drop constraint if exists social_reports_target_type;

do $$
declare v_name text;
begin
  select conname into v_name from pg_constraint
  where conrelid='public.social_reports'::regclass and contype='c'
    and pg_get_constraintdef(oid) ilike '%target_type%' limit 1;
  if v_name is not null then
    execute format('alter table public.social_reports drop constraint %I',v_name);
  end if;
end;
$$;

alter table public.social_reports
  add constraint social_reports_target_type
  check (target_type in ('moment','comment','review','message'));

commit;

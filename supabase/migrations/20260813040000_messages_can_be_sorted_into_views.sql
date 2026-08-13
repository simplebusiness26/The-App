-- Messages gets All / Friends / Managers / Message Boards.
--
-- THESE ARE VIEWS, NOT A NEW MESSAGING SYSTEM.
-- Three systems already exist and none of them changes here: direct messages
-- (conversations / direct_messages, 20260812200000), the Link-up attendee board
-- (linkup_messages, 20260802211500) and the Activity Club members' board
-- (activity_messages, 20260801090000). Everything below reads them.
--
-- WHAT WAS MISSING
--
-- 1. get_conversations() returned `kind` as 'friend' or 'listing' and nothing
--    else about the listing -- no name, no id of the manager. The inbox could
--    say "About a business" and not which business.
--
-- 2. Nothing said WHICH SIDE the viewer is on. send_message knows -- it checks
--    the manager on every message -- but never exposed it, so a manager's inbox
--    and a customer's inbox rendered identically. That is the whole difference
--    between "a Manager wrote to me" and "I wrote to a Manager", which is what
--    a Managers tab is for.
--
--    MANAGER IS A CAPABILITY, NOT AN ACCOUNT TYPE. `viewer_is_manager` says
--    which side of ONE conversation somebody is on. It is not a property of the
--    person and it is not a role: the same Explorer is the manager in a thread
--    about their cafe and the customer in a thread about somebody else's.
--
-- 3. There was no way to list the boards somebody may read. The Messages screen
--    would otherwise have had to query every Link-up and every club and filter
--    client-side, which is the per-row query the brief asks to avoid.
--
-- EVENT BOARDS DO NOT EXIST and are not invented here. Events are the one
-- listing type with a manager and no board -- no event_messages table, no
-- route. Adding one would be a new system, which is the opposite of the ask.

begin;

-- ---------------------------------------------------------------------------
-- 1. Conversations learn which side you are on, and what the listing is called
-- ---------------------------------------------------------------------------

drop function if exists public.get_conversations();

create or replace function public.get_conversations()
returns table(
  conversation_id uuid,
  kind text,
  target_type text,
  target_id uuid,
  target_name text,
  viewer_is_manager boolean,
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
set search_path to 'public','pg_temp'
as $$
  select
    c.id,
    c.kind,
    c.target_type,
    c.target_id,
    case c.target_type
      when 'business' then (select b.name from public.businesses b where b.id=c.target_id)
      when 'property' then (select pr.name from public.properties pr where pr.id=c.target_id)
      when 'activity_club' then (select ac.name from public.activity_clubs ac where ac.id=c.target_id)
      when 'event' then (select e.name from public.events e where e.id=c.target_id)
    end,
    -- Which side of THIS conversation. Not a role, not a flag on the person.
    coalesce(
      c.kind='listing'
        and guestbook_private.listing_manager(c.target_type,c.target_id)=auth.uid(),
      false
    ),
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

comment on function public.get_conversations() is
  'The inbox. viewer_is_manager says which side of THIS conversation the caller is on -- Manager is a capability held per listing, never an account type, so the same Explorer is the manager in one thread and the customer in another.';

-- ---------------------------------------------------------------------------
-- 2. The boards you may already read
-- ---------------------------------------------------------------------------
-- One call, two systems, no per-row queries. Membership is re-derived here from
-- the same conditions the boards' own read policies use, so this can never list
-- a board the caller would then be refused:
--
--   Link-up board  -- private.is_active_linkup_member (20260802211800:56)
--   Club board     -- an approved activity_memberships row, or being the
--                     club's manager (20260801090000:338)
--
-- It lists what exists; opening one is still gated by that board's own policy.

create or replace function public.get_message_boards()
returns table(
  board_kind text,
  board_id uuid,
  title text,
  subtitle text,
  last_message text,
  last_message_at timestamptz,
  route text
)
language sql
stable
security definer
set search_path to 'public','pg_temp'
as $$
  with me as (select auth.uid() as id)
  select
    'linkup'::text,
    l.id,
    l.title,
    l.area,
    -- Deleted messages are not a preview. linkup_messages keeps them with a
    -- deleted_at rather than removing the row.
    (select m.body from public.linkup_messages m
      where m.linkup_id=l.id and m.deleted_at is null
      order by m.created_at desc limit 1),
    (select m.created_at from public.linkup_messages m
      where m.linkup_id=l.id and m.deleted_at is null
      order by m.created_at desc limit 1),
    '/linkups/board/'||l.id
  from public.linkups l, me
  where me.id is not null
    and private.is_active_linkup_member(l.id,me.id)

  union all

  select
    'activity_club'::text,
    ac.id,
    ac.name,
    ac.location,
    -- `message`, not `body`. The two boards were built a fortnight apart and
    -- do not share a column name; guessing cost one failed migration.
    (select m.message from public.activity_messages m
      where m.club_id=ac.id order by m.created_at desc limit 1),
    (select m.created_at from public.activity_messages m
      where m.club_id=ac.id order by m.created_at desc limit 1),
    '/activity-clubs/message-board/'||ac.id
  from public.activity_clubs ac, me
  where me.id is not null
    and (
      ac.manager_id=me.id
      or exists(
        select 1 from public.activity_memberships am
        where am.club_id=ac.id and am.user_id=me.id and am.status='approved'
      )
    )

  -- Most recent first, and a board nobody has written on yet still appears --
  -- an empty board you may post to is more useful than no board at all.
  order by 6 desc nulls last, 3 asc;
$$;

revoke all on function public.get_message_boards() from public,anon;
grant execute on function public.get_message_boards() to authenticated;

comment on function public.get_message_boards() is
  'The Link-up and Activity Club boards the caller is already authorised to read, for the Messages screen. A navigation aid: the boards own their access rules and this re-derives the same conditions rather than inventing a second answer. Events have no board -- that would be a new system.';

commit;

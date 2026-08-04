-- Manager becomes a flag on an Explorer profile, not a value of account_type.
--
-- Until now profiles.account_type held exactly one of 'explorer' or 'manager',
-- and the two were mutually exclusive. That is the wrong shape for what the app
-- needs: a manager is a person who also explores, and cutting them off from the
-- Explorer surface the moment they list a business is not a product decision
-- anyone made -- it is a side effect of storing two independent facts in one
-- column.
--
-- It is not only a UI problem. account_type = 'explorer' is tested server-side
-- by guestbook_private.is_explorer(), private.linkup_user_is_explorer() and
-- roughly fifteen RPCs and triggers built on them. Flipping a user to 'manager'
-- makes the database itself start refusing their reviews
-- (20260802152100:139-142 raises 'Only Explorer accounts can publish reviews.'),
-- their follows, their moments, their check-ins and their link-ups. An
-- "upgrade" that silently revokes half of someone's account is not an upgrade.
--
-- So account_type stays 'explorer' for everyone, permanently, and manager moves
-- to its own boolean alongside is_admin -- which has always been orthogonal and
-- has always worked. Every explorer gate, client and server, keeps passing
-- untouched. Only the five client checks and three RLS policies that genuinely
-- mean "manager" have to change, and they do so in the two migrations that
-- follow this one.

alter table public.profiles
  add column if not exists is_manager boolean not null default false;

-- Signup no longer sends account_type, so the column supplies its own value.
-- This is what lets the next migration drop account_type from the UPDATE grant
-- without breaking account creation.
alter table public.profiles
  alter column account_type set default 'explorer';

-- Existing managers become Explorers who are also Managers.
--
-- This is a visible change to live accounts, not just a schema move: these
-- users gain the entire Explorer surface they were previously locked out of,
-- and they become visible in the Explorer directory (app/explorers.js:41), in
-- other users' follower lists (app/connections/[id].js:88) and on leaderboards.
-- That is the intended outcome -- it is the whole point of the new model -- but
-- it is worth naming, because nobody asked for their account to change and they
-- will notice.
--
-- Their listings, claims and capabilities are untouched; only how the app reads
-- their identity changes.
update public.profiles
   set is_manager = true,
       account_type = 'explorer'
 where account_type = 'manager';

-- account_type has never had a constraint -- it is bare text, and a value like
-- 'wizard' would have been accepted. Now that the column carries one meaning
-- and one value, constrain it. 'manager' stays legal so that any row written by
-- an older client mid-deploy is still valid rather than failing an insert.
alter table public.profiles
  drop constraint if exists profiles_account_type_check;

alter table public.profiles
  add constraint profiles_account_type_check
  check (account_type in ('explorer','manager'));

create index if not exists profiles_is_manager_idx
  on public.profiles(is_manager)
  where is_manager;

-- Verification
-- ---------------------------------------------------------------------------
--   select account_type, is_manager, count(*)
--     from public.profiles group by 1,2 order by 1,2;
--
-- Expect every row to read account_type = 'explorer', split across
-- is_manager = false (ordinary explorers) and is_manager = true (the accounts
-- that were managers before this ran). No row should remain on
-- account_type = 'manager'.

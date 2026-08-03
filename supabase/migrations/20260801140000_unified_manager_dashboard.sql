alter table public.activity_messages
  add column if not exists author_name text not null default 'Member';

alter table public.activity_memberships
  add column if not exists applicant_name text not null default 'Explorer';

alter table public.activity_club_reviews
  add column if not exists reviewer_name text not null default 'Explorer';

alter table public.manager_capabilities
  add column if not exists businesses_status text not null default 'active'
    check (businesses_status in ('inactive','requested','trial','active','past_due','cancelled')),
  add column if not exists properties_status text not null default 'active'
    check (properties_status in ('inactive','requested','trial','active','past_due','cancelled')),
  add column if not exists events_status text not null default 'inactive'
    check (events_status in ('inactive','requested','trial','active','past_due','cancelled'));

create table if not exists public.manager_capability_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  capability text not null
    check (capability in ('businesses','properties','activity_clubs','events')),
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','cancelled')),
  request_note text not null default '',
  admin_note text not null default '',
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id,capability)
);

alter table public.manager_capability_requests enable row level security;

drop policy if exists "Managers can view their capability requests"
on public.manager_capability_requests;
create policy "Managers can view their capability requests"
on public.manager_capability_requests for select to authenticated
using (user_id = auth.uid());

drop policy if exists "Managers can request capabilities"
on public.manager_capability_requests;
create policy "Managers can request capabilities"
on public.manager_capability_requests for insert to authenticated
with check (
  user_id = auth.uid()
  and status = 'pending'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.account_type = 'manager'
  )
);

drop policy if exists "Managers can resubmit capability requests"
on public.manager_capability_requests;
create policy "Managers can resubmit capability requests"
on public.manager_capability_requests for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid() and status = 'pending');

drop policy if exists "Admins can manage capability requests"
on public.manager_capability_requests;
create policy "Admins can manage capability requests"
on public.manager_capability_requests for all to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and p.is_admin = true
))
with check (exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and p.is_admin = true
));

insert into public.manager_capabilities (
  user_id,
  businesses_status,
  properties_status,
  activity_clubs_status,
  events_status,
  updated_at
)
select
  p.id,
  'active',
  'active',
  'inactive',
  'inactive',
  now()
from public.profiles p
where p.account_type = 'manager'
on conflict (user_id) do update set
  businesses_status = coalesce(public.manager_capabilities.businesses_status,'active'),
  properties_status = coalesce(public.manager_capabilities.properties_status,'active'),
  updated_at = now();

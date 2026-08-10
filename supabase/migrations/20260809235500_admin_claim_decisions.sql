-- Admin Dashboard, Stage 4a: decide listing claims as one audited transaction.
--
-- The former screen updated a listing first and the claim second. If the
-- second request failed, ownership had already changed and the pending claim
-- remained behind. This RPC owns the entire transition so PostgreSQL commits
-- the listing assignment, claim decision and audit entry together or rolls
-- all three back.

begin;

-- Decision metadata is kept on the claim for quick support work. Existing
-- approved rows pre-date this audit trail, so decided_by remains nullable;
-- every decision made by the RPC records the current administrator.
alter table public.claims
  add column if not exists decision_reason text,
  add column if not exists decided_at timestamptz,
  add column if not exists decided_by uuid;

alter table public.claims
  alter column user_id set not null,
  alter column status set not null;

alter table public.claims
  drop constraint if exists claims_status_valid,
  add constraint claims_status_valid
    check (status in ('pending','approved','rejected')),
  drop constraint if exists claims_one_target,
  add constraint claims_one_target
    check (num_nonnulls(business_id,property_id)=1),
  drop constraint if exists claims_decision_metadata_valid,
  add constraint claims_decision_metadata_valid
    check (
      (status='pending' and decision_reason is null and decided_at is null and decided_by is null)
      or
      (
        status in ('approved','rejected')
        and decision_reason is not null
        and char_length(btrim(decision_reason)) between 3 and 500
        and decided_at is not null
      )
    ) not valid;

-- Existing final rows are historical decisions made before metadata and audit
-- logging existed. Mark them honestly rather than inventing an administrator.
update public.claims
set
  decision_reason='Historical decision made before audit logging',
  decided_at=coalesce(created_at,now())
where status in ('approved','rejected')
  and (decision_reason is null or decided_at is null);

alter table public.claims
  validate constraint claims_decision_metadata_valid;

-- A rejected Explorer may submit a corrected claim later, but there can be
-- only one active claim from the same Explorer and one approved manager for a
-- listing at any moment.
create unique index if not exists claims_active_business_per_explorer
  on public.claims(user_id,business_id)
  where business_id is not null and status in ('pending','approved');

create unique index if not exists claims_active_property_per_explorer
  on public.claims(user_id,property_id)
  where property_id is not null and status in ('pending','approved');

create unique index if not exists claims_one_approved_business
  on public.claims(business_id)
  where business_id is not null and status='approved';

create unique index if not exists claims_one_approved_property
  on public.claims(property_id)
  where property_id is not null and status='approved';

-- New claim submissions must always begin pending. The trusted decision RPC
-- is the only Data API path that may move a claim out of that state.
drop policy if exists "Users can create claims" on public.claims;
create policy "Users can create claims"
  on public.claims for insert to authenticated
  with check (
    (select auth.uid())=user_id
    and status='pending'
    and decision_reason is null
    and decided_at is null
    and decided_by is null
    and num_nonnulls(business_id,property_id)=1
  );

revoke update on public.claims from authenticated;

-- Append-only audit records. Data API callers may read them only when the
-- shared database admin check passes; they cannot insert, update or delete
-- records. Trusted decision functions insert as their database owner.
create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null,
  action text not null
    check (char_length(btrim(action)) between 3 and 100),
  target_type text not null
    check (char_length(btrim(target_type)) between 3 and 80),
  target_id uuid not null,
  reason text not null
    check (char_length(btrim(reason)) between 3 and 500),
  details jsonb not null default '{}'::jsonb
    check (jsonb_typeof(details)='object'),
  created_at timestamptz not null default now()
);

alter table public.admin_audit_log enable row level security;

revoke all on public.admin_audit_log from public,anon,authenticated;
grant select on public.admin_audit_log to authenticated;

create policy admin_audit_log_read_admin
  on public.admin_audit_log for select to authenticated
  using ((select public.guestbook_is_admin()));

create index admin_audit_log_created_at_idx
  on public.admin_audit_log(created_at desc);

create index admin_audit_log_target_idx
  on public.admin_audit_log(target_type,target_id,created_at desc);

create or replace function public.admin_decide_claim(
  p_claim_id uuid,
  p_decision text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := auth.uid();
  v_claim public.claims%rowtype;
  v_decision text := lower(btrim(coalesce(p_decision,'')));
  v_reason text := btrim(coalesce(p_reason,''));
  v_listing_id uuid;
  v_listing_type text;
  v_owner_id uuid;
begin
  if v_actor is null then
    raise exception 'Authentication is required.';
  end if;

  if not public.guestbook_is_admin() then
    raise exception 'Administrator access is required.';
  end if;

  if v_decision not in ('approved','rejected') then
    raise exception 'Decision must be approved or rejected.';
  end if;

  if char_length(v_reason) not between 3 and 500 then
    raise exception 'A decision reason between 3 and 500 characters is required.';
  end if;

  select c.*
  into v_claim
  from public.claims c
  where c.id=p_claim_id
  for update;

  if not found then
    raise exception 'Claim not found.';
  end if;

  if v_claim.status<>'pending' then
    raise exception 'This claim has already been decided.';
  end if;

  if v_claim.business_id is not null then
    v_listing_id := v_claim.business_id;
    v_listing_type := 'business';

    if v_decision='approved' then
      select b.owner_id
      into v_owner_id
      from public.businesses b
      where b.id=v_listing_id
      for update;

      if not found then
        raise exception 'The business for this claim no longer exists.';
      end if;

      if v_owner_id is not null and v_owner_id<>v_claim.user_id then
        raise exception 'This business is already managed by another Explorer.';
      end if;

      update public.businesses
      set owner_id=v_claim.user_id,claimed=true
      where id=v_listing_id;
    end if;
  elsif v_claim.property_id is not null then
    v_listing_id := v_claim.property_id;
    v_listing_type := 'property';

    if v_decision='approved' then
      select p.owner_id
      into v_owner_id
      from public.properties p
      where p.id=v_listing_id
      for update;

      if not found then
        raise exception 'The property for this claim no longer exists.';
      end if;

      if v_owner_id is not null and v_owner_id<>v_claim.user_id then
        raise exception 'This property is already managed by another Explorer.';
      end if;

      update public.properties
      set owner_id=v_claim.user_id
      where id=v_listing_id;
    end if;
  else
    raise exception 'This claim does not identify a supported listing.';
  end if;

  update public.claims
  set
    status=v_decision,
    decision_reason=v_reason,
    decided_at=now(),
    decided_by=v_actor
  where id=v_claim.id;

  insert into public.admin_audit_log (
    actor_id,
    action,
    target_type,
    target_id,
    reason,
    details
  ) values (
    v_actor,
    'claim.' || v_decision,
    v_listing_type,
    v_listing_id,
    v_reason,
    jsonb_build_object(
      'claim_id',v_claim.id,
      'explorer_id',v_claim.user_id,
      'decision',v_decision
    )
  );

  return jsonb_build_object(
    'claim_id',v_claim.id,
    'decision',v_decision,
    'listing_type',v_listing_type,
    'listing_id',v_listing_id
  );
end;
$$;

revoke all on function public.admin_decide_claim(uuid,text,text)
  from public,anon,authenticated;
grant execute on function public.admin_decide_claim(uuid,text,text)
  to authenticated;

commit;

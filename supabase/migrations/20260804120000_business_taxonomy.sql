-- Packet 1: structured classification for businesses.
--
-- businesses.category was free text typed into a box. The live data shows what
-- that produces: 'Pub', 'Cafe', 'Test' and 'Restaurant test' across 12 rows.
-- Nothing can be filtered, no marker can be derived from it, and 'Test' is
-- indistinguishable from a real category.
--
-- The taxonomy is authored in utils/taxonomy.js and seeded here. Those two must
-- agree; scripts/verify-taxonomy.cjs fails the build if they drift, and is the
-- reason a catalogue table is acceptable rather than a second source of truth.
--
-- The type list is nearly empty on purpose. The interface direction document
-- the brief points at is not in the repository, so the real types are not
-- knowable. bar, pub and restaurant are placeholders chosen so the structure is
-- exercised by real rows. Extending it means editing utils/taxonomy.js and
-- adding a migration that re-seeds business_types.

begin;

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------

create table if not exists public.business_categories (
  key text primary key,
  label text not null,
  sort_order integer not null default 0
);

create table if not exists public.business_types (
  category text not null references public.business_categories(key) on update cascade,
  key text not null,
  label text not null,
  sort_order integer not null default 0,
  primary key (category, key)
);

insert into public.business_categories (key,label,sort_order) values
  ('food_and_drink','Food and drink',1),
  ('entertainment_and_nightlife','Entertainment and nightlife',2),
  ('health_and_wellbeing','Health and wellbeing',3),
  ('shopping','Shopping',4),
  ('attractions_and_experiences','Attractions and experiences',5),
  ('essential_local_services','Essential local services',6),
  ('unclassified','Unclassified',99)
on conflict (key) do update set label=excluded.label, sort_order=excluded.sort_order;

insert into public.business_types (category,key,label,sort_order) values
  ('food_and_drink','bar','Bar',1),
  ('food_and_drink','pub','Pub',2),
  ('food_and_drink','restaurant','Restaurant',3)
on conflict (category,key) do update set label=excluded.label, sort_order=excluded.sort_order;

-- Every category carries an 'unclassified' type. This is what lets a row say
-- "this is food and drink, but there is no type for it yet" rather than
-- throwing away the category it does know. Without it, the Cafe rows below
-- would lose the only accurate fact recorded about them.
insert into public.business_types (category,key,label,sort_order)
select key,'unclassified','Not yet classified',999 from public.business_categories
on conflict (category,key) do nothing;

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
-- category already exists as free text and is kept, not duplicated: a second
-- category column would be exactly the drift this packet exists to remove. Its
-- values are rewritten by the backfill below, and it is constrained afterwards.

alter table public.businesses
  add column if not exists business_type text not null default 'unclassified',
  add column if not exists secondary_types text[] not null default '{}',
  add column if not exists tags text[] not null default '{}';

-- The original free-text value is preserved rather than discarded. It is the
-- only record of what a manager actually typed, and the backfill's guesses are
-- reviewable against it.
alter table public.businesses
  add column if not exists category_source text;

update public.businesses set category_source = category where category_source is null;

-- ---------------------------------------------------------------------------
-- Backfill
-- ---------------------------------------------------------------------------
-- Every decision is written out rather than inferred by a clever rule, because
-- there are four distinct values and a reviewer should be able to check each.
--
--   'Pub'             -> food_and_drink / pub          exact match
--   'Cafe'            -> food_and_drink / unclassified category is unambiguous,
--                                                      no cafe type is seeded
--   'Restaurant test' -> unclassified / unclassified   named "test"; treating it
--                                                      as a real restaurant
--                                                      would invent a business
--   'Test'            -> unclassified / unclassified   junk
--   null / anything else -> unclassified / unclassified

-- The WHERE clause makes this safe to re-run. Without it, a second apply would
-- read the already-migrated key 'food_and_drink', fail to match 'pub' or
-- 'cafe', and demote every classified row back to unclassified.
update public.businesses set
  category = case
    when lower(btrim(coalesce(category,''))) = 'pub'  then 'food_and_drink'
    when lower(btrim(coalesce(category,''))) = 'cafe' then 'food_and_drink'
    else 'unclassified'
  end,
  business_type = case
    when lower(btrim(coalesce(category,''))) = 'pub' then 'pub'
    else 'unclassified'
  end
where category is null
   or category not in (select key from public.business_categories);

-- ---------------------------------------------------------------------------
-- Validation, in the database rather than the form
-- ---------------------------------------------------------------------------

alter table public.businesses
  alter column category set default 'unclassified';

update public.businesses set category='unclassified' where category is null;

alter table public.businesses
  alter column category set not null;

alter table public.businesses
  drop constraint if exists businesses_classification_fk;

alter table public.businesses
  add constraint businesses_classification_fk
  foreign key (category,business_type)
  references public.business_types(category,key)
  on update cascade;

-- secondary_types are additional types the place also is. They must be real
-- types, must not repeat the primary, and are capped at two by the brief.
create or replace function public.validate_business_secondary_types()
returns trigger
language plpgsql
as $$
declare
  extra text;
begin
  if array_length(new.secondary_types,1) > 2 then
    raise exception 'A business may have at most 2 secondary types.';
  end if;

  if new.business_type = any(coalesce(new.secondary_types,'{}')) then
    raise exception 'secondary_types must not repeat the primary business_type.';
  end if;

  foreach extra in array coalesce(new.secondary_types,'{}') loop
    if not exists (select 1 from public.business_types t where t.key = extra) then
      raise exception 'Unknown business type in secondary_types: %', extra;
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists businesses_validate_secondary_types on public.businesses;
create trigger businesses_validate_secondary_types
  before insert or update on public.businesses
  for each row execute function public.validate_business_secondary_types();

create index if not exists businesses_category_type_idx
  on public.businesses(category,business_type);

-- The catalogue is public reference data: readable by anyone, writable by
-- nobody through the API. It changes by migration only.
alter table public.business_categories enable row level security;
alter table public.business_types enable row level security;

drop policy if exists "Business categories are publicly readable" on public.business_categories;
create policy "Business categories are publicly readable"
  on public.business_categories for select to anon, authenticated using (true);

drop policy if exists "Business types are publicly readable" on public.business_types;
create policy "Business types are publicly readable"
  on public.business_types for select to anon, authenticated using (true);

revoke insert, update, delete on public.business_categories, public.business_types from anon, authenticated;
grant select on public.business_categories, public.business_types to anon, authenticated;

commit;

-- ---------------------------------------------------------------------------
-- Reversibility
-- ---------------------------------------------------------------------------
-- category_source holds the original free text, so the classification can be
-- undone without data loss:
--
--   begin;
--   alter table public.businesses drop constraint businesses_classification_fk;
--   drop trigger businesses_validate_secondary_types on public.businesses;
--   drop function public.validate_business_secondary_types();
--   update public.businesses set category = category_source;
--   alter table public.businesses alter column category drop not null;
--   alter table public.businesses
--     drop column business_type, drop column secondary_types,
--     drop column tags, drop column category_source;
--   drop table public.business_types;
--   drop table public.business_categories;
--   commit;
--
-- Verification
-- ---------------------------------------------------------------------------
--   select category, business_type, count(*) from public.businesses
--     group by 1,2 order by 3 desc;
--
--   -- must be rejected by businesses_classification_fk:
--   update public.businesses set category='shopping', business_type='pub'
--    where id = (select id from public.businesses limit 1);

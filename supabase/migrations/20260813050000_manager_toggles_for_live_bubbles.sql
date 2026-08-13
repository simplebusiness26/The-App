-- Two switches a Manager owns, and nothing else changes.
--
-- The map is getting live bubbles: a small thing that fades in over a pin, says
-- one true sentence, and fades out. Two of the four kinds are a Manager's to
-- turn on, because they are claims about a place the Manager runs and nobody
-- else can know whether they are true.
--
--   activity_clubs.spaces_available   "Spaces open"
--   properties.show_availability      "Available" / "Room available" / "2 rooms"
--
-- BOTH DEFAULT TO FALSE. A flag that surfaces a listing on the map more
-- prominently is opt-in, the same way every visibility flag in this app is
-- opt-in. Nobody's club starts advertising space because a migration ran.
--
-- OFF REMOVES THE BUBBLE, NEVER THE PIN. These decide whether something is
-- ELIGIBLE to surface. A club with the switch off is still on the map, still
-- searchable, still joinable -- it simply does not shout.
--
-- NO INVENTED INVENTORY. properties.rooms_available is nullable and stays null
-- unless a Manager fills it in; utils/liveBubbles.js says "Available" when it
-- does not know a number rather than making one up. There is no booking system
-- here and this does not pretend there is one.
--
-- WHO CAN SET THEM: exactly who can already edit the listing. The existing
-- update policies on both tables are owner/manager-only, and adding a column
-- does not change them -- which is why there is no new policy below. A column
-- that needed its own rule would be a sign it did not belong on this table.

begin;

alter table public.activity_clubs
  add column if not exists spaces_available boolean not null default false;

comment on column public.activity_clubs.spaces_available is
  'Manager switch: may this club surface a "Spaces open" bubble on the map. Off by default. Off removes the bubble, never the pin.';

alter table public.properties
  add column if not exists show_availability boolean not null default false;

alter table public.properties
  add column if not exists rooms_available integer;

alter table public.properties
  add constraint properties_rooms_available_sane
  check (rooms_available is null or (rooms_available >= 0 and rooms_available <= 99));

comment on column public.properties.show_availability is
  'Manager switch: may this property surface an availability bubble on the map. Off by default.';

comment on column public.properties.rooms_available is
  'Optional, and null means "not stated" rather than zero. The map says "Available" without a number rather than inventing one -- there is no inventory system behind this.';

commit;

-- The places you can actually check in at.
--
-- WHY THIS EXISTS
-- Checking in is public-places-only (Packet 8: app/checkins/create.js refuses a
-- check-in without a public_place_id). public_places held exactly one row --
-- "Alexander park", with no coordinates -- so the whole half of the core loop
-- that starts with "I am here" had one option, spelled wrong, that could not be
-- drawn on a map. This is reference data, not seed data: it is the same in
-- every environment and it is what the feature reads, so it belongs in a
-- migration rather than in a one-off script somebody has to remember to run.
--
-- THE COORDINATES
-- Hand-entered, accurate to roughly a street rather than to a gatepost. That is
-- the right precision for this table: a pin marks which park you mean, and
-- check-in coordinates are rounded to two decimal places before storage anyway
-- (app/checkins/create.js). Anything needing survey accuracy should be
-- corrected in the admin place editor, not assumed correct because it shipped.
--
-- THE EXISTING ROW
-- "Alexander park" is renamed to "Alexandra Park" and given coordinates rather
-- than being replaced. It keeps its id, so anything already pointing at it --
-- check-ins, Moments, follows -- keeps pointing at it.
--
-- IDEMPOTENT
-- Every insert is guarded by a name-and-area existence test rather than an
-- ON CONFLICT clause, because the uniqueness here is two partial indexes over
-- an expression and inference against those is easy to get subtly wrong.
-- Re-applying this file changes nothing.

begin;

-- ---------------------------------------------------------------------------
-- 1. The one row that was already there
-- ---------------------------------------------------------------------------

update public.public_places p
set name='Alexandra Park',
    place_type='park',
    latitude=50.8686,
    longitude=0.5747,
    location_description=case when btrim(p.location_description)='' then 'St Helens Road, Hastings' else p.location_description end,
    description=case when btrim(p.description)='' then 'Hastings'' largest park: a long green valley of ponds, lawns and woodland running north from the town centre.' else p.description end
from public.geo_areas a
where p.area_id=a.id
  and a.slug='hastings'
  and lower(btrim(p.name))='alexander park';

-- ---------------------------------------------------------------------------
-- 2. The launch places
-- ---------------------------------------------------------------------------
-- Public, outdoor and open to anybody: parks, beaches, seafront landmarks and
-- viewpoints. No pubs, no cafes, no shops -- those are businesses and they
-- belong in the businesses table with an owner who can claim them.

with candidate(area_slug,name,place_type,latitude,longitude,location_description,description) as (
  values
    -- Hastings
    ('hastings','Hastings Pier','landmark',50.8534,0.5769,'White Rock, Hastings seafront','The rebuilt pier: an open deck, a wide view back along the seafront and space to sit.'),
    ('hastings','Hastings Castle','landmark',50.8570,0.5836,'Castle Hill Road, West Hill','The Norman castle ruins on West Hill, above the Old Town, with the best view over the whole bay.'),
    ('hastings','West Hill','viewpoint',50.8566,0.5860,'Above the Old Town, reached by the West Hill Lift','Open clifftop grass above the Old Town. Kite flying, dog walking and the long view west.'),
    ('hastings','East Hill','viewpoint',50.8577,0.5950,'Above the Stade, reached by the East Hill Lift','The steep green hill at the far end of the Old Town, where the town stops and the Country Park begins.'),
    ('hastings','Hastings Country Park','nature_area',50.8720,0.6280,'Fairlight Road, east of Hastings','Six hundred acres of clifftop gorse, glens and sea path running east towards Fairlight.'),
    ('hastings','The Stade','public_square',50.8552,0.5930,'Rock-a-Nore Road, Old Town','The working fishing beach and the open square beside it, under the tall black net shops.'),
    ('hastings','Pelham Beach','beach',50.8524,0.5875,'Below Pelham Crescent, central seafront','Shingle beach in the middle of town, between the pier and the Old Town.'),
    ('hastings','Bohemia Walled Garden','park',50.8570,0.5610,'Summerfields, Bohemia','A small restored walled garden, quiet and enclosed, a short walk from the town centre.'),

    -- St Leonards-on-Sea
    ('st-leonards-on-sea','St Leonards Gardens','park',50.8563,0.5540,'Maze Hill, St Leonards-on-Sea','A steep Regency pleasure garden of lawns, ponds and old trees behind the seafront.'),
    ('st-leonards-on-sea','Warrior Square Gardens','park',50.8524,0.5567,'Warrior Square, St Leonards-on-Sea','The formal square between the station and the sea, with benches and a central lawn.'),
    ('st-leonards-on-sea','Gensing Gardens','park',50.8578,0.5507,'Brittany Road, St Leonards-on-Sea','A neighbourhood park with a bandstand, a bowling green and a good deal of shade.'),
    ('st-leonards-on-sea','Bottle Alley','landmark',50.8512,0.5600,'Lower promenade, St Leonards seafront','The covered lower promenade, its walls set with broken glass. Dry in the rain and long enough for a proper walk.'),
    ('st-leonards-on-sea','St Leonards Beach','beach',50.8503,0.5530,'Marina, St Leonards-on-Sea','A quieter stretch of shingle west of the pier, in front of Marine Court.'),

    -- Brighton
    ('brighton','Preston Park','park',50.8425,-0.1467,'Preston Road, Brighton','The city''s biggest park: cricket, tennis, a velodrome and the rock garden across the road.'),
    ('brighton','The Level','park',50.8318,-0.1355,'Union Road, Brighton','A flat central park with a skate park, fountains and a playground, between Kemptown and the London Road.'),
    ('brighton','Queen''s Park','park',50.8250,-0.1250,'East Drive, Brighton','A hillside park with a pond, a wide lawn and a view down towards the sea.'),
    ('brighton','St Ann''s Well Gardens','park',50.8300,-0.1607,'Somerhill Road, Hove','A wooded Hove park with a scented garden, a cafe and tennis courts.'),
    ('brighton','Royal Pavilion Garden','park',50.8229,-0.1379,'Pavilion Buildings, Brighton','The Regency garden wrapped around the Pavilion, in the middle of the city.'),
    ('brighton','Hove Lawns','park',50.8256,-0.1602,'Kingsway, Hove','A long strip of open grass between the Hove seafront road and the beach.'),
    ('brighton','Stanmer Park','nature_area',50.8639,-0.0917,'Lewes Road, north of Brighton','Five hundred acres of downland, woods and an estate village on the northern edge of the city.'),
    ('brighton','Devil''s Dyke','viewpoint',50.8853,-0.2141,'Devil''s Dyke Road, north of Brighton','The deepest dry valley in the country, on the Downs above the city, with a view across the Weald.'),
    ('brighton','Brighton Palace Pier','landmark',50.8161,-0.1367,'Madeira Drive, Brighton seafront','The pier at the end of the Old Steine: arcades, rides and the walk out over the water.'),
    ('brighton','Brighton Beach','beach',50.8180,-0.1370,'Between the piers, Brighton seafront','The central stretch of shingle, busiest between the Palace Pier and the i360.'),
    ('brighton','Hove Beach','beach',50.8221,-0.1697,'Below Hove Lawns, Kingsway','A calmer stretch of shingle in front of the beach huts, west of the city centre.'),
    ('brighton','Brighton Marina','attraction',50.8117,-0.1024,'Brighton Marina Village','The harbour east of Kemptown: boardwalk, boats and the undercliff path back into town.')
)
insert into public.public_places(name,place_type,area_id,latitude,longitude,location_description,description,status)
select c.name,c.place_type,a.id,c.latitude,c.longitude,c.location_description,c.description,'published'
from candidate c
join public.geo_areas a on a.slug=c.area_slug
where not exists(
  select 1 from public.public_places existing
  where existing.area_id=a.id
    and lower(btrim(existing.name))=lower(btrim(c.name))
);

commit;

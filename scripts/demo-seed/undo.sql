-- Removes everything scripts/demo-seed/seed.sql wrote.
--
-- Every seeded row carries a `deadbeef-…` UUID prefix, so the deletes are exact:
-- nothing keyed on content, nothing keyed on a date range, nothing that could
-- take a real row with it. Run the whole file; it is one transaction.
--
-- Order matters only where a foreign key would block: review media and social
-- interactions go before the reviews and Moments they hang off. The triggers
-- do the rest -- deleting a review recalculates the listing's rating, and
-- deleting a Moment cleans up its likes and comments -- but the explicit
-- deletes below run first so the result does not depend on that.

begin;

-- Notifications the social triggers raised for seeded activity. Keyed on the
-- dedupe_key, which embeds the id of the row that caused it.
delete from public.notifications
where dedupe_key like '%deadbeef-%';

delete from public.social_comments  where id::text like 'deadbeef-%';
delete from public.social_likes     where id::text like 'deadbeef-%';
delete from public.explorer_favourites where id::text like 'deadbeef-%';
delete from public.review_media     where id::text like 'deadbeef-%';
delete from public.explorer_moments where id::text like 'deadbeef-%';
delete from public.explorer_reviews where id::text like 'deadbeef-%';
delete from public.explorer_memories where id::text like 'deadbeef-%';
delete from public.live_checkins    where id::text like 'deadbeef-%';
delete from public.linkup_attendees where id::text like 'deadbeef-%';
delete from public.linkups          where id::text like 'deadbeef-%';
delete from public.explorer_follows where id::text like 'deadbeef-%';

-- The six renamed demo accounts, back to what they were called.
update public.profiles p set full_name = d.name
from (values
  ('business@business.com','Test business owner'),
  ('business@teser.com','Business tester'),
  ('guest@guestbook.com','Guest test'),
  ('ladnlord@landlord.com','Property'),
  ('property@property.com','Property'),
  ('tester@guestbook.com','Account with phone')
) as d(email,name)
where p.email = d.email;

-- Seeded profile pictures are the only ones matching this URL shape; a picture
-- somebody actually uploaded lives in Supabase Storage and is left alone.
update public.profiles
set profile_photo = null
where profile_photo like 'https://picsum.photos/seed/xplorer-%';

commit;

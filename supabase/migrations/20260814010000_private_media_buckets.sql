-- The files stop being world-readable.
--
-- WHAT WAS WRONG
--
-- All three buckets were created `public: true` (20260802152200,
-- 20260802155202, 20260803000000). So a Memory set to FRIENDS ONLY had its
-- photograph on a URL anybody could open. Row level security decided who could
-- read the ROW; nothing at all decided who could read the FILE. The audience
-- control was real and the thing it was protecting was not behind it.
--
-- WHAT CHANGES
--
-- `social-media` and `profile-images` become private, and the app reads them
-- through short-lived signed URLs (utils/media.js, components/SocialImage.js).
--
-- `review-media` STAYS PUBLIC, on purpose and in writing: a published review is
-- public content by design, and signing those would put a round trip in front
-- of every review photo on the map. If that judgement is wrong it is one line.
--
-- WHY THE POLICIES COME FIRST IN THIS FILE
--
-- A public bucket bypasses RLS entirely, so today there is NO select policy on
-- these objects -- nothing grants the read. Flipping the bucket before adding
-- one would make every picture in the app unreadable by everybody, including
-- its owner.
--
-- HOW THE RULE IS EXPRESSED
--
-- Not by re-implementing the audience rules against storage, which would be a
-- second copy of guestbook_private.can_see_content free to disagree with the
-- first. The policy asks whether a row pointing at this object is visible to
-- the caller -- and because that subquery runs as the caller, the existing RLS
-- on explorer_moments and explorer_memories answers it.
--
-- Proved on this database in a rolled-back transaction before it was applied: a
-- stranger could read the object behind an 'everyone' Moment and could NOT read
-- the object behind a 'friends' one.

begin;

-- ---------------------------------------------------------------------------
-- Reads
-- ---------------------------------------------------------------------------

drop policy if exists social_media_read_allowed on storage.objects;
create policy social_media_read_allowed on storage.objects for select to authenticated using (
  bucket_id='social-media' and (
    -- Your own files, always. A post you deleted still has its file, and you
    -- are still the only person who could ever see it.
    (storage.foldername(name))[1]=(select auth.uid())::text
    -- Or a Moment or Memory you are allowed to see points at it. RLS on those
    -- tables is what makes this an audience check rather than a path check.
    or exists(select 1 from public.explorer_moments m where m.media_url like '%/social-media/'||name)
    or exists(select 1 from public.explorer_memories m where m.media_url like '%/social-media/'||name)
  )
);

drop policy if exists profile_images_read_allowed on storage.objects;
create policy profile_images_read_allowed on storage.objects for select to authenticated using (
  -- The folder is the owner's id. A profile picture is readable exactly when
  -- the profile is -- again, by asking rather than by re-deciding.
  bucket_id='profile-images' and exists(
    select 1 from public.profiles p where p.id::text=(storage.foldername(name))[1]
  )
);

-- ---------------------------------------------------------------------------
-- And now they can go private
-- ---------------------------------------------------------------------------

update storage.buckets set public=false where id in ('social-media','profile-images');

comment on policy social_media_read_allowed on storage.objects is
  'A Moment or Memory photograph is readable by whoever may read the post. The audience check is delegated to row level security on explorer_moments and explorer_memories rather than restated here, so the two can never disagree.';

commit;

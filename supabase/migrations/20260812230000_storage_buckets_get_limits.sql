-- Storage buckets: a size limit and an allow-list on the two that had neither.
--
-- `profile-images` and `review-image` accepted any file, of any size, from any
-- signed-in Explorer. That is an abuse vector and a bill rather than a privacy
-- hole, and unlike the privacy half it can be fixed with no effect on anything
-- already stored.
--
-- WHAT THIS DELIBERATELY DOES NOT DO
--
-- All four buckets are still PUBLIC, and that is the real finding from the
-- audit: `social-media` holds Moment and Memory media, whose rows are protected
-- by row level security and whose audience an Explorer chooses -- but the image
-- itself sits behind a public URL. Anyone holding that URL can fetch it whether
-- or not they may see the post, and narrowing a post's audience does not take
-- the picture back.
--
-- Fixing it properly means: private buckets, the object PATH stored rather than
-- an absolute URL, and a signed URL minted at read time. That is eight render
-- sites across six files, plus expiry handling, plus what a list does when
-- thirty signed URLs go stale mid-scroll. It is the right shape and it is not a
-- change to make unattended and unverified -- a mistake there empties every
-- image in the app rather than failing loudly.
--
-- So it is written down instead of half-done. The exposure it leaves is
-- second-order: the URLs are unguessable (uuid plus timestamp plus random), so
-- it needs somebody who already had the link. Worth closing, not worth guessing
-- at in the dark.

update storage.buckets
set file_size_limit = 10485760,   -- 10 MB: a profile photo
    allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic']
where id = 'profile-images';

update storage.buckets
set file_size_limit = 52428800,   -- 50 MB, matching review-media and social-media
    allowed_mime_types = array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime','video/webm']
where id = 'review-image';

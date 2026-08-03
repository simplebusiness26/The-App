-- Declares the `profile-images` storage bucket.
--
-- This bucket was created by hand in the Supabase dashboard and was never captured
-- in a migration, so a freshly provisioned project had no bucket for avatar uploads
-- and app/profile/edit.js would fail on save. Codifying it here makes the bucket
-- reproducible on any new project.
--
-- Access pattern (app/profile/edit.js): objects are uploaded to `<auth.uid()>/profile-<ts>.<ext>`
-- with upsert:true and read back via getPublicUrl, so the bucket is public for reads
-- and writes are restricted to the owner's own top-level folder. Policies mirror the
-- `review-media` and `social-media` buckets.

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('profile-images','profile-images',true,52428800,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists profile_images_insert_own on storage.objects;
drop policy if exists profile_images_update_own on storage.objects;
drop policy if exists profile_images_delete_own on storage.objects;

create policy profile_images_insert_own on storage.objects for insert to authenticated with check (
  bucket_id='profile-images' and (storage.foldername(name))[1]=(select auth.uid())::text
);
create policy profile_images_update_own on storage.objects for update to authenticated using (
  bucket_id='profile-images' and (storage.foldername(name))[1]=(select auth.uid())::text
) with check (
  bucket_id='profile-images' and (storage.foldername(name))[1]=(select auth.uid())::text
);
create policy profile_images_delete_own on storage.objects for delete to authenticated using (
  bucket_id='profile-images' and (storage.foldername(name))[1]=(select auth.uid())::text
);

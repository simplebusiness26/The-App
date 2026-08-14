import {supabase} from "../services/supabase";

// Showing a picture that is not world-readable.
//
// WHAT WAS WRONG
//
// All three storage buckets were created `public: true` (20260802152200,
// 20260802155202, 20260803000000). So a Memory set to FRIENDS ONLY had its
// photograph sitting on a URL anybody could open. The audience control on the
// post was real; the file behind it was not. Row level security decided who
// could read the ROW and nothing at all decided who could read the FILE.
//
// HOW IT IS FIXED
//
// `social-media` and `profile-images` become private, and reads go through a
// short-lived signed URL. `review-media` stays public on purpose: a published
// review is public content, and signing those would put a round trip in front
// of every review photo on the map.
//
// WHY THIS IS SAFE TO SHIP BEFORE THE BUCKETS FLIP
//
// createSignedUrl works on a public bucket exactly as it does on a private one.
// So the app learns to sign first, that gets proved, and flipping the bucket is
// a separate step that changes nothing about how the app behaves. Doing it the
// other way round would break every image in the app between the two commits.
//
// AND WHY A FAILURE FALLS BACK RATHER THAN BLANKS
//
// If signing fails -- offline, an expired session, a path this cannot parse --
// the original URL is returned. On a public bucket that still works; on a
// private one it 404s and shows the same empty frame a broken signature would.
// Neither is worse than a component that renders nothing, and one of them is a
// picture.

// Buckets whose contents are decided by an audience, and therefore need signing.
export const PRIVATE_BUCKETS=["social-media","profile-images"];

// How long a signed URL lasts. Long enough to scroll a feed and open something
// from it; short enough that a URL copied out of a page is not a permanent key.
export const SIGNED_URL_SECONDS=60*60;

// Re-signed a little before it expires, so a long session never shows a frame
// that has just gone stale.
const REFRESH_MARGIN_MS=5*60*1000;

// The path inside the bucket, out of a full public URL.
//
// Rows written before this change hold
// `https://<ref>.supabase.co/storage/v1/object/public/<bucket>/<path>`; rows
// written after it hold the path on its own. Both shapes have to be readable,
// because the old ones are in the database and are not going anywhere.
export function storagePathFrom(value,bucket){
  const text=String(value || "").trim();
  if(!text) return null;

  const marker=`/storage/v1/object/public/${bucket}/`;
  const index=text.indexOf(marker);
  if(index>=0) return decodeURIComponent(text.slice(index+marker.length));

  // A signed URL for the same object, which can happen when one is round
  // tripped through state. `?token=` and everything after it is not the path.
  const signed=`/storage/v1/object/sign/${bucket}/`;
  const signedIndex=text.indexOf(signed);
  if(signedIndex>=0){
    return decodeURIComponent(text.slice(signedIndex+signed.length).split("?")[0]);
  }

  // Not a URL at all, so it is already a path. Anything with a scheme is
  // somebody else's URL and is left alone.
  if(/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) return null;
  return text;
}

export function bucketFor(value){
  for(const bucket of PRIVATE_BUCKETS){
    if(String(value || "").includes(`/${bucket}/`)) return bucket;
  }
  return null;
}

// One cache for the whole app. A feed shows twenty pictures and a profile
// shows a gallery of them; signing each one on every render would be a request
// per image per scroll.
const cache=new Map();

export function clearSignedUrlCache(){
  cache.clear();
}

export async function signedUrlFor(bucket,path,{seconds=SIGNED_URL_SECONDS}={}){
  if(!bucket || !path) return null;

  const key=`${bucket}:${path}`;
  const held=cache.get(key);
  if(held && held.expires>Date.now()+REFRESH_MARGIN_MS) return held.url;

  const {data,error}=await supabase.storage.from(bucket).createSignedUrl(path,seconds);
  if(error || !data?.signedUrl) return null;

  cache.set(key,{url:data.signedUrl,expires:Date.now()+seconds*1000});
  return data.signedUrl;
}

// What to actually put in an <Image>. Takes whatever the database holds -- a
// full public URL from before this change, or a bare path from after it -- and
// returns something displayable.
export async function displayUrlFor(value,{bucket}={}){
  const text=String(value || "").trim();
  if(!text) return null;

  const which=bucket || bucketFor(text);
  if(!which || !PRIVATE_BUCKETS.includes(which)) return text;

  const path=storagePathFrom(text,which);
  if(!path) return text;

  return (await signedUrlFor(which,path)) || text;
}

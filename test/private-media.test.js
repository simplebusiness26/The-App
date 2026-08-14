/* eslint-env jest */

// The files stop being world-readable.
//
// All three buckets were created `public: true`. So a Memory set to FRIENDS
// ONLY had its photograph on a URL anybody could open: row level security
// decided who could read the ROW, and nothing at all decided who could read the
// FILE. The audience control was real and the thing it protected was not behind
// it.
//
// The database half is proved against the live project in
// 20260814010000_private_media_buckets.sql -- a stranger can read the object
// behind an 'everyone' Moment and cannot read the one behind a 'friends'
// Moment. This is the app half.

const React=require("react");
const {act,create}=require("react-test-renderer");
const fs=require("fs");
const path=require("path");
const {supabase}=require("../services/supabase");
const media=require("../utils/media");

const PUBLIC_URL="https://ref.supabase.co/storage/v1/object/public/social-media/user-1/shot.jpg";
const SIGNED_URL="https://ref.supabase.co/storage/v1/object/sign/social-media/user-1/shot.jpg?token=abc";

beforeEach(()=>{
  media.clearSignedUrlCache();
  supabase.storage.from.mockClear?.();
});

// ---------------------------------------------------------------------------
// Reading the path back out
// ---------------------------------------------------------------------------

test("the path is recovered from a public URL, a signed URL, or a bare path",()=>{
  // Rows written before this change hold a full public URL; rows written after
  // it hold the path. Both are in the database and neither is going anywhere.
  expect(media.storagePathFrom(PUBLIC_URL,"social-media")).toBe("user-1/shot.jpg");
  expect(media.storagePathFrom(SIGNED_URL,"social-media")).toBe("user-1/shot.jpg");
  expect(media.storagePathFrom("user-1/shot.jpg","social-media")).toBe("user-1/shot.jpg");
});

test("somebody else's URL is left alone, not treated as a path",()=>{
  // A place's photo can be any URL on the internet. Signing it would produce a
  // path that means nothing and a request that fails.
  expect(media.storagePathFrom("https://example.com/a.jpg","social-media")).toBeNull();
  expect(media.storagePathFrom("","social-media")).toBeNull();
  expect(media.storagePathFrom(null,"social-media")).toBeNull();
});

test("only the buckets that carry audience-controlled content are signed",()=>{
  // review-media stays public on purpose: a published review is public content,
  // and signing it would put a round trip in front of every review photo on the
  // map. Written down rather than left looking like an oversight.
  expect(media.PRIVATE_BUCKETS).toEqual(["social-media","profile-images"]);
  expect(media.PRIVATE_BUCKETS).not.toContain("review-media");
});

// ---------------------------------------------------------------------------
// Signing
// ---------------------------------------------------------------------------

function stubStorage(result){
  const createSignedUrl=jest.fn(async()=>result);
  supabase.storage.from=jest.fn(()=>({createSignedUrl}));
  return createSignedUrl;
}

test("a stored public URL becomes a signed one",async()=>{
  stubStorage({data:{signedUrl:SIGNED_URL},error:null});
  expect(await media.displayUrlFor(PUBLIC_URL)).toBe(SIGNED_URL);
});

test("twenty pictures do not become twenty requests",async()=>{
  // A feed shows twenty and a profile shows a gallery. Signing on every render
  // is a request per image per scroll -- the mistake app/feed.js made with
  // LikeButton and paid for in a crawling feed.
  const createSignedUrl=stubStorage({data:{signedUrl:SIGNED_URL},error:null});

  await media.displayUrlFor(PUBLIC_URL);
  await media.displayUrlFor(PUBLIC_URL);
  await media.displayUrlFor(PUBLIC_URL);

  expect(createSignedUrl).toHaveBeenCalledTimes(1);
});

test("a URL copied out of a page is not a permanent key",()=>{
  // Long enough to scroll a feed and open something from it; short enough that
  // a link shared out of the app stops working.
  expect(media.SIGNED_URL_SECONDS).toBeLessThanOrEqual(60*60*4);
  expect(media.SIGNED_URL_SECONDS).toBeGreaterThan(60);
});

test("a failure falls back to the stored value rather than to nothing",async()=>{
  // On a public bucket that still works; on a private one it shows the same
  // empty frame a broken signature would. Neither is worse than a component
  // that renders nothing, and one of them is a picture.
  stubStorage({data:null,error:{message:"offline"}});
  expect(await media.displayUrlFor(PUBLIC_URL)).toBe(PUBLIC_URL);
});

test("a picture that is not ours is never sent to be signed",async()=>{
  const createSignedUrl=stubStorage({data:{signedUrl:SIGNED_URL},error:null});
  expect(await media.displayUrlFor("https://example.com/a.jpg")).toBe("https://example.com/a.jpg");
  expect(createSignedUrl).not.toHaveBeenCalled();
});

// ---------------------------------------------------------------------------
// The component
// ---------------------------------------------------------------------------

test("SocialImage signs what it is given and draws the result",async()=>{
  stubStorage({data:{signedUrl:SIGNED_URL},error:null});
  const SocialImage=require("../components/SocialImage").default;

  let tree;
  await act(async()=>{tree=create(React.createElement(SocialImage,{uri:PUBLIC_URL}));});
  await act(async()=>{});

  expect(JSON.stringify(tree.toJSON())).toContain("token=abc");
  await act(async()=>{tree.unmount();});
});

test("nothing to show is nothing drawn, not a broken frame",async()=>{
  const SocialImage=require("../components/SocialImage").default;

  let tree;
  await act(async()=>{tree=create(React.createElement(SocialImage,{uri:null}));});
  expect(tree.toJSON()).toBeNull();
  await act(async()=>{tree.unmount();});
});

// ---------------------------------------------------------------------------
// Nowhere is left behind
// ---------------------------------------------------------------------------

test("no screen draws a private-bucket picture with a raw Image",()=>{
  // There are about twenty of these. Signing in each would be twenty chances to
  // forget, and forgetting is INVISIBLE: the picture still appears while the
  // bucket is public and disappears the day it is not.
  const root=path.resolve(__dirname,"..");
  const offenders=[];

  const walk=(dir)=>{
    for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
      const full=path.join(dir,entry.name);
      if(entry.isDirectory()){walk(full);continue;}
      if(!entry.name.endsWith(".js")) continue;
      if(full.endsWith("components/SocialImage.js")) continue;

      const source=fs.readFileSync(full,"utf8")
        .replace(/\/\*[\s\S]*?\*\//g,"").replace(/(^|[^:])\/\/.*$/gm,"$1");

      for(const match of source.matchAll(/<Image[\s\S]{0,160}?\/>/g)){
        if(/media_url|target_image_url|thumbnail_url|avatar_url/.test(match[0])){
          offenders.push(`${path.relative(root,full)}: ${match[0].split("\n")[0].trim()}`);
        }
      }
    }
  };

  walk(path.join(root,"app"));
  walk(path.join(root,"components"));

  expect(offenders).toEqual([]);
});

test("the migration adds the read policies BEFORE it makes the buckets private",()=>{
  // A public bucket bypasses RLS entirely, so there is no select policy today.
  // Flipping first would make every picture unreadable by everybody, including
  // its owner.
  // SQL comments stripped: the file explains at length what it is NOT doing,
  // and a check that reads its own reasoning fails on a correct file.
  const sql=fs.readFileSync(
    path.join(path.resolve(__dirname,".."),"supabase","migrations",
      "20260814010000_private_media_buckets.sql"),"utf8"
  ).replace(/^\s*--.*$/gm,"");

  expect(sql.indexOf("create policy social_media_read_allowed"))
    .toBeLessThan(sql.indexOf("set public=false"));

  // And the audience check is DELEGATED, not restated. A second copy of the
  // rules against storage would be free to disagree with the first.
  expect(sql).toMatch(/from public\.explorer_moments/);
  expect(sql).toMatch(/from public\.explorer_memories/);
  expect(sql).not.toMatch(/can_see_content/);

  // review-media is deliberately not in the list.
  expect(sql).toMatch(/set public=false where id in \('social-media','profile-images'\)/);
});

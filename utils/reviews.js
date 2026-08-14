import {supabase} from "../services/supabase";

// Reading reviews. One table, one loader, one shape.
//
// WHY THIS EXISTS
//
// Writing a review has been unified for a while: all four review routes are
// eight-line wrappers around components/ExplorerReviewForm, which writes to
// public.explorer_reviews. Reading was not. Each place page read a different
// table:
//
//   app/business/[id].js:47        -> reviews
//   app/property/[id].js:43        -> reviews
//   app/activity-clubs/[id].js:81  -> activity_club_reviews
//   app/events/[id].js:51          -> event_reviews
//
// Those three are copies, written by sync_explorer_review_to_legacy()
// (20260802152100:267-342) and sharing primary keys with the real row. They
// exist because they carry a flattened shape the place cards were built
// against: photos as a text array on the row, the reviewer's name denormalised,
// and the title under a different column name.
//
// So the copies were never really about storage. They were a view, maintained
// by a trigger. This module is that view, computed at read time from the one
// canonical table, which is what lets the copies be dropped.
//
// WHAT IT DOES NOT DO
//
// It does not re-key anything. explorer_score_events.source_id points at
// explorer_reviews.id with no foreign key and a unique constraint on
// (source, source_id) (20260810040000:55-67), and the backfill set every row's
// awarded_on from its own historical date. Changing a review's id would break
// the scoring ledger silently.

// The place cards read these names. Keeping the legacy field names rather than
// renaming them across four screens keeps this change to the read path only --
// the shape is the compatibility layer, and it is the whole point.
function toCardShape(review,mediaForReview,reviewerName){
  const images=mediaForReview
    .filter((item)=>item.media_type==="image" && item.moderation_status==="published")
    .sort((a,b)=>(a.sort_order||0)-(b.sort_order||0))
    .map((item)=>item.media_url);

  const video=mediaForReview
    .find((item)=>item.media_type==="video" && item.moderation_status==="published");

  return{
    id:review.id,
    user_id:review.user_id,
    rating:review.rating,
    comment:review.comment,
    created_at:review.created_at,
    verified_qr:review.verified_qr,
    points_awarded:review.points_awarded,

    // Renamed on the way out, not in the table.
    review_title:review.title,
    name:reviewerName,
    photos:images,
    video_url:video?.media_url || null,
    video_thumbnail_url:video?.thumbnail_url || null,

    // Carried through so a manager reply renders. These live on
    // explorer_reviews now; before Packet 10 they existed only on the untracked
    // legacy `reviews` table, which is why a property review was being written
    // with a column called business_response.
    manager_response:review.manager_response || "",
    challenged:!!review.challenged,
    challenge_reason:review.challenge_reason || ""
  };
}

// Every review written about one place, club or event, newest first.
//
// targetType is one of business, property, activity_club, event, public_place.
// public_place joined the list in 20260811140000 -- parks could not be reviewed
// at all before that, because there was no public_place_reviews table for a
// place page to read.
export async function loadPlaceReviews(targetType,targetId){
  if(!targetId) return{reviews:[],error:null};

  const {data:rows,error}=await supabase
    .from("explorer_reviews")
    .select("*")
    .eq("target_type",targetType)
    .eq("target_id",targetId)
    .eq("status","published")
    .order("created_at",{ascending:false});

  if(error) return{reviews:[],error};
  if(!rows?.length) return{reviews:[],error:null};

  const reviewIds=rows.map((row)=>row.id);
  const authorIds=[...new Set(rows.map((row)=>row.user_id))];

  // Two follow-up reads rather than a join, because PostgREST embedding across
  // explorer_reviews -> profiles needs a foreign key the copies never had.
  const [mediaResult,profileResult]=await Promise.all([
    supabase
      .from("review_media")
      .select("review_id,media_type,media_url,thumbnail_url,sort_order,moderation_status")
      .in("review_id",reviewIds),
    supabase
      .from("profiles")
      .select("id,full_name")
      .in("id",authorIds)
  ]);

  const mediaByReview=new Map();
  for(const item of mediaResult.data || []){
    const list=mediaByReview.get(item.review_id) || [];
    list.push(item);
    mediaByReview.set(item.review_id,list);
  }

  const nameById=new Map(
    (profileResult.data || []).map((row)=>[row.id,row.full_name])
  );

  return{
    reviews:rows.map((row)=>toCardShape(
      row,
      mediaByReview.get(row.id) || [],
      nameById.get(row.user_id) || "Explorer"
    )),
    error:null
  };
}

// Just the score, for the map panel.
//
// The place PAGES load every review with its photos, its reviewer and its
// manager reply, because that is what they show. Tapping a pin only needs two
// numbers, and pulling a page's worth of rows to compute them would make the
// panel slow at the exact moment it has to feel instant.
//
// NOT businesses.review_count. That column exists and is not maintained --
// 20260803212705_enable_rls_businesses_properties.sql:25 says so in as many
// words -- so reading it would show a number that is quietly wrong.
//
// A failure is not an error here. A panel with no score is fine; a panel that
// refuses to open because a count did not come back is not.
export async function loadPlaceRating(targetType,targetId){
  if(!targetType || !targetId) return {average:null,count:0};

  const {data,error}=await supabase
    .from("explorer_reviews")
    .select("rating")
    .eq("target_type",targetType)
    .eq("target_id",targetId)
    .eq("status","published");

  if(error || !data?.length) return {average:null,count:0};

  return {average:averageRating(data),count:data.length};
}

// Scores for a whole screen of cards, in ONE query.
//
// Discover shows thirty-odd cards and every one of them carries a review score.
// Asking per card is thirty round trips on a screen that has to feel instant,
// and it is the mistake app/feed.js made with LikeButton -- forty cards, forty
// auth.getUser() calls, and a feed that crawled.
//
// Keyed `type:id`, which is the same shape utils/bubbleCandidates.js uses to
// look a listing up. The map's word for a club and a review's word for it
// differ, so callers pass reviewTargetType() -- see utils/placeCards.js.
export async function loadPlaceRatings(targets){
  const wanted=(targets || []).filter((target)=>target?.type && target?.id);
  if(!wanted.length) return new Map();

  const {data,error}=await supabase
    .from("explorer_reviews")
    .select("target_type,target_id,rating")
    .in("target_id",[...new Set(wanted.map((target)=>target.id))])
    .eq("status","published");

  // No scores is a card without a score, not a screen that refuses to load.
  if(error || !data) return new Map();

  const byTarget=new Map();
  for(const row of data){
    const key=`${row.target_type}:${row.target_id}`;
    const found=byTarget.get(key) || [];
    found.push(row);
    byTarget.set(key,found);
  }

  const scores=new Map();
  for(const [key,rows] of byTarget){
    scores.set(key,{average:averageRating(rows),count:rows.length});
  }
  return scores;
}

// The average a place page shows next to its rating. Kept here so four screens
// cannot round it four different ways.
export function averageRating(reviews){
  if(!reviews.length) return null;
  const total=reviews.reduce((sum,item)=>sum+Number(item.rating || 0),0);
  return (total/reviews.length).toFixed(1);
}

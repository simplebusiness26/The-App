import {
  reviewIsEligible,
  clubIsEligible,
  propertyIsEligible,
  propertyAvailabilityText,
  eventBubbleText,
  eventDeservesCelebration
} from "./liveBubbles";

// Turning what is on the map into things that MIGHT bubble.
//
// Separate from utils/liveBubbles.js on purpose. That file answers "which three
// of these, right now" and knows nothing about businesses or reviews; this one
// knows the shapes of the app's rows and knows nothing about rotation, viewport
// or collision. Neither can quietly grow into the other.
//
// MOMENTS ARE NOT HERE, and their absence is the point. A Moment is "what is
// happening here now?", which is a density question -- it belongs to the
// heatmap. There are more Moments than everything else combined, so letting
// them into the rotation would mean nothing else was ever seen.

export function candidatesFrom({places=[],activity=[],reviewShots=[],now=Date.now(),appearance={},confetti=[]}={}){
  const candidates=[];

  const chrome=appearance;

  // Somewhere to look up a listing's position, so a review knows where its
  // photo goes without every review carrying coordinates of its own.
  //
  // The map calls a club "club" (CARD_KINDS in utils/placeCards.js) and a
  // review calls the same thing "activity_club". Translated here, once, rather
  // than in every lookup -- the two names are real and neither is wrong.
  const REVIEW_TARGET={business:"business",property:"property",club:"activity_club"};

  const positions=new Map();
  for(const place of places){
    if(!place?.kind || !place?.id) continue;
    const targetType=REVIEW_TARGET[place.kind] || place.kind;
    positions.set(`${targetType}:${place.id}`,place);
  }

  // --- clubs and properties: a Manager's switch ----------------------------
  for(const place of places){
    if(place.kind==="club" && clubIsEligible(place)){
      candidates.push({
        key:`club-${place.id}`,
        kind:"activity_club",
        latitude:place.latitude,
        longitude:place.longitude,
        text:"Spaces open",
        label:`${place.card?.title || "This club"} has spaces open`,
        route:`/activity-clubs/${place.id}`,
        chrome,
        confetti:[]
      });
    }

    if(place.kind==="property" && propertyIsEligible(place)){
      const text=propertyAvailabilityText(place);
      candidates.push({
        key:`property-${place.id}`,
        kind:"property",
        latitude:place.latitude,
        longitude:place.longitude,
        text,
        label:`${place.card?.title || "This property"}: ${text}`,
        route:`/property/${place.id}`,
        chrome,
        confetti:[]
      });
    }
  }

  // --- events: live state, and the one celebration -------------------------
  for(const item of activity){
    if(item?.kind!=="event") continue;

    const text=eventBubbleText(item,now);
    if(!text) continue;

    candidates.push({
      key:`event-${item.id || item.key}`,
      kind:"event",
      latitude:item.latitude,
      longitude:item.longitude,
      text,
      label:`${item.title || "This event"}: ${text.toLowerCase()}`,
      route:item.deepLink || null,
      // Only an event actually happening. "Tonight" gets a bubble and no
      // confetti -- see utils/liveBubbles.js.
      celebrate:eventDeservesCelebration(item,now),
      chrome,
      confetti
    });
  }

  // --- reviews: the photo, and only if there is one ------------------------
  for(const shot of reviewShots){
    if(!reviewIsEligible(shot)) continue;

    const review=shot.explorer_reviews || {};
    if(review.status && review.status!=="published") continue;

    const place=positions.get(`${review.target_type}:${review.target_id}`);
    if(!place) continue;

    candidates.push({
      key:`review-${shot.id}`,
      kind:"review",
      latitude:place.latitude,
      longitude:place.longitude,
      // The bubble IS the photo. No caption, no rating, no reviewer.
      imageUrl:shot.media_url,
      label:`A photo from a review of ${place.card?.title || "this place"}`,
      route:`/social-comments/${review.id}?type=review`,
      chrome,
      confetti:[]
    });
  }

  return candidates;
}

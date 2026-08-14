// Packet 6 of docs/REDESIGN-BRIEF.md: map bottom cards.
//
// "Draggable card on marker tap, swipe between nearby places, map position
// preserved."
//
// The card set is built here, as data, so the part that decides *what you can
// swipe to* is testable without a map -- which matters more than usual, because
// no Google Maps API key is set. PROJECT-LOG.md records that the list fallback
// in components/PlacesList.js is what actually ships, and the brief says in so
// many words: "do not assume a map".

import {
  CLUB_TYPE_LABEL,
  PROPERTY_TYPE_LABEL,
  markerForBusiness,
  markerForClub,
  markerForProperty,
  typeLabelForBusiness
} from "./markers";

export const CARD_KINDS={
  BUSINESS:"business",
  PROPERTY:"property",
  CLUB:"club"
};

// One row from one of the three map tables becomes one card. The marker is the
// same object the pin uses, so a card and the pin it came from cannot show
// different icons for the same place.
export function toCard(kind,row){
  if(!row) return null;

  if(kind===CARD_KINDS.BUSINESS){
    return base(kind,row,{
      typeLabel:typeLabelForBusiness(row),
      detail:row.address,
      route:`/business/${row.id}`,
      marker:markerForBusiness(row)
    });
  }

  if(kind===CARD_KINDS.PROPERTY){
    return base(kind,row,{
      typeLabel:PROPERTY_TYPE_LABEL,
      detail:row.address,
      route:`/property/${row.id}`,
      marker:markerForProperty()
    });
  }

  if(kind===CARD_KINDS.CLUB){
    return base(kind,row,{
      typeLabel:CLUB_TYPE_LABEL,
      detail:row.address || row.location,
      route:`/activity-clubs/${row.id}`,
      marker:markerForClub()
    });
  }

  return null;
}

function base(kind,row,rest){
  return {
    // Kind is part of the key because three tables have their own id spaces and
    // nothing stops two of them colliding.
    key:`${kind}-${row.id}`,
    id:row.id,
    kind,
    name:row.name,
    latitude:row.latitude,
    longitude:row.longitude,
    ...rest
  };
}

// The map's word for a listing type and a review's word for the same thing are
// not the same word: the map says "club", a review says "activity_club". Both
// are real and neither is wrong, so the translation lives here, once, rather
// than in every caller that needs to ask about a place's reviews.
export const REVIEW_TARGET_TYPE={
  [CARD_KINDS.BUSINESS]:"business",
  [CARD_KINDS.PROPERTY]:"property",
  [CARD_KINDS.CLUB]:"activity_club"
};

export function reviewTargetType(kind){
  return REVIEW_TARGET_TYPE[kind] || kind || null;
}

// The picture at the top of the map panel.
//
// Three tables, three different columns, because they were built at different
// times: a business has `image` and a `photos` array, a property has `photos`
// only, a club has `image_url`. A manager who has uploaded nothing gets no
// picture rather than a broken one -- components/PlacePanel.js draws a plain
// type-coloured block, which is honest about there being no photo.
export function heroImageFor(place){
  if(!place) return null;

  const first=(list)=>Array.isArray(list) ? list.find(Boolean) || null : null;

  if(place.kind===CARD_KINDS.BUSINESS) return place.image || first(place.photos);
  if(place.kind===CARD_KINDS.PROPERTY) return first(place.photos);
  if(place.kind===CARD_KINDS.CLUB) return place.image_url || null;
  return null;
}

// A sentence, not a page. The panel is a glance before somebody decides whether
// to open the place, so a description that runs to paragraphs is cut at the end
// of a word rather than mid-syllable.
export const SUMMARY_LIMIT=140;

export function summaryFor(place,limit=SUMMARY_LIMIT){
  const text=String(place?.description || "").replace(/\s+/g," ").trim();
  if(!text) return "";
  if(text.length<=limit) return text;

  const cut=text.slice(0,limit);
  const lastSpace=cut.lastIndexOf(" ");
  return `${(lastSpace>40 ? cut.slice(0,lastSpace) : cut).replace(/[.,;:]$/,"")}…`;
}

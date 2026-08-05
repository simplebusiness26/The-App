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

import {nearestFirst} from "./geo";
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

// The swipeable set: the place that was tapped, then its neighbours by
// distance. The tapped place is always first, so opening a card and swiping
// back returns you to what you tapped rather than to whatever happened to be
// nearest.
export function cardsAround(tapped,everything,limit=8){
  if(!tapped) return [];

  const others=(everything || []).filter((card)=>card && card.key!==tapped.key);
  return [tapped,...nearestFirst(tapped,others).slice(0,Math.max(0,limit-1))];
}

export function indexOfCard(cards,key){
  const found=(cards || []).findIndex((card)=>card.key===key);
  return found<0 ? 0 : found;
}

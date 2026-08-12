import React from "react";
import LivingMapScreen from "../components/LivingMapScreen";

// The map. One screen, both platforms.
//
// This file used to be 260 lines: three database reads, a signed-out guard, a
// search matcher, two filter rows, the card set and a MapView, all duplicated
// almost exactly in components/PlacesList.js. Every one of those lines moved --
// the data and the rules to hooks/useLivingMap.js, the interface to
// components/LivingMapScreen.js, the drawing to components/LivingMap.js and its
// .web twin.
//
// It also used to hide the map behind EXPO_PUBLIC_GOOGLE_MAPS_API_KEY and fall
// back to a list. There is no key any more and no fallback: the map is the map.
export default function MapScreen(){
  return <LivingMapScreen/>;
}

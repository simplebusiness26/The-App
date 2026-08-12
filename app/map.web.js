import React from "react";
import LivingMapScreen from "../components/LivingMapScreen";

// The web map.
//
// This file rendered PlacesList and nothing else, for as long as the app has
// existed, because react-native-maps has no web build. The browser has never
// had a map.
//
// It has one now, and it is the SAME SCREEN the phone renders --
// LivingMapScreen picks its renderer through Metro's platform extension, so
// this file exists only to be that extension's other half. If it ever grows an
// implementation of its own, the two platforms have started to drift.
export default function MapScreen(){
  return <LivingMapScreen/>;
}

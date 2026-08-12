import React from "react";
import LivingMap from "./LivingMap.web";

// The web half of the legacy native map, and it is not a legacy map.
//
// components/LivingMap.legacy.js imports react-native-maps, which has NO WEB
// BUILD -- its package.json declares only `main` and `react-native`, so pulling
// it into a web bundle takes the whole route to a blank screen. That has
// happened once already in this project (Packet 8b, components/MyMap.js) and
// scripts/verify-my-map.cjs exists because of it.
//
// Nothing on web should reach the legacy file: Metro resolves LivingMap.web.js
// before LivingMap.js, so the import never happens. This exists so that if
// anything ever does reach it, it gets the working web map instead of a blank
// page -- a safety net, not a second implementation.
export default function LegacyLivingMap(props){
  return <LivingMap {...props}/>;
}

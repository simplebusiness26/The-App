import React from "react";
import LivingMapScreen from "../components/LivingMapScreen";

// The app opens on the map.
//
// WHAT THIS REPLACED
//
// A landing page: a wordmark, a tagline, an "Explore Events" button, an
// "Explore Map" button, and log in / create account. Every one of those is a
// tap between somebody opening Xplorer and seeing anything about where they
// are, and the whole idea of the app is the map. Events are a tab. Logging in
// is a button. Neither needed a page of their own in front of the thing people
// came for.
//
// So this is the map now, and it is the SAME component /map renders --
// components/LivingMapScreen -- not a copy of it. One map screen, reachable
// two ways, with no chance of the two drifting apart.
//
// Signed out is fine. The map, the search, the filters and the place cards all
// work with no account; the living layer (who is out right now) is the part
// that needs one, and hooks/useLivingMap.js already skips that read for a
// signed-out visitor rather than failing. The floating Log in button on the map
// is how somebody gets an account from here.

export default function Home(){
  return <LivingMapScreen/>;
}

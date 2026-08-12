// Where the map comes from. One file, and the only one that names a provider.
//
// THE ACCEPTANCE CRITERION THIS EXISTS FOR
//
// "We may keep this setup long term. We may replace it later. Build the
// architecture properly now, but do not couple Xplorer's product logic to
// OpenFreeMap." So: `tiles.openfreemap.org` appears here and nowhere else in
// the app, and changing this file changes the map on web, Android and iOS at
// once. Nothing in a feature file may type a hostname.
//
// OPENFREEMAP IS THE CURRENT PROVIDER, NOT A STOPGAP
//
// No decision has been made to move to Google or Mapbox, and this may well be
// what Xplorer keeps. It asks for no key, no account and no card, it allows
// commercial use, it states no request limit, and the whole planet can be
// self-hosted from published images if the public instance ever stops being
// enough. What the architecture guarantees is that swapping it is a
// configuration change rather than a rebuild.
//
// THE ONE OBLIGATION IT CARRIES
//
// Attribution. It is not optional and it is not decoration: the data is
// OpenStreetMap's and the licence it is free under requires the credit.
//
// WHERE THE CREDIT LIVES NOW, AND WHY IT IS NOT ON THE MAP
//
// It used to be drawn in the corner of the map by MapLibre's own control. Both
// of MapLibre's controls -- the logo and the attribution button -- are now
// turned off in both renderers, properly, at the component. Nothing is drawn
// and covered over.
//
// The credit moved rather than went:
//
//   components/StartupSplash.js   ATTRIBUTION_SHORT, full size, for five
//                                 seconds, on every launch, not dismissable
//   app/settings.js               ATTRIBUTION, the copyright line and a link
//                                 to the licence, permanently
//
// That is a deliberate decision by the owner, and it is the arrangement the
// OpenStreetMap Foundation's own guidance describes for screens where a corner
// notice does not fit: the credit stays present and reachable rather than
// visible on the map itself. The safest reading is still a line in the corner
// of the map, and if that is ever wanted, turning both flags back on restores
// it in two lines.
//
// What is NOT acceptable, and what this file exists to prevent: quietly
// dropping it. If the splash or the Settings entry is ever removed, the credit
// has to go back on the map. test/map-attribution.test.js holds that line.

const HOST="https://tiles.openfreemap.org";

// The styles the provider publishes. `positron` is the quiet one and it is the
// right default here: docs/design-system.md's whole sentence is "the map base is
// quiet, the pins carry all the colour". Liberty and bright are more colourful
// maps, which would fight every marker Xplorer draws on them.
export const MAP_STYLES={
  quiet:`${HOST}/styles/positron`,
  standard:`${HOST}/styles/liberty`,
  bright:`${HOST}/styles/bright`
};

export const DEFAULT_STYLE=MAP_STYLES.quiet;

// The full wording, for the permanent notice in Settings.
export const ATTRIBUTION="OpenFreeMap © OpenMapTiles Data from OpenStreetMap";

// The line a person reads on the way in. Short enough to take in during a
// five-second splash, and it names the source that the licence is actually
// about. components/StartupSplash.js shows this; Settings shows ATTRIBUTION,
// the copyright line and the link.
export const ATTRIBUTION_SHORT="Map data from OpenStreetMap";

export const ATTRIBUTION_COPYRIGHT="© OpenStreetMap contributors";

// The licence itself. Linked from Settings so the wording is never the only
// thing an interested person can reach.
export const ATTRIBUTION_URL="https://www.openstreetmap.org/copyright";

// The old native map, on a switch.
//
// react-native-maps is still installed and components/LivingMap.legacy.js still
// draws with it. EXPO_PUBLIC_LEGACY_MAP=1 brings it back on a phone.
//
// It exists because the owner has not yet opened the MapLibre map on a real
// device, and if it misbehaves there, flipping one variable is a working map
// while deleting the file was a week of waiting. It goes when the new map has
// been seen -- that is phase E, and it is a follow-up rather than a loose end.
export function useLegacyNativeMap(){
  return process.env.EXPO_PUBLIC_LEGACY_MAP==="1";
}

// Everything a renderer needs to start, in one object, so a platform renderer
// never reaches past this for configuration.
export function mapConfiguration(){
  return{
    styleUrl:DEFAULT_STYLE,
    attribution:ATTRIBUTION,
    // Neither of these is a key. There is nothing to authenticate with, which
    // is the point: no billing, no card, no account.
    requiresApiKey:false,
    provider:"openfreemap"
  };
}

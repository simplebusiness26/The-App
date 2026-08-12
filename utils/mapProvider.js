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
// OpenStreetMap's and the licence requires it to be visible on the map. Every
// renderer shows ATTRIBUTION, and a renderer that does not is broken rather
// than merely untidy.

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

export const ATTRIBUTION="OpenFreeMap © OpenMapTiles Data from OpenStreetMap";

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

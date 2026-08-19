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

// THE DARK MAP IS OURS, THE TILES ARE STILL THEIRS.
//
// The Field Instrument system (docs/design-system.md) needs a dark map: the
// housing recedes so the readings glow. OpenFreeMap publishes only light styles
// -- positron, liberty, bright -- so none of them can be the default any more.
//
// A MapLibre style is only paint over a vector tile source, and the style spec
// is ours to author. assets/map/instrument-dark.json is derived from positron's
// own 55-layer OpenMapTiles schema with terrain recoloured to the instrument's
// land/water/park/road tokens, pointing at the SAME openmaptiles vector source,
// sprite and glyphs the provider serves. So we get a dark base without
// self-hosting tiles, and their schema keeps working.
//
// Nothing about the licence changes: the data is still OpenStreetMap's and the
// attribution obligation below is untouched.
//
// The provider's light styles stay listed as a fallback if the local style ever
// fails to parse.
import instrumentDark from "../assets/map/instrument-dark.json";

export const MAP_STYLES={
  instrument:instrumentDark,
  quiet:`${HOST}/styles/positron`,
  standard:`${HOST}/styles/liberty`,
  bright:`${HOST}/styles/bright`
};

export const DEFAULT_STYLE=MAP_STYLES.instrument;

// THE THREE-WAY STYLE SWITCH.
//
// MAP_STYLES holds four entries; a switch on the map offers three, because a
// three-way selector a person can read at a glance is worth more than a fourth
// option nobody asked for. `instrument` is first and is the default -- it is
// the winning design's own map and the reason assets/map/instrument-dark.json
// exists. The other two are the provider's real published styles, so this is a
// choice between three maps that genuinely render differently, not three names
// for one.
//
// The key is what travels. Nothing outside this file may hold a style OBJECT
// or a URL: a screen passes "instrument" | "quiet" | "standard" around and asks
// styleFor() at the last moment, which is what keeps the provider named here
// and nowhere else.
export const STYLE_CHOICES=[
  {key:"instrument",label:"Instrument",sentence:"Xplorer's own dark map. The default."},
  {key:"quiet",label:"Quiet",sentence:"A pale, low-contrast map."},
  {key:"standard",label:"Standard",sentence:"A full-colour map with more detail."}
];

export const DEFAULT_STYLE_KEY="instrument";

export function isStyleKey(key){
  return STYLE_CHOICES.some((choice)=>choice.key===key);
}

export function styleLabel(key){
  return STYLE_CHOICES.find((choice)=>choice.key===key)?.label || STYLE_CHOICES[0].label;
}

// A key in, a style the renderer can hand straight to MapLibre out. An unknown
// key falls back to the instrument rather than throwing: a stale preference
// must not be able to leave somebody with no map.
export function styleFor(key){
  return MAP_STYLES[key] || DEFAULT_STYLE;
}

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


// Everything a renderer needs to start, in one object, so a platform renderer
// never reaches past this for configuration.
export function mapConfiguration({styleKey}={}){
  return{
    styleUrl:styleFor(styleKey),
    styleKey:isStyleKey(styleKey) ? styleKey : DEFAULT_STYLE_KEY,
    attribution:ATTRIBUTION,
    // Neither of these is a key. There is nothing to authenticate with, which
    // is the point: no billing, no card, no account.
    requiresApiKey:false,
    provider:"openfreemap"
  };
}

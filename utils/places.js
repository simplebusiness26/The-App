// Packet 8e: the words and the shapes shared by everything that points at a
// place, an area or a Moment's identity.
//
// One list per idea, because the alternative is the same eight strings written
// out in the create screen, the place page, the admin screen and the gate, and
// four chances for them to drift apart.

// The non-commercial half of the map. A park is a place, not its own concept --
// RULES.md is explicit about that -- so a beach, a viewpoint and a public
// square are the same kind of row with a different type.
export const PUBLIC_PLACE_TYPES=[
  {key:"park",label:"Park"},
  {key:"beach",label:"Beach"},
  {key:"viewpoint",label:"Viewpoint"},
  {key:"landmark",label:"Landmark"},
  {key:"public_square",label:"Public square"},
  {key:"nature_area",label:"Nature area"},
  {key:"attraction",label:"Attraction"},
  {key:"other",label:"Other public place"}
];

export function publicPlaceTypeLabel(type){
  return PUBLIC_PLACE_TYPES.find((item)=>item.key===type)?.label || "Public place";
}

// What an Explorer can follow. Link-ups are deliberately absent: a Link-up is
// one afternoon, and you join it rather than subscribing to it forever.
export const FOLLOWABLE_ENTITY_TYPES=[
  {key:"business",label:"Business",route:"/business"},
  {key:"property",label:"Stay",route:"/property"},
  {key:"activity_club",label:"Activity club",route:"/activity-clubs"},
  {key:"event",label:"Event",route:"/events"},
  {key:"public_place",label:"Public place",route:"/places"}
];

export function entityTypeLabel(type){
  return FOLLOWABLE_ENTITY_TYPES.find((item)=>item.key===type)?.label || "Place";
}

// The route a Moment's attachment opens. Returns null rather than a guessed
// path, so a caller renders nothing instead of a link to nowhere.
export function entityRoute(type,id){
  const entity=FOLLOWABLE_ENTITY_TYPES.find((item)=>item.key===type);
  if(!entity || !id) return null;
  return `${entity.route}/${id}`;
}

// A Moment's audience. Friends first, and it is the default in the create
// screen: RULES.md says a visibility flag defaults to the closed setting, and
// "everyone forever" should be something a person chooses rather than something
// they fail to change.
//
// `friends` means a mutual follow, computed by the database from
// explorer_follows -- there is no friendship table and no request to accept.
export const MOMENT_VISIBILITY=[
  {
    key:"friends",
    label:"Friends",
    hint:"Explorers you follow who follow you back"
  },
  {
    // 'everyone', not 'public'. 20260811220000 put every audience in the app on
    // one word list, and explorer_moments.visibility has refused 'public' since
    // -- so this button was posting a value the database rejects.
    key:"everyone",
    label:"Everyone",
    hint:"Any Explorer, and it can appear in discovery"
  }
];

export const DEFAULT_MOMENT_VISIBILITY="friends";

export function momentVisibilityLabel(visibility){
  return MOMENT_VISIBILITY.find((item)=>item.key===visibility)?.label || "Everyone";
}

// Roughly 100 metres. Enough to say which park, not enough to say which bench.
// The database rounds again on insert -- this is the copy that keeps a precise
// coordinate from leaving the device at all.
export const COORDINATE_PRECISION=3;

export function roundCoordinate(value){
  if(value===null || value===undefined) return null;
  const number=Number(value);
  if(!Number.isFinite(number)) return null;
  return Number(number.toFixed(COORDINATE_PRECISION));
}

// A canonical area, written the way it is displayed: "Hastings, East Sussex".
export function areaLabel(area){
  if(!area) return "";
  const parent=area.parent?.name || area.parent_name;
  return parent ? `${area.name}, ${parent}` : area.name;
}

// The single source of truth for how businesses are classified.
//
// Packet 1 of docs/REDESIGN-BRIEF.md: "The enum lives in one file, exported,
// used everywhere. If a second list of business types appears anywhere in the
// codebase, that's a bug." scripts/verify-taxonomy.cjs enforces that, and also
// checks this file has not drifted from what the migration seeded into the
// database.
//
// The six categories are the ones named in the brief. The type list is
// deliberately almost empty: the interface direction document the brief points
// at does not exist in this repository, so the real types are not knowable from
// here. bar, pub and restaurant are placeholders, kept so the structure is
// exercised by real rows rather than untested. Adding the rest is an edit to
// TYPES below plus a migration that re-seeds business_types -- nothing else in
// the codebase should need to change.

export const UNCLASSIFIED="unclassified";

export const CATEGORIES=[
  {key:"food_and_drink",label:"Food and drink"},
  {key:"entertainment_and_nightlife",label:"Entertainment and nightlife"},
  {key:"health_and_wellbeing",label:"Health and wellbeing"},
  {key:"shopping",label:"Shopping"},
  {key:"attractions_and_experiences",label:"Attractions and experiences"},
  {key:"essential_local_services",label:"Essential local services"},
  {key:UNCLASSIFIED,label:"Unclassified"}
];

// Specific types, each belonging to exactly one category. Placeholders only --
// see the note above.
export const TYPES=[
  {key:"bar",label:"Bar",category:"food_and_drink"},
  {key:"pub",label:"Pub",category:"food_and_drink"},
  {key:"restaurant",label:"Restaurant",category:"food_and_drink"}
];

// Every category also carries an "unclassified" type. That is what lets a row
// record "this is food and drink, but we do not yet have a type for it" instead
// of discarding the category it does know. Nothing is ever null, so the gap is
// always countable.
export function typesForCategory(categoryKey){
  return[
    ...TYPES.filter((type)=>type.category===categoryKey),
    {key:UNCLASSIFIED,label:"Not yet classified",category:categoryKey}
  ];
}

export function allTypePairs(){
  return CATEGORIES.flatMap((category)=>
    typesForCategory(category.key).map((type)=>({
      category:category.key,
      type:type.key,
      label:type.label
    }))
  );
}

export function categoryLabel(key){
  return CATEGORIES.find((category)=>category.key===key)?.label || "Unclassified";
}

export function typeLabel(categoryKey,typeKey){
  if(typeKey===UNCLASSIFIED) return "Not yet classified";
  return TYPES.find((type)=>type.key===typeKey && type.category===categoryKey)?.label || "Not yet classified";
}

export function isValidPair(categoryKey,typeKey){
  return allTypePairs().some((pair)=>pair.category===categoryKey && pair.type===typeKey);
}

// A business's classification in one line, for cards and headers.
export function classificationLabel(business){
  if(!business) return "Unclassified";

  const category=business.category || UNCLASSIFIED;
  const type=business.business_type || UNCLASSIFIED;

  if(type===UNCLASSIFIED) return categoryLabel(category);
  return typeLabel(category,type);
}

export const MAX_SECONDARY_TYPES=2;

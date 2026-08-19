// WHAT A CHECK-IN ALREADY KNOWS BEFORE YOU TOUCH IT.
//
// The locked UX spec, verbatim:
//
//   "From any place detail page 'Check in here' opens the Create hub pre-filled
//    with that place. Activity is auto-suggested from the place's category,
//    duration defaults to a pre-selected chip (1h), visibility defaults to
//    Followers. Confirming is a single tap on 'Check in'. From the global
//    Create button with no page context, the nearest place is auto-suggested."
//
// Every value in this file is a DEFAULT and not one of them is a lock. A
// suggestion that cannot be changed is a decision taken away from somebody, and
// this screen decides where a person is standing -- so each of these arrives
// pre-selected, visibly, and every one of them is one tap away from being
// something else.
//
// It lives in utils/ rather than in the screen because a suggestion is a rule,
// and a rule that only exists inside a component can only be checked by
// rendering the component. test/checkin-suggestions.test.js checks these
// directly.

import {PUBLIC_PLACE_TYPES} from "./places";
import {hasCoordinates,numberOrNull} from "./coordinates";
import {nearestFirst} from "./geo";

// The activities the check-in screen offers. It used to be a bare array inside
// app/checkins/create.js, which meant the suggestion table below could name an
// activity the screen does not actually have and nothing would notice until a
// chip failed to light up.
export const CHECKIN_ACTIVITIES=[
  "Walking",
  "Running",
  "Coffee",
  "Eating",
  "Sport",
  "Relaxing",
  "Exploring",
  "Other"
];

// One activity per public place type -- the real taxonomy from utils/places.js,
// not a guessed one. These are the plain answers to "what is somebody usually
// doing when they check in here", and they are deliberately dull: a suggestion
// that is wrong in an interesting way costs more taps than no suggestion at all.
const ACTIVITY_BY_CATEGORY={
  park:"Walking",
  beach:"Relaxing",
  viewpoint:"Exploring",
  landmark:"Exploring",
  public_square:"Coffee",
  nature_area:"Walking",
  attraction:"Exploring",
  other:"Exploring"
};

// The answer for a place whose category is missing, unrecognised, or one this
// table has not learned yet. Never "Other": that one opens a text field, so
// falling back to it would turn "confirming is a single tap" into a typing job
// exactly when the app knows least about where somebody is.
export const DEFAULT_CHECKIN_ACTIVITY="Exploring";

export function activityForCategory(category){
  const suggestion=ACTIVITY_BY_CATEGORY[category];
  return CHECKIN_ACTIVITIES.includes(suggestion) ? suggestion : DEFAULT_CHECKIN_ACTIVITY;
}

// "duration defaults to a pre-selected chip (1h)". The four durations
// themselves stay written out in the screen -- 30, 60, 120, 240 -- because that
// list is what scripts/verify-linkups-live.cjs pins, and one list with two
// homes is how a fifth duration quietly appears in only one of them.
export const DEFAULT_CHECKIN_MINUTES=60;

// ---------------------------------------------------------------------------
// The audience, and the one place the spec is overruled
// ---------------------------------------------------------------------------
//
// The spec says a check-in defaults to Followers. RULES.md says:
//
//   "`followers` is wider than `friends`, because following is one-way and
//    needs no permission. It is a fine audience for something somebody chose to
//    post. It is **not** an acceptable audience for presence -- check-ins and
//    Link-ups use friends."
//
// Presence wins, because the rule is about safety and the spec is about taps.
// Somebody can follow you without asking; a Followers check-in is therefore
// readable by a stranger who followed you this morning specifically to watch
// where you go, and scripts/verify-friends-visibility.cjs exists because that
// was live once.
//
// So the requested default is recorded honestly, narrowed here, and the screen
// says the narrowing out loud rather than showing one audience and sending
// another -- a privacy control that misreports itself is the failure mode
// RULES.md treats as safety-critical.
export const REQUESTED_CHECKIN_AUDIENCE="followers";
export const PRESENCE_AUDIENCE_CEILING="friends";

// Narrower audiences pass through untouched; anything at or above the ceiling
// comes back as the ceiling. An audience nobody recognises narrows too, rather
// than being trusted.
const NARROWER_THAN_PRESENCE=["nobody","selected","close_friends"];

export function presenceAudience(requested){
  return NARROWER_THAN_PRESENCE.includes(requested) ? requested : PRESENCE_AUDIENCE_CEILING;
}

// ---------------------------------------------------------------------------
// Which place, when nothing said
// ---------------------------------------------------------------------------
//
// Opened from the global Create button there is no page context, so the nearest
// published place is suggested instead. The ranking is utils/geo.js's, which is
// squared degrees rather than metres on purpose -- check-in coordinates are
// rounded before they are stored, so a haversine here would be arithmetic
// pretending to a precision the inputs do not have. There is no second copy of
// that maths in this file.
export function nearestPlace(places,position){
  const origin=normalisePosition(position);
  if(!origin) return null;

  // A place with no recorded position cannot be the nearest one -- it can only
  // be an arbitrary one. utils/geo.js sorts those last rather than dropping
  // them, which is right for a list and wrong for a single answer.
  const located=(places||[]).filter((place)=>hasCoordinates(place));
  if(!located.length) return null;

  return nearestFirst(origin,located)[0] || null;
}

// expo-location hands back {coords:{latitude,longitude}}; a place row and the
// screen's own state are flat. Both are accepted so no caller has to remember
// which shape it is holding.
export function normalisePosition(position){
  const source=position?.coords || position;
  const latitude=numberOrNull(source?.latitude);
  const longitude=numberOrNull(source?.longitude);
  if(latitude===null || longitude===null) return null;
  return {latitude,longitude};
}

// Everything a screen can fill in for itself once it knows the place. Returned
// as one object so the screen has one thing to apply and one thing to explain,
// and so the defaults cannot drift apart from each other.
export function checkinDefaults(place){
  return {
    activity:activityForCategory(place?.place_type),
    minutes:DEFAULT_CHECKIN_MINUTES,
    audience:presenceAudience(REQUESTED_CHECKIN_AUDIENCE)
  };
}

// The label a person reads for the category a suggestion came from, so the
// screen can say WHY it chose what it chose instead of silently pre-selecting.
export function categoryLabel(category){
  return PUBLIC_PLACE_TYPES.find((type)=>type.key===category)?.label || "Public place";
}

// Packet 8d: the vocabulary of a Memory's two phases.
//
// A Memory is live until `live_until`, and archived afterwards. Which of the
// two visibility settings applies depends on which phase it is in, and that is
// decided by the database -- these are the words the screens use to say the
// same thing to a person.

// Who can read it. Private first, and private is the default: RULES.md says a
// visibility flag defaults to the closed setting.
export const MEMORY_VISIBILITY=[
  {key:"private",label:"Only me",hint:"Nobody else, ever"},
  {key:"friends",label:"Friends",hint:"Explorers you follow who follow you back"},
  {key:"selected",label:"Chosen Explorers",hint:"Only the people you pick"},
  {key:"public",label:"Public",hint:"Any Explorer, while it is live"}
];

export const DEFAULT_MEMORY_VISIBILITY="private";

// What happens to it afterwards. Deliberately a separate list with the same
// values: the archive is a second decision, not a continuation of the first.
export const ARCHIVE_VISIBILITY=[
  {key:"private",label:"Only me",hint:"It stays yours once the live period ends"},
  {key:"friends",label:"Friends",hint:"Mutual follows keep access afterwards"},
  {key:"selected",label:"Chosen Explorers",hint:"The people you picked keep access"},
  {key:"public",label:"Public",hint:"Anyone can find it in your archive"}
];

// Never copied from `visibility`. Consenting to be seen today is not
// consenting to be seen forever, so the archive starts closed and the creator
// opens it deliberately or not at all.
export const DEFAULT_ARCHIVE_VISIBILITY="private";

// How long the live period runs. A private Memory needs none; everything else
// must have one, because anything that reveals where somebody was has to stop.
export const LIVE_DURATIONS=[
  {key:"day",label:"24 hours",hours:24},
  {key:"week",label:"7 days",hours:168},
  {key:"month",label:"30 days",hours:720}
];

export const DEFAULT_LIVE_DURATION="day";

export function liveUntilFrom(durationKey,now=new Date()){
  const duration=LIVE_DURATIONS.find((item)=>item.key===durationKey) || LIVE_DURATIONS[0];
  return new Date(now.getTime()+duration.hours*60*60*1000).toISOString();
}

export function visibilityLabel(list,key){
  return list.find((item)=>item.key===key)?.label || "Only me";
}

// The phase, from the row. The same rule the RLS policy applies, so a screen
// and the database describe a Memory the same way.
export function isLive(memory,now=Date.now()){
  if(!memory?.live_until) return false;
  return new Date(memory.live_until).getTime()>now;
}

export function phaseLabel(memory,now=Date.now()){
  if(!memory) return "";
  if(isLive(memory,now)) return `Live until ${new Date(memory.live_until).toLocaleDateString("en-GB",{day:"numeric",month:"short"})}`;
  return memory.live_until ? "Archived" : "Private, kept indefinitely";
}

// Who can see it right now, said in one line for the detail screen.
export function currentAudience(memory,now=Date.now()){
  if(!memory) return "";
  return isLive(memory,now)
    ? visibilityLabel(MEMORY_VISIBILITY,memory.visibility)
    : visibilityLabel(ARCHIVE_VISIBILITY,memory.archive_visibility);
}

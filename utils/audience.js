// The audience vocabulary, on the client.
//
// This is a COPY of guestbook_private.audience_rank (20260811220000), and that
// is a thing worth being uncomfortable about, so: the database is the only
// place that decides who sees anything. Nothing here grants access, nothing
// here hides a row, and removing this file entirely would change what is
// visible to nobody.
//
// What it is for is telling somebody the truth before they post. profiles
// .visibility is a CEILING -- a post can be narrower than it and never wider --
// and it starts at `nobody`, which is the right default and also means a brand
// new Explorer's first Moment is seen by no one at all. Without something
// saying so at the moment of posting, the app looks broken rather than private.
//
// Narrowest first. Same order, same words, same fall-through as the database:
// anything unrecognised ranks as nobody, so a typo closes access rather than
// opening it.

export const AUDIENCE_RANK={
  nobody:0,
  selected:1,
  close_friends:2,
  friends:3,
  followers:4,
  everyone:5
};

export function audienceRank(audience){
  const rank=AUDIENCE_RANK[audience];
  return typeof rank==="number" ? rank : 0;
}

// What people read. Never "Visibility: restricted" -- privacy controls read as
// sentences about people (docs/design-system.md).
export const AUDIENCE_LABEL={
  nobody:"nobody",
  selected:"the people you pick",
  close_friends:"your close friends",
  friends:"your friends",
  followers:"your followers",
  everyone:"any Explorer"
};

export function audienceLabel(audience){
  return AUDIENCE_LABEL[audience] || "nobody";
}

// The same six words as a short noun, for a badge or a stat where a sentence
// fragment would not fit. It exists so that a screen needing "Friends" in a
// pill does not write its own mapping -- app/linkups/[id].js did exactly that,
// as `visibility==="followers" ? "Friends" : "Public"`, and once Link-ups
// stopped storing 'followers' every Friends-only Link-up told its members it
// was Public. A privacy control that lies is worse than one that is missing.
//
// Same fall-through as everything else here: unrecognised reads as Nobody.
export const AUDIENCE_SHORT_LABEL={
  nobody:"Nobody",
  selected:"Chosen Explorers",
  close_friends:"Close friends",
  friends:"Friends",
  followers:"Followers",
  everyone:"Everyone"
};

export function audienceShortLabel(audience){
  return AUDIENCE_SHORT_LABEL[audience] || "Nobody";
}

// Given the profile setting and the audience chosen for one post, who actually
// ends up seeing it. The narrower of the two, every time.
export function effectiveAudience(profileVisibility,postAudience){
  return audienceRank(profileVisibility) < audienceRank(postAudience)
    ? profileVisibility
    : postAudience;
}

// Is the profile setting quietly overruling what somebody just chose? Returns
// the sentence to show them, or "" when there is nothing to say.
//
// The wording avoids blame and names the fix. "Your visibility is restricted"
// tells somebody they have done something wrong; this tells them what will
// happen and where to change it.
export function ceilingWarning(profileVisibility,postAudience){
  const ceiling=profileVisibility || "nobody";
  if(audienceRank(ceiling) >= audienceRank(postAudience)) return "";

  if(ceiling==="nobody"){
    return "Your profile visibility is set to Nobody, so nothing you post is visible to anyone yet — including this. Change it in Settings.";
  }

  return `Your profile visibility is set to ${audienceLabel(ceiling)}, which is narrower than ${audienceLabel(postAudience)}. This will be seen by ${audienceLabel(ceiling)} until you widen it in Settings.`;
}

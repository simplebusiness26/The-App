// The privacy policy and the terms, as text.
//
// ⚠️ THIS IS A DRAFT FOR A SOLICITOR. It is not legal advice and it has not
// been reviewed by anybody qualified to review it. Do not submit the app to
// either store on the strength of it.
//
// WHAT IT IS, AND WHY IT IS WORTH HAVING ANYWAY
//
// It was written by reading the schema rather than by filling in a template, so
// every sentence below describes something the code actually does. Where a
// template would say "we may collect location data", this says which two
// precisions, when they are asked for, and what happens if you refuse -- because
// utils/places.js and components/AddLocation.js say so.
//
// That makes it useful in two ways a template is not: somebody reading it finds
// out what the app really does, and a solicitor reviewing it is correcting
// accurate text rather than writing from scratch.
//
// KEEP IT TRUE. If the behaviour changes and this does not, it stops being a
// draft and becomes a false statement about a live product. Every claim below
// names the thing that makes it true.

export const LEGAL_DRAFT_NOTICE=
  "This is a draft. It describes what the app does today and has not been "+
  "reviewed by a solicitor. It must be checked before Xplorer is submitted to "+
  "the App Store or Google Play.";

export const LEGAL_UPDATED="14 August 2026";

export const PRIVACY_POLICY=[
  {
    heading:"The short version",
    body:[
      "Xplorer shows you what is around you and lets you post about it. To do that it stores your account, what you post, and — only when you ask it to — roughly where you are.",
      "Nothing you post is visible to anyone until you choose an audience for it. New accounts start at 'nobody', which means exactly that."
    ]
  },
  {
    heading:"Your account",
    body:[
      "An email address and a password, held by Supabase Auth. We never see your password.",
      "A profile: your name, an optional picture, an optional area such as 'Brighton', and one visibility setting that acts as a ceiling on everything you post."
    ]
  },
  {
    heading:"Where you are",
    body:[
      "Xplorer never takes your location on its own. It is asked for when you press a button that says what it is for, and a refusal is a refusal.",
      "You choose how precise it is. 'This spot' is rounded to about 100 metres before it leaves your phone. 'My area only' is rounded to about a kilometre. Choose neither and no coordinates are sent at all — the post carries your area, which nobody can see on the map.",
      "The rounding happens on your device. A precise coordinate never reaches our servers. The database rounds again when it stores it.",
      "Directions are worked out by sending your starting point to a routing service (FOSSGIS Valhalla). It is not stored anywhere, by us or by them."
    ]
  },
  {
    heading:"What you post",
    body:[
      "Moments last 24 hours and then disappear. Memories are kept until you delete them.",
      "Photographs and video you post are stored privately. They can only be fetched by somebody the post's audience allows, through a link that expires within an hour.",
      "Reviews are public once published, along with any photographs attached to them. That is the point of a review.",
      "Every post has an audience: nobody, selected people, close friends, friends, followers, or everyone. Your profile setting is a ceiling — a post can narrow it and can never widen it."
    ]
  },
  {
    heading:"What other people can see",
    body:[
      "Only what your audience allows. This is enforced by the database itself, not by the app, so a bug in the app cannot widen it.",
      "The busy areas layer on the map is built from PUBLIC Moments only — posts whose audience and whose author's profile setting are both 'everyone'. A friends-only post never appears in it, and the layer looks identical to every Explorer.",
      "Check-ins and Link-ups are visible to friends, never to followers.",
      "Who watched your Moment is not shown to anybody, including you."
    ]
  },
  {
    heading:"What we do not do",
    body:[
      "We do not sell your data. We do not share it with advertisers. There is no advertising in Xplorer.",
      "We do not track you in the background. Xplorer has no background location permission and asks for nothing while it is closed.",
      "We do not build a profile of you for anyone else."
    ]
  },
  {
    heading:"Deleting your account",
    body:[
      "Settings → Account → Delete my account. Everything you posted goes: your profile, Moments, Memories, reviews, photographs and messages.",
      "What other people wrote stays. A review somebody left on a place is theirs, and a Link-up other people came to still happened.",
      "If you manage a business, property, club or event, you are asked to hand it over or close it first — otherwise deleting your account would take other people's memberships with it."
    ]
  },
  {
    heading:"Who processes it",
    body:[
      "Supabase, for the database, authentication and file storage.",
      "OpenFreeMap and OpenStreetMap, for the map itself. The map does not know who you are — no account details are sent when a tile is fetched.",
      "FOSSGIS, for directions, when you ask for them."
    ]
  },
  {
    heading:"Children",
    body:[
      "Xplorer is not for under-13s and we do not knowingly hold data about one."
    ]
  },
  {
    heading:"Getting in touch",
    body:[
      "Ask through Settings, or write to the address in the store listing."
    ]
  }
];

export const TERMS=[
  {
    heading:"What Xplorer is",
    body:[
      "A map of local businesses, places to stay, clubs and events, and a way for people to post about them.",
      "It is provided as it is. We do not promise it will always be available or always correct."
    ]
  },
  {
    heading:"Your account",
    body:[
      "You must be 13 or over.",
      "One account per person. Keep your password to yourself; what happens under your account is your responsibility.",
      "You can delete your account at any time from Settings."
    ]
  },
  {
    heading:"What you post",
    body:[
      "You keep ownership of your photographs, video and words. You give Xplorer permission to store them and to show them to the audience you chose, and nothing wider.",
      "Do not post anything unlawful, anything designed to harass somebody, or anything you do not have the right to post.",
      "Do not post somebody else's location or photograph without their agreement.",
      "Reviews must be your own honest experience. Do not review a place you have not been to, and do not review your own business."
    ]
  },
  {
    heading:"Managing a listing",
    body:[
      "If you manage a business, property, club or event, what you publish about it must be true — opening hours, availability, spaces, prices.",
      "You may reply to a review or dispute it. You may not remove one because you disagree with it.",
      "If you stop managing a listing, hand it over rather than deleting your account under it."
    ]
  },
  {
    heading:"Meeting people",
    body:[
      "Link-ups and check-ins put you in the same place as people you may not know. Use your judgement, meet somewhere public, and tell somebody where you are going.",
      "Xplorer does not vet anybody. We are not responsible for what happens when you meet."
    ]
  },
  {
    heading:"What we can do",
    body:[
      "We can remove content that breaks these terms and suspend an account that keeps breaking them.",
      "We will tell you why, unless telling you would put somebody at risk."
    ]
  },
  {
    heading:"Where the law stands",
    body:[
      "These terms are governed by the law of England and Wales."
    ]
  }
];

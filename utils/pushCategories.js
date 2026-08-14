// What a push notification can be about.
//
// The owner asked for the pushes to mirror the notifications that already
// exist rather than to invent a new set. So these are groups over the sixteen
// `type` values in public.notifications -- not a second vocabulary.
//
// EVERY ONE STARTS OFF.
//
// RULES.md: every visibility flag defaults to off and opt-in is never the
// fallback branch. That applies to a phone buzzing as much as it does to a map
// pin, and it is the difference between a notification and an interruption.
//
// The category list is here rather than in the migration so the app and the
// database cannot disagree about what a category is -- scripts/verify-push.cjs
// checks the two against each other.

export const PUSH_CATEGORIES=[
  {
    key:"messages",
    label:"Messages",
    help:"Somebody sends you a direct message, or posts on a Link-up or club board you are in.",
    types:["linkup_message","activity_message","direct_message"]
  },
  {
    key:"friends",
    label:"Friends and follows",
    help:"Somebody asks to be your friend, accepts you, or follows you.",
    types:["social_friendship","social_follow"]
  },
  {
    key:"posts",
    label:"Your posts",
    help:"Somebody likes or comments on a Moment or Memory of yours.",
    types:["social_like","social_comment"]
  },
  {
    key:"linkups",
    label:"Link-ups",
    help:"Somebody joins a Link-up of yours, or one you are going to is about to start.",
    types:["linkup_joined","linkup_reminder","linkup_follower_created"]
  },
  {
    key:"clubs",
    label:"Clubs",
    help:"Your club membership is approved or declined, or somebody asks to join a club you run.",
    types:[
      "activity_membership_approved",
      "activity_membership_rejected",
      "activity_membership_removed",
      "activity_join_request",
      "membership_request"
    ]
  },
  {
    key:"reviews",
    label:"Reviews",
    help:"Somebody reviews a place you manage, or a manager replies to a review you wrote.",
    types:["new_review","review_response","manager_summary"]
  }
];

export const PUSH_CATEGORY_KEYS=PUSH_CATEGORIES.map((entry)=>entry.key);

// social_moment is deliberately NOT in any category.
//
// It is by far the most common notification -- 302 of the 802 rows on the live
// database -- and it fires every time somebody you follow posts. As a push that
// is a phone buzzing all evening, and the first thing anybody would do is turn
// every notification off, including the ones they wanted. It stays in the app,
// where a list of them is useful and a hundred of them is not an interruption.
export const NEVER_PUSHED=["social_moment"];

export function categoryForType(type){
  const found=PUSH_CATEGORIES.find((entry)=>entry.types.includes(type));
  return found ? found.key : null;
}

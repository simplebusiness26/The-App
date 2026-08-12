// The demo logins, and the reason they are not in this file.
//
// WHAT WENT WRONG LAST TIME
// app/auth/login.js used to carry a shared password in plain text, a setup
// token, and three account emails, and it offered them as buttons to anybody
// who opened the app. All of it was confirmed readable inside the production
// web bundle. Removing the buttons did nothing about that -- the strings were
// still in every build already shipped.
//
// SO: NO SECRET LIVES IN THIS REPOSITORY
// The password comes from the environment at build time, and the admin address
// does too. A build made without them has no demo logins at all -- not a hidden
// panel with the credentials still inside it, but no credentials in the bundle
// to find. That is the whole point of doing it this way rather than hiding a
// constant behind five taps.
//
// TO TURN IT ON, put these in .env (which is gitignored) before building:
//   EXPO_PUBLIC_DEMO_PASSWORD=...
//   EXPO_PUBLIC_DEMO_ADMIN_EMAIL=...
// Leave them out of the release build and the panel reports itself as off.
//
// Both are read as literal process.env.NAME expressions on purpose: Expo
// replaces those at build time by matching the text, so a computed lookup like
// process.env[key] would silently come back undefined.

const PASSWORD=process.env.EXPO_PUBLIC_DEMO_PASSWORD || "";
const ADMIN_EMAIL=process.env.EXPO_PUBLIC_DEMO_ADMIN_EMAIL || "";

export const DEMO_ENABLED=PASSWORD.length>0;

// The message shown when somebody finds the panel in a build that has no
// credentials. It names the setting rather than saying "unavailable", because
// the person most likely to see it is the one who forgot to set it.
export const DEMO_OFF_MESSAGE=
  "Demo logins are off in this build. Set EXPO_PUBLIC_DEMO_PASSWORD before building to turn them on.";

// Order matters: this is the order they appear, and it is the order somebody
// demonstrates the app in -- an ordinary Explorer first, a second Explorer to
// show two people interacting, then the Manager tools, then admin.
export function demoAccounts(){
  if(!DEMO_ENABLED) return [];

  const accounts=[
    {
      key:"explorer",
      label:"Explorer",
      detail:"Ordinary account, Hastings",
      email:"explorer@test.com",
      password:PASSWORD
    },
    {
      key:"explorer2",
      label:"Explorer 2",
      detail:"Second account, St Leonards -- for following and friends",
      email:"explorer2@test.com",
      password:PASSWORD
    },
    {
      key:"manager",
      label:"Manager",
      detail:"Businesses, properties, clubs and events unlocked",
      email:"manager@test.com",
      password:PASSWORD
    }
  ];

  // The admin address is a real person's email, so it is never committed. No
  // EXPO_PUBLIC_DEMO_ADMIN_EMAIL means no admin button, not a broken one.
  if(ADMIN_EMAIL){
    accounts.push({
      key:"admin",
      label:"Admin",
      detail:"Full administrator -- moderation, claims, data quality",
      email:ADMIN_EMAIL,
      password:PASSWORD
    });
  }

  return accounts;
}

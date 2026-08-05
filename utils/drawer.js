// Packet 4 of docs/REDESIGN-BRIEF.md: the Quick Access drawer.
//
// Every row the drawer can show, as data. The component renders this; it does
// not decide it. That split is what lets a test assert the thing the packet is
// actually about -- that no row of the old /menu was dropped on the way here --
// without rendering anything or mocking a session.
//
// The old menu lost ten links once, silently, and five gate scripts stayed
// green through it. The lesson taken was not "be careful": it was that a list
// of links needs to be somewhere a test can read it.

// Who a row is for. Checked in this order of specificity, and never trusted as
// a security boundary -- each destination re-checks the session and RLS decides
// the data. These decide what is worth showing, not what is allowed.
export const GATES={
  ALWAYS:"always",
  SIGNED_IN:"signedIn",
  SIGNED_OUT:"signedOut",
  MANAGER:"manager",
  NON_MANAGER:"nonManager",
  ADMIN:"admin"
};

export const SECTIONS=[
  {
    key:"explore",
    title:"Explore",
    rows:[
      {label:"Map",route:"/map",gate:GATES.ALWAYS},
      {label:"Discover",route:"/discover",gate:GATES.ALWAYS},
      {label:"Live nearby",route:"/live",gate:GATES.SIGNED_IN},
      {label:"Events",route:"/events",gate:GATES.ALWAYS},
      {label:"Activity clubs",route:"/activity-clubs",gate:GATES.ALWAYS},
      // Packet 8e. Parks, beaches and viewpoints are canonical rows now, so
      // they have somewhere to be reached from.
      {label:"Public places",route:"/places",gate:GATES.ALWAYS},
      {label:"Link-ups",route:"/linkups",gate:GATES.SIGNED_IN}
    ]
  },
  {
    key:"community",
    title:"Community",
    rows:[
      {label:"Explorer feed",route:"/feed",gate:GATES.SIGNED_IN},
      {label:"Find Explorers",route:"/explorers",gate:GATES.SIGNED_IN},
      {label:"Leaderboards",route:"/leaderboards",gate:GATES.ALWAYS},
      {label:"Notifications",route:"/notifications",gate:GATES.SIGNED_IN}
    ]
  },
  {
    key:"my-app",
    title:"My app",
    rows:[
      {label:"Profile",route:"/profile",gate:GATES.SIGNED_IN},
      {label:"Check in",route:"/checkins/create",gate:GATES.SIGNED_IN},
      {label:"Keep a memory",route:"/memories/create",gate:GATES.SIGNED_IN},
      {label:"Scan a review code",route:"/scan",gate:GATES.SIGNED_IN},
      // The on-ramp. /manager/dashboard is where an Explorer requests the
      // capability to manage something, so it cannot sit behind a section that
      // only appears once they already manage something. See MANAGE below.
      {
        label:"Manager tools",
        route:"/manager/dashboard",
        gate:GATES.NON_MANAGER,
        detail:"Request the tools to manage a place, club or event."
      }
    ]
  },
  {
    key:"manage",
    title:"Manage",
    // The one section with a server-side entitlement behind it. Its rows manage
    // listings that already exist, so an Explorer who manages nothing has
    // nothing here to open -- and hooks/useManagerGate.js stops them opening it
    // anyway, because a hidden section is not a check.
    gate:GATES.MANAGER,
    rows:[
      {label:"Manager dashboard",route:"/manager/dashboard",gate:GATES.MANAGER},
      {label:"Club join requests",route:"/manager/requests",gate:GATES.MANAGER},
      {label:"Business dashboard",route:"/business/dashboard",gate:GATES.MANAGER},
      {label:"Property dashboard",route:"/property/dashboard",gate:GATES.MANAGER}
    ]
  },
  {
    key:"account",
    title:"Account and safety",
    rows:[
      {label:"Settings",route:"/settings",gate:GATES.SIGNED_IN},
      {label:"Blocked Explorers",route:"/safety/blocked",gate:GATES.SIGNED_IN},
      {label:"Review claims",route:"/admin/claims",gate:GATES.ADMIN},
      {label:"Manage public places",route:"/admin/public-places",gate:GATES.ADMIN},
      {label:"Log in",route:"/auth/login",gate:GATES.SIGNED_OUT},
      {label:"Create account",route:"/auth/signup",gate:GATES.SIGNED_OUT},
      // The only row that is not a destination.
      {label:"Log out",action:"logout",gate:GATES.SIGNED_IN}
    ]
  }
];

// `viewer` is {signedIn, isManager, isAdmin}. Deliberately explicit rather than
// a role string: an admin is not a kind of Explorer, and collapsing the two
// into one scalar is what once hid every Explorer link from admins.
export function visibleSections(viewer){
  return SECTIONS
    .filter((section)=>!section.gate || allows(section.gate,viewer))
    .map((section)=>({...section,rows:section.rows.filter((row)=>allows(row.gate,viewer))}))
    .filter((section)=>section.rows.length>0);
}

function allows(gate,viewer){
  const {signedIn=false,isManager=false,isAdmin=false}=viewer || {};

  if(gate===GATES.ALWAYS) return true;
  if(gate===GATES.SIGNED_IN) return signedIn;
  if(gate===GATES.SIGNED_OUT) return !signedIn;
  if(gate===GATES.MANAGER) return signedIn && isManager;
  if(gate===GATES.NON_MANAGER) return signedIn && !isManager;
  if(gate===GATES.ADMIN) return signedIn && isAdmin;

  // An unknown gate shows the row. The drawer failing open and saying so beats
  // it failing closed and saying nothing -- that is the defect this file was
  // written after.
  return true;
}

// Every route the drawer can reach, for the test that proves none was lost.
export function allDrawerRoutes(){
  return SECTIONS.flatMap((section)=>section.rows.filter((row)=>row.route).map((row)=>row.route));
}

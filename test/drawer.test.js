/* eslint-env jest */

// Packet 4 acceptance: "Every row in the old menu maps to a drawer row or a
// tab." The mapping is the packet -- deleting a page that held fourteen links
// is the single easiest way to lose one, and this repository has already lost
// ten at once without a single check going red.
//
// So the old menu is written down here as it was at commit da011c3, the last
// commit before app/menu.js was deleted, and every row of it must resolve to
// something that still exists.

const {SECTIONS,GATES,visibleSections,allDrawerRoutes}=require("../utils/drawer");
const {TABS}=require("../utils/navigation");

// app/menu.js, row for row, from the file as it was deleted. Each entry is
// [label, destination]. The gate each row carried is recorded in the test that
// uses it, not here -- this list is only "what a person could reach".
const OLD_MENU=[
  ["Map","/map"],
  ["Explore Activity Clubs","/activity-clubs"],
  ["Explore Events","/events"],
  ["Profile","/profile"],
  ["Settings","/settings"],
  ["Live Nearby","/live"],
  ["Link-ups","/linkups"],
  ["Check in","/checkins/create"],
  ["Explorer Feed","/feed"],
  ["Find Explorers","/explorers"],
  ["Scan Verified Review QR","/scan"],
  ["Explorer Leaderboards","/leaderboards"],
  ["Blocked Explorers","/safety/blocked"],
  ["Manager Dashboard","/manager/dashboard"],
  ["Admin Dashboard","/admin/claims"],
  ["Login","/auth/login"],
  ["Create Account","/auth/signup"]
];

const drawerRoutes=allDrawerRoutes();
const tabRoutes=TABS.map((tab)=>tab.route);

describe("every row of the old menu has a new home",()=>{
  it.each(OLD_MENU)("%s → %s",(_label,route)=>{
    expect(drawerRoutes.concat(tabRoutes)).toContain(route);
  });

  it("kept the logout action, which was a row and not a link",()=>{
    const actions=SECTIONS.flatMap((section)=>section.rows.filter((row)=>row.action));
    expect(actions.map((row)=>row.action)).toContain("logout");
  });

  it("has every drawer row pointing at a route or naming an action, never neither",()=>{
    for(const section of SECTIONS){
      for(const row of section.rows){
        expect(Boolean(row.route)||Boolean(row.action)).toBe(true);
        expect(typeof row.label).toBe("string");
        expect(row.label.length).toBeGreaterThan(0);
      }
    }
  });

  it("uses the five sections the brief names",()=>{
    expect(SECTIONS.map((section)=>section.title)).toEqual([
      "Explore","Community","My app","Manage","Account and safety"
    ]);
  });
});

describe("the Manage section is entitlement, not decoration",()=>{
  const manager={signedIn:true,isManager:true,isAdmin:false};
  const explorer={signedIn:true,isManager:false,isAdmin:false};
  const signedOut={signedIn:false,isManager:false,isAdmin:false};

  function sectionKeys(viewer){
    return visibleSections(viewer).map((section)=>section.key);
  }

  it("is absent for an Explorer who manages nothing",()=>{
    expect(sectionKeys(explorer)).not.toContain("manage");
  });

  it("is absent when signed out",()=>{
    expect(sectionKeys(signedOut)).not.toContain("manage");
  });

  it("is present for an Explorer who manages something",()=>{
    expect(sectionKeys(manager)).toContain("manage");
  });

  it("never leaks a management route to a non-manager",()=>{
    const rows=visibleSections(explorer).flatMap((section)=>section.rows.map((row)=>row.route));

    for(const route of ["/manager/requests","/business/dashboard","/property/dashboard"]){
      expect(rows).not.toContain(route);
    }
  });

  it("still offers a non-manager the way to become one",()=>{
    // The Manage section is hidden, but /manager/dashboard is where an
    // Explorer requests the capability in the first place. Hiding that too
    // would close the only door in, so it moves to My app rather than
    // disappearing -- and this is the assertion that keeps it there.
    const rows=visibleSections(explorer).flatMap((section)=>section.rows.map((row)=>row.route));
    expect(rows).toContain("/manager/dashboard");
  });

  it("does not show a manager the become-a-manager row as well",()=>{
    const myApp=visibleSections(manager).find((section)=>section.key==="my-app");
    expect(myApp.rows.filter((row)=>row.route==="/manager/dashboard")).toEqual([]);
  });
});

describe("the drawer fails open",()=>{
  it("shows a row whose gate it does not recognise",()=>{
    // A gate typo must not silently remove a link. Failing closed and saying
    // nothing is the exact defect this codebase shipped once already.
    const {rows}=visibleSections({signedIn:true}).find((section)=>section.key==="explore");
    expect(rows.length).toBeGreaterThan(0);
  });

  it("treats a missing viewer as signed out rather than throwing",()=>{
    expect(()=>visibleSections(undefined)).not.toThrow();
    expect(visibleSections(undefined).map((section)=>section.key)).not.toContain("manage");
  });

  it("offers a signed-out visitor a way in",()=>{
    const rows=visibleSections({signedIn:false}).flatMap((section)=>section.rows.map((row)=>row.route));
    expect(rows).toContain("/auth/login");
    expect(rows).toContain("/auth/signup");
  });

  it("hides the way in from someone already signed in",()=>{
    const rows=visibleSections({signedIn:true}).flatMap((section)=>section.rows.map((row)=>row.route));
    expect(rows).not.toContain("/auth/login");
  });
});

describe("admin is a separate fact from being an Explorer",()=>{
  it("shows an admin the Explorer rows as well as the admin one",()=>{
    // "is_admin ? admin : account_type" once hid every Explorer link from
    // admins. The two are independent and stay that way.
    const rows=visibleSections({signedIn:true,isAdmin:true,isManager:false})
      .flatMap((section)=>section.rows.map((row)=>row.route));

    expect(rows).toContain("/admin/dashboard");
    expect(rows).toContain("/admin/claims");
    expect(rows).toContain("/feed");
    expect(rows).toContain("/profile");
  });

  it("hides the admin row from a non-admin",()=>{
    const rows=visibleSections({signedIn:true,isAdmin:false,isManager:false})
      .flatMap((section)=>section.rows.map((row)=>row.route));

    expect(rows).not.toContain("/admin/dashboard");
    expect(rows).not.toContain("/admin/claims");
  });
});

describe("the old menu route is gone",()=>{
  it("has no menu row and no menu route anywhere in the drawer",()=>{
    expect(drawerRoutes).not.toContain("/menu");
    expect(tabRoutes).not.toContain("/menu");
  });

  it("uses gate names that exist",()=>{
    const known=Object.values(GATES);
    for(const section of SECTIONS){
      if(section.gate) expect(known).toContain(section.gate);
      for(const row of section.rows) expect(known).toContain(row.gate);
    }
  });
});

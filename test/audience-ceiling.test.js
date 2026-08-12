/* eslint-env jest */

// "I posted it and my friend cannot see it."
//
// On 2026-08-12 every one of the nineteen accounts in this database still had
// profiles.visibility = 'nobody'. That is the correct default and it is not up
// for debate — but it is a CEILING, so it meant every Moment, every Memory and
// every check-in in the app was visible to exactly nobody, and nothing anywhere
// said so. The setting was working perfectly and the app was silent about it.
//
// Two halves here:
//   the sentence somebody reads before posting (utils/audience.js)
//   the lock that stops a posted Moment being widened afterwards, which lives
//   in the database (20260812170000) and is checked against the migration.

const React=require("react");
const {act,create}=require("react-test-renderer");
const {installFixture,textOf,labelsOf}=require("./fixture");
const {FeedbackProvider}=require("../context/FeedbackContext");
const {
  audienceRank,
  effectiveAudience,
  ceilingWarning
}=require("../utils/audience");

function wrap(element){
  return React.createElement(FeedbackProvider,null,element);
}

describe("the vocabulary is the database's, narrowest first",()=>{
  it("orders the six the same way guestbook_private.audience_rank does",()=>{
    expect(audienceRank("nobody")).toBe(0);
    expect(audienceRank("selected")).toBe(1);
    expect(audienceRank("close_friends")).toBe(2);
    expect(audienceRank("friends")).toBe(3);
    // followers is WIDER than friends: following is one-way and needs nobody's
    // permission, so anybody can put themselves in it.
    expect(audienceRank("followers")).toBe(4);
    expect(audienceRank("everyone")).toBe(5);
  });

  it("ranks anything it does not recognise as nobody",()=>{
    // A typo must close access, never open it. 'public' and 'private' are the
    // two words RULES.md bans precisely because they used to mean these.
    expect(audienceRank("public")).toBe(0);
    expect(audienceRank("private")).toBe(0);
    expect(audienceRank(undefined)).toBe(0);
    expect(audienceRank("")).toBe(0);
  });

  it("takes the narrower of the profile setting and the post",()=>{
    expect(effectiveAudience("nobody","everyone")).toBe("nobody");
    expect(effectiveAudience("friends","everyone")).toBe("friends");
    // A post can always be narrower than the profile.
    expect(effectiveAudience("everyone","friends")).toBe("friends");
    expect(effectiveAudience("friends","friends")).toBe("friends");
  });
});

describe("what somebody is told",()=>{
  it("says nothing when the setting is not overruling the choice",()=>{
    expect(ceilingWarning("everyone","friends")).toBe("");
    expect(ceilingWarning("friends","friends")).toBe("");
    expect(ceilingWarning("everyone","everyone")).toBe("");
  });

  it("names the number-one case plainly, and where to fix it",()=>{
    const warning=ceilingWarning("nobody","friends");
    console.log("NOBODY >>>",warning);

    expect(warning).toContain("Nobody");
    expect(warning).toContain("Settings");
    // Says what happens, not that the person did something wrong.
    expect(warning).not.toMatch(/restricted|error|invalid/i);
  });

  it("says which audience actually applies when it is narrower, not none",()=>{
    const warning=ceilingWarning("friends","everyone");
    console.log("NARROWER >>>",warning);
    expect(warning).toContain("your friends");
    expect(warning).toContain("Settings");
  });
});

describe("the notice on a create screen",()=>{
  async function render(profileVisibility,audience){
    installFixture({
      user:{id:"me"},
      tables:{profiles:[{id:"me",visibility:profileVisibility}]},
      rpc:{}
    });

    const AudienceCeiling=require("../components/AudienceCeiling").default;
    let tree;
    await act(async()=>{
      tree=create(wrap(React.createElement(AudienceCeiling,{audience})));
    });
    await act(async()=>{});
    return tree;
  }

  it("appears when the post cannot reach who was chosen",async()=>{
    const tree=await render("nobody","friends");
    const text=textOf(tree.toJSON());
    console.log("NOTICE >>>",text);

    expect(text).toContain("Who will actually see this");
    expect(labelsOf(tree.toJSON()).join(" ")).toContain("Settings");

    await act(async()=>{tree.unmount();});
  });

  it("stays out of the way when there is nothing to say",async()=>{
    const tree=await render("everyone","friends");
    // A notice that appears every time is a notice nobody reads. The provider
    // wrapper is still there, so this asks whether the notice drew anything.
    expect(textOf(tree.toJSON())).toBe("");
    expect(labelsOf(tree.toJSON())).toEqual([]);
    await act(async()=>{tree.unmount();});
  });

  it("never blocks posting and never changes the setting itself",()=>{
    const source=require("fs").readFileSync(
      require("path").join(__dirname,"..","components","AudienceCeiling.js"),"utf8"
    );
    // It reads the profile and routes to Settings. It does not write.
    expect(source).not.toMatch(/\.update\(|\.upsert\(|\.insert\(/);
    expect(source).toContain('router.push("/settings")');
  });
});

describe("a posted Moment cannot be widened",()=>{
  const migration=require("fs").readFileSync(
    require("path").join(
      __dirname,"..","supabase","migrations",
      "20260812170000_a_moment_audience_cannot_be_widened.sql"
    ),"utf8"
  );

  it("refuses a wider audience through a trigger, not through a screen",()=>{
    expect(migration).toContain("before update of visibility on public.explorer_moments");
    expect(migration).toMatch(/audience_rank\(new\.visibility\)[\s\S]*>[\s\S]*audience_rank\(old\.visibility\)/);
    expect(migration).toContain("raise exception");
  });

  it("still allows narrowing, because taking something back is not a betrayal",()=>{
    // The only comparison is greater-than. Anything narrower or equal falls
    // through to `return new`.
    expect(migration).not.toMatch(/audience_rank\(new\.visibility\)\s*<>/);
    expect(migration).toContain("return new;");
  });

  it("leaves Memories alone, and says why",()=>{
    // explorer_memories has two settings on purpose -- one for while it is live
    // and one for afterwards -- and a lock on top would fight that model.
    expect(migration).not.toMatch(/on public\.explorer_memories/);
    expect(migration).toContain("archive_visibility");
  });
});

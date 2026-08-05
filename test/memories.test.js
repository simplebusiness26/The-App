/* eslint-env jest */

// Packet 8d: Memories.
//
// Watched failing first against a create screen that opened on Public, one
// that copied the live audience into the archive setting, a detail screen with
// its confirmation dialog removed, and a phase helper that called an expired
// Memory live.

const React=require("react");
const {act,create}=require("react-test-renderer");
const {SafeAreaProvider}=require("react-native-safe-area-context");
const {FeedbackProvider}=require("../context/FeedbackContext");
const {NotificationProvider}=require("../context/NotificationContext");
const {supabase}=require("../services/supabase");
const {Alert}=require("react-native");
const {installFixture,restoreRouterParams,labelsOf,textOf}=require("./fixture");

const memories=require("../utils/memories");
const mountedTrees=[];

function wrap(element){
  return React.createElement(
    SafeAreaProvider,
    {initialMetrics:{frame:{x:0,y:0,width:390,height:844},insets:{top:47,left:0,right:0,bottom:34}}},
    React.createElement(FeedbackProvider,null,React.createElement(NotificationProvider,null,element))
  );
}

async function render(element){
  let tree;
  await act(async()=>{
    tree=create(wrap(element));
  });
  mountedTrees.push(tree);
  return tree;
}

function pressable(tree,label){
  const hits=tree.root.findAll(
    (node)=>node.props?.accessibilityLabel===label && typeof node.props?.onPress==="function",
    {deep:true}
  );
  return hits[0] || null;
}

// A text field carries onChangeText rather than onPress, so it needs its own
// finder -- the first version of these tests used `pressable` for both and
// failed on a null, which is a broken test rather than a broken screen.
function field(tree,label){
  const hits=tree.root.findAll(
    (node)=>node.props?.accessibilityLabel===label && typeof node.props?.onChangeText==="function",
    {deep:true}
  );
  return hits[0] || null;
}

function lastCallTo(table){
  const calls=supabase.from.mock.calls;
  for(let i=calls.length-1;i>=0;i-=1){
    if(calls[i][0]===table) return supabase.from.mock.results[i].value;
  }
  return null;
}

afterEach(async()=>{
  restoreRouterParams();
  await act(async()=>{
    for(const tree of mountedTrees) tree.unmount();
  });
  mountedTrees.length=0;
});

// ---------------------------------------------------------------------------
// The lifecycle, as pure functions
// ---------------------------------------------------------------------------

describe("the two phases",()=>{
  const hour=60*60*1000;

  it("calls a Memory live only while its live period runs",()=>{
    const now=Date.now();
    expect(memories.isLive({live_until:new Date(now+hour).toISOString()},now)).toBe(true);
    expect(memories.isLive({live_until:new Date(now-hour).toISOString()},now)).toBe(false);
    // A private Memory has no live period at all, and is never "live".
    expect(memories.isLive({live_until:null},now)).toBe(false);
  });

  it("reads the live audience while live and the archive audience afterwards",()=>{
    const now=Date.now();
    const live={visibility:"public",archive_visibility:"private",live_until:new Date(now+hour).toISOString()};
    const expired={visibility:"public",archive_visibility:"private",live_until:new Date(now-hour).toISOString()};

    expect(memories.currentAudience(live,now)).toBe("Public");
    // The whole packet in one assertion: same row, later, nobody's but its own.
    expect(memories.currentAudience(expired,now)).toBe("Only me");
  });

  it("defaults both settings to the closed one",()=>{
    expect(memories.DEFAULT_MEMORY_VISIBILITY).toBe("private");
    expect(memories.DEFAULT_ARCHIVE_VISIBILITY).toBe("private");
    expect(memories.MEMORY_VISIBILITY[0].key).toBe("private");
    expect(memories.ARCHIVE_VISIBILITY[0].key).toBe("private");
  });

  it("builds a live_until in the future",()=>{
    const now=new Date("2026-08-05T00:00:00Z");
    expect(memories.liveUntilFrom("day",now)).toBe("2026-08-06T00:00:00.000Z");
    expect(memories.liveUntilFrom("week",now)).toBe("2026-08-12T00:00:00.000Z");
    // An unknown key falls back to the shortest period rather than to none.
    expect(memories.liveUntilFrom("nonsense",now)).toBe("2026-08-06T00:00:00.000Z");
  });
});

// ---------------------------------------------------------------------------
// Creating one
// ---------------------------------------------------------------------------

describe("the create screen",()=>{
  function mount(){
    const CreateMemory=require("../app/memories/create").default;
    return render(React.createElement(CreateMemory,null));
  }

  it("asks both questions separately",async()=>{
    installFixture({user:{id:"explorer-1"}});
    const tree=await mount();
    const text=textOf(tree.toJSON());

    expect(text).toContain("WHO CAN SEE IT WHILE IT IS LIVE");
    expect(text).toContain("AFTERWARDS");
  });

  it("opens on Only me for both, and says the archive starts closed",async()=>{
    installFixture({user:{id:"explorer-1"}});
    const tree=await mount();
    const labels=labelsOf(tree.toJSON());

    expect(labels).toContain("Only me: Nobody else, ever");
    expect(labels).toContain("Afterwards, Only me: It stays yours once the live period ends");
    expect(textOf(tree.toJSON())).toContain("This starts at \"Only me\" whatever you chose above");
  });

  it("hides the live period while the Memory is private, and shows it once it is not",async()=>{
    installFixture({user:{id:"explorer-1"}});
    const tree=await mount();

    expect(textOf(tree.toJSON())).not.toContain("HOW LONG IT STAYS LIVE");

    await act(async()=>{
      pressable(tree,"Public: Any Explorer, while it is live").props.onPress();
    });

    expect(textOf(tree.toJSON())).toContain("HOW LONG IT STAYS LIVE");
  });

  it("saves a private Memory with no live period and a private archive",async()=>{
    installFixture({user:{id:"explorer-1"},tables:{explorer_memories:[{id:"mem-1"}]}});
    const tree=await mount();

    await act(async()=>{
      field(tree,"Memory title").props.onChangeText("First swim");
    });
    await act(async()=>{
      pressable(tree,"Save this Memory").props.onPress();
    });

    const builder=lastCallTo("explorer_memories");
    expect(builder).not.toBeNull();

    const payload=builder.insert.mock.calls[0][0];
    expect(payload.visibility).toBe("private");
    expect(payload.live_until).toBeNull();
    expect(payload.archive_visibility).toBe("private");
    expect(payload.show_on_profile).toBe(false);
  });

  it("gives a public Memory a live period and still leaves its archive private",async()=>{
    installFixture({user:{id:"explorer-1"},tables:{explorer_memories:[{id:"mem-2"}]}});
    const tree=await mount();

    await act(async()=>{
      field(tree,"Memory title").props.onChangeText("Pier at sunset");
    });
    await act(async()=>{
      pressable(tree,"Public: Any Explorer, while it is live").props.onPress();
    });
    await act(async()=>{
      pressable(tree,"Save this Memory").props.onPress();
    });

    const payload=lastCallTo("explorer_memories").insert.mock.calls[0][0];
    expect(payload.visibility).toBe("public");
    expect(typeof payload.live_until).toBe("string");
    expect(new Date(payload.live_until).getTime()).toBeGreaterThan(Date.now());
    // Chosen once, for the live phase only. The archive is a second decision.
    expect(payload.archive_visibility).toBe("private");
  });
});

// ---------------------------------------------------------------------------
// Reading one
// ---------------------------------------------------------------------------

describe("the detail screen",()=>{
  const base={
    id:"mem-1",
    user_id:"owner-1",
    title:"First swim",
    note:"Cold.",
    media_url:null,
    target_type:null,
    target_id:null,
    target_name:null,
    visibility:"public",
    archive_visibility:"private",
    show_on_profile:false,
    status:"published"
  };

  function mount(){
    const MemoryPage=require("../app/memories/[id]").default;
    return render(React.createElement(MemoryPage,null));
  }

  it("tells the owner who can see it now, and it is not who could see it before",async()=>{
    const expired={...base,live_until:new Date(Date.now()-60*60*1000).toISOString()};
    installFixture({
      user:{id:"owner-1"},
      params:{id:"mem-1"},
      tables:{explorer_memories:[expired],explorer_memory_shares:[],explorer_follows:[]}
    });

    const tree=await mount();
    const text=textOf(tree.toJSON());

    expect(text).toContain("Archived");
    expect(text).toContain("WHO CAN SEE IT NOW");
    expect(text).toContain("Only me");
    expect(text).toContain("Changing this never puts the Memory back on the live map");
  });

  it("offers the owner's controls only to the owner",async()=>{
    const live={...base,live_until:new Date(Date.now()+60*60*1000).toISOString()};
    installFixture({
      user:{id:"someone-else"},
      params:{id:"mem-1"},
      tables:{explorer_memories:[live]}
    });

    const tree=await mount();
    const labels=labelsOf(tree.toJSON());

    expect(labels).not.toContain("Delete this Memory");
    expect(labels).not.toContain("Show this Memory on my profile");
  });

  it("confirms before deleting",async()=>{
    const live={...base,live_until:new Date(Date.now()+60*60*1000).toISOString()};
    installFixture({
      user:{id:"owner-1"},
      params:{id:"mem-1"},
      tables:{explorer_memories:[live],explorer_memory_shares:[],explorer_follows:[]}
    });

    const tree=await mount();

    await act(async()=>{
      pressable(tree,"Delete this Memory").props.onPress();
    });

    expect(Alert.alert).toHaveBeenCalled();
    const [title,,buttons]=Alert.alert.mock.calls[Alert.alert.mock.calls.length-1];
    expect(title).toContain("Delete this Memory");
    expect(buttons.some((button)=>button.style==="destructive")).toBe(true);
  });

  it("says so when the Memory is not shared with the viewer",async()=>{
    installFixture({user:{id:"stranger"},params:{id:"mem-1"},tables:{explorer_memories:[]}});

    const tree=await mount();
    expect(textOf(tree.toJSON())).toContain("not shared with you");
  });
});

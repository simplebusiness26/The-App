/* eslint-env jest */

// CAPTURE DEFAULTS -- the configuration rung of the locked camera spec.
//
// "Grid overlay, save-to-library, default video quality/compression live in
// Account & Safety > Capture defaults." There was no group, no module and no
// table: the viewfinder had nothing to obey, so the three decisions a person
// makes once were three decisions nobody could make at all.
//
// These tests cover the two halves that can go wrong independently: the
// preference module's own answers (what a missing row means, what an unknown
// value falls back to) and the Settings group that writes them.

const React=require("react");
const {act,create}=require("react-test-renderer");
const {installFixture,labelsOf,textOf,restoreRouterParams}=require("./fixture");
const {FeedbackProvider}=require("../context/FeedbackContext");
const {supabase}=require("../services/supabase");

const {
  captureCopyIsSupported,
  defaultCapturePreferences,
  keepACopy,
  loadCapturePreferences,
  normaliseCapturePreferences,
  saveCapturePreferences,
  VIDEO_QUALITIES,
  VIDEO_QUALITY_KEYS
}=require("../utils/capturePreferences");

afterEach(()=>{restoreRouterParams();});

// ---------------------------------------------------------------------------
// The module
// ---------------------------------------------------------------------------

test("nothing is switched on for somebody who never asked",()=>{
  // The same rule utils/push.js follows, for the same reason: opt-in is never
  // the fallback branch, and a missing row must not read as "on".
  expect(defaultCapturePreferences()).toEqual({
    grid:false,
    saveToLibrary:false,
    videoQuality:"1080p"
  });
});

test("a missing row is the defaults, not a crash and not an empty camera",async()=>{
  installFixture({user:{id:"me"},tables:{},rpc:{}});
  await expect(loadCapturePreferences("me")).resolves.toEqual(defaultCapturePreferences());
  // Signed out is the defaults too -- the camera opens either way.
  await expect(loadCapturePreferences(null)).resolves.toEqual(defaultCapturePreferences());
});

test("a row is read into the one shape the app uses",async()=>{
  installFixture({
    user:{id:"me"},
    tables:{capture_preferences:[{user_id:"me",grid_overlay:true,save_to_library:true,video_quality:"2160p"}]},
    rpc:{}
  });

  await expect(loadCapturePreferences("me")).resolves.toEqual({
    grid:true,
    saveToLibrary:true,
    videoQuality:"2160p"
  });
});

test("a quality the camera would reject falls back rather than reaching expo-camera",()=>{
  // An older row, or a hand-edited one. Handing '4:3' or '9000p' to
  // CameraView's videoQuality prop is how a camera fails to start.
  expect(normaliseCapturePreferences({video_quality:"9000p"}).videoQuality).toBe("1080p");
  expect(VIDEO_QUALITY_KEYS).toEqual(["720p","1080p","2160p"]);
  expect(VIDEO_QUALITIES.every((quality)=>quality.help)).toBe(true);
});

test("saving writes the three columns, and only for a signed-in Explorer",async()=>{
  installFixture({user:{id:"me"},tables:{},rpc:{}});

  const upsert=jest.fn(()=>Promise.resolve({error:null}));
  supabase.from.mockImplementation(()=>({upsert}));

  await saveCapturePreferences("me",{grid:true,saveToLibrary:false,videoQuality:"720p"});

  expect(upsert).toHaveBeenCalledTimes(1);
  const [row,options]=upsert.mock.calls[0];
  expect(row).toMatchObject({
    user_id:"me",
    grid_overlay:true,
    save_to_library:false,
    video_quality:"720p"
  });
  expect(options).toEqual({onConflict:"user_id"});

  await expect(saveCapturePreferences(null,{})).resolves.toEqual({error:"Not signed in."});
});

test("a copy nobody asked for is never made, and a failed copy never loses the capture",async()=>{
  // Off is off: the guard returns before expo-file-system is even required, so
  // a preference nobody turned on pulls no native module into the bundle.
  await expect(keepACopy("file:///tmp/shot.jpg",{saveToLibrary:false}))
    .resolves.toEqual({saved:false,error:""});
  await expect(keepACopy("",{saveToLibrary:true}))
    .resolves.toEqual({saved:false,error:""});

  // And in this test environment there is no document directory to copy into,
  // which must come back as a reported failure rather than a thrown one -- the
  // photo has already been taken by then.
  const result=await keepACopy("file:///tmp/shot.jpg",{saveToLibrary:true});
  expect(result.saved).toBe(false);
  expect(typeof result.error).toBe("string");
});

test("keeping a copy is a phone capability, and Settings is told so",()=>{
  // Platform.OS is 'ios' under jest-expo. The browser branch is what Settings
  // reads to draw a sentence instead of a switch that would do nothing.
  expect(captureCopyIsSupported()).toBe(true);
});

// ---------------------------------------------------------------------------
// The group in Account & Safety
// ---------------------------------------------------------------------------

function wrap(element){
  return React.createElement(FeedbackProvider,null,element);
}

async function openSettings(row){
  installFixture({
    user:{id:"me"},
    tables:{
      profiles:[{id:"me",name:"Sam",visibility:"friends"}],
      manager_capabilities:[],
      capture_preferences:row ? [row] : []
    },
    rpc:{}
  });

  const Settings=require("../app/settings").default;
  let tree;
  await act(async()=>{tree=create(wrap(React.createElement(Settings)));});
  await act(async()=>{});
  return tree;
}

test("Capture defaults is a group in Account & Safety, with all three settings",async()=>{
  const tree=await openSettings(null);

  const text=textOf(tree.toJSON());
  expect(text).toContain("Capture defaults");
  expect(text).toContain("Grid overlay");
  expect(text).toContain("Keep a copy on this phone");

  const labels=labelsOf(tree.toJSON()).join(" | ");
  expect(labels).toContain("Show a grid in the viewfinder");
  expect(labels).toContain("Keep a copy of every capture on this phone");
  // Every quality the camera accepts, spoken as a sentence rather than a size.
  for(const quality of VIDEO_QUALITIES){
    expect(labels).toContain(`Record video at ${quality.label}`);
  }

  await act(async()=>{tree.unmount();});
});

test("the group shows what is already stored, and writes a change straight through",async()=>{
  const tree=await openSettings({
    user_id:"me",
    grid_overlay:true,
    save_to_library:false,
    video_quality:"720p"
  });

  const grid=tree.root.findAll(
    (node)=>node.props?.accessibilityLabel==="Show a grid in the viewfinder"
      && typeof node.props?.onPress==="function",
    {deep:true}
  )[0];
  expect(grid.props.accessibilityState.checked).toBe(true);

  const upsert=jest.fn(()=>Promise.resolve({error:null}));
  supabase.from.mockImplementation(()=>({upsert}));

  await act(async()=>{grid.props.onPress();});

  expect(upsert).toHaveBeenCalledTimes(1);
  expect(upsert.mock.calls[0][0]).toMatchObject({
    user_id:"me",
    grid_overlay:false,
    video_quality:"720p"
  });

  await act(async()=>{tree.unmount();});
});

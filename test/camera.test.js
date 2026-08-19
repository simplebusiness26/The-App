/* eslint-env jest */

// "the camera button should open a real camera that scans qr and takes
//  moments/memories"
//
// It did not. The raised centre button said Camera and opened
// /moments/create -- the PHOTO LIBRARY -- so the one control in this app named
// after a camera was the one control that could not take a picture.
// launchCameraAsync appeared in no file at all.

const React=require("react");
const {act,create}=require("react-test-renderer");
const {installFixture,textOf,labelsOf,restoreRouterParams}=require("./fixture");
const {extractQrCode}=require("../utils/qr");
const {assetFromCameraUri}=require("../utils/socialMedia");
const expoRouter=require("expo-router");

const camera=require("expo-camera");
const {QR_FLAG_DWELL_MS}=require("../components/CameraCapture");

beforeEach(()=>{
  camera.__setCameraPermission({granted:true,status:"granted"});
  camera.__setNextPicture({uri:"file:///tmp/shot.jpg",width:1000,height:1000});
});

afterEach(()=>{restoreRouterParams();});

// The old raised centre button (utils/navigation.js's centreButton()) is gone
// -- Create is a global floating action now, not a tab-bar slot that changes
// meaning on the map. See components/CreateHub.js and utils/navigation.js's
// own notes. The camera itself is unchanged and untested here by that route:
// every test below mounts app/camera.js directly, which is what actually
// matters -- a real camera, live, whether it is reached via the /camera route
// or the Create hub's default surface (components/CameraCapture.js is shared
// by both, see that file's own comment).

describe("the viewfinder",()=>{
  async function render(){
    installFixture({user:{id:"me"},tables:{},rpc:{}});
    const Camera=require("../app/camera").default;
    let tree;
    await act(async()=>{tree=create(React.createElement(Camera));});
    await act(async()=>{});
    return tree;
  }

  it("offers a shutter and a way to type a code, with the camera live",async()=>{
    const tree=await render();
    const labels=labelsOf(tree.toJSON());
    console.log("CAMERA CONTROLS >>>",labels.join(" | "));

    expect(labels).toContain("Press for a photo, hold to record a video");
    expect(labels).toContain("Type a QR code by hand");

    await act(async()=>{tree.unmount();});
  });

  it("watches for a QR code the whole time rather than making it a mode",async()=>{
    const tree=await render();

    // The scanner is wired to the live viewfinder, not behind a toggle. If it
    // were a mode, you would hold the phone up to a code and have to notice you
    // were in the wrong one first.
    // Host elements only -- a forwardRef component shows up twice in the tree,
    // once as the wrapper and once as the thing it rendered.
    const view=tree.root.findAll(
      (node)=>typeof node.type==="string" && typeof node.props?.onBarcodeScanned==="function",
      {deep:true}
    );
    expect(view.length).toBe(1);
    expect(view[0].props.barcodeScannerSettings).toEqual({barcodeTypes:["qr"]});

    await act(async()=>{tree.unmount();});
  });

  // THE FLAG COMES FIRST, AND THAT IS A DELIBERATE CHANGE.
  //
  // This used to assert that a recognised code navigated in the same tick. It
  // did -- silently -- so the only evidence the camera had seen anything was
  // the page you suddenly found yourself on. The locked spec calls for an
  // in-viewfinder flag "only appears once a code is recognized", so the code is
  // now shown for QR_FLAG_DWELL_MS and then opened. The route target is
  // unchanged, and asserting both halves is stronger than asserting one.
  it("shows the code it found before it opens it, and ignores anything else",async()=>{
    jest.useFakeTimers();

    try{
      const tree=await render();
      const scanner=tree.root.findAll(
        (node)=>typeof node.props?.onBarcodeScanned==="function",
        {deep:true}
      )[0];

      // Somebody else's QR code -- a wifi code, a poster, a train ticket.
      await act(async()=>{scanner.props.onBarcodeScanned({data:"https://example.com/hello"});});
      await act(async()=>{jest.advanceTimersByTime(QR_FLAG_DWELL_MS+50);});
      expect(expoRouter.router.push).not.toHaveBeenCalled();
      expect(textOf(tree.toJSON())).not.toContain("CODE FOUND");

      await act(async()=>{
        scanner.props.onBarcodeScanned({data:"https://xplorer.app/qr/abc123"});
      });

      // Seen, said so, and still here.
      expect(textOf(tree.toJSON())).toContain("CODE FOUND");
      expect(textOf(tree.toJSON())).toContain("abc123");
      expect(expoRouter.router.push).not.toHaveBeenCalled();

      await act(async()=>{jest.advanceTimersByTime(QR_FLAG_DWELL_MS+50);});
      expect(expoRouter.router.push).toHaveBeenCalledWith("/qr/abc123");

      await act(async()=>{tree.unmount();});
    }finally{
      jest.useRealTimers();
    }
  });

  it("stops reading once it has read one, so the same code is not opened twice",async()=>{
    jest.useFakeTimers();

    try{
      const tree=await render();
      const scanner=tree.root.findAll(
        (node)=>typeof node.props?.onBarcodeScanned==="function",
        {deep:true}
      )[0];

      await act(async()=>{
        scanner.props.onBarcodeScanned({data:"https://xplorer.app/qr/abc123"});
        scanner.props.onBarcodeScanned({data:"https://xplorer.app/qr/abc123"});
      });
      await act(async()=>{jest.advanceTimersByTime(QR_FLAG_DWELL_MS+50);});

      expect(expoRouter.router.push).toHaveBeenCalledTimes(1);

      await act(async()=>{tree.unmount();});
    }finally{
      jest.useRealTimers();
    }
  });
});

// ---------------------------------------------------------------------------
// The complexity ladder the locked spec names, on the camera surface
// ---------------------------------------------------------------------------
//
// Every one of these was in the spec and none of them was in the code: the app
// got the design system and not the features, twice. They are asserted through
// the real screen and, where a control is backed by an expo-camera prop, on the
// prop rather than on the label -- a chip that says FLASH ON while the camera
// is set to off is the failure worth catching.

describe("the immediate rung",()=>{
  async function render(){
    installFixture({user:{id:"me"},tables:{},rpc:{}});
    const Camera=require("../app/camera").default;
    let tree;
    await act(async()=>{tree=create(React.createElement(Camera));});
    await act(async()=>{});
    return tree;
  }

  function cameraView(tree){
    return tree.root.findAll(
      (node)=>typeof node.type==="string" && node.props?.mode!==undefined,
      {deep:true}
    )[0];
  }

  function pressLabel(tree,label){
    const control=tree.root.findAll(
      (node)=>node.props?.accessibilityLabel===label && typeof node.props?.onPress==="function",
      {deep:true}
    )[0];
    expect(control).toBeDefined();
    return control;
  }

  it("cycles the flash off, auto, on -- and says what the next tap will do",async()=>{
    const tree=await render();
    expect(cameraView(tree).props.flash).toBe("off");

    await act(async()=>{pressLabel(tree,"Flash is off. Tap to set the flash to automatic.").props.onPress();});
    expect(cameraView(tree).props.flash).toBe("auto");

    await act(async()=>{pressLabel(tree,"Flash is automatic. Tap to set the flash to on.").props.onPress();});
    expect(cameraView(tree).props.flash).toBe("on");

    await act(async()=>{pressLabel(tree,"Flash is on. Tap to set the flash to off.").props.onPress();});
    expect(cameraView(tree).props.flash).toBe("off");

    await act(async()=>{tree.unmount();});
  });

  it("offers the four zoom presets the spec names, and moves the camera",async()=>{
    const {ZOOM_STOPS,zoomPropFor}=require("../components/CameraCapture");
    expect(ZOOM_STOPS).toEqual([0.5,1,2,3]);

    const tree=await render();
    // expo-camera's zoom is 0-1, a fraction of the device maximum -- not a
    // magnification. The presets speak in factors and one table maps them.
    await act(async()=>{pressLabel(tree,"Zoom to 3 times").props.onPress();});
    expect(cameraView(tree).props.zoom).toBe(zoomPropFor(3));
    expect(textOf(tree.toJSON())).toContain("3×");

    await act(async()=>{pressLabel(tree,"Zoom to 1 times").props.onPress();});
    expect(cameraView(tree).props.zoom).toBe(zoomPropFor(1));

    await act(async()=>{tree.unmount();});
  });

  it("draws all five capture-hub branches, one tap each",async()=>{
    const {CAPTURE_BRANCHES}=require("../components/CameraCapture");
    expect(CAPTURE_BRANCHES.map((branch)=>branch.label))
      .toEqual(["Moment","Memory","Check in","Scan","Review"]);

    const tree=await render();
    const labels=labelsOf(tree.toJSON());
    for(const branch of CAPTURE_BRANCHES) expect(labels).toContain(branch.spoken);

    // The routes the hub used to own are unchanged, and the two the spec added
    // go to the screens that make a Moment and a Memory.
    await act(async()=>{pressLabel(tree,"Post a Moment").props.onPress();});
    expect(expoRouter.router.push).toHaveBeenCalledWith("/moments/create");

    await act(async()=>{pressLabel(tree,"Keep a Memory").props.onPress();});
    expect(expoRouter.router.push).toHaveBeenCalledWith("/memories/create");

    await act(async()=>{pressLabel(tree,"Check in somewhere").props.onPress();});
    expect(expoRouter.router.push).toHaveBeenCalledWith("/checkins/create");

    await act(async()=>{pressLabel(tree,"Scan or type a code").props.onPress();});
    expect(expoRouter.router.push).toHaveBeenCalledWith("/scan");

    await act(async()=>{tree.unmount();});
  });
});

describe("the precision tray",()=>{
  async function render(){
    installFixture({user:{id:"me"},tables:{},rpc:{}});
    const Camera=require("../app/camera").default;
    let tree;
    await act(async()=>{tree=create(React.createElement(Camera));});
    await act(async()=>{});
    return tree;
  }

  function cameraView(tree){
    return tree.root.findAll(
      (node)=>typeof node.type==="string" && node.props?.mode!==undefined,
      {deep:true}
    )[0];
  }

  function control(tree,label){
    return tree.root.findAll(
      (node)=>node.props?.accessibilityLabel===label && typeof node.props?.onPress==="function",
      {deep:true}
    )[0];
  }

  it("is one chevron at rest, and opens and closes on that one tap",async()=>{
    const tree=await render();

    const open=control(tree,"Open the precision controls");
    expect(open).toBeDefined();
    // Shut, nothing inside it is reachable -- by a finger or by a screen
    // reader. It is a chevron and nothing else until somebody asks.
    const shut=tree.root.findAll(
      (node)=>node.props?.accessibilityElementsHidden===true,
      {deep:true}
    );
    expect(shut.length).toBeGreaterThan(0);

    await act(async()=>{open.props.onPress();});
    expect(control(tree,"Close the precision controls")).toBeDefined();

    await act(async()=>{control(tree,"Close the precision controls").props.onPress();});
    expect(control(tree,"Open the precision controls")).toBeDefined();

    await act(async()=>{tree.unmount();});
  });

  it("holds the zoom dial, and the dial and the presets are the same setting",async()=>{
    const {zoomPropFor}=require("../components/CameraCapture");
    const tree=await render();

    await act(async()=>{control(tree,"Open the precision controls").props.onPress();});

    // The dial's detents are finer than the four presets -- that is what makes
    // it the fine control -- and it reads out the factor it is on.
    const halfStop=control(tree,"1.5×");
    expect(halfStop).toBeDefined();
    await act(async()=>{halfStop.props.onPress();});

    expect(cameraView(tree).props.zoom).toBe(zoomPropFor(1.5));
    expect(textOf(tree.toJSON())).toContain("ZOOM");
    expect(textOf(tree.toJSON())).toContain("1.5×");

    await act(async()=>{tree.unmount();});
  });

  it("wires focus lock, stabilisation and silent recording to real camera props",async()=>{
    const tree=await render();
    await act(async()=>{control(tree,"Open the precision controls").props.onPress();});

    // The defaults first. Stabilisation on is expo-camera's own default, and
    // sound on is the owner's decision -- the toggle is the override.
    expect(cameraView(tree).props.autofocus).toBe("off");
    expect(cameraView(tree).props.videoStabilizationMode).toBe("auto");
    expect(cameraView(tree).props.mute).toBe(false);

    await act(async()=>{control(tree,"Lock the focus").props.onPress();});
    expect(cameraView(tree).props.autofocus).toBe("on");

    await act(async()=>{control(tree,"Steady the recording").props.onPress();});
    expect(cameraView(tree).props.videoStabilizationMode).toBe("off");

    await act(async()=>{control(tree,"Record without sound").props.onPress();});
    expect(cameraView(tree).props.mute).toBe(true);

    await act(async()=>{tree.unmount();});
  });
});

describe("the capture defaults",()=>{
  function cameraView(tree){
    return tree.root.findAll(
      (node)=>typeof node.type==="string" && node.props?.mode!==undefined,
      {deep:true}
    )[0];
  }

  async function renderWith(row){
    installFixture({user:{id:"me"},tables:{capture_preferences:row?[row]:[]},rpc:{}});
    const Camera=require("../app/camera").default;
    let tree;
    await act(async()=>{tree=create(React.createElement(Camera));});
    await act(async()=>{});
    return tree;
  }

  it("draws no grid until somebody asks for one, and the quality is the default",async()=>{
    const tree=await renderWith(null);
    expect(gridLines(tree)).toBe(0);
    expect(cameraView(tree).props.videoQuality).toBe("1080p");
    await act(async()=>{tree.unmount();});
  });

  it("honours the grid and the video quality the preference row carries",async()=>{
    const tree=await renderWith({
      user_id:"me",
      grid_overlay:true,
      save_to_library:false,
      video_quality:"720p"
    });

    // Rule of thirds: two lines each way, and none of them in the picture.
    expect(gridLines(tree)).toBe(4);
    expect(cameraView(tree).props.videoQuality).toBe("720p");

    await act(async()=>{tree.unmount();});
  });
});

// The grid is four hairlines drawn over the feed. Counting them is how a test
// can tell a grid that is drawn from a preference that was merely read.
function gridLines(tree){
  return tree.root.findAll(
    (node)=>{
      if(typeof node.type!=="string") return false;
      const style=Object.assign({},...flatten(node.props?.style));
      return style.position==="absolute" && style.opacity===0.3
        && (style.width===1 || style.height===1);
    },
    {deep:true}
  ).length;
}

function flatten(style){
  if(!style) return [];
  if(Array.isArray(style)) return style.flatMap(flatten);
  if(typeof style!=="object") return [];
  return [style];
}

describe("what a photo becomes",()=>{
  it("asks Moment or Memory, and hands the file to whichever was chosen",async()=>{
    installFixture({user:{id:"me"},tables:{},rpc:{}});
    const Camera=require("../app/camera").default;

    let tree;
    await act(async()=>{tree=create(React.createElement(Camera));});
    await act(async()=>{});

    const shutter=tree.root.findAll(
      // onPressIn/onPressOut, not onPress: React Native fires onPress on release
      // as well as onLongPress on some platforms, so a hold would leave a stray
      // photograph behind every recording. utils/shutter.js decides which
      // happened.
      (node)=>node.props?.accessibilityLabel==="Press for a photo, hold to record a video"
        && typeof node.props?.onPressIn==="function",
      {deep:true}
    )[0];

    // A quick press: down and straight back up, well inside HOLD_MS. That is a
    // photograph, and it must not also start a recording.
    await act(async()=>{shutter.props.onPressIn();});
    await act(async()=>{shutter.props.onPressOut();});
    await act(async()=>{});

    const text=textOf(tree.toJSON());
    console.log("AFTER THE SHUTTER >>>",text);

    expect(text).toContain("What is this?");
    expect(text).toContain("A Moment");
    expect(text).toContain("A Memory");
    // And the picture is on screen, so nobody is choosing blind.
    expect(labelsOf(tree.toJSON())).toContain("Take it again");

    const moment=tree.root.findAll(
      (n)=>n.props?.accessibilityLabel==="Post this as a Moment" && typeof n.props?.onPress==="function",
      {deep:true}
    )[0];
    await act(async()=>{moment.props.onPress();});

    expect(expoRouter.router.push).toHaveBeenCalledWith(
      `/moments/create?photo=${encodeURIComponent("file:///tmp/shot.jpg")}`
    );

    await act(async()=>{tree.unmount();});
  });

  it("hands it to the Memory screen when that is the answer",async()=>{
    installFixture({user:{id:"me"},tables:{},rpc:{}});
    const Camera=require("../app/camera").default;

    let tree;
    await act(async()=>{tree=create(React.createElement(Camera));});
    await act(async()=>{});

    const shutter=tree.root.findAll(
      (n)=>n.props?.accessibilityLabel==="Press for a photo, hold to record a video"
        && typeof n.props?.onPressIn==="function",
      {deep:true}
    )[0];
    await act(async()=>{shutter.props.onPressIn();});
    await act(async()=>{shutter.props.onPressOut();});
    await act(async()=>{});

    const memory=tree.root.findAll(
      (n)=>n.props?.accessibilityLabel==="Keep this as a Memory" && typeof n.props?.onPress==="function",
      {deep:true}
    )[0];
    await act(async()=>{memory.props.onPress();});

    expect(expoRouter.router.push).toHaveBeenCalledWith(
      `/memories/create?photo=${encodeURIComponent("file:///tmp/shot.jpg")}`
    );

    await act(async()=>{tree.unmount();});
  });

  it("asks for permission before showing a viewfinder",async()=>{
    camera.__setCameraPermission({granted:false,status:"undetermined"});
    installFixture({user:{id:"me"},tables:{},rpc:{}});
    const Camera=require("../app/camera").default;

    let tree;
    await act(async()=>{tree=create(React.createElement(Camera));});
    await act(async()=>{});

    const labels=labelsOf(tree.toJSON());
    expect(labels).toContain("Allow camera access");
    expect(labels).not.toContain("Press for a photo, hold to record a video");
    // And there is still a way to use a code without giving camera access.
    expect(labels).toContain("Enter a QR code by hand instead");

    await act(async()=>{tree.unmount();});
  });

  it("turns a camera file path into something the upload can read",()=>{
    const asset=assetFromCameraUri("file:///tmp/shot.jpg");

    // uploadSocialAsset fetches asset.uri when there is no File object, which
    // is the path a native camera capture takes.
    expect(asset.uri).toBe("file:///tmp/shot.jpg");
    expect(asset.previewUri).toBe("file:///tmp/shot.jpg");
    expect(asset.mimeType).toBe("image/jpeg");
    // Nothing here made an object URL, so nothing here should revoke one.
    expect(asset.ownsPreviewUri).toBe(false);

    expect(assetFromCameraUri("")).toBeNull();
    expect(assetFromCameraUri(null)).toBeNull();
  });
});

describe("reading a code",()=>{
  it("is one function, shared by the camera and the typed-in box",()=>{
    expect(extractQrCode("https://xplorer.app/qr/abc123")).toBe("abc123");
    expect(extractQrCode("/qr/abc123")).toBe("abc123");
    expect(extractQrCode("a".repeat(24))).toBe("a".repeat(24));
    expect(extractQrCode("https://example.com/hello")).toBe("");
    expect(extractQrCode("")).toBe("");

    const scan=require("fs").readFileSync(
      require("path").join(__dirname,"..","app","scan.js"),"utf8"
    );
    // Not a second copy in app/scan.js. Two copies is how a code starts working
    // on one screen and not the other.
    expect(scan).toContain('from "../utils/qr"');
    expect(scan).not.toContain("function extractQrCode");
  });
});

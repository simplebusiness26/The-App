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
const {centreButton}=require("../utils/navigation");
const expoRouter=require("expo-router");

const camera=require("expo-camera");

beforeEach(()=>{
  camera.__setCameraPermission({granted:true,status:"granted"});
  camera.__setNextPicture({uri:"file:///tmp/shot.jpg",width:1000,height:1000});
});

afterEach(()=>{restoreRouterParams();});

it("the centre button on the map opens the camera, not the photo library",()=>{
  expect(centreButton("/map").route).toBe("/camera");
});

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

    expect(labels).toContain("Take a photo");
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

  it("opens a Xplorer code it sees, and ignores anything else",async()=>{
    const tree=await render();
    const scanner=tree.root.findAll(
      (node)=>typeof node.props?.onBarcodeScanned==="function",
      {deep:true}
    )[0];

    // Somebody else's QR code -- a wifi code, a poster, a train ticket.
    await act(async()=>{scanner.props.onBarcodeScanned({data:"https://example.com/hello"});});
    expect(expoRouter.router.push).not.toHaveBeenCalled();

    await act(async()=>{
      scanner.props.onBarcodeScanned({data:"https://xplorer.app/qr/abc123"});
    });
    expect(expoRouter.router.push).toHaveBeenCalledWith("/qr/abc123");

    await act(async()=>{tree.unmount();});
  });
});

describe("what a photo becomes",()=>{
  it("asks Moment or Memory, and hands the file to whichever was chosen",async()=>{
    installFixture({user:{id:"me"},tables:{},rpc:{}});
    const Camera=require("../app/camera").default;

    let tree;
    await act(async()=>{tree=create(React.createElement(Camera));});
    await act(async()=>{});

    const shutter=tree.root.findAll(
      (node)=>node.props?.accessibilityLabel==="Take a photo" && typeof node.props?.onPress==="function",
      {deep:true}
    )[0];

    await act(async()=>{await shutter.props.onPress();});

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
      (n)=>n.props?.accessibilityLabel==="Take a photo" && typeof n.props?.onPress==="function",
      {deep:true}
    )[0];
    await act(async()=>{await shutter.props.onPress();});

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
    expect(labels).not.toContain("Take a photo");
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

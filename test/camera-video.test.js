/* eslint-env jest */

// Press for a photo, hold to record.
//
// The owner: "what is the deal with the video camera because I don't see this
// anywhere? I want ONE camera: press = photo, hold = record video, and the same
// camera scans QR codes."
//
// There was no video capture anywhere in the app. app/camera.js took a picture;
// recording did not exist, and neither did a way to hand a recording to the
// screens that post one.

const React=require("react");
const {act,create}=require("react-test-renderer");
const {installFixture,labelsOf,textOf,restoreRouterParams}=require("./fixture");
const expoRouter=require("expo-router");
const camera=require("expo-camera");

const {
  createShutter,
  HOLD_MS,
  MAX_RECORDING_SECONDS,
  SHUTTER_RECORDING
}=require("../utils/shutter");
const {assetFromCameraUri,mediaKindFromUri}=require("../utils/socialMedia");

// ---------------------------------------------------------------------------
// The timing rule, with no camera anywhere near it
// ---------------------------------------------------------------------------

function shutterWithClock(handlers){
  let fire=null;
  const shutter=createShutter({
    ...handlers,
    setTimer:(fn)=>{fire=fn;return 1;},
    clearTimer:()=>{fire=null;}
  });
  return{shutter,hold:()=>{const go=fire;fire=null;go?.();}};
}

test("a quick press is a photo, and never a recording",()=>{
  const onPhoto=jest.fn();
  const onRecord=jest.fn();
  const {shutter}=shutterWithClock({onPhoto,onRecord});

  shutter.pressIn();
  shutter.pressOut();

  expect(onPhoto).toHaveBeenCalledTimes(1);
  expect(onRecord).not.toHaveBeenCalled();
});

// The one that matters. React Native fires onPress on release AS WELL as
// onLongPress on some platforms, so the obvious wiring leaves a stray
// photograph behind every single recording.
test("a hold is a recording, and never also a photo",()=>{
  const onPhoto=jest.fn();
  const onRecord=jest.fn();
  const onStop=jest.fn();
  const {shutter,hold}=shutterWithClock({onPhoto,onRecord,onStop});

  shutter.pressIn();
  hold();
  expect(onRecord).toHaveBeenCalledTimes(1);
  expect(shutter.state()).toBe(SHUTTER_RECORDING);

  shutter.pressOut();
  expect(onStop).toHaveBeenCalledTimes(1);
  expect(onPhoto).not.toHaveBeenCalled();
});

test("letting go before the timer fires takes the photo",()=>{
  const onPhoto=jest.fn();
  const onRecord=jest.fn();
  const {shutter,hold}=shutterWithClock({onPhoto,onRecord});

  shutter.pressIn();
  shutter.pressOut();
  // The timer would have fired here if it had not been cleared.
  hold();

  expect(onPhoto).toHaveBeenCalledTimes(1);
  expect(onRecord).not.toHaveBeenCalled();
});

test("a recording that stops itself does not become a photo when you let go",()=>{
  // recordAsync resolves at maxDuration with no stopRecording call. The finger
  // may still be down, and releasing it must not then take a picture.
  const onPhoto=jest.fn();
  const onStop=jest.fn();
  const {shutter,hold}=shutterWithClock({onPhoto,onStop});

  shutter.pressIn();
  hold();
  shutter.finished();
  shutter.pressOut();

  expect(onPhoto).not.toHaveBeenCalled();
  expect(onStop).not.toHaveBeenCalled();
});

test("leaving the screen mid-press starts nothing",()=>{
  // A timer that fires after the component has gone starts a recording nothing
  // will ever stop.
  const onRecord=jest.fn();
  const onPhoto=jest.fn();
  const {shutter,hold}=shutterWithClock({onPhoto,onRecord});

  shutter.pressIn();
  shutter.cancel();
  hold();

  expect(onRecord).not.toHaveBeenCalled();
  expect(onPhoto).not.toHaveBeenCalled();
});

test("a second press while already down is ignored",()=>{
  const onPhoto=jest.fn();
  const {shutter}=shutterWithClock({onPhoto});

  shutter.pressIn();
  shutter.pressIn();
  shutter.pressOut();
  shutter.pressOut();

  expect(onPhoto).toHaveBeenCalledTimes(1);
});

test("the hold is long enough to be deliberate and short enough not to feel broken",()=>{
  expect(HOLD_MS).toBeGreaterThanOrEqual(250);
  expect(HOLD_MS).toBeLessThanOrEqual(600);
});

test("a recording stops itself at fifteen seconds",()=>{
  // Agreed with the owner: small files, fast uploads on mobile data, and nobody
  // ends up with four minutes of their pocket.
  expect(MAX_RECORDING_SECONDS).toBe(15);
});

// ---------------------------------------------------------------------------
// A recording is carried as a video, not as a photo
// ---------------------------------------------------------------------------

test("the kind is read off the file, never assumed",()=>{
  // Marking a recording as an image uploads it with an image mime type, which
  // Supabase Storage accepts and no player will then play.
  expect(mediaKindFromUri("file:///tmp/clip.mp4")).toBe("video");
  expect(mediaKindFromUri("file:///tmp/clip.MOV")).toBe("video");
  expect(mediaKindFromUri("file:///tmp/shot.jpg")).toBe("image");
  expect(mediaKindFromUri("file:///tmp/shot")).toBe("image");
});

test("a recording gets a video mime type, and .mov is quicktime",()=>{
  expect(assetFromCameraUri("file:///tmp/clip.mp4").mimeType).toBe("video/mp4");
  // The extension and the mime type are not the same word.
  expect(assetFromCameraUri("file:///tmp/clip.mov").mimeType).toBe("video/quicktime");
  expect(assetFromCameraUri("file:///tmp/shot.jpg").mimeType).toBe("image/jpeg");
});

// ---------------------------------------------------------------------------
// Through the real screen
// ---------------------------------------------------------------------------

describe("the viewfinder records",()=>{
  beforeEach(()=>{
    camera.__setCameraPermission({granted:true,status:"granted"});
    camera.__setMicrophonePermission({granted:true,status:"granted"});
    camera.__setNextRecording({uri:"file:///tmp/clip.mp4"});
    installFixture({user:{id:"me"},tables:{},rpc:{}});
  });

  afterEach(()=>{restoreRouterParams();});

  async function open(){
    const Camera=require("../app/camera").default;
    let tree;
    await act(async()=>{tree=create(React.createElement(Camera));});
    await act(async()=>{});
    return tree;
  }

  function shutterOf(tree){
    return tree.root.findAll(
      (node)=>node.props?.accessibilityLabel==="Press for a photo, hold to record a video"
        && typeof node.props?.onPressIn==="function",
      {deep:true}
    )[0];
  }

  function cameraView(tree){
    return tree.root.findAll(
      (node)=>typeof node.type==="string" && node.props?.mode!==undefined,
      {deep:true}
    )[0];
  }

  test("the camera starts in picture mode",async()=>{
    const tree=await open();
    expect(cameraView(tree).props.mode).toBe("picture");
    await act(async()=>{tree.unmount();});
  });

  test("holding puts the camera into video mode, and it records",async()=>{
    jest.useFakeTimers();

    try{
      const tree=await open();

      await act(async()=>{shutterOf(tree).props.onPressIn();});
      await act(async()=>{jest.advanceTimersByTime(HOLD_MS+10);});
      await act(async()=>{});

      // The mode has to be applied to CameraView BEFORE recordAsync will work,
      // and applying it is a re-render -- calling both in one tick is how this
      // fails on a real Android device.
      expect(cameraView(tree).props.mode).toBe("video");
      // The Aperture Console reports recording through the instrument face
      // rather than a sentence: the mode readout flips to REC and a countdown
      // of the real 15s ceiling appears, and the hint below drops to the only
      // thing left to say. Asserting all three is strictly stronger than the
      // old single "Recording" substring check.
      const recordingText=textOf(tree.toJSON());
      expect(recordingText).toContain("REC");
      expect(recordingText).toMatch(/\d+S LEFT/);
      expect(recordingText).toContain("Let go to stop.");

      await act(async()=>{shutterOf(tree).props.onPressOut();});
      // recordAsync resolves through a promise chain; a couple of flushes get
      // the .then and the .finally through with fake timers running.
      await act(async()=>{await Promise.resolve();});
      await act(async()=>{await Promise.resolve();});

      // And the recording is what gets handed on, as a video.
      expect(textOf(tree.toJSON())).toContain("What is this?");
      expect(labelsOf(tree.toJSON())).toContain("Record it again");

      await act(async()=>{tree.unmount();});
    }finally{
      jest.useRealTimers();
    }
  });

  test("the recording is handed to the Moment screen as a file, like a photo is",async()=>{
    jest.useFakeTimers();

    try{
      const tree=await open();

      await act(async()=>{shutterOf(tree).props.onPressIn();});
      await act(async()=>{jest.advanceTimersByTime(HOLD_MS+10);});
      await act(async()=>{});
      await act(async()=>{shutterOf(tree).props.onPressOut();});
      await act(async()=>{await Promise.resolve();});
      await act(async()=>{await Promise.resolve();});

      expoRouter.router.push.mockClear();

      const moment=tree.root.findAll(
        (node)=>node.props?.accessibilityLabel==="Post this as a Moment"
          && typeof node.props?.onPress==="function",
        {deep:true}
      )[0];
      await act(async()=>{moment.props.onPress();});

      expect(expoRouter.router.push).toHaveBeenCalledWith(
        `/moments/create?photo=${encodeURIComponent("file:///tmp/clip.mp4")}`
      );

      await act(async()=>{tree.unmount();});
    }finally{
      jest.useRealTimers();
    }
  });

  test("the QR scanner is off while recording, and on the rest of the time",async()=>{
    jest.useFakeTimers();

    try{
      const tree=await open();
      expect(typeof cameraView(tree).props.onBarcodeScanned).toBe("function");

      await act(async()=>{shutterOf(tree).props.onPressIn();});
      await act(async()=>{jest.advanceTimersByTime(HOLD_MS+10);});
      await act(async()=>{});

      // Pointing a recording at a poster should not throw you onto another
      // screen halfway through it.
      expect(cameraView(tree).props.onBarcodeScanned).toBeUndefined();

      await act(async()=>{shutterOf(tree).props.onPressOut();});
      await act(async()=>{tree.unmount();});
    }finally{
      jest.useRealTimers();
    }
  });
});

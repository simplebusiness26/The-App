// Press for a photo, hold to record. One button, two things.
//
// The owner: "what is the deal with the video camera because I don't see this
// anywhere? I want ONE camera: press = photo, hold = record video, and the same
// camera scans QR codes."
//
// There was no video capture anywhere in this app. app/camera.js took a
// picture; recording did not exist.
//
// WHY THIS IS A FILE AND NOT SIX LINES IN THE COMPONENT
//
// The same reason utils/doubleTap.js is: it is a rule about time, and a rule
// about time is impossible to test through a camera. Everything here is a
// counter and a comparison, so "a quick tap is a photo and a long one is a
// recording" is a thing a test can assert without a viewfinder, a permission
// prompt or a device.
//
// It also does not claim a gesture. No PanResponder, no preventDefault: it is
// told a press began and a press ended, and works out which of the two happened.

// How long the button has to be held before it starts recording. Long enough
// that a deliberate photo is never a recording, short enough that holding it
// does not feel broken while you wait.
export const HOLD_MS=350;

// Fifteen seconds, chosen with the owner. Small files, fast uploads on mobile
// data, and it stops ITSELF -- nobody ends up with four minutes of pocket.
//
// The 30s ceiling in app/moments/create.js is a different limit for a different
// thing: that one is what a video from the photo library may be.
export const MAX_RECORDING_SECONDS=15;

// A press that produced nothing yet.
export const SHUTTER_IDLE="idle";
// Held past HOLD_MS: recording.
export const SHUTTER_RECORDING="recording";

// `onRecord` fires when the press has been held long enough; `onPhoto` fires on
// release if it never was. Exactly one of them happens per press, which is the
// property worth having -- a hold that also took a photo would leave a stray
// picture behind every recording.
export function createShutter({onPhoto,onRecord,onStop,holdMs=HOLD_MS,setTimer,clearTimer}={}){
  const start=setTimer || ((fn,ms)=>setTimeout(fn,ms));
  const stop=clearTimer || ((handle)=>clearTimeout(handle));

  let timer=null;
  let state=SHUTTER_IDLE;
  let down=false;

  return{
    state(){return state;},

    pressIn(){
      if(down) return;
      down=true;
      state=SHUTTER_IDLE;

      timer=start(()=>{
        timer=null;
        // Released in the same tick the timer fired: the press is over, and a
        // recording that starts after the finger has gone would never be
        // stopped by it.
        if(!down) return;
        state=SHUTTER_RECORDING;
        onRecord?.();
      },holdMs);
    },

    pressOut(){
      if(!down) return;
      down=false;

      if(timer!==null){
        stop(timer);
        timer=null;
      }

      if(state===SHUTTER_RECORDING){
        state=SHUTTER_IDLE;
        onStop?.();
        return;
      }

      state=SHUTTER_IDLE;
      onPhoto?.();
    },

    // The recording hit MAX_RECORDING_SECONDS on its own. The finger may still
    // be down, and releasing it must not then take a photo.
    finished(){
      if(state!==SHUTTER_RECORDING) return;
      state=SHUTTER_IDLE;
      down=false;
      if(timer!==null){stop(timer);timer=null;}
    },

    // Leaving the screen mid-press. A timer that fires after the component has
    // gone starts a recording nothing will ever stop.
    cancel(){
      down=false;
      state=SHUTTER_IDLE;
      if(timer!==null){stop(timer);timer=null;}
    }
  };
}

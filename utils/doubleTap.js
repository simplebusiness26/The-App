// Counting taps, without a gesture library.
//
// react-native-gesture-handler and react-native-reanimated both sit in
// node_modules as undeclared transitive dependencies of expo-router. Using
// either would mean promoting one to a direct dependency, and CLAUDE.md says to
// ask before adding one. A double tap is two taps close together in time, which
// is a number and a comparison.
//
// It is a factory rather than a hook so it can be tested by calling it, and so
// one recogniser can be shared by every heat cell on the map rather than each
// cell carrying its own state.
//
// WHAT IT MUST NOT BREAK
// Pan, pinch and the existing long-press that drops a Link-up pin. It never
// claims a gesture and never calls preventDefault: it only observes taps that
// have already happened and reports when two of them landed on the same thing
// in quick succession. A single tap on a heat cell still does what it always
// did, which is nothing.

export const DOUBLE_TAP_MS=320;

export function createDoubleTap({thresholdMs=DOUBLE_TAP_MS}={}){
  let lastKey=null;
  let lastAt=0;

  return {
    // Returns true when THIS tap completed a double tap.
    tap(key,now){
      const at=typeof now==="number" ? now : Date.now();
      const isSecond=key===lastKey && (at-lastAt)<=thresholdMs;

      if(isSecond){
        // Reset, so three taps are one double tap and not two overlapping ones.
        lastKey=null;
        lastAt=0;
        return true;
      }

      lastKey=key;
      lastAt=at;
      return false;
    },

    reset(){
      lastKey=null;
      lastAt=0;
    }
  };
}

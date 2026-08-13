import {useEffect,useState} from "react";
import {Keyboard,Platform} from "react-native";

// How much of the screen the keyboard is covering, right now, in pixels.
//
// WHY NOT JUST KeyboardAvoidingView
//
// app/messages/[id].js had one, configured like this:
//
//   behavior={Platform.OS==="ios" ? "padding" : undefined}
//
// which is no behaviour at all on Android and no behaviour at all on web. On
// Android it was relying on the window resizing under the app -- and Expo now
// turns edge-to-edge on by default, under which the window does NOT resize.
// The keyboard simply covered the composer. There was also no
// keyboardVerticalOffset despite the app drawing its own header, so even the
// iOS half was out by the height of that header.
//
// The library everybody reaches for here is react-native-keyboard-controller.
// It is a dependency, and adding one needs asking (CLAUDE.md), so this does the
// same job with what React Native already ships: the keyboard tells you how
// tall it is, and you use the number.
//
// A number is also far easier to be sure about than a layout behaviour. A test
// can push a keyboard event through and read the padding back.
//
// WILL vs DID
// iOS fires keyboardWillShow before the animation, so the composer moves with
// the keyboard rather than after it. Android only fires keyboardDidShow. Using
// `will` on Android would silently never fire.

export default function useKeyboardInset(){
  const [height,setHeight]=useState(0);

  useEffect(()=>{
    const showEvent=Platform.OS==="ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent=Platform.OS==="ios" ? "keyboardWillHide" : "keyboardDidHide";

    const onShow=(event)=>{
      // endCoordinates is what the keyboard will occupy when it settles. On a
      // hardware keyboard it can be 0, which is correct and must not be
      // treated as "no keyboard" -- it is "no space taken", which is the same
      // number and the same outcome.
      setHeight(Math.max(0,event?.endCoordinates?.height ?? 0));
    };

    const onHide=()=>setHeight(0);

    const showSub=Keyboard.addListener(showEvent,onShow);
    const hideSub=Keyboard.addListener(hideEvent,onHide);

    return()=>{
      showSub?.remove?.();
      hideSub?.remove?.();
    };
  },[]);

  return height;
}

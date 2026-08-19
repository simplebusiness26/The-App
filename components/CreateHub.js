import React,{useState} from "react";
import {View,Text,Pressable,StyleSheet,Modal} from "react-native";
import Svg,{Path} from "react-native-svg";
import {router,usePathname} from "expo-router";
import {isCreateActionHidden} from "../utils/navigation";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import CameraCapture from "./CameraCapture";
import ReviewComposer from "./ReviewComposer";
import {INK,TYPE,SHAPE} from "../utils/tokens";
import {Glyph,MONO} from "./instrument";

// The Create hub. FINAL_PRODUCT_CONTRACT.md: "Global floating action: Create
// -- reachable identically from any screen, not gesture-dependent, not
// contingent on current route." and "Default surface: Camera ... Sibling
// branches, one tap away: Post a Moment · Keep a Memory · Check in · Scan a
// code · Review Composer."
//
// Rendered once, in app/_layout.js, as a persistent overlay -- the same
// pattern components/QuickAccessDrawer.js and components/StartupSplash.js
// already used for "one thing, drawn above everything, that any screen can
// reach without knowing it exists".
//
// WHY THE FAB, NOT A TAB
//
// utils/navigation.js's TABS has five slots and none of them is Create --
// that is the architecture spec's own wording, not an omission here. A
// button that is the SAME control everywhere is what "not contingent on the
// current route" means; the old shell's raised centre button failed that
// test (it was Map most places and Camera specifically on /map), which is
// the thing this hub replaces rather than repeats.
//
// WHERE THE BRANCH CHIPS LIVE NOW
//
// They were drawn here: three of them, floating at the TOP of the hub over
// the viewfinder. The locked spec says five, below the viewfinder, all one
// tap away and always visible -- so the list and the row both moved into
// components/CameraCapture.js, where the viewfinder they sit under is, and
// CAPTURE_BRANCHES is the single exported definition both surfaces read.
//
// This file keeps exactly one thing about them: Review has no route. The hub
// draws the composer inside itself so its own chrome stays right, so it
// claims that branch through onBranch and lets every other one navigate.
// Native matches a single family name, not a CSS stack -- see the same note in
// components/HappeningSegments.js.
// MONO comes from the kit now. This file kept its own Platform.select copy
// from before the faces were bundled, and a second answer to "what is the data
// face" is exactly how two screens end up in different monospaces.

const FAB_SIZE=58;
const FAB_BOTTOM=78;   // Clears the 62px tab bar plus its own breathing room.

// WHY THE BUTTON MOVED, AND WHAT SCREENS OWE IT.
//
// It used to sit dead centre (left:"50%", marginLeft:-FAB_SIZE/2), floating
// over whatever happened to be underneath. In real screenshots that was
// "Create account", a profile's Following stat and its "Find Explorers"
// button, and a section heading. Worse, a raised control in the centre above
// the tab bar re-creates the exact position the new architecture deliberately
// removed when it took the raised centre button out of components/TabBar.js.
//
// So it is bottom-RIGHT now. That fixes the collisions the button causes by
// where it sits; it cannot fix the ones it causes by existing, because a
// floating button always covers the last few points of a scroll. That is what
// this export is for: a scrollable screen adds CREATE_HUB_CLEARANCE to its
// bottom content padding, so content can always be scrolled clear of the
// button rather than trapped under it.
//
//   contentContainerStyle={{paddingBottom:24+CREATE_HUB_CLEARANCE}}
//
// FAB_SIZE plus a gap the same order as the screen gutter.
export const CREATE_HUB_CLEARANCE=FAB_SIZE+24;

export default function CreateHub(){
  const pathname=usePathname();
  const insets=useSafeAreaInsets();
  const [open,setOpen]=useState(false);
  const [view,setView]=useState("camera");   // "camera" | "review"

  // Hidden wherever the screen already has its own compose control pinned to
  // the bottom edge -- the camera, and any message thread or board. The rule
  // and the reasoning live in utils/navigation.js, next to the other route
  // predicates, so there is one place that answers "what does this route do".
  if(isCreateActionHidden(pathname)) return null;

  function openHub(){
    setView("camera");
    setOpen(true);
  }

  function close(){
    setOpen(false);
  }

  // Handed to CameraCapture/ReviewComposer as onNavigate: close the overlay
  // FIRST, then change screens, so the destination is never sitting under
  // the hub's own chrome for a frame.
  function navigate(url){
    setOpen(false);
    router.push(url);
  }

  // Offered every capture-hub branch before the camera acts on it. Only Review
  // is claimed: it is a view drawn inside this hub rather than a route, because
  // the generic composer needs a place picker and there is no /reviews screen
  // to send anybody to. Returning false lets the camera navigate as normal.
  function takeBranch(branch){
    if(branch?.view!=="review") return false;
    setView("review");
    return true;
  }

  return (
    <>
      <Pressable
        style={[styles.fab,{bottom:FAB_BOTTOM+insets.bottom}]}
        accessibilityRole="button"
        accessibilityLabel="Create"
        onPress={openHub}
      >
        {/* A DIAL, NOT A BUBBLE. The Create action is the one control that
            floats over every screen, so it takes the instrument's signature
            geometry rather than a plain circle: an aperture's inner ring
            around a drawn cross. */}
        <View style={styles.fabRing} pointerEvents="none"/>
        <PlusIcon/>
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        onRequestClose={close}
        presentationStyle="fullScreen"
        statusBarTranslucent
      >
        <View style={styles.hub}>
          {view==="camera"
            ? <CameraCapture onNavigate={navigate} onBranch={takeBranch} overlay/>
            : (
              // The camera is full-bleed by design and the topBar already
              // floats over it, same as components/Header.js does on the real
              // /map and /camera routes. The composer is a scrolling paper
              // page, not a viewfinder, so it gets its top padding reserved
              // instead -- otherwise its own title sits under the close chip.
              <View style={[styles.reviewWrap,{paddingTop:insets.top+62}]}>
                <ReviewComposer onNavigate={navigate} onClose={()=>setView("camera")}/>
              </View>
            )}

          {/* Floats over whichever view is active -- the same "chip on a
              transparent ground" language components/Header.js uses, so it
              reads over a live viewfinder as well as a panel-coloured form. */}
          <View style={[styles.topBar,{paddingTop:insets.top+10}]} pointerEvents="box-none">
            <Text style={styles.topLabel}>{view==="camera" ? "Create" : "Review"}</Text>
            <Pressable
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close Create"
              hitSlop={8}
              onPress={close}
            >
              <Glyph name="close" size={16} colour={INK.readout} weight={1.7}/>
            </Pressable>
          </View>

        </View>
      </Modal>
    </>
  );
}

function PlusIcon(){
  return (
    <Svg width={26} height={26} viewBox="0 0 16 16">
      <Path d="M8 2.4v11.2" stroke={INK.readout} strokeWidth={1.6} strokeLinecap="round"/>
      <Path d="M2.4 8h11.2" stroke={INK.readout} strokeWidth={1.6} strokeLinecap="round"/>
    </Svg>
  );
}

function normalise(pathname){
  const path=String(pathname || "");
  return path.length>1 && path.endsWith("/") ? path.slice(0,-1) : path;
}

const styles=StyleSheet.create({
  fab:{
    position:"absolute",
    // Bottom-RIGHT. See the note beside CREATE_HUB_CLEARANCE above for why it
    // is no longer centred. `bottom` is still set inline from FAB_BOTTOM plus
    // the safe-area inset, so it clears the tab bar on every device.
    right:16,
    width:FAB_SIZE,
    height:FAB_SIZE,
    borderRadius:FAB_SIZE/2,
    // A raised control on the housing: one surface step up, a hairline edge and
    // the 1px bevel highlight. The state inks are not spent on chrome.
    backgroundColor:INK.panelRaised,
    borderWidth:SHAPE.border,
    borderColor:INK.hairlineStrong,
    alignItems:"center",
    justifyContent:"center",
    // Soft ambient shadow, not the old hard print offset. The design system
    // reserves this for genuinely floating things and names the Create action
    // as one of them.
    ...SHAPE.shadow.floating,
    zIndex:30
  },
  fabRing:{
    position:"absolute",top:7,left:7,right:7,bottom:7,
    borderRadius:FAB_SIZE/2,borderWidth:SHAPE.border,borderColor:INK.hairline,opacity:0.8
  },
  hub:{flex:1,backgroundColor:INK.inset},
  reviewWrap:{flex:1,backgroundColor:INK.ground},
  topBar:{
    position:"absolute",
    left:0,
    right:0,
    top:0,
    flexDirection:"row",
    alignItems:"center",
    justifyContent:"space-between",
    paddingHorizontal:14
  },
  topLabel:{
    color:INK.readout,
    fontFamily:MONO,
    fontSize:TYPE.data.sizes.lg,
    letterSpacing:TYPE.data.tracking*TYPE.data.sizes.lg,
    textTransform:"uppercase",
    // Over a live viewfinder, so a smoked-glass ground rather than a panel.
    backgroundColor:"rgba(15,18,22,0.62)",
    borderRadius:SHAPE.radius.control,
    paddingHorizontal:12,
    paddingVertical:6,
    overflow:"hidden"
  },
  closeButton:{
    width:38,
    height:38,
    borderRadius:SHAPE.radius.control,
    alignItems:"center",
    justifyContent:"center",
    backgroundColor:INK.panel,
    borderWidth:SHAPE.border,
    borderColor:INK.hairlineStrong
  },
});

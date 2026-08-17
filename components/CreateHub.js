import React,{useState} from "react";
import {View,Text,Pressable,StyleSheet,Modal} from "react-native";
import Svg,{Path} from "react-native-svg";
import {router,usePathname} from "expo-router";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import CameraCapture from "./CameraCapture";
import ReviewComposer from "./ReviewComposer";
import {INK} from "../utils/tokens";

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
// WHY MOMENT AND MEMORY ARE NOT CHIPS
//
// The contract also says "capture first, decide after". A Moment or a
// Memory cannot exist without a photo or a video -- app/moments/create.js
// and app/memories/create.js both bounce back to /camera if they are opened
// with no photo attached. So "one tap away" for those two, honestly, means
// one tap to reach the camera (zero taps: it is the hub's own default
// surface) and then the shutter -- which is exactly the choice tray
// CameraCapture already shows the instant a photo is taken. Drawing Moment
// and Memory as chips here as well, before there is anything to attach to
// them, would be a second control offering the same eventual screen with
// nothing behind it yet -- the placeholder-UI RULES.md forbids. Check in,
// Scan a code and Review need no photo, so they get real, immediate chips.
const FAB_SIZE=58;
const FAB_BOTTOM=78;   // Clears the 62px tab bar plus its own breathing room.

export default function CreateHub(){
  const pathname=usePathname();
  const insets=useSafeAreaInsets();
  const [open,setOpen]=useState(false);
  const [view,setView]=useState("camera");   // "camera" | "review"

  // Hidden on the /camera route itself. That screen is already a full-screen
  // camera end to end (components/CameraCapture.js, shared with this hub), so
  // a second Create trigger floating on top of it would offer the same
  // action twice in the same place.
  if(normalise(pathname)==="/camera") return null;

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

  return (
    <>
      <Pressable
        style={[styles.fab,{bottom:FAB_BOTTOM+insets.bottom}]}
        accessibilityRole="button"
        accessibilityLabel="Create"
        onPress={openHub}
      >
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
            ? <CameraCapture onNavigate={navigate}/>
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
              reads over a live viewfinder as well as a paper-coloured form. */}
          <View style={[styles.topBar,{paddingTop:insets.top+10}]} pointerEvents="box-none">
            <Text style={styles.topLabel}>{view==="camera" ? "Create" : "Review"}</Text>
            <Pressable
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close Create"
              hitSlop={8}
              onPress={close}
            >
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>

          {/* The sibling branches. See the file note above for why Moment and
              Memory are not drawn here. */}
          {view==="camera" && (
            <View style={[styles.tray,{top:insets.top+58}]} pointerEvents="box-none">
              <Chip label="Check in" onPress={()=>navigate("/checkins/create")}/>
              <Chip label="Scan a code" onPress={()=>navigate("/scan")}/>
              <Chip label="Review" onPress={()=>setView("review")}/>
            </View>
          )}
        </View>
      </Modal>
    </>
  );
}

function Chip({label,onPress}){
  return (
    <Pressable
      style={styles.chip}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
    >
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );
}

function PlusIcon(){
  return (
    <Svg width={26} height={26} viewBox="0 0 16 16">
      <Path d="M8 2.4v11.2" stroke={INK.card} strokeWidth={2} strokeLinecap="round"/>
      <Path d="M2.4 8h11.2" stroke={INK.card} strokeWidth={2} strokeLinecap="round"/>
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
    alignSelf:"center",
    left:"50%",
    marginLeft:-FAB_SIZE/2,
    width:FAB_SIZE,
    height:FAB_SIZE,
    borderRadius:FAB_SIZE/2,
    backgroundColor:INK.ink,
    borderWidth:2,
    borderColor:INK.ink,
    alignItems:"center",
    justifyContent:"center",
    // Hard offset shadow, never a blur -- design-system.md's elevation rule.
    shadowColor:INK.ink,
    shadowOffset:{width:3,height:3},
    shadowOpacity:1,
    shadowRadius:0,
    elevation:6,
    zIndex:30
  },
  hub:{flex:1,backgroundColor:INK.ink},
  reviewWrap:{flex:1,backgroundColor:INK.paper},
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
    color:INK.card,
    fontWeight:"800",
    fontSize:13,
    letterSpacing:0.6,
    textTransform:"uppercase",
    backgroundColor:"rgba(22,24,28,0.55)",
    borderRadius:99,
    paddingHorizontal:12,
    paddingVertical:6,
    overflow:"hidden"
  },
  closeButton:{
    width:40,
    height:40,
    borderRadius:20,
    alignItems:"center",
    justifyContent:"center",
    backgroundColor:INK.card,
    borderWidth:2,
    borderColor:INK.ink
  },
  closeText:{fontSize:22,fontWeight:"900",color:INK.ink,lineHeight:24},
  tray:{
    position:"absolute",
    left:0,
    right:0,
    flexDirection:"row",
    flexWrap:"wrap",
    justifyContent:"center",
    gap:8,
    paddingHorizontal:14
  },
  chip:{
    borderWidth:2,
    borderColor:INK.card,
    borderRadius:99,
    paddingHorizontal:14,
    paddingVertical:8,
    minHeight:36,
    justifyContent:"center",
    backgroundColor:"rgba(22,24,28,0.55)"
  },
  chipText:{color:INK.card,fontWeight:"800",fontSize:12.5}
});

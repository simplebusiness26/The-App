import React,{useEffect,useMemo,useRef} from "react";
import {View,Text,Pressable,StyleSheet,Animated,PanResponder,useWindowDimensions} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {INK} from "../utils/tokens";

// The map pin bottom sheet -- FINAL_PRODUCT_CONTRACT.md's UX behaviour
// section: "tapping a pin opens a real pointer-draggable bottom sheet, 3 snap
// points (Peek/Half/Full), map always visible behind it. Drag down or tap
// outside dismisses. Visible drag-handle + 'View full page ▸' button as the
// non-gesture fallback."
//
// BUILT, NOT WIRED. Per this packet's brief, this component is complete and
// ready to import; it does not touch components/LivingMapScreen.js or the
// other map files -- that wiring belongs to the agent building the Map tab.
//
// NO NEW GESTURE DEPENDENCY. package.json has no react-native-gesture-handler
// (checked before writing this), so the drag is real PanResponder from
// react-native core -- the same primitive components/TabBar.js's old raised
// button used for its own drag, adapted here for a vertical sheet instead of
// a button that follows one finger a few pixels.
//
// ---------------------------------------------------------------------------
// USAGE
// ---------------------------------------------------------------------------
//
//   import PinSheet, {PIN_SHEET_LEVELS} from "./PinSheet";
//
//   const [level,setLevel]=useState(PIN_SHEET_LEVELS.PEEK);
//   const [selected,setSelected]=useState(null);   // a marker/place record, or null
//
//   // ... map's onPressPin(place) does setSelected(place) and
//   // setLevel(PIN_SHEET_LEVELS.PEEK) ...
//
//   {!!selected && (
//     <PinSheet
//       item={selected}
//       level={level}
//       onLevelChange={setLevel}
//       onClose={()=>setSelected(null)}
//       onOpenFullPage={()=>router.push(`/business/${selected.id}`)}
//       renderContent={(currentLevel)=>(
//         <PlacePreviewCard place={selected} level={currentLevel}/>
//       )}
//     />
//   )}
//
// The map underneath does not need to know the sheet exists beyond holding
// `selected`/`level` state and rendering this on top of itself -- exactly the
// "map always visible behind it" requirement, since the sheet only ever
// covers part of the screen and never renders its own backdrop over the map
// at Peek or Half.
//
// `renderContent(level)` gets the CURRENT snap level on every render, so the
// caller can show a one-line preview at Peek and the full listing body at
// Full without this component knowing what a "place" is. `children` works
// too, as a static alternative, for a caller that does not vary its content
// by level.
//
// `onOpenFullPage`, if supplied, is called by "View full page ▸" INSTEAD of
// snapping to Full -- for a caller that wants the button to leave the sheet
// entirely and open the place's own routed page (e.g. /business/[id]) rather
// than only expanding the sheet. Omit it and the button snaps to Full, which
// is the plain non-gesture fallback the contract describes.

export const PIN_SHEET_LEVELS={PEEK:"peek",HALF:"half",FULL:"full"};

// Fraction of the window height each level occupies. Exported so a test or a
// caller doing its own layout math does not have to guess these.
export const PIN_SHEET_HEIGHT_FRACTION={
  [PIN_SHEET_LEVELS.PEEK]:0.16,
  [PIN_SHEET_LEVELS.HALF]:0.48,
  [PIN_SHEET_LEVELS.FULL]:0.92
};

const ORDER=[PIN_SHEET_LEVELS.PEEK,PIN_SHEET_LEVELS.HALF,PIN_SHEET_LEVELS.FULL];

// How far past Peek, dragged DOWN, before letting go dismisses instead of
// snapping back to Peek. Generous enough that a small overshoot while
// settling into Peek does not accidentally close the sheet.
const DISMISS_DRAG=70;

export default function PinSheet({
  item,
  level=PIN_SHEET_LEVELS.PEEK,
  onLevelChange,
  onClose,
  onOpenFullPage,
  renderContent,
  children
}){
  const {height:windowHeight}=useWindowDimensions();
  const insets=useSafeAreaInsets();

  const heightFor=(lvl)=>Math.round(windowHeight*(PIN_SHEET_HEIGHT_FRACTION[lvl] || PIN_SHEET_HEIGHT_FRACTION.peek));

  // The sheet's height animates between snap points; drag moves a SEPARATE
  // value on top of that, so a release can spring the drag value back to 0
  // while the height itself jumps straight to the new snap point -- trying
  // to animate height and drag through the same value is what makes a sheet
  // stutter or overshoot on release.
  const heightAnim=useRef(new Animated.Value(heightFor(level))).current;
  const dragAnim=useRef(new Animated.Value(0)).current;
  const levelRef=useRef(level);
  const heightRef=useRef(heightFor(level));

  useEffect(()=>{
    levelRef.current=level;
    const target=heightFor(level);
    heightRef.current=target;
    Animated.spring(heightAnim,{
      toValue:target,
      useNativeDriver:false,
      speed:18,
      bounciness:4
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[level,windowHeight]);

  const panResponder=useMemo(()=>PanResponder.create({
    onStartShouldSetPanResponder:()=>false,
    // Only the handle area calls panHandlers, so a tap inside the sheet's own
    // scrolling content is never mistaken for a drag -- see the handle View
    // below, which is the only thing wired to `panHandlers`.
    onMoveShouldSetPanResponder:(_event,gesture)=>Math.abs(gesture.dy)>4,
    onPanResponderTerminationRequest:()=>false,

    // Positive dy (finger moving down) shrinks the sheet; negative dy grows
    // it. Both directions are followed live so the sheet sits under the
    // finger rather than jumping once some threshold is crossed.
    onPanResponderMove:(_event,gesture)=>{
      dragAnim.setValue(gesture.dy);
    },

    onPanResponderRelease:(_event,gesture)=>{
      const dragged=gesture.dy;
      const currentIndex=ORDER.indexOf(levelRef.current);
      const projected=heightRef.current-dragged-gesture.vy*80;

      // Dragged well past Peek, downward, with nowhere smaller to snap to --
      // that is a dismiss, not a resnap to Peek.
      if(currentIndex===0 && dragged>DISMISS_DRAG){
        Animated.timing(dragAnim,{toValue:0,duration:0,useNativeDriver:false}).start();
        onClose?.();
        return;
      }

      // Otherwise settle on whichever snap point's height is nearest to
      // where the finger let go, velocity-biased so a fast flick commits
      // even from short of the halfway point.
      let nearest=ORDER[0];
      let nearestDistance=Infinity;
      for(const candidate of ORDER){
        const distance=Math.abs(heightFor(candidate)-projected);
        if(distance<nearestDistance){nearest=candidate;nearestDistance=distance;}
      }

      dragAnim.setValue(0);
      if(nearest!==levelRef.current) onLevelChange?.(nearest);
      else{
        // Same level as before the drag -- spring the height back itself,
        // since no level change means the effect above will not fire.
        Animated.spring(heightAnim,{
          toValue:heightFor(levelRef.current),
          useNativeDriver:false,
          speed:18,
          bounciness:4
        }).start();
      }
    },

    onPanResponderTerminate:()=>{
      dragAnim.setValue(0);
    }
  }),[onClose,onLevelChange,windowHeight]);

  if(!item) return null;

  // The sheet's live height is heightAnim plus the drag currently in
  // progress, clamped so it can never grow past Full or collapse through
  // zero while a finger is still moving it.
  const liveHeight=Animated.add(heightAnim,Animated.multiply(dragAnim,-1)).interpolate({
    inputRange:[0,heightFor(PIN_SHEET_LEVELS.FULL)],
    outputRange:[0,heightFor(PIN_SHEET_LEVELS.FULL)],
    extrapolate:"clamp"
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Transparent -- the map stays visible behind the sheet at every
          level. This is only here to catch a tap OUTSIDE the sheet, which
          dismisses it same as a downward drag past Peek. */}
      <Pressable
        style={StyleSheet.absoluteFill}
        accessibilityRole="button"
        accessibilityLabel="Close"
        onPress={()=>onClose?.()}
      />

      <Animated.View
        style={[styles.sheet,{height:liveHeight,paddingBottom:insets.bottom}]}
        accessibilityViewIsModal
      >
        <View {...panResponder.panHandlers} style={styles.handleArea}>
          <View style={styles.handle} accessibilityRole="adjustable" accessibilityLabel="Drag to resize"/>

          <View style={styles.handleRow}>
            <Pressable
              style={styles.fullPageButton}
              accessibilityRole="button"
              accessibilityLabel="View full page"
              onPress={()=>{
                if(onOpenFullPage){onOpenFullPage();return;}
                onLevelChange?.(PIN_SHEET_LEVELS.FULL);
              }}
            >
              <Text style={styles.fullPageText}>View full page ▸</Text>
            </Pressable>

            <Pressable
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}
              onPress={()=>onClose?.()}
            >
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.content}>
          {renderContent ? renderContent(level) : children}
        </View>
      </Animated.View>
    </View>
  );
}

const styles=StyleSheet.create({
  sheet:{
    position:"absolute",
    left:0,
    right:0,
    bottom:0,
    backgroundColor:INK.card,
    borderTopWidth:2,
    borderTopColor:INK.ink,
    // Hard offset shadow, never a blur -- design-system.md's elevation rule.
    shadowColor:INK.ink,
    shadowOffset:{width:0,height:-3},
    shadowOpacity:1,
    shadowRadius:0,
    elevation:8,
    overflow:"hidden"
  },
  handleArea:{paddingTop:8,paddingHorizontal:14,paddingBottom:6},
  handle:{
    alignSelf:"center",
    width:40,
    height:4,
    borderRadius:2,
    backgroundColor:INK.hair,
    marginBottom:8
  },
  handleRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},
  fullPageButton:{
    borderWidth:2,
    borderColor:INK.ink,
    borderRadius:99,
    paddingHorizontal:14,
    paddingVertical:7,
    backgroundColor:INK.paper
  },
  fullPageText:{color:INK.ink,fontWeight:"800",fontSize:12.5},
  closeButton:{
    width:34,
    height:34,
    borderRadius:17,
    alignItems:"center",
    justifyContent:"center",
    backgroundColor:INK.paper,
    borderWidth:2,
    borderColor:INK.ink
  },
  closeText:{fontSize:18,fontWeight:"900",color:INK.ink,lineHeight:20},
  content:{flex:1,paddingHorizontal:16}
});

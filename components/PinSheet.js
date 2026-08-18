import React,{useEffect,useMemo,useRef} from "react";
import {View,Text,Pressable,StyleSheet,Animated,PanResponder,useWindowDimensions} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {INK,TYPE,SHAPE} from "../utils/tokens";
import {Glyph,MONO,TickScale} from "./instrument";

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
  children,
  // What the tapped thing IS, as a state ink. The sheet is the instrument's
  // main readout, so it lights an indicator lamp in that state rather than
  // tinting itself -- see docs/design-system.md, "state inks".
  tone="exists",
  // The mono strip along the sheet's head: what kind of thing this is, and
  // whatever the app measured about it. Falls back to the item's own fields
  // so a caller that passes nothing still gets a readout rather than a gap.
  readout
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

  const label=readout || item.card?.typeLabel || item.kind || "PLACE";
  const measured=item.distanceLabel || item.card?.meta || null;
  const lamp=INK[tone] || INK.exists;

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
        {/* THE INDICATOR LAMP. A 2px bar in the state ink across the sheet's
            top edge, cut short so it reads as a lit segment on a housing
            rather than a coloured border. This is the only saturated colour
            the sheet carries; everything inside it stays on the readout
            greys, so the labels never end up fighting a fill. */}
        <View style={[styles.lamp,{backgroundColor:lamp}]} pointerEvents="none"/>

        <View {...panResponder.panHandlers} style={styles.handleArea}>
          {/* THE GRAB RAIL, MACHINED. Not a soft pill: a knurled rail --
              a real tick scale flanked by two hairline bars, so the thing you
              drag looks like a thing you drag on an instrument. */}
          <View style={styles.rail} accessibilityRole="adjustable" accessibilityLabel="Drag to resize">
            <View style={styles.railBar}/>
            <TickScale width={44} height={8} count={7} majorEvery={3} colour={INK.hairlineStrong}/>
            <View style={styles.railBar}/>
          </View>

          {/* THE HEAD READOUT. Mono, uppercase, measured: what kind of thing
              is under the pin and how far away it is. A person reads this
              before they read the name, which is why it sits above it. */}
          <View style={styles.headRow}>
            <View style={styles.headLeft}>
              <View style={[styles.headDot,{backgroundColor:lamp}]}/>
              <Text style={styles.headLabel} numberOfLines={1}>{String(label).toUpperCase()}</Text>
              {measured?<><View style={styles.headSep}/><Text style={styles.headMeta} numberOfLines={1}>{measured}</Text></>:null}
            </View>

            <Pressable
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}
              onPress={()=>onClose?.()}
            >
              <Glyph name="close" size={14} colour={INK.readoutSoft}/>
            </Pressable>
          </View>

          <View style={styles.headRule}/>

          <Pressable
            style={styles.fullPageButton}
            accessibilityRole="button"
            accessibilityLabel="View full page"
            onPress={()=>{
              if(onOpenFullPage){onOpenFullPage();return;}
              onLevelChange?.(PIN_SHEET_LEVELS.FULL);
            }}
          >
            <Text style={styles.fullPageText}>VIEW FULL PAGE</Text>
            <Glyph name="forward" size={13} colour={INK.readout}/>
          </Pressable>
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
    backgroundColor:INK.panel,
    borderTopLeftRadius:SHAPE.radius.sheet,
    borderTopRightRadius:SHAPE.radius.sheet,
    // 1px etched edge where the sheet leaves the map, plus the bevel highlight
    // that carries elevation now that the print offset is gone.
    borderTopWidth:SHAPE.border,
    borderTopColor:SHAPE.edgeHighlight,
    borderLeftWidth:SHAPE.border,
    borderRightWidth:SHAPE.border,
    borderLeftColor:INK.hairline,
    borderRightColor:INK.hairline,
    // The sheet genuinely floats over the map, which is one of the two things
    // docs/design-system.md still allows a soft ambient shadow for.
    ...SHAPE.shadow.floating,
    overflow:"hidden"
  },
  lamp:{position:"absolute",top:0,left:"32%",right:"32%",height:2,borderRadius:1},

  handleArea:{paddingTop:9,paddingHorizontal:14,paddingBottom:10},
  rail:{flexDirection:"row",alignItems:"center",justifyContent:"center",gap:6,marginBottom:11},
  railBar:{width:14,height:2,borderRadius:1,backgroundColor:INK.hairlineStrong},

  headRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:10},
  headLeft:{flexDirection:"row",alignItems:"center",gap:8,flex:1,minWidth:0},
  headDot:{width:7,height:7,borderRadius:3.5},
  headLabel:{
    color:INK.readout,fontFamily:MONO,fontSize:TYPE.data.sizes.md,
    textTransform:"uppercase",letterSpacing:1,flexShrink:1
  },
  headSep:{width:1,height:11,backgroundColor:INK.hairlineStrong},
  headMeta:{color:INK.readoutFaint,fontFamily:MONO,fontSize:TYPE.data.sizes.sm,letterSpacing:0.8,flexShrink:1},

  closeButton:{
    width:32,
    height:32,
    borderRadius:SHAPE.radius.control,
    alignItems:"center",
    justifyContent:"center",
    backgroundColor:INK.panelRaised,
    borderWidth:SHAPE.border,
    borderColor:INK.hairline
  },

  headRule:{height:1,backgroundColor:INK.hairline,marginTop:10,marginBottom:10},

  fullPageButton:{
    flexDirection:"row",
    alignItems:"center",
    justifyContent:"center",
    gap:8,
    minHeight:38,
    borderWidth:SHAPE.border,
    borderColor:INK.hairlineStrong,
    borderRadius:SHAPE.radius.control,
    backgroundColor:INK.panelRaised
  },
  fullPageText:{
    color:INK.readout,fontFamily:MONO,fontSize:TYPE.data.sizes.lg,
    textTransform:"uppercase",letterSpacing:1,fontWeight:"600"
  },

  content:{flex:1,paddingHorizontal:16}
});

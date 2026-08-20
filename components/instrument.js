// THE INSTRUMENT KIT
//
// The Field Instrument design system, as components rather than colours.
//
// This file exists because recolouring the app dark did not make it the design
// that won the tournament. The winning concept was an INSTRUMENT: tick scales,
// dials with detents, readouts of measured values, focus reticles, etched
// panels. None of that is a token -- it is geometry, and geometry has to be
// built. Screens compose from these primitives instead of assembling ad-hoc
// Views, which is what keeps one authored language across seventy routes.
//
// Everything here is SVG or plain Views. react-native-svg 15.15.4 is already a
// dependency (the QR generator uses it), so nothing new is introduced.
//
// See docs/design-system.md for the rules these encode.

import React,{useEffect,useRef,useState} from "react";
import {AccessibilityInfo,ActivityIndicator,Animated,View,Text,Pressable,PanResponder,ScrollView,StyleSheet,Platform} from "react-native";
import Svg,{Circle,Line,Path,Rect,G} from "react-native-svg";
import {INK,TYPE,SHAPE,FONT} from "../utils/tokens";

// The data face. This used to be Platform.select({ios:"Menlo",android:"monospace"})
// because nothing was bundled and native matches one real family name only.
// JetBrains Mono ships with the app now (assets/fonts, loaded in app/_layout.js),
// so every platform gets the face the design actually names.
export const MONO=FONT.mono;
// The same face at medium. On Android a weight is a separate FILE, not a
// property -- asking for fontWeight:"600" on a regular face gets a synthesised
// smear or nothing at all, so a bolder mono has to be asked for by name.
export const MONO_MEDIUM=FONT.monoMedium;

// ---------------------------------------------------------------------------
// READOUT — a measured value, the way an instrument shows one.
// ---------------------------------------------------------------------------
// Mono, uppercase, wide-tracked label above a large value. This is the single
// most reused piece of the system: distances, counts, ranks, durations, scores.
// The label is what the thing IS; the value is what the app measured.
// `valueFirst` puts the numeral above its label instead of below it. A grid of
// ten or more gauges reads better that way -- the eye scans the numbers and
// drops to the label only for the one it stops on -- and it is also what makes
// the value and its label read as one contiguous phrase to a screen reader.
export function Readout({label,value,unit,tone="readout",align="left",size="md",valueFirst}){
  const sizes={sm:{v:18,l:TYPE.data.sizes.sm},md:{v:24,l:TYPE.data.sizes.md},lg:{v:34,l:TYPE.data.sizes.md}};
  const s=sizes[size]||sizes.md;
  // Two lines, not one. A third-width cell in a ReadoutStrip is about eleven
  // mono characters wide, so REVIEW REPUTATION clamped to REVIEW REPUTATI… --
  // an instrument whose labels are cut off is not readable, which is the one
  // thing an instrument has to be.
  const labelNode=<Text key="l" style={[styles.readoutLabel,{fontSize:s.l},valueFirst&&styles.readoutLabelUnder]} numberOfLines={2}>{label}</Text>;
  const valueNode=(
    <View key="v" style={styles.readoutValueRow}>
      <Text style={[styles.readoutValue,{fontSize:s.v,color:INK[tone]||INK.readout}]}>{value}</Text>
      {unit ? <Text style={styles.readoutUnit}>{unit}</Text> : null}
    </View>
  );
  return(
    <View style={{alignItems:align==="center"?"center":"flex-start"}}>
      {valueFirst?[valueNode,labelNode]:[labelNode,valueNode]}
    </View>
  );
}

// ---------------------------------------------------------------------------
// TICK SCALE — the etched ruler that makes a surface read as an instrument.
// ---------------------------------------------------------------------------
// Minor ticks with a major every `majorEvery`. Used along dials, sheet edges and
// section rules. Purely decorative in the sense that it carries no data, but it
// is the texture that says "this thing measures things".
export function TickScale({width=200,height=14,count=21,majorEvery=5,colour=INK.hairlineStrong}){
  // The end marks are drawn 0.7 in from each edge rather than on it. A 1.4px
  // stroke centred on x=0 loses half its width to the canvas boundary, so the
  // first and last graduation rendered thinner than every other major -- which
  // on a scale reads as the ends being less important, the opposite of true.
  const inset=0.7;
  const span=Math.max(0,width-inset*2);
  const step=count>1 ? span/(count-1) : span;
  const ticks=[];
  for(let i=0;i<count;i++){
    const major=i%majorEvery===0;
    const x=inset+i*step;
    ticks.push(
      <Line key={i} x1={x} y1={height} x2={x} y2={major?height*0.25:height*0.62}
        stroke={colour} strokeWidth={major?1.4:1} strokeLinecap="square" opacity={major?1:0.65}/>
    );
  }
  return <Svg width={width} height={height}>{ticks}</Svg>;
}

// ---------------------------------------------------------------------------
// PROGRESS RING — the shutter's hold indicator.
// ---------------------------------------------------------------------------
// Answers "what happens if I keep holding, and how long have I got?" -- the
// question the old bare shutter button left completely unanswered.
export function ProgressRing({size=78,stroke=3,progress=0,colour=INK.scheduled,track=INK.hairlineStrong}){
  const r=(size-stroke)/2, c=2*Math.PI*r, p=Math.max(0,Math.min(1,progress));
  return(
    <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
      <Circle cx={size/2} cy={size/2} r={r} stroke={track} strokeWidth={stroke} fill="none"/>
      {p>0 ? (
        <Circle cx={size/2} cy={size/2} r={r} stroke={colour} strokeWidth={stroke} fill="none"
          strokeDasharray={`${c*p} ${c}`} strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`}/>
      ) : null}
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// APERTURE — concentric rings behind the shutter.
// ---------------------------------------------------------------------------
// The viewfinder's signature. Quiet at rest, and the inner ring closes as a
// recording runs, so the control itself shows the state rather than a caption.
export function Aperture({size=118,blades=6,open=1,colour=INK.hairlineStrong}){
  const cx=size/2, cy=size/2, outer=size/2-2, inner=outer*(0.42+0.28*(1-open));
  const paths=[];
  for(let i=0;i<blades;i++){
    const a=(i/blades)*Math.PI*2, a2=((i+1)/blades)*Math.PI*2;
    paths.push(
      <Line key={i}
        x1={cx+Math.cos(a)*inner} y1={cy+Math.sin(a)*inner}
        x2={cx+Math.cos(a2)*outer} y2={cy+Math.sin(a2)*outer}
        stroke={colour} strokeWidth={1} opacity={0.8}/>
    );
  }
  return(
    <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Circle cx={cx} cy={cy} r={outer} stroke={colour} strokeWidth={1} fill="none" opacity={0.55}/>
      <Circle cx={cx} cy={cy} r={inner} stroke={colour} strokeWidth={1} fill="none" opacity={0.9}/>
      <G>{paths}</G>
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// CORNER FRAME — viewfinder brackets.
// ---------------------------------------------------------------------------
// Four L brackets instead of a full box: they frame without boxing in, and they
// are the cheapest possible signal that a surface is a viewfinder.
export function CornerFrame({inset=18,length=26,colour=INK.readoutSoft,opacity=0.5}){
  const L=length, s=1.4;
  const corner=(top,left)=>({
    position:"absolute",width:L,height:L,
    [top?"top":"bottom"]:inset,[left?"left":"right"]:inset,
    [top?"borderTopWidth":"borderBottomWidth"]:s,
    [left?"borderLeftWidth":"borderRightWidth"]:s,
    borderColor:colour,opacity
  });
  return(
    <>
      <View style={corner(true,true)} pointerEvents="none"/>
      <View style={corner(true,false)} pointerEvents="none"/>
      <View style={corner(false,true)} pointerEvents="none"/>
      <View style={corner(false,false)} pointerEvents="none"/>
    </>
  );
}

// ---------------------------------------------------------------------------
// RETICLE — tap-to-focus target.
// ---------------------------------------------------------------------------
// expo-camera exposes focus; this makes it visible. Brackets plus a centre dot,
// drawn where the finger landed.
export function Reticle({size=72,colour=INK.scheduled}){
  const b=size*0.26, s=1.4;
  return(
    <View style={{width:size,height:size}} pointerEvents="none">
      <Svg width={size} height={size}>
        <Rect x={0.7} y={0.7} width={size-1.4} height={size-1.4} rx={3}
          stroke={colour} strokeWidth={s} fill="none" opacity={0.9}
          strokeDasharray={`${b} ${size-2*b}`} strokeDashoffset={-b/2}/>
        <Circle cx={size/2} cy={size/2} r={2} fill={colour}/>
      </Svg>
    </View>
  );
}

// ---------------------------------------------------------------------------
// DIAL — drag-to-snap along detents.
// ---------------------------------------------------------------------------
// Zoom presets, durations, intensity. One continuous motion instead of four
// separate taps to compare options -- and every tick is still individually
// tappable, so the gesture is a shortcut and never the only route.
export function Dial({values,active,onChange,width=232,format=(v)=>String(v),labelEvery}){
  const [dragging,setDragging]=useState(false);
  const idx=Math.max(0,values.indexOf(active));

  // A CROWDED SCALE LABELS ITS MAJORS, NOT EVERY GRADUATION.
  //
  // Labels are centred on their own ticks, which is the only honest way to draw
  // a dial -- but centred labels can then collide with each other, and "50KM"
  // sitting on top of "25KM" is no more readable than a label pointing at the
  // wrong tick. A real instrument scale solves this the same way: it numbers
  // the majors and leaves the minors bare.
  //
  // The estimate is deliberately rough (mono is fixed-pitch, roughly 0.62em at
  // this size, plus a 10px clear gap). Being slightly conservative costs a
  // label; being optimistic costs a collision, and one of those is a bug.
  const widest=values.reduce((most,v)=>Math.max(most,String(format(v)).length),0);
  const needed=widest*TYPE.data.sizes.sm*0.62+10;
  const fits=values.length>1 ? width/(values.length-1) : width;
  const stride=labelEvery || Math.max(1,Math.ceil(needed/Math.max(1,fits)));
  const step=values.length>1 ? width/(values.length-1) : width;
  const startIdx=useRef(idx);

  const pan=useRef(PanResponder.create({
    onStartShouldSetPanResponder:()=>true,
    onMoveShouldSetPanResponder:(_,g)=>Math.abs(g.dx)>3,
    onPanResponderGrant:()=>{startIdx.current=Math.max(0,values.indexOf(active));setDragging(true);},
    onPanResponderMove:(_,g)=>{
      const next=Math.round(startIdx.current+g.dx/step);
      const clamped=Math.max(0,Math.min(values.length-1,next));
      if(values[clamped]!==active) onChange?.(values[clamped]);
    },
    onPanResponderRelease:()=>setDragging(false),
    onPanResponderTerminate:()=>setDragging(false)
  })).current;

  return(
    <View style={styles.dialWrap}>
      <View style={{width,height:16,justifyContent:"flex-end"}} {...pan.panHandlers}>
        <TickScale width={width} height={16} count={values.length} majorEvery={1}
          colour={dragging?INK.scheduled:INK.hairlineStrong}/>
      </View>
      {/* EVERY LABEL SITS ON ITS OWN GRADUATION.
          These were laid out with justifyContent:"space-between", which puts
          the first label's LEFT edge at 0 and the last one's RIGHT edge at the
          far end -- so every label's centre drifted from the tick it names, by
          about 15px at the width the camera's precision tray uses. A dial whose
          labels do not line up with its own marks is lying about where its
          stops are, which is the one thing an instrument may not do.

          Each label now hangs off a zero-width cell placed exactly on its
          graduation. A zero-width column with centred items centres its child
          on that point whatever the label's own width turns out to be, so
          "3 DAYS" and "1x" both land true. */}
      <View style={[styles.dialLabels,{width}]}>
        {values.map((v,index)=>{
          // A CROWDED SCALE LABELS ITS MAJORS, NOT EVERY GRADUATION.
          // Centred labels can collide, and "50KM" printed on top of "25KM" is
          // no more readable than a label pointing at the wrong tick. A real
          // instrument scale numbers the majors and leaves the minors bare.
          // Always keep the first, the last and the selection: the ends give
          // the scale its range and the selection is the reading.
          const labelled=index%stride===0 || index===values.length-1 || v===active;
          return(
            <View
              key={String(v)}
              style={[styles.dialCell,{left:values.length>1?(width/(values.length-1))*index:width/2}]}
            >
              {/* 44px, not 13. The label is a 13px line of mono; without real
                  padding the tap target was the glyph itself, a third of the
                  accessibility floor. The padding is vertical so the detents
                  stay where the scale draws them -- widening them sideways
                  would move the stops. */}
              <Pressable onPress={()=>onChange?.(v)}
                style={styles.dialHit} hitSlop={{top:6,bottom:6,left:10,right:10}}
                accessibilityRole="button" accessibilityLabel={format(v)}
                accessibilityState={{selected:v===active}}>
                {labelled
                  ? <Text style={[styles.dialLabel,v===active&&styles.dialLabelActive]} numberOfLines={1}>{format(v)}</Text>
                  : <View style={styles.dialBareDetent}/>}
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// LAMP — the only moving thing in the app.
// ---------------------------------------------------------------------------
// docs/design-system.md: "No parallax, no ambient animation, no staggered
// reveals. The one exception: a slow pulse on a genuinely live reading."
// Liveness is what this product is FOR, so it gets the one animation -- and
// having exactly one means it always means the same thing.
//
// Only ever put this on something that is happening RIGHT NOW. A pulse on a
// scheduled session, an unread count or a call to action spends the app's only
// moving thing on something that is not live, and then nothing is.
//
// Honours reduce-motion by simply not starting: the lamp still shows, lit and
// still, because it is information rather than decoration.
export function Lamp({tone="scheduled",size=9,style}){
  const pulse=useRef(new Animated.Value(1)).current;
  const [reduced,setReduced]=useState(false);

  useEffect(()=>{
    let alive=true;
    AccessibilityInfo.isReduceMotionEnabled?.().then((on)=>{if(alive) setReduced(!!on);}).catch(()=>{});
    return()=>{alive=false;};
  },[]);

  useEffect(()=>{
    if(reduced) return undefined;
    const loop=Animated.loop(Animated.sequence([
      Animated.timing(pulse,{toValue:0.3,duration:900,useNativeDriver:true}),
      Animated.timing(pulse,{toValue:1,duration:900,useNativeDriver:true})
    ]));
    loop.start();
    return()=>loop.stop();
  },[reduced,pulse]);

  const colour=INK[tone]||INK.scheduled;
  return(
    <Animated.View
      style={[
        {width:size,height:size,borderRadius:size/2,backgroundColor:colour},
        !reduced&&{opacity:pulse},
        style
      ]}
      pointerEvents="none"
    />
  );
}

// ---------------------------------------------------------------------------
// PANEL — the layered surface.
// ---------------------------------------------------------------------------
// Elevation is a surface step plus a 1px top highlight, never a print shadow.
export function Panel({children,raised=false,style,...rest}){
  return(
    <View style={[styles.panel,raised&&styles.panelRaised,style]} {...rest}>
      <View style={styles.panelEdge} pointerEvents="none"/>
      {children}
    </View>
  );
}

// ---------------------------------------------------------------------------
// SECTION RULE — an etched divider with a mono eyebrow.
// ---------------------------------------------------------------------------
// Replaces the bare heading. Gives every list a measured, panelled feel and
// somewhere to hang a count.
export function SectionRule({label,meta}){
  return(
    <View style={styles.sectionRule}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.sectionLine}/>
      {meta!=null ? <Text style={styles.sectionMeta}>{meta}</Text> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// STATE EDGE — state as an edge, not a fill.
// ---------------------------------------------------------------------------
// The design system forbids spending state inks on chrome. A row that needs to
// say "this one is live" gets a 2px left edge in the state ink and keeps its
// panel surface, so every label inside stays readable.
export function StateEdge({tone="exists",children,style}){
  return(
    <View style={[styles.stateEdge,{borderLeftColor:INK[tone]||INK.exists},style]}>
      {children}
    </View>
  );
}

const styles=StyleSheet.create({
  readoutLabel:{
    color:INK.readoutFaint,fontFamily:MONO,textTransform:"uppercase",
    letterSpacing:TYPE.data.tracking*TYPE.data.sizes.md,marginBottom:3
  },
  readoutLabelUnder:{marginBottom:0,marginTop:4},
  readoutValueRow:{flexDirection:"row",alignItems:"baseline",gap:4},
  readoutValue:{color:INK.readout,fontFamily:FONT.display,letterSpacing:-0.5},
  readoutUnit:{color:INK.readoutSoft,fontFamily:MONO,fontSize:TYPE.data.sizes.sm,textTransform:"uppercase"},

  dialWrap:{alignItems:"center",gap:6},
  // A bare row, not a space-between one: every cell positions itself on its
  // own graduation, so the row only has to be as wide as the scale.
  // A bare positioned box, not a flex row: every cell places itself on its own
  // graduation, so the container only has to be as tall as one tap target.
  dialLabels:{height:SHAPE.tapTarget},
  dialCell:{position:"absolute",top:0,width:0,alignItems:"center"},
  dialBareDetent:{width:3,height:3,borderRadius:1.5,backgroundColor:INK.hairlineStrong},
  dialHit:{minHeight:SHAPE.tapTarget,minWidth:32,alignItems:"center",justifyContent:"center"},
  dialLabel:{
    color:INK.readoutFaint,fontFamily:MONO,fontSize:TYPE.data.sizes.sm,
    textTransform:"uppercase",letterSpacing:0.6
  },
  dialLabelActive:{color:INK.scheduled},

  // THE PRINTED CARD. Card stock, a real ink border, and a hard offset shadow
  // -- the print register, not a blur. overflow stays visible so the shadow is
  // not clipped off by the card's own bounds.
  panel:{
    backgroundColor:INK.card,borderWidth:SHAPE.border,borderColor:INK.ink,
    borderRadius:SHAPE.radius.card,
    ...SHAPE.shadow.hardSm
  },
  panelRaised:{backgroundColor:INK.panelRaised},
  // There is no bevel on paper. Kept as a no-op so callers do not have to
  // learn a new shape.
  panelEdge:{position:"absolute",top:0,left:0,right:0,height:0},

  sectionRule:{flexDirection:"row",alignItems:"center",gap:10,marginTop:22,marginBottom:10},
  sectionLabel:{
    color:INK.readoutSoft,fontFamily:MONO,fontSize:TYPE.data.sizes.md,
    textTransform:"uppercase",letterSpacing:TYPE.data.tracking*TYPE.data.sizes.md
  },
  sectionLine:{flex:1,height:1,backgroundColor:INK.hair},
  sectionMeta:{color:INK.readoutFaint,fontFamily:MONO,fontSize:TYPE.data.sizes.sm},

  stateEdge:{
    borderLeftWidth:2,backgroundColor:INK.panel,
    borderTopWidth:SHAPE.border,borderRightWidth:SHAPE.border,borderBottomWidth:SHAPE.border,
    borderTopColor:INK.hairline,borderRightColor:INK.hairline,borderBottomColor:INK.hairline,
    borderRadius:SHAPE.radius.card
  }
});

// ===========================================================================
// THE SCREEN KIT
// ===========================================================================
//
// Everything above builds the viewfinder. Everything below builds the other
// seventy-five screens, and it exists for the same reason: an instrument is a
// set of machined parts, so screens have to be ASSEMBLED from parts rather than
// hand-drawn one View at a time and tinted to match. A page that reaches for a
// bare <View style={{padding:16}}> is a page that will drift.
//
// The rule for using this kit: if a screen needs a shape that is not here, add
// it here first. Never inline a one-off.

// ---------------------------------------------------------------------------
// GLYPH — the icon set, transcribed from the winning artifact.
// ---------------------------------------------------------------------------
// The source of truth is one function in one file:
//
//   runs/the-app/2026-08-17T02-09-27-650Z/rounds/ui/blend-dewith-mengto-pins/
//     artifact.html  ->  function ic(name, size)
//
// That table is the design that won the UI round. Every mark it defines is
// reproduced below path for path, on its own grid, in its own header:
//
//   viewBox 0 0 20 20 · fill none · stroke currentColor · stroke-width 1.6
//   · stroke-linecap round · stroke-linejoin round
//
// WHY THIS IS A TRANSCRIPTION AND NOT A DESIGN
//
// It used to be a design. There was an invented set here, drawn on a 16-unit
// grid to an eight-rule doctrine about bezels and graduations, and it was
// coherent, and it was not the icons the commissioner chose. The five
// navigation marks are on every screen in the app, so getting them from
// somewhere other than the artifact meant the whole product read as a
// different design however carefully the colours matched. If a mark here and
// a mark in the artifact ever disagree, the artifact is right and this file
// is a bug.
//
// The app needs marks the artifact never had to draw -- it has no calendar
// screen, no chart, no audit trail. Those are kept, rebased arithmetically
// from the old 16-unit grid onto this 20-unit one (x1.25, arc flags left
// alone) so they sit at the same optical weight as the transcribed ones
// instead of rendering 25% small next to them.
const GLYPHS={
  // --- transcribed from the artifact, path for path ------------------------
  back:      [{d:"M12 4l-6 6 6 6"}],
  forward:   [{d:"M8 4l6 6-6 6"}],
  up:        [{d:"M5 12l5-5 5 5"}],
  down:      [{d:"M5 8l5 5 5-5"}],
  close:     [{d:"M5 5l10 10M15 5L5 15"}],
  check:     [{d:"M4 10l4 4 8-8"}],
  plus:      [{d:"M10 4v12"},{d:"M4 10h12"}],
  minus:     [{d:"M4 10h12"}],
  plusRound: [{c:[10,10,7.5]},{d:"M10 6.5v7M6.5 10h7"}],

  // --- the five navigation marks, exactly as the artifact draws them -------
  map:       [{c:[10,10,6.4]},{c:[10,10,1.6],fill:true}],
  compass:   [{d:"M10 2v5M10 13v5M2 10h5M13 10h5M4.8 4.8l3.2 3.2M12 12l3.2 3.2M15.2 4.8L12 8M8 12l-3.2 3.2"}],
  community: [{c:[7,7.5,2.5]},{c:[13.5,7.5,2.1]},{d:"M2.5 16.5c0-3 2-4.6 4.5-4.6s4.5 1.6 4.5 4.6"},{d:"M11.8 12c1.9.2 3.2 1.7 3.2 4.2"}],
  message:   [{d:"M3 4.5h14v8H9l-3.5 3v-3H3z"}],
  person:    [{c:[10,7,3.2]},{d:"M3.5 17c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"}],
  people:    [{c:[7,7.5,2.5]},{c:[13.5,7.5,2.1]},{d:"M2.5 16.5c0-3 2-4.6 4.5-4.6s4.5 1.6 4.5 4.6"},{d:"M11.8 12c1.9.2 3.2 1.7 3.2 4.2"}],
  profile:   [{c:[10,7,3.2]},{d:"M3.5 17c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"}],

  // --- the camera and map controls the artifact defines --------------------
  camera:    [{r:[2.5,6,15,10.5,1.6]},{d:"M7 6l1.3-2h3.4L13 6"},{c:[10,11.2,3.2]}],
  flash:     [{d:"M11 2L4 12h5l-1 6 7-10h-5z"}],
  flashOff:  [{d:"M11 2L6.5 9M4 12h5l-1 6 3.3-4.7M15 15L3 3"}],
  flip:      [{d:"M4 7h9M13 7l-2.5-2.5M13 7l-2.5 2.5M16 13H7M7 13l2.5-2.5M7 13l2.5 2.5"}],
  layers:    [{d:"M10 3l7 4-7 4-7-4 7-4z"},{d:"M3 11l7 4 7-4"}],
  target:    [{c:[10,10,6]},{c:[10,10,1.4],fill:true},{d:"M10 2v2.4M10 15.6V18M2 10h2.4M15.6 10H18"}],
  scan:      [{d:"M3 7V4h3M17 7V4h-3M3 13v3h3M17 13v3h-3"},{d:"M4 10h12"}],
  qr:        [{r:[3,3,5,5,0]},{r:[12,3,5,5,0]},{r:[3,12,5,5,0]},{d:"M12 12h2v2h-2zM16 12h1v1h-1zM12 16h1v1h-1zM15 15h2v2h-2z"}],
  pin:       [{d:"M10 2c-3.3 0-6 2.6-6 6 0 4.6 6 10 6 10s6-5.4 6-10c0-3.4-2.7-6-6-6z"},{c:[10,8,2],fill:true}],
  reply:     [{d:"M8 5L3 10l5 5"},{d:"M3 10h8a5 5 0 0 1 5 5v1"}],
  verified:  [{d:"M10 2l2 1.6 2.5-.4 1 2.3 2.3 1-.4 2.5 1.6 2-1.6 2 .4 2.5-2.3 1-1 2.3-2.5-.4L10 18l-2-1.6-2.5.4-1-2.3-2.3-1 .4-2.5L1 10l1.6-2-.4-2.5 2.3-1 1-2.3 2.5.4z"},{d:"M7 10l2 2 4-4"}],

  // --- the rest of the artifact's table ------------------------------------
  bell:      [{d:"M6 8a4 4 0 0 1 8 0c0 3 1 4 1 4H5s1-1 1-4z"},{d:"M8.5 15a1.5 1.5 0 0 0 3 0"}],
  search:    [{c:[8.5,8.5,5]},{d:"M15.5 15.5L12 12"}],
  star:      [{d:"M10 3l2.2 4.6 5 .6-3.7 3.5.9 5-4.4-2.4-4.4 2.4.9-5-3.7-3.5 5-.6z"}],
  heart:     [{d:"M10 17S3 12.5 3 7.8A3.8 3.8 0 0 1 10 5.6 3.8 3.8 0 0 1 17 7.8C17 12.5 10 17 10 17z"}],
  comment:   [{d:"M3 4h14v9H8l-4 3v-3H3z"}],
  lock:      [{r:[4.5,9,11,8,1.5]},{d:"M7 9V6.5a3 3 0 0 1 6 0V9"}],
  edit:      [{d:"M4 16l1-4 9-9 3 3-9 9-4 1z"}],
  trash:     [{d:"M4 6h12M8 6V4h4v2M6 6l1 10h6l1-10"}],

  // --- marks this app needs that the artifact never had to draw, rebased
  //     onto the same 20-unit grid so they read as one set -------------------
  clock:     [{c:[10,10,6.5]},{d:"M10 5.5V10h3.5"}],
  calendar:  [{d:"M3.5 5.5h13v10.5H3.5z"},{d:"M3.5 9h13"},{d:"M7 3.5v3.5"},{d:"M13 3.5v3.5"}],
  share:     [{c:[14.5,5.5,2.25]},{c:[5.5,10,2.25]},{c:[14.5,14.5,2.25]},{d:"M7.5 9 12.5 6.5"},{d:"M7.5 11 12.5 13.5"}],
  filter:    [{d:"M3.5 4.5h13L11.5 9.5v6.5H8.5V9.5z"}],
  info:      [{c:[10,10,6.5]},{d:"M10 9v4"},{d:"M10 6.5v1.25"}],
  warn:      [{d:"M10 4 16.5 16H3.5z"},{d:"M10 8.5v3.75"},{d:"M10 14.25v1.25"}],
  send:      [{d:"M16.5 3.5 3.5 10l5.5 2 2 5.5z"}],
  play:      [{d:"M7 4.5 15 10l-8 5.5z"}],
  live:      [{c:[10,10,2.75]},{d:"M5.375 5.375a6.5 6.5 0 0 0 0 9.25"},{d:"M14.625 5.375a6.5 6.5 0 0 1 0 9.25"}],
  home:      [{d:"M4 10 10 4l6 6"},{d:"M6 11.5v4.5h8V11.5"}],
  bookmark:  [{d:"M5.5 4h9v12L10 13l-4.5 3z"}],
  ticket:    [{d:"M3.5 6.5h13v2.5a1.75 1.75 0 0 0 0 3.5v3.5H3.5V12.5a1.75 1.75 0 0 0 0-3.5z"},{d:"M10.5 7v1.75"},{d:"M10.5 11.75v1.75"}],
  tag:       [{d:"M3.5 3.5h7l6 6-7 7-6-6z"},{c:[6.5,6.5,1.375]}],
  building:  [{d:"M4 16V4h8v12"},{d:"M12 8.5h4v7.5"},{d:"M6.5 7h3"},{d:"M6.5 10h3"},{d:"M6.5 13h3"}],
  bed:       [{d:"M3.5 16V8"},{d:"M3.5 11h13v5"},{d:"M16.5 11a3 3 0 0 0-3-3H9v3"},{c:[6,8.5,1.5]}],
  ring:      [{c:[10,10,6.5]},{c:[10,10,2.75]}],
  flag:      [{d:"M5 16V4"},{d:"M5 4.5h9.5L12 8l2.5 3.5H5"}],
  block:     [{c:[10,10,6.5]},{d:"M5.5 14.5 14.5 5.5"}],
  shield:    [{d:"M10 4 16 6v4.5c0 3.5-2.5 5.5-6 6.5-3.5-1-6-3-6-6.5V6z"}],
  key:       [{c:[6.5,10,3]},{d:"M9.5 10h7"},{d:"M13 10v3"},{d:"M16 10v2"}],
  card:      [{d:"M3.5 5.5h13v9H3.5z"},{d:"M3.5 8.75h13"},{d:"M6 11.5h3"}],
  chart:     [{d:"M3.5 16h13"},{d:"M6 16V11"},{d:"M10 16V6"},{d:"M14 16V12"}],
  list:      [{d:"M7 5.5h9.5"},{d:"M7 10h9.5"},{d:"M7 14.5h9.5"},{d:"M3.5 5.5h1.25"},{d:"M3.5 10h1.25"},{d:"M3.5 14.5h1.25"}],
  grid:      [{d:"M3.5 3.5h5.5v5.5H3.5z"},{d:"M11 3.5h5.5v5.5H11z"},{d:"M3.5 11h5.5v5.5H3.5z"},{d:"M11 11h5.5v5.5H11z"}],
  refresh:   [{d:"M16.25 10a6.25 6.25 0 1 1-2-4.625"},{d:"M16.5 4v4H12.5"}],
  external:  [{d:"M9 4H4v12h12V11"},{d:"M12 4h4.5v4.5"},{d:"M16.5 4 10 10.5"}],
  mail:      [{d:"M3.5 5.5h13v9H3.5z"},{d:"M3.5 5.5 10 12l6.5-6.5"}],
  phone:     [{d:"M6.5 3.5h7v13H6.5z"},{d:"M9 14h2"}],
  globe:     [{c:[10,10,6.5]},{d:"M3.5 10h13"},{d:"M10 3.5c2 2.25 3 4.5 3 6.5s-1 4.25-3 6.5c-2-2.25-3-4.5-3-6.5s1-4.25 3-6.5z"}],
  upload:    [{d:"M10 14.5V4"},{d:"M6 8 10 4l4 4"},{d:"M3.5 16h13"}],
  download:  [{d:"M10 4v10.5"},{d:"M6 10.5 10 14.5l4-4"},{d:"M3.5 16h13"}],
  image:     [{d:"M3.5 4.5h13v11H3.5z"},{c:[7,8,1.5]},{d:"M4 14.5 8.5 10l3 3 2.5-2.5 2.5 2.5"}],
  video:     [{d:"M3.5 6h9v8H3.5z"},{d:"M12.5 10 16.5 7v6z"}],
  mic:       [{d:"M10 3.5a2.25 2.25 0 0 1 2.25 2.25v4a2.25 2.25 0 0 1-4.5 0V5.75A2.25 2.25 0 0 1 10 3.5z"},{d:"M6 9.5a4 4 0 0 0 8 0"},{d:"M10 13.5v2.5"}],
  sliders:   [{d:"M3.5 7h13"},{d:"M3.5 13h13"},{c:[7.5,7,2.25]},{c:[12.5,13,2.25]}],
  sort:      [{d:"M6 4v12"},{d:"M3.5 13.5 6 16l2.5-2.5"},{d:"M14 16V4"},{d:"M11.5 6.5 14 4l2.5 2.5"}],
  more:      [{c:[4.5,10,1.375]},{c:[10,10,1.375]},{c:[15.5,10,1.375]}],
  award:     [{c:[10,7.5,4]},{d:"M7.5 11 6.5 16 10 14l3.5 2-1-5"}],
  gift:      [{d:"M3.5 8h13v3H3.5z"},{d:"M5 11v5h10v-5"},{d:"M10 8v8"},{d:"M10 8 7.5 5.5"},{d:"M10 8 12.5 5.5"}],
  clipboard: [{d:"M5.5 4.5h9v11.5H5.5z"},{d:"M8 4.5V3.5h4v1"},{d:"M8 8.75h4"},{d:"M8 12h4"}],
  eye:       [{d:"M3.5 10s2.75-4.5 6.5-4.5S16.5 10 16.5 10s-2.75 4.5-6.5 4.5S3.5 10 3.5 10z"},{c:[10,10,2.25]}],
  eyeOff:    [{d:"M4.5 6.5C3.5 7.75 3.5 10 3.5 10s2.75 4.5 6.5 4.5c1.25 0 2.375-0.5 3.25-1.125"},{d:"M8 5.75A6.25 6.25 0 0 1 10 5.5c3.75 0 6.5 4.5 6.5 4.5a13.75 13.75 0 0 1-2 2.5"},{d:"M4 4 16 16"}],
  settings:  [{c:[10,10,3]},{d:"M10 3.5v2"},{d:"M10 14.5v2"},{d:"M3.5 10h2"},{d:"M14.5 10h2"},{d:"M5.375 5.375 6.75 6.75"},{d:"M13.25 13.25 14.625 14.625"},{d:"M14.625 5.375 13.25 6.75"},{d:"M6.75 13.25 5.375 14.625"}],
};

export function Glyph({name,size=16,colour=INK.readoutSoft,weight=1.6}){
  const parts=GLYPHS[name];
  if(!parts) return null;
  // The artifact's own SVG header, reproduced: a 20-unit box, no fill, 1.6
  // stroke, round caps and joins. Every number in the table above is written in
  // those units, so nothing here is allowed to rescale them.
  return(
    <Svg width={size} height={size} viewBox="0 0 20 20">
      {parts.map((p,i)=>{
        if(p.r) return <Rect key={i} x={p.r[0]} y={p.r[1]} width={p.r[2]} height={p.r[3]} rx={p.r[4]}
                             fill="none" stroke={colour} strokeWidth={weight}/>;
        if(p.c) return <Circle key={i} cx={p.c[0]} cy={p.c[1]} r={p.c[2]}
                              fill={p.fill?colour:"none"} stroke={p.fill?"none":colour} strokeWidth={weight}/>;
        return <Path key={i} d={p.d} fill="none" stroke={colour} strokeWidth={weight}
                     strokeLinecap="round" strokeLinejoin="round"/>;
      })}
    </Svg>
  );
}

export const GLYPH_NAMES=Object.keys(GLYPHS);

// ---------------------------------------------------------------------------
// SCREEN — the housing every page sits in.
// ---------------------------------------------------------------------------
export function Screen({children,style,...rest}){
  return <View style={[kit.screen,style]} {...rest}>{children}</View>;
}

// ---------------------------------------------------------------------------
// SCREEN TITLE — the engraved plate at the top of a page.
// ---------------------------------------------------------------------------
// A mono eyebrow saying what KIND of thing this is, the name in display type,
// and an etched rule with real ticks under it. The ticks are the single cheapest
// thing that makes a page read as part of an instrument rather than a document.
export function ScreenTitle({eyebrow,title,meta,right}){
  return(
    <View style={kit.titleBlock}>
      {eyebrow ? <Text style={kit.titleEyebrow} numberOfLines={1}>{eyebrow}</Text> : null}
      <View style={kit.titleRow}>
        <Text style={kit.titleText} numberOfLines={2}>{title}</Text>
        {right}
      </View>
      {/* NOT CLAMPED. This was numberOfLines={1}, and every lead sentence put
          here shipped truncated with an ellipsis -- caught by looking at a
          screenshot, invisible to every test in the repo. A screen's lead
          sentence is prose; prose wraps. */}
      {meta ? <Text style={kit.titleMeta}>{meta}</Text> : null}
      <View style={kit.titleRule}>
        <TickScale width={72} height={9} count={9} majorEvery={4} colour={INK.hairlineStrong}/>
        <View style={kit.titleRuleLine}/>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// CHIP — a small mono control.
// ---------------------------------------------------------------------------
// Filters, categories, tags, toggles. Selection steps a surface and strengthens
// an edge; it never fills with a state ink, because being selected is not a
// state a place is in. `tone` adds a 6px state dot for chips that DO carry one.
// `labelStyle` exists for one caller: chrome drawn OVER the camera viewfinder,
// where the artifact inverts the whole chip -- paper-tinted glass at rest,
// YELLOW when selected, with ink type on it. Every other chip in the app takes
// the kit's own selected treatment and must not pass this.
export function Chip({label,selected,tone,onPress,glyph,disabled,style,labelStyle,accessibilityLabel}){
  const Wrap=onPress?Pressable:View;
  return(
    <Wrap
      style={[kit.chip,selected&&kit.chipSelected,disabled&&kit.chipDisabled,style]}
      onPress={disabled?undefined:onPress}
      disabled={disabled}
      accessibilityRole={onPress?"button":undefined}
      accessibilityState={onPress?{selected:!!selected,disabled:!!disabled}:undefined}
      // The visible label is usually the right thing to speak, but not always:
      // a filter chip reading "Tonight" is a sentence when spoken ("Show what
      // is happening tonight"). Without this override a screen has to wrap the
      // chip in another Pressable to keep the fuller label, which nests two
      // buttons and is worse for everybody.
      accessibilityLabel={accessibilityLabel||label}
    >
      {tone ? <View style={[kit.chipDot,{backgroundColor:INK[tone]||INK.exists}]}/> : null}
      {glyph ? <Glyph name={glyph} size={13} colour={selected?INK.readout:INK.readoutFaint}/> : null}
      <Text style={[kit.chipText,selected&&kit.chipTextSelected,disabled&&kit.chipTextDisabled,labelStyle]} numberOfLines={1}>{label}</Text>
    </Wrap>
  );
}

// ---------------------------------------------------------------------------
// SEGMENTED — a detented switch.
// ---------------------------------------------------------------------------
// Not pills in a row. A machined selector: labels above a tick track, with the
// active detent marked by a bright tick and a brightened label. Horizontal
// scroll is opt-in via `scroll` and always flexGrow:0 -- an unconstrained
// horizontal ScrollView in a flex column is the bug that produced 402px pills.
export function Segmented({items,active,onChange,scroll=false}){
  const body=items.map((item)=>{
    const key=item.key??item;
    const label=item.label??String(item);
    const selected=key===active;
    // Same reasoning as Chip's override above.
    const spoken=item.accessibilityLabel||label;
    return(
      <Pressable
        key={String(key)}
        style={kit.segment}
        accessibilityRole="tab"
        accessibilityState={{selected}}
        accessibilityLabel={spoken}
        onPress={()=>onChange?.(key)}
      >
        <View style={kit.segmentRow}>
          <Text style={[kit.segmentText,selected&&kit.segmentTextActive]} numberOfLines={1}>{label}</Text>
          {/* A count beside the label -- unread messages, results in a filter.
              It rides in the same mono face at a smaller size rather than as a
              coloured badge, because how many is a measurement and not a state
              a place is in. */}
          {item.meta!=null?<Text style={[kit.segmentMeta,selected&&kit.segmentMetaActive]}>{item.meta}</Text>:null}
        </View>
        <View style={[kit.segmentDetent,selected&&kit.segmentDetentActive]}/>
      </Pressable>
    );
  });

  if(!scroll){
    return <View style={kit.segmentBar} accessibilityRole="tablist">{body}</View>;
  }
  return(
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={kit.segmentScroll}
      contentContainerStyle={kit.segmentScrollContent}
      accessibilityRole="tablist"
    >
      {body}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// ACTION — the button.
// ---------------------------------------------------------------------------
// Mono, uppercase, 44px floor. `primary` is the only thing on a screen allowed
// to carry a filled state ink, and it takes DARK text on it -- the contrast
// table in docs/design-system.md is not optional and the gate checks it.
export function Action({label,onPress,kind="secondary",glyph,disabled,loading,style,accessibilityLabel,compact}){
  const filled=kind==="primary"||kind==="danger";
  const fill=kind==="primary"?INK.blue:kind==="danger"?INK.red:null;
  // WHICH TEXT ON A FILLED INK. On paper the inks are saturated and dark
  // enough to take paper-coloured type -- blue and red both do. The artifact
  // prints white on ink-blue and keeps ink on yellow; docs/design-system.md
  // carries the full table and scripts/verify-contrast.cjs checks it.
  const text=filled?INK.paper:kind==="quiet"?INK.inkSoft:INK.ink;
  return(
    <Pressable
      style={({pressed})=>[
        kit.action,
        compact&&kit.actionCompact,
        filled?{backgroundColor:fill,borderColor:fill}:kind==="quiet"?kit.actionQuiet:kit.actionSecondary,
        pressed&&kit.actionPressed,
        disabled&&kit.actionDisabled,
        style
      ]}
      onPress={disabled||loading?undefined:onPress}
      disabled={disabled||loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel||label}
      accessibilityState={{disabled:!!(disabled||loading)}}
    >
      {glyph?<Glyph name={glyph} size={compact?13:15} colour={text}/>:null}
      <Text style={[kit.actionText,compact&&kit.actionTextCompact,{color:text}]} numberOfLines={1}>{loading?"WORKING…":label}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// ROW — one line in a list.
// ---------------------------------------------------------------------------
// Name in display type, a body sentence under it, and whatever the app MEASURED
// about it set in mono down the right. `tone` turns the row into a StateEdge, so
// "this one is live" is an edge rather than a coloured background.
// `nested` is for a Row that sits INSIDE a Panel. Without it the row paints
// `panel` on `panel` and disappears into the card it is in; nested steps it up
// a surface and strengthens its edge, which is the same move selection makes.
export function Row({title,sub,meta,metaSub,tone,onPress,glyph,right,style,children,accessibilityLabel,nested}){
  const Wrap=onPress?Pressable:View;
  // `glyph` takes an icon NAME or a rendered node. A row's leading well is the
  // natural home for an avatar, a real map marker or a thumbnail, and forcing
  // it to be one of the kit's icons meant those rows could not use Row at all.
  const lead=typeof glyph==="string"
    ? <Glyph name={glyph} size={17} colour={INK.readoutSoft}/>
    : glyph;
  const inner=(
    <Wrap
      style={[kit.row,!tone&&kit.rowStandalone,!tone&&nested&&kit.rowNested,style]}
      onPress={onPress}
      accessibilityRole={onPress?"button":undefined}
      accessibilityLabel={onPress?(accessibilityLabel||[title,sub,meta].filter(Boolean).join(". ")):undefined}
    >
      {lead?<View style={kit.rowGlyph}>{lead}</View>:null}
      <View style={kit.rowBody}>
        <Text style={kit.rowTitle} numberOfLines={2}>{title}</Text>
        {sub?<Text style={kit.rowSub} numberOfLines={2}>{sub}</Text>:null}
        {children}
      </View>
      {(meta!=null||metaSub!=null||right)?(
        <View style={kit.rowMeta}>
          {right}
          {meta!=null?<Text style={kit.rowMetaText} numberOfLines={1}>{meta}</Text>:null}
          {metaSub!=null?<Text style={kit.rowMetaSub} numberOfLines={1}>{metaSub}</Text>:null}
        </View>
      ):null}
      {onPress?<View style={kit.rowChevron}><Glyph name="forward" size={13} colour={INK.readoutFaint}/></View>:null}
    </Wrap>
  );
  return tone?<StateEdge tone={tone} style={kit.rowEdge}>{inner}</StateEdge>:inner;
}

// ---------------------------------------------------------------------------
// METER — a measured quantity as a track, not a bar chart.
// ---------------------------------------------------------------------------
// Ratings, capacity, completion. Ticks along the track so the value can be read
// off it, which is the difference between an instrument and a progress bar.
export function Meter({value=0,max=5,tone="exists",width=140,label,valueLabel}){
  const p=max>0?Math.max(0,Math.min(1,value/max)):0;
  return(
    <View style={kit.meterWrap}>
      {label?<Text style={kit.meterLabel} numberOfLines={1}>{label}</Text>:null}
      <View style={[kit.meterTrack,{width}]}>
        <View style={[kit.meterFill,{width:Math.round(width*p),backgroundColor:INK[tone]||INK.exists}]}/>
        <View style={kit.meterTicks} pointerEvents="none">
          <TickScale width={width} height={8} count={max>1&&max<=12?max+1:6} majorEvery={99} colour={INK.hairlineStrong}/>
        </View>
      </View>
      {valueLabel!=null?<Text style={kit.meterValue}>{valueLabel}</Text>:null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// FIELD — a labelled well.
// ---------------------------------------------------------------------------
// Inputs sit in an `inset` well, one step BELOW the panel they are on, because
// the thing you type into should read as cut into the housing rather than
// stuck on it. The label is mono: it names a field, it is not a sentence.
// `counter` is a value the app measured about what you are typing -- 41/300,
// 3 photos left. It rides opposite the hint in the data face, because a hint is
// something a person wrote and a counter is not.
export function Field({label,hint,error,children,required,style,counter}){
  return(
    <View style={[kit.field,style]}>
      {label?(
        <View style={kit.fieldLabelRow}>
          <Text style={kit.fieldLabel} numberOfLines={1}>{label}</Text>
          {required?<Text style={kit.fieldRequired}>REQUIRED</Text>:null}
        </View>
      ):null}
      <View style={[kit.fieldWell,!!error&&kit.fieldWellError]}>{children}</View>
      {(error||hint||counter!=null)?(
        <View style={kit.fieldFootRow}>
          {error?<Text style={[kit.fieldError,kit.fieldFootGrow]}>{error}</Text>
            :hint?<Text style={[kit.fieldHint,kit.fieldFootGrow]}>{hint}</Text>
            :<View style={kit.fieldFootGrow}/>}
          {counter!=null?<Text style={kit.fieldCounter}>{counter}</Text>:null}
        </View>
      ):null}
    </View>
  );
}

// The input styles a TextInput inside a Field should carry. Exported rather
// than wrapped so screens keep full control of the TextInput's own props.
export const fieldInputStyle={
  color:INK.readout,
  fontSize:TYPE.body.sizes.lg,
  paddingHorizontal:12,
  paddingVertical:11,
  minHeight:SHAPE.tapTarget
};

// ---------------------------------------------------------------------------
// KEY VALUE — a mono definition line.
// ---------------------------------------------------------------------------
// `wrap` puts the value on its own line under the label rather than opposite
// it. An address, a licence line or an opening-hours block is genuinely two or
// three lines, and squeezing one onto a single row truncates the half that
// carries the information.
export function KeyValue({label,value,tone,wrap}){
  if(wrap){
    return(
      <View style={kit.kvStack}>
        <View style={kit.kvStackHead}>
          <Text style={kit.kvLabel} numberOfLines={1}>{label}</Text>
          <View style={kit.kvLine}/>
        </View>
        <Text style={[kit.kvStackValue,tone&&{color:INK[tone]}]}>{value}</Text>
      </View>
    );
  }
  return(
    <View style={kit.kv}>
      <Text style={kit.kvLabel} numberOfLines={1}>{label}</Text>
      <View style={kit.kvLine}/>
      <Text style={[kit.kvValue,tone&&{color:INK[tone]}]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// READOUT STRIP — several measurements on one plate.
// ---------------------------------------------------------------------------
// A cell may carry `onPress`, which is what a profile's Followers/Following
// plate needs -- without it that plate had to be rebuilt by hand purely so two
// of its numbers could be tapped.
export function ReadoutStrip({items,style,valueFirst}){
  return(
    <Panel style={[kit.strip,style]}>
      {items.map((item,i)=>{
        const Cell=item.onPress?Pressable:View;
        return(
          <React.Fragment key={item.label+String(i)}>
            {i>0?<View style={kit.stripDivider}/>:null}
            <Cell
              style={kit.stripCell}
              onPress={item.onPress}
              accessibilityRole={item.onPress?"button":undefined}
              accessibilityLabel={item.onPress?(item.accessibilityLabel||`${item.value} ${item.label}`):undefined}
            >
              <Readout label={item.label} value={item.value} unit={item.unit} tone={item.tone}
                align="center" size="sm" valueFirst={valueFirst||item.valueFirst}/>
            </Cell>
          </React.Fragment>
        );
      })}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// FRAME — a media well with viewfinder brackets.
// ---------------------------------------------------------------------------
// Avatars, thumbnails, photos. The brackets tie every picture in the app back
// to the viewfinder, which is the app's one signature surface.
// Sized three ways: `size` (a square, or a rectangle with `ratio`), `height`
// (full width at a fixed height -- what a media well in a card wants), or
// neither, in which case it takes its width from the layout and its height from
// `ratio`. Without the `height` case every fixed-height well had to pass
// `style={{height:N,aspectRatio:undefined}}` to cancel the default, which is a
// trick rather than an API.
export function Frame({children,size,height,ratio=1,round=false,style}){
  return(
    <View style={[
      kit.frame,
      round&&{borderRadius:SHAPE.radius.pill},
      size?{width:size,height:Math.round(size/ratio)}:height?{width:"100%",height}:{aspectRatio:ratio},
      style
    ]}>
      {children}
      {!round?<CornerFrame inset={4} length={10} colour={INK.readoutSoft} opacity={0.45}/>:null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// TOGGLE — one claim, on or off, with the sentence that explains it.
// ---------------------------------------------------------------------------
// "Show this on my profile." "Let members post to the board." A switch on its
// own is a control with no argument; the sentence under it is the argument, and
// the two belong together or the screen has to keep re-inventing the pairing.
// This was hand-composed in four form screens before it lived here.
//
// ON IS NOT A STATE INK. Whether you have turned something on is not a state a
// PLACE is in, so on steps up a surface and shows a bracketed tick, exactly
// like a selected chip. That also keeps the sentence readable, which a filled
// panel would not.
// `hint` and `sub` are the same slot under two names, and `onPress` is accepted
// beside `onChange` -- the four form screens that grew this row by hand had
// settled on hint/onPress, and renaming their call sites to satisfy the kit
// would be the kit serving itself rather than the screens.
export function Toggle({label,sub,hint,value,onChange,onPress,disabled,glyph,accessibilityLabel,style}){
  const detail=sub??hint;
  const fire=()=>{
    if(onChange) onChange(!value);
    else onPress?.();
  };
  return(
    <Pressable
      style={({pressed})=>[kit.toggle,value&&kit.toggleOn,pressed&&kit.togglePressed,disabled&&kit.toggleDisabled,style]}
      onPress={disabled?undefined:fire}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{checked:!!value,disabled:!!disabled}}
      accessibilityLabel={accessibilityLabel||label}
    >
      {/* The mark sits on the LEFT, beside the claim it affirms, and Choice
          puts its radio in the same place -- so a form reading "tick these,
          then pick one of those" has one column of marks rather than two
          different alignments. */}
      <View style={[kit.toggleBox,value&&kit.toggleBoxOn]}>
        {value?<Glyph name="check" size={13} colour={INK.paper} weight={2}/>:null}
      </View>
      {glyph?<View style={kit.rowGlyph}><Glyph name={glyph} size={17} colour={INK.readoutSoft}/></View>:null}
      <View style={kit.toggleBody}>
        <Text style={kit.rowTitle}>{label}</Text>
        {detail?<Text style={kit.rowSub}>{detail}</Text>:null}
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// CHOICE — pick one of several, where each option needs a sentence.
// ---------------------------------------------------------------------------
// Audience, visibility, duration-with-consequences. Chip and Segmented hold one
// word each; this is for the choices where the word is not enough and the
// difference between the options is the sentence under it.
//
// Each option keeps whatever accessibilityLabel it is given verbatim, because
// these are exactly the controls whose spoken labels tests pin down
// ("Everyone: Any Explorer, while it is live").
export function Choice({options,value,onChange,disabled,style}){
  return(
    <View style={style}>
      {options.map((option)=>{
        const key=option.key??option.value;
        const selected=key===value;
        return(
          <Pressable
            key={String(key)}
            style={({pressed})=>[kit.choice,selected&&kit.choiceOn,pressed&&kit.togglePressed,disabled&&kit.toggleDisabled]}
            onPress={disabled?undefined:()=>onChange?.(key)}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityState={{selected,disabled:!!disabled}}
            accessibilityLabel={option.accessibilityLabel||[option.label,option.sub].filter(Boolean).join(": ")}
          >
            <View style={[kit.choiceMark,selected&&kit.choiceMarkOn]}>
              {selected?<View style={kit.choiceDot}/>:null}
            </View>
            <View style={kit.toggleBody}>
              <Text style={kit.rowTitle}>{option.label}</Text>
              {option.sub?<Text style={kit.rowSub}>{option.sub}</Text>:null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// COUNTER — a thing you can do, and how many people have done it.
// ---------------------------------------------------------------------------
// Like, Useful, Follow, Save, Comment. Five files had each grown their own copy
// of the same twelve-line style block, which is drift starting: the moment one
// of them is tweaked the row of controls under a post stops matching.
//
// Acting is NOT a state ink. Whether you personally liked something is not a
// state a PLACE is in, so a pressed counter steps up a surface and strengthens
// its edge, exactly like a selected chip. The glyph carries the meaning and the
// count stays in the data face, because the app counted it.
export function Counter({glyph,count,label,acted,onPress,disabled,accessibilityLabel,style,busy,compact,inert}){
  // `inert` is a reading rather than a control -- a count somebody else's
  // endorsements have reached, shown to a person who may not add to it. It
  // keeps the shape so the row stays even, drops to the faint readout, and
  // announces itself as text rather than as a button that does nothing.
  if(inert){
    return(
      <View style={[kit.counter,kit.counterInert,compact&&kit.counterCompact,style]}
        accessibilityRole="text" accessibilityLabel={accessibilityLabel||label}>
        <Glyph name={glyph} size={14} colour={INK.readoutFaint} weight={1.6}/>
        {count!=null?<Text style={kit.counterCountInert}>{count}</Text>:null}
        {label?<Text style={kit.counterCountInert} numberOfLines={1}>{label}</Text>:null}
      </View>
    );
  }
  return(
    <Pressable
      style={({pressed})=>[kit.counter,compact&&kit.counterCompact,acted&&kit.counterActed,pressed&&kit.counterPressed,(disabled||busy)&&kit.counterDisabled,style]}
      onPress={(disabled||busy)?undefined:onPress}
      disabled={disabled||busy}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel||label}
      accessibilityState={{selected:!!acted,disabled:!!(disabled||busy)}}
    >
      {/* The spinner replaces the GLYPH, not the whole control -- the count
          stays put, so the row does not reflow while a like is in flight. */}
      {busy
        ? <ActivityIndicator size="small" color={acted?INK.readout:INK.readoutSoft}/>
        : <Glyph name={glyph} size={14} colour={acted?INK.readout:INK.readoutSoft} weight={acted?1.9:1.5}/>}
      {count!=null?<Text style={[kit.counterCount,acted&&kit.counterCountActed]}>{count}</Text>:null}
      {label?<Text style={[kit.counterLabel,acted&&kit.counterCountActed]} numberOfLines={1}>{label}</Text>:null}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// EMPTY — nothing to read.
// ---------------------------------------------------------------------------
// docs/design-system.md: "Empty states are instructions, not moods." So this
// takes an instruction, and shows the instrument saying it has no reading
// rather than a shrug.
// `compact` is for when several of these sit in one column. Discover has six
// carousels, and six full-size empties on a brand-new account is about 3000px
// of "nothing here yet" -- which is a worse answer than the one sentence each
// of them actually needs to say.
export function Empty({title,instruction,action,glyph="info",compact,style}){
  if(compact){
    return(
      <View style={[kit.emptyCompact,style]}>
        <Glyph name={glyph} size={14} colour={INK.readoutFaint}/>
        <View style={kit.emptyCompactBody}>
          <Text style={kit.emptyCompactTitle}>{title}</Text>
          {instruction?<Text style={kit.emptyCompactInstruction}>{instruction}</Text>:null}
        </View>
        {action}
      </View>
    );
  }
  return(
    <View style={[kit.empty,style]}>
      <View style={kit.emptyDial}>
        <Glyph name={glyph} size={20} colour={INK.readoutFaint}/>
        <View style={kit.emptyDialRing} pointerEvents="none"/>
      </View>
      <Text style={kit.emptyTitle}>{title}</Text>
      {instruction?<Text style={kit.emptyInstruction}>{instruction}</Text>:null}
      {action?<View style={kit.emptyAction}>{action}</View>:null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// NOTICE — something the app needs to say.
// ---------------------------------------------------------------------------
// Errors, permission gates, warnings. An edge in the state ink and a mono
// eyebrow; never a coloured background with text fighting it.
export function Notice({tone="scheduled",label,children,action,glyph,style}){
  return(
    <StateEdge tone={tone} style={[kit.notice,style]}>
      {label?(
        <View style={kit.noticeHead}>
          {glyph?<Glyph name={glyph} size={13} colour={INK[tone]||INK.scheduled}/>:null}
          <Text style={[kit.noticeLabel,{color:INK[tone]||INK.scheduled}]}>{label}</Text>
        </View>
      ):null}
      {typeof children==="string"?<Text style={kit.noticeBody}>{children}</Text>:children}
      {action?<View style={kit.noticeAction}>{action}</View>:null}
    </StateEdge>
  );
}

const kit=StyleSheet.create({
  screen:{flex:1,backgroundColor:INK.ground},

  titleBlock:{paddingHorizontal:16,paddingTop:14,paddingBottom:2},
  titleEyebrow:{
    color:INK.readoutFaint,fontFamily:MONO_MEDIUM,fontSize:TYPE.data.sizes.sm,
    textTransform:"uppercase",letterSpacing:1,marginBottom:5
  },
  titleRow:{flexDirection:"row",alignItems:"flex-start",justifyContent:"space-between",gap:12},
  titleText:{
    flex:1,color:INK.readout,fontFamily:FONT.display,fontSize:TYPE.display.sizes.lg,letterSpacing:-0.5
  },
  titleMeta:{color:INK.readoutSoft,fontFamily:FONT.body,fontSize:TYPE.body.sizes.md,marginTop:5,lineHeight:TYPE.body.sizes.md*1.5},
  titleRule:{flexDirection:"row",alignItems:"flex-end",marginTop:12,marginBottom:4},
  titleRuleLine:{flex:1,height:1,backgroundColor:INK.hair,marginBottom:0},

  // A PILL, AND SELECTION FILLS WITH INK.
  // The artifact's .chip is a pill with an ink border on card, and .chip.active
  // is solid ink with paper-coloured type. On a print surface a filled chip is
  // legible and obvious; the surface-step trick belonged to the dark build.
  chip:{
    flexDirection:"row",alignItems:"center",gap:5,
    minHeight:34,paddingHorizontal:13,paddingVertical:8,
    backgroundColor:INK.card,borderWidth:SHAPE.border,borderColor:INK.ink,
    borderRadius:SHAPE.radius.pill
  },
  chipSelected:{backgroundColor:INK.ink,borderColor:INK.ink},
  chipDisabled:{opacity:0.45},
  chipDot:{width:6,height:6,borderRadius:3},
  chipText:{
    color:INK.ink,fontFamily:MONO,fontSize:TYPE.data.sizes.md,
    textTransform:"uppercase",letterSpacing:TYPE.data.tracking*TYPE.data.sizes.md
  },
  chipTextSelected:{color:INK.paper,fontFamily:MONO_MEDIUM},
  chipTextDisabled:{color:INK.readoutFaint},

  segmentBar:{flexDirection:"row",alignItems:"stretch",paddingHorizontal:12,gap:2},
  segmentScroll:{flexGrow:0,flexShrink:0},
  segmentScrollContent:{alignItems:"center",paddingHorizontal:12,gap:2},
  segment:{paddingHorizontal:12,paddingTop:10,alignItems:"center",minHeight:SHAPE.tapTarget},
  segmentRow:{flexDirection:"row",alignItems:"center",gap:5,marginBottom:8},
  segmentText:{
    color:INK.readoutFaint,fontFamily:MONO,fontSize:TYPE.data.sizes.md,
    textTransform:"uppercase",letterSpacing:0.8
  },
  segmentMeta:{color:INK.readoutFaint,fontFamily:MONO,fontSize:TYPE.data.sizes.sm,opacity:0.85},
  segmentMetaActive:{color:INK.readoutSoft,opacity:1},
  segmentTextActive:{color:INK.readout,fontFamily:MONO_MEDIUM},
  segmentDetent:{height:2,alignSelf:"stretch",minWidth:18,backgroundColor:INK.hairline},
  segmentDetentActive:{backgroundColor:INK.hairlineStrong,height:2},

  // The artifact's .btn: a 2px ink border, the 9px control radius, and the
  // small hard shadow. Every button in this system is a printed block.
  action:{
    flexDirection:"row",alignItems:"center",justifyContent:"center",gap:6,
    minHeight:SHAPE.tapTarget,paddingHorizontal:18,
    borderRadius:SHAPE.radius.control,borderWidth:SHAPE.borderStrong,
    borderColor:INK.ink,
    ...SHAPE.shadow.hardSm
  },
  // Compact keeps the 44px tap floor -- it narrows the padding, never the
  // target. A button small enough to miss is not a smaller button, it is a
  // broken one.
  actionCompact:{paddingHorizontal:11,gap:6},
  actionSecondary:{backgroundColor:INK.card,borderColor:INK.ink},
  actionQuiet:{backgroundColor:"transparent",borderColor:INK.ink},
  // Pressed, the block slides into its own shadow -- the artifact's
  // .chip-icon:active. That is what a printed control does when you push it.
  actionPressed:{transform:[{translateX:1.5},{translateY:1.5}],shadowOpacity:0},
  actionDisabled:{opacity:0.45},
  actionText:{fontFamily:MONO_MEDIUM,fontSize:TYPE.data.sizes.lg,textTransform:"uppercase",letterSpacing:1},
  actionTextCompact:{fontSize:TYPE.data.sizes.md,letterSpacing:0.8},

  rowEdge:{marginBottom:8},
  row:{flexDirection:"row",alignItems:"center",gap:11,paddingHorizontal:13,paddingVertical:12,minHeight:56},
  rowStandalone:{
    backgroundColor:INK.card,borderWidth:SHAPE.border,borderColor:INK.ink,
    borderRadius:SHAPE.radius.card,marginBottom:10,
    ...SHAPE.shadow.hardSm
  },
  rowNested:{backgroundColor:INK.panelRaised,borderColor:INK.hairlineStrong},
  // The artifact's .chip-icon: a 34px ink-bordered disc with its own small
  // hard shadow. Every leading mark in a list is one of these.
  rowGlyph:{
    width:34,height:34,borderRadius:SHAPE.radius.pill,alignItems:"center",justifyContent:"center",
    backgroundColor:INK.card,borderWidth:SHAPE.border,borderColor:INK.ink,
    shadowColor:INK.ink,shadowOpacity:1,shadowRadius:0,shadowOffset:{width:1.5,height:1.5}
  },
  rowBody:{flex:1,minWidth:0},
  rowTitle:{color:INK.readout,fontFamily:FONT.displaySoft,fontSize:TYPE.display.sizes.sm,letterSpacing:-0.2},
  rowSub:{color:INK.readoutSoft,fontFamily:FONT.body,fontSize:TYPE.body.sizes.sm,marginTop:3,lineHeight:TYPE.body.sizes.sm*1.5},
  rowMeta:{alignItems:"flex-end",gap:2},
  rowMetaText:{color:INK.readout,fontFamily:MONO,fontSize:TYPE.data.sizes.md,letterSpacing:0.5},
  rowMetaSub:{color:INK.readoutFaint,fontFamily:MONO,fontSize:TYPE.data.sizes.sm,letterSpacing:0.5},
  rowChevron:{marginLeft:-2},

  meterWrap:{flexDirection:"row",alignItems:"center",gap:8},
  meterLabel:{color:INK.readoutFaint,fontFamily:MONO,fontSize:TYPE.data.sizes.sm,textTransform:"uppercase",letterSpacing:0.6},
  meterTrack:{height:8,backgroundColor:INK.inset,borderWidth:SHAPE.border,borderColor:INK.hairline,borderRadius:2,overflow:"hidden",justifyContent:"center"},
  meterFill:{position:"absolute",left:0,top:0,bottom:0,opacity:0.9},
  meterTicks:{position:"absolute",left:0,right:0,bottom:0,opacity:0.5},
  meterValue:{color:INK.readout,fontFamily:MONO,fontSize:TYPE.data.sizes.md,letterSpacing:0.5},

  field:{marginBottom:16},
  fieldLabelRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:6},
  fieldLabel:{color:INK.readoutSoft,fontFamily:MONO,fontSize:TYPE.data.sizes.md,textTransform:"uppercase",letterSpacing:0.9},
  fieldRequired:{color:INK.readoutFaint,fontFamily:MONO,fontSize:TYPE.data.sizes.sm,letterSpacing:0.9},
  fieldWell:{
    backgroundColor:INK.card,borderWidth:SHAPE.border,borderColor:INK.ink,
    borderRadius:SHAPE.radius.control,overflow:"hidden"
  },
  fieldWellError:{borderColor:INK.red,borderWidth:SHAPE.borderStrong},
  fieldFootRow:{flexDirection:"row",alignItems:"flex-start",gap:10,marginTop:6},
  fieldFootGrow:{flex:1},
  fieldCounter:{color:INK.readoutFaint,fontFamily:MONO,fontSize:TYPE.data.sizes.sm,letterSpacing:0.5},
  fieldHint:{color:INK.readoutFaint,fontSize:TYPE.body.sizes.sm,lineHeight:TYPE.body.sizes.sm*1.5},
  fieldError:{color:INK.dispute,fontSize:TYPE.body.sizes.sm,lineHeight:TYPE.body.sizes.sm*1.5},

  kv:{flexDirection:"row",alignItems:"center",gap:8,paddingVertical:9},
  kvLabel:{color:INK.readoutFaint,fontFamily:MONO,fontSize:TYPE.data.sizes.md,textTransform:"uppercase",letterSpacing:0.8},
  kvLine:{flex:1,height:1,backgroundColor:INK.hair},
  kvValue:{color:INK.readout,fontFamily:MONO,fontSize:TYPE.data.sizes.md,letterSpacing:0.5},
  kvStack:{paddingVertical:9,gap:6},
  kvStackHead:{flexDirection:"row",alignItems:"center",gap:8},
  // Body face, not mono: a wrapped value is prose (an address, a set of hours),
  // and prose set in the data face is unreadable at three lines.
  kvStackValue:{color:INK.readout,fontFamily:FONT.body,fontSize:TYPE.body.sizes.md,lineHeight:TYPE.body.sizes.md*1.5},

  strip:{flexDirection:"row",alignItems:"stretch",paddingVertical:12},
  stripCell:{flex:1,alignItems:"center",paddingHorizontal:6},
  stripDivider:{width:1,backgroundColor:INK.hair,marginVertical:2},

  frame:{
    backgroundColor:INK.card,borderWidth:SHAPE.border,borderColor:INK.ink,
    borderRadius:SHAPE.radius.control,overflow:"hidden",alignItems:"center",justifyContent:"center"
  },

  counter:{
    flexDirection:"row",alignItems:"center",gap:5,minHeight:36,
    paddingHorizontal:12,paddingVertical:8,borderRadius:SHAPE.radius.pill,
    backgroundColor:INK.card,borderWidth:SHAPE.border,borderColor:INK.ink,
    shadowColor:INK.ink,shadowOpacity:1,shadowRadius:0,shadowOffset:{width:1.5,height:1.5}
  },
  counterActed:{backgroundColor:INK.ink,borderColor:INK.ink},
  // Compact narrows the padding and never the 36px height -- a control small
  // enough to miss is not a smaller control, it is a broken one.
  counterCompact:{paddingHorizontal:8,gap:5},
  counterInert:{opacity:0.75},

  toggle:{
    flexDirection:"row",alignItems:"flex-start",gap:11,
    paddingHorizontal:13,paddingVertical:12,minHeight:56,marginBottom:8,
    backgroundColor:INK.panel,borderWidth:SHAPE.border,borderColor:INK.hairline,
    borderRadius:SHAPE.radius.card
  },
  toggleOn:{backgroundColor:INK.panelRaised,borderColor:INK.hairlineStrong},
  togglePressed:{opacity:0.8},
  toggleDisabled:{opacity:0.45},
  toggleBody:{flex:1,minWidth:0},
  // A bracketed box rather than a sliding track: the instrument's controls are
  // machined, and a tick in a well is the same shape language as everything
  // else on the housing.
  toggleBox:{
    width:26,height:26,borderRadius:SHAPE.radius.control,marginTop:1,
    alignItems:"center",justifyContent:"center",
    backgroundColor:INK.card,borderWidth:SHAPE.borderStrong,borderColor:INK.ink
  },
  toggleBoxOn:{backgroundColor:INK.ink},

  choice:{
    flexDirection:"row",alignItems:"flex-start",gap:11,
    paddingHorizontal:13,paddingVertical:12,minHeight:56,marginBottom:8,
    backgroundColor:INK.panel,borderWidth:SHAPE.border,borderColor:INK.hairline,
    borderRadius:SHAPE.radius.card
  },
  choiceOn:{backgroundColor:INK.panelRaised,borderColor:INK.hairlineStrong},
  choiceMark:{
    width:20,height:20,borderRadius:10,marginTop:2,
    alignItems:"center",justifyContent:"center",
    backgroundColor:INK.card,borderWidth:SHAPE.borderStrong,borderColor:INK.ink
  },
  choiceMarkOn:{borderColor:INK.blue},
  choiceDot:{width:8,height:8,borderRadius:4,backgroundColor:INK.blue},
  counterCountInert:{color:INK.readoutFaint,fontFamily:MONO,fontSize:TYPE.data.sizes.md,letterSpacing:0.5},
  counterPressed:{opacity:0.78},
  counterDisabled:{opacity:0.45},
  counterCount:{color:INK.readoutSoft,fontFamily:MONO,fontSize:TYPE.data.sizes.md,letterSpacing:0.5},
  counterLabel:{
    color:INK.readoutSoft,fontFamily:MONO,fontSize:TYPE.data.sizes.md,
    textTransform:"uppercase",letterSpacing:0.7
  },
  counterCountActed:{color:INK.paper,fontFamily:MONO_MEDIUM},

  empty:{alignItems:"center",paddingHorizontal:28,paddingVertical:44,gap:10},
  emptyDial:{
    width:56,height:56,borderRadius:28,alignItems:"center",justifyContent:"center",
    backgroundColor:INK.card,borderWidth:SHAPE.borderStrong,borderColor:INK.ink,marginBottom:4,
    shadowColor:INK.ink,shadowOpacity:1,shadowRadius:0,shadowOffset:{width:2,height:2}
  },
  emptyDialRing:{
    position:"absolute",top:6,left:6,right:6,bottom:6,borderRadius:22,
    borderWidth:1,borderColor:INK.hair
  },
  emptyTitle:{color:INK.readout,fontFamily:FONT.display,fontSize:TYPE.display.sizes.md,textAlign:"center",letterSpacing:-0.3},
  emptyInstruction:{color:INK.readoutSoft,fontFamily:FONT.body,fontSize:TYPE.body.sizes.md,textAlign:"center",lineHeight:TYPE.body.sizes.md*1.5},
  emptyAction:{marginTop:8,alignSelf:"stretch"},
  emptyCompact:{
    flexDirection:"row",alignItems:"flex-start",gap:10,
    paddingVertical:14,paddingHorizontal:13,
    backgroundColor:INK.panel,borderWidth:SHAPE.border,borderColor:INK.hairline,
    borderRadius:SHAPE.radius.card,marginBottom:8
  },
  emptyCompactBody:{flex:1,gap:3},
  emptyCompactTitle:{color:INK.readoutSoft,fontFamily:MONO,fontSize:TYPE.data.sizes.md,textTransform:"uppercase",letterSpacing:0.8},
  emptyCompactInstruction:{color:INK.readoutFaint,fontFamily:FONT.body,fontSize:TYPE.body.sizes.sm,lineHeight:TYPE.body.sizes.sm*1.5},

  notice:{padding:13,marginBottom:12,gap:6},
  noticeHead:{flexDirection:"row",alignItems:"center",gap:7},
  noticeLabel:{fontFamily:MONO,fontSize:TYPE.data.sizes.md,textTransform:"uppercase",letterSpacing:1},
  noticeBody:{color:INK.readout,fontFamily:FONT.body,fontSize:TYPE.body.sizes.md,lineHeight:TYPE.body.sizes.md*1.5},
  noticeAction:{marginTop:4}
});

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
      <View style={[styles.dialLabels,{width}]}>
        {values.map((v)=>(
          // 44px, not 13. The label itself is a 13px line of mono; without real
          // padding the tap target was the glyph, which is a third of the
          // accessibility floor. The padding is vertical so the detents stay at
          // their measured positions along the scale -- moving them sideways
          // would make the dial lie about where its stops are.
          <Pressable key={String(v)} onPress={()=>onChange?.(v)}
            style={styles.dialHit} hitSlop={{top:6,bottom:6,left:8,right:8}}
            accessibilityRole="button" accessibilityLabel={format(v)}
            accessibilityState={{selected:v===active}}>
            <Text style={[styles.dialLabel,v===active&&styles.dialLabelActive]}>{format(v)}</Text>
          </Pressable>
        ))}
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
  dialLabels:{height:SHAPE.tapTarget},
  dialCell:{position:"absolute",top:0,width:0,alignItems:"center"},
  dialBareDetent:{width:3,height:3,borderRadius:1.5,backgroundColor:INK.hairlineStrong,marginTop:4},
  dialHit:{minHeight:SHAPE.tapTarget,minWidth:32,alignItems:"center",justifyContent:"center"},
  dialLabel:{
    color:INK.readoutFaint,fontFamily:MONO,fontSize:TYPE.data.sizes.sm,
    textTransform:"uppercase",letterSpacing:0.6
  },
  dialLabelActive:{color:INK.scheduled},

  panel:{
    backgroundColor:INK.panel,borderWidth:SHAPE.border,borderColor:INK.hairline,
    borderRadius:SHAPE.radius.card,overflow:"hidden"
  },
  panelRaised:{backgroundColor:INK.panelRaised},
  panelEdge:{
    position:"absolute",top:0,left:0,right:0,height:1,
    backgroundColor:SHAPE.edgeHighlight
  },

  sectionRule:{flexDirection:"row",alignItems:"center",gap:10,marginTop:22,marginBottom:10},
  sectionLabel:{
    color:INK.readoutSoft,fontFamily:MONO,fontSize:TYPE.data.sizes.md,
    textTransform:"uppercase",letterSpacing:TYPE.data.tracking*TYPE.data.sizes.md
  },
  sectionLine:{flex:1,height:1,backgroundColor:INK.hairline},
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
// GLYPH — the icon set.
// ---------------------------------------------------------------------------
// Emoji were standing in for icons across the app. An emoji is somebody else's
// design: it carries its own colour, its own weight and its own house style,
// and on a dark instrument face it reads as a sticker.
//
// Replacing them with a CONVENTIONAL stroked set was only half the job, and the
// product owner said so: "the icons are still the same". A compass rose for
// Happening, a magnifier for search, two heads for Community — that is the
// icon set every app has, sitting on a face that is meant to read as a machined
// instrument. It was a fidelity upgrade, not a design decision.
//
// So the set is redrawn from the design's own vocabulary: ticks, hairline
// rules, brackets, apertures, dials and reticles. An icon here is an ETCHED
// MARK ON A HOUSING, not a friendly pictogram of an object.
//
// THE CONSTRUCTION RULES — draw the next icon this way
//
//  1. CANVAS 16x16, LIVE AREA 2.8-13.2. Nothing is drawn outside that 10.4
//     square; the margin is the plate the mark is engraved into.
//  2. ONE BASELINE, y=12.8, and one cap line, y=3.2. Anything that stands —
//     a person, a building, a chart, a plinth — sits ON 12.8, which is where
//     the cap height of the mono label beside it also sits. That is what makes
//     a glyph and its label read as one line rather than two objects.
//  3. ONE STROKE WEIGHT. Every mark is stroked at the weight the caller passes
//     (1.5 by default) and nothing is ever filled. Emphasis comes from how many
//     marks there are, never from a heavier or doubled line.
//  4. ANGLES ARE 0, 90 OR 45 DEGREES ONLY. Every diagonal in this table is an
//     exact 45 — chevrons, the check, the scriber, the envelope flap, the
//     needle. A freehand angle is what makes a set look drawn rather than
//     machined.
//  5. RADII COME FROM ONE LADDER: 1.1 dot · 1.8 detent · 2.4 collar ·
//     3.2 dial · 4.2 lens · 5.2 bezel. A ring that is none of these is a ring
//     somebody eyeballed.
//  6. TICKS ARE ~2 UNITS and MINIMUM CLEAR GAP IS 2.4. Two strokes closer than
//     that merge into a smudge at 13px, which is the size these are actually
//     read at. Test at 13, not at 100.
//  7. AT MOST SIX SUBPATHS. Detail that cannot survive 13px is not detail, it
//     is noise.
//  8. THE VOCABULARY IS FIXED: bezel (a reading), tick (a graduation), rule (an
//     etched line), bracket (a frame), plinth (a housing), wedge (a direction),
//     aperture (a fix). Compose a new icon out of those seven, not out of a
//     picture of the thing.
//
// The five navigation marks are the load-bearing ones — they are on every
// screen — and each takes a different primitive so the bar reads as five
// controls rather than five drawings: map is a bracketed frame around an
// aperture (the view you look through at the world), Happening is a dial with a
// needle, Community is three stations, Messages is a channel between two
// brackets, Me is a station on its plinth. components/TabBar.js draws them from
// here; there is no second copy.
const GLYPHS={
  // --- travel and assent: chevrons cut at exactly 45 degrees -----------------
  back:      [{d:"M9.6 3.6 5.2 8l4.4 4.4"}],
  forward:   [{d:"M6.4 3.6 10.8 8l-4.4 4.4"}],
  up:        [{d:"M3.6 9.6 8 5.2l4.4 4.4"}],
  down:      [{d:"M3.6 6.4 8 10.8l4.4-4.4"}],
  close:     [{d:"M4.4 4.4 11.6 11.6"},{d:"M11.6 4.4 4.4 11.6"}],
  plus:      [{d:"M8 3.2v9.6"},{d:"M3.2 8h9.6"}],
  minus:     [{d:"M3.2 8h9.6"}],
  check:     [{d:"M3.2 8.4 6.8 12l6.4-6.4"}],

  // --- the five navigation marks -------------------------------------------
  map:       [{d:"M2.8 6V2.8h3.2"},{d:"M10 2.8h3.2V6"},{d:"M13.2 10v3.2H10"},{d:"M6 13.2H2.8V10"},{c:[8,8,1.8]}],
  compass:   [{c:[8,8,5.2]},{c:[8,8,1.3]},{d:"M9 7 11.6 4.4"},{d:"M7 9 5.6 10.4"}],
  community: [{c:[4.4,5.2,2]},{c:[11.6,5.2,2]},{c:[8,11.2,2]}],
  message:   [{d:"M6 3.6H3.2v8.8H6"},{d:"M10 3.6h2.8v8.8H10"},{d:"M6.4 6.8h3.2"},{d:"M6.4 9.2h3.2"}],
  person:    [{c:[8,5.8,2.4]},{d:"M4.4 12.8v-2h7.2v2"}],
  people:    [{c:[4.8,5.6,1.8]},{c:[11.2,5.6,1.8]},{d:"M2.8 12.8v-2h10.4v2"}],

  // --- readings -------------------------------------------------------------
  bell:      [{d:"M4.4 11.2V7.6a3.6 3.6 0 0 1 7.2 0v3.6"},{d:"M2.8 11.2h10.4"},{d:"M8 11.2v1.8"}],
  search:    [{c:[7,7,4.2]},{d:"M10 10 13.2 13.2"}],
  pin:       [{c:[8,5.8,2.4]},{d:"M8 12.8 4.4 9.2h7.2z"}],
  clock:     [{c:[8,8,5.2]},{d:"M8 4.4V8h2.8"}],
  calendar:  [{d:"M2.8 4.4h10.4v8.4H2.8z"},{d:"M2.8 7.2h10.4"},{d:"M5.6 2.8v2.8"},{d:"M10.4 2.8v2.8"}],
  camera:    [{d:"M2.8 5.2h10.4v7.6H2.8z"},{c:[8,9,2.4]},{d:"M6 5.2V3.6h4v1.6"}],
  star:      [{d:"M8 2.8 9.8 6.6l4 .6-2.9 2.8.7 4L8 12.1l-3.6 1.9.7-4-2.9-2.8 4-.6z"}],
  heart:     [{d:"M8 12.8 3.6 8.4a2.8 2.8 0 0 1 4.4-3.4 2.8 2.8 0 0 1 4.4 3.4z"}],
  comment:   [{d:"M2.8 3.6h10.4v6.8H7.2l-2.8 2.8v-2.8H2.8z"},{d:"M5.2 7h5.6"}],
  share:     [{c:[11.6,4.4,1.8]},{c:[4.4,8,1.8]},{c:[11.6,11.6,1.8]},{d:"M6 7.2 10 5.2"},{d:"M6 8.8 10 10.8"}],
  lock:      [{d:"M4.2 7.2h7.6v5.6H4.2z"},{d:"M5.8 7.2V5.6a2.2 2.2 0 0 1 4.4 0v1.6"},{d:"M8 9.2v1.6"}],
  filter:    [{d:"M2.8 3.6h10.4L9.2 7.6v5.2H6.8V7.6z"}],
  edit:      [{d:"M10 3.2 12.8 6 6 12.8H3.2V10z"}],
  trash:     [{d:"M2.8 4.8h10.4"},{d:"M5.6 4.8V3.2h4.8v1.6"},{d:"M4.4 4.8v8h7.2v-8"},{d:"M6.8 7.2v3.2"},{d:"M9.2 7.2v3.2"}],
  info:      [{c:[8,8,5.2]},{d:"M8 7.2v3.2"},{d:"M8 5.2v1"}],
  warn:      [{d:"M8 3.2 13.2 12.8H2.8z"},{d:"M8 6.8v3"},{d:"M8 11.4v1"}],
  send:      [{d:"M13.2 2.8 2.8 8l4.4 1.6 1.6 4.4z"}],
  qr:        [{d:"M2.8 2.8h4.4v4.4H2.8z"},{d:"M8.8 2.8h4.4v4.4H8.8z"},{d:"M2.8 8.8h4.4v4.4H2.8z"},{d:"M8.8 8.8v2.4"},{d:"M11.6 13.2h1.6"}],
  play:      [{d:"M5.6 3.6 12 8l-6.4 4.4z"}],
  live:      [{c:[8,8,2.2]},{d:"M4.3 4.3a5.2 5.2 0 0 0 0 7.4"},{d:"M11.7 4.3a5.2 5.2 0 0 1 0 7.4"}],
  home:      [{d:"M3.2 8 8 3.2l4.8 4.8"},{d:"M4.8 9.2v3.6h6.4V9.2"}],
  bookmark:  [{d:"M4.4 3.2h7.2v9.6L8 10.4l-3.6 2.4z"}],
  ticket:    [{d:"M2.8 5.2h10.4v2a1.4 1.4 0 0 0 0 2.8v2.8H2.8V10a1.4 1.4 0 0 0 0-2.8z"},{d:"M8.4 5.6v1.4"},{d:"M8.4 9.4v1.4"}],
  tag:       [{d:"M2.8 2.8h5.6l4.8 4.8-5.6 5.6-4.8-4.8z"},{c:[5.2,5.2,1.1]}],
  building:  [{d:"M3.2 12.8V3.2h6.4v9.6"},{d:"M9.6 6.8h3.2v6"},{d:"M5.2 5.6h2.4"},{d:"M5.2 8h2.4"},{d:"M5.2 10.4h2.4"}],
  bed:       [{d:"M2.8 12.8V6.4"},{d:"M2.8 8.8h10.4v4"},{d:"M13.2 8.8a2.4 2.4 0 0 0-2.4-2.4H7.2v2.4"},{c:[4.8,6.8,1.2]}],
  ring:      [{c:[8,8,5.2]},{c:[8,8,2.2]}],
  flag:      [{d:"M4 12.8V3.2"},{d:"M4 3.6h7.6L9.6 6.4l2 2.8H4"}],
  block:     [{c:[8,8,5.2]},{d:"M4.4 11.6 11.6 4.4"}],
  shield:    [{d:"M8 3.2 12.8 4.8v3.6c0 2.8-2 4.4-4.8 5.2-2.8-.8-4.8-2.4-4.8-5.2V4.8z"}],
  key:       [{c:[5.2,8,2.4]},{d:"M7.6 8h5.6"},{d:"M10.4 8v2.4"},{d:"M12.8 8v1.6"}],
  card:      [{d:"M2.8 4.4h10.4v7.2H2.8z"},{d:"M2.8 7h10.4"},{d:"M4.8 9.2h2.4"}],
  chart:     [{d:"M2.8 12.8h10.4"},{d:"M4.8 12.8V8.8"},{d:"M8 12.8V4.8"},{d:"M11.2 12.8V9.6"}],
  list:      [{d:"M5.6 4.4h7.6"},{d:"M5.6 8h7.6"},{d:"M5.6 11.6h7.6"},{d:"M2.8 4.4h1"},{d:"M2.8 8h1"},{d:"M2.8 11.6h1"}],
  grid:      [{d:"M2.8 2.8h4.4v4.4H2.8z"},{d:"M8.8 2.8h4.4v4.4H8.8z"},{d:"M2.8 8.8h4.4v4.4H2.8z"},{d:"M8.8 8.8h4.4v4.4H8.8z"}],
  refresh:   [{d:"M13 8a5 5 0 1 1-1.6-3.7"},{d:"M13.2 3.2v3.2H10"}],
  external:  [{d:"M7.2 3.2H3.2v9.6h9.6V8.8"},{d:"M9.6 3.2h3.6v3.6"},{d:"M13.2 3.2 8 8.4"}],
  mail:      [{d:"M2.8 4.4h10.4v7.2H2.8z"},{d:"M2.8 4.4 8 9.6l5.2-5.2"}],
  phone:     [{d:"M5.2 2.8h5.6v10.4H5.2z"},{d:"M7.2 11.2h1.6"}],
  globe:     [{c:[8,8,5.2]},{d:"M2.8 8h10.4"},{d:"M8 2.8c1.6 1.8 2.4 3.6 2.4 5.2s-.8 3.4-2.4 5.2c-1.6-1.8-2.4-3.6-2.4-5.2s.8-3.4 2.4-5.2z"}],
  upload:    [{d:"M8 11.6V3.2"},{d:"M4.8 6.4 8 3.2l3.2 3.2"},{d:"M2.8 12.8h10.4"}],
  download:  [{d:"M8 3.2v8.4"},{d:"M4.8 8.4 8 11.6l3.2-3.2"},{d:"M2.8 12.8h10.4"}],
  image:     [{d:"M2.8 3.6h10.4v8.8H2.8z"},{c:[5.6,6.4,1.2]},{d:"M3.2 11.6 6.8 8l2.4 2.4 2-2 2 2"}],
  video:     [{d:"M2.8 4.8h7.2v6.4H2.8z"},{d:"M10 8 13.2 5.6v4.8z"}],
  mic:       [{d:"M8 2.8a1.8 1.8 0 0 1 1.8 1.8v3.2a1.8 1.8 0 0 1-3.6 0V4.6A1.8 1.8 0 0 1 8 2.8z"},{d:"M4.8 7.6a3.2 3.2 0 0 0 6.4 0"},{d:"M8 10.8v2"}],
  target:    [{c:[8,8,4.8]},{c:[8,8,1.6]},{d:"M8 2.8v2"},{d:"M8 11.2v2"},{d:"M2.8 8h2"},{d:"M11.2 8h2"}],
  sliders:   [{d:"M2.8 5.6h10.4"},{d:"M2.8 10.4h10.4"},{c:[6,5.6,1.8]},{c:[10,10.4,1.8]}],
  sort:      [{d:"M4.8 3.2v9.6"},{d:"M2.8 10.8 4.8 12.8l2-2"},{d:"M11.2 12.8V3.2"},{d:"M9.2 5.2 11.2 3.2l2 2"}],
  more:      [{c:[3.6,8,1.1]},{c:[8,8,1.1]},{c:[12.4,8,1.1]}],
  award:     [{c:[8,6,3.2]},{d:"M6 8.8 5.2 12.8 8 11.2l2.8 1.6-.8-4"}],
  gift:      [{d:"M2.8 6.4h10.4v2.4H2.8z"},{d:"M4 8.8v4h8v-4"},{d:"M8 6.4v6.4"},{d:"M8 6.4 6 4.4"},{d:"M8 6.4 10 4.4"}],
  clipboard: [{d:"M4.4 3.6h7.2v9.2H4.4z"},{d:"M6.4 3.6V2.8h3.2v.8"},{d:"M6.4 7h3.2"},{d:"M6.4 9.6h3.2"}],
  eye:       [{d:"M2.8 8s2.2-3.6 5.2-3.6S13.2 8 13.2 8s-2.2 3.6-5.2 3.6S2.8 8 2.8 8z"},{c:[8,8,1.8]}],
  eyeOff:    [{d:"M3.6 5.2C2.8 6.2 2.8 8 2.8 8s2.2 3.6 5.2 3.6c1 0 1.9-.4 2.6-.9"},{d:"M6.4 4.6A5 5 0 0 1 8 4.4c3 0 5.2 3.6 5.2 3.6a11 11 0 0 1-1.6 2"},{d:"M3.2 3.2 12.8 12.8"}],
  settings:  [{c:[8,8,2.4]},{d:"M8 2.8v1.6"},{d:"M8 11.6v1.6"},{d:"M2.8 8h1.6"},{d:"M11.6 8h1.6"},{d:"M4.3 4.3 5.4 5.4"},{d:"M10.6 10.6 11.7 11.7"},{d:"M11.7 4.3 10.6 5.4"},{d:"M5.4 10.6 4.3 11.7"}]
};

export function Glyph({name,size=16,colour=INK.readoutSoft,weight=1.5}){
  const parts=GLYPHS[name];
  if(!parts) return null;
  return(
    <Svg width={size} height={size} viewBox="0 0 16 16">
      {parts.map((p,i)=>p.c
        ? <Circle key={i} cx={p.c[0]} cy={p.c[1]} r={p.c[2]} fill="none" stroke={colour} strokeWidth={weight}/>
        : <Path key={i} d={p.d} fill="none" stroke={colour} strokeWidth={weight} strokeLinecap="round" strokeLinejoin="round"/>
      )}
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
export function Chip({label,selected,tone,onPress,glyph,disabled,style,accessibilityLabel}){
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
      <Text style={[kit.chipText,selected&&kit.chipTextSelected,disabled&&kit.chipTextDisabled]} numberOfLines={1}>{label}</Text>
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
  const fill=kind==="primary"?INK.exists:kind==="danger"?INK.dispute:null;
  const text=filled?INK.ground:kind==="quiet"?INK.readoutSoft:INK.readout;
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
        {value?<Glyph name="check" size={13} colour={INK.readout} weight={2}/>:null}
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
  titleRuleLine:{flex:1,height:1,backgroundColor:INK.hairline,marginBottom:0},

  chip:{
    flexDirection:"row",alignItems:"center",gap:6,
    minHeight:32,paddingHorizontal:11,paddingVertical:6,
    backgroundColor:INK.panel,borderWidth:SHAPE.border,borderColor:INK.hairline,
    borderRadius:SHAPE.radius.control
  },
  chipSelected:{backgroundColor:INK.panelRaised,borderColor:INK.hairlineStrong},
  chipDisabled:{opacity:0.45},
  chipDot:{width:6,height:6,borderRadius:3},
  chipText:{
    color:INK.readoutSoft,fontFamily:MONO,fontSize:TYPE.data.sizes.md,
    textTransform:"uppercase",letterSpacing:0.7
  },
  chipTextSelected:{color:INK.readout,fontFamily:MONO_MEDIUM},
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

  action:{
    flexDirection:"row",alignItems:"center",justifyContent:"center",gap:8,
    minHeight:SHAPE.tapTarget,paddingHorizontal:16,
    borderRadius:SHAPE.radius.control,borderWidth:SHAPE.border
  },
  // Compact keeps the 44px tap floor -- it narrows the padding, never the
  // target. A button small enough to miss is not a smaller button, it is a
  // broken one.
  actionCompact:{paddingHorizontal:11,gap:6},
  actionSecondary:{backgroundColor:INK.panelRaised,borderColor:INK.hairlineStrong},
  actionQuiet:{backgroundColor:"transparent",borderColor:INK.hairline},
  actionPressed:{opacity:0.78},
  actionDisabled:{opacity:0.45},
  actionText:{fontFamily:MONO_MEDIUM,fontSize:TYPE.data.sizes.lg,textTransform:"uppercase",letterSpacing:1},
  actionTextCompact:{fontSize:TYPE.data.sizes.md,letterSpacing:0.8},

  rowEdge:{marginBottom:8},
  row:{flexDirection:"row",alignItems:"center",gap:11,paddingHorizontal:13,paddingVertical:12,minHeight:56},
  rowStandalone:{
    backgroundColor:INK.panel,borderWidth:SHAPE.border,borderColor:INK.hairline,
    borderRadius:SHAPE.radius.card,marginBottom:8
  },
  rowNested:{backgroundColor:INK.panelRaised,borderColor:INK.hairlineStrong},
  rowGlyph:{
    width:34,height:34,borderRadius:SHAPE.radius.control,alignItems:"center",justifyContent:"center",
    backgroundColor:INK.inset,borderWidth:SHAPE.border,borderColor:INK.hairline
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
    backgroundColor:INK.inset,borderWidth:SHAPE.border,borderColor:INK.hairline,
    borderRadius:SHAPE.radius.control,overflow:"hidden"
  },
  fieldWellError:{borderColor:INK.dispute},
  fieldFootRow:{flexDirection:"row",alignItems:"flex-start",gap:10,marginTop:6},
  fieldFootGrow:{flex:1},
  fieldCounter:{color:INK.readoutFaint,fontFamily:MONO,fontSize:TYPE.data.sizes.sm,letterSpacing:0.5},
  fieldHint:{color:INK.readoutFaint,fontSize:TYPE.body.sizes.sm,lineHeight:TYPE.body.sizes.sm*1.5},
  fieldError:{color:INK.dispute,fontSize:TYPE.body.sizes.sm,lineHeight:TYPE.body.sizes.sm*1.5},

  kv:{flexDirection:"row",alignItems:"center",gap:8,paddingVertical:9},
  kvLabel:{color:INK.readoutFaint,fontFamily:MONO,fontSize:TYPE.data.sizes.md,textTransform:"uppercase",letterSpacing:0.8},
  kvLine:{flex:1,height:1,backgroundColor:INK.hairline},
  kvValue:{color:INK.readout,fontFamily:MONO,fontSize:TYPE.data.sizes.md,letterSpacing:0.5},
  kvStack:{paddingVertical:9,gap:6},
  kvStackHead:{flexDirection:"row",alignItems:"center",gap:8},
  // Body face, not mono: a wrapped value is prose (an address, a set of hours),
  // and prose set in the data face is unreadable at three lines.
  kvStackValue:{color:INK.readout,fontFamily:FONT.body,fontSize:TYPE.body.sizes.md,lineHeight:TYPE.body.sizes.md*1.5},

  strip:{flexDirection:"row",alignItems:"stretch",paddingVertical:12},
  stripCell:{flex:1,alignItems:"center",paddingHorizontal:6},
  stripDivider:{width:1,backgroundColor:INK.hairline,marginVertical:2},

  frame:{
    backgroundColor:INK.inset,borderWidth:SHAPE.border,borderColor:INK.hairline,
    borderRadius:SHAPE.radius.control,overflow:"hidden",alignItems:"center",justifyContent:"center"
  },

  counter:{
    flexDirection:"row",alignItems:"center",gap:6,minHeight:36,
    paddingHorizontal:11,paddingVertical:7,borderRadius:SHAPE.radius.control,
    backgroundColor:INK.panel,borderWidth:SHAPE.border,borderColor:INK.hairline
  },
  counterActed:{backgroundColor:INK.panelRaised,borderColor:INK.hairlineStrong},
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
    backgroundColor:INK.inset,borderWidth:SHAPE.border,borderColor:INK.hairline
  },
  toggleBoxOn:{borderColor:INK.readoutSoft},

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
    backgroundColor:INK.inset,borderWidth:SHAPE.border,borderColor:INK.hairline
  },
  choiceMarkOn:{borderColor:INK.readoutSoft},
  choiceDot:{width:8,height:8,borderRadius:4,backgroundColor:INK.readout},
  counterCountInert:{color:INK.readoutFaint,fontFamily:MONO,fontSize:TYPE.data.sizes.md,letterSpacing:0.5},
  counterPressed:{opacity:0.78},
  counterDisabled:{opacity:0.45},
  counterCount:{color:INK.readoutSoft,fontFamily:MONO,fontSize:TYPE.data.sizes.md,letterSpacing:0.5},
  counterLabel:{
    color:INK.readoutSoft,fontFamily:MONO,fontSize:TYPE.data.sizes.md,
    textTransform:"uppercase",letterSpacing:0.7
  },
  counterCountActed:{color:INK.readout,fontFamily:MONO_MEDIUM},

  empty:{alignItems:"center",paddingHorizontal:28,paddingVertical:44,gap:10},
  emptyDial:{
    width:56,height:56,borderRadius:28,alignItems:"center",justifyContent:"center",
    backgroundColor:INK.panel,borderWidth:SHAPE.border,borderColor:INK.hairline,marginBottom:4
  },
  emptyDialRing:{
    position:"absolute",top:6,left:6,right:6,bottom:6,borderRadius:22,
    borderWidth:SHAPE.border,borderColor:INK.hairline,opacity:0.6
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

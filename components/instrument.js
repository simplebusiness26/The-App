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

import React,{useRef,useState} from "react";
import {View,Text,Pressable,PanResponder,ScrollView,StyleSheet,Platform} from "react-native";
import Svg,{Circle,Line,Path,Rect,G} from "react-native-svg";
import {INK,TYPE,SHAPE} from "../utils/tokens";

// The mono face, resolved per platform. TYPE.data.family is a CSS stack --
// right on web, meaningless to native, which matches one family name only.
export const MONO=Platform.select({ios:"Menlo",android:"monospace",default:TYPE.data.family});

// ---------------------------------------------------------------------------
// READOUT — a measured value, the way an instrument shows one.
// ---------------------------------------------------------------------------
// Mono, uppercase, wide-tracked label above a large value. This is the single
// most reused piece of the system: distances, counts, ranks, durations, scores.
// The label is what the thing IS; the value is what the app measured.
export function Readout({label,value,unit,tone="readout",align="left",size="md"}){
  const sizes={sm:{v:18,l:TYPE.data.sizes.sm},md:{v:24,l:TYPE.data.sizes.md},lg:{v:34,l:TYPE.data.sizes.md}};
  const s=sizes[size]||sizes.md;
  return(
    <View style={{alignItems:align==="center"?"center":"flex-start"}}>
      <Text style={[styles.readoutLabel,{fontSize:s.l}]} numberOfLines={1}>{label}</Text>
      <View style={styles.readoutValueRow}>
        <Text style={[styles.readoutValue,{fontSize:s.v,color:INK[tone]||INK.readout}]}>{value}</Text>
        {unit ? <Text style={styles.readoutUnit}>{unit}</Text> : null}
      </View>
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
  const step=count>1 ? width/(count-1) : width;
  const ticks=[];
  for(let i=0;i<count;i++){
    const major=i%majorEvery===0;
    const x=i*step;
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
export function Dial({values,active,onChange,width=232,format=(v)=>String(v)}){
  const [dragging,setDragging]=useState(false);
  const idx=Math.max(0,values.indexOf(active));
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
          <Pressable key={String(v)} onPress={()=>onChange?.(v)} hitSlop={10}
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
  readoutValueRow:{flexDirection:"row",alignItems:"baseline",gap:4},
  readoutValue:{color:INK.readout,fontWeight:"700",letterSpacing:-0.5},
  readoutUnit:{color:INK.readoutSoft,fontFamily:MONO,fontSize:TYPE.data.sizes.sm,textTransform:"uppercase"},

  dialWrap:{alignItems:"center",gap:6},
  dialLabels:{flexDirection:"row",justifyContent:"space-between"},
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
// and on a dark instrument face it reads as a sticker. These are stroked on the
// same 16x16 canvas as the map markers and the tab icons, so everything drawn
// in this app comes off one grid.
const GLYPHS={
  back:      [{d:"M10 3 5 8l5 5"}],
  forward:   [{d:"M6 3l5 5-5 5"}],
  up:        [{d:"M3 10l5-5 5 5"}],
  down:      [{d:"M3 6l5 5 5-5"}],
  close:     [{d:"M4 4l8 8"},{d:"M12 4l-8 8"}],
  plus:      [{d:"M8 3.5v9"},{d:"M3.5 8h9"}],
  minus:     [{d:"M3.5 8h9"}],
  check:     [{d:"M3.5 8.5 6.5 11.5 12.5 4.5"}],
  bell:      [{d:"M4.4 11.2V7.6a3.6 3.6 0 0 1 7.2 0v3.6"},{d:"M3 11.2h10"},{d:"M6.8 13a1.4 1.4 0 0 0 2.4 0"}],
  search:    [{c:[7.2,7.2,4.2]},{d:"M10.4 10.4 13.4 13.4"}],
  pin:       [{d:"M8 14s4.6-4.4 4.6-7.6A4.6 4.6 0 0 0 3.4 6.4C3.4 9.6 8 14 8 14z"},{c:[8,6.4,1.7]}],
  clock:     [{c:[8,8,5.4]},{d:"M8 4.8V8l2.4 1.5"}],
  calendar:  [{d:"M2.8 4.4h10.4v9H2.8z"},{d:"M2.8 7h10.4"},{d:"M5.4 2.6v2.4"},{d:"M10.6 2.6v2.4"}],
  people:    [{c:[5.6,6,2.1]},{d:"M2.2 13.2c0-2 1.5-3.5 3.4-3.5s3.4 1.5 3.4 3.5"},{c:[11,6.6,1.7]},{d:"M9.6 9.9c1.9 0 3.2 1.3 3.2 3.3"}],
  person:    [{c:[8,5.5,2.4]},{d:"M3.4 13.4c0-2.5 2-4.3 4.6-4.3s4.6 1.8 4.6 4.3"}],
  camera:    [{d:"M2.6 5.2h2.6l1-1.6h3.6l1 1.6h2.6v7.6H2.6z"},{c:[8,8.6,2.4]}],
  star:      [{d:"M8 2.6 9.7 6.2l3.9.5-2.8 2.7.7 3.9L8 11.5l-3.5 1.8.7-3.9L2.4 6.7l3.9-.5z"}],
  heart:     [{d:"M8 13.2S2.6 10 2.6 6.4a2.9 2.9 0 0 1 5.4-1.5 2.9 2.9 0 0 1 5.4 1.5c0 3.6-5.4 6.8-5.4 6.8z"}],
  comment:   [{d:"M2.6 4.2h10.8v6.8H7.4l-3 2.4v-2.4H2.6z"}],
  share:     [{c:[12,4,1.8]},{c:[4,8,1.8]},{c:[12,12,1.8]},{d:"M5.6 7.1 10.4 4.9"},{d:"M5.6 8.9 10.4 11.1"}],
  lock:      [{d:"M4.4 7.2h7.2v6H4.4z"},{d:"M6 7.2V5.4a2 2 0 0 1 4 0v1.8"}],
  filter:    [{d:"M2.6 4h10.8L9.2 8.6v4l-2.4 1.4V8.6z"}],
  map:       [{d:"M2 4.4 6 2.8v8.8L2 13.2z"},{d:"M6 2.8l4 1.6v8.8l-4-1.6z"},{d:"M10 4.4l4-1.6v8.8l-4 1.6z"}],
  edit:      [{d:"M10.6 2.8 13.2 5.4 5.6 13H3v-2.6z"}],
  trash:     [{d:"M3.4 4.6h9.2"},{d:"M4.8 4.6V3.2h6.4v1.4"},{d:"M4.4 4.6 5 13.4h6l.6-8.8"}],
  info:      [{c:[8,8,5.6]},{d:"M8 7.2v4"},{d:"M8 5.1v.6"}],
  warn:      [{d:"M8 2.6 14 13H2z"},{d:"M8 6.6v3.2"},{d:"M8 11.2v.6"}],
  send:      [{d:"M13.4 2.6 2.6 7l4.4 1.8L8.8 13z"}],
  qr:        [{d:"M2.8 2.8h4v4h-4z"},{d:"M9.2 2.8h4v4h-4z"},{d:"M2.8 9.2h4v4h-4z"},{d:"M9.2 9.2v1.8"},{d:"M11.6 13.2h1.6"}],
  play:      [{d:"M5.4 3.4 12 8l-6.6 4.6z"}],
  live:      [{c:[8,8,2.2]},{d:"M4.2 4.2a5.4 5.4 0 0 0 0 7.6"},{d:"M11.8 4.2a5.4 5.4 0 0 1 0 7.6"}],
  home:      [{d:"M2.6 7.6 8 3l5.4 4.6"},{d:"M4.2 8.8v4.6h7.6V8.8"}],
  bookmark:  [{d:"M4.2 2.8h7.6v10.4L8 10.6l-3.8 2.6z"}],
  ticket:    [{d:"M2.6 5.4h10.8v2a1.4 1.4 0 0 0 0 2.8v2H2.6v-2a1.4 1.4 0 0 0 0-2.8z"},{d:"M8.6 5.9v1.4"},{d:"M8.6 8.9v1.4"}],
  tag:       [{d:"M2.8 2.8h5l6 6-5 5-6-6z"},{c:[5.4,5.4,1.1]}],
  building:  [{d:"M3.4 13.4V3.6h6.2v9.8"},{d:"M9.6 6.6h3v6.8"},{d:"M5.2 5.8h2.6"},{d:"M5.2 8.2h2.6"},{d:"M5.2 10.6h2.6"}],
  bed:       [{d:"M2.6 12.6V6"},{d:"M2.6 8.8h10.8v3.8"},{d:"M13.4 8.8a2.4 2.4 0 0 0-2.4-2.4H7.2v2.4"},{c:[4.9,7,1.2]}],
  ring:      [{c:[8,8,5.4]},{c:[8,8,2.2]}],
  flag:      [{d:"M4 13.4V3"},{d:"M4 3.4h7.6l-1.6 2.6 1.6 2.6H4"}],
  block:     [{c:[8,8,5.4]},{d:"M4.2 11.8 11.8 4.2"}],
  shield:    [{d:"M8 2.6 13 4.4v3.8c0 3-2.2 4.6-5 5.4-2.8-.8-5-2.4-5-5.4V4.4z"}],
  key:       [{c:[5,8,2.4]},{d:"M7.4 8h6"},{d:"M11.4 8v2.2"},{d:"M13.4 8v1.6"}],
  card:      [{d:"M2.6 4.4h10.8v7.2H2.6z"},{d:"M2.6 7h10.8"},{d:"M4.6 9.6h2.6"}],
  chart:     [{d:"M2.8 13.2h10.4"},{d:"M4.6 13.2V8.6"},{d:"M8 13.2V4.6"},{d:"M11.4 13.2V10"}],
  list:      [{d:"M5.6 4.4h7.8"},{d:"M5.6 8h7.8"},{d:"M5.6 11.6h7.8"},{d:"M2.8 4.4h.6"},{d:"M2.8 8h.6"},{d:"M2.8 11.6h.6"}],
  grid:      [{d:"M2.8 2.8h4.4v4.4H2.8z"},{d:"M8.8 2.8h4.4v4.4H8.8z"},{d:"M2.8 8.8h4.4v4.4H2.8z"},{d:"M8.8 8.8h4.4v4.4H8.8z"}],
  refresh:   [{d:"M13 8a5 5 0 1 1-1.6-3.7"},{d:"M13.4 2.8v3.2h-3.2"}],
  external:  [{d:"M7 3.4H3.4v9.2h9.2V9"},{d:"M9.4 2.8h3.8v3.8"},{d:"M13.2 2.8 7.8 8.2"}],
  mail:      [{d:"M2.6 4.4h10.8v7.2H2.6z"},{d:"m2.6 4.8 5.4 4 5.4-4"}],
  phone:     [{d:"M5.4 2.8h5.2v10.4H5.4z"},{d:"M7.2 11.4h1.6"}],
  globe:     [{c:[8,8,5.4]},{d:"M2.6 8h10.8"},{d:"M8 2.6c1.6 1.8 2.4 3.6 2.4 5.4S9.6 11.6 8 13.4C6.4 11.6 5.6 9.8 5.6 8S6.4 4.4 8 2.6z"}],
  upload:    [{d:"M8 11.4V3.2"},{d:"M4.8 6.4 8 3.2l3.2 3.2"},{d:"M2.8 13.2h10.4"}],
  download:  [{d:"M8 3.2v8.2"},{d:"M4.8 8.2 8 11.4l3.2-3.2"},{d:"M2.8 13.2h10.4"}],
  image:     [{d:"M2.6 3.6h10.8v8.8H2.6z"},{c:[5.6,6.4,1.2]},{d:"m2.8 11 3.6-3.2 2.6 2.4 2-1.8 2.4 2.2"}],
  video:     [{d:"M2.6 4.6h7.4v6.8H2.6z"},{d:"m10 8 3.4-2.2v4.4z"}],
  mic:       [{d:"M8 2.6a1.8 1.8 0 0 1 1.8 1.8v3.2a1.8 1.8 0 0 1-3.6 0V4.4A1.8 1.8 0 0 1 8 2.6z"},{d:"M4.6 7.6a3.4 3.4 0 0 0 6.8 0"},{d:"M8 11v2.4"}],
  target:    [{c:[8,8,5.2]},{c:[8,8,1.6]},{d:"M8 1.6v1.8"},{d:"M8 12.6v1.8"},{d:"M1.6 8h1.8"},{d:"M12.6 8h1.8"}],
  sliders:   [{d:"M3.4 4.6h9.2"},{d:"M3.4 11.4h9.2"},{c:[6,4.6,1.5]},{c:[10.2,11.4,1.5]}],
  sort:      [{d:"M4.6 3.4v9.2"},{d:"M2.6 10.6 4.6 12.6l2-2"},{d:"M11.4 12.6V3.4"},{d:"M9.4 5.4 11.4 3.4l2 2"}],
  more:      [{c:[3.6,8,1.1]},{c:[8,8,1.1]},{c:[12.4,8,1.1]}],
  award:     [{c:[8,6,3.4]},{d:"M6 9.2 5 13.4l3-1.6 3 1.6-1-4.2"}],
  gift:      [{d:"M2.8 6.6h10.4v2.2H2.8z"},{d:"M3.8 8.8h8.4v4.6H3.8z"},{d:"M8 6.6v6.8"},{d:"M8 6.6C6.4 6.6 5 6 5 4.8s1.6-1.4 3 1.8c1.4-3.2 3-2.6 3-1.4S9.6 6.6 8 6.6z"}],
  clipboard: [{d:"M4.4 3.6h7.2v9.8H4.4z"},{d:"M6.2 3.6V2.6h3.6v1"},{d:"M6.4 7h3.2"},{d:"M6.4 9.6h3.2"}],
  eye:       [{d:"M1.8 8s2.4-4 6.2-4 6.2 4 6.2 4-2.4 4-6.2 4-6.2-4-6.2-4z"},{c:[8,8,1.9]}],
  eyeOff:    [{d:"M3.2 4.6C2.2 5.6 1.8 8 1.8 8s2.4 4 6.2 4c1.2 0 2.2-.4 3.1-.9"},{d:"M6.4 4.2A6 6 0 0 1 8 4c3.8 0 6.2 4 6.2 4a11 11 0 0 1-1.9 2.2"},{d:"M2.8 2.8 13.2 13.2"}],
  settings:  [{c:[8,8,2.2]},{d:"M8 1.8v1.8"},{d:"M8 12.4v1.8"},{d:"M1.8 8h1.8"},{d:"M12.4 8h1.8"},{d:"M3.6 3.6 4.9 4.9"},{d:"M11.1 11.1l1.3 1.3"},{d:"M12.4 3.6 11.1 4.9"},{d:"M4.9 11.1 3.6 12.4"}]
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
      {meta ? <Text style={kit.titleMeta} numberOfLines={1}>{meta}</Text> : null}
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
export function Chip({label,selected,tone,onPress,glyph,disabled,style}){
  const Wrap=onPress?Pressable:View;
  return(
    <Wrap
      style={[kit.chip,selected&&kit.chipSelected,disabled&&kit.chipDisabled,style]}
      onPress={disabled?undefined:onPress}
      disabled={disabled}
      accessibilityRole={onPress?"button":undefined}
      accessibilityState={onPress?{selected:!!selected,disabled:!!disabled}:undefined}
      accessibilityLabel={label}
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
    return(
      <Pressable
        key={String(key)}
        style={kit.segment}
        accessibilityRole="tab"
        accessibilityState={{selected}}
        accessibilityLabel={label}
        onPress={()=>onChange?.(key)}
      >
        <Text style={[kit.segmentText,selected&&kit.segmentTextActive]} numberOfLines={1}>{label}</Text>
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
export function Action({label,onPress,kind="secondary",glyph,disabled,loading,style,accessibilityLabel}){
  const filled=kind==="primary"||kind==="danger";
  const fill=kind==="primary"?INK.exists:kind==="danger"?INK.dispute:null;
  const text=filled?INK.ground:kind==="quiet"?INK.readoutSoft:INK.readout;
  return(
    <Pressable
      style={({pressed})=>[
        kit.action,
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
      {glyph?<Glyph name={glyph} size={15} colour={text}/>:null}
      <Text style={[kit.actionText,{color:text}]} numberOfLines={1}>{loading?"WORKING…":label}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// ROW — one line in a list.
// ---------------------------------------------------------------------------
// Name in display type, a body sentence under it, and whatever the app MEASURED
// about it set in mono down the right. `tone` turns the row into a StateEdge, so
// "this one is live" is an edge rather than a coloured background.
export function Row({title,sub,meta,metaSub,tone,onPress,glyph,right,style,children}){
  const Wrap=onPress?Pressable:View;
  const inner=(
    <Wrap
      style={[kit.row,!tone&&kit.rowStandalone,style]}
      onPress={onPress}
      accessibilityRole={onPress?"button":undefined}
      accessibilityLabel={onPress?[title,sub,meta].filter(Boolean).join(". "):undefined}
    >
      {glyph?<View style={kit.rowGlyph}><Glyph name={glyph} size={17} colour={INK.readoutSoft}/></View>:null}
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
export function Field({label,hint,error,children,required,style}){
  return(
    <View style={[kit.field,style]}>
      {label?(
        <View style={kit.fieldLabelRow}>
          <Text style={kit.fieldLabel} numberOfLines={1}>{label}</Text>
          {required?<Text style={kit.fieldRequired}>REQUIRED</Text>:null}
        </View>
      ):null}
      <View style={[kit.fieldWell,!!error&&kit.fieldWellError]}>{children}</View>
      {error?<Text style={kit.fieldError}>{error}</Text>:hint?<Text style={kit.fieldHint}>{hint}</Text>:null}
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
export function KeyValue({label,value,tone}){
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
export function ReadoutStrip({items,style}){
  return(
    <Panel style={[kit.strip,style]}>
      {items.map((item,i)=>(
        <React.Fragment key={item.label+String(i)}>
          {i>0?<View style={kit.stripDivider}/>:null}
          <View style={kit.stripCell}>
            <Readout label={item.label} value={item.value} unit={item.unit} tone={item.tone} align="center" size="sm"/>
          </View>
        </React.Fragment>
      ))}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// FRAME — a media well with viewfinder brackets.
// ---------------------------------------------------------------------------
// Avatars, thumbnails, photos. The brackets tie every picture in the app back
// to the viewfinder, which is the app's one signature surface.
export function Frame({children,size,ratio=1,round=false,style}){
  return(
    <View style={[
      kit.frame,
      round&&{borderRadius:SHAPE.radius.pill},
      size?{width:size,height:Math.round(size/ratio)}:{aspectRatio:ratio},
      style
    ]}>
      {children}
      {!round?<CornerFrame inset={4} length={10} colour={INK.readoutSoft} opacity={0.45}/>:null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// EMPTY — nothing to read.
// ---------------------------------------------------------------------------
// docs/design-system.md: "Empty states are instructions, not moods." So this
// takes an instruction, and shows the instrument saying it has no reading
// rather than a shrug.
export function Empty({title,instruction,action,glyph="info"}){
  return(
    <View style={kit.empty}>
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
export function Notice({tone="scheduled",label,children,action}){
  return(
    <StateEdge tone={tone} style={kit.notice}>
      {label?<Text style={[kit.noticeLabel,{color:INK[tone]||INK.scheduled}]}>{label}</Text>:null}
      {typeof children==="string"?<Text style={kit.noticeBody}>{children}</Text>:children}
      {action?<View style={kit.noticeAction}>{action}</View>:null}
    </StateEdge>
  );
}

const kit=StyleSheet.create({
  screen:{flex:1,backgroundColor:INK.ground},

  titleBlock:{paddingHorizontal:16,paddingTop:14,paddingBottom:2},
  titleEyebrow:{
    color:INK.readoutFaint,fontFamily:MONO,fontSize:TYPE.data.sizes.sm,
    textTransform:"uppercase",letterSpacing:1,marginBottom:5
  },
  titleRow:{flexDirection:"row",alignItems:"flex-start",justifyContent:"space-between",gap:12},
  titleText:{
    flex:1,color:INK.readout,fontSize:TYPE.display.sizes.lg,fontWeight:"700",letterSpacing:-0.5
  },
  titleMeta:{color:INK.readoutSoft,fontSize:TYPE.body.sizes.md,marginTop:5,lineHeight:TYPE.body.sizes.md*1.5},
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
  chipTextSelected:{color:INK.readout},
  chipTextDisabled:{color:INK.readoutFaint},

  segmentBar:{flexDirection:"row",alignItems:"stretch",paddingHorizontal:12,gap:2},
  segmentScroll:{flexGrow:0,flexShrink:0},
  segmentScrollContent:{alignItems:"center",paddingHorizontal:12,gap:2},
  segment:{paddingHorizontal:12,paddingTop:10,alignItems:"center",minHeight:SHAPE.tapTarget},
  segmentText:{
    color:INK.readoutFaint,fontFamily:MONO,fontSize:TYPE.data.sizes.md,
    textTransform:"uppercase",letterSpacing:0.8,marginBottom:8
  },
  segmentTextActive:{color:INK.readout},
  segmentDetent:{height:2,alignSelf:"stretch",minWidth:18,backgroundColor:INK.hairline},
  segmentDetentActive:{backgroundColor:INK.hairlineStrong,height:2},

  action:{
    flexDirection:"row",alignItems:"center",justifyContent:"center",gap:8,
    minHeight:SHAPE.tapTarget,paddingHorizontal:16,
    borderRadius:SHAPE.radius.control,borderWidth:SHAPE.border
  },
  actionSecondary:{backgroundColor:INK.panelRaised,borderColor:INK.hairlineStrong},
  actionQuiet:{backgroundColor:"transparent",borderColor:INK.hairline},
  actionPressed:{opacity:0.78},
  actionDisabled:{opacity:0.45},
  actionText:{fontFamily:MONO,fontSize:TYPE.data.sizes.lg,textTransform:"uppercase",letterSpacing:1,fontWeight:"600"},

  rowEdge:{marginBottom:8},
  row:{flexDirection:"row",alignItems:"center",gap:11,paddingHorizontal:13,paddingVertical:12,minHeight:56},
  rowStandalone:{
    backgroundColor:INK.panel,borderWidth:SHAPE.border,borderColor:INK.hairline,
    borderRadius:SHAPE.radius.card,marginBottom:8
  },
  rowGlyph:{
    width:34,height:34,borderRadius:SHAPE.radius.control,alignItems:"center",justifyContent:"center",
    backgroundColor:INK.inset,borderWidth:SHAPE.border,borderColor:INK.hairline
  },
  rowBody:{flex:1,minWidth:0},
  rowTitle:{color:INK.readout,fontSize:TYPE.display.sizes.sm,fontWeight:"600",letterSpacing:-0.2},
  rowSub:{color:INK.readoutSoft,fontSize:TYPE.body.sizes.sm,marginTop:3,lineHeight:TYPE.body.sizes.sm*1.5},
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
  fieldHint:{color:INK.readoutFaint,fontSize:TYPE.body.sizes.sm,marginTop:6,lineHeight:TYPE.body.sizes.sm*1.5},
  fieldError:{color:INK.dispute,fontSize:TYPE.body.sizes.sm,marginTop:6,lineHeight:TYPE.body.sizes.sm*1.5},

  kv:{flexDirection:"row",alignItems:"center",gap:8,paddingVertical:9},
  kvLabel:{color:INK.readoutFaint,fontFamily:MONO,fontSize:TYPE.data.sizes.md,textTransform:"uppercase",letterSpacing:0.8},
  kvLine:{flex:1,height:1,backgroundColor:INK.hairline},
  kvValue:{color:INK.readout,fontFamily:MONO,fontSize:TYPE.data.sizes.md,letterSpacing:0.5},

  strip:{flexDirection:"row",alignItems:"stretch",paddingVertical:12},
  stripCell:{flex:1,alignItems:"center",paddingHorizontal:6},
  stripDivider:{width:1,backgroundColor:INK.hairline,marginVertical:2},

  frame:{
    backgroundColor:INK.inset,borderWidth:SHAPE.border,borderColor:INK.hairline,
    borderRadius:SHAPE.radius.control,overflow:"hidden",alignItems:"center",justifyContent:"center"
  },

  empty:{alignItems:"center",paddingHorizontal:28,paddingVertical:44,gap:10},
  emptyDial:{
    width:56,height:56,borderRadius:28,alignItems:"center",justifyContent:"center",
    backgroundColor:INK.panel,borderWidth:SHAPE.border,borderColor:INK.hairline,marginBottom:4
  },
  emptyDialRing:{
    position:"absolute",top:6,left:6,right:6,bottom:6,borderRadius:22,
    borderWidth:SHAPE.border,borderColor:INK.hairline,opacity:0.6
  },
  emptyTitle:{color:INK.readout,fontSize:TYPE.display.sizes.md,fontWeight:"700",textAlign:"center",letterSpacing:-0.3},
  emptyInstruction:{color:INK.readoutSoft,fontSize:TYPE.body.sizes.md,textAlign:"center",lineHeight:TYPE.body.sizes.md*1.5},
  emptyAction:{marginTop:8,alignSelf:"stretch"},

  notice:{padding:13,marginBottom:12,gap:6},
  noticeLabel:{fontFamily:MONO,fontSize:TYPE.data.sizes.md,textTransform:"uppercase",letterSpacing:1},
  noticeBody:{color:INK.readout,fontSize:TYPE.body.sizes.md,lineHeight:TYPE.body.sizes.md*1.5},
  noticeAction:{marginTop:4}
});

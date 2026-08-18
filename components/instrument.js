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
import {View,Text,Pressable,PanResponder,StyleSheet,Platform} from "react-native";
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

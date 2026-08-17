import React from "react";
import {View} from "react-native";
import {BlurView} from "expo-blur";
import Svg,{Circle,G,Path} from "react-native-svg";
import {glyphPrimitives} from "../utils/markers";

// The pin, per design-system.md: 34px circle, 2px ink border, icon centred at
// 16px. Colour comes from the marker descriptor and means state; the glyph
// comes from the descriptor and means type. This component decides neither --
// it draws what utils/markers.js worked out, which is what keeps "no manual
// marker override" true by construction rather than by discipline.
//
// Not interactive. It is rendered inside whatever Pressable owns the row or the
// map callout, so the 44px tap-target floor is that parent's to meet.

const CANVAS=34;
const GLYPH_CANVAS=16;

// The pin graft, from FINAL_PRODUCT_CONTRACT.md's UI system section (the
// Meng To pin face, grafted onto de With's base): "pins render as 34px
// frosted-glass discs -- background: rgba(state-color, .82), backdrop-filter:
// blur(7px) saturate(170%), same 2px ink border and state-color logic as
// everywhere else."
//
// THE BORDER, THE GLYPH AND THE OVERPRINT ARE UNCHANGED. This graft touches
// only the main disc's FILL -- from an opaque Circle to a translucent, blurred
// BlurView sitting behind an unfilled Circle. Which colour a pin gets, which
// glyph it draws, whether it is claimed, and the overprint's own opacity(.55)
// + offset(4px) technique are all still exactly what utils/markers.js and the
// Circle/Path primitives below decided before this packet -- see the file's
// own long-standing rule at the top: "This component decides neither -- it
// draws what utils/markers.js worked out."
//
// WHY A REAL BlurView RATHER THAN A TINTED CIRCLE
//
// react-native-svg cannot blur; only a native view can (Capability Research
// Pack, and the design-system's own production note: "the frosted glass fill
// ... is genuinely buildable in React Native via expo-blur or a platform
// BlurView, so that part of the graft carries to production as designed").
// So the pin is drawn as two layers rather than one: a BlurView circle,
// positioned and sized to land exactly under the Svg's own border circle,
// carries the blur and the translucent state-colour fill; the Svg on top
// still owns the border, the glyph and (unchanged) the overprint disc. The
// border stays crisp -- react-native-svg's stroke -- while the fill behind it
// genuinely blurs whatever the map is drawing underneath.
//
// The overprint's second disc is EXPLICITLY exempted from this by the
// contract ("the production RN pin's overprint must fall back to de With's
// own opacity(.55)+offset technique for that specific effect") and stays a
// plain SVG Circle below, untouched.
const FILL_OPACITY=0.82;
// expo-blur's `intensity` (0-100) is not the same unit as CSS's `blur(7px)`;
// this is a tuned approximation, not a conversion -- there is no exact
// mapping between the two APIs. `saturate(170%)` has no expo-blur equivalent
// at all (no saturation control on BlurView), so it is not attempted; the
// translucent, blurred fill is the part of the graft the capability research
// confirmed is real, and that is what is built here.
const BLUR_INTENSITY=42;

function hexToRgba(hex,alpha){
  const clean=String(hex || "").replace("#","");
  const value=clean.length===3
    ? clean.split("").map((char)=>char+char).join("")
    : clean;
  const r=parseInt(value.slice(0,2),16) || 0;
  const g=parseInt(value.slice(2,4),16) || 0;
  const b=parseInt(value.slice(4,6),16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
}

// The overprint, from design-system.md: "a place hosting something. A second
// pink disc sits behind, offset translate(4px, -4px) ... Deliberate
// misregistration, like a flyer run through the press twice." It is named there
// as "the one memorable thing in this design" and had never been built.
//
// It exists because the product describes more states than the palette has inks
// -- an event moves through upcoming, starting soon, live, busy, finished, and
// there are three inks with one reserved for offers. The redesign brief asked
// for "pulse/glow on active markers"; a glow is banned (no blurred shadows), and
// this is the riso-native form of the same idea. Adding a fourth colour was the
// alternative and is the one thing the palette rule forbids.
//
// So liveness is a second channel, not a second colour: same ink, offset disc.
// The pin's spoken label still says which state it is, because colour and shape
// are both unavailable to a screen reader.
const OVERPRINT_OFFSET=4;

// Only pins carrying an overprint need the extra room, so every existing pin
// keeps its exact geometry rather than being nudged to make space for a
// feature it does not use.
function geometry(overprint){
  const pad=overprint ? OVERPRINT_OFFSET : 0;
  const box=CANVAS+pad;
  return {
    box,
    // The main disc sits low-left, leaving the offset disc room up-right.
    cx:CANVAS/2,
    cy:CANVAS/2+pad,
    r:CANVAS/2-1,
    glyphOffset:(CANVAS-GLYPH_CANVAS)/2+pad/1,
    glyphOffsetX:(CANVAS-GLYPH_CANVAS)/2
  };
}

export default function PlaceMarker({marker,size=CANVAS}){
  if(!marker) return null;

  const primitives=glyphPrimitives(marker.glyph) || [];
  const overprint=marker.overprint===true;
  const box=geometry(overprint);

  // Convert the main disc's position/radius from the Svg's own viewBox units
  // into rendered pixels, so the BlurView disc behind it lands exactly under
  // the border circle at any `size` a caller passes in -- list-row avatars
  // included, not only the 34px map pin.
  const pxScale=size/box.box;
  const discSize=box.r*2*pxScale;
  const discLeft=(box.cx-box.r)*pxScale;
  const discTop=(box.cy-box.r)*pxScale;

  return(
    <View
      style={{width:size,height:size}}
      accessible
      accessibilityRole="image"
      accessibilityLabel={marker.label}
    >
      {/* The frosted-glass fill: a real blurred, translucent native view,
          sized and positioned to sit exactly under the Svg's border circle
          below. */}
      <BlurView
        intensity={BLUR_INTENSITY}
        tint="light"
        style={{
          position:"absolute",
          left:discLeft,
          top:discTop,
          width:discSize,
          height:discSize,
          borderRadius:discSize/2,
          overflow:"hidden",
          backgroundColor:hexToRgba(marker.fill,FILL_OPACITY)
        }}
      />

      <Svg width={size} height={size} viewBox={`0 0 ${box.box} ${box.box}`}>
        {overprint && (
          // Behind, up and to the right. react-native-svg has no
          // mix-blend-mode, so the multiply is approximated with opacity --
          // the ink is unchanged, which is what keeps this inside the palette.
          // Unlike the main disc, this one is NOT part of the frosted-glass
          // graft -- the contract keeps it as de With's original technique.
          <Circle
            cx={box.cx+OVERPRINT_OFFSET}
            cy={box.cy-OVERPRINT_OFFSET}
            r={box.r}
            fill={marker.fill}
            fillOpacity={0.55}
          />
        )}
        <Circle
          cx={box.cx}
          cy={box.cy}
          r={box.r}
          // No fill here any more -- the BlurView above carries the colour,
          // translucently and blurred. The border stays a crisp Svg stroke.
          fill="none"
          stroke={marker.border}
          strokeWidth={2}
          // An unclaimed place is an invitation, not an error. The dash is the
          // only thing that says so visually; marker.label says it in words.
          strokeDasharray={marker.borderStyle==="dashed" ? [3.4,2.6] : undefined}
        />

        <G x={box.glyphOffsetX} y={box.glyphOffset}>
          {primitives.map((primitive,index)=>primitive.circle
            ? <Circle
                key={index}
                cx={primitive.circle[0]}
                cy={primitive.circle[1]}
                r={primitive.circle[2]}
                fill={primitive.fill ? marker.glyphInk : "none"}
                stroke={marker.glyphInk}
                strokeWidth={1.6}
              />
            : <Path
                key={index}
                d={primitive.path}
                fill="none"
                stroke={marker.glyphInk}
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
          )}
        </G>
      </Svg>
    </View>
  );
}

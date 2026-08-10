import React from "react";
import {View} from "react-native";
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

  return(
    <View
      style={{width:size,height:size}}
      accessible
      accessibilityRole="image"
      accessibilityLabel={marker.label}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${box.box} ${box.box}`}>
        {overprint && (
          // Behind, up and to the right. react-native-svg has no
          // mix-blend-mode, so the multiply is approximated with opacity --
          // the ink is unchanged, which is what keeps this inside the palette.
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
          fill={marker.fill}
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

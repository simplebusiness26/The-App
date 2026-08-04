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
const GLYPH_OFFSET=(CANVAS-GLYPH_CANVAS)/2;

export default function PlaceMarker({marker,size=CANVAS}){
  if(!marker) return null;

  const primitives=glyphPrimitives(marker.glyph) || [];

  return(
    <View
      style={{width:size,height:size}}
      accessible
      accessibilityRole="image"
      accessibilityLabel={marker.label}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${CANVAS} ${CANVAS}`}>
        <Circle
          cx={CANVAS/2}
          cy={CANVAS/2}
          r={CANVAS/2-1}
          fill={marker.fill}
          stroke={marker.border}
          strokeWidth={2}
          // An unclaimed place is an invitation, not an error. The dash is the
          // only thing that says so visually; marker.label says it in words.
          strokeDasharray={marker.borderStyle==="dashed" ? [3.4,2.6] : undefined}
        />

        <G x={GLYPH_OFFSET} y={GLYPH_OFFSET}>
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

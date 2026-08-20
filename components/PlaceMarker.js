import React from "react";
import {View} from "react-native";
import {BlurView} from "expo-blur";
import Svg,{Circle,Text as SvgText} from "react-native-svg";
import {SHAPE,FONT} from "../utils/tokens";

// The pin, per design-system.md: 34px circle, 1px hairline border, icon centred
// at 16px. Colour comes from the marker descriptor and means state; the glyph
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
// blur(7px) saturate(170%), same border and state-color logic as everywhere
// else." The border is 1px now, with the rest of the system -- the 2px print
// register went when the riso system did.
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

export default function PlaceMarker({marker,size=CANVAS,tapFloor=true}){
  if(!marker) return null;

  const overprint=marker.overprint===true;
  const box=geometry(overprint);

  // THE 44px FLOOR, WHICH THE PIN DID NOT MEET.
  //
  // docs/design-system.md, accessibility floor: "Minimum tap target 44px even
  // where the visible pin is 34px." This file used to say the floor was the
  // parent's to meet -- and the parent is a MapLibre <Marker>, which sizes
  // itself to its child, so the touchable area of every pin on the map was
  // exactly the 34px disc.
  //
  // So the footprint and the drawing are two boxes now: the outer one is the
  // tap target and is never smaller than SHAPE.tapTarget, the inner one is
  // still exactly `size` and draws exactly what it drew before. The disc stays
  // centred in the footprint, so a marker anchored on its centre lands on the
  // same coordinate it always did.
  const footprint=tapFloor ? Math.max(size,SHAPE.tapTarget) : size;

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
      style={{
        width:footprint,
        height:footprint,
        alignItems:"center",
        justifyContent:"center"
      }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={marker.label}
    >
    <View style={{width:size,height:size}}>
      {/* The frosted-glass fill: a real blurred, translucent native view,
          sized and positioned to sit exactly under the Svg's border circle
          below. */}
      <BlurView
        intensity={BLUR_INTENSITY}
        // Light, because the housing and the map under it are paper. A dark
        // tint here was correct for the near-black build this replaced and is
        // simply wrong now: it muddied every ink and put a grey bruise under
        // each pin on a bright map.
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
          // .pin { border: var(--bw2) solid var(--ink) } -- 2px, the artifact's
          // strong weight. This said 1px for a while, carrying a note that "a
          // 2px border is a bug now": that was true of the dark housing this
          // design replaced, where a heavy ring around a glowing disc read as a
          // halo. On paper the pin is a printed disc and its edge is a printed
          // edge.
          strokeWidth={SHAPE.borderStrong}
          // An unclaimed place is an invitation, not an error. The dash is the
          // only thing that says so visually; marker.label says it in words.
          strokeDasharray={marker.borderStyle==="dashed" ? [3.4,2.6] : undefined}
        />

        {/* THE FACE IS A LETTER.

            renderMap() in the artifact puts one mono capital on the disc, at
            12px on a 34px pin, tracking 0 -- B for a business, P for a
            property, C for a club, E for an event, L for a public place. The
            size is written as a ratio of the pin so a 34px map pin and a 22px
            list-row avatar both land on the artifact's proportion.

            A category drawing used to go here instead. It carried more per pin
            and it is not what won: at 34px on a moving map a six-subpath mark
            is a smudge, and a letter is not. The drawing is still in the
            marker (`glyph`) and still drawn by cards and rows at sizes where
            it reads. */}
        <SvgText
          x={box.cx}
          y={box.cy}
          fill={marker.glyphInk}
          fontFamily={FONT.mono}
          fontSize={box.box*(12/34)}
          textAnchor="middle"
          // Optical centring: a cap sits on its baseline, so the box has to
          // come down by roughly a third of its height to look centred in the
          // disc rather than measured into it.
          dy={box.box*(12/34)*0.35}
        >
          {marker.letter || "L"}
        </SvgText>
      </Svg>
    </View>
    </View>
  );
}

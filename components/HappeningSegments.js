import React from "react";
import {Segmented} from "./instrument";

// The Happening tab's selector.
//
// FINAL_PRODUCT_CONTRACT.md: "Happening: For You (Discover) · Live Now ·
// Events · Clubs · Link-ups — segmented within one destination." Five real
// screens' worth of Supabase logic live behind these five choices; this file
// only says which one is picked. app/discover.js owns the switch.
//
// THIS IS NOT A ROW OF PILLS ANY MORE.
//
// It was: five bordered pills that filled with ink when selected. That is the
// print system's shape, and recolouring it dark did not make it the design
// that won -- it made a dark row of pills. The instrument's answer to "pick
// one of five" is a DETENTED SELECTOR: mono labels above a track, the active
// detent marked by a brightened label over a filled notch. Same five choices,
// built as a control on an instrument rather than a set of buttons.
//
// All of that geometry lives in Segmented (components/instrument.js), which is
// also what the map filters, the profile tabs and the admin console use. One
// selector shape across the app, defined once. The only thing left here is the
// list of segments, which is product knowledge and belongs to the product.
//
// The old file also carried a load-bearing flexGrow:0/flexShrink:0 fix -- a
// horizontal ScrollView in a flex column claims all the leftover vertical
// space and stretches its children to fill it (measured: 402px tall pills).
// That fix now lives on Segmented's own scroll styles, so every screen that
// scrolls a selector gets it rather than only this one.

export const HAPPENING_SEGMENTS=[
  {key:"for-you",label:"For You"},
  {key:"live",label:"Live"},
  {key:"events",label:"Events"},
  {key:"clubs",label:"Clubs"},
  {key:"linkups",label:"Link-ups"}
];

export default function HappeningSegments({active,onChange}){
  return <Segmented items={HAPPENING_SEGMENTS} active={active} onChange={onChange} scroll/>;
}

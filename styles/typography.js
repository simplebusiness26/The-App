import {INK} from "../utils/tokens";

// The Gazetteer's type scale.
//
// System fonts only -- no font file, no icon pack, see CLAUDE.md and
// docs/design-system.md. Hierarchy here comes from size, weight and letter
// spacing rather than from a second typeface, which is what lets a dense,
// text-first index (name, type, distance, count) read at a glance instead of
// needing a picture to tell two rows apart.
//
// Every restyled screen imports from here instead of writing its own
// fontSize/fontWeight pair, so the scale stays one table rather than one
// guess per file.

export const TYPE={
  display:{fontSize:30,fontWeight:"900",letterSpacing:-0.5,color:INK.ink},
  headline:{fontSize:20,fontWeight:"900",color:INK.ink},
  sectionLabel:{
    fontSize:10,
    fontWeight:"800",
    letterSpacing:1.2,
    textTransform:"uppercase",
    color:INK.inkSoft
  },
  body:{fontSize:13,lineHeight:19,color:INK.ink},
  rowTitle:{fontSize:15,fontWeight:"800",color:INK.ink},
  meta:{fontSize:12,fontWeight:"700",color:INK.inkSoft},
  numeral:{fontSize:28,fontWeight:"900",fontVariant:["tabular-nums"],color:INK.ink}
};

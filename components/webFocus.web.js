import {INK,SHAPE} from "../utils/tokens";

// THE FOCUS RING, ON WEB.
//
// docs/design-system.md's accessibility floor names one: 2px `exists`, 2px
// offset. React Native Web does not draw it -- it leaves the browser's default,
// which in a dark viewport is a thick white halo. On a screenshot of the
// visibility modal it read as a white border painted around the primary
// button, which is both wrong and exactly the shape of the print system this
// design replaced.
//
// :focus-visible rather than :focus, so the ring appears for keyboard and
// assistive navigation and not on every tap.
//
// Web only, by filename. Native draws no focus ring of its own and does not
// need one -- there is no keyboard focus to show.

let installed=false;

export function installWebFocusStyle(){
  if(installed || typeof document==="undefined") return;
  installed=true;

  const style=document.createElement("style");
  style.setAttribute("data-xplorer-focus","");
  style.textContent=`
    :focus{outline:none;}
    :focus-visible{
      outline:${SHAPE.focusRing.width}px solid ${SHAPE.focusRing.color};
      outline-offset:${SHAPE.focusRing.offset}px;
      border-radius:${SHAPE.radius.control}px;
    }
    /* A text well is already a cut-in surface; the ring goes on its edge
       rather than floating outside it, so the field does not grow on focus. */
    input:focus-visible,textarea:focus-visible{
      outline-offset:-${SHAPE.focusRing.width}px;
    }
    ::selection{background:${INK.hairlineStrong};color:${INK.readout};}
    /* The scrollbar is chrome too, and the default is a light one. */
    *{scrollbar-color:${INK.hairlineStrong} transparent;scrollbar-width:thin;}
  `;
  document.head.appendChild(style);
}

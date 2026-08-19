import {INK,SHAPE} from "../utils/tokens";

// MAPLIBRE'S OWN CHROME, BROUGHT ONTO THE INSTRUMENT.
//
// maplibre-gl ships a stylesheet, and the app imports it because the map does
// not work without it. That stylesheet draws the zoom control as a white box
// with grey dividers and black SVG icons -- a light-theme control, sitting on
// a near-black housing over a dark map. It is the single loudest thing on the
// map screen and no amount of work inside React reaches it, because these
// elements are created by the library directly in the DOM.
//
// So the rules are overridden once, from the tokens, at the same specificity
// the library uses. Everything here is a colour or a border: no geometry is
// changed, so a maplibre upgrade cannot break the control's behaviour, only
// leave a rule unused.
//
// Native has no equivalent problem -- @maplibre/maplibre-react-native draws no
// chrome of its own, and components/MapControls.js is the app's own control
// set. That is why this file is .web.js.

let installed=false;

export function installMapChromeStyle(){
  if(installed || typeof document==="undefined") return;
  installed=true;

  const style=document.createElement("style");
  style.setAttribute("data-xplorer-map-chrome","");
  style.textContent=`
    /* THE LIBRARY'S CONTROLS ARE NOT THE ONLY THING IN THAT CORNER.
       maplibre anchors its navigation control to the top right, and so does
       this app's notification bell -- which floats over the map, because the
       map is full-bleed. They landed on top of each other, and the bell won,
       so zoom-in was unreachable on the app's main screen. Found by asking the
       browser what was on top of each control, not by looking: the two are
       similar sizes and similar colours and the overlap reads as one control.

       HEADER_HEIGHT is 56 in components/Header.js; this clears it plus a gap.
       Left as a number rather than a token because it is a distance between
       two chrome elements, not a design spacing step. */
    .maplibregl-ctrl-top-right{margin-top:64px;}

    .maplibregl-ctrl-group{
      background:${INK.panel};
      border:${SHAPE.border}px solid ${INK.hairlineStrong};
      border-radius:${SHAPE.radius.control}px;
      box-shadow:0 8px 18px rgba(0,0,0,.45);
      overflow:hidden;
    }
    .maplibregl-ctrl-group button{
      background:transparent;
      width:38px;
      height:38px;
    }
    .maplibregl-ctrl-group button+button{
      border-top:${SHAPE.border}px solid ${INK.hairline};
    }
    .maplibregl-ctrl-group button:hover{background:${INK.panelRaised};}
    .maplibregl-ctrl-group button:focus{box-shadow:none;outline:${SHAPE.focusRing.width}px solid ${SHAPE.focusRing.color};outline-offset:-2px;}
    .maplibregl-ctrl-group button:disabled .maplibregl-ctrl-icon{opacity:.35;}

    /* The icons are inline-SVG data URIs baked into the library's CSS with a
       hard-coded near-black fill. A CSS filter is the only lever that reaches
       inside a background-image, and inverting a black glyph gives the light
       readout the rest of the app uses. */
    .maplibregl-ctrl-group button .maplibregl-ctrl-icon{filter:invert(1) brightness(.94);}

    /* Attribution lives on the splash and in Settings (see
       components/StartupSplash.js for why), but maplibre re-adds a compact
       control of its own. Left readable and quiet rather than hidden -- the
       licence is not negotiable, only its styling is. */
    .maplibregl-ctrl-attrib{
      background:rgba(11,14,18,.78);
      border:${SHAPE.border}px solid ${INK.hairline};
      border-radius:${SHAPE.radius.control}px;
      color:${INK.readoutFaint};
    }
    .maplibregl-ctrl-attrib a{color:${INK.readoutSoft};}
    .maplibregl-ctrl-attrib-button{filter:invert(1) brightness(.9);}

    .maplibregl-popup-content{
      background:${INK.panel};
      color:${INK.readout};
      border:${SHAPE.border}px solid ${INK.hairline};
      border-radius:${SHAPE.radius.card}px;
      box-shadow:0 8px 18px rgba(0,0,0,.45);
    }
    .maplibregl-popup-tip{border-top-color:${INK.panel};border-bottom-color:${INK.panel};}

    /* The scale bar, and the "map is loading" canvas ground. A white flash
       between the housing appearing and the first tile arriving is jarring on
       a dark app, and on a slow connection it lasts seconds. */
    .maplibregl-ctrl-scale{
      background:rgba(11,14,18,.78);
      border-color:${INK.hairlineStrong};
      color:${INK.readoutSoft};
    }
    .maplibregl-map{background:${INK.land};}
    .maplibregl-canvas-container canvas{background:${INK.land};}
  `;
  document.head.appendChild(style);
}

import React,{useCallback,useEffect,useRef} from "react";
import {View,Text,StyleSheet} from "react-native";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {mapConfiguration} from "../utils/mapProvider";
import {glyphPrimitives} from "../utils/markers";
import {DEFAULT_CENTRE} from "../hooks/useLivingMap";
import {INK} from "../utils/tokens";

// The web renderer. MapLibre GL JS, drawing what useLivingMap worked out.
//
// PINNED TO maplibre-gl 5, DELIBERATELY. Version 6 is ESM-only and builds its
// worker from an import.meta.url Worker construction, which Metro does not
// support -- the map constructs and then sits there for ever with no load, no
// error and no styledata. Silent. The spike found that and it is the reason
// package.json says ^5.
//
// WHY THIS FILE IS SEPARATE FROM THE NATIVE ONE
//
// Because a browser canvas and a native view are not the same thing, and an
// abstraction that pretends otherwise is a worse abstraction than two files.
// What is shared is everything that is not drawing -- the reads, the filters,
// the markers, the cards -- and that lives in useLivingMap.
//
// MARKERS ARE DOM, NOT STYLE LAYERS
//
// A marker here is a small HTML element MapLibre positions for us, so the pin
// is the same shape and the same ink on every platform and Xplorer keeps
// deciding what a pin means. Style layers would be faster with thousands of
// pins and would hand marker appearance to the map provider, which is the one
// thing the brief says not to do.

// The pin, drawn from the SAME descriptor the native pin uses. Colour means
// state, the glyph means type, and this file decides neither -- utils/markers.js
// worked both out and components/PlaceMarker.js draws the identical thing on
// native. That is what stops web and native developing two visual languages.
//
// 34px circle, 2px ink border, 16px glyph, per docs/design-system.md.
function pinElement(marker,onPress){
  const element=document.createElement("button");
  element.type="button";
  // Colour is never the only carrier of meaning. Every pin ships its sentence.
  element.setAttribute("aria-label",marker?.label || "Open this place");
  element.style.cssText=[
    "width:34px","height:34px","border-radius:17px","cursor:pointer",
    `background:${marker?.fill || INK.card}`,
    `border:2px ${marker?.borderStyle || "solid"} ${marker?.border || INK.ink}`,
    "display:flex","align-items:center","justify-content:center","padding:0"
  ].join(";");

  const primitives=glyphPrimitives(marker?.glyph);
  if(primitives){
    const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
    svg.setAttribute("width","16");
    svg.setAttribute("height","16");
    svg.setAttribute("viewBox","0 0 16 16");
    svg.setAttribute("fill","none");
    // A primitive is a path OR a circle -- utils/markers.js uses both, and the
    // first version of this only handled paths, so every people/ring glyph
    // produced <path d="undefined"> and Chromium complained. Caught by pointing
    // the browser gate at the real map.
    for(const shape of primitives){
      if(shape.circle){
        const [cx,cy,r]=shape.circle;
        const circle=document.createElementNS("http://www.w3.org/2000/svg","circle");
        circle.setAttribute("cx",String(cx));
        circle.setAttribute("cy",String(cy));
        circle.setAttribute("r",String(r));
        circle.setAttribute("fill",shape.fill ? (marker?.glyphInk || INK.ink) : "none");
        circle.setAttribute("stroke",marker?.glyphInk || INK.ink);
        circle.setAttribute("stroke-width","1.5");
        svg.appendChild(circle);
        continue;
      }
      if(!shape.path) continue;

      const path=document.createElementNS("http://www.w3.org/2000/svg","path");
      path.setAttribute("d",shape.path);
      path.setAttribute("fill",shape.fill ? (marker?.glyphInk || INK.ink) : "none");
      path.setAttribute("stroke",marker?.glyphInk || INK.ink);
      path.setAttribute("stroke-width","1.5");
      path.setAttribute("stroke-linecap","round");
      path.setAttribute("stroke-linejoin","round");
      svg.appendChild(path);
    }
    element.appendChild(svg);
  }

  element.addEventListener("click",(event)=>{event.stopPropagation();onPress?.();});
  return element;
}

// ONE RENDERER, TWO MAPS -- see the note in LivingMap.js. `pins` is the general
// layer: a key, a position, a marker descriptor and an optional opacity, which
// is how My Map draws Memories that fade as their time runs out.
// Heat is ground, not an object: a wash showing where the app is being used.
// Not a pin, not tappable, and deliberately not built out of the marker
// language -- utils/markers.js says what a PIN means and a heat cell is not one.
// One bubble, as a DOM element. Same rules as the native one in
// components/LiveBubble.js: it does not decide whether it should exist
// (utils/liveBubbles.js does, for all of them at once), it never moves or
// resizes the map, and a review bubble is the PHOTO rather than a card of text.
//
// The fade is a CSS transition rather than an animation library -- the app has
// none, and adding one needs asking. The keyframes for the confetti are
// injected once, below.
// The confetti keyframes, injected once. The app has no animation library and
// adding one needs asking, so a stylesheet rule is the whole mechanism. The
// piece carries its own destination in CSS custom properties, which is what
// lets six pieces share one keyframe.
//
// prefers-reduced-motion is honoured by simply not starting the burst -- the
// bubble itself still appears, because it is information rather than decoration.
let confettiStyleInstalled=false;

function installConfettiStyle(){
  if(confettiStyleInstalled || typeof document==="undefined") return;
  confettiStyleInstalled=true;

  const style=document.createElement("style");
  style.textContent=
    "@keyframes xplorer-confetti{"+
    "from{transform:translate(0,0) rotate(0deg);opacity:1;}"+
    "70%{opacity:1;}"+
    "to{transform:translate(var(--cx),var(--cy)) rotate(var(--cr));opacity:0;}"+
    "}"+
    "@media (prefers-reduced-motion: reduce){"+
    "[data-xplorer-confetti] i{animation:none !important;opacity:0 !important;}"+
    "}";
  document.head.appendChild(style);
}

function bubbleElement(bubble,onPress){
  // Painted from what the screen handed over -- utils/markers.js decides what a
  // colour means, this file only draws.
  const chrome=bubble.chrome || {};
  const wrap=document.createElement("div");
  wrap.style.cssText="position:relative;display:flex;flex-direction:column;align-items:center;opacity:0;transition:opacity 260ms ease-out;";

  if(bubble.celebrate){
    installConfettiStyle();
    const burst=document.createElement("div");
    burst.setAttribute("data-xplorer-confetti","");
    burst.style.cssText="position:absolute;inset:0;pointer-events:none;";
    // ONE burst, no loop. See the note on CONFETTI in components/LiveBubble.js:
    // using the three inks as decoration is a recorded decision, not drift.
    (bubble.confetti || []).forEach((piece,index)=>{
      const bit=document.createElement("i");
      bit.style.cssText=
        `position:absolute;left:50%;top:50%;width:6px;height:9px;border-radius:1px;`+
        `background:${piece.colour};`+
        `animation:xplorer-confetti 900ms ease-out ${index*30}ms 1 both;`+
        `--cx:${piece.x}px;--cy:${piece.y}px;--cr:${piece.spin};`;
      burst.appendChild(bit);
    });
    wrap.appendChild(burst);
  }

  const body=document.createElement("button");
  body.type="button";
  body.setAttribute("aria-label",bubble.label || bubble.text || "Open");

  if(bubble.imageUrl){
    body.style.cssText=
      `padding:3px;border-radius:16px;border:2px solid ${chrome.ink};`+
      `background:${chrome.card};box-shadow:2px 2px 0 ${chrome.ink};cursor:pointer;`;
    const image=document.createElement("img");
    image.src=bubble.imageUrl;
    image.alt="";
    image.style.cssText=`width:92px;height:92px;border-radius:13px;object-fit:cover;display:block;background:${chrome.blank};`;
    body.appendChild(image);
  }else{
    body.style.cssText=
      `padding:8px 11px;border-radius:14px;border:2px solid ${chrome.ink};`+
      `background:${chrome.card};box-shadow:2px 2px 0 ${chrome.ink};cursor:pointer;`+
      `font-weight:900;font-size:12px;color:${chrome.ink};max-width:190px;`+
      "white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
    body.textContent=bubble.text || "";
  }

  body.addEventListener("click",(event)=>{
    event.stopPropagation();
    onPress?.(bubble);
  });

  wrap.appendChild(body);

  // The tail: what makes it point at its pin rather than float near it.
  const tail=document.createElement("div");
  tail.style.cssText=
    `width:10px;height:10px;margin-top:-6px;background:${chrome.card};`+
    `border-right:2px solid ${chrome.ink};border-bottom:2px solid ${chrome.ink};`+
    "transform:rotate(45deg);pointer-events:none;";
  wrap.appendChild(tail);

  // Next frame, so the transition has something to run from.
  requestAnimationFrame(()=>{wrap.style.opacity="1";});

  return wrap;
}

function heatElement(cell){
  const element=document.createElement("div");
  element.setAttribute("aria-label",cell.label);
  element.style.cssText=[
    `width:${cell.size}px`,`height:${cell.size}px`,`border-radius:${cell.size/2}px`,
    `background:${cell.fill}`,`border:1px solid ${cell.border}`,
    `opacity:${cell.opacity}`,"pointer-events:none"
  ].join(";");
  return element;
}

export default function LivingMap({
  places=[],
  activity=[],
  pins=[],
  heat=[],
  route=null,
  bubbles=[],
  centre=DEFAULT_CENTRE,
  zoom=12,
  style,
  onSelectPlace,
  onSelectActivity,
  onSelectBubble,
  onDropPin,
  onUnavailable
}){
  const host=useRef(null);
  const map=useRef(null);
  const drawn=useRef([]);
  const config=mapConfiguration();

  useEffect(()=>{
    if(map.current || !host.current) return;

    map.current=new maplibregl.Map({
      container:host.current,
      style:config.styleUrl,
      center:[Number(centre.longitude),Number(centre.latitude)],
      zoom,
      // No control at all, and no logo. MapLibre GL JS adds an attribution
      // control unless told not to; `false` means it is never created, so
      // there is nothing on the map to hide. Nothing is covered or clipped.
      //
      // The OpenStreetMap credit itself has not left the app -- it cannot, the
      // data is OpenStreetMap's. components/StartupSplash.js shows it for five
      // seconds on every launch and Settings carries the permanent wording and
      // the licence link. utils/mapProvider.js still owns the exact string.
      attributionControl:false
    });

    map.current.addControl(new maplibregl.NavigationControl({showCompass:false}),"top-right");

    // Long press to drop a Link-up. A touch browser fires `contextmenu` on a
    // press and hold, which is the same gesture as the native map's onLongPress
    // -- so the two platforms ask for it the same way even though the event
    // arrives under a different name.
    map.current.on("contextmenu",(event)=>{
      onDropPin?.({longitude:event.lngLat.lng,latitude:event.lngLat.lat});
    });

    // A map that will not load must not be a blank rectangle. MapLibre reports
    // a missing style, a dead tile host and a browser with no WebGL through the
    // same event, and any of them means the same thing to somebody using the
    // app: there is no map right now. The screen switches to the list.
    map.current.on("error",(event)=>{
      const message=event?.error?.message || "";
      // Tile-level errors are noisy and survivable -- one missing tile is not a
      // broken map. Only a failure to get a style or a context is fatal.
      if(/WebGL|style|Style|Failed to fetch|NetworkError/.test(message)){
        onUnavailable?.(message);
      }
    });

    return()=>{
      map.current?.remove();
      map.current=null;
    };
  },[config.styleUrl,config.attribution,onUnavailable,onDropPin,centre,zoom]);

  // The route is a STYLE LAYER, not a marker -- a line of a thousand points
  // cannot be a DOM element the way a pin can. Source and layers are created
  // once and then fed new coordinates, because removing and re-adding a layer
  // on every render makes the line flicker.
  const drawRoute=useCallback(()=>{
    const instance=map.current;
    if(!instance || !instance.isStyleLoaded?.()) return;

    const line=route?.line || [];
    const data={type:"Feature",properties:{},geometry:{type:"LineString",coordinates:line}};

    if(instance.getSource("xplorer-route")){
      instance.getSource("xplorer-route").setData(data);
    }else if(route?.colour && route?.casingColour){
      // The layers are only created once there is a route to describe them.
      // A fallback colour here would be a hex literal in a renderer, which is
      // exactly what scripts/verify-marker-assignment.cjs refuses -- and it
      // would be this file deciding what a route looks like, which is the
      // decision that belongs in utils/markers.js.
      instance.addSource("xplorer-route",{type:"geojson",data});
      // Casing under the line, so it reads over dark tiles and over heat.
      instance.addLayer({
        id:"xplorer-route-casing",
        type:"line",
        source:"xplorer-route",
        layout:{"line-cap":"round","line-join":"round"},
        paint:{"line-color":route.casingColour,"line-width":route.casingWidth}
      });
      instance.addLayer({
        id:"xplorer-route-line",
        type:"line",
        source:"xplorer-route",
        layout:{"line-cap":"round","line-join":"round"},
        paint:{"line-color":route.colour,"line-width":route.width}
      });
    }

    // An empty LineString draws nothing, so clearing a route is setting it to
    // no coordinates rather than tearing the layers down.
    for(const id of ["xplorer-route-casing","xplorer-route-line"]){
      if(instance.getLayer(id)){
        instance.setLayoutProperty(id,"visibility",line.length ? "visible" : "none");
      }
    }
  },[route]);

  const draw=useCallback(()=>{
    if(!map.current) return;

    drawRoute();

    for(const marker of drawn.current) marker.remove();
    drawn.current=[];

    // First, so it sits under every pin.
    for(const cell of heat){
      drawn.current.push(
        new maplibregl.Marker({element:heatElement(cell)})
          .setLngLat([Number(cell.longitude),Number(cell.latitude)])
          .addTo(map.current)
      );
    }

    for(const place of places){
      const element=pinElement(place.card?.marker,()=>onSelectPlace?.(place));
      drawn.current.push(
        new maplibregl.Marker({element})
          .setLngLat([Number(place.longitude),Number(place.latitude)])
          .addTo(map.current)
      );
    }

    // After the places, so a live thing draws on top of the place it is
    // happening at rather than under it.
    for(const item of activity){
      const element=pinElement(item.marker,()=>onSelectActivity?.(item));
      drawn.current.push(
        new maplibregl.Marker({element})
          .setLngLat([Number(item.longitude),Number(item.latitude)])
          .addTo(map.current)
      );
    }

    // The general layer, and the only one that fades. utils/mapLayers.js
    // decides the opacity; this draws it.
    for(const pin of pins){
      const element=pinElement(pin.marker,()=>pin.onPress?.());
      if(pin.opacity!==undefined) element.style.opacity=String(pin.opacity);
      drawn.current.push(
        new maplibregl.Marker({element})
          .setLngLat([Number(pin.longitude),Number(pin.latitude)])
          .addTo(map.current)
      );
    }
    // Bubbles last, above every pin -- a bubble a pin covers is a bubble nobody
    // reads. WHICH bubbles these are was decided in utils/liveBubbles.js; no
    // marker here chooses to show one.
    for(const bubble of bubbles){
      drawn.current.push(
        new maplibregl.Marker({element:bubbleElement(bubble,onSelectBubble),anchor:"bottom"})
          .setLngLat([Number(bubble.longitude),Number(bubble.latitude)])
          .addTo(map.current)
      );
    }
  },[places,activity,pins,heat,bubbles,drawRoute,onSelectPlace,onSelectActivity,onSelectBubble]);

  useEffect(()=>{
    if(!map.current) return;
    if(map.current.isStyleLoaded()) draw();
    else map.current.once("load",draw);
  },[draw]);

  return(
    <View style={[styles.wrap,style]}>
      <View ref={host} style={styles.canvas} nativeID="living-map"/>
      {/* Read by scripts/verify-browser.cjs: a map that failed silently looks
          exactly like one that worked. */}
      <Text style={styles.marker} nativeID="living-map-state">
        {`LIVING MAP ${places.length} places ${activity.length} live ${pins.length} pins`}
      </Text>
    </View>
  );
}

const styles=StyleSheet.create({
  wrap:{flex:1},
  canvas:{flex:1},
  marker:{position:"absolute",bottom:0,left:0,fontSize:1,opacity:0.01,color:INK.inkSoft}
});

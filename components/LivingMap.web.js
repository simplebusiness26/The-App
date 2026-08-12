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
  centre=DEFAULT_CENTRE,
  zoom=12,
  style,
  onSelectPlace,
  onSelectActivity,
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

  const draw=useCallback(()=>{
    if(!map.current) return;

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
  },[places,activity,pins,heat,onSelectPlace,onSelectActivity]);

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

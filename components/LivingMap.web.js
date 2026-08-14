import React,{useCallback,useEffect,useRef} from "react";
import {View,Text,StyleSheet} from "react-native";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {mapConfiguration} from "../utils/mapProvider";
import {glyphPrimitives,heatmapPaint} from "../utils/markers";
import {DEFAULT_CENTRE} from "../hooks/useLivingMap";
import {CLUSTER_ZOOM_STEP} from "../utils/mapZoom";
import {heatOpacityAt,HEAT_RADIUS_PX} from "../utils/heatmap";
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
    // 64, not 92 -- see the note in components/LiveBubble.js. The two files
    // draw the same bubble and must not drift.
    image.style.cssText=`width:64px;height:64px;border-radius:11px;object-fit:cover;display:block;background:${chrome.blank};`;
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

// HEAT IS A LAYER NOW, NOT A MARKER.
//
// heatElement() used to build one flat yellow circle per ~1km grid square. The
// owner asked for Snapchat's heatmap and that is a different kind of object: a
// continuous density field with no edges, coloured through a ramp. MapLibre GL
// JS draws that natively as a `heatmap` layer, so there is nothing to build --
// the paint comes from utils/markers.js and the points from utils/heatmap.js.
//
// It also cannot be tapped, because there is no element to tap. Opening what is
// under a warm patch is a click on the MAP now, handled in the setup effect.

// A cluster: one circle with a count in it, standing for the pins underneath.
// utils/markers.js decided what it looks like -- see the note there about why it
// is not one of the three inks.
function clusterElement(cluster,onPress){
  const element=document.createElement("button");
  element.type="button";
  element.setAttribute("aria-label",cluster.label || "Several places here");
  element.style.cssText=[
    `width:${cluster.size}px`,`height:${cluster.size}px`,`border-radius:${cluster.size/2}px`,
    `background:${cluster.fill}`,`border:2px solid ${cluster.border}`,
    `color:${cluster.ink}`,"font-weight:900","font-size:13px",
    "display:flex","align-items:center","justify-content:center","padding:0","cursor:pointer"
  ].join(";");
  element.textContent=String(cluster.count);

  element.addEventListener("click",(event)=>{event.stopPropagation();onPress?.(cluster);});
  return element;
}

export default function LivingMap({
  places=[],
  activity=[],
  clusters=[],
  pins=[],
  heat=null,
  route=null,
  bubbles=[],
  onOpenHeat,
  onSelectCluster,
  onViewportChange,
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

  // THE CALLBACKS ARE HELD IN A REF, AND THE MAP IS BUILT ONCE.
  //
  // They used to be in the setup effect's dependency list. Every one of them
  // arrives as an inline arrow from components/LivingMapScreen.js, so every one
  // was a new function on every render -- and the effect's cleanup calls
  // map.remove(). The bubble rotation re-renders that screen every few seconds,
  // so the whole MapLibre instance was being destroyed and rebuilt on a timer,
  // throwing away the position and zoom somebody had just set. "The map is
  // janky" had more than one cause.
  const handlers=useRef({});
  handlers.current={onDropPin,onUnavailable,onViewportChange,onOpenHeat};

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
      handlers.current.onDropPin?.({longitude:event.lngLat.lng,latitude:event.lngLat.lat});
    });

    // WHERE THE MAP IS LOOKING, REPORTED UP.
    //
    // Nothing did this before, which is why utils/liveBubbles.js had an
    // inViewport() that was never given a viewport and a rotation that showed
    // three bubbles at county zoom. `moveend` covers pan, zoom, pinch and
    // flyTo; `load` fires it once so the screen is not waiting for a gesture
    // before it knows anything.
    const report=()=>{
      const instance=map.current;
      if(!instance) return;
      const bounds=instance.getBounds();
      handlers.current.onViewportChange?.({
        north:bounds.getNorth(),
        south:bounds.getSouth(),
        east:bounds.getEast(),
        west:bounds.getWest(),
        zoom:instance.getZoom()
      });
    };
    map.current.on("load",report);
    map.current.on("moveend",report);

    // TAP A WARM PATCH TO SEE WHAT IS IN IT.
    //
    // It used to be a double click on a heat circle. There are no circles any
    // more -- heat is a layer, and a layer has nothing to click. It also used to
    // lose: MapLibre's own double-tap-to-zoom is on by default on both
    // platforms, so on the phone the map's gesture beat the reveal every time
    // and the owner only ever zoomed in.
    //
    // One click, anywhere on the map. A marker click stops propagation, so this
    // only ever fires on open ground, and a drag is not a click, so panning is
    // untouched.
    map.current.on("click",(event)=>{
      handlers.current.onOpenHeat?.({
        latitude:event.lngLat.lat,
        longitude:event.lngLat.lng
      });
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
        handlers.current.onUnavailable?.(message);
      }
    });

    return()=>{
      map.current?.remove();
      map.current=null;
    };
    // The style URL only. `centre` and `zoom` are the STARTING position and
    // re-reading them would drag the map back to Brighton on every change --
    // the same reason the native renderer uses initialViewState rather than a
    // controlled camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[config.styleUrl]);

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

  // The heat layer. Source and layer created once and then fed new points --
  // adding and removing a layer on every render makes the wash flicker, the
  // same reason the route is done this way.
  const drawHeat=useCallback(()=>{
    const instance=map.current;
    if(!instance || !instance.isStyleLoaded?.()) return;

    const data=heat || {type:"FeatureCollection",features:[]};

    if(instance.getSource("xplorer-heat")){
      instance.getSource("xplorer-heat").setData(data);
    }else{
      instance.addSource("xplorer-heat",{type:"geojson",data});
      // BEFORE every other layer this file adds, and before the markers, which
      // are DOM and always on top anyway. Heat is ground.
      instance.addLayer({
        id:"xplorer-heat",
        type:"heatmap",
        source:"xplorer-heat",
        paint:heatmapPaint({radius:HEAT_RADIUS_PX})
      });
    }

    // FADES OUT AS YOU ZOOM IN. A density field at street level puts a hot spot
    // over one building; heat answers "where is it busy" and the Moment pins
    // underneath answer "what is happening here". See utils/heatmap.js.
    if(instance.getLayer("xplorer-heat")){
      instance.setPaintProperty("xplorer-heat","heatmap-opacity",heatOpacityAt(instance.getZoom()));
    }
  },[heat]);

  const draw=useCallback(()=>{
    if(!map.current) return;

    drawRoute();
    drawHeat();

    for(const marker of drawn.current) marker.remove();
    drawn.current=[];

    // Clusters stand in for the places underneath them, so they are drawn
    // INSTEAD of those pins, not as well -- `places` is already only what
    // utils/mapClusters.js left as singles.
    // Tapping one moves the camera in. The camera is the renderer's -- the
    // screen has no way to reach it and should not grow one -- so the move
    // happens here and the screen is told, in case it wants to close a panel.
    const openCluster=(cluster)=>{
      map.current?.flyTo({
        center:[Number(cluster.longitude),Number(cluster.latitude)],
        zoom:Math.min(18,(map.current.getZoom() || 12)+CLUSTER_ZOOM_STEP),
        duration:600
      });
      onSelectCluster?.(cluster);
    };

    for(const cluster of clusters){
      drawn.current.push(
        new maplibregl.Marker({element:clusterElement(cluster,openCluster)})
          .setLngLat([Number(cluster.longitude),Number(cluster.latitude)])
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
  },[places,activity,clusters,pins,bubbles,drawRoute,drawHeat,onSelectPlace,onSelectActivity,onSelectBubble,onSelectCluster]);

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
        {`LIVING MAP ${places.length} places ${activity.length} live ${pins.length} pins ${clusters.length} clusters ${bubbles.length} bubbles ${heat?.features?.length || 0} heat`}
      </Text>
    </View>
  );
}

const styles=StyleSheet.create({
  wrap:{flex:1},
  canvas:{flex:1},
  marker:{position:"absolute",bottom:0,left:0,fontSize:1,opacity:0.01,color:INK.inkSoft}
});

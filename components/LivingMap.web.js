import React,{useCallback,useEffect,useRef} from "react";
import {View,Text,StyleSheet} from "react-native";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
// ...and then the instrument's own answer to it. The library stylesheet draws
// a light-theme zoom control; see components/mapChrome.web.js.
import {installMapChromeStyle} from "./mapChrome.web";
import {mapConfiguration} from "../utils/mapProvider";
import {clusterPaint,clusterPoints,glyphPrimitives,heatmapPaint} from "../utils/markers";
import {DEFAULT_CENTRE} from "../hooks/useLivingMap";
import {CLUSTER_ZOOM_STEP,FOCUS_ZOOM,ZOOM_CLOSE} from "../utils/mapZoom";
import {CLUSTER_CELL_PX} from "../utils/mapClusters";
import {heatOpacityAt,HEAT_RADIUS_PX} from "../utils/heatmap";
import {INK,SHAPE} from "../utils/tokens";

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
// 34px circle, 1px hairline border, 16px glyph, per docs/design-system.md.
// 1px, not 2px: the print register went with the riso system, and the native
// pin (components/PlaceMarker.js) uses SHAPE.border. Two platforms, one pin.
function pinElement(marker,onPress){
  const element=document.createElement("button");
  element.type="button";
  // Colour is never the only carrier of meaning. Every pin ships its sentence.
  element.setAttribute("aria-label",marker?.label || "Open this place");
  element.style.cssText=[
    "width:34px","height:34px","border-radius:17px","cursor:pointer",
    `background:${marker?.fill || INK.panel}`,
    `border:${SHAPE.border}px ${marker?.borderStyle || "solid"} ${marker?.border || INK.readout}`,
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
        circle.setAttribute("fill",shape.fill ? (marker?.glyphInk || INK.readout) : "none");
        circle.setAttribute("stroke",marker?.glyphInk || INK.readout);
        circle.setAttribute("stroke-width","1.5");
        svg.appendChild(circle);
        continue;
      }
      if(!shape.path) continue;

      const path=document.createElementNS("http://www.w3.org/2000/svg","path");
      path.setAttribute("d",shape.path);
      path.setAttribute("fill",shape.fill ? (marker?.glyphInk || INK.readout) : "none");
      path.setAttribute("stroke",marker?.glyphInk || INK.readout);
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

// A cluster is a STYLE LAYER here, not a DOM element.
//
// clusterElement() used to build one absolutely-positioned button per group,
// from a count the app had worked out in JavaScript. The locked spec asks for
// MapLibre's built-in clustering instead -- `cluster:true` on the GeoJSON
// source -- which computes the groups in the map, as the camera moves, and
// redraws them without going back through React at all.
//
// The appearance is still Xplorer's: utils/markers.js hands over the paint, the
// same paint the native renderer uses, and this file does not know what any of
// those colours mean.

export default function LivingMap({
  places=[],
  placeOpacity=1,
  activity=[],
  clusters=[],
  focus=null,
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
  onUnavailable,
  // A style KEY, never a URL: utils/mapProvider.js is the only file allowed to
  // know what one resolves to.
  styleKey,
  // Which question the heat wash answers, Now -> Week. utils/markers.js turns
  // it into paint; this file only hands it over.
  heatTimeframe
}){
  const host=useRef(null);
  const map=useRef(null);
  const drawn=useRef([]);
  const config=mapConfiguration({styleKey});

  // THE STYLE IS AN OBJECT NOW, NOT A URL, AND IT CAN CHANGE.
  //
  // utils/mapProvider.js's instrument style is a full MapLibre style spec,
  // because the provider publishes only light styles and the Field Instrument
  // system needs a dark map. maplibre-gl takes a StyleSpecification as happily
  // as a URL, so the constructor call below is unchanged.
  //
  // What changed is that the style is now a CHOICE. It used to be the setup
  // effect's only dependency -- and that effect's cleanup calls map.remove(),
  // so switching the style would have destroyed and rebuilt the whole map,
  // throwing away the position and zoom somebody had just set. The map is built
  // once now, with no dependencies at all, and a style change goes through
  // setStyle() in its own effect below, which is what that method is for.

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

    installMapChromeStyle();
    map.current.addControl(new maplibregl.NavigationControl({showCompass:false}),"top-right");

    // Long press to drop a Link-up. A touch browser fires `contextmenu` on a
    // press and hold, which is the same gesture as the native map's onLongPress
    // -- so the two platforms ask for it the same way even though the event
    // arrives under a different name.
    map.current.on("contextmenu",(event)=>{
      // The screen point as well as the coordinate: the confirm step draws a
      // crosshair reticle where the finger was, and a reticle with nowhere to
      // be is a reticle in the middle of the map pointing at nothing.
      handlers.current.onDropPin?.({
        longitude:event.lngLat.lng,
        latitude:event.lngLat.lat,
        x:event.point?.x,
        y:event.point?.y
      });
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
    // BUILT ONCE. `centre` and `zoom` are the STARTING position and re-reading
    // them would drag the map back to Brighton on every change, which is the
    // same reason the native renderer uses initialViewState rather than a
    // controlled camera. The style is not here either: changing it must not
    // tear the map down -- see the setStyle effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

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

  // SENT HERE FROM DISCOVER, WITH SOMETHING TO LOOK AT. One imperative move
  // when the target changes -- see the note in components/LivingMap.js about
  // why the camera stays uncontrolled.
  // The stamp is what makes pressing recenter twice work -- see the note in
  // components/LivingMap.js.
  const focusKey=focus ? `${focus.latitude},${focus.longitude},${focus.stamp || ""}` : null;

  useEffect(()=>{
    if(!focusKey || !map.current) return;
    const [latitude,longitude]=focusKey.split(",").map(Number);
    if(!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

    map.current.flyTo({center:[longitude,latitude],zoom:FOCUS_ZOOM,duration:800});
  },[focusKey]);

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
        paint:heatmapPaint({radius:HEAT_RADIUS_PX,timeframe:heatTimeframe})
      });
    }

    // FADES OUT AS YOU ZOOM IN. A density field at street level puts a hot spot
    // over one building; heat answers "where is it busy" and the Moment pins
    // underneath answer "what is happening here". See utils/heatmap.js.
    if(instance.getLayer("xplorer-heat")){
      instance.setPaintProperty("xplorer-heat","heatmap-opacity",heatOpacityAt(instance.getZoom()));
      // The dial's two real paint properties, re-applied rather than the layer
      // being torn down and rebuilt -- see utils/markers.js for what NOW and
      // WEEK actually change.
      const repaint=heatmapPaint({radius:HEAT_RADIUS_PX,timeframe:heatTimeframe});
      instance.setPaintProperty("xplorer-heat","heatmap-weight",repaint["heatmap-weight"]);
      instance.setPaintProperty("xplorer-heat","heatmap-intensity",repaint["heatmap-intensity"]);
    }
  },[heat,heatTimeframe]);

  // MAPLIBRE'S OWN CLUSTERING, on its own source.
  //
  // `cluster:true` is the built-in engine: the map groups the points itself as
  // the camera moves. What is fed in is the places the screen has already
  // decided are grouped rather than standing alone -- that split has to stay in
  // JavaScript, because utils/liveBubbles.js may only float a bubble over a pin
  // drawn on its own and no clustering source on either platform reports that
  // back. Turn the cluster toggle off and no groups arrive, so the source holds
  // nothing and every pin is drawn individually at every zoom.
  const drawClusters=useCallback(()=>{
    const instance=map.current;
    if(!instance || !instance.isStyleLoaded?.()) return;

    const data=clusterPoints(clusters.flatMap((cluster)=>cluster.members || []));

    if(instance.getSource("xplorer-clusters")){
      instance.getSource("xplorer-clusters").setData(data);
      return;
    }

    const paint=clusterPaint();

    instance.addSource("xplorer-clusters",{
      type:"geojson",
      data,
      cluster:true,
      clusterRadius:CLUSTER_CELL_PX,
      clusterMaxZoom:Math.floor(ZOOM_CLOSE)
    });
    instance.addLayer({
      id:"xplorer-cluster-lone",
      type:"circle",
      source:"xplorer-clusters",
      filter:["!",["has","point_count"]],
      paint:paint.lone
    });
    instance.addLayer({
      id:"xplorer-cluster-circle",
      type:"circle",
      source:"xplorer-clusters",
      filter:["has","point_count"],
      paint:paint.circle
    });
    instance.addLayer({
      id:"xplorer-cluster-count",
      type:"symbol",
      source:"xplorer-clusters",
      filter:["has","point_count"],
      layout:paint.countLayout,
      paint:paint.countPaint
    });

    // One tap on a group moves the camera in, exactly as the old DOM circle
    // did. The zoom is the renderer's business; the screen is only told it
    // happened, in case it has a panel to close.
    instance.on("click","xplorer-cluster-circle",(event)=>{
      const feature=event.features?.[0];
      const point=feature?.geometry?.coordinates;
      if(!point) return;
      event.originalEvent?.stopPropagation?.();
      instance.flyTo({
        center:point,
        zoom:Math.min(18,(instance.getZoom() || 12)+CLUSTER_ZOOM_STEP),
        duration:600
      });
      onSelectCluster?.(feature);
    });
  },[clusters,onSelectCluster]);

  // A STYLE CHANGE IS setStyle(), NOT A NEW MAP.
  //
  // Swapping the style throws away every source and layer this file added, so
  // the sources have to be rebuilt afterwards -- which is what `styledata`
  // announces. The markers are DOM and survive untouched.
  useEffect(()=>{
    const instance=map.current;
    if(!instance) return;
    instance.setStyle(config.styleUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[styleKey]);

  const draw=useCallback(()=>{
    if(!map.current) return;

    drawRoute();
    drawHeat();
    drawClusters();

    for(const marker of drawn.current) marker.remove();
    drawn.current=[];

    for(const place of places){
      const element=pinElement(place.card?.marker,()=>onSelectPlace?.(place));
      // 1 everywhere except the Memories map, where the places are drawn
      // faintly for orientation -- see MEMORY_MODE_PLACE_OPACITY in
      // components/LivingMapScreen.js.
      if(placeOpacity!==1){
        element.style.opacity=String(placeOpacity);
        element.style.pointerEvents="none";
      }
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
  },[places,placeOpacity,activity,pins,bubbles,drawRoute,drawHeat,drawClusters,onSelectPlace,onSelectActivity,onSelectBubble]);

  useEffect(()=>{
    if(!map.current) return;
    if(map.current.isStyleLoaded()) draw();
    else map.current.once("load",draw);
    // Every style swap empties the map of the sources this file owns, so they
    // are rebuilt when the new one lands.
    map.current.on("styledata",draw);
    return()=>{map.current?.off?.("styledata",draw);};
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
  marker:{position:"absolute",bottom:0,left:0,fontSize:1,opacity:0.01,color:INK.readoutSoft}
});

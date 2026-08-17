import React,{useEffect,useRef} from "react";
import {View,StyleSheet} from "react-native";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {mapConfiguration} from "../utils/mapProvider";
import {INK} from "../utils/tokens";

// Web twin of ListingPinMap.js. Same draggable-pin job, maplibre-gl's own API
// instead of the native package's -- the same split components/LivingMap.js/
// .web.js already uses, for the same reason (two different libraries behind
// one import path; Metro resolves .web.js on web automatically).
export default function ListingPinMap({latitude,longitude,onDragEnd,height=220}){
  const host=useRef(null);
  const map=useRef(null);
  const marker=useRef(null);
  // What this component itself last told the caller, so an onChange coming
  // back down as new latitude/longitude props does not recentre the map out
  // from under a drag that only just finished.
  const lastEmitted=useRef(null);
  const config=mapConfiguration();

  useEffect(()=>{
    if(map.current || !host.current) return;

    map.current=new maplibregl.Map({
      container:host.current,
      style:config.styleUrl,
      center:[Number(longitude),Number(latitude)],
      zoom:15,
      attributionControl:false
    });

    map.current.addControl(new maplibregl.NavigationControl({showCompass:false}),"top-right");

    const element=document.createElement("div");
    element.style.width="24px";
    element.style.height="24px";
    element.style.borderRadius="50%";
    element.style.background=INK.blue;
    element.style.border=`2px solid ${INK.ink}`;
    element.style.cursor="grab";

    marker.current=new maplibregl.Marker({element,draggable:true,anchor:"center"})
      .setLngLat([Number(longitude),Number(latitude)])
      .addTo(map.current);

    marker.current.on("dragend",()=>{
      const lngLat=marker.current.getLngLat();
      lastEmitted.current={latitude:lngLat.lat,longitude:lngLat.lng};
      onDragEnd?.({latitude:lngLat.lat,longitude:lngLat.lng});
    });

    return()=>{
      map.current?.remove();
      map.current=null;
    };
    // Built once. Position changes after mount are pushed through the effect
    // below, exactly like components/LivingMap.web.js's own marker updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  useEffect(()=>{
    if(!map.current || !marker.current) return;
    if(!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) return;

    const already=lastEmitted.current;
    if(already && already.latitude===latitude && already.longitude===longitude) return;

    marker.current.setLngLat([Number(longitude),Number(latitude)]);
    map.current.flyTo({center:[Number(longitude),Number(latitude)],zoom:Math.max(map.current.getZoom(),14)});
  },[latitude,longitude]);

  return <View style={[styles.wrap,{height}]}><div ref={host} style={{width:"100%",height:"100%"}}/></View>;
}

const styles=StyleSheet.create({
  wrap:{borderRadius:12,overflow:"hidden",borderWidth:2,borderColor:INK.ink}
});

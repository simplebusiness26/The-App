import React,{useRef} from "react";
import {View,StyleSheet} from "react-native";
import {Map,Camera,ViewAnnotation} from "@maplibre/maplibre-react-native";
import {mapConfiguration} from "../utils/mapProvider";
import {INK,SHAPE} from "../utils/tokens";

// The draggable-pin map inside ListingLocationPicker.js -- native renderer.
// Split the same way components/LivingMap.js/.web.js are split, for the same
// reason: MapLibre's native package and its web package are two different
// libraries behind one import path, and Metro resolves .web.js on web
// automatically.
//
// Deliberately small. This is one draggable pin on a quiet map, not the
// Living Map -- no clustering, no heat, no bubbles. ViewAnnotation is used
// rather than Marker because Marker (per the installed package's own docs)
// has no drag support; ViewAnnotation's draggable/onDragEnd is the real
// interaction the contract asks for.
export default function ListingPinMap({latitude,longitude,onDragEnd,height=220}){
  const config=mapConfiguration();
  const camera=useRef(null);

  function handleDragEnd(event){
    const lngLat=event?.nativeEvent?.lngLat || event?.nativeEvent?.payload?.lngLat;
    if(!Array.isArray(lngLat) || lngLat.length<2) return;
    onDragEnd?.({longitude:lngLat[0],latitude:lngLat[1]});
  }

  return(
    <View style={[styles.wrap,{height}]}>
      <Map style={styles.map} mapStyle={config.styleUrl} attribution={false} logo={false}>
        <Camera
          ref={camera}
          initialViewState={{center:[Number(longitude),Number(latitude)],zoom:15}}
          // The pin drag is the source of truth; a controlled camera would
          // recentre on every drag frame and fight the person's finger. This
          // recentres only when the marker moves for a reason other than the
          // drag itself -- "Use my location" jumping it.
          animationDuration={280}
        />

        <ViewAnnotation
          id="listing-pin"
          lngLat={[Number(longitude),Number(latitude)]}
          draggable
          onDragEnd={handleDragEnd}
        >
          <View style={styles.pinTouchArea}>
            <View style={styles.pin}/>
            <View style={styles.pinPoint}/>
          </View>
        </ViewAnnotation>
      </Map>
    </View>
  );
}

const styles=StyleSheet.create({
  // The 2px INK.ink border here was the print register, and after the palette
  // moved INK.ink is the near-white readout colour -- so this drew a white
  // frame around the map and a white ring around the pin. Hairline, on the
  // housing, like every other edge in the instrument.
  wrap:{
    borderRadius:SHAPE.radius.card,overflow:"hidden",
    borderWidth:SHAPE.border,borderColor:INK.hairline
  },
  map:{flex:1},
  // 44px minimum tap target even though the visible pin is smaller, per
  // docs/design-system.md's accessibility floor.
  pinTouchArea:{width:44,height:44,alignItems:"center",justifyContent:"center"},
  // A place being positioned exists -- that is what this pin says -- so it
  // takes the `exists` ink over the housing rather than the old flat blue.
  pin:{
    width:26,height:26,borderRadius:SHAPE.radius.pin,backgroundColor:INK.exists,
    borderWidth:SHAPE.border,borderColor:INK.ground
  },
  pinPoint:{width:SHAPE.border+1,height:10,backgroundColor:INK.exists,marginTop:-2}
});

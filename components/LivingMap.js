import React from "react";
import {StyleSheet} from "react-native";
import {Map,Camera,Marker} from "@maplibre/maplibre-react-native";
import PlaceMarker from "./PlaceMarker";
import LegacyMap from "./LivingMap.legacy";
import {mapConfiguration,useLegacyNativeMap} from "../utils/mapProvider";
import {DEFAULT_CENTRE} from "../hooks/useLivingMap";

// The native renderer: MapLibre on Android and iOS.
//
// THE OLD MAP IS STILL HERE, BEHIND A SWITCH, AND THAT IS DELIBERATE
//
// components/LivingMap.legacy.js is the react-native-maps version. Setting
// EXPO_PUBLIC_LEGACY_MAP=1 brings it back. It stays until the owner has opened
// the MapLibre one on a real phone, because if it misbehaves on a device I
// cannot test, flipping one variable is a working map and deleting the file was
// a week of waiting.
//
// It costs a dependency in package.json for a few days. Phase E removes it once
// the new map has been seen.
//
// WHAT THIS FILE DOES NOT DO
//
// Read the database, filter anything, decide what a marker means, or build a
// card. All of that is hooks/useLivingMap.js and it is shared with the web
// renderer, which is why the two platforms cannot drift.
//
// NO API KEY. MapLibre needs none and OpenFreeMap needs none, so there is no
// billing to set up and no card to add. That is the whole reason for the stack.

export default function LivingMap(props){
  if(useLegacyNativeMap()) return <LegacyMap {...props}/>;
  return <MapLibreMap {...props}/>;
}

function MapLibreMap({places=[],activity=[],onSelectPlace,onSelectActivity}){
  const config=mapConfiguration();

  return(
    <Map
      style={styles.map}
      mapStyle={config.styleUrl}
      /*
        THE CREDIT IS SMALL, NOT GONE

        The map data is OpenStreetMap's, and the licence it is free under says
        the credit has to be on the map. Removing it is not a setting, it is a
        breach -- so it becomes a small round (i) in the bottom right instead,
        which is exactly what Google and Mapbox do with theirs. Tapping it shows
        the full wording.

        These are also the RIGHT prop names. `attributionEnabled` and
        `logoEnabled` were v10's; on v11 they are `attribution` and `logo`, so
        the old ones did nothing at all and the map was drawing the MapLibre
        logo and the long credit bar because both default to on. That is the bar
        that was across the bottom.
      */
      attribution
      attributionPosition={{bottom:10,right:10}}
      logo={false}
    >
      {/*
        defaultSettings, not a controlled camera. A controlled one drags the map
        back to a fixed point on every re-render, and "map position unchanged
        after opening, swiping and dismissing a card" is a criterion this has to
        keep meeting.
      */}
      <Camera
        defaultSettings={{
          centerCoordinate:[DEFAULT_CENTRE.longitude,DEFAULT_CENTRE.latitude],
          zoomLevel:12
        }}
      />

      {places.map((place)=>(
        <Marker
          key={`${place.kind}-${place.id}`}
          id={`${place.kind}-${place.id}`}
          coordinate={[Number(place.longitude),Number(place.latitude)]}
          onPress={()=>onSelectPlace?.(place)}
        >
          {/* The same component the old map drew, from the same descriptor.
              Web builds the identical pin out of DOM. One visual language. */}
          <PlaceMarker marker={place.card?.marker}/>
        </Marker>
      ))}

      {/* After the places, so a live thing draws on top of the place it is
          happening at rather than under it. */}
      {activity.map((item)=>(
        <Marker
          key={item.key}
          id={item.key}
          coordinate={[item.longitude,item.latitude]}
          onPress={()=>onSelectActivity?.(item)}
        >
          <PlaceMarker marker={item.marker}/>
        </Marker>
      ))}
    </Map>
  );
}

const styles=StyleSheet.create({map:{flex:1}});

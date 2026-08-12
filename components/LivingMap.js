import React from "react";
import {View,StyleSheet} from "react-native";
import {Map,Camera,Marker} from "@maplibre/maplibre-react-native";
import PlaceMarker from "./PlaceMarker";
import {mapConfiguration} from "../utils/mapProvider";
import {DEFAULT_CENTRE} from "../hooks/useLivingMap";

// The native renderer: MapLibre on Android and iOS.
//
// THE OLD MAP IS GONE
//
// components/LivingMap.legacy.js was the react-native-maps version, kept behind
// EXPO_PUBLIC_LEGACY_MAP=1 until the MapLibre map had been opened on a real
// phone. It has been, so the file, the switch, the dependency and the Google
// Maps configuration all went with it -- and the Google logo went with them,
// which was the only third-party badge left in the app once My Map moved onto
// this renderer too.
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
  return <MapLibreMap {...props}/>;
}

// ONE RENDERER, TWO MAPS.
//
// `places` and `activity` are the Living Map's own shapes. `pins` is the
// general one -- a key, a position, a marker descriptor and an optional
// opacity -- and it is what My Map draws its Memories with.
//
// The alternative was a second MapLibre setup in components/MemoryPins.js, and
// then two places to get the camera wrong, two places to forget to turn the
// logo off, and two visual languages a month later. This map is the app's map.
function MapLibreMap({
  places=[],
  activity=[],
  pins=[],
  centre=DEFAULT_CENTRE,
  zoom=12,
  style,
  onSelectPlace,
  onSelectActivity
}){
  const config=mapConfiguration();

  return(
    <Map
      style={[styles.map,style]}
      mapStyle={config.styleUrl}
      /*
        NO BRANDING ON THE MAP, AND THE CREDIT MOVED RATHER THAN DROPPED

        Both of MapLibre's own controls are off: the logo, and the built-in
        attribution button. They are turned OFF at the component, not covered
        over -- nothing is drawn and then hidden.

        The OpenStreetMap credit has not gone from the app. It could not: the
        map data is OpenStreetMap's and the licence it is free under requires
        the credit. It now appears in two places instead of on the map --
        components/StartupSplash.js shows "Map data from OpenStreetMap" for five
        seconds every time the app opens, and Settings carries the permanent
        wording and the link to the licence. Both are in
        docs/design-system.md's attribution note.

        These are also the RIGHT prop names. `attributionEnabled` and
        `logoEnabled` were v10's; on v11 they are `attribution` and `logo`.
        scripts/verify-native-map-props.cjs checks them against the installed
        package, because a React component ignores a prop it does not know in
        silence -- which is how the logo and the credit bar came to be drawn
        here in the first place.
      */
      attribution={false}
      logo={false}
    >
      {/*
        initialViewState, not a controlled camera. A controlled one drags the
        map back to a fixed point on every re-render, and "map position
        unchanged after opening, swiping and dismissing a card" is a criterion
        this has to keep meeting.

        THIS IS THE ONE THAT OPENED THE MAP ON THE WHOLE WORLD.

        `defaultSettings={{centerCoordinate,zoomLevel}}` is v10. On v11 it is
        `initialViewState={{center,zoom}}` -- so nothing here was read, no
        starting position was ever set, and the map opened where MapLibre opens
        with no instructions: zoomed all the way out.
      */}
      <Camera
        initialViewState={{
          center:[Number(centre.longitude),Number(centre.latitude)],
          zoom
        }}
      />

      {places.map((place)=>(
        <Marker
          key={`${place.kind}-${place.id}`}
          id={`${place.kind}-${place.id}`}
          /*
            AND THIS IS THE ONE THAT DREW NO PINS.

            v10 called it `coordinate`, v11 calls it `lngLat`. A Marker with no
            position it recognises has nothing to draw, so every pin was built,
            handed to the map, and dropped on the floor.
          */
          lngLat={[Number(place.longitude),Number(place.latitude)]}
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
          lngLat={[item.longitude,item.latitude]}
          onPress={()=>onSelectActivity?.(item)}
        >
          <PlaceMarker marker={item.marker}/>
        </Marker>
      ))}

      {/* The general layer. A Memory fades as its time on the map runs out --
          utils/mapLayers.js works the opacity out, this only draws it. */}
      {pins.map((pin)=>(
        <Marker
          key={pin.key}
          id={pin.key}
          lngLat={[Number(pin.longitude),Number(pin.latitude)]}
          onPress={()=>pin.onPress?.()}
        >
          <View style={{opacity:pin.opacity ?? 1}}>
            <PlaceMarker marker={pin.marker}/>
          </View>
        </Marker>
      ))}
    </Map>
  );
}

const styles=StyleSheet.create({map:{flex:1}});

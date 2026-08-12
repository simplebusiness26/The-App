import React from "react";
import MapView,{Marker} from "react-native-maps";
import {StyleSheet} from "react-native";
import PlaceMarker from "./PlaceMarker";
import {DEFAULT_CENTRE,DEFAULT_SPAN} from "../hooks/useLivingMap";

// The native renderer.
//
// STILL react-native-maps, ON PURPOSE, AND ONLY FOR NOW.
//
// Packet 21's phase order is deliberate: the MapLibre native renderer arrives
// ALONGSIDE this one rather than instead of it, so the working native map is
// never the thing being debugged. The owner has not yet seen the new map on a
// real phone, and the agreed position is that both exist until they have.
//
// The important part has already moved: this file no longer reads the database,
// filters anything, decides what a marker means or builds a card. It takes what
// useLivingMap worked out and draws it. Swapping MapLibre in underneath is
// therefore a change to this file and nothing else -- which is the whole point
// of the shared brain.
//
// initialRegion and never `region`: a controlled region drags the map back to a
// fixed point on every re-render, and "map position unchanged after opening,
// swiping and dismissing a card" is a criterion this has to keep meeting.

export default function LivingMap({places=[],activity=[],onSelectPlace,onSelectActivity}){
  return(
    <MapView
      style={styles.map}
      initialRegion={{
        latitude:DEFAULT_CENTRE.latitude,
        longitude:DEFAULT_CENTRE.longitude,
        latitudeDelta:DEFAULT_SPAN,
        longitudeDelta:DEFAULT_SPAN
      }}
    >
      {places.map((place)=>(
        <Marker
          key={`${place.kind}-${place.id}`}
          coordinate={{latitude:Number(place.latitude),longitude:Number(place.longitude)}}
          title={place.name}
          description={place.card?.marker?.label}
          onPress={()=>onSelectPlace?.(place)}
        >
          <PlaceMarker marker={place.card?.marker}/>
        </Marker>
      ))}

      {/* After the places, so a live thing draws on top of the place it is
          happening at rather than under it. */}
      {activity.map((item)=>(
        <Marker
          key={item.key}
          coordinate={{latitude:item.latitude,longitude:item.longitude}}
          title={item.title}
          description={item.marker?.label}
          onPress={()=>onSelectActivity?.(item)}
        >
          <PlaceMarker marker={item.marker}/>
        </Marker>
      ))}
    </MapView>
  );
}

const styles=StyleSheet.create({map:{flex:1}});

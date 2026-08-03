import React from "react";
import {Text,StyleSheet} from "react-native";
import PlacesList from "../components/PlacesList";

export default function MapScreen(){
  return <PlacesList header={<Text style={styles.title}>🗺️ Guestbook Map</Text>}/>;
}

const styles=StyleSheet.create({
  title:{fontSize:30,fontWeight:"bold"}
});

import React from "react";
import {StyleSheet} from "react-native";
import QRCode from "react-native-qrcode-svg";
import {Frame} from "./instrument";

// The printable code, in a viewfinder frame.
//
// WHY THE CODE ITSELF IS NOT STYLED
//
// Everything else in this app moved onto the dark housing. A QR code cannot.
// It is read by a camera, not by a person, and a scanner needs real black
// modules on a real white ground with a quiet zone around them -- tint either
// half and the code stops being a code. So the instrument treats it the way it
// treats a photograph: the picture keeps its own colours and the HOUSING
// around it carries the design. Frame is the same bracketed well the
// viewfinder and every avatar use.

export function getListingUrl({
  propertyId,
  businessId,
  activityClubId,
  eventId,
  value
}){
  if(value) return value;

  const base=(process.env.EXPO_PUBLIC_APP_URL || "https://guestbook.app").replace(/\/$/,"");

  if(propertyId) return `${base}/property/${propertyId}`;
  if(businessId) return `${base}/business/${businessId}`;
  if(activityClubId) return `${base}/activity-clubs/${activityClubId}`;
  if(eventId) return `${base}/events/${eventId}`;

  return base;
}

export default function QRCodeGenerator({
  propertyId,
  businessId,
  activityClubId,
  eventId,
  value,
  size=200
}){
  const url=getListingUrl({
    propertyId,
    businessId,
    activityClubId,
    eventId,
    value
  });

  return(
    <Frame size={size+28} style={styles.quietZone}>
      {/* `quietZone` is the library's own margin, in code modules -- the clear
          border a scanner needs before it will read an edge. */}
      <QRCode value={url} size={size} quietZone={8}/>
    </Frame>
  );
}

const styles=StyleSheet.create({
  // Not a token, on purpose. A scanner needs the real thing behind the
  // modules, and there is no light surface in the instrument palette because
  // nothing else in the app has one.
  quietZone:{backgroundColor:"white"}
});

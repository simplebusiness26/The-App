import React from "react";
import CameraCapture from "../components/CameraCapture";

// The /camera route. Thin on purpose -- the real viewfinder now lives in
// components/CameraCapture.js so it can also be the Create hub's default
// surface (components/CreateHub.js) without a second implementation.
//
// This route still has to work standalone: app/places/[id].js and other
// listing pages push straight to `/camera?target_type=...&target_id=...` for
// a "post a Moment here" launch, and that deep link has to land on a real,
// full-screen camera whether or not the Create hub exists. CameraCapture
// reads those params itself when it is not handed explicit props, so nothing
// here has to know about them.
export default function Camera(){
  return <CameraCapture/>;
}

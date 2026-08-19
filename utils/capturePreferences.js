import {Platform} from "react-native";
import {supabase} from "../services/supabase";

// CAPTURE DEFAULTS -- the three answers the viewfinder should not have to ask
// for twice.
//
// The locked spec's configuration rung: "Grid overlay, save-to-library, default
// video quality/compression live in Account & Safety > Capture defaults." A
// preference is the level of the ladder for a decision somebody makes ONCE, so
// none of these three is a control on the camera face: they are set in
// Settings and the viewfinder simply obeys them.
//
// STORED THE WAY PUSH PREFERENCES ARE STORED
//
// utils/push.js keeps one row per account, columns rather than rows, so the
// default is expressed in the schema itself and a missing row cannot mean
// something was switched on for somebody who never asked. Same shape here:
// supabase/migrations/20260819000000_capture_defaults.sql is the table, this is
// the only file that reads or writes it.
//
// WHAT "SAVE TO LIBRARY" CAN HONESTLY MEAN IN THIS BUILD
//
// Writing into the phone's own photo library needs expo-media-library, which is
// not a dependency of this app, and RULES.md says to ask before adding one. So
// this preference does the part that IS buildable with what is installed: a
// capture lands in the cache directory (expo-camera's own documented
// behaviour), and the OS is free to sweep that whenever it wants space. With
// this on, the file is copied into the app's document directory first, where it
// survives. The label in Settings says exactly that and does not claim the
// camera roll.

// expo-camera's `videoQuality` prop, with the values it actually accepts.
// '4:3' is the odd one out (640x480, a different aspect) and is deliberately
// not offered: a 4:3 clip in a 16:9 feed is a product decision, not a quality
// setting.
export const VIDEO_QUALITIES=[
  {key:"720p",label:"720p",help:"Smallest files. Best on a slow connection."},
  {key:"1080p",label:"1080p",help:"The default. Full HD, and it uploads."},
  {key:"2160p",label:"2160p",help:"4K where the phone has it. Large files."}
];

export const VIDEO_QUALITY_KEYS=VIDEO_QUALITIES.map((entry)=>entry.key);
export const DEFAULT_VIDEO_QUALITY="1080p";

// The blank slate, which is also what the database defaults say. Both switches
// off: a grid nobody asked for is a grid over every photograph, and a copy
// nobody asked for is storage spent on somebody's behalf.
export function defaultCapturePreferences(){
  return {grid:false,saveToLibrary:false,videoQuality:DEFAULT_VIDEO_QUALITY};
}

// One shape, whatever the row looks like. A quality the app no longer offers --
// an older row, a hand-edited one -- falls back to the default rather than
// being handed to expo-camera, which would reject it.
export function normaliseCapturePreferences(row){
  const base=defaultCapturePreferences();
  if(!row) return base;

  const quality=row.video_quality ?? row.videoQuality;
  return {
    grid:!!(row.grid_overlay ?? row.grid),
    saveToLibrary:!!(row.save_to_library ?? row.saveToLibrary),
    videoQuality:VIDEO_QUALITY_KEYS.includes(quality) ? quality : base.videoQuality
  };
}

export async function loadCapturePreferences(userId){
  if(!userId) return defaultCapturePreferences();

  try{
    const {data,error}=await supabase
      .from("capture_preferences")
      .select("*")
      .eq("user_id",userId)
      .maybeSingle();

    // A missing row means the defaults, and so does a failed read. Guessing
    // "on" because a read failed would be the app turning something on for
    // somebody who never asked -- the same rule utils/push.js follows.
    if(error || !data) return defaultCapturePreferences();
    return normaliseCapturePreferences(data);
  }catch{
    return defaultCapturePreferences();
  }
}

export async function saveCapturePreferences(userId,preferences){
  if(!userId) return {error:"Not signed in."};

  const clean=normaliseCapturePreferences(preferences);
  const {error}=await supabase.from("capture_preferences").upsert({
    user_id:userId,
    grid_overlay:clean.grid,
    save_to_library:clean.saveToLibrary,
    video_quality:clean.videoQuality,
    updated_at:new Date().toISOString()
  },{onConflict:"user_id"});

  return {error:error ? error.message : null};
}

// A browser has no document directory to copy into and expo-camera's web
// implementation cannot record at all, so the copy is a phone-only capability
// and Settings says so rather than drawing a switch that does nothing. Same
// pattern as utils/push.js's pushIsSupported().
export function captureCopyIsSupported(){
  return Platform.OS==="ios" || Platform.OS==="android";
}

// Copy a capture out of the cache directory, where expo-camera writes it, and
// into the app's documents, where the OS will not sweep it.
//
// Required lazily and inside the "off" guard, exactly the way utils/push.js
// requires expo-notifications: a preference nobody turned on must not pull a
// native module into a bundle that has no use for it.
export async function keepACopy(uri,preferences){
  if(!uri || !preferences?.saveToLibrary) return {saved:false,error:""};
  if(!captureCopyIsSupported()) return {saved:false,error:""};

  try{
    // eslint-disable-next-line global-require
    const {Directory,File,Paths}=require("expo-file-system");

    const folder=new Directory(Paths.document,"Captures");
    if(!folder.exists) folder.create({intermediates:true,idempotent:true});

    const source=new File(uri);
    await source.copy(folder);
    return {saved:true,error:""};
  }catch(problem){
    // A failed copy must never lose the capture: the photo is already taken and
    // the screen is about to hand it on. Report it and carry on.
    return {saved:false,error:problem?.message || "The copy could not be kept on this phone."};
  }
}

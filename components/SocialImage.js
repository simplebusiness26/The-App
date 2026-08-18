import React,{useEffect,useState} from "react";
import {Image,StyleSheet} from "react-native";
import {displayUrlFor} from "../utils/media";
import {Frame} from "./instrument";

// An <Image> for something in a private bucket.
//
// Every Moment photograph, Memory photograph and profile picture in the app
// goes through this. It takes whatever the database holds -- a full public URL
// from before the buckets went private, or a bare storage path from after it --
// and asks utils/media.js for something displayable.
//
// WHY A COMPONENT RATHER THAN TWENTY useEffects
//
// There are about twenty places that draw one of these. Signing in each of them
// would be twenty chances to forget, and forgetting is invisible: the picture
// still appears while the bucket is public and disappears the day it is not.
// One component means one place to be wrong, and scripts/verify-private-media
// .cjs refuses a raw <Image> on a media_url anywhere else.
//
// It falls back to the raw value rather than to nothing. See the note in
// utils/media.js: a picture that might be public is better than an empty frame,
// and a missed call site degrades instead of breaking.
//
// FRAMED
//
// docs/design-system.md puts every picture in this app inside the viewfinder's
// bracketed well, so `framed` wraps the picture in the kit's `Frame`: an
// `inset` ground, a 1px hairline and four L brackets. The style passed in
// lands on the frame and the picture fills it, which is why the prop exists
// rather than every call site nesting a Frame of its own and getting the
// inner sizing subtly different each time.
//
// It is opt-in because a bare <Image> is still right in the places that draw
// their own well -- a full-bleed story photograph, a poster behind a play
// control -- and because a frame silently appearing under twenty existing call
// sites is not a change any of them asked for.
export default function SocialImage({uri,bucket,fallback=null,framed=false,round=false,ratio=1,style,...rest}){
  const [shown,setShown]=useState(null);

  useEffect(()=>{
    let alive=true;
    setShown(null);

    if(!uri) return undefined;

    displayUrlFor(uri,{bucket}).then((resolved)=>{
      if(alive) setShown(resolved);
    });

    return()=>{alive=false;};
  },[uri,bucket]);

  // Nothing to show and nothing being fetched. A caller that wants a
  // placeholder passes one; a caller that does not gets nothing rather than a
  // grey rectangle it did not ask for.
  if(!uri) return fallback;

  // Still signing. The <Image> is rendered with no source rather than held
  // back, so the layout does not jump when the URL arrives.
  const picture=<Image source={shown ? {uri:shown} : undefined} style={framed ? styles.filled : style} {...rest}/>;

  if(!framed) return picture;

  return(
    <Frame round={round} ratio={ratio} style={[styles.frame,style]}>
      {picture}
    </Frame>
  );
}

const styles=StyleSheet.create({
  // aspectRatio is Frame's default sizing; a caller passing an explicit height
  // in `style` needs it out of the way, and a style key set to undefined is
  // dropped by StyleSheet.flatten.
  frame:{aspectRatio:undefined},
  filled:{width:"100%",height:"100%"}
});

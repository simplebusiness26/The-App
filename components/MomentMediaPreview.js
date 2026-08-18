import React,{useEffect,useState} from "react";
import {Image,Platform,StyleSheet,Text,View} from "react-native";
import {INK,SHAPE,TYPE} from "../utils/tokens";
import {Frame,Glyph,MONO,Notice} from "./instrument";

// What you are about to post, before you post it.
//
// The preview sits in the viewfinder's bracketed well like every other picture
// in the app -- an `inset` ground, a 1px hairline, four L brackets -- because
// the thing being previewed came off the camera two screens ago and should
// still look like it is being looked at through the same instrument.
//
// A failed preview is a Notice, not a red box. docs/design-system.md: errors
// are an edge in a state ink with a mono eyebrow, never a filled panel with
// text fighting the fill.
export default function MomentMediaPreview({asset,mediaType,onPreviewError}){
  const previewUri=asset?.previewUri || asset?.uri || null;
  const [failed,setFailed]=useState(false);

  useEffect(()=>{
    setFailed(false);
  },[previewUri,mediaType]);

  function handleError(){
    setFailed(true);
    onPreviewError?.("Xplorer could not display this media preview. Choose the file again or open the preview in a separate browser tab.");
  }

  if(!previewUri || failed){
    return(
      <Notice tone="dispute" label="Preview unavailable">
        Choose the photo or video again.
      </Notice>
    );
  }

  if(Platform.OS==="web"){
    if(mediaType==="video"){
      return React.createElement("video",{
        src:previewUri,
        controls:true,
        playsInline:true,
        preload:"metadata",
        onError:handleError,
        style:webStyles.video
      });
    }

    return React.createElement("img",{
      src:previewUri,
      alt:"Selected Moment",
      onError:handleError,
      style:webStyles.image
    });
  }

  if(mediaType==="image"){
    return(
      <Frame style={styles.frame}>
        <Image source={{uri:previewUri}} style={styles.image} resizeMode="cover" onError={handleError}/>
      </Frame>
    );
  }

  return(
    <Frame style={styles.videoFrame}>
      <View style={styles.videoDial}><Glyph name="play" size={22} colour={INK.readout} weight={1.4}/></View>
      <Text style={styles.videoTitle}>Video selected</Text>
      <Text style={styles.videoMeta}>{Math.ceil(Number(asset?.resolvedDuration || 0))} SECONDS</Text>
    </Frame>
  );
}

const webStyles={
  image:{
    display:"block",
    width:"100%",
    height:"300px",
    objectFit:"cover",
    borderRadius:`${SHAPE.radius.control}px`,
    border:`1px solid ${INK.hairline}`,
    // A viewfinder ground: the well, not the panel.
    backgroundColor:INK.inset
  },
  video:{
    display:"block",
    width:"100%",
    height:"300px",
    objectFit:"contain",
    borderRadius:`${SHAPE.radius.control}px`,
    border:`1px solid ${INK.hairline}`,
    backgroundColor:INK.inset
  }
};

const styles=StyleSheet.create({
  // aspectRatio is Frame's own default sizing; a fixed height needs it out of
  // the way, and a key set to undefined is dropped by StyleSheet.flatten.
  frame:{height:300,alignSelf:"stretch",aspectRatio:undefined},
  image:{width:"100%",height:"100%"},
  videoFrame:{height:230,alignSelf:"stretch",aspectRatio:undefined,gap:9},
  videoDial:{
    width:54,height:54,borderRadius:SHAPE.radius.pill,
    alignItems:"center",justifyContent:"center",paddingLeft:3,
    backgroundColor:INK.panel,borderWidth:SHAPE.border,borderColor:INK.hairlineStrong
  },
  videoTitle:{color:INK.readout,fontSize:TYPE.display.sizes.md,fontWeight:"700",letterSpacing:-0.3},
  videoMeta:{
    color:INK.readoutSoft,fontFamily:MONO,fontSize:TYPE.data.sizes.md,
    letterSpacing:0.9,textTransform:"uppercase"
  }
});

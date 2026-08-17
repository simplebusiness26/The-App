import React,{useEffect,useState} from "react";
import {Image,Platform,StyleSheet,Text,View} from "react-native";
import {INK,SHAPE} from "../utils/tokens";

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
      <View style={styles.failed}>
        <Text style={styles.failedIcon}>!</Text>
        <Text style={styles.failedTitle}>Preview unavailable</Text>
        <Text style={styles.failedText}>Choose the photo or video again.</Text>
      </View>
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
    return <Image source={{uri:previewUri}} style={styles.image} resizeMode="cover" onError={handleError}/>;
  }

  return(
    <View style={styles.videoFallback}>
      <Text style={styles.playIcon}>▶</Text>
      <Text style={styles.videoTitle}>Video selected</Text>
      <Text style={styles.videoMeta}>{Math.ceil(Number(asset?.resolvedDuration || 0))} seconds</Text>
    </View>
  );
}

const webStyles={
  image:{
    display:"block",
    width:"100%",
    height:"300px",
    objectFit:"cover",
    borderRadius:"10px",
    backgroundColor:INK.panel
  },
  video:{
    display:"block",
    width:"100%",
    height:"300px",
    objectFit:"contain",
    borderRadius:"10px",
    // A viewfinder ground: the well, not the panel.
    backgroundColor:INK.inset
  }
};

const styles=StyleSheet.create({
  image:{width:"100%",height:300,borderRadius:SHAPE.radius.card,backgroundColor:INK.panel},
  videoFallback:{
    height:230,
    borderRadius:SHAPE.radius.card,
    backgroundColor:INK.inset,
    borderWidth:SHAPE.border,
    borderColor:INK.hairline,
    alignItems:"center",
    justifyContent:"center"
  },
  playIcon:{color:INK.readout,fontSize:40},
  videoTitle:{color:INK.readout,fontSize:18,fontWeight:"700",marginTop:9},
  videoMeta:{color:INK.readoutSoft,marginTop:4},

  // TEXT ON A FILLED STATE COLOUR IS DARK. The instrument's inks are bright
  // colours on a dark housing, which inverts the old print system's rule --
  // INK.readout on INK.dispute measured 2.86:1, which is a screen nobody can
  // read. docs/design-system.md's accessibility table: dark `ground` text on
  // every filled state colour, and scripts/verify-contrast.cjs enforces it.
  failed:{
    height:220,
    borderRadius:SHAPE.radius.card,
    backgroundColor:INK.dispute,
    borderColor:INK.dispute,
    borderWidth:SHAPE.border,
    alignItems:"center",
    justifyContent:"center",
    padding:22
  },
  failedIcon:{
    width:34,
    height:34,
    borderRadius:17,
    backgroundColor:INK.dispute,
    color:INK.ground,
    fontSize:22,
    fontWeight:"700",
    textAlign:"center",
    lineHeight:34
  },
  failedTitle:{color:INK.ground,fontSize:18,fontWeight:"700",marginTop:10},
  failedText:{color:INK.ground,textAlign:"center",marginTop:5}
});

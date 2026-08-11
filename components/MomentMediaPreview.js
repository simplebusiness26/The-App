import React,{useEffect,useState} from "react";
import {Image,Platform,StyleSheet,Text,View} from "react-native";

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
    borderRadius:"13px",
    backgroundColor:"#303036"
  },
  video:{
    display:"block",
    width:"100%",
    height:"300px",
    objectFit:"contain",
    borderRadius:"13px",
    backgroundColor:"#101013"
  }
};

const styles=StyleSheet.create({
  image:{width:"100%",height:300,borderRadius:13,backgroundColor:"#303036"},
  videoFallback:{height:230,borderRadius:13,backgroundColor:"#101013",alignItems:"center",justifyContent:"center"},
  playIcon:{color:"white",fontSize:40},
  videoTitle:{color:"white",fontSize:18,fontWeight:"900",marginTop:9},
  videoMeta:{color:"#a0a0aa",marginTop:4},
  failed:{height:220,borderRadius:13,backgroundColor:"#35252a",borderColor:"#70404a",borderWidth:1,alignItems:"center",justifyContent:"center",padding:22},
  failedIcon:{width:34,height:34,borderRadius:17,backgroundColor:"#8f2636",color:"white",fontSize:22,fontWeight:"900",textAlign:"center",lineHeight:34},
  failedTitle:{color:"white",fontSize:18,fontWeight:"900",marginTop:10},
  failedText:{color:"#d2abb2",textAlign:"center",marginTop:5}
});

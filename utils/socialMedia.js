import {Platform} from "react-native";

export function fileExtension(asset,mediaType){
  const fileName=asset?.fileName || asset?.name || asset?.file?.name || "";
  if(fileName.includes(".")) return fileName.split(".").pop().toLowerCase();

  const subtype=(asset?.mimeType || asset?.file?.type || "").split("/").pop()?.toLowerCase();
  if(subtype==="jpeg") return "jpg";
  if(subtype==="quicktime") return "mov";
  if(subtype) return subtype;
  return mediaType==="video" ? "mp4" : "jpg";
}

export function assetDurationSeconds(asset){
  const raw=Number(asset?.resolvedDuration || asset?.duration || 0);
  if(!raw) return null;
  return raw>300 ? raw/1000 : raw;
}

export function prepareSocialAsset(asset){
  if(!asset) return null;

  let previewUri=asset.uri || null;
  let ownsPreviewUri=false;

  if(
    Platform.OS==="web" &&
    asset.file &&
    typeof URL!=="undefined" &&
    typeof URL.createObjectURL==="function"
  ){
    previewUri=URL.createObjectURL(asset.file);
    ownsPreviewUri=true;
  }

  return {
    ...asset,
    previewUri,
    ownsPreviewUri
  };
}

// A photo the app's own camera just took. It arrives as a file path, not as a
// picked asset, and it is handed between screens as a route parameter -- so
// app/camera.js can take the picture while the Moment and Memory screens keep
// sole responsibility for uploading and for who may see it.
//
// ownsPreviewUri is false: nothing here created an object URL, so nothing here
// should revoke one.
export function assetFromCameraUri(uri){
  const clean=(uri || "").trim();
  if(!clean) return null;

  const extension=clean.split("?")[0].split(".").pop()?.toLowerCase();
  const known=["jpg","jpeg","png","heic","webp"].includes(extension) ? extension : "jpg";

  return {
    uri:clean,
    previewUri:clean,
    ownsPreviewUri:false,
    fileName:`camera.${known}`,
    mimeType:`image/${known==="jpg" ? "jpeg" : known}`
  };
}

export function releaseSocialAsset(asset){
  if(
    Platform.OS==="web" &&
    asset?.ownsPreviewUri &&
    asset?.previewUri &&
    typeof URL!=="undefined" &&
    typeof URL.revokeObjectURL==="function"
  ){
    URL.revokeObjectURL(asset.previewUri);
  }
}

export async function resolveVideoDuration(asset){
  const supplied=assetDurationSeconds(asset);
  if(supplied) return supplied;

  if(Platform.OS!=="web" || typeof document==="undefined") return null;

  let source=asset?.previewUri || asset?.uri || null;
  let temporarySource=false;

  if(
    !source &&
    asset?.file &&
    typeof URL!=="undefined" &&
    typeof URL.createObjectURL==="function"
  ){
    source=URL.createObjectURL(asset.file);
    temporarySource=true;
  }

  if(!source) return null;

  return new Promise(resolve=>{
    const video=document.createElement("video");
    let finished=false;

    const finish=value=>{
      if(finished) return;
      finished=true;
      clearTimeout(timer);
      video.removeAttribute("src");
      video.load();
      if(
        temporarySource &&
        typeof URL!=="undefined" &&
        typeof URL.revokeObjectURL==="function"
      ){
        URL.revokeObjectURL(source);
      }
      resolve(Number.isFinite(value) && value>0 ? value : null);
    };

    const timer=setTimeout(()=>finish(null),8000);
    video.preload="metadata";
    video.playsInline=true;
    video.onloadedmetadata=()=>finish(Number(video.duration || 0));
    video.onerror=()=>finish(null);
    video.src=source;
  });
}

export async function uploadSocialAsset({asset,userId,mediaType}){
  const extension=fileExtension(asset,mediaType);
  const random=Math.random().toString(36).slice(2,10);
  const path=`${userId}/${Date.now()}-${random}.${extension}`;

  let bytes;

  if(asset?.file && typeof asset.file.arrayBuffer==="function"){
    bytes=await asset.file.arrayBuffer();
  }else{
    const readableUri=asset?.uri || asset?.previewUri;
    if(!readableUri) throw new Error(`The selected ${mediaType} has no readable file.`);

    const response=await fetch(readableUri);
    if(!response.ok) throw new Error(`The selected ${mediaType} could not be read.`);
    bytes=await response.arrayBuffer();
  }

  if(!bytes?.byteLength) throw new Error(`The selected ${mediaType} was empty.`);

  const contentType=asset?.mimeType || asset?.file?.type || (mediaType==="video" ? "video/mp4" : `image/${extension}`);

  return {path,bytes,contentType};
}

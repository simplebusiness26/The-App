import React,{useEffect,useMemo,useState} from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  Platform
} from "react-native";
import {router} from "expo-router";
import * as ImagePicker from "expo-image-picker";
import {supabase} from "../services/supabase";
import {useFeedback} from "../context/FeedbackContext";

const TARGET_CONFIG={
  business:{
    table:"businesses",
    select:"id,name,image,photos",
    subtitle:"Share your experience with this business",
    getImage:(row)=>row?.image || row?.photos?.[0] || null
  },
  property:{
    table:"properties",
    select:"id,name,photos",
    subtitle:"Share your experience of this stay",
    getImage:(row)=>row?.photos?.[0] || null
  },
  activity_club:{
    table:"activity_clubs",
    select:"id,name,image_url",
    subtitle:"Share your experience with this activity club",
    getImage:(row)=>row?.image_url || null
  },
  event:{
    table:"events",
    select:"id,name,image_url",
    subtitle:"Share your experience of this event",
    getImage:(row)=>row?.image_url || null
  }
};

function firstParam(value){
  return Array.isArray(value) ? value[0] : value;
}

function fileExtension(asset,mediaType){
  const fileName=asset?.fileName || asset?.name || "";
  if(fileName.includes(".")){
    return fileName.split(".").pop().toLowerCase();
  }

  const subtype=(asset?.mimeType || "").split("/").pop()?.toLowerCase();
  if(subtype==="jpeg") return "jpg";
  if(subtype==="quicktime") return "mov";
  if(subtype) return subtype;
  return mediaType==="video" ? "mp4" : "jpg";
}

function durationSeconds(asset){
  const raw=Number(asset?.duration || 0);
  if(!raw) return null;
  return raw>300 ? raw/1000 : raw;
}

export default function ExplorerReviewForm({targetType,targetId,qrCode}){
  const {showFeedback}=useFeedback();
  const cleanTargetId=firstParam(targetId);
  const cleanQrCode=firstParam(qrCode);
  const config=TARGET_CONFIG[targetType];

  const [target,setTarget]=useState(null);
  const [profile,setProfile]=useState(null);
  const [rating,setRating]=useState(5);
  const [title,setTitle]=useState("");
  const [comment,setComment]=useState("");
  const [images,setImages]=useState([]);
  const [video,setVideo]=useState(null);
  const [loading,setLoading]=useState(true);
  const [submitting,setSubmitting]=useState(false);
  const [error,setError]=useState("");

  const basePoints=video ? 6 : images.length>0 ? 3 : 1;
  const possiblePoints=basePoints+(cleanQrCode ? 3 : 0);

  const contentLabel=useMemo(()=>{
    if(video) return "Video review";
    if(images.length) return "Image review";
    return "Text review";
  },[images.length,video]);

  useEffect(()=>{
    loadForm();
  },[targetType,cleanTargetId]);

  async function loadForm(){
    setLoading(true);
    setError("");

    if(!config || !cleanTargetId){
      setError("This review destination could not be identified.");
      setLoading(false);
      return;
    }

    const {data:{user},error:userError}=await supabase.auth.getUser();
    if(userError || !user){
      router.replace("/auth/login");
      return;
    }

    const [profileResult,targetResult]=await Promise.all([
      supabase.from("profiles").select("id,full_name,account_type").eq("id",user.id).single(),
      supabase.from(config.table).select(config.select).eq("id",cleanTargetId).single()
    ]);

    if(profileResult.error || !profileResult.data){
      setError("Your Explorer profile could not be loaded.");
      setLoading(false);
      return;
    }

    if(profileResult.data.account_type!=="explorer"){
      setError("Only Explorer accounts can leave reviews and earn review points.");
      setLoading(false);
      return;
    }

    if(targetResult.error || !targetResult.data){
      setError("This listing could not be loaded.");
      setLoading(false);
      return;
    }

    setProfile(profileResult.data);
    setTarget(targetResult.data);
    setLoading(false);
  }

  async function requestLibraryPermission(){
    if(Platform.OS==="web") return true;
    const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();
    if(permission.granted) return true;
    setError("Please allow access to your media library before choosing a photo or video.");
    return false;
  }

  async function pickImage(){
    setError("");
    if(images.length>=3){
      setError("A review can contain a maximum of 3 images.");
      return;
    }

    try{
      if(!(await requestLibraryPermission())) return;
      const result=await ImagePicker.launchImageLibraryAsync({
        mediaTypes:ImagePicker.MediaTypeOptions.Images,
        allowsEditing:false,
        allowsMultipleSelection:false,
        quality:0.75
      });

      if(!result.canceled && result.assets?.[0]){
        setImages(current=>[...current,result.assets[0]].slice(0,3));
      }
    }catch(pickerError){
      console.error("Image picker error:",pickerError);
      setError("The photo picker could not return to Xplorer. Try opening the preview in a separate browser tab.");
    }
  }

  async function pickVideo(){
    setError("");

    try{
      if(!(await requestLibraryPermission())) return;
      const result=await ImagePicker.launchImageLibraryAsync({
        mediaTypes:ImagePicker.MediaTypeOptions.Videos,
        allowsEditing:false,
        allowsMultipleSelection:false,
        videoMaxDuration:30,
        quality:0.7
      });

      if(result.canceled || !result.assets?.[0]) return;

      const asset=result.assets[0];
      const seconds=durationSeconds(asset);
      if(seconds && seconds>30.25){
        setError("Video reviews must be 30 seconds or shorter.");
        return;
      }

      if(asset.fileSize && asset.fileSize>52_428_800){
        setError("This video is larger than 50 MB. Choose a shorter or lower-quality clip.");
        return;
      }

      setVideo(asset);
    }catch(pickerError){
      console.error("Video picker error:",pickerError);
      setError("The video picker could not return to Xplorer. Try opening the preview in a separate browser tab.");
    }
  }

  async function uploadAsset({asset,userId,reviewId,mediaType,index}){
    const extension=fileExtension(asset,mediaType);
    const random=Math.random().toString(36).slice(2,10);
    const path=`${userId}/${reviewId}/${mediaType}-${index}-${Date.now()}-${random}.${extension}`;

    const response=await fetch(asset.uri);
    if(!response.ok) throw new Error(`The selected ${mediaType} could not be read.`);
    const bytes=await response.arrayBuffer();

    const {error:uploadError}=await supabase.storage
      .from("review-media")
      .upload(path,bytes,{
        contentType:asset.mimeType || (mediaType==="video" ? "video/mp4" : `image/${extension}`),
        upsert:false
      });

    if(uploadError) throw new Error(uploadError.message);

    const {data}=supabase.storage.from("review-media").getPublicUrl(path);
    if(!data?.publicUrl) throw new Error(`The uploaded ${mediaType} URL could not be created.`);

    return {
      path,
      row:{
        review_id:reviewId,
        user_id:userId,
        media_type:mediaType,
        media_url:data.publicUrl,
        thumbnail_url:null,
        duration_seconds:mediaType==="video" ? durationSeconds(asset) : null,
        sort_order:mediaType==="video" ? 99 : index,
        moderation_status:"published"
      }
    };
  }

  async function submitReview(){
    if(submitting) return;
    setError("");

    const cleanTitle=title.trim();
    const cleanComment=comment.trim();

    if(video && !cleanTitle){
      setError("Add a short title for your video review.");
      return;
    }

    if(!cleanComment){
      setError("Write a review before submitting.");
      return;
    }

    if(!target || !profile){
      setError("The review form has not finished loading.");
      return;
    }

    setSubmitting(true);
    let reviewId=null;
    const uploadedPaths=[];

    try{
      const {data:{user},error:userError}=await supabase.auth.getUser();
      if(userError || !user) throw new Error("You must be logged in before leaving a review.");

      const {data:review,error:reviewError}=await supabase
        .from("explorer_reviews")
        .insert({
          user_id:user.id,
          target_type:targetType,
          target_id:cleanTargetId,
          target_name:target.name || "Xplorer listing",
          target_image_url:config.getImage(target),
          rating,
          title:cleanTitle,
          comment:cleanComment,
          status:"published"
        })
        .select("id,points_eligible")
        .single();

      if(reviewError || !review) throw new Error(reviewError?.message || "The review could not be created.");
      reviewId=review.id;

      const mediaRows=[];
      for(let index=0;index<images.length;index++){
        const uploaded=await uploadAsset({asset:images[index],userId:user.id,reviewId,mediaType:"image",index});
        uploadedPaths.push(uploaded.path);
        mediaRows.push(uploaded.row);
      }

      if(video){
        const uploaded=await uploadAsset({asset:video,userId:user.id,reviewId,mediaType:"video",index:0});
        uploadedPaths.push(uploaded.path);
        mediaRows.push(uploaded.row);
      }

      if(mediaRows.length){
        const {error:mediaError}=await supabase.from("review_media").insert(mediaRows);
        if(mediaError) throw new Error(mediaError.message);
      }

      let qrVerified=false;
      if(cleanQrCode){
        const {error:qrError}=await supabase.rpc("verify_explorer_review_qr",{
          p_review_id:reviewId,
          p_code:cleanQrCode
        });
        if(qrError) throw new Error(qrError.message);
        qrVerified=true;
      }

      const {data:finalReview}=await supabase
        .from("explorer_reviews")
        .select("points_awarded,points_eligible")
        .eq("id",reviewId)
        .single();

      const awarded=finalReview?.points_awarded || 0;
      const monthlyEligible=finalReview?.points_eligible!==false;
      const message=monthlyEligible
        ? `${contentLabel} published. You earned ${awarded} point${awarded===1 ? "" : "s"}${qrVerified ? " including the verified-visit bonus" : ""}.`
        : "Review published. You already earned points for this place this month, so this review does not add leaderboard points.";

      showFeedback(message,"success","Review published");
      router.back();
    }catch(submitError){
      console.error("Unified review submission error:",submitError);

      if(uploadedPaths.length){
        await supabase.storage.from("review-media").remove(uploadedPaths);
      }
      if(reviewId){
        await supabase.from("explorer_reviews").delete().eq("id",reviewId);
      }

      setError(submitError?.message || "Something went wrong while publishing the review.");
    }finally{
      setSubmitting(false);
    }
  }

  if(loading){
    return <View style={styles.center}><ActivityIndicator size="large" color="#8d6bff"/></View>;
  }

  if(error && !target){
    return(
      <View style={styles.center}>
        <Text style={styles.fatalTitle}>Review unavailable</Text>
        <Text style={styles.fatalText}>{error}</Text>
        <Pressable style={styles.secondaryButton} onPress={()=>router.back()}>
          <Text style={styles.secondaryButtonText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return(
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>{contentLabel.toUpperCase()}</Text>
      <Text style={styles.title}>Review {target?.name}</Text>
      <Text style={styles.subtitle}>{config.subtitle}</Text>

      <View style={styles.pointsCard}>
        <View>
          <Text style={styles.pointsLabel}>POINTS PREVIEW</Text>
          <Text style={styles.pointsText}>{possiblePoints} point{possiblePoints===1 ? "" : "s"}</Text>
        </View>
        <Text style={styles.pointsBreakdown}>
          {basePoints} content{cleanQrCode ? " + 3 verified visit" : ""}
        </Text>
      </View>

      {!!error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}

      <Text style={styles.label}>Rating</Text>
      <View style={styles.stars}>
        {[1,2,3,4,5].map(star=>(
          <Pressable key={star} onPress={()=>setRating(star)} disabled={submitting}>
            <Text style={styles.star}>{star<=rating ? "★" : "☆"}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.ratingText}>{rating}/5</Text>

      <TextInput
        style={styles.input}
        placeholder="Review title (required for video)"
        placeholderTextColor="#8b8b94"
        value={title}
        onChangeText={setTitle}
        maxLength={80}
        editable={!submitting}
      />

      <TextInput
        style={styles.textarea}
        placeholder="What was your experience like?"
        placeholderTextColor="#8b8b94"
        value={comment}
        onChangeText={setComment}
        multiline
        maxLength={1500}
        editable={!submitting}
      />
      <Text style={styles.characterCount}>{comment.length}/1500</Text>

      <View style={styles.mediaHeadingRow}>
        <View>
          <Text style={styles.sectionTitle}>Review media</Text>
          <Text style={styles.sectionHelp}>Up to 3 images and one 30-second video</Text>
        </View>
        <Text style={styles.mediaCount}>{images.length}/3</Text>
      </View>

      {!!images.length && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imageRow}>
          {images.map((asset,index)=>(
            <View key={`${asset.uri}-${index}`} style={styles.imageWrap}>
              <Image source={{uri:asset.uri}} style={styles.previewImage}/>
              <Pressable style={styles.removeButton} onPress={()=>setImages(current=>current.filter((_,itemIndex)=>itemIndex!==index))} disabled={submitting}>
                <Text style={styles.removeText}>×</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}

      {!!video && (
        <View style={styles.videoPreview}>
          <View style={styles.playCircle}><Text style={styles.playIcon}>▶</Text></View>
          <View style={styles.videoMeta}>
            <Text style={styles.videoTitle}>Video selected</Text>
            <Text style={styles.videoText}>{Math.ceil(durationSeconds(video) || 0)} seconds · 6-point review</Text>
          </View>
          <Pressable onPress={()=>setVideo(null)} disabled={submitting}>
            <Text style={styles.clearVideo}>Remove</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.mediaButtons}>
        <Pressable style={[styles.mediaButton,images.length>=3 && styles.disabled]} onPress={pickImage} disabled={submitting || images.length>=3}>
          <Text style={styles.mediaButtonText}>📷 Add image</Text>
        </Pressable>
        <Pressable style={[styles.mediaButton,!!video && styles.disabled]} onPress={pickVideo} disabled={submitting || !!video}>
          <Text style={styles.mediaButtonText}>🎥 Add video</Text>
        </Pressable>
      </View>

      <Text style={styles.ruleText}>Points use the highest content type: text 1, images 3 or video 6. A valid on-site QR scan adds 3 more.</Text>

      <Pressable style={[styles.submitButton,submitting && styles.disabled]} onPress={submitReview} disabled={submitting}>
        {submitting ? (
          <View style={styles.submitRow}><ActivityIndicator color="white"/><Text style={styles.submitText}>Publishing review...</Text></View>
        ) : (
          <Text style={styles.submitText}>Publish Review · {possiblePoints} pts</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:"#18181b"},
  content:{padding:22,paddingBottom:60},
  center:{flex:1,backgroundColor:"#18181b",alignItems:"center",justifyContent:"center",padding:28},
  eyebrow:{color:"#bca9ff",fontWeight:"800",fontSize:12,letterSpacing:1},
  title:{color:"white",fontSize:30,fontWeight:"900",marginTop:6},
  subtitle:{color:"#b8b8c0",fontSize:16,lineHeight:23,marginTop:7,marginBottom:18},
  pointsCard:{backgroundColor:"#251d40",borderColor:"#594298",borderWidth:1,borderRadius:15,padding:16,flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:18},
  pointsLabel:{color:"#bca9ff",fontSize:11,fontWeight:"900",letterSpacing:0.8},
  pointsText:{color:"white",fontSize:23,fontWeight:"900",marginTop:3},
  pointsBreakdown:{color:"#d2c7f4",fontSize:12,maxWidth:"44%",textAlign:"right"},
  errorBox:{backgroundColor:"#3d171b",borderColor:"#83363d",borderWidth:1,borderRadius:12,padding:13,marginBottom:16},
  errorText:{color:"#ffb5bc",lineHeight:20,fontWeight:"600"},
  label:{color:"white",fontSize:17,fontWeight:"800"},
  stars:{flexDirection:"row",marginTop:9},
  star:{color:"#f5c542",fontSize:38,marginRight:4},
  ratingText:{color:"#b8b8c0",fontWeight:"700",marginTop:2,marginBottom:16},
  input:{backgroundColor:"#222226",borderColor:"#44444b",borderWidth:1,borderRadius:12,padding:14,color:"white",fontSize:16,marginBottom:12},
  textarea:{backgroundColor:"#222226",borderColor:"#44444b",borderWidth:1,borderRadius:12,padding:14,color:"white",fontSize:16,minHeight:130,textAlignVertical:"top"},
  characterCount:{color:"#81818a",fontSize:12,textAlign:"right",marginTop:5},
  mediaHeadingRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginTop:22,marginBottom:11},
  sectionTitle:{color:"white",fontSize:19,fontWeight:"900"},
  sectionHelp:{color:"#9d9da6",fontSize:12,marginTop:3},
  mediaCount:{color:"#bca9ff",fontWeight:"900"},
  imageRow:{paddingBottom:10},
  imageWrap:{width:115,height:115,marginRight:10,position:"relative"},
  previewImage:{width:"100%",height:"100%",borderRadius:12,backgroundColor:"#303036"},
  removeButton:{position:"absolute",right:6,top:6,width:28,height:28,borderRadius:14,backgroundColor:"rgba(0,0,0,0.78)",alignItems:"center",justifyContent:"center"},
  removeText:{color:"white",fontSize:21,lineHeight:23,fontWeight:"900"},
  videoPreview:{backgroundColor:"#222226",borderColor:"#4d3a84",borderWidth:1,borderRadius:13,padding:13,flexDirection:"row",alignItems:"center",marginBottom:10},
  playCircle:{width:45,height:45,borderRadius:23,backgroundColor:"#3012a8",alignItems:"center",justifyContent:"center"},
  playIcon:{color:"white",fontSize:18,marginLeft:2},
  videoMeta:{flex:1,marginLeft:11},
  videoTitle:{color:"white",fontWeight:"900"},
  videoText:{color:"#a9a9b2",fontSize:12,marginTop:3},
  clearVideo:{color:"#ff9da5",fontWeight:"800",fontSize:12},
  mediaButtons:{flexDirection:"row",gap:10},
  mediaButton:{flex:1,borderColor:"#5b46a0",borderWidth:1,backgroundColor:"#252034",padding:13,borderRadius:11,alignItems:"center"},
  mediaButtonText:{color:"#ddd5fa",fontWeight:"800"},
  ruleText:{color:"#9999a2",fontSize:12,lineHeight:18,marginTop:14},
  submitButton:{backgroundColor:"#3212b6",padding:17,borderRadius:13,alignItems:"center",marginTop:22},
  submitText:{color:"white",fontWeight:"900",fontSize:16,marginLeft:9},
  submitRow:{flexDirection:"row",alignItems:"center"},
  disabled:{opacity:0.5},
  fatalTitle:{color:"white",fontSize:24,fontWeight:"900"},
  fatalText:{color:"#c3c3ca",textAlign:"center",lineHeight:22,marginTop:9},
  secondaryButton:{marginTop:18,borderColor:"#777780",borderWidth:1,borderRadius:11,paddingHorizontal:20,paddingVertical:12},
  secondaryButtonText:{color:"white",fontWeight:"800"}
});

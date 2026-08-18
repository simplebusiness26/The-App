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
import {CREATE_HUB_CLEARANCE} from "./CreateHub";
import {INK,SHAPE,TYPE} from "../utils/tokens";
import {
  Action,
  Field,
  fieldInputStyle,
  Frame,
  Glyph,
  MONO,
  Notice,
  Panel,
  ReadoutStrip,
  Screen,
  ScreenTitle,
  SectionRule
} from "./instrument";

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
  },
  // A park, a beach, a square. Reviewable since 20260811140000 added
  // public_place to explorer_reviews.target_type -- the place page has shown
  // reviews since then, with no way anywhere in the app to write one.
  public_place:{
    table:"public_places",
    select:"id,name,image_url",
    subtitle:"Say what this place is like",
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
      supabase.from("profiles").select("id,full_name").eq("id",user.id).single(),
      supabase.from(config.table).select(config.select).eq("id",cleanTargetId).single()
    ]);

    if(profileResult.error || !profileResult.data){
      setError("Your Explorer profile could not be loaded.");
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
    return <Screen style={styles.center}><ActivityIndicator size="large" color={INK.exists}/></Screen>;
  }

  if(error && !target){
    return(
      <Screen>
        <ScrollView contentContainerStyle={[styles.content,{paddingBottom:CREATE_HUB_CLEARANCE+24}]}>
          <ScreenTitle eyebrow="REVIEW" title="Review unavailable"/>
          <Notice tone="dispute" label="Not loaded">{error}</Notice>
          <Action kind="secondary" glyph="back" label="Go back" onPress={()=>router.back()}/>
        </ScrollView>
      </Screen>
    );
  }

  return(
    <Screen>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content,{paddingBottom:CREATE_HUB_CLEARANCE+24}]}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenTitle
          eyebrow={contentLabel.toUpperCase()}
          title={`Review ${target?.name}`}
          meta={config.subtitle}
        />

        {/* WHAT THIS REVIEW IS WORTH, READ OFF A PLATE.
            It was a filled blue card with three sizes of white text on it. The
            points are three separate measurements -- what you will earn, what
            the content is worth, and what the on-site scan adds -- so they are
            three readouts on one strip, which is the instrument's answer to
            "several numbers about one thing". */}
        <ReadoutStrip
          style={styles.points}
          items={[
            {label:"Points",value:String(possiblePoints)},
            {label:"Content",value:String(basePoints)},
            {label:"Verified visit",value:cleanQrCode ? "+3" : "—",tone:cleanQrCode ? "readout" : "readoutFaint"}
          ]}
        />

        {!!error && <Notice tone="dispute" label="Not published">{error}</Notice>}

        <SectionRule label="Your rating"/>

        {/*
          A RATING IS A MEASUREMENT, AND THIS ONE IS ALSO A CONTROL.
          Five repeated star characters at 38px were a count somebody had to do
          themselves, drawn in whatever the platform font felt like, with a tap
          target the size of the character. These are the kit's star glyph on the
          same 16x16 grid as everything else, each in its own 44px target, each
          saying out loud what it sets -- and the number is read out beside them
          so the value is legible without counting.
        */}
        <Field label="Rating" required>
          <View style={styles.stars} accessibilityLabel={`Rated ${rating} out of 5`}>
            {[1,2,3,4,5].map(star=>(
              <Pressable
                key={star}
                style={styles.star}
                onPress={()=>setRating(star)}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel={`Rate ${star} out of 5`}
                accessibilityState={{selected:star<=rating,disabled:!!submitting}}
              >
                <Glyph
                  name="star"
                  size={22}
                  weight={star<=rating ? 1.9 : 1.3}
                  colour={star<=rating ? INK.exists : INK.hairlineStrong}
                />
              </Pressable>
            ))}
            <View style={styles.starRule}/>
            <Text style={styles.ratingValue}>{rating}/5</Text>
          </View>
        </Field>

        <Field label="Review title" hint="Required for a video review.">
          <TextInput
            style={fieldInputStyle}
            placeholder="Worth the walk"
            placeholderTextColor={INK.readoutFaint}
            value={title}
            onChangeText={setTitle}
            maxLength={80}
            editable={!submitting}
          />
        </Field>

        <Field label="Your review" required>
          <TextInput
            style={[fieldInputStyle,styles.textarea]}
            placeholder="What was your experience like?"
            placeholderTextColor={INK.readoutFaint}
            value={comment}
            onChangeText={setComment}
            multiline
            textAlignVertical="top"
            maxLength={1500}
            editable={!submitting}
          />
        </Field>
        <Text style={styles.counter}>{comment.length}/1500</Text>

        <SectionRule label="Review media" meta={`${images.length}/3`}/>
        <Text style={styles.help}>Up to 3 images and one 30-second video.</Text>

        {!!images.length && (
          /*
            A horizontal ScrollView inside a flex column claims all the leftover
            vertical space and stretches its children to fill it -- measured in
            this repo at 402px-tall pills. flexGrow:0/flexShrink:0 and a centred
            content container are what stop that.
          */
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.imageScroll}
            contentContainerStyle={styles.imageRow}
          >
            {images.map((asset,index)=>(
              <Frame key={`${asset.uri}-${index}`} size={112} style={styles.imageWrap}>
                <Image source={{uri:asset.uri}} style={styles.previewImage}/>
                <Pressable
                  style={styles.removeButton}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove image ${index+1}`}
                  onPress={()=>setImages(current=>current.filter((_,itemIndex)=>itemIndex!==index))}
                  disabled={submitting}
                >
                  <Glyph name="close" size={13} colour={INK.readout} weight={1.8}/>
                </Pressable>
              </Frame>
            ))}
          </ScrollView>
        )}

        {!!video && (
          <Panel style={styles.videoPreview}>
            <View style={styles.playDial}>
              <Glyph name="play" size={17} colour={INK.readout} weight={1.5}/>
            </View>
            <View style={styles.videoMeta}>
              <Text style={styles.videoTitle}>Video selected</Text>
              <Text style={styles.videoText}>
                {Math.ceil(durationSeconds(video) || 0)}S · 6-POINT REVIEW
              </Text>
            </View>
            <Action
              kind="quiet"
              label="Remove"
              accessibilityLabel="Remove the video"
              style={styles.removeVideo}
              onPress={()=>setVideo(null)}
              disabled={submitting}
            />
          </Panel>
        )}

        <View style={styles.mediaButtons}>
          <Action
            kind="secondary"
            glyph="image"
            label="Add image"
            style={styles.mediaButton}
            onPress={pickImage}
            disabled={submitting || images.length>=3}
          />
          <Action
            kind="secondary"
            glyph="video"
            label="Add video"
            style={styles.mediaButton}
            onPress={pickVideo}
            disabled={submitting || !!video}
          />
        </View>

        <Text style={styles.help}>
          Points use the highest content type: text 1, images 3 or video 6. A
          valid on-site QR scan adds 3 more.
        </Text>

        <Action
          kind="primary"
          glyph="send"
          label="Publish this review"
          accessibilityLabel="Publish this review"
          loading={submitting}
          style={styles.submit}
          onPress={submitReview}
        />
      </ScrollView>
    </Screen>
  );
}

const styles=StyleSheet.create({
  screen:{flex:1},
  content:{paddingHorizontal:16,paddingBottom:24},
  center:{alignItems:"center",justifyContent:"center",padding:28},

  points:{marginTop:14,marginBottom:16},

  stars:{flexDirection:"row",alignItems:"center",paddingHorizontal:6,paddingVertical:2},
  star:{width:SHAPE.tapTarget,height:SHAPE.tapTarget,alignItems:"center",justifyContent:"center"},
  starRule:{flex:1,height:1,backgroundColor:INK.hairline,marginHorizontal:10},
  ratingValue:{
    color:INK.readout,fontFamily:MONO,fontSize:TYPE.data.sizes.lg,
    letterSpacing:0.8,paddingRight:10
  },

  textarea:{minHeight:130},
  counter:{
    color:INK.readoutFaint,fontFamily:MONO,fontSize:TYPE.data.sizes.sm,
    letterSpacing:0.8,textAlign:"right",marginTop:-10,marginBottom:4
  },
  help:{
    color:INK.readoutSoft,fontSize:TYPE.body.sizes.sm,
    lineHeight:TYPE.body.sizes.sm*1.5,marginBottom:12
  },

  imageScroll:{flexGrow:0,flexShrink:0},
  imageRow:{alignItems:"center",gap:10,paddingBottom:12},
  imageWrap:{position:"relative"},
  previewImage:{width:"100%",height:"100%"},
  removeButton:{
    position:"absolute",right:5,top:5,width:26,height:26,
    borderRadius:SHAPE.radius.control,
    backgroundColor:INK.inset,borderWidth:SHAPE.border,borderColor:INK.hairlineStrong,
    alignItems:"center",justifyContent:"center"
  },

  videoPreview:{flexDirection:"row",alignItems:"center",gap:12,padding:12,marginBottom:12},
  playDial:{
    width:38,height:38,borderRadius:SHAPE.radius.pill,
    backgroundColor:INK.inset,borderWidth:SHAPE.border,borderColor:INK.hairlineStrong,
    alignItems:"center",justifyContent:"center",paddingLeft:2
  },
  videoMeta:{flex:1,minWidth:0},
  videoTitle:{color:INK.readout,fontSize:TYPE.display.sizes.sm,fontWeight:"600",letterSpacing:-0.2},
  videoText:{
    color:INK.readoutFaint,fontFamily:MONO,fontSize:TYPE.data.sizes.sm,
    letterSpacing:0.8,marginTop:4
  },
  removeVideo:{paddingHorizontal:12},

  mediaButtons:{flexDirection:"row",gap:10,marginBottom:14},
  mediaButton:{flex:1},

  submit:{marginTop:6}
});

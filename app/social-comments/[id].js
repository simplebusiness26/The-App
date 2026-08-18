import React,{useCallback,useState} from "react";
import {ActivityIndicator,Image,Linking,Pressable,ScrollView,StyleSheet,Text,View} from "react-native";
import SocialImage from "../../components/SocialImage";
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {supabase} from "../../services/supabase";
import EndorseButton from "../../components/EndorseButton";
import CommentThread from "../../components/CommentThread";
import {useFeedback} from "../../context/FeedbackContext";
import {CREATE_HUB_CLEARANCE} from "../../components/CreateHub";
import {INK,TYPE,SHAPE} from "../../utils/tokens";
import {Action,Chip,Empty,Frame,Glyph,Meter,MONO,Notice,Panel,Row,Screen} from "../../components/instrument";

// A review, and what people said back about it.
//
// THE RATING IS A MEASUREMENT, SO IT IS READ OFF A SCALE. Five repeated star
// characters were a count you had to do yourself, in a shape supplied by
// whichever font the phone picked. A ticked Meter with the figure beside it is
// the instrument's answer, and it is legible at a glance at any rating -- the
// same control components/FeedCard.js draws for the same number.

// The same five the social_reports constraint allows. A review is content, so
// it is reported the way a Moment is and lands in the same admin queue.
const REPORT_REASONS=[
  {key:"spam",label:"Spam"},
  {key:"harassment",label:"Harassment"},
  {key:"inappropriate",label:"Inappropriate"},
  {key:"false_information",label:"False information"},
  {key:"other",label:"Other"}
];

function dateLabel(value){
  if(!value) return "";
  return new Date(value).toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"});
}

function listingRoute(review){
  if(review.target_type==="business") return `/business/${review.target_id}`;
  if(review.target_type==="property") return `/property/${review.target_id}`;
  if(review.target_type==="activity_club") return `/activity-clubs/${review.target_id}`;
  if(review.target_type==="event") return `/events/${review.target_id}`;
  if(review.target_type==="public_place") return `/places/${review.target_id}`;
  return null;
}

export default function VideoReviewComments(){
  const {showFeedback}=useFeedback();
  const params=useLocalSearchParams();
  const reviewId=Array.isArray(params.id) ? params.id[0] : params.id;
  const [review,setReview]=useState(null);
  const [video,setVideo]=useState(null);
  const [profile,setProfile]=useState(null);
  const [likeCount,setLikeCount]=useState(0);
  const [viewerLiked,setViewerLiked]=useState(false);
  const [showReport,setShowReport]=useState(false);
  const [reportReason,setReportReason]=useState("inappropriate");
  const [reporting,setReporting]=useState(false);
  const [viewerId,setViewerId]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  const load=useCallback(async()=>{
    setLoading(true);
    setError("");

    const {data:{user}}=await supabase.auth.getUser();
    setViewerId(user?.id || null);
    const {data:reviewRow,error:reviewError}=await supabase
      .from("explorer_reviews")
      .select("*")
      .eq("id",reviewId)
      .eq("status","published")
      .maybeSingle();

    if(reviewError || !reviewRow){
      setError("This video review is unavailable.");
      setLoading(false);
      return;
    }

    const [mediaResult,profileResult,countResult]=await Promise.all([
      supabase.from("review_media").select("*").eq("review_id",reviewId).eq("media_type","video").eq("moderation_status","published").maybeSingle(),
      supabase.from("profiles").select("id,full_name,profile_photo").eq("id",reviewRow.user_id).maybeSingle(),
      supabase.from("social_likes").select("id",{count:"exact",head:true}).eq("target_type","review").eq("target_id",reviewId)
    ]);

    // A video is no longer required. Packet 11 opened comments to every
    // published review -- the old rule meant the reviews most people write,
    // text and photos, could be endorsed but never answered.
    let liked=false;
    if(user){
      const {data}=await supabase
        .from("social_likes")
        .select("id")
        .eq("user_id",user.id)
        .eq("target_type","review")
        .eq("target_id",reviewId)
        .maybeSingle();
      liked=!!data;
    }

    setReview(reviewRow);
    setVideo(mediaResult.data || null);
    setProfile(profileResult.data || null);
    setLikeCount(Number(countResult.count || 0));
    setViewerLiked(liked);
    setLoading(false);
  },[reviewId]);

  useFocusEffect(useCallback(()=>{load();},[load]));

  async function reportReview(){
    if(reporting || !viewerId || viewerId===review?.user_id) return;

    setReporting(true);
    const {error:reportError}=await supabase
      .from("social_reports")
      .insert({
        reporter_id:viewerId,
        target_type:"review",
        target_id:review.id,
        reason:reportReason,
        details:"",
        status:"open"
      });
    setReporting(false);
    setShowReport(false);

    // The unique constraint on (reporter, target_type, target_id) is what stops
    // one person reporting the same review repeatedly, so a duplicate is a
    // normal outcome rather than a failure.
    if(reportError){
      if(String(reportError.code)==="23505") showFeedback("You have already reported this review.","info","Already reported");
      else showFeedback(reportError.message,"error","Report not sent");
      return;
    }

    showFeedback("This review has been sent for review.","success","Report submitted");
  }

  if(loading){
    return <Screen style={styles.centre}><ActivityIndicator size="large" color={INK.readoutSoft}/></Screen>;
  }

  if(error || !review){
    return(
      <Screen style={styles.centre}>
        <Empty glyph="warn" title="Review unavailable" instruction={error}/>
      </Screen>
    );
  }

  const route=listingRoute(review);

  return(
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Panel style={styles.card}>
          <View style={styles.headRow}>
            <Text style={styles.headKind}>REVIEW</Text>
            <View style={styles.headLine}/>
            <Text style={styles.headTime}>{dateLabel(review.created_at).toUpperCase()}</Text>
          </View>

          <Pressable
            style={styles.profileRow}
            accessibilityRole="button"
            accessibilityLabel={`Open ${profile?.full_name || "Explorer"}`}
            onPress={()=>router.push(`/profile/${review.user_id}`)}
          >
            <Frame size={42} round style={styles.avatarFrame}>
              {profile?.profile_photo
                ? <Image source={{uri:profile.profile_photo}} style={styles.avatar}/>
                : <Text style={styles.avatarLetter}>{profile?.full_name?.charAt(0)?.toUpperCase() || "E"}</Text>}
            </Frame>
            <View style={styles.profileText}>
              <Text style={styles.name} numberOfLines={1}>{profile?.full_name || "Explorer"}</Text>
              {!!review.verified_qr && (
                <View style={styles.verifiedRow}>
                  <Glyph name="check" size={12} colour={INK.readoutSoft} weight={1.8}/>
                  <Text style={styles.verifiedText}>VERIFIED ON-SITE</Text>
                </View>
              )}
            </View>
          </Pressable>

          {!!video && (
            <Pressable
              style={styles.videoWrap}
              accessibilityRole="button"
              accessibilityLabel="Play this video review"
              onPress={()=>Linking.openURL(video.media_url)}
            >
              <Frame style={styles.mediaFrame}>
                {video.thumbnail_url || review.target_image_url
                  ? <SocialImage uri={video.thumbnail_url || review.target_image_url} style={styles.poster} resizeMode="cover"/>
                  : null}
              </Frame>
              <View style={styles.playDial}><Glyph name="play" size={22} colour={INK.readout} weight={1.4}/></View>
              <Text style={styles.duration}>{Math.ceil(Number(video.duration_seconds || 0)) || "≤30"}S</Text>
            </Pressable>
          )}

          <View style={styles.ratingRow} accessibilityLabel={`Rated ${review.rating} out of 5`}>
            <Meter value={review.rating} max={5} width={104} tone="exists" label="RATED"/>
            <Text style={styles.ratingValue}>{review.rating}/5</Text>
          </View>

          {!!review.title && <Text style={styles.title}>{review.title}</Text>}
          <Text style={styles.comment}>{review.comment}</Text>

          {!!route && (
            <View style={styles.placeRow}>
              <Row
                glyph="pin"
                title={review.target_name}
                sub="Reviewed place"
                onPress={()=>router.push(route)}
              />
            </View>
          )}

          <View style={styles.actionRow}>
            <EndorseButton reviewId={review.id} ownerId={review.user_id} viewerId={viewerId} initialCount={likeCount} initialEndorsed={viewerLiked}/>
            {!!viewerId && viewerId!==review.user_id && (
              <Action
                kind="quiet"
                glyph="flag"
                label="Report"
                style={styles.trailing}
                onPress={()=>setShowReport((current)=>!current)}
              />
            )}
          </View>

          {showReport && (
            <View style={styles.reportPanel}>
              <Text style={styles.reportTitle}>Why are you reporting this review?</Text>
              <View style={styles.reasonRow}>
                {REPORT_REASONS.map((reason)=>(
                  <Chip
                    key={reason.key}
                    label={reason.label}
                    selected={reportReason===reason.key}
                    onPress={()=>setReportReason(reason.key)}
                  />
                ))}
              </View>
              <View style={styles.reportActions}>
                <Action kind="quiet" label="Cancel" style={styles.reportAction} onPress={()=>setShowReport(false)}/>
                <Action kind="danger" glyph="flag" label="Submit report" style={styles.reportAction} loading={reporting} disabled={reporting} onPress={reportReview}/>
              </View>
            </View>
          )}
        </Panel>

        <CommentThread targetType="review" targetId={review.id} ownerId={review.user_id}/>
      </ScrollView>
    </Screen>
  );
}

const MONO_META={fontFamily:MONO,letterSpacing:0.9,textTransform:"uppercase"};

const styles=StyleSheet.create({
  content:{paddingHorizontal:16,paddingTop:14,paddingBottom:24+CREATE_HUB_CLEARANCE},
  centre:{alignItems:"center",justifyContent:"center",paddingHorizontal:24},

  card:{padding:14},

  headRow:{flexDirection:"row",alignItems:"center",gap:9,marginBottom:12},
  headKind:{...MONO_META,color:INK.readoutSoft,fontSize:TYPE.data.sizes.md},
  headLine:{flex:1,height:1,backgroundColor:INK.hairline},
  headTime:{...MONO_META,color:INK.readoutFaint,fontSize:TYPE.data.sizes.sm},

  profileRow:{flexDirection:"row",alignItems:"center",marginBottom:13},
  avatarFrame:{backgroundColor:INK.inset},
  avatar:{width:42,height:42,borderRadius:SHAPE.radius.pill},
  avatarLetter:{color:INK.readoutSoft,fontWeight:"700",fontSize:17},
  profileText:{flex:1,marginLeft:11,minWidth:0},
  name:{color:INK.readout,fontSize:TYPE.display.sizes.sm,fontWeight:"600",letterSpacing:-0.2},
  verifiedRow:{flexDirection:"row",alignItems:"center",gap:5,marginTop:4},
  verifiedText:{...MONO_META,color:INK.readoutSoft,fontSize:TYPE.data.sizes.sm},

  // aspectRatio is Frame's own default sizing; a fixed height needs it out of
  // the way, and a key set to undefined is dropped by StyleSheet.flatten.
  mediaFrame:{height:360,alignSelf:"stretch",aspectRatio:undefined},
  poster:{width:"100%",height:"100%"},
  videoWrap:{alignItems:"center",justifyContent:"center"},
  playDial:{
    position:"absolute",width:58,height:58,borderRadius:SHAPE.radius.pill,
    backgroundColor:"rgba(11,14,18,0.78)",borderWidth:SHAPE.border,borderColor:INK.hairlineStrong,
    alignItems:"center",justifyContent:"center",paddingLeft:3
  },
  duration:{
    position:"absolute",right:8,bottom:8,...MONO_META,color:INK.readout,
    backgroundColor:"rgba(11,14,18,0.82)",borderWidth:SHAPE.border,borderColor:INK.hairline,
    paddingHorizontal:6,paddingVertical:3,borderRadius:SHAPE.radius.control,fontSize:TYPE.data.sizes.sm,overflow:"hidden"
  },

  ratingRow:{flexDirection:"row",alignItems:"center",gap:10,marginTop:14},
  ratingValue:{...MONO_META,color:INK.readout,fontSize:TYPE.data.sizes.lg},

  title:{color:INK.readout,fontSize:TYPE.display.sizes.md,fontWeight:"700",letterSpacing:-0.3,marginTop:11},
  comment:{color:INK.readout,fontSize:TYPE.body.sizes.lg,lineHeight:TYPE.body.sizes.lg*TYPE.body.lineHeight,marginTop:8},

  placeRow:{marginTop:14},

  actionRow:{flexDirection:"row",alignItems:"center",gap:9,marginTop:14,paddingTop:12,borderTopWidth:SHAPE.border,borderTopColor:INK.hairline},
  trailing:{marginLeft:"auto"},

  reportPanel:{marginTop:14,paddingTop:12,borderTopWidth:SHAPE.border,borderTopColor:INK.hairline},
  reportTitle:{color:INK.readout,fontSize:TYPE.body.sizes.md,lineHeight:TYPE.body.sizes.md*TYPE.body.lineHeight},
  reasonRow:{flexDirection:"row",flexWrap:"wrap",gap:6,marginTop:10},
  reportActions:{flexDirection:"row",justifyContent:"flex-end",gap:8,marginTop:13},
  reportAction:{minWidth:120}
});

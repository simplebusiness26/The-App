import React,{useCallback,useState} from "react";
import {ActivityIndicator,Image,Linking,Pressable,ScrollView,StyleSheet,Text,View} from "react-native";
import SocialImage from "../../components/SocialImage";
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {supabase} from "../../services/supabase";
import {useFeedback} from "../../context/FeedbackContext";
import LikeButton from "../../components/LikeButton";
import CommentThread from "../../components/CommentThread";
import {CREATE_HUB_CLEARANCE} from "../../components/CreateHub";
import {INK,TYPE,SHAPE} from "../../utils/tokens";
import {Action,Chip,Empty,Frame,Glyph,MONO,Notice,Panel,Row,Screen} from "../../components/instrument";

// One Moment, full size.
//
// The photograph is the whole point of the screen, so it sits in a Frame -- the
// viewfinder's bracketed well -- and everything else on the page is quiet
// around it. The head strip is the same mono plate every panel in this app
// opens with: what kind of thing this is, and when. The place it was taken at
// is a Row, because it is a thing you can go to rather than a caption.

const REPORT_REASONS=[
  {key:"spam",label:"Spam"},
  {key:"harassment",label:"Harassment"},
  {key:"inappropriate",label:"Inappropriate"},
  {key:"false_information",label:"False information"},
  {key:"other",label:"Other"}
];

function listingRoute(moment){
  if(moment.target_type==="business") return `/business/${moment.target_id}`;
  if(moment.target_type==="property") return `/property/${moment.target_id}`;
  if(moment.target_type==="activity_club") return `/activity-clubs/${moment.target_id}`;
  if(moment.target_type==="event") return `/events/${moment.target_id}`;
  if(moment.target_type==="public_place") return `/places/${moment.target_id}`;
  return null;
}

function storagePath(url){
  const marker="/storage/v1/object/public/social-media/";
  const index=String(url || "").indexOf(marker);
  if(index<0) return null;
  return decodeURIComponent(String(url).slice(index+marker.length));
}

function dateLabel(value){
  if(!value) return "";
  return new Date(value).toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"});
}

export default function MomentDetail(){
  const params=useLocalSearchParams();
  const momentId=Array.isArray(params.id) ? params.id[0] : params.id;
  const {showFeedback}=useFeedback();
  const [user,setUser]=useState(null);
  const [moment,setMoment]=useState(null);
  const [profile,setProfile]=useState(null);
  const [likeCount,setLikeCount]=useState(0);
  const [viewerLiked,setViewerLiked]=useState(false);
  const [loading,setLoading]=useState(true);
  const [working,setWorking]=useState(false);
  const [error,setError]=useState("");
  const [confirmDelete,setConfirmDelete]=useState(false);
  const [showReport,setShowReport]=useState(false);
  const [reportReason,setReportReason]=useState("inappropriate");

  const load=useCallback(async()=>{
    if(!momentId){setError("Moment not found.");setLoading(false);return;}
    setLoading(true);
    setError("");

    const {data:{user:currentUser}}=await supabase.auth.getUser();
    setUser(currentUser || null);

    const {data:momentRow,error:momentError}=await supabase
      .from("explorer_moments")
      .select("*")
      .eq("id",momentId)
      .maybeSingle();

    if(momentError || !momentRow || momentRow.status!=="published"){
      setError("This Moment is unavailable.");
      setMoment(null);
      setLoading(false);
      return;
    }

    const [profileResult,countResult]=await Promise.all([
      supabase.from("profiles").select("id,full_name,profile_photo,area,show_area").eq("id",momentRow.user_id).maybeSingle(),
      supabase.from("social_likes").select("id",{count:"exact",head:true}).eq("target_type","moment").eq("target_id",momentId)
    ]);

    let liked=false;
    if(currentUser){
      const {data}=await supabase
        .from("social_likes")
        .select("id")
        .eq("user_id",currentUser.id)
        .eq("target_type","moment")
        .eq("target_id",momentId)
        .maybeSingle();
      liked=!!data;
    }

    setMoment(momentRow);
    setProfile(profileResult.data || null);
    setLikeCount(Number(countResult.count || 0));
    setViewerLiked(liked);
    setLoading(false);
  },[momentId]);

  useFocusEffect(useCallback(()=>{load();},[load]));

  async function deleteMoment(){
    if(working || !user || user.id!==moment?.user_id) return;
    setWorking(true);

    const {error:deleteError}=await supabase
      .from("explorer_moments")
      .delete()
      .eq("id",moment.id)
      .eq("user_id",user.id);

    if(deleteError){
      showFeedback(deleteError.message,"error","Moment not deleted");
      setWorking(false);
      return;
    }

    const path=storagePath(moment.media_url);
    if(path) await supabase.storage.from("social-media").remove([path]);

    showFeedback("The Moment and its interactions were removed.","success","Moment deleted");
    router.replace("/feed");
  }

  async function reportMoment(){
    if(working) return;
    if(!user){router.push("/auth/login");return;}
    if(user.id===moment?.user_id) return;

    setWorking(true);
    const {error:reportError}=await supabase
      .from("social_reports")
      .insert({
        reporter_id:user.id,
        target_type:"moment",
        target_id:moment.id,
        reason:reportReason,
        details:"",
        status:"open"
      });

    if(reportError){
      if(String(reportError.code)==="23505") showFeedback("You have already reported this Moment.","info","Already reported");
      else showFeedback(reportError.message,"error","Report not sent");
    }else{
      showFeedback("This Moment has been sent for review.","success","Report submitted");
    }

    setWorking(false);
    setShowReport(false);
  }

  if(loading){
    return <Screen style={styles.centre}><ActivityIndicator size="large" color={INK.readoutSoft}/></Screen>;
  }

  if(error || !moment){
    return(
      <Screen style={styles.centre}>
        <Empty glyph="warn" title="Moment unavailable" instruction={error}/>
      </Screen>
    );
  }

  const isOwner=!!user && user.id===moment.user_id;
  const route=listingRoute(moment);
  const isOfficial=moment.actor_type && moment.actor_type!=="explorer";

  return(
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Panel style={styles.card}>
          {/* THE HEAD READOUT. What this is and when, in the data face. */}
          <View style={styles.headRow}>
            <Text style={styles.headKind}>MOMENT</Text>
            <View style={styles.headLine}/>
            {moment.visibility==="friends" && (
              <View accessibilityLabel="Visible to friends only">
                <Chip label="Friends" glyph="lock"/>
              </View>
            )}
          </View>

          <Pressable
            style={styles.profileRow}
            accessibilityRole="button"
            accessibilityLabel={`Open ${profile?.full_name || "Explorer"}`}
            onPress={()=>router.push(`/profile/${moment.user_id}`)}
          >
            <Frame size={42} round style={styles.avatarFrame}>
              {profile?.profile_photo
                ? <Image source={{uri:profile.profile_photo}} style={styles.avatar}/>
                : <Text style={styles.avatarLetter}>{profile?.full_name?.charAt(0)?.toUpperCase() || "E"}</Text>}
            </Frame>
            <View style={styles.profileText}>
              {/* An official Moment says the listing's name first and the person
                  who published it second. user_id is still the author -- the
                  profile link below goes to them, not to the listing. */}
              <Text style={styles.name} numberOfLines={1}>
                {isOfficial ? moment.target_name || profile?.full_name || "Explorer" : profile?.full_name || "Explorer"}
              </Text>
              <Text style={styles.date} numberOfLines={1}>
                {isOfficial ? `OFFICIAL UPDATE · ${dateLabel(moment.created_at)}` : dateLabel(moment.created_at)}
              </Text>
            </View>
          </Pressable>

          {moment.media_type==="image" ? (
            <Frame style={styles.mediaFrame}>
              <SocialImage uri={moment.media_url} style={styles.media} resizeMode="cover"/>
            </Frame>
          ) : (
            <Pressable
              style={styles.videoWrap}
              accessibilityRole="button"
              accessibilityLabel="Play this video"
              onPress={()=>Linking.openURL(moment.media_url)}
            >
              <Frame style={styles.mediaFrame}>
                {moment.thumbnail_url || moment.target_image_url
                  ? <SocialImage uri={moment.thumbnail_url || moment.target_image_url} style={styles.media} resizeMode="cover"/>
                  : null}
              </Frame>
              <View style={styles.playDial}><Glyph name="play" size={22} colour={INK.readout} weight={1.4}/></View>
              <Text style={styles.duration}>{Math.ceil(Number(moment.duration_seconds || 0))}S</Text>
            </Pressable>
          )}

          {!!moment.caption && <Text style={styles.caption}>{moment.caption}</Text>}

          {!!moment.target_name && (
            <View style={styles.placeRow}>
              <Row
                glyph="pin"
                title={moment.target_name}
                sub="Attached place"
                onPress={route ? ()=>router.push(route) : undefined}
              />
            </View>
          )}

          <View style={styles.actions}>
            <LikeButton targetType="moment" targetId={moment.id} viewerId={user?.id || null} initialCount={likeCount} initialLiked={viewerLiked}/>
            {!isOwner && (
              <Action
                kind="quiet"
                glyph="flag"
                label="Report"
                style={styles.trailing}
                onPress={()=>setShowReport(current=>!current)}
              />
            )}
            {isOwner && (
              <Action
                kind="quiet"
                glyph="trash"
                label="Delete"
                style={styles.trailing}
                onPress={()=>setConfirmDelete(true)}
              />
            )}
          </View>

          {showReport && !isOwner && (
            <View style={styles.panelBlock}>
              <Text style={styles.panelTitle}>Why are you reporting this Moment?</Text>
              <View style={styles.reasonRow}>
                {REPORT_REASONS.map(reason=>(
                  <Chip
                    key={reason.key}
                    label={reason.label}
                    selected={reportReason===reason.key}
                    onPress={()=>setReportReason(reason.key)}
                  />
                ))}
              </View>
              <View style={styles.panelActions}>
                <Action kind="quiet" label="Cancel" style={styles.panelAction} onPress={()=>setShowReport(false)}/>
                <Action kind="danger" glyph="flag" label="Submit report" style={styles.panelAction} loading={working} disabled={working} onPress={reportMoment}/>
              </View>
            </View>
          )}

          {confirmDelete && isOwner && (
            <View style={styles.panelBlock}>
              <Notice tone="dispute" label="Delete this Moment?">
                Its likes and comments will also be removed. This cannot be undone.
              </Notice>
              <View style={styles.panelActions}>
                <Action kind="quiet" label="Keep Moment" style={styles.panelAction} onPress={()=>setConfirmDelete(false)}/>
                <Action kind="danger" glyph="trash" label="Delete permanently" style={styles.panelAction} loading={working} disabled={working} onPress={deleteMoment}/>
              </View>
            </View>
          )}
        </Panel>

        <CommentThread targetType="moment" targetId={moment.id} ownerId={moment.user_id}/>
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

  profileRow:{flexDirection:"row",alignItems:"center",marginBottom:13},
  avatarFrame:{backgroundColor:INK.inset},
  avatar:{width:42,height:42,borderRadius:SHAPE.radius.pill},
  avatarLetter:{color:INK.readoutSoft,fontWeight:"700",fontSize:17},
  profileText:{flex:1,marginLeft:11,minWidth:0},
  name:{color:INK.readout,fontSize:TYPE.display.sizes.sm,fontWeight:"600",letterSpacing:-0.2},
  date:{...MONO_META,color:INK.readoutFaint,fontSize:TYPE.data.sizes.sm,marginTop:4},

  // aspectRatio is Frame's own default sizing; a fixed height needs it out of
  // the way, and a key set to undefined is dropped by StyleSheet.flatten.
  mediaFrame:{height:400,alignSelf:"stretch",aspectRatio:undefined},
  media:{width:"100%",height:"100%"},
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

  caption:{color:INK.readout,fontSize:TYPE.body.sizes.lg,lineHeight:TYPE.body.sizes.lg*TYPE.body.lineHeight,marginTop:14},

  placeRow:{marginTop:14},

  actions:{flexDirection:"row",alignItems:"center",gap:9,marginTop:14,paddingTop:12,borderTopWidth:SHAPE.border,borderTopColor:INK.hairline},
  trailing:{marginLeft:"auto"},

  panelBlock:{marginTop:14,paddingTop:12,borderTopWidth:SHAPE.border,borderTopColor:INK.hairline},
  panelTitle:{color:INK.readout,fontSize:TYPE.body.sizes.md,lineHeight:TYPE.body.sizes.md*TYPE.body.lineHeight},
  reasonRow:{flexDirection:"row",flexWrap:"wrap",gap:6,marginTop:10},
  panelActions:{flexDirection:"row",justifyContent:"flex-end",gap:8,marginTop:13},
  panelAction:{minWidth:120}
});

import React,{useCallback,useState} from "react";
import {ActivityIndicator,Alert,Image,Pressable,ScrollView,StyleSheet,Switch,Text,View} from "react-native";
import SocialImage from "../../components/SocialImage";
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {supabase} from "../../services/supabase";
import {useFeedback} from "../../context/FeedbackContext";
import {ARCHIVE_VISIBILITY,currentAudience,isLive,phaseLabel,visibilityLabel,MEMORY_VISIBILITY} from "../../utils/memories";
import {entityRoute,entityTypeLabel} from "../../utils/places";
import LikeButton from "../../components/LikeButton";
import CommentThread from "../../components/CommentThread";
import {INK} from "../../utils/tokens";

// Packet 8d: one Memory, and the controls only its owner gets.
//
// What a visitor sees here is decided before this screen runs. The read policy
// picks `visibility` while the Memory is live and `archive_visibility` after,
// so a friend who could read it yesterday genuinely cannot today if the
// creator left the archive closed -- there is no client-side branch doing that
// work, and removing this screen would not change who can read the row.

export default function MemoryPage(){
  const params=useLocalSearchParams();
  const memoryId=Array.isArray(params.id) ? params.id[0] : params.id;
  const {showFeedback}=useFeedback();

  const [memory,setMemory]=useState(null);
  const [viewer,setViewer]=useState(null);
  const [shares,setShares]=useState([]);
  const [candidates,setCandidates]=useState([]);
  const [loading,setLoading]=useState(true);
  const [working,setWorking]=useState(false);
  const [error,setError]=useState("");
  // Likes on this Memory. Read here rather than inside LikeButton so the count
  // is right on first paint instead of flicking up from zero.
  const [likes,setLikes]=useState({count:0,liked:false});

  const load=useCallback(async()=>{
    if(!memoryId) return;
    setLoading(true);
    setError("");

    const {data:{user}}=await supabase.auth.getUser();
    setViewer(user || null);

    const {data,error:memoryError}=await supabase
      .from("explorer_memories")
      .select("*")
      .eq("id",memoryId)
      .maybeSingle();

    if(memoryError || !data){
      setError("This Memory is unavailable, or is not shared with you.");
      setMemory(null);
      setLoading(false);
      return;
    }

    setMemory(data);

    // A Memory could not be liked or commented on at all until
    // 20260812160000 -- it was the one piece of content in the app nobody
    // could say anything back to.
    const {data:likeRows}=await supabase
      .from("social_likes")
      .select("user_id")
      .eq("target_type","memory")
      .eq("target_id",memoryId);

    setLikes({
      count:(likeRows || []).length,
      liked:!!user && (likeRows || []).some((row)=>row.user_id===user.id)
    });

    if(user && user.id===data.user_id){
      const [shareResult,followResult]=await Promise.all([
        supabase.from("explorer_memory_shares").select("user_id").eq("memory_id",memoryId),
        supabase.from("explorer_follows").select("following_id").eq("follower_id",user.id).limit(50)
      ]);

      const shared=(shareResult.data || []).map((row)=>row.user_id);
      setShares(shared);

      const ids=(followResult.data || []).map((row)=>row.following_id);
      if(ids.length){
        const {data:people}=await supabase.from("profiles").select("id,full_name").in("id",ids);
        setCandidates(people || []);
      }else{
        setCandidates([]);
      }
    }

    setLoading(false);
  },[memoryId]);

  useFocusEffect(useCallback(()=>{load();},[load]));

  const isOwner=!!viewer && !!memory && viewer.id===memory.user_id;

  async function setArchiveVisibility(value){
    if(working || !isOwner) return;
    setWorking(true);

    const {data,error:updateError}=await supabase
      .from("explorer_memories")
      .update({archive_visibility:value})
      .eq("id",memory.id)
      .eq("user_id",viewer.id)
      .select("id");

    setWorking(false);

    if(updateError){
      showFeedback(updateError.message,"error","Could not change the archive");
      return;
    }

    if(!data || !data.length){
      showFeedback("The database refused the change.","error","Nothing was changed");
      return;
    }

    showFeedback(
      value==="nobody"
        ? "Once the live period ends, only you will see it."
        : `Afterwards it stays visible to ${visibilityLabel(ARCHIVE_VISIBILITY,value)}.`,
      "success",
      "Archive updated"
    );
    await load();
  }

  async function toggleProfile(value){
    if(working || !isOwner) return;
    setWorking(true);

    const {data,error:updateError}=await supabase
      .from("explorer_memories")
      .update({show_on_profile:value})
      .eq("id",memory.id)
      .eq("user_id",viewer.id)
      .select("id");

    setWorking(false);

    if(updateError || !data || !data.length){
      showFeedback(updateError?.message || "The database refused the change.","error","Nothing was changed");
      return;
    }

    showFeedback(
      value
        ? "It will appear on your profile to anyone already allowed to see it."
        : "It no longer appears on your profile.",
      "success",
      "Profile updated"
    );
    await load();
  }

  async function toggleShare(personId,shared){
    if(working || !isOwner) return;
    setWorking(true);

    const request=shared
      ? supabase.from("explorer_memory_shares").delete().eq("memory_id",memory.id).eq("user_id",personId)
      : supabase.from("explorer_memory_shares").insert({memory_id:memory.id,user_id:personId});

    const {error:shareError}=await request;
    setWorking(false);

    if(shareError){
      showFeedback(shareError.message,"error","Could not change who can see it");
      return;
    }

    showFeedback(shared ? "They can no longer see this Memory." : "They can see this Memory.","success","Sharing updated");
    await load();
  }

  function confirmDelete(){
    Alert.alert(
      "Delete this Memory?",
      "It will be gone for good, including from your own map. This cannot be undone.",
      [
        {text:"Keep it",style:"cancel"},
        {text:"Delete",style:"destructive",onPress:remove}
      ]
    );
  }

  async function remove(){
    if(working || !isOwner) return;
    setWorking(true);

    const {data,error:deleteError}=await supabase
      .from("explorer_memories")
      .delete()
      .eq("id",memory.id)
      .eq("user_id",viewer.id)
      .select("id");

    setWorking(false);

    if(deleteError || !data || !data.length){
      showFeedback(deleteError?.message || "The database refused the deletion.","error","Nothing was deleted");
      return;
    }

    showFeedback("The Memory has been deleted.","success","Deleted");
    router.replace("/profile");
  }

  if(loading){
    return(
      <View style={styles.centre}>
        <ActivityIndicator size="large" color={INK.ink}/>
      </View>
    );
  }

  if(error || !memory){
    return(
      <View style={styles.centre}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  const live=isLive(memory);
  const route=entityRoute(memory.target_type,memory.target_id);

  return(
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {!!memory.media_url && <SocialImage uri={memory.media_url} style={styles.photo}/>}

      <View style={styles.card}>
        <Text style={styles.phase}>{phaseLabel(memory)}</Text>
        {!!memory.title && <Text style={styles.title}>{memory.title}</Text>}
        {!!memory.note && <Text style={styles.note}>{memory.note}</Text>}

        {!!memory.target_name && (
          <Pressable
            style={styles.placeRow}
            disabled={!route}
            accessibilityRole="button"
            accessibilityLabel={`Open ${memory.target_name}`}
            onPress={()=>route && router.push(route)}
          >
            <Text style={styles.placeLabel}>{entityTypeLabel(memory.target_type).toUpperCase()}</Text>
            <Text style={styles.placeName}>{memory.target_name}</Text>
          </Pressable>
        )}

        <View style={styles.audienceRow}>
          <Text style={styles.audienceLabel}>WHO CAN SEE IT NOW</Text>
          <Text style={styles.audienceValue}>{currentAudience(memory)}</Text>
        </View>
      </View>

      {/*
        LIKE, not Useful. Useful is an endorsement of a review -- it says "this
        helped me decide" and it pays the reviewer a point. A Memory is
        somebody's day out; liking it says you liked seeing it and means nothing
        else. Same table, two words, because they are two different acts.

        Anybody who can read this screen can respond on it. Who that is was
        decided before this screen ran, by the read policy and by
        can_see_content -- there is no client-side branch here deciding who may
        speak, and the database refuses a like or a comment on a Memory the
        viewer was never shown.
      */}
      <View style={styles.respond}>
        <LikeButton
          targetType="memory"
          targetId={memory.id}
          viewerId={viewer?.id || null}
          initialCount={likes.count}
          initialLiked={likes.liked}
          onChanged={(next)=>setLikes({count:next.count,liked:next.liked})}
        />
      </View>

      <CommentThread
        targetType="memory"
        targetId={memory.id}
        ownerId={memory.user_id}
      />

      {isOwner && (
        <>
          <Text style={styles.sectionTitle}>While it is live</Text>
          <View style={styles.card}>
            <Text style={styles.settingValue}>{visibilityLabel(MEMORY_VISIBILITY,memory.visibility)}</Text>
            <Text style={styles.settingHint}>
              {live
                ? "This is the setting in force right now."
                : "The live period has ended, so this no longer decides anything."}
            </Text>
          </View>

          <Text style={styles.sectionTitle}>Afterwards</Text>
          <Text style={styles.settingHint}>
            Changing this never puts the Memory back on the live map. It only decides who can still open it in your archive.
          </Text>
          {ARCHIVE_VISIBILITY.map((option)=>(
            <Pressable
              key={option.key}
              style={[styles.option,memory.archive_visibility===option.key && styles.optionActive]}
              disabled={working}
              accessibilityRole="button"
              accessibilityLabel={`Afterwards, ${option.label}`}
              onPress={()=>setArchiveVisibility(option.key)}
            >
              <Text style={styles.optionTitle}>{option.label}</Text>
              <Text style={styles.optionHint}>{option.hint}</Text>
            </Pressable>
          ))}

          {(memory.visibility==="selected" || memory.archive_visibility==="selected") && (
            <>
              <Text style={styles.sectionTitle}>Chosen Explorers</Text>
              {!candidates.length ? (
                <View style={styles.card}>
                  <Text style={styles.settingHint}>Follow some Explorers and they can be chosen here.</Text>
                </View>
              ) : candidates.map((person)=>{
                const shared=shares.includes(person.id);
                return(
                  <Pressable
                    key={person.id}
                    style={[styles.option,shared && styles.optionActive]}
                    disabled={working}
                    accessibilityRole="button"
                    accessibilityLabel={`${shared ? "Stop sharing with" : "Share with"} ${person.full_name || "Explorer"}`}
                    onPress={()=>toggleShare(person.id,shared)}
                  >
                    <Text style={styles.optionTitle}>{person.full_name || "Explorer"}</Text>
                    <Text style={styles.optionHint}>{shared ? "Can see this Memory" : "Cannot see it"}</Text>
                  </Pressable>
                );
              })}
            </>
          )}

          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <Text style={styles.optionTitle}>Show on my profile</Text>
              <Text style={styles.optionHint}>
                Only to people already allowed to see it. It never makes a private Memory public.
              </Text>
            </View>
            <Switch
              value={!!memory.show_on_profile}
              onValueChange={toggleProfile}
              disabled={working}
              accessibilityLabel="Show this Memory on my profile"
            />
          </View>

          <Pressable
            style={styles.destructive}
            disabled={working}
            accessibilityRole="button"
            accessibilityLabel="Delete this Memory"
            onPress={confirmDelete}
          >
            <Text style={styles.destructiveText}>Delete this Memory</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const card={backgroundColor:INK.card,borderWidth:2,borderColor:INK.ink,borderRadius:12,shadowColor:INK.ink,shadowOffset:{width:3,height:3},shadowOpacity:1,shadowRadius:0,elevation:2};

const styles=StyleSheet.create({
  respond:{marginTop:12,flexDirection:"row"},
  screen:{flex:1,backgroundColor:INK.paper},
  content:{padding:16,paddingBottom:60},
  centre:{flex:1,backgroundColor:INK.paper,alignItems:"center",justifyContent:"center",padding:28},
  errorText:{color:INK.ink,fontSize:17,textAlign:"center",lineHeight:24},
  photo:{width:"100%",height:230,borderRadius:12,borderWidth:2,borderColor:INK.ink,marginBottom:14},
  card:{...card,padding:16,marginBottom:12},
  phase:{color:INK.inkSoft,fontSize:10,fontWeight:"800",letterSpacing:1},
  title:{color:INK.ink,fontSize:25,fontWeight:"800",marginTop:7,letterSpacing:-0.4},
  note:{color:INK.ink,fontSize:15,lineHeight:22,marginTop:10},
  placeRow:{borderTopWidth:1,borderTopColor:INK.hair,paddingTop:12,marginTop:14},
  placeLabel:{color:INK.inkSoft,fontSize:10,fontWeight:"800",letterSpacing:1},
  placeName:{color:INK.ink,fontSize:16,fontWeight:"800",marginTop:4},
  audienceRow:{borderTopWidth:1,borderTopColor:INK.hair,paddingTop:12,marginTop:14},
  audienceLabel:{color:INK.inkSoft,fontSize:10,fontWeight:"800",letterSpacing:1},
  audienceValue:{color:INK.ink,fontSize:16,fontWeight:"800",marginTop:4},
  sectionTitle:{color:INK.ink,fontSize:20,fontWeight:"800",marginTop:20,marginBottom:8},
  settingValue:{color:INK.ink,fontSize:16,fontWeight:"800"},
  settingHint:{color:INK.inkSoft,fontSize:12,lineHeight:18,marginTop:5},
  option:{...card,padding:13,marginBottom:8},
  optionActive:{backgroundColor:INK.hair},
  optionTitle:{color:INK.ink,fontWeight:"800"},
  optionHint:{color:INK.ink,fontSize:12,lineHeight:17,marginTop:3},
  switchRow:{...card,padding:13,marginTop:16,flexDirection:"row",alignItems:"center",gap:12},
  switchText:{flex:1},
  destructive:{minHeight:50,justifyContent:"center",alignItems:"center",borderWidth:2,borderColor:INK.ink,borderRadius:12,marginTop:22},
  destructiveText:{color:INK.ink,fontWeight:"800"}
});

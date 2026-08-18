import React,{useCallback,useState} from "react";
import {ActivityIndicator,Alert,Pressable,ScrollView,StyleSheet,Switch,Text,View} from "react-native";
import SocialImage from "../../components/SocialImage";
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {supabase} from "../../services/supabase";
import {useFeedback} from "../../context/FeedbackContext";
import {ARCHIVE_VISIBILITY,currentAudience,isLive,phaseLabel,visibilityLabel,MEMORY_VISIBILITY} from "../../utils/memories";
import {entityRoute,entityTypeLabel} from "../../utils/places";
import LikeButton from "../../components/LikeButton";
import CommentThread from "../../components/CommentThread";
import {CREATE_HUB_CLEARANCE} from "../../components/CreateHub";
import {INK,TYPE,SHAPE} from "../../utils/tokens";
import {Action,Chip,Empty,Frame,KeyValue,Notice,Panel,Row,Screen,ScreenTitle,SectionRule} from "../../components/instrument";

// Packet 8d: one Memory, and the controls only its owner gets.
//
// What a visitor sees here is decided before this screen runs. The read policy
// picks `visibility` while the Memory is live and `archive_visibility` after,
// so a friend who could read it yesterday genuinely cannot today if the
// creator left the archive closed -- there is no client-side branch doing that
// work, and removing this screen would not change who can read the row.
//
// WHAT THE REBUILD CHANGED
//
// Nothing about who can see what. The photograph moved into a Frame, the two
// audience answers became KeyValue readouts, and the archive settings became
// Rows that mark their choice by stepping up a surface rather than filling with
// a colour -- because who can see a Memory is not a state a PLACE is in, and
// spending the map's inks on it made a privacy control look like a pin.

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
    return <Screen style={styles.centre}><ActivityIndicator size="large" color={INK.readoutSoft}/></Screen>;
  }

  if(error || !memory){
    return(
      <Screen style={styles.centre}>
        <Empty glyph="warn" title="Memory unavailable" instruction={error}/>
      </Screen>
    );
  }

  const live=isLive(memory);
  const route=entityRoute(memory.target_type,memory.target_id);

  return(
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.body}>
        {!!memory.media_url && (
          <Frame style={styles.photoFrame}>
            <SocialImage uri={memory.media_url} style={styles.photo} resizeMode="cover"/>
          </Frame>
        )}
        </View>

        <ScreenTitle
          eyebrow="MEMORY"
          title={memory.title || "A Memory"}
          right={<Chip label={phaseLabel(memory)}/>}
        />

        <View style={styles.body}>
        {!!memory.note && <Text style={styles.note}>{memory.note}</Text>}

        {!!memory.target_name && (
          <View style={styles.placeRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open ${memory.target_name}`}
              disabled={!route}
              onPress={()=>route && router.push(route)}
            >
              <Row
                glyph="pin"
                title={memory.target_name}
                meta={entityTypeLabel(memory.target_type).toUpperCase()}
              />
            </Pressable>
          </View>
        )}

        <Panel style={styles.audiencePlate}>
          <KeyValue label="WHO CAN SEE IT NOW" value={currentAudience(memory)}/>
        </Panel>

        {/*
          LIKE, not an endorsement. An endorsement belongs to a review -- it says
          "this helped me decide" and it pays the reviewer a point. A Memory is
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
            <SectionRule label="While it is live"/>
            <Panel style={styles.settingPlate}>
              <KeyValue label="Audience" value={visibilityLabel(MEMORY_VISIBILITY,memory.visibility)}/>
            </Panel>
            <Text style={styles.hint}>
              {live
                ? "This is the setting in force right now."
                : "The live period has ended, so this no longer decides anything."}
            </Text>

            <SectionRule label="Afterwards"/>
            <Text style={styles.hint}>
              Changing this never puts the Memory back on the live map. It only decides who can still open it in your archive.
            </Text>
            <View style={styles.optionList}>
              {ARCHIVE_VISIBILITY.map((option)=>{
                const chosen=memory.archive_visibility===option.key;
                return(
                  <Pressable
                    key={option.key}
                    disabled={working}
                    accessibilityRole="button"
                    accessibilityState={{selected:chosen}}
                    accessibilityLabel={`Afterwards, ${option.label}`}
                    onPress={()=>setArchiveVisibility(option.key)}
                  >
                    <Row
                      title={option.label}
                      sub={option.hint}
                      style={chosen && styles.optionOn}
                      right={chosen ? <Chip label="Chosen"/> : null}
                    />
                  </Pressable>
                );
              })}
            </View>

            {(memory.visibility==="selected" || memory.archive_visibility==="selected") && (
              <>
                <SectionRule label="Chosen Explorers" meta={String(shares.length)}/>
                {!candidates.length ? (
                  <Empty
                    glyph="people"
                    title="Nobody to choose yet"
                    instruction="Follow some Explorers and they can be chosen here."
                  />
                ) : (
                  <View style={styles.optionList}>
                    {candidates.map((person)=>{
                      const shared=shares.includes(person.id);
                      return(
                        <Pressable
                          key={person.id}
                          disabled={working}
                          accessibilityRole="button"
                          accessibilityState={{selected:shared}}
                          accessibilityLabel={`${shared ? "Stop sharing with" : "Share with"} ${person.full_name || "Explorer"}`}
                          onPress={()=>toggleShare(person.id,shared)}
                        >
                          <Row
                            title={person.full_name || "Explorer"}
                            sub={shared ? "Can see this Memory" : "Cannot see it"}
                            style={shared && styles.optionOn}
                            right={shared ? <Chip label="Shared"/> : null}
                          />
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </>
            )}

            <Panel style={styles.switchRow}>
              <View style={styles.switchText}>
                <Text style={styles.switchTitle}>Show on my profile</Text>
                <Text style={styles.hint}>
                  Only to people already allowed to see it. It never makes a private Memory public.
                </Text>
              </View>
              <Switch
                value={!!memory.show_on_profile}
                onValueChange={toggleProfile}
                disabled={working}
                trackColor={{false:INK.hairline,true:INK.exists}}
                thumbColor={INK.readout}
                accessibilityLabel="Show this Memory on my profile"
              />
            </Panel>

            <Notice tone="dispute" label="Permanent">
              Deleting a Memory removes it everywhere, including from your own map. Its map window ending would not have done that.
            </Notice>

            <Action
              kind="danger"
              glyph="trash"
              label="Delete this Memory"
              accessibilityLabel="Delete this Memory"
              disabled={working}
              style={styles.destructive}
              onPress={confirmDelete}
            />
          </>
        )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles=StyleSheet.create({
  // ScreenTitle carries its own horizontal gutter, so the scroll container does
  // not -- everything around it gets the gutter from `body` instead.
  content:{paddingTop:14,paddingBottom:24+CREATE_HUB_CLEARANCE},
  body:{paddingHorizontal:16},
  centre:{alignItems:"center",justifyContent:"center",paddingHorizontal:24},

  // aspectRatio is Frame's own default sizing; a fixed height needs it out of
  // the way, and a key set to undefined is dropped by StyleSheet.flatten.
  photoFrame:{height:240,alignSelf:"stretch",aspectRatio:undefined},
  photo:{width:"100%",height:"100%"},

  note:{
    color:INK.readout,fontSize:TYPE.body.sizes.lg,
    lineHeight:TYPE.body.sizes.lg*TYPE.body.lineHeight,marginTop:12
  },

  placeRow:{marginTop:14},
  audiencePlate:{paddingHorizontal:13,paddingVertical:2,marginTop:6},
  settingPlate:{paddingHorizontal:13,paddingVertical:2},

  respond:{marginTop:14,marginBottom:6,flexDirection:"row"},

  hint:{
    color:INK.readoutSoft,fontSize:TYPE.body.sizes.sm,
    lineHeight:TYPE.body.sizes.sm*TYPE.body.lineHeight,marginTop:7
  },

  optionList:{marginTop:10},
  // Chosen is a step up the surface and a stronger edge, never a fill.
  optionOn:{backgroundColor:INK.panelRaised,borderColor:INK.hairlineStrong},

  switchRow:{padding:13,marginTop:16,flexDirection:"row",alignItems:"center",gap:12},
  switchText:{flex:1},
  switchTitle:{color:INK.readout,fontSize:TYPE.display.sizes.sm,fontWeight:"600",letterSpacing:-0.2},

  destructive:{marginTop:8,marginBottom:8,borderRadius:SHAPE.radius.control}
});

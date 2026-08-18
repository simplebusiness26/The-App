import React,{useCallback,useEffect,useMemo,useState} from "react";
import {View,Text,StyleSheet,ScrollView,ActivityIndicator,RefreshControl} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../services/supabase";
import {useNotifications} from "../context/NotificationContext";
import {useFeedback} from "../context/FeedbackContext";
import {CREATE_HUB_CLEARANCE} from "../components/CreateHub";
import {INK,TYPE} from "../utils/tokens";
import {Action,Chip,Empty,MONO,Row,Screen,ScreenTitle,Segmented} from "../components/instrument";

// Everything the app wants to tell you, in one place.
//
// A notification is a reading: the app noticed something and is reporting it.
// So each one is a Row -- glyph well on the left, the sentence in the body
// face, when it happened in mono down the right -- and an unread one carries a
// `scheduled` state edge, because unread means "this is still live for you".
// Read ones drop the edge and keep the panel.
//
// THE ICONS WERE EMOJI, AND THAT MATTERED MORE HERE THAN ANYWHERE. This screen
// drew fourteen different emoji -- a handshake, a door, a speech bubble, an
// alarm clock, a satellite dish, a sparkle, a heart, a waving hand, a tick, a
// bell -- each
// in whichever font the phone happened to supply, each carrying its own colour
// and weight. On a dark instrument face they read as stickers stuck to the
// housing. They are all Glyphs off the same 16x16 grid now, so a notification
// looks like it came from the same machine as the rest of the app.

function isPastUpdate(item){
  return item?.data?.past_update===true || item?.data?.past_update==="true";
}

function categoryFor(item){
  if(String(item?.type || "").startsWith("linkup_") || item?.entity_type==="linkup") return "live";
  if(item?.data?.category==="social" || String(item?.type || "").startsWith("social_")) return "social";
  if(String(item?.type || "").startsWith("activity_") || item?.entity_type==="activity_club") return "clubs";
  return "account";
}

function getEventStatus(item){
  return item?.data?.status || (
    item.type==="activity_join_request" ? "pending" :
    item.type==="activity_membership_approved" ? "approved" :
    item.type==="activity_membership_rejected" ? "rejected" :
    item.type==="activity_membership_removed" ? "removed" :
    item.type==="activity_membership_left" ? "left" : null
  );
}

function getMembershipStatus(item){
  if(isPastUpdate(item)) return getEventStatus(item);
  return item?.data?.current_status || getEventStatus(item);
}

function getStatusLabel(item){
  if(categoryFor(item)!=="clubs") return null;
  const status=getMembershipStatus(item);
  let label=null;
  if(status==="pending") label="Needs action";
  if(status==="approved") label="Approved";
  if(status==="rejected") label="Rejected";
  if(status==="removed") label="Membership ended";
  if(status==="left") label="Left club";
  if(!label) return null;
  return isPastUpdate(item) ? `Past update · ${label}` : label;
}

function getDisplayTitle(item){
  if(!isPastUpdate(item)) return item.title;
  return String(item.title || "Update").replace(/^Past update:\s*/i,"");
}

// One glyph per kind of thing that happened, all off the kit's 16x16 grid.
function notificationGlyph(item){
  if(item.type==="linkup_joined") return "people";
  if(item.type==="linkup_left" || item.type==="linkup_removed") return "external";
  if(item.type==="linkup_full") return "people";
  if(item.type==="linkup_message" || item.type==="linkup_announcement") return "comment";
  if(item.type==="linkup_updated") return "edit";
  if(item.type==="linkup_cancelled") return "close";
  if(item.type==="linkup_reminder") return "clock";
  if(item.type==="linkup_follower_created") return "live";
  if(item.type==="social_follow") return "person";
  if(item.type==="social_moment") return "camera";
  if(item.type==="social_like") return "heart";
  if(item.type==="social_comment") return "comment";

  const status=getMembershipStatus(item);
  if(status==="pending") return "flag";
  if(status==="approved") return "check";
  if(status==="rejected") return "close";
  if(status==="removed" || status==="left") return "external";
  return "bell";
}

function formatTime(value){
  if(!value) return "";
  const date=new Date(value);
  const now=new Date();
  const minutes=Math.floor(Math.max(0,now.getTime()-date.getTime())/60000);
  if(minutes<1) return "Just now";
  if(minutes<60) return `${minutes}m ago`;
  const hours=Math.floor(minutes/60);
  if(hours<24) return `${hours}h ago`;
  return date.toLocaleDateString([],{day:"numeric",month:"short",year:date.getFullYear()===now.getFullYear()?undefined:"numeric"});
}

const CATEGORIES=[
  {key:"all",label:"All"},
  {key:"live",label:"Live"},
  {key:"social",label:"Social"},
  {key:"clubs",label:"Clubs"},
  {key:"account",label:"Account"}
];

export default function Notifications(){
  const {userId,refreshUnread}=useNotifications();
  const {showFeedback}=useFeedback();
  const [items,setItems]=useState([]);
  const [activeCategory,setActiveCategory]=useState("all");
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [workingId,setWorkingId]=useState(null);

  const loadNotifications=useCallback(async(showLoader=true)=>{
    if(!userId){setItems([]);setLoading(false);setRefreshing(false);return;}
    if(showLoader) setLoading(true);
    const {data,error}=await supabase.from("notifications").select("*").eq("recipient_user_id",userId).order("created_at",{ascending:false}).limit(150);
    if(error){console.log(error);showFeedback(error.message,"error","Notifications not loaded");}
    else setItems(data || []);
    setLoading(false);
    setRefreshing(false);
  },[userId,showFeedback]);

  useFocusEffect(useCallback(()=>{loadNotifications();},[loadNotifications]));

  useEffect(()=>{
    if(!userId) return;
    const channel=supabase.channel(`notification-centre-${userId}`).on("postgres_changes",{event:"*",schema:"public",table:"notifications",filter:`recipient_user_id=eq.${userId}`},()=>loadNotifications(false)).subscribe();
    return()=>{supabase.removeChannel(channel);};
  },[userId,loadNotifications]);

  const counts=useMemo(()=>{
    const result={all:items.length,live:0,social:0,clubs:0,account:0};
    items.forEach(item=>{result[categoryFor(item)]+=1;});
    return result;
  },[items]);

  const filteredItems=useMemo(()=>{
    if(activeCategory==="all") return items;
    return items.filter(item=>categoryFor(item)===activeCategory);
  },[items,activeCategory]);

  async function markRead(notification){
    if(notification.read_at) return true;
    setWorkingId(notification.id);
    const readAt=new Date().toISOString();
    const {error}=await supabase.from("notifications").update({read_at:readAt}).eq("id",notification.id);
    setWorkingId(null);
    if(error){showFeedback(error.message,"error","Notification not updated");return false;}
    setItems(current=>current.map(item=>item.id===notification.id?{...item,read_at:readAt}:item));
    await refreshUnread();
    return true;
  }

  async function openNotification(notification){
    if(!await markRead(notification)) return;
    const destination=notification.deep_link?.trim();
    if(destination && destination!=="/notifications") router.push(destination);
  }

  async function markAllRead(){
    if(!userId || !items.some(item=>!item.read_at)) return;
    setWorkingId("all");
    const readAt=new Date().toISOString();
    const {error}=await supabase.from("notifications").update({read_at:readAt}).eq("recipient_user_id",userId).is("read_at",null);
    setWorkingId(null);
    if(error){showFeedback(error.message,"error","Notifications not updated");return;}
    setItems(current=>current.map(item=>item.read_at?item:{...item,read_at:readAt}));
    await refreshUnread();
    showFeedback("All notifications have been marked as read.","success","Notifications updated");
  }

  function refresh(){setRefreshing(true);loadNotifications(false);refreshUnread();}

  if(!userId && !loading){
    return(
      <Screen>
        <View style={styles.gate}>
          <Empty
            glyph="bell"
            title="Log in to see notifications"
            instruction="Live plans, social activity, club updates and account alerts all land here once you are signed in."
            action={<Action kind="primary" glyph="key" label="Log in" onPress={()=>router.push("/auth/login")}/>}
          />
        </View>
      </Screen>
    );
  }

  const unread=items.some(item=>!item.read_at);

  return(
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={INK.readoutSoft}/>}
      >
        <ScreenTitle
          eyebrow="NOTIFICATION CENTRE"
          title="Notifications"
          meta="Live plans, social activity, club updates and account alerts in one place."
          right={unread ? (
            <Action
              kind="quiet"
              glyph="check"
              label={workingId==="all" ? "Updating" : "Mark all read"}
              disabled={workingId==="all"}
              onPress={markAllRead}
            />
          ) : null}
        />

        <View style={styles.tabs}>
          <Segmented
            scroll
            items={CATEGORIES.map(tab=>({key:tab.key,label:`${tab.label} ${counts[tab.key]}`}))}
            active={activeCategory}
            onChange={setActiveCategory}
          />
        </View>

        <View style={styles.body}>
        {loading && <ActivityIndicator size="large" color={INK.readoutSoft} style={styles.loader}/>}

        {!loading && filteredItems.length===0 && (
          <Empty
            glyph="bell"
            title={`No ${activeCategory==="all" ? "notifications" : activeCategory+" notifications"} yet`}
            instruction="New updates will appear here."
          />
        )}

        {!loading && filteredItems.map(item=>{
          const category=categoryFor(item);
          const label=getStatusLabel(item);
          const pastUpdate=isPastUpdate(item);
          const isUnread=!pastUpdate && !item.read_at;
          return(
            <Row
              key={item.id}
              // Unread is a live reading, so it gets the edge. Read ones keep
              // the panel and lose it -- the edge is the whole signal, and a
              // second one (a coloured card, a coloured border) would just be
              // the same fact said twice.
              tone={isUnread ? "scheduled" : undefined}
              glyph={notificationGlyph(item)}
              title={getDisplayTitle(item)}
              sub={item.message}
              meta={formatTime(item.created_at).toUpperCase()}
              metaSub={category.toUpperCase()}
              onPress={()=>openNotification(item)}
              style={workingId===item.id && styles.working}
            >
              {!!label && (
                <View style={styles.badgeRow}>
                  <Chip label={label} tone={category==="clubs" ? "exists" : undefined}/>
                </View>
              )}
              {pastUpdate && <Text style={styles.pastNote}>This is a record of something that already happened.</Text>}
            </Row>
          );
        })}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles=StyleSheet.create({
  // ScreenTitle and Segmented both carry their own horizontal gutter, so the
  // scroll container does not -- everything else gets it from `body`.
  content:{paddingBottom:24+CREATE_HUB_CLEARANCE},
  body:{paddingHorizontal:16},
  gate:{flex:1,justifyContent:"center",paddingHorizontal:16},
  tabs:{marginTop:6,marginBottom:8},
  loader:{marginTop:50},
  working:{opacity:0.6},
  badgeRow:{flexDirection:"row",flexWrap:"wrap",gap:6,marginTop:8},
  pastNote:{
    color:INK.readoutFaint,fontFamily:MONO,fontSize:TYPE.data.sizes.sm,
    letterSpacing:0.9,textTransform:"uppercase",marginTop:7
  }
});

import React,{useCallback,useEffect,useMemo,useState} from "react";
import {View,Text,StyleSheet,ScrollView,Pressable,ActivityIndicator,RefreshControl} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../services/supabase";
import {useNotifications} from "../context/NotificationContext";
import {useFeedback} from "../context/FeedbackContext";
import {INK} from "../utils/tokens";

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

function notificationIcon(item){
  if(item.type==="linkup_joined") return "🤝";
  if(item.type==="linkup_left" || item.type==="linkup_removed") return "🚪";
  if(item.type==="linkup_full") return "👥";
  if(item.type==="linkup_message" || item.type==="linkup_announcement") return "💬";
  if(item.type==="linkup_updated") return "📝";
  if(item.type==="linkup_cancelled") return "✕";
  if(item.type==="linkup_reminder") return "⏰";
  if(item.type==="linkup_follower_created") return "📡";
  if(item.type==="social_follow") return "👤";
  if(item.type==="social_moment") return "✨";
  if(item.type==="social_like") return "♥";
  if(item.type==="social_comment") return "💬";

  const status=getMembershipStatus(item);
  if(status==="pending") return "👋";
  if(status==="approved") return "✅";
  if(status==="rejected") return "✕";
  if(status==="removed" || status==="left") return "🚪";
  return "🔔";
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
    return <View style={styles.center}><Text style={styles.emptyIcon}>🔔</Text><Text style={styles.emptyTitle}>Log in to see notifications</Text><Pressable style={styles.primaryButton} onPress={()=>router.push("/auth/login")}><Text style={styles.primaryText}>Log in</Text></Pressable></View>;
  }

  return(
    <ScrollView style={styles.container} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh}/>}> 
      <View style={styles.headingRow}>
        <View style={styles.headingText}>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.subtitle}>Live plans, social activity, club updates and account alerts in one place.</Text>
        </View>
        {items.some(item=>!item.read_at) && <Pressable style={styles.markAllButton} disabled={workingId==="all"} onPress={markAllRead}><Text style={styles.markAllText}>{workingId==="all"?"Updating...":"Mark all read"}</Text></Pressable>}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {[
          {key:"all",label:"All"},
          {key:"live",label:"Live"},
          {key:"social",label:"Social"},
          {key:"clubs",label:"Clubs"},
          {key:"account",label:"Account"}
        ].map(tab=>(
          <Pressable key={tab.key} style={[styles.tab,activeCategory===tab.key && styles.activeTab]} onPress={()=>setActiveCategory(tab.key)}>
            <Text style={[styles.tabText,activeCategory===tab.key && styles.activeTabText]}>{tab.label}</Text>
            <View style={[styles.tabCount,activeCategory===tab.key && styles.activeTabCount]}><Text style={[styles.tabCountText,activeCategory===tab.key && styles.activeTabCountText]}>{counts[tab.key]}</Text></View>
          </Pressable>
        ))}
      </ScrollView>

      {loading && <ActivityIndicator size="large" style={styles.loader}/>} 
      {!loading && filteredItems.length===0 && <View style={styles.emptyCard}><Text style={styles.emptyIcon}>{activeCategory==="social"?"✨":activeCategory==="live"?"🤝":"🔔"}</Text><Text style={styles.emptyTitle}>No {activeCategory==="all"?"notifications":activeCategory+" notifications"} yet</Text><Text style={styles.emptyText}>New updates will appear here.</Text></View>}

      {!loading && filteredItems.map(item=>{
        const category=categoryFor(item);
        const status=getMembershipStatus(item);
        const label=getStatusLabel(item);
        const pastUpdate=isPastUpdate(item);
        return(
          <Pressable
            key={item.id}
            style={[
              styles.card,
              category==="live"&&styles.liveCard,
              category==="social"&&styles.socialCard,
              category==="account"&&styles.accountCard,
              !pastUpdate&&status==="approved"&&styles.approvedCard,
              !pastUpdate&&status==="rejected"&&styles.rejectedCard,
              !pastUpdate&&(status==="removed"||status==="left")&&styles.endedCard,
              pastUpdate&&status==="approved"&&styles.pastApprovedCard,
              pastUpdate&&status==="rejected"&&styles.pastRejectedCard,
              pastUpdate&&(status==="removed"||status==="left")&&styles.pastEndedCard,
              !pastUpdate&&!item.read_at&&styles.unreadCard,
              category==="social"&&!item.read_at&&styles.socialUnreadCard,
              category==="live"&&!item.read_at&&styles.liveUnreadCard
            ]}
            disabled={workingId===item.id}
            onPress={()=>openNotification(item)}
          >
            <View style={[styles.iconWrap,category==="social"&&styles.socialIconWrap,category==="live"&&styles.liveIconWrap,!pastUpdate&&!item.read_at&&styles.unreadIconWrap]}><Text style={styles.icon}>{notificationIcon(item)}</Text></View>
            <View style={styles.cardText}>
              <View style={styles.cardTop}><Text style={styles.cardTitle}>{getDisplayTitle(item)}</Text>{!pastUpdate&&!item.read_at&&<View style={styles.unreadDot}/>}</View>
              <Text style={[styles.categoryLabel,category==="social"&&styles.socialCategory,category==="live"&&styles.liveCategory]}>{category}</Text>
              {!!label && <Text style={[
                styles.statusBadge,
                !pastUpdate&&status==="pending"&&styles.pendingBadge,
                !pastUpdate&&status==="approved"&&styles.approvedBadge,
                !pastUpdate&&status==="rejected"&&styles.rejectedBadge,
                !pastUpdate&&(status==="removed"||status==="left")&&styles.endedBadge,
                pastUpdate&&status==="approved"&&styles.pastApprovedBadge,
                pastUpdate&&status==="rejected"&&styles.pastRejectedBadge,
                pastUpdate&&(status==="removed"||status==="left")&&styles.pastEndedBadge
              ]}>{label}</Text>}
              <Text style={[styles.message,pastUpdate&&styles.pastMessage]}>{item.message}</Text>
              <Text style={styles.time}>{formatTime(item.created_at)}</Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  container:{flex:1,backgroundColor:INK.card},content:{padding:20,paddingBottom:60},center:{flex:1,alignItems:"center",justifyContent:"center",padding:30,backgroundColor:INK.card},
  headingRow:{flexDirection:"row",alignItems:"flex-start",justifyContent:"space-between",gap:12,marginBottom:14},headingText:{flex:1},title:{fontSize:30,fontWeight:"bold"},subtitle:{color:INK.inkSoft,lineHeight:21,marginTop:5},
  markAllButton:{paddingHorizontal:12,paddingVertical:10,borderRadius:10,backgroundColor:INK.card},markAllText:{color:INK.blue,fontWeight:"bold",fontSize:12},loader:{marginTop:50},
  tabs:{gap:8,paddingBottom:16},tab:{flexDirection:"row",alignItems:"center",gap:7,backgroundColor:INK.card,borderColor:INK.ink,borderWidth:1,borderRadius:20,paddingHorizontal:12,paddingVertical:8},activeTab:{backgroundColor:INK.blue,borderColor:INK.blue},tabText:{color:INK.inkSoft,fontWeight:"800",fontSize:12},activeTabText:{color:INK.card},tabCount:{minWidth:22,height:22,borderRadius:11,backgroundColor:INK.card,alignItems:"center",justifyContent:"center"},activeTabCount:{backgroundColor:"rgba(255,255,255,0.2)"},tabCountText:{color:INK.inkSoft,fontSize:10,fontWeight:"900"},activeTabCountText:{color:INK.ink},
  card:{backgroundColor:INK.card,borderWidth:1,borderColor:INK.ink,borderRadius:14,padding:14,marginBottom:11,flexDirection:"row",alignItems:"flex-start"},
  liveCard:{backgroundColor:INK.card,borderColor:INK.ink},socialCard:{backgroundColor:INK.card,borderColor:INK.ink},accountCard:{backgroundColor:INK.card},
  unreadCard:{backgroundColor:INK.card,borderColor:INK.ink},socialUnreadCard:{backgroundColor:INK.card,borderColor:INK.blue},liveUnreadCard:{backgroundColor:INK.card,borderColor:INK.blue},
  approvedCard:{backgroundColor:INK.card,borderColor:INK.ink},rejectedCard:{backgroundColor:INK.card,borderColor:INK.pink},endedCard:{backgroundColor:INK.card,borderColor:INK.ink},pastApprovedCard:{backgroundColor:INK.card,borderColor:INK.ink},pastRejectedCard:{backgroundColor:INK.card,borderColor:INK.ink},pastEndedCard:{backgroundColor:INK.card,borderColor:INK.ink},
  iconWrap:{width:44,height:44,borderRadius:22,backgroundColor:INK.card,alignItems:"center",justifyContent:"center"},socialIconWrap:{backgroundColor:INK.card},liveIconWrap:{backgroundColor:INK.card},unreadIconWrap:{backgroundColor:INK.card},icon:{fontSize:21},cardText:{flex:1,marginLeft:12},cardTop:{flexDirection:"row",alignItems:"center"},cardTitle:{fontSize:16,fontWeight:"bold",flex:1,color:INK.blue},unreadDot:{width:9,height:9,borderRadius:5,backgroundColor:INK.blue,marginLeft:8},
  categoryLabel:{alignSelf:"flex-start",fontSize:9,fontWeight:"900",textTransform:"uppercase",letterSpacing:0.7,color:INK.inkSoft,marginTop:5},socialCategory:{color:INK.blue},liveCategory:{color:INK.blue},
  statusBadge:{alignSelf:"flex-start",fontSize:10,fontWeight:"bold",textTransform:"uppercase",paddingHorizontal:9,paddingVertical:5,borderRadius:20,overflow:"hidden",marginTop:7},pendingBadge:{backgroundColor:INK.card,color:INK.red},approvedBadge:{backgroundColor:INK.card,color:INK.green},rejectedBadge:{backgroundColor:INK.card,color:INK.red},endedBadge:{backgroundColor:INK.card,color:INK.ink},pastApprovedBadge:{backgroundColor:INK.card,color:INK.green},pastRejectedBadge:{backgroundColor:INK.card,color:INK.red},pastEndedBadge:{backgroundColor:INK.card,color:INK.inkSoft},
  message:{color:INK.ink,lineHeight:20,marginTop:7},pastMessage:{color:INK.inkSoft},time:{color:INK.inkSoft,fontSize:12,marginTop:8},emptyCard:{backgroundColor:INK.card,borderWidth:1,borderColor:INK.ink,borderRadius:16,padding:28,alignItems:"center",marginTop:20},emptyIcon:{fontSize:38},emptyTitle:{fontSize:19,fontWeight:"bold",marginTop:10,textAlign:"center"},emptyText:{color:INK.inkSoft,marginTop:7,textAlign:"center"},primaryButton:{backgroundColor:INK.blue,paddingHorizontal:24,paddingVertical:14,borderRadius:11,marginTop:18},primaryText:{color:INK.card,fontWeight:"bold"}
});

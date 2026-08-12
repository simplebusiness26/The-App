import React,{useCallback,useState} from "react";
import {ActivityIndicator,Pressable,RefreshControl,ScrollView,StyleSheet,Text,View} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../../services/supabase";
import {useFeedback} from "../../context/FeedbackContext";
import {INK} from "../../utils/tokens";

export default function BlockedExplorers(){
  const {showFeedback}=useFeedback();
  const [items,setItems]=useState([]);
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [workingId,setWorkingId]=useState(null);

  const load=useCallback(async(showLoader=true)=>{
    if(showLoader) setLoading(true);
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){router.replace("/auth/login");return;}
    const {data:blocks,error}=await supabase.from("user_blocks").select("blocked_id,created_at").eq("blocker_id",user.id).order("created_at",{ascending:false});
    if(error){showFeedback(error.message,"error","Blocked list not loaded");setItems([]);}else{
      const ids=(blocks || []).map(item=>item.blocked_id);
      let profiles={};
      if(ids.length){
        const {data}=await supabase.from("profiles").select("id,full_name,profile_photo,area,show_area").in("id",ids);
        profiles=Object.fromEntries((data || []).map(item=>[item.id,item]));
      }
      setItems((blocks || []).map(item=>({...item,profile:profiles[item.blocked_id] || null})));
    }
    setLoading(false);setRefreshing(false);
  },[showFeedback]);

  useFocusEffect(useCallback(()=>{load();},[load]));

  async function unblock(item){
    setWorkingId(item.blocked_id);
    const {error}=await supabase.rpc("unblock_explorer",{p_user_id:item.blocked_id});
    setWorkingId(null);
    if(error){showFeedback(error.message,"error","Explorer not unblocked");return;}
    showFeedback("You may now see each other's public activity again.","success","Explorer unblocked");
    await load(false);
  }

  function refresh(){setRefreshing(true);load(false);}

  if(loading) return <View style={styles.center}><ActivityIndicator size="large" color={INK.blue}/></View>;

  return(
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh}/>}>
      <Text style={styles.eyebrow}>SAFETY CONTROLS</Text><Text style={styles.title}>Blocked Explorers</Text>
      <Text style={styles.subtitle}>Blocked people cannot follow you or see each other's Link-ups and live check-ins.</Text>
      {items.length===0&&<View style={styles.emptyCard}><Text style={styles.emptyIcon}>🛡️</Text><Text style={styles.emptyTitle}>Nobody blocked</Text><Text style={styles.emptyText}>You can block an organiser from a Link-up or a nearby Explorer from their profile.</Text></View>}
      {items.map(item=><View key={item.blocked_id} style={styles.card}><Pressable style={styles.profile} onPress={()=>router.push(`/profile/${item.blocked_id}`)}><View style={styles.avatar}><Text style={styles.avatarText}>{item.profile?.full_name?.charAt(0)?.toUpperCase() || "E"}</Text></View><View style={styles.profileText}><Text style={styles.name}>{item.profile?.full_name || "Explorer"}</Text>{item.profile?.show_area&&item.profile?.area?<Text style={styles.area}>{item.profile.area}</Text>:null}</View></Pressable><Pressable style={styles.unblock} disabled={workingId===item.blocked_id} onPress={()=>unblock(item)}>{workingId===item.blocked_id?<ActivityIndicator color="white" size="small"/>:<Text style={styles.unblockText}>Unblock</Text>}</Pressable></View>)}
    </ScrollView>
  );
}

const styles=StyleSheet.create({screen:{flex:1,backgroundColor:INK.paper},content:{padding:18,paddingBottom:70},center:{flex:1,backgroundColor:INK.paper,alignItems:"center",justifyContent:"center"},eyebrow:{color:INK.blue,fontSize:10,fontWeight:"900",letterSpacing:1},title:{color:"white",fontSize:31,fontWeight:"900",marginTop:4},subtitle:{color:INK.inkSoft,lineHeight:21,marginTop:7,marginBottom:16},emptyCard:{backgroundColor:INK.card,borderColor:INK.ink,borderWidth:1,borderRadius:15,padding:28,alignItems:"center"},emptyIcon:{fontSize:38},emptyTitle:{color:"white",fontSize:18,fontWeight:"900",marginTop:8},emptyText:{color:INK.inkSoft,textAlign:"center",lineHeight:19,marginTop:5},card:{flexDirection:"row",alignItems:"center",backgroundColor:INK.card,borderColor:INK.ink,borderWidth:1,borderRadius:14,padding:12,marginBottom:10},profile:{flex:1,flexDirection:"row",alignItems:"center"},avatar:{width:45,height:45,borderRadius:23,backgroundColor:INK.blue,alignItems:"center",justifyContent:"center"},avatarText:{color:"white",fontWeight:"900",fontSize:18},profileText:{marginLeft:10},name:{color:"white",fontWeight:"900"},area:{color:INK.inkSoft,fontSize:11,marginTop:3},unblock:{backgroundColor:INK.red,borderColor:INK.red,borderWidth:1,borderRadius:10,minWidth:82,paddingVertical:10,alignItems:"center"},unblockText:{color:INK.ink,fontWeight:"900",fontSize:11}});

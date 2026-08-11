import React,{useCallback,useMemo,useState} from "react";
import {ActivityIndicator,Pressable,RefreshControl,ScrollView,StyleSheet,Text,View} from "react-native";
import {Link,router,useFocusEffect} from "expo-router";
import {supabase} from "../../services/supabase";
import {effectiveLinkupStatus,formatDateTime,statusLabel,timeUntil} from "../../utils/linkups";

export default function LinkupsIndex(){
  const [user,setUser]=useState(null);
  const [profile,setProfile]=useState(null);
  const [items,setItems]=useState([]);
  const [joinedIds,setJoinedIds]=useState(new Set());
  const [creators,setCreators]=useState({});
  const [filter,setFilter]=useState("discover");
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [error,setError]=useState("");

  const load=useCallback(async(showLoader=true)=>{
    if(showLoader) setLoading(true);
    setError("");
    const {data:{user:currentUser}}=await supabase.auth.getUser();
    if(!currentUser){router.replace("/auth/login");return;}
    setUser(currentUser);

    await supabase.rpc("refresh_live_system");
    const [profileResult,linkupResult,attendeeResult]=await Promise.all([
      supabase.from("profiles").select("area").eq("id",currentUser.id).maybeSingle(),
      supabase.from("linkups").select("*").order("starts_at",{ascending:true}).limit(100),
      supabase.from("linkup_attendees").select("linkup_id,status").eq("user_id",currentUser.id).eq("status","joined")
    ]);

    setProfile(profileResult.data);
    if(linkupResult.error){setError(linkupResult.error.message);setItems([]);}
    else{
      const rows=linkupResult.data || [];
      setItems(rows);
      const ids=[...new Set(rows.map(item=>item.creator_id))];
      if(ids.length){
        const {data}=await supabase.from("profiles").select("id,full_name,profile_photo,area,show_area").in("id",ids);
        setCreators(Object.fromEntries((data || []).map(item=>[item.id,item])));
      }else setCreators({});
    }
    setJoinedIds(new Set((attendeeResult.data || []).map(item=>item.linkup_id)));
    setLoading(false);
    setRefreshing(false);
  },[]);

  useFocusEffect(useCallback(()=>{load();},[load]));

  const filtered=useMemo(()=>{
    const now=Date.now();
    return items.filter(item=>{
      if(filter==="mine") return item.creator_id===user?.id;
      if(filter==="joined") return joinedIds.has(item.id) && item.creator_id!==user?.id;
      return item.creator_id!==user?.id && !joinedIds.has(item.id) && new Date(item.ends_at).getTime()>now && !["cancelled","completed"].includes(item.status);
    });
  },[items,filter,user,joinedIds]);

  function refresh(){setRefreshing(true);load(false);}

  if(loading) return <View style={styles.center}><ActivityIndicator size="large" color="#bca8ff"/></View>;

  return(
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh}/>}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>MEET LOCALLY</Text>
        <Text style={styles.title}>Link-ups</Text>
        <Text style={styles.subtitle}>Create something to do, join local Explorers and keep the plan together in a private board.</Text>
        <Link href="/linkups/create" asChild>
          <Pressable accessibilityRole="link" testID="create-linkup-button" style={styles.createButton}>
            <Text style={styles.createText}>＋ Create Link-up</Text>
          </Pressable>
        </Link>
      </View>

      {!!error && <View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text></View>}

      <View style={styles.tabs}>
        {[
          {key:"discover",label:"Discover"},
          {key:"joined",label:"Joined"},
          {key:"mine",label:"Created"}
        ].map(tab=><Pressable key={tab.key} style={[styles.tab,filter===tab.key&&styles.tabActive]} onPress={()=>setFilter(tab.key)}><Text style={[styles.tabText,filter===tab.key&&styles.tabTextActive]}>{tab.label}</Text></Pressable>)}
      </View>

      {filtered.length===0 && <View style={styles.emptyCard}><Text style={styles.emptyIcon}>🤝</Text><Text style={styles.emptyTitle}>No Link-ups here yet</Text><Text style={styles.emptyText}>{filter==="discover"?"Create the first one or check Live Nearby for things happening today.":"Your Link-ups will appear here."}</Text></View>}

      {filtered.map(item=>{
        const status=effectiveLinkupStatus(item);
        const creator=creators[item.creator_id];
        return(
          <Pressable key={item.id} style={styles.card} onPress={()=>router.push(`/linkups/${item.id}`)}>
            <View style={styles.cardTop}>
              <View style={styles.categoryPill}><Text style={styles.categoryText}>{item.category}</Text></View>
              <View style={[styles.statusPill,styles[`status_${status}`]]}><Text style={styles.statusText}>{statusLabel(status)}</Text></View>
            </View>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.when}>{formatDateTime(item.starts_at)} · {timeUntil(item.starts_at)}</Text>
            <Text style={styles.place}>📍 {item.location_name}, {item.area}</Text>
            <Text style={styles.description} numberOfLines={3}>{item.description}</Text>
            <View style={styles.cardBottom}>
              <Text style={styles.creator}>By {creator?.full_name || "Explorer"}</Text>
              <Text style={styles.capacity}>{item.attendee_count}/{item.max_attendees} joined</Text>
            </View>
            {item.visibility==="followers" && <Text style={styles.followersOnly}>Friends only</Text>}
          </Pressable>
        );
      })}

      <Pressable style={styles.liveButton} onPress={()=>router.push("/live")}><Text style={styles.liveText}>📡 Open Live Nearby</Text></Pressable>
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:"#18181b"},content:{padding:18,paddingBottom:70},center:{flex:1,backgroundColor:"#18181b",alignItems:"center",justifyContent:"center"},
  hero:{backgroundColor:"#231b3d",borderColor:"#493c69",borderWidth:1,borderRadius:18,padding:18},eyebrow:{color:"#a991f0",fontSize:10,fontWeight:"900",letterSpacing:1},title:{color:"white",fontSize:34,fontWeight:"900",marginTop:4},subtitle:{color:"#b5aec7",lineHeight:21,marginTop:8},createButton:{backgroundColor:"#3212b6",borderRadius:12,paddingVertical:14,alignItems:"center",marginTop:16},createText:{color:"white",fontWeight:"900",fontSize:15},
  errorCard:{backgroundColor:"#431f26",borderColor:"#7e3541",borderWidth:1,borderRadius:12,padding:12,marginTop:14},errorText:{color:"#ffc1c9"},
  tabs:{flexDirection:"row",gap:8,marginVertical:16},tab:{flex:1,backgroundColor:"#25252a",borderColor:"#414147",borderWidth:1,borderRadius:20,paddingVertical:10,alignItems:"center"},tabActive:{backgroundColor:"#3212b6",borderColor:"#6245e8"},tabText:{color:"#a2a2ab",fontWeight:"900",fontSize:12},tabTextActive:{color:"white"},
  card:{backgroundColor:"#222226",borderColor:"#414147",borderWidth:1,borderRadius:16,padding:15,marginBottom:12},cardTop:{flexDirection:"row",justifyContent:"space-between",gap:8},categoryPill:{backgroundColor:"#302655",borderRadius:14,paddingHorizontal:9,paddingVertical:5},categoryText:{color:"#d8ceff",fontSize:10,fontWeight:"900"},statusPill:{borderRadius:14,paddingHorizontal:9,paddingVertical:5,backgroundColor:"#3b3b42"},status_upcoming:{backgroundColor:"#17385d"},status_full:{backgroundColor:"#62420f"},status_happening:{backgroundColor:"#155b42"},status_cancelled:{backgroundColor:"#6a252e"},status_completed:{backgroundColor:"#3c3c42"},statusText:{color:"white",fontSize:10,fontWeight:"900"},cardTitle:{color:"white",fontSize:21,fontWeight:"900",marginTop:12},when:{color:"#c8b9f6",fontWeight:"800",marginTop:7},place:{color:"#b6b6bf",marginTop:6},description:{color:"#9999a3",lineHeight:20,marginTop:9},cardBottom:{flexDirection:"row",justifyContent:"space-between",marginTop:13},creator:{color:"#898993",fontSize:11},capacity:{color:"white",fontWeight:"900",fontSize:12},followersOnly:{color:"#bca8ff",fontSize:10,fontWeight:"900",marginTop:8},
  emptyCard:{backgroundColor:"#222226",borderColor:"#414147",borderWidth:1,borderRadius:16,padding:28,alignItems:"center"},emptyIcon:{fontSize:38},emptyTitle:{color:"white",fontSize:19,fontWeight:"900",marginTop:10},emptyText:{color:"#9999a3",textAlign:"center",lineHeight:19,marginTop:6},liveButton:{borderColor:"#4f4272",borderWidth:1,backgroundColor:"#29233b",borderRadius:13,padding:14,alignItems:"center",marginTop:6},liveText:{color:"#d9ceff",fontWeight:"900"}
});

import React,{useCallback,useMemo,useState} from "react";
import {ActivityIndicator,Pressable,RefreshControl,ScrollView,StyleSheet,Text,View} from "react-native";
import {Link,router,useFocusEffect} from "expo-router";
import {supabase} from "../../services/supabase";
import {effectiveLinkupStatus,formatDateTime,statusLabel,timeUntil} from "../../utils/linkups";
import AlexJourneyHeader from "../../components/AlexJourneyHeader";
import {INK} from "../../utils/tokens";
import {audienceShortLabel} from "../../utils/audience";

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

  if(loading) return <View style={styles.center}><ActivityIndicator size="large" color={INK.brandDeep}/></View>;

  return(
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh}/>}>
      <AlexJourneyHeader
        phase="JOIN"
        title="Turn a possibility into a plan"
        description="Link-ups are live commitments between Explorers. See when, where, who and how full it is before deciding."
        meta={profile?.area || "Nearby"}
      >
        <Link href="/linkups/create" asChild>
          <Pressable accessibilityRole="link" testID="create-linkup-button" style={styles.createButton}>
            <Text style={styles.createText}>Create Link-up</Text>
          </Pressable>
        </Link>
        <Pressable style={styles.liveButton} onPress={()=>router.push("/live")}>
          <Text style={styles.liveText}>Open Now</Text>
        </Pressable>
      </AlexJourneyHeader>

      {!!error && <View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text></View>}

      <View style={styles.viewSwitch}>
        <Text style={styles.viewLabel}>YOUR RELATIONSHIP TO THE PLAN</Text>
        <View style={styles.tabs}>
          {[
            {key:"discover",label:"Available"},
            {key:"joined",label:"Joined"},
            {key:"mine",label:"Created"}
          ].map(tab=><Pressable key={tab.key} style={[styles.tab,filter===tab.key&&styles.tabActive]} onPress={()=>setFilter(tab.key)}><Text style={[styles.tabText,filter===tab.key&&styles.tabTextActive]}>{tab.label}</Text></Pressable>)}
        </View>
      </View>

      {filtered.length===0 && <View style={styles.emptyCard}><Text style={styles.emptyIcon}>🤝</Text><Text style={styles.emptyTitle}>No Link-ups in this view</Text><Text style={styles.emptyText}>{filter==="discover"?"Create the first one or open Now for everything happening nearby.":"Your Link-ups will appear here."}</Text></View>}

      <View style={styles.list}>
        {filtered.map(item=>{
          const status=effectiveLinkupStatus(item);
          const creator=creators[item.creator_id];
          const remaining=Math.max(0,Number(item.max_attendees || 0)-Number(item.attendee_count || 0));
          return(
            <Pressable key={item.id} style={({pressed})=>[styles.card,pressed&&styles.cardPressed]} onPress={()=>router.push(`/linkups/${item.id}`)}>
              <View style={styles.decisionBand}>
                <View style={styles.timeBlock}>
                  <Text style={styles.bandKicker}>WHEN</Text>
                  <Text style={styles.when}>{formatDateTime(item.starts_at)}</Text>
                  <Text style={styles.countdown}>{timeUntil(item.starts_at)}</Text>
                </View>
                <View style={styles.capacityBlock}>
                  <Text style={styles.bandKicker}>SPACE</Text>
                  <Text style={styles.capacity}>{item.attendee_count}/{item.max_attendees}</Text>
                  <Text style={styles.remaining}>{remaining>0 ? `${remaining} left` : "Full"}</Text>
                </View>
              </View>

              <View style={styles.cardTop}>
                <Text style={styles.category}>{item.category}</Text>
                <View style={[styles.statusPill,styles[`status_${status}`]]}><Text style={styles.statusText}>{statusLabel(status)}</Text></View>
              </View>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.place}>📍 {item.location_name}, {item.area}</Text>
              <Text style={styles.description} numberOfLines={3}>{item.description}</Text>

              <View style={styles.cardBottom}>
                <Text style={styles.creator}>By {creator?.full_name || "Explorer"}</Text>
                {item.visibility!=="everyone" && <Text style={styles.audience}>{audienceShortLabel(item.visibility)} only</Text>}
              </View>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:INK.paper},content:{padding:16,paddingBottom:70},center:{flex:1,backgroundColor:INK.paper,alignItems:"center",justifyContent:"center"},
  createButton:{backgroundColor:INK.brand,borderRadius:14,paddingHorizontal:15,paddingVertical:12},createText:{color:INK.navy,fontWeight:"900",fontSize:13},
  liveButton:{backgroundColor:INK.navySoft,borderRadius:14,paddingHorizontal:15,paddingVertical:12},liveText:{color:INK.onNavy,fontWeight:"900",fontSize:13},
  errorCard:{backgroundColor:INK.card,borderColor:INK.red,borderWidth:1,borderRadius:16,padding:13,marginBottom:13},errorText:{color:INK.red},
  viewSwitch:{backgroundColor:INK.card,borderWidth:1,borderColor:INK.hair,borderRadius:18,padding:10,marginBottom:15},
  viewLabel:{color:INK.brandDeep,fontSize:9,fontWeight:"900",letterSpacing:1,marginBottom:8},
  tabs:{flexDirection:"row",gap:6},tab:{flex:1,backgroundColor:INK.paper,borderRadius:13,paddingVertical:11,alignItems:"center"},tabActive:{backgroundColor:INK.navy},tabText:{color:INK.inkSoft,fontWeight:"900",fontSize:11},tabTextActive:{color:INK.onNavy},
  list:{gap:12},card:{backgroundColor:INK.card,borderColor:INK.hair,borderWidth:1,borderRadius:22,padding:16},cardPressed:{backgroundColor:INK.sky},
  decisionBand:{flexDirection:"row",backgroundColor:INK.navy,borderRadius:17,padding:12,gap:10},timeBlock:{flex:2},capacityBlock:{flex:1,borderLeftWidth:1,borderLeftColor:INK.navySoft,paddingLeft:10},bandKicker:{color:INK.brand,fontSize:8,fontWeight:"900",letterSpacing:1},when:{color:INK.onNavy,fontWeight:"900",fontSize:13,marginTop:3},countdown:{color:INK.onNavySoft,fontSize:10,marginTop:2},capacity:{color:INK.onNavy,fontWeight:"900",fontSize:17,marginTop:2},remaining:{color:INK.onNavySoft,fontSize:9,marginTop:1},
  cardTop:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",gap:8,marginTop:13},category:{color:INK.lavender,fontSize:10,fontWeight:"900",textTransform:"uppercase",letterSpacing:.6},
  statusPill:{borderRadius:99,paddingHorizontal:9,paddingVertical:5,backgroundColor:INK.sky},status_upcoming:{backgroundColor:INK.sky},status_full:{backgroundColor:INK.coral},status_happening:{backgroundColor:INK.brand},status_cancelled:{backgroundColor:INK.coral},status_completed:{backgroundColor:INK.hair},statusText:{color:INK.navy,fontSize:9,fontWeight:"900"},
  cardTitle:{color:INK.ink,fontSize:22,lineHeight:26,fontWeight:"900",marginTop:9},place:{color:INK.inkSoft,marginTop:6},description:{color:INK.inkSoft,lineHeight:20,marginTop:10},cardBottom:{flexDirection:"row",justifyContent:"space-between",gap:10,marginTop:13},creator:{color:INK.inkSoft,fontSize:11},audience:{color:INK.brandDeep,fontSize:10,fontWeight:"900"},
  emptyCard:{backgroundColor:INK.card,borderColor:INK.hair,borderWidth:1,borderRadius:20,padding:28,alignItems:"center"},emptyIcon:{fontSize:38},emptyTitle:{color:INK.ink,fontSize:19,fontWeight:"900",marginTop:10},emptyText:{color:INK.inkSoft,textAlign:"center",lineHeight:19,marginTop:6}
});

import React,{useCallback,useMemo,useState} from "react";
import {ActivityIndicator,Pressable,RefreshControl,ScrollView,StyleSheet,Text,View} from "react-native";
import {Link,router,useFocusEffect} from "expo-router";
import {supabase} from "../../services/supabase";
import {effectiveLinkupStatus,formatDateTime,statusLabel,timeUntil} from "../../utils/linkups";
import {INK} from "../../utils/tokens";
import {TYPE} from "../../styles/typography";
import {audienceShortLabel} from "../../utils/audience";

// GAZETTEER PASS (design round r001-a, directive 10): the Discover/Joined/
// Created browse, re-set as an index -- a section header carrying the count
// over a 2px rule, then one-line ledger rows with a hairline between them,
// start time and time-until right-aligned in tabular numerals. Same query,
// same filters, same routes -- only how it is drawn changed.

const FILTER_TABS=[
  {key:"discover",label:"Discover"},
  {key:"joined",label:"Joined"},
  {key:"mine",label:"Created"}
];

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

  if(loading) return <View style={styles.center}><ActivityIndicator size="large" color={INK.ink}/></View>;

  return(
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh}/>}>
      <Text style={TYPE.sectionLabel}>Meet Locally</Text>
      <Text style={TYPE.display}>Link-ups</Text>
      <Text style={styles.lead}>Create something to do, join local Explorers and keep the plan together in a private board.</Text>
      <Link href="/linkups/create" asChild>
        <Pressable accessibilityRole="link" testID="create-linkup-button" style={styles.createButton}>
          <Text style={styles.createText}>＋ Create Link-up</Text>
        </Pressable>
      </Link>

      {!!error && <View style={styles.notice}><Text style={styles.noticeText}>{error}</Text></View>}

      <View style={styles.tabs}>
        {FILTER_TABS.map(tab=>(
          <Pressable key={tab.key} style={[styles.tab,filter===tab.key&&styles.tabActive]} onPress={()=>setFilter(tab.key)}>
            <Text style={[styles.tabText,filter===tab.key&&styles.tabTextActive]}>{tab.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.sectionHead}>
        <Text style={TYPE.sectionLabel}>{FILTER_TABS.find(tab=>tab.key===filter)?.label}</Text>
        <Text style={styles.count}>{filtered.length}</Text>
      </View>

      {filtered.length===0 ? (
        // An empty state is an instruction, not a mood -- kept as a ledger
        // line rather than a boxed void.
        <Text style={styles.emptyText}>
          {filter==="discover"
            ? "No Link-ups here yet. Create the first one or check Live Nearby for things happening today."
            : "No Link-ups here yet. Your Link-ups will appear here."}
        </Text>
      ) : filtered.map(item=>{
        const status=effectiveLinkupStatus(item);
        const creator=creators[item.creator_id];
        return(
          <Pressable
            key={item.id}
            style={styles.row}
            accessibilityRole="button"
            accessibilityLabel={`${item.title}. ${statusLabel(status)}.`}
            onPress={()=>router.push(`/linkups/${item.id}`)}
          >
            <View style={styles.textCol}>
              <Text style={TYPE.rowTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={TYPE.meta} numberOfLines={1}>
                {item.category} · {statusLabel(status)}{item.visibility!=="everyone" ? ` · ${audienceShortLabel(item.visibility)} only` : ""}
              </Text>
              <Text style={styles.place} numberOfLines={1}>
                {item.location_name}{item.area ? `, ${item.area}` : ""} · By {creator?.full_name || "Explorer"}
              </Text>
            </View>
            <View style={styles.endCol}>
              <Text style={styles.dateNum} numberOfLines={2}>{formatDateTime(item.starts_at)}</Text>
              <Text style={styles.endMeta} numberOfLines={1}>{timeUntil(item.starts_at)} · {item.attendee_count}/{item.max_attendees} joined</Text>
            </View>
          </Pressable>
        );
      })}

      <Pressable style={styles.liveButton} accessibilityRole="button" accessibilityLabel="Open Live Nearby" onPress={()=>router.push("/live")}>
        <Text style={styles.liveText}>Open Live Nearby</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:INK.paper},
  content:{padding:20,paddingBottom:70},
  center:{flex:1,backgroundColor:INK.paper,alignItems:"center",justifyContent:"center"},
  lead:{fontSize:14,lineHeight:21,color:INK.inkSoft,marginTop:6},
  createButton:{
    alignSelf:"flex-start",
    marginTop:14,
    minHeight:44,
    justifyContent:"center",
    paddingHorizontal:18,
    backgroundColor:INK.ink,
    borderWidth:2,
    borderColor:INK.ink,
    borderRadius:6
  },
  createText:{color:INK.card,fontWeight:"900",fontSize:14},
  notice:{
    backgroundColor:INK.card,
    borderWidth:2,
    borderColor:INK.ink,
    borderRadius:4,
    padding:14,
    marginTop:16
  },
  noticeText:{...TYPE.body,color:INK.inkSoft},
  tabs:{flexDirection:"row",gap:8,marginTop:20,marginBottom:4},
  tab:{flex:1,paddingVertical:11,borderRadius:4,alignItems:"center",borderWidth:2,borderColor:INK.ink,backgroundColor:INK.card},
  tabActive:{backgroundColor:INK.ink},
  tabText:{color:INK.ink,fontWeight:"800",fontSize:12},
  tabTextActive:{color:INK.card},
  sectionHead:{
    flexDirection:"row",
    alignItems:"flex-end",
    justifyContent:"space-between",
    marginTop:18,
    paddingBottom:6,
    borderBottomWidth:2,
    borderBottomColor:INK.ink
  },
  count:{...TYPE.numeral,fontSize:16},
  emptyText:{...TYPE.meta,paddingVertical:12},
  row:{
    flexDirection:"row",
    alignItems:"center",
    minHeight:56,
    paddingVertical:10,
    gap:10,
    borderBottomWidth:1,
    borderBottomColor:INK.hair
  },
  textCol:{flex:1},
  place:{...TYPE.meta,marginTop:1},
  endCol:{alignItems:"flex-end",gap:3,maxWidth:170},
  dateNum:{...TYPE.numeral,fontSize:13,textAlign:"right"},
  endMeta:{...TYPE.meta,textAlign:"right"},
  liveButton:{
    backgroundColor:INK.ink,
    borderWidth:2,
    borderColor:INK.ink,
    borderRadius:6,
    padding:14,
    alignItems:"center",
    marginTop:22
  },
  liveText:{color:INK.card,fontWeight:"900",fontSize:14}
});

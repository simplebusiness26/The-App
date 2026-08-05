import React,{useCallback,useState} from "react";
import {View,Text,Pressable,StyleSheet,ScrollView,ActivityIndicator,RefreshControl} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../services/supabase";
import {SECTIONS,recommend} from "../utils/discover";
import {INK} from "../utils/tokens";

// Packet 7: the Discover screen. Replaces the placeholder Packet 3 left here.
//
// The rule this screen exists to obey lives in utils/discover.js: an item
// without a computable reason does not appear. Every list below is passed
// through `recommend`, which is the only way anything reaches the screen --
// there is no path that renders an item straight from a query.
//
// What is deliberately absent: a Feed section. The brief names one, and
// app/feed.js already is that screen, reachable from the drawer and built on
// get_explorer_social_feed. Rebuilding a strip of the same rows here would be a
// second place to maintain the same thing, so a row at the end points at it.

export default function Discover(){
  const [area,setArea]=useState("");
  const [items,setItems]=useState({});
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [notice,setNotice]=useState("");

  const load=useCallback(async()=>{
    setNotice("");

    const {data:{user}}=await supabase.auth.getUser();

    if(!user){
      setItems({});
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const {data:profile}=await supabase
      .from("profiles").select("area").eq("id",user.id).maybeSingle();

    const viewerArea=profile?.area || "";
    setArea(viewerArea);

    const now=new Date();
    const soon=new Date(now.getTime()+14*24*60*60*1000).toISOString();

    const [liveResult,eventResult,clubResult,linkupResult,savedResult]=await Promise.all([
      supabase.rpc("get_live_discovery",{p_area:viewerArea || null,p_window_hours:24}),
      supabase.from("events").select("id,name,category,area,location,starts_at,ends_at,status")
        .eq("status","published").gte("ends_at",now.toISOString()).lte("starts_at",soon).order("starts_at",{ascending:true}),
      supabase.from("activity_clubs").select("id,name,category,location,address,status")
        .in("status",["open","full"]).limit(20),
      supabase.from("linkups").select("id,title,category,area,starts_at,ends_at,status")
        .gte("ends_at",now.toISOString()).order("starts_at",{ascending:true}).limit(20),
      supabase.from("explorer_favourites").select("*").eq("user_id",user.id)
        .order("sort_order",{ascending:true}).order("created_at",{ascending:false})
    ]);

    // The live feed is the one query that can refuse: it raises for a
    // non-Explorer account. Saying so beats an empty section, which would read
    // as "nothing is happening" -- a different and untrue statement.
    if(liveResult.error) setNotice("Live activity could not be loaded, so Happening now may be incomplete.");

    const context={now:now.getTime(),area:viewerArea};

    const live=(liveResult.data || []).map((row)=>({
      id:`${row.item_type}-${row.item_id}`,
      title:row.title,
      subtitle:row.subtitle,
      area:row.area,
      starts_at:row.starts_at,
      ends_at:row.ends_at,
      distance_km:row.distance_km,
      route:row.deep_link
    }));

    const events=(eventResult.data || []).map((row)=>({
      id:`event-${row.id}`,
      title:row.name,
      subtitle:row.category,
      area:row.area || row.location,
      starts_at:row.starts_at,
      ends_at:row.ends_at,
      route:`/events/${row.id}`
    }));

    const clubs=(clubResult.data || []).map((row)=>({
      id:`club-${row.id}`,
      title:row.name,
      subtitle:row.category,
      area:row.location || row.address,
      route:`/activity-clubs/${row.id}`
    }));

    const linkups=(linkupResult.data || []).map((row)=>({
      id:`linkup-${row.id}`,
      title:row.title,
      subtitle:row.category,
      area:row.area,
      starts_at:row.starts_at,
      ends_at:row.ends_at,
      route:`/linkups/${row.id}`
    }));

    // Own favourites, unfiltered. The profile Collections tab reads the same
    // table but only `is_public` rows, because that is somebody else looking at
    // your profile. This is your own list, so hiding your own private saves
    // from you would be the filter applied to the wrong person.
    const saved=(savedResult.data || []).map((row)=>({
      id:`saved-${row.id}`,
      title:row.target_name,
      subtitle:String(row.target_type || "").replace("_"," "),
      saved:true,
      route:savedRoute(row)
    }));

    setItems({
      "for-you":recommend([...saved.slice(0,4),...live.slice(0,4)],context),
      "happening-now":recommend(live,context),
      events:recommend(events,context),
      clubs:recommend(clubs,context),
      linkups:recommend(linkups,context),
      saved:recommend(saved,context)
    });

    setLoading(false);
    setRefreshing(false);
  },[]);

  useFocusEffect(useCallback(()=>{load();},[load]));

  if(loading){
    return(
      <View style={styles.centre}>
        <ActivityIndicator size="large" color={INK.ink}/>
      </View>
    );
  }

  return(
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);load();}}/>}
    >
      <Text style={styles.title}>Discover</Text>
      {!!area && <Text style={styles.lead}>What is on around {area}.</Text>}
      {!!notice && <Text style={styles.notice}>{notice}</Text>}

      {SECTIONS.map((section)=>{
        const rows=items[section.key] || [];

        return(
          <View key={section.key} style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {rows.length>0 && <Text style={styles.count}>{rows.length}</Text>}
            </View>

            {rows.length===0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>{section.empty}</Text>
              </View>
            ) : rows.slice(0,6).map((item)=>(
              <Pressable
                key={item.id}
                style={styles.card}
                accessibilityRole="button"
                accessibilityLabel={`${item.title}. ${item.reason}.`}
                onPress={()=>item.route && router.push(item.route)}
              >
                <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                {!!item.subtitle && <Text style={styles.cardSubtitle} numberOfLines={1}>{item.subtitle}</Text>}
                {/*
                  The reason. Never optional -- utils/discover.js drops anything
                  that has none, so if this ever rendered blank the item should
                  not have been on the screen at all.
                */}
                <Text style={styles.reason}>{item.reason}</Text>
              </Pressable>
            ))}
          </View>
        );
      })}

      <Pressable
        style={styles.card}
        accessibilityRole="button"
        accessibilityLabel="Open the Explorer feed"
        onPress={()=>router.push("/feed")}
      >
        <Text style={styles.cardTitle}>Explorer feed</Text>
        <Text style={styles.cardSubtitle}>What the Explorers you follow have been doing.</Text>
      </Pressable>
    </ScrollView>
  );
}

function savedRoute(row){
  if(row.target_type==="business") return `/business/${row.target_id}`;
  if(row.target_type==="property") return `/property/${row.target_id}`;
  if(row.target_type==="activity_club") return `/activity-clubs/${row.target_id}`;
  if(row.target_type==="event") return `/events/${row.target_id}`;
  return null;
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:INK.paper},
  centre:{flex:1,alignItems:"center",justifyContent:"center",backgroundColor:INK.paper},
  content:{padding:20,paddingBottom:40},
  title:{fontSize:30,fontWeight:"800",letterSpacing:-0.5,color:INK.ink},
  lead:{fontSize:14,lineHeight:21,color:INK.inkSoft,marginTop:6},
  notice:{
    backgroundColor:INK.card,
    borderWidth:2,
    borderColor:INK.ink,
    borderRadius:12,
    padding:12,
    marginTop:14,
    fontSize:13,
    lineHeight:19,
    color:INK.ink
  },
  section:{marginTop:24},
  sectionHead:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:10},
  sectionTitle:{fontSize:20,fontWeight:"800",color:INK.ink,letterSpacing:-0.3},
  count:{fontSize:12,fontWeight:"800",color:INK.inkSoft},
  empty:{borderTopWidth:2,borderTopColor:INK.hair,paddingTop:12},
  emptyText:{fontSize:13,lineHeight:19,color:INK.inkSoft},
  card:{
    backgroundColor:INK.card,
    borderWidth:2,
    borderColor:INK.ink,
    borderRadius:12,
    padding:14,
    marginBottom:10,
    shadowColor:INK.ink,
    shadowOffset:{width:3,height:3},
    shadowOpacity:1,
    shadowRadius:0,
    elevation:0
  },
  cardTitle:{fontSize:16,fontWeight:"800",color:INK.ink},
  cardSubtitle:{fontSize:13,color:INK.ink,marginTop:3},
  reason:{fontSize:11,fontWeight:"800",color:INK.inkSoft,marginTop:8,textTransform:"uppercase",letterSpacing:0.8}
});

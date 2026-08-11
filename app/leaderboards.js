import React,{useCallback,useEffect,useState} from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Image
} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../services/supabase";

function Avatar({row}){
  if(row.profile_photo){
    return <Image source={{uri:row.profile_photo}} style={styles.avatar}/>;
  }
  return <View style={styles.avatarFallback}><Text style={styles.avatarLetter}>{row.full_name?.charAt(0)?.toUpperCase() || "E"}</Text></View>;
}

export default function Leaderboards(){
  const [period,setPeriod]=useState("weekly");
  const [scope,setScope]=useState("local");
  const [profile,setProfile]=useState(null);
  const [rows,setRows]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  useFocusEffect(useCallback(()=>{
    loadProfile();
  },[]));

  useEffect(()=>{
    if(profile) loadLeaderboard();
  },[period,scope,profile?.area,profile?.show_area]);

  async function loadProfile(){
    setLoading(true);
    setError("");
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){
      router.replace("/auth/login");
      return;
    }

    const {data,error:profileError}=await supabase
      .from("profiles")
      .select("id,full_name,area,show_area,leaderboard_opt_in")
      .eq("id",user.id)
      .single();

    if(profileError || !data){
      setError("Your Explorer profile could not be loaded.");
      setLoading(false);
      return;
    }

    setProfile(data);
  }

  async function loadLeaderboard(){
    if(!profile) return;
    if(scope==="local" && (!profile.show_area || !profile.area?.trim())){
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const {data,error:leaderboardError}=await supabase.rpc("get_explorer_leaderboard",{
      p_period:period,
      p_scope:scope,
      p_area:scope==="local" ? profile.area.trim() : null,
      p_limit:50
    });

    if(leaderboardError){
      setError(leaderboardError.message || "The leaderboard could not be loaded.");
      setRows([]);
    }else{
      setRows(data || []);
    }
    setLoading(false);
  }

  const needsArea=scope==="local" && (!profile?.show_area || !profile?.area?.trim());

  // From the rows already loaded. A second query would be a second thing to
  // keep in step, and this page has no need to ask the database anything the
  // list has not already answered.
  const ownRow=rows.find(row=>row.user_id===profile?.id) || null;

  return(
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>EXPLORER SCORE RANKINGS</Text>
      <Text style={styles.title}>Leaderboard</Text>
      {/*
        Say what the number counts. It is points from reviews you published
        inside the period -- not endorsements, and not check-ins. There is a
        second scoring ledger in the database on a different scale that nothing
        on screen reads; naming this one Explorer Score without saying what it
        counts would be the more misleading half of that.
      */}
      <Text style={styles.subtitle}>Explorers ranked by their Explorer Score this week and this month. Test accounts are excluded.</Text>

      <View style={styles.tabs}>
        {[{key:"weekly",label:"Weekly"},{key:"monthly",label:"Monthly"}].map(item=>(
          <Pressable key={item.key} style={[styles.tab,period===item.key && styles.tabActive]} onPress={()=>setPeriod(item.key)}>
            <Text style={[styles.tabText,period===item.key && styles.tabTextActive]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.tabs}>
        {[{key:"local",label:"Local"},{key:"national",label:"National"}].map(item=>(
          <Pressable key={item.key} style={[styles.tab,scope===item.key && styles.tabActive]} onPress={()=>setScope(item.key)}>
            <Text style={[styles.tabText,scope===item.key && styles.tabTextActive]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      {scope==="local" && profile?.show_area && !!profile?.area?.trim() && (
        <View style={styles.areaPill}><Text style={styles.areaText}>📍 {profile.area.trim()}</Text></View>
      )}

      {/*
        Packet 9b: the rank card.

        The list shows the top of the board. Everybody who is not on it learns
        nothing, which is the majority of people and exactly the ones a
        leaderboard should be telling where they stand. This says it plainly,
        including when the honest answer is "not yet".

        It is derived from the rows already fetched -- no second query, and
        therefore nothing new exposed. When the viewer is outside the fetched
        window the card says so rather than inventing a position.
      */}
      {!needsArea && !loading && !error && (
        <View style={styles.rankCard} accessibilityLabel={ownRow
          ? `You are ranked ${ownRow.rank} with ${ownRow.points} point${ownRow.points===1 ? "" : "s"}`
          : "You are not ranked in this period yet"}>
          <Text style={styles.rankEyebrow}>WHERE YOU STAND</Text>
          {ownRow ? (
            <>
              <Text style={styles.rankValue}>#{ownRow.rank}</Text>
              <Text style={styles.rankMeta}>
                {ownRow.points} point{ownRow.points===1 ? "" : "s"} · {ownRow.review_count} review{ownRow.review_count===1 ? "" : "s"} this {period==="monthly" ? "month" : "week"}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.rankValue}>—</Text>
              {/* An instruction, not a mood. design-system.md bans the mood. */}
              <Text style={styles.rankMeta}>
                {profile?.leaderboard_opt_in===false
                  ? "You have opted out of leaderboards. Turn it on in your profile to appear here."
                  : "Publish a review of somewhere you went and you will appear here."}
              </Text>
            </>
          )}
        </View>
      )}

      {needsArea ? (
        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>Add a public area to join local rankings</Text>
          <Text style={styles.noticeText}>Your exact address is never needed. Add a town or area and choose to display it publicly.</Text>
          <Pressable style={styles.primaryButton} onPress={()=>router.push("/profile/edit")}><Text style={styles.primaryText}>Edit Profile</Text></Pressable>
        </View>
      ) : loading ? (
        <View style={styles.loadingBox}><ActivityIndicator size="large" color="#a58cff"/></View>
      ) : error ? (
        <View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text></View>
      ) : rows.length===0 ? (
        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>No points yet</Text>
          <Text style={styles.noticeText}>The first eligible review in this period will start the leaderboard.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {rows.map(row=>{
            const own=row.user_id===profile?.id;
            return(
              <Pressable key={row.user_id} style={[styles.row,own && styles.ownRow]} onPress={()=>router.push(`/profile/${row.user_id}`)}>
                <View style={[styles.rankCircle,row.rank<=3 && styles.topRank]}><Text style={[styles.rank,row.rank<=3 && styles.topRankText]}>#{row.rank}</Text></View>
                <Avatar row={row}/>
                <View style={styles.person}>
                  <Text style={styles.name} numberOfLines={1}>{row.full_name}{own ? " · You" : ""}</Text>
                  <Text style={styles.meta} numberOfLines={1}>{row.area || "Area hidden"} · {row.review_count} reviews</Text>
                  <Text style={styles.detail}>{row.verified_reviews} verified · {row.video_reviews} videos</Text>
                </View>
                <View style={styles.pointsBox}>
                  <Text style={styles.points}>{row.points}</Text>
                  <Text style={styles.pointsLabel}>PTS</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={styles.rulesCard}>
        <Text style={styles.rulesTitle}>How your Explorer Score is earned</Text>
        <Text style={styles.rule}>Text review: 1 point</Text>
        <Text style={styles.rule}>Image review: 3 points</Text>
        <Text style={styles.rule}>Video review: 6 points</Text>
        <Text style={styles.rule}>Verified on-site QR scan: +3 points</Text>
        <Text style={styles.ruleNote}>Only one review for the same place per calendar month earns points. Deleted or moderated reviews lose their points.</Text>
      </View>
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  rankCard:{backgroundColor:"#221d30",borderColor:"#50416e",borderWidth:1,borderRadius:16,padding:18,marginBottom:14,alignItems:"center"},
  rankEyebrow:{color:"#a993ed",fontSize:10,fontWeight:"900",letterSpacing:0.7},
  rankValue:{color:"white",fontSize:38,fontWeight:"900",marginTop:6},
  rankMeta:{color:"#c9b9f7",fontSize:13,textAlign:"center",marginTop:6,lineHeight:19},
  screen:{flex:1,backgroundColor:"#18181b"},
  content:{padding:18,paddingBottom:60},
  eyebrow:{color:"#aa96ee",fontSize:11,fontWeight:"900",letterSpacing:0.8},
  title:{color:"white",fontSize:32,fontWeight:"900",marginTop:5},
  subtitle:{color:"#aaaab3",fontSize:15,lineHeight:22,marginTop:7,marginBottom:17},
  tabs:{flexDirection:"row",backgroundColor:"#222226",borderRadius:13,padding:4,marginBottom:9},
  tab:{flex:1,padding:11,borderRadius:10,alignItems:"center"},
  tabActive:{backgroundColor:"#3212b6"},
  tabText:{color:"#9999a2",fontWeight:"900"},
  tabTextActive:{color:"white"},
  areaPill:{alignSelf:"flex-start",backgroundColor:"#27213a",borderColor:"#53467b",borderWidth:1,borderRadius:20,paddingHorizontal:12,paddingVertical:7,marginTop:4,marginBottom:12},
  areaText:{color:"#c9bbf3",fontWeight:"800",fontSize:12},
  loadingBox:{padding:50,alignItems:"center"},
  noticeCard:{backgroundColor:"#222226",borderColor:"#44444b",borderWidth:1,borderRadius:16,padding:20,marginTop:8},
  noticeTitle:{color:"white",fontSize:19,fontWeight:"900"},
  noticeText:{color:"#aaaab3",lineHeight:21,marginTop:7},
  primaryButton:{backgroundColor:"#3212b6",borderRadius:11,padding:14,marginTop:15},
  primaryText:{color:"white",fontWeight:"900",textAlign:"center"},
  errorCard:{backgroundColor:"#3b171b",borderColor:"#80353d",borderWidth:1,borderRadius:13,padding:15},
  errorText:{color:"#ffb2ba",fontWeight:"700"},
  list:{gap:9},
  row:{backgroundColor:"#222226",borderColor:"#414147",borderWidth:1,borderRadius:15,padding:12,flexDirection:"row",alignItems:"center"},
  ownRow:{backgroundColor:"#271f3f",borderColor:"#6650a3"},
  rankCircle:{width:42,height:42,borderRadius:21,backgroundColor:"#303036",alignItems:"center",justifyContent:"center",marginRight:10},
  topRank:{backgroundColor:"#5a410a",borderColor:"#a27a19",borderWidth:1},
  rank:{color:"#c4c4cc",fontWeight:"900",fontSize:12},
  topRankText:{color:"#ffd668"},
  avatar:{width:48,height:48,borderRadius:24,backgroundColor:"#303036"},
  avatarFallback:{width:48,height:48,borderRadius:24,backgroundColor:"#3212b6",alignItems:"center",justifyContent:"center"},
  avatarLetter:{color:"white",fontSize:20,fontWeight:"900"},
  person:{flex:1,marginLeft:10},
  name:{color:"white",fontWeight:"900",fontSize:16},
  meta:{color:"#9f9fa8",fontSize:11,marginTop:3},
  detail:{color:"#b7a9df",fontSize:10,marginTop:3},
  pointsBox:{alignItems:"center",marginLeft:8,minWidth:48},
  points:{color:"#c4b0ff",fontSize:21,fontWeight:"900"},
  pointsLabel:{color:"#87818f",fontSize:9,fontWeight:"900",letterSpacing:0.6},
  rulesCard:{backgroundColor:"#211d2d",borderColor:"#4d4265",borderWidth:1,borderRadius:15,padding:17,marginTop:20},
  rulesTitle:{color:"white",fontSize:18,fontWeight:"900",marginBottom:8},
  rule:{color:"#c9c4d4",lineHeight:21},
  ruleNote:{color:"#90899e",fontSize:11,lineHeight:17,marginTop:9}
});

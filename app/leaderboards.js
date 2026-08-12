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
import {INK} from "../utils/tokens";

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
        Decision 1, settled: this ranks on explorer_score_events, the scoring
        ledger. It used to add up review points only, so a board called Explorer
        Score measured nothing except how much you had written. It now counts
        reviews, check-ins and endorsements, each dated and capped.
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
              {/*
                Points and nothing else. The review count used to sit here, and
                next to a ledger total it is a leak: review points are fixed
                (5, or 15 verified), so points minus review points is check-in
                points, and the halving rule turns that back into roughly how
                many different places somebody has been. Your own split is
                yours -- get_explorer_score_breakdown() -- and is not on a
                public board.
              */}
              <Text style={styles.rankMeta}>
                {ownRow.points} point{ownRow.points===1 ? "" : "s"} this {period==="monthly" ? "month" : "week"}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.rankValue}>—</Text>
              {/* An instruction, not a mood. design-system.md bans the mood. */}
              <Text style={styles.rankMeta}>
                {profile?.leaderboard_opt_in===false
                  ? "You have opted out of leaderboards. Turn it on in your profile to appear here."
                  : "Review somewhere you went, or check in while you are there, and you will appear here."}
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
        <View style={styles.loadingBox}><ActivityIndicator size="large" color={INK.blue}/></View>
      ) : error ? (
        <View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text></View>
      ) : rows.length===0 ? (
        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>No points yet</Text>
          <Text style={styles.noticeText}>Write a review, check in somewhere, or be useful to another Explorer. The first points in this period start the board.</Text>
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
                  <Text style={styles.meta} numberOfLines={1}>{row.area || "Area hidden"}</Text>
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

      {/*
        These are the ledger's rules (20260810040000 and 20260812150000), not
        the old review-points table. Getting this wrong is worse than saying
        nothing: a scoring rule people read and act on has to be the rule that
        runs.
      */}
      <View style={styles.rulesCard}>
        <Text style={styles.rulesTitle}>How your Explorer Score is earned</Text>
        <Text style={styles.rule}>Write a review: 5 points</Text>
        <Text style={styles.rule}>Review with the QR scanned on site: 15 points</Text>
        <Text style={styles.rule}>Check in somewhere new: 10 points</Text>
        <Text style={styles.rule}>Somebody finds your review useful: 1 point</Text>
        <Text style={styles.ruleNote}>Checking in at the same place again is worth less each time — the score rewards seeing your area, not one habit. A review earns up to 5 points from other Explorers finding it useful. Deleting a review, or somebody taking their endorsement back, removes those points.</Text>
      </View>
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  rankCard:{backgroundColor:INK.blue,borderColor:INK.blue,borderWidth:1,borderRadius:16,padding:18,marginBottom:14,alignItems:"center"},
  rankEyebrow:{color:INK.card,fontSize:10,fontWeight:"900",letterSpacing:0.7},
  rankValue:{color:INK.card,fontSize:38,fontWeight:"900",marginTop:6},
  rankMeta:{color:INK.card,fontSize:13,textAlign:"center",marginTop:6,lineHeight:19},
  screen:{flex:1,backgroundColor:INK.paper},
  content:{padding:18,paddingBottom:60},
  eyebrow:{color:INK.blue,fontSize:11,fontWeight:"900",letterSpacing:0.8},
  title:{color:INK.ink,fontSize:32,fontWeight:"900",marginTop:5},
  subtitle:{color:INK.inkSoft,fontSize:15,lineHeight:22,marginTop:7,marginBottom:17},
  tabs:{flexDirection:"row",backgroundColor:INK.card,borderRadius:13,padding:4,marginBottom:9},
  tab:{flex:1,padding:11,borderRadius:10,alignItems:"center"},
  tabActive:{backgroundColor:INK.blue},
  tabText:{color:INK.card,fontWeight:"900"},
  tabTextActive:{color:INK.card},
  areaPill:{alignSelf:"flex-start",backgroundColor:INK.blue,borderColor:INK.blue,borderWidth:1,borderRadius:20,paddingHorizontal:12,paddingVertical:7,marginTop:4,marginBottom:12},
  areaText:{color:INK.card,fontWeight:"800",fontSize:12},
  loadingBox:{padding:50,alignItems:"center"},
  noticeCard:{backgroundColor:INK.card,borderColor:INK.ink,borderWidth:1,borderRadius:16,padding:20,marginTop:8},
  noticeTitle:{color:INK.ink,fontSize:19,fontWeight:"900"},
  noticeText:{color:INK.inkSoft,lineHeight:21,marginTop:7},
  primaryButton:{backgroundColor:INK.blue,borderRadius:11,padding:14,marginTop:15},
  primaryText:{color:INK.card,fontWeight:"900",textAlign:"center"},
  errorCard:{backgroundColor:INK.red,borderColor:INK.red,borderWidth:1,borderRadius:13,padding:15},
  errorText:{color:INK.card,fontWeight:"700"},
  list:{gap:9},
  row:{backgroundColor:INK.card,borderColor:INK.ink,borderWidth:1,borderRadius:15,padding:12,flexDirection:"row",alignItems:"center"},
  ownRow:{borderColor:INK.blue,borderWidth:2},
  rankCircle:{width:42,height:42,borderRadius:21,backgroundColor:INK.card,alignItems:"center",justifyContent:"center",marginRight:10},
  topRank:{backgroundColor:INK.red,borderColor:INK.red,borderWidth:1},
  rank:{color:INK.ink,fontWeight:"900",fontSize:12},
  topRankText:{color:INK.card},
  avatar:{width:48,height:48,borderRadius:24,backgroundColor:INK.card},
  avatarFallback:{width:48,height:48,borderRadius:24,backgroundColor:INK.blue,alignItems:"center",justifyContent:"center"},
  avatarLetter:{color:INK.card,fontSize:20,fontWeight:"900"},
  person:{flex:1,marginLeft:10},
  name:{color:INK.ink,fontWeight:"900",fontSize:16},
  meta:{color:INK.inkSoft,fontSize:11,marginTop:3},
  detail:{color:INK.inkSoft,fontSize:10,marginTop:3},
  pointsBox:{alignItems:"center",marginLeft:8,minWidth:48},
  points:{color:INK.blue,fontSize:21,fontWeight:"900"},
  pointsLabel:{color:INK.inkSoft,fontSize:9,fontWeight:"900",letterSpacing:0.6},
  rulesCard:{backgroundColor:INK.blue,borderColor:INK.blue,borderWidth:1,borderRadius:15,padding:17,marginTop:20},
  rulesTitle:{color:INK.card,fontSize:18,fontWeight:"900",marginBottom:8},
  rule:{color:INK.card,lineHeight:21},
  ruleNote:{color:INK.card,fontSize:11,lineHeight:17,marginTop:9}
});

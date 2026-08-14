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
import {TYPE} from "../styles/typography";

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
      <Text style={TYPE.sectionLabel}>Explorer Score Rankings</Text>
      <Text style={TYPE.display}>Leaderboard</Text>
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
        <View style={styles.areaPill}><Text style={styles.areaText}>{profile.area.trim()}</Text></View>
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
        <View style={styles.loadingBox}><ActivityIndicator size="large" color={INK.ink}/></View>
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
            const plated=row.rank<=3;
            return(
              <Pressable key={row.user_id} style={[styles.row,own && styles.ownRow]} onPress={()=>router.push(`/profile/${row.user_id}`)}>
                {/* Ranks 1-3 sit on an ink plate: card-coloured numeral on ink,
                    the same white-on-ink legibility pairing every raised
                    control in this design uses. No state ink, this is not a
                    place. */}
                <View style={[styles.rankBox,plated && styles.rankPlate]}>
                  <Text style={[styles.rank,plated && styles.rankPlateText]}>{row.rank}</Text>
                </View>
                <Avatar row={row}/>
                <View style={styles.person}>
                  <Text style={TYPE.rowTitle} numberOfLines={1}>{row.full_name}{own ? " · You" : ""}</Text>
                  <Text style={TYPE.meta} numberOfLines={1}>{row.area || "Area hidden"}</Text>
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
      <View style={styles.section}>
        <View style={styles.sectionHead}><Text style={TYPE.sectionLabel}>How your Explorer Score is earned</Text></View>
        <Text style={styles.rule}>Write a review: 5 points</Text>
        <Text style={styles.rule}>Review with the QR scanned on site: 15 points</Text>
        <Text style={styles.rule}>Check in somewhere new: 10 points</Text>
        <Text style={styles.rule}>Somebody finds your review useful: 1 point</Text>
        <Text style={styles.ruleNote}>Checking in at the same place again is worth less each time — the score rewards seeing your area, not one habit. A review earns up to 5 points from other Explorers finding it useful. Deleting a review, or somebody taking their endorsement back, removes those points.</Text>
      </View>
    </ScrollView>
  );
}

// No state inks here: blue/pink/yellow mean a place's state and red/green are
// the manager's review-response pair alone (design round r001-a). Emphasis
// comes from the ink plate and the numeral scale instead of colour.
const styles=StyleSheet.create({
  rankCard:{backgroundColor:INK.card,borderColor:INK.ink,borderWidth:2,borderRadius:4,padding:18,marginBottom:14,alignItems:"center"},
  rankEyebrow:{color:INK.inkSoft,fontSize:10,fontWeight:"800",letterSpacing:1.2},
  rankValue:{...TYPE.numeral,fontSize:38,marginTop:6},
  rankMeta:{color:INK.ink,fontSize:13,textAlign:"center",marginTop:6,lineHeight:19},
  screen:{flex:1,backgroundColor:INK.paper},
  content:{padding:18,paddingBottom:60},
  subtitle:{color:INK.inkSoft,fontSize:15,lineHeight:22,marginTop:7,marginBottom:17},
  tabs:{flexDirection:"row",gap:8,marginBottom:9},
  tab:{flex:1,padding:11,borderRadius:4,alignItems:"center",borderWidth:2,borderColor:INK.ink,backgroundColor:INK.card},
  tabActive:{backgroundColor:INK.ink},
  tabText:{color:INK.ink,fontWeight:"800",fontSize:12},
  tabTextActive:{color:INK.card},
  areaPill:{alignSelf:"flex-start",backgroundColor:INK.card,borderColor:INK.ink,borderWidth:2,borderRadius:4,paddingHorizontal:12,paddingVertical:7,marginTop:4,marginBottom:12},
  areaText:{...TYPE.meta,color:INK.ink},
  loadingBox:{padding:50,alignItems:"center"},
  noticeCard:{backgroundColor:INK.card,borderColor:INK.ink,borderWidth:2,borderRadius:4,padding:20,marginTop:8},
  noticeTitle:{color:INK.ink,fontSize:19,fontWeight:"900"},
  noticeText:{color:INK.inkSoft,lineHeight:21,marginTop:7},
  primaryButton:{backgroundColor:INK.ink,borderWidth:2,borderColor:INK.ink,borderRadius:4,padding:14,marginTop:15},
  primaryText:{color:INK.card,fontWeight:"900",textAlign:"center"},
  errorCard:{backgroundColor:INK.card,borderColor:INK.ink,borderWidth:2,borderRadius:4,padding:15},
  errorText:{color:INK.ink,fontWeight:"800"},
  list:{},
  row:{
    flexDirection:"row",alignItems:"center",minHeight:56,paddingVertical:10,gap:10,
    borderBottomWidth:1,borderBottomColor:INK.hair
  },
  ownRow:{borderBottomColor:INK.ink,borderBottomWidth:2},
  // The rank column: fixed width so every numeral, one digit or two, lines up
  // under the next.
  rankBox:{width:40,alignItems:"center",justifyContent:"center"},
  rankPlate:{backgroundColor:INK.ink,borderRadius:4,paddingVertical:4},
  rank:{...TYPE.numeral,fontSize:22},
  rankPlateText:{color:INK.card},
  avatar:{width:36,height:36,borderRadius:4,backgroundColor:INK.card,borderWidth:2,borderColor:INK.ink},
  avatarFallback:{width:36,height:36,borderRadius:4,backgroundColor:INK.card,borderWidth:2,borderColor:INK.ink,alignItems:"center",justifyContent:"center"},
  avatarLetter:{color:INK.ink,fontSize:14,fontWeight:"900"},
  person:{flex:1},
  pointsBox:{alignItems:"flex-end",minWidth:48},
  points:{...TYPE.numeral,fontSize:18},
  pointsLabel:{...TYPE.meta,letterSpacing:0.6},
  section:{marginTop:24},
  sectionHead:{paddingBottom:6,marginBottom:11,borderBottomWidth:2,borderBottomColor:INK.ink},
  rule:{color:INK.ink,lineHeight:21,fontSize:13},
  ruleNote:{color:INK.inkSoft,fontSize:11,lineHeight:17,marginTop:9}
});

import React,{useCallback,useState} from "react";
import {View,Text,StyleSheet,ScrollView,Pressable,ActivityIndicator,TextInput} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../../services/supabase";
import AlexJourneyHeader from "../../components/AlexJourneyHeader";
import {INK} from "../../utils/tokens";

function formatPrice(value){
  const amount=Number(value || 0);
  return amount > 0 ? `£${amount.toFixed(2)}` : "Free";
}

export default function ActivityClubs(){
  const [clubs,setClubs]=useState([]);
  const [stats,setStats]=useState({});
  const [query,setQuery]=useState("");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  useFocusEffect(useCallback(()=>{loadClubs();},[]));

  async function loadClubs(){
    setLoading(true);
    setError("");

    const {data,error:clubError}=await supabase
      .from("activity_clubs")
      .select("*")
      .in("status",["open","full"])
      .order("created_at",{ascending:false});

    if(clubError){
      console.log(clubError);
      setError("Activity Clubs are not connected to Supabase yet.");
      setClubs([]);
      setLoading(false);
      return;
    }

    const rows=data || [];
    setClubs(rows);

    if(rows.length){
      const {data:statsRows}=await supabase
        .from("activity_club_stats")
        .select("club_id,member_count,average_rating,review_count")
        .in("club_id",rows.map(item=>item.id));

      const nextStats={};
      (statsRows || []).forEach(row=>{nextStats[row.club_id]=row;});
      setStats(nextStats);
    }else setStats({});

    setLoading(false);
  }

  const search=query.trim().toLowerCase();
  const filtered=clubs.filter(club=>{
    if(!search) return true;
    return [club.name,club.category,club.location,club.description]
      .filter(Boolean)
      .some(value=>value.toLowerCase().includes(search));
  });

  return(
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <AlexJourneyHeader
        phase="REPEAT"
        title="Find something worth returning to"
        description="Clubs are recurring commitments, not one-off listings. Compare place, community, reputation and cost before you apply."
        meta={`${clubs.length} published`}
      />

      <View style={styles.searchShell}>
        <Text style={styles.searchLabel}>NARROW THE COMMITMENT</Text>
        <TextInput
          style={styles.search}
          placeholder="Activity, club or location"
          placeholderTextColor={INK.inkSoft}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      {loading && <ActivityIndicator size="large" color={INK.brandDeep} style={styles.loader}/>} 

      {!!error && (
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Clubs unavailable</Text>
          <Text style={styles.noticeText}>{error}</Text>
        </View>
      )}

      {!loading && !error && filtered.length===0 && (
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>No clubs match this view</Text>
          <Text style={styles.noticeText}>Try another activity or location.</Text>
        </View>
      )}

      <View style={styles.list}>
        {filtered.map(club=>{
          const clubStats=stats[club.id] || {};
          return(
            <Pressable key={club.id} style={({pressed})=>[styles.card,pressed && styles.cardPressed]} onPress={()=>router.push(`/activity-clubs/${club.id}`)}>
              <View style={styles.cardTop}>
                <View style={styles.categoryBlock}>
                  <Text style={styles.categoryKicker}>CLUB</Text>
                  <Text style={styles.category}>{club.category}</Text>
                </View>
                <View style={[styles.status,club.status==="full" && styles.statusFull]}>
                  <Text style={styles.statusText}>{club.status==="full" ? "Full" : "Open"}</Text>
                </View>
              </View>

              <Text style={styles.clubName}>{club.name}</Text>
              <Text style={styles.location}>📍 {club.location}</Text>

              <View style={styles.evidence}>
                <View style={styles.evidenceItem}><Text style={styles.evidenceValue}>{clubStats.member_count || 0}</Text><Text style={styles.evidenceLabel}>members</Text></View>
                <View style={styles.evidenceItem}><Text style={styles.evidenceValue}>{clubStats.average_rating || 0}</Text><Text style={styles.evidenceLabel}>{clubStats.review_count || 0} reviews</Text></View>
                <View style={styles.evidenceItem}><Text style={styles.evidenceValue}>{formatPrice(club.price)}</Text><Text style={styles.evidenceLabel}>price</Text></View>
              </View>

              <Text style={styles.description} numberOfLines={3}>{club.description}</Text>

              <View style={styles.cardBottom}>
                <Text style={styles.decisionHint}>Open the club before applying</Text>
                <Text style={styles.viewText}>View →</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  container:{flex:1,backgroundColor:INK.paper},
  content:{padding:16,paddingBottom:60},
  searchShell:{backgroundColor:INK.card,borderWidth:1,borderColor:INK.hair,borderRadius:18,padding:12,marginBottom:16},
  searchLabel:{color:INK.brandDeep,fontSize:9,fontWeight:"900",letterSpacing:1,marginBottom:7},
  search:{backgroundColor:INK.paper,borderRadius:13,paddingHorizontal:14,paddingVertical:13,color:INK.ink,fontSize:15},
  loader:{marginTop:40},
  notice:{backgroundColor:INK.card,padding:20,borderRadius:18,borderWidth:1,borderColor:INK.hair},
  noticeTitle:{fontSize:18,fontWeight:"900",color:INK.ink,marginBottom:7},
  noticeText:{color:INK.inkSoft,lineHeight:21},
  list:{gap:12},
  card:{backgroundColor:INK.card,padding:17,borderRadius:22,borderWidth:1,borderColor:INK.hair},
  cardPressed:{backgroundColor:INK.sky},
  cardTop:{flexDirection:"row",justifyContent:"space-between",alignItems:"flex-start",gap:12},
  categoryBlock:{flex:1},
  categoryKicker:{color:INK.lavender,fontSize:9,fontWeight:"900",letterSpacing:1},
  category:{color:INK.inkSoft,fontSize:12,fontWeight:"800",marginTop:2},
  status:{backgroundColor:INK.brand,borderRadius:99,paddingHorizontal:10,paddingVertical:6},
  statusFull:{backgroundColor:INK.sky},
  statusText:{color:INK.navy,fontSize:10,fontWeight:"900"},
  clubName:{fontSize:23,lineHeight:27,fontWeight:"900",color:INK.ink,marginTop:13},
  location:{color:INK.inkSoft,marginTop:6,fontSize:13},
  evidence:{flexDirection:"row",marginTop:15,backgroundColor:INK.navy,borderRadius:17,padding:10,gap:7},
  evidenceItem:{flex:1,minWidth:0},
  evidenceValue:{color:INK.onNavy,fontSize:14,fontWeight:"900"},
  evidenceLabel:{color:INK.onNavySoft,fontSize:9,fontWeight:"700",marginTop:2},
  description:{color:INK.inkSoft,lineHeight:20,marginTop:13},
  cardBottom:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:10,marginTop:15},
  decisionHint:{color:INK.inkSoft,fontSize:11,flex:1},
  viewText:{fontWeight:"900",color:INK.brandDeep,fontSize:13}
});

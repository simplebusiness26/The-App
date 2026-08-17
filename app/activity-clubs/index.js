import React,{useCallback,useState} from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  TextInput
} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../../services/supabase";
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

  useFocusEffect(
    useCallback(()=>{
      loadClubs();
    },[])
  );

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
      (statsRows || []).forEach(row=>{
        nextStats[row.club_id]=row;
      });
      setStats(nextStats);
    }else{
      setStats({});
    }

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
      <Text style={styles.title}>Activity Clubs</Text>
      <Text style={styles.subtitle}>
        Discover local groups, read their reviews and apply to join.
      </Text>

      <TextInput
        style={styles.search}
        placeholder="Search activities or locations"
        value={query}
        onChangeText={setQuery}
      />

      {loading && <ActivityIndicator size="large" color={INK.ink} style={styles.loader}/>}

      {!!error && (
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Supabase setup required</Text>
          <Text style={styles.noticeText}>{error}</Text>
        </View>
      )}

      {!loading && !error && filtered.length===0 && (
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>No clubs found</Text>
          <Text style={styles.noticeText}>No published activity clubs match this search.</Text>
        </View>
      )}

      {filtered.map(club=>{
        const clubStats=stats[club.id] || {};
        return(
          <Pressable
            key={club.id}
            style={styles.card}
            onPress={()=>router.push(`/activity-clubs/${club.id}`)}
          >
            <View style={styles.badgeRow}>
              <Text style={styles.category}>{club.category}</Text>
              <Text style={styles.status}>{club.status==="full" ? "Full" : "Open"}</Text>
            </View>

            <Text style={styles.clubName}>{club.name}</Text>
            <Text style={styles.location}>📍 {club.location}</Text>
            <Text style={styles.description} numberOfLines={3}>{club.description}</Text>

            <View style={styles.statsRow}>
              <Text style={styles.stat}>👥 {clubStats.member_count || 0}</Text>
              <Text style={styles.stat}>⭐ {clubStats.average_rating || 0} ({clubStats.review_count || 0})</Text>
              <Text style={styles.stat}>{formatPrice(club.price)}</Text>
            </View>

            <Text style={styles.viewText}>View club profile →</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// Riso tokens only. Open/full is a mono status label, not a colour -- see the
// UI spec's own note: a third pin colour was never on the table, and this
// list should not invent one behind the map's back either.
const styles=StyleSheet.create({
  container:{flex:1,backgroundColor:INK.paper},
  content:{padding:20,paddingBottom:50},
  title:{fontSize:32,fontWeight:"900",color:INK.ink},
  subtitle:{fontSize:15,color:INK.inkSoft,lineHeight:22,marginTop:8,marginBottom:18},
  search:{backgroundColor:INK.card,borderWidth:2,borderColor:INK.ink,borderRadius:12,padding:14,marginBottom:18,color:INK.ink},
  loader:{marginTop:40},
  notice:{backgroundColor:INK.card,padding:20,borderRadius:14,borderWidth:2,borderColor:INK.ink},
  noticeTitle:{fontSize:18,fontWeight:"800",marginBottom:7,color:INK.ink},
  noticeText:{color:INK.ink,lineHeight:21},
  card:{
    backgroundColor:INK.card,padding:18,borderRadius:16,borderWidth:2,borderColor:INK.ink,marginBottom:16,
    shadowColor:INK.ink,shadowOffset:{width:3,height:3},shadowOpacity:1,shadowRadius:0,elevation:0
  },
  badgeRow:{flexDirection:"row",justifyContent:"space-between"},
  category:{borderWidth:2,borderColor:INK.ink,color:INK.ink,paddingHorizontal:10,paddingVertical:5,borderRadius:20,fontWeight:"800",fontSize:11},
  status:{borderWidth:2,borderColor:INK.hair,color:INK.inkSoft,paddingHorizontal:10,paddingVertical:5,borderRadius:20,fontWeight:"800",fontSize:11,textTransform:"uppercase",letterSpacing:0.6},
  clubName:{fontSize:23,fontWeight:"800",marginTop:14,color:INK.ink},
  location:{color:INK.inkSoft,marginTop:6},
  description:{color:INK.ink,lineHeight:21,marginTop:12},
  statsRow:{flexDirection:"row",justifyContent:"space-between",marginTop:16},
  stat:{fontWeight:"800",color:INK.inkSoft,fontSize:12},
  viewText:{fontWeight:"800",color:INK.ink,marginTop:16}
});

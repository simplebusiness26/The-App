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

      {loading && <ActivityIndicator size="large" style={styles.loader}/>} 

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

const styles=StyleSheet.create({
  container:{flex:1,backgroundColor:INK.card},
  content:{padding:20,paddingBottom:50},
  title:{fontSize:32,fontWeight:"bold"},
  subtitle:{fontSize:16,color:INK.ink,lineHeight:23,marginTop:8,marginBottom:18},
  search:{backgroundColor:INK.card,borderWidth:1,borderColor:INK.hair,borderRadius:12,padding:15,marginBottom:18},
  loader:{marginTop:40},
  notice:{backgroundColor:INK.card,padding:20,borderRadius:14,borderWidth:1,borderColor:INK.hair},
  noticeTitle:{fontSize:18,fontWeight:"bold",marginBottom:7},
  noticeText:{color:INK.ink,lineHeight:21},
  card:{backgroundColor:INK.card,padding:18,borderRadius:16,borderWidth:1,borderColor:INK.ink,marginBottom:16},
  badgeRow:{flexDirection:"row",justifyContent:"space-between"},
  category:{backgroundColor:INK.card,color:INK.blue,paddingHorizontal:10,paddingVertical:6,borderRadius:20,fontWeight:"bold",fontSize:12},
  status:{backgroundColor:INK.card,paddingHorizontal:10,paddingVertical:6,borderRadius:20,fontWeight:"bold",fontSize:12},
  clubName:{fontSize:23,fontWeight:"bold",marginTop:14},
  location:{color:INK.ink,marginTop:6},
  description:{color:INK.ink,lineHeight:21,marginTop:12},
  statsRow:{flexDirection:"row",justifyContent:"space-between",marginTop:16},
  stat:{fontWeight:"600",color:INK.ink,fontSize:13},
  viewText:{fontWeight:"bold",color:INK.blue,marginTop:16}
});

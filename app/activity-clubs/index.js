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
import {TYPE} from "../../styles/typography";

// GAZETTEER PASS (design round r001-a, directive 10): the same browse and the
// same search, drawn as an index -- a section header carrying the count over
// a 2px rule, then one-line ledger rows with a hairline between them. Same
// query, same filter, same route -- only how it is drawn changed.

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
      <Text style={TYPE.sectionLabel}>Local Groups</Text>
      <Text style={TYPE.display}>Activity Clubs</Text>
      <Text style={styles.lead}>Discover local groups, read their reviews and apply to join.</Text>

      <TextInput
        style={styles.search}
        placeholder="Search activities or locations"
        placeholderTextColor={INK.inkSoft}
        value={query}
        onChangeText={setQuery}
        accessibilityLabel="Search activities or locations"
      />

      {loading && <ActivityIndicator size="large" color={INK.ink} style={styles.loader}/>}

      {!!error && (
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Supabase setup required</Text>
          <Text style={styles.noticeText}>{error}</Text>
        </View>
      )}

      {!loading && !error && (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={TYPE.sectionLabel}>Clubs</Text>
            <Text style={styles.count}>{filtered.length}</Text>
          </View>

          {filtered.length===0 ? (
            <Text style={styles.emptyText}>No published activity clubs match this search.</Text>
          ) : filtered.map(club=>{
            const clubStats=stats[club.id] || {};
            return(
              <Pressable
                key={club.id}
                style={styles.row}
                accessibilityRole="button"
                accessibilityLabel={`${club.name}. ${club.status==="full" ? "Full" : "Open"}.`}
                onPress={()=>router.push(`/activity-clubs/${club.id}`)}
              >
                <View style={styles.textCol}>
                  <Text style={TYPE.rowTitle} numberOfLines={1}>{club.name}</Text>
                  <Text style={TYPE.meta} numberOfLines={1}>
                    {club.category}{club.location ? ` · ${club.location}` : ""} · {club.status==="full" ? "Full" : "Open"}
                  </Text>
                </View>
                <View style={styles.endCol}>
                  <Text style={styles.priceNum} numberOfLines={1}>{formatPrice(club.price)}</Text>
                  <Text style={styles.endMeta} numberOfLines={1}>
                    ★ {clubStats.average_rating || 0} ({clubStats.review_count || 0}) · {clubStats.member_count || 0} members
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  container:{flex:1,backgroundColor:INK.paper},
  content:{padding:20,paddingBottom:50},
  lead:{fontSize:14,lineHeight:21,color:INK.inkSoft,marginTop:6,marginBottom:2},
  search:{
    backgroundColor:INK.card,
    borderWidth:2,
    borderColor:INK.ink,
    borderRadius:4,
    paddingHorizontal:14,
    paddingVertical:13,
    marginTop:16,
    color:INK.ink,
    fontSize:15
  },
  loader:{marginTop:40},
  notice:{
    backgroundColor:INK.card,
    borderWidth:2,
    borderColor:INK.ink,
    borderRadius:4,
    padding:16,
    marginTop:18
  },
  noticeTitle:{...TYPE.rowTitle,marginBottom:6},
  noticeText:{...TYPE.body,color:INK.inkSoft},
  section:{marginTop:20},
  sectionHead:{
    flexDirection:"row",
    alignItems:"flex-end",
    justifyContent:"space-between",
    paddingBottom:6,
    borderBottomWidth:2,
    borderBottomColor:INK.ink
  },
  count:{...TYPE.numeral,fontSize:16},
  emptyText:{...TYPE.meta,paddingVertical:12},
  row:{
    flexDirection:"row",
    alignItems:"center",
    minHeight:52,
    paddingVertical:10,
    gap:10,
    borderBottomWidth:1,
    borderBottomColor:INK.hair
  },
  textCol:{flex:1},
  endCol:{alignItems:"flex-end",gap:3,maxWidth:180},
  priceNum:{...TYPE.numeral,fontSize:14,textAlign:"right"},
  endMeta:{...TYPE.meta,textAlign:"right"}
});

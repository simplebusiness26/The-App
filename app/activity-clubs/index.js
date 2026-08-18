import React,{useCallback,useState} from "react";
import {View,Text,StyleSheet,ScrollView,ActivityIndicator,TextInput} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../../services/supabase";
import {INK,TYPE} from "../../utils/tokens";
import {
  Chip,
  Empty,
  Field,
  Glyph,
  Meter,
  MONO,
  Notice,
  Row,
  Screen,
  ScreenTitle,
  SectionRule,
  fieldInputStyle
} from "../../components/instrument";
import {CREATE_HUB_CLEARANCE} from "../../components/CreateHub";

// Activity Clubs. RULES.md: a club is a recurring thing and it has SESSIONS --
// which is why utils/markers.js paints its pin amber. A club is not a place
// that merely exists; it is a place something keeps happening at, so its rows
// carry the same `scheduled` edge the rest of this tab does.
//
// WHAT CHANGED
//
// The list was a stack of bordered boxes with a hard offset shadow each, a map
// pin emoji before the location, and a footer that read as two silhouettes, a
// six, a star, a rating and a price -- three measurements rendered as
// emoji-prefixed body text, which is exactly the thing docs/design-system.md's
// mono/sans split exists to stop. Members, score and price are numbers the app
// worked out, so they are mono now: the count in the meta column, the rest on a
// measured foot line under the name.

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
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenTitle
          eyebrow="RECURRING"
          title="Activity Clubs"
          meta="Discover local groups, read their reviews and apply to join."
        />

        <View style={styles.body}>
          <Field label="Search">
            <TextInput
              style={fieldInputStyle}
              placeholder="Search activities or locations"
              placeholderTextColor={INK.readoutFaint}
              accessibilityLabel="Search activities or locations"
              value={query}
              onChangeText={setQuery}
            />
          </Field>

          {loading && <ActivityIndicator size="large" color={INK.readout} style={styles.loader}/>}

          {!!error && (
            <Notice tone="dispute" label="SUPABASE SETUP REQUIRED">{error}</Notice>
          )}

          {!loading && !error && <SectionRule label="Clubs" meta={String(filtered.length)}/>}

          {!loading && !error && filtered.length===0 && (
            <Empty
              title="No clubs found"
              instruction="No published Activity Clubs match this search. Try a shorter word, or start one from Create."
              glyph="people"
            />
          )}

          {filtered.map(club=>{
            const clubStats=stats[club.id] || {};
            const score=Number(clubStats.average_rating || 0);
            const reviews=Number(clubStats.review_count || 0);

            return(
              <Row
                key={club.id}
                tone="scheduled"
                glyph="people"
                title={club.name}
                sub={club.description}
                meta={`${clubStats.member_count || 0} MEMBERS`}
                // Open or full is a status the app holds, not a colour. A third
                // pin ink was never on the table and this list must not invent
                // one behind the map's back.
                metaSub={club.status==="full" ? "FULL" : "OPEN"}
                onPress={()=>router.push(`/activity-clubs/${club.id}`)}
              >
                <View style={styles.foot}>
                  {!!club.category && <Chip label={club.category} style={styles.chip}/>}
                  <View style={styles.footCell}>
                    <Glyph name="pin" size={11} colour={INK.readoutFaint}/>
                    <Text style={styles.footText} numberOfLines={1}>{club.location}</Text>
                  </View>
                  <Text style={styles.price}>{formatPrice(club.price).toUpperCase()}</Text>
                </View>

                {/* A score is a measurement, so it is read off a ticked track
                    rather than counted out in repeated star characters. */}
                {reviews>0 && (
                  <View style={styles.rating} accessibilityLabel={`Rated ${score} out of 5 from ${reviews} reviews`}>
                    <Meter value={score} max={5} width={78} tone="exists" label="RATED"/>
                    <Text style={styles.ratingValue}>{score}/5 · {reviews}</Text>
                  </View>
                )}
              </Row>
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles=StyleSheet.create({
  content:{paddingBottom:24+CREATE_HUB_CLEARANCE},
  body:{paddingHorizontal:16},
  loader:{marginTop:40},

  foot:{flexDirection:"row",alignItems:"center",flexWrap:"wrap",gap:8,marginTop:8},
  footCell:{flexDirection:"row",alignItems:"center",gap:4,flexShrink:1},
  footText:{
    color:INK.readoutFaint,fontFamily:MONO,fontSize:TYPE.data.sizes.sm,
    textTransform:"uppercase",letterSpacing:0.6,flexShrink:1
  },
  chip:{minHeight:24,paddingVertical:3},
  price:{
    color:INK.readout,fontFamily:MONO,fontSize:TYPE.data.sizes.sm,
    letterSpacing:0.8,marginLeft:"auto"
  },

  rating:{flexDirection:"row",alignItems:"center",gap:8,marginTop:9},
  ratingValue:{
    color:INK.readoutSoft,fontFamily:MONO,fontSize:TYPE.data.sizes.sm,letterSpacing:0.6
  }
});

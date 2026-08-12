import React,{useCallback,useState} from "react";
import {View,Text,Image,Pressable,ScrollView,ActivityIndicator,StyleSheet} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../../services/supabase";
import {entityTypeLabel} from "../../utils/places";
import {INK} from "../../utils/tokens";

// The inbox. This file replaces the honest "not built yet" placeholder that
// stood here while the footer was being judged with all five tabs in place.
//
// TWO KINDS OF CONVERSATION, AND THE DIFFERENCE IS VISIBLE
//
//   friend    two Explorers who follow each other
//   listing   anybody, to whoever manages a place, about that place
//
// A manager needs to tell them apart at a glance: one is a friend, one is
// somebody asking whether the kitchen is still open. So a listing thread wears
// the listing's name and the friend thread does not.

function when(value){
  const then=new Date(value).getTime();
  if(!Number.isFinite(then)) return "";
  const minutes=Math.floor((Date.now()-then)/60000);
  if(minutes<1) return "now";
  if(minutes<60) return `${minutes}m`;
  if(minutes<1440) return `${Math.floor(minutes/60)}h`;
  return `${Math.floor(minutes/1440)}d`;
}

export default function Messages(){
  const [rows,setRows]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  const load=useCallback(async()=>{
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){router.replace("/auth/login");return;}

    const {data,error:loadError}=await supabase.rpc("get_conversations");

    if(loadError){
      setError("Your messages could not be loaded.");
      setRows([]);
    }else{
      setRows(data || []);
    }
    setLoading(false);
  },[]);

  useFocusEffect(useCallback(()=>{load();},[load]));

  if(loading){
    return <View style={styles.centre}><ActivityIndicator size="large" color={INK.ink}/></View>;
  }

  return(
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Messages</Text>

      {!!error && <View style={styles.card}><Text style={styles.muted}>{error}</Text></View>}

      {!error && !rows.length && (
        <View style={styles.card}>
          <Text style={styles.emptyTitle}>Nothing here yet</Text>
          {/* An instruction, not a mood. Both routes in, named. */}
          <Text style={styles.muted}>
            You can message an Explorer once you follow each other, from their profile.
            You can message whoever manages a place from its page, about that place.
          </Text>
          <Pressable
            style={styles.button}
            accessibilityRole="button"
            accessibilityLabel="Find Explorers"
            onPress={()=>router.push("/explorers")}
          >
            <Text style={styles.buttonText}>Find Explorers</Text>
          </Pressable>
        </View>
      )}

      {rows.map((row)=>(
        <Pressable
          key={row.conversation_id}
          style={styles.row}
          accessibilityRole="button"
          accessibilityLabel={`Open conversation with ${row.other_name}${row.unread_count ? `, ${row.unread_count} unread` : ""}`}
          onPress={()=>router.push(`/messages/${row.conversation_id}`)}
        >
          {row.other_photo
            ? <Image source={{uri:row.other_photo}} style={styles.avatar}/>
            : <View style={[styles.avatar,styles.avatarBlank]}><Text style={styles.initial}>{(row.other_name || "E").slice(0,1)}</Text></View>}

          <View style={styles.rowText}>
            <Text style={styles.name} numberOfLines={1}>{row.other_name}</Text>
            {row.kind==="listing" && (
              <Text style={styles.about} numberOfLines={1}>
                About a {entityTypeLabel(row.target_type).toLowerCase()}
              </Text>
            )}
            <Text style={styles.preview} numberOfLines={1}>{row.last_message || "No messages yet"}</Text>
          </View>

          <View style={styles.rowEnd}>
            <Text style={styles.time}>{when(row.last_message_at)}</Text>
            {row.unread_count>0 && (
              <View style={styles.unread}><Text style={styles.unreadText}>{row.unread_count}</Text></View>
            )}
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const card={backgroundColor:INK.card,borderWidth:2,borderColor:INK.ink,borderRadius:12};

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:INK.paper},
  content:{padding:16,paddingBottom:110},
  centre:{flex:1,backgroundColor:INK.paper,alignItems:"center",justifyContent:"center"},
  title:{color:INK.ink,fontSize:30,fontWeight:"900",marginBottom:14},
  card:{...card,padding:18},
  emptyTitle:{color:INK.ink,fontWeight:"800",fontSize:17,marginBottom:6},
  muted:{color:INK.inkSoft,fontSize:14,lineHeight:20},
  button:{marginTop:14,alignSelf:"flex-start",borderWidth:2,borderColor:INK.ink,borderRadius:99,paddingHorizontal:16,paddingVertical:8,backgroundColor:INK.paper},
  buttonText:{color:INK.ink,fontWeight:"800"},
  row:{...card,flexDirection:"row",alignItems:"center",gap:11,padding:11,marginBottom:10},
  avatar:{width:46,height:46,borderRadius:23,backgroundColor:INK.hair},
  avatarBlank:{alignItems:"center",justifyContent:"center"},
  initial:{color:INK.ink,fontWeight:"900",fontSize:18},
  rowText:{flex:1},
  name:{color:INK.ink,fontWeight:"800",fontSize:15},
  about:{color:INK.inkSoft,fontSize:11,fontWeight:"800",marginTop:1},
  preview:{color:INK.inkSoft,fontSize:13,marginTop:2},
  rowEnd:{alignItems:"flex-end",gap:5},
  time:{color:INK.inkSoft,fontSize:11},
  unread:{minWidth:22,height:22,borderRadius:11,backgroundColor:INK.ink,alignItems:"center",justifyContent:"center",paddingHorizontal:6},
  unreadText:{color:INK.card,fontSize:11,fontWeight:"900"}
});

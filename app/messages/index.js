import React,{useCallback,useMemo,useState} from "react";
import {View,Text,Image,Pressable,ScrollView,ActivityIndicator,StyleSheet} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../../services/supabase";
import {entityTypeLabel} from "../../utils/places";
import {MESSAGE_VIEWS,DEFAULT_MESSAGE_VIEW,conversationsFor,listingSubtitle,unreadFor} from "../../utils/messageViews";
import AlexJourneyHeader from "../../components/AlexJourneyHeader";
import {INK} from "../../utils/tokens";

function when(value){
  const then=new Date(value).getTime();
  if(!Number.isFinite(then)) return "";
  const minutes=Math.floor((Date.now()-then)/60000);
  if(minutes<1) return "now";
  if(minutes<60) return `${minutes}m`;
  if(minutes<1440) return `${Math.floor(minutes/60)}h`;
  return `${Math.floor(minutes/1440)}d`;
}

const BOARD_LABEL={linkup:"Link-up",activity_club:"Activity club"};

export default function Messages(){
  const [rows,setRows]=useState([]);
  const [boards,setBoards]=useState([]);
  const [view,setView]=useState(DEFAULT_MESSAGE_VIEW);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [boardError,setBoardError]=useState("");

  const load=useCallback(async()=>{
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){router.replace("/auth/login");return;}

    const [conversationResult,boardResult]=await Promise.all([
      supabase.rpc("get_conversations"),
      supabase.rpc("get_message_boards")
    ]);

    if(conversationResult.error){
      setError("Your messages could not be loaded.");
      setRows([]);
    }else{
      setError("");
      setRows(conversationResult.data || []);
    }

    if(boardResult.error){
      setBoardError("Your message boards could not be loaded.");
      setBoards([]);
    }else{
      setBoardError("");
      setBoards(boardResult.data || []);
    }

    setLoading(false);
  },[]);

  useFocusEffect(useCallback(()=>{load();},[load]));

  const visible=useMemo(()=>conversationsFor(view,rows),[view,rows]);
  const unread=useMemo(()=>({
    all:unreadFor("all",rows),
    friends:unreadFor("friends",rows),
    managers:unreadFor("managers",rows)
  }),[rows]);

  if(loading) return <View style={styles.centre}><ActivityIndicator size="large" color={INK.brandDeep}/></View>;

  const showingBoards=view==="boards";
  const totalUnread=unread.all || 0;

  return(
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <AlexJourneyHeader
        phase="CONTINUE"
        title="Keep the plan alive"
        description="Friends, listing conversations and the boards you already belong to stay in one Inbox. Manager is still a capability, not another identity."
        meta={totalUnread ? `${totalUnread} unread` : "Caught up"}
      />

      <View style={styles.lensCard}>
        <Text style={styles.lensKicker}>CHOOSE THE RELATIONSHIP</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {MESSAGE_VIEWS.map((tab)=>{
            const active=tab.key===view;
            const count=tab.key==="boards" ? 0 : unread[tab.key];
            return(
              <Pressable
                key={tab.key}
                style={[styles.tab,active && styles.tabActive]}
                accessibilityRole="tab"
                accessibilityState={{selected:active}}
                accessibilityLabel={count ? `${tab.label}, ${count} unread` : tab.label}
                onPress={()=>setView(tab.key)}
              >
                <Text style={[styles.tabText,active && styles.tabTextActive]}>{tab.label}</Text>
                {count>0 && <View style={[styles.tabCount,active&&styles.tabCountActive]}><Text style={[styles.tabCountText,active&&styles.tabCountTextActive]}>{count}</Text></View>}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {!showingBoards && !!error && <View style={styles.card}><Text style={styles.muted}>{error}</Text></View>}
      {showingBoards && !!boardError && <View style={styles.card}><Text style={styles.muted}>{boardError}</Text></View>}

      {!showingBoards && !error && !visible.length && (
        <View style={styles.card}>
          <Text style={styles.emptyTitle}>
            {view==="friends" ? "No friend messages yet" : view==="managers" ? "No messages about a place yet" : "Nothing here yet"}
          </Text>
          <Text style={styles.muted}>
            {view==="managers"
              ? "You can message whoever manages a place from its page, about that place. Anything about a business, property, club or event appears here."
              : "You can message an Explorer once you follow each other, from their profile. You can message whoever manages a place from its page, about that place."}
          </Text>
          <Pressable style={styles.button} accessibilityRole="button" accessibilityLabel="Find Explorers" onPress={()=>router.push("/explorers")}><Text style={styles.buttonText}>Find Explorers</Text></Pressable>
        </View>
      )}

      {showingBoards && !boardError && !boards.length && (
        <View style={styles.card}>
          <Text style={styles.emptyTitle}>No message boards yet</Text>
          <Text style={styles.muted}>Join a Link-up or an Activity Club and its board appears here. You only see boards you are authorised to read.</Text>
          <Pressable style={styles.button} accessibilityRole="button" accessibilityLabel="Browse Link-ups" onPress={()=>router.push("/linkups")}><Text style={styles.buttonText}>Browse Link-ups</Text></Pressable>
        </View>
      )}

      <View style={styles.conversationList}>
        {showingBoards && boards.map((board)=>(
          <Pressable
            key={`${board.board_kind}-${board.board_id}`}
            style={({pressed})=>[styles.row,styles.boardRow,pressed&&styles.rowPressed]}
            accessibilityRole="button"
            accessibilityLabel={`Open the ${board.title} board`}
            onPress={()=>router.push(board.route)}
          >
            <View style={[styles.avatar,styles.boardAvatar]}><Text style={styles.boardInitial}>{(board.title || "B").slice(0,1)}</Text></View>
            <View style={styles.rowText}>
              <Text style={styles.kindLabel}>BOARD · {BOARD_LABEL[board.board_kind] || "GROUP"}</Text>
              <Text style={styles.name} numberOfLines={1}>{board.title}</Text>
              <Text style={styles.preview} numberOfLines={1}>{board.last_message || "No messages yet"}</Text>
            </View>
            <View style={styles.rowEnd}><Text style={styles.time}>{board.last_message_at ? when(board.last_message_at) : ""}</Text><Text style={styles.arrow}>›</Text></View>
          </Pressable>
        ))}

        {!showingBoards && visible.map((row)=>(
          <Pressable
            key={row.conversation_id}
            style={({pressed})=>[styles.row,row.kind==="listing"&&styles.listingRow,pressed&&styles.rowPressed]}
            accessibilityRole="button"
            accessibilityLabel={`Open conversation with ${row.other_name}${row.unread_count ? `, ${row.unread_count} unread` : ""}`}
            onPress={()=>router.push(`/messages/${row.conversation_id}`)}
          >
            {row.other_photo
              ? <Image source={{uri:row.other_photo}} style={styles.avatar}/>
              : <View style={[styles.avatar,styles.avatarBlank]}><Text style={styles.initial}>{(row.other_name || "E").slice(0,1)}</Text></View>}

            <View style={styles.rowText}>
              <Text style={styles.kindLabel}>{row.kind==="listing" ? "PLACE CONVERSATION" : "FRIEND"}</Text>
              <Text style={styles.name} numberOfLines={1}>{row.other_name}</Text>
              {row.kind==="listing" && <Text style={styles.about} numberOfLines={1}>{listingSubtitle(row,entityTypeLabel(row.target_type))}</Text>}
              <Text style={styles.preview} numberOfLines={1}>{row.last_message || "No messages yet"}</Text>
            </View>

            <View style={styles.rowEnd}>
              <Text style={styles.time}>{when(row.last_message_at)}</Text>
              {row.unread_count>0 && <View style={styles.unread}><Text style={styles.unreadText}>{row.unread_count}</Text></View>}
            </View>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:INK.paper},content:{padding:16,paddingBottom:110},centre:{flex:1,backgroundColor:INK.paper,alignItems:"center",justifyContent:"center"},
  lensCard:{backgroundColor:INK.card,borderWidth:1,borderColor:INK.hair,borderRadius:18,padding:10,marginBottom:13},lensKicker:{color:INK.brandDeep,fontSize:9,fontWeight:"900",letterSpacing:1,marginBottom:8},
  tabs:{flexDirection:"row",gap:7,paddingRight:8},tab:{flexDirection:"row",alignItems:"center",gap:6,borderRadius:13,paddingHorizontal:12,paddingVertical:9,minHeight:42,backgroundColor:INK.paper},tabActive:{backgroundColor:INK.navy},tabText:{color:INK.inkSoft,fontWeight:"900",fontSize:12},tabTextActive:{color:INK.onNavy},tabCount:{minWidth:20,height:20,borderRadius:10,backgroundColor:INK.navy,alignItems:"center",justifyContent:"center",paddingHorizontal:5},tabCountActive:{backgroundColor:INK.brand},tabCountText:{color:INK.onNavy,fontSize:10,fontWeight:"900"},tabCountTextActive:{color:INK.navy},
  card:{backgroundColor:INK.card,borderWidth:1,borderColor:INK.hair,borderRadius:18,padding:18,marginBottom:12},emptyTitle:{color:INK.ink,fontWeight:"900",fontSize:17,marginBottom:6},muted:{color:INK.inkSoft,fontSize:14,lineHeight:20},button:{marginTop:14,alignSelf:"flex-start",borderRadius:13,paddingHorizontal:16,paddingVertical:11,backgroundColor:INK.brand},buttonText:{color:INK.navy,fontWeight:"900"},
  conversationList:{gap:9},row:{backgroundColor:INK.card,borderWidth:1,borderColor:INK.hair,borderRadius:19,flexDirection:"row",alignItems:"center",gap:11,padding:12},listingRow:{borderLeftWidth:4,borderLeftColor:INK.lavender},boardRow:{backgroundColor:INK.navy},rowPressed:{backgroundColor:INK.sky},
  avatar:{width:48,height:48,borderRadius:16,backgroundColor:INK.hair},avatarBlank:{alignItems:"center",justifyContent:"center"},initial:{color:INK.ink,fontWeight:"900",fontSize:18},boardAvatar:{width:48,height:48,borderRadius:16,backgroundColor:INK.brand,alignItems:"center",justifyContent:"center"},boardInitial:{color:INK.navy,fontWeight:"900",fontSize:18},
  rowText:{flex:1,minWidth:0},kindLabel:{color:INK.lavender,fontSize:8,fontWeight:"900",letterSpacing:.8},name:{color:INK.ink,fontWeight:"900",fontSize:15,marginTop:2},about:{color:INK.inkSoft,fontSize:11,fontWeight:"800",marginTop:2},preview:{color:INK.inkSoft,fontSize:13,marginTop:3},
  rowEnd:{alignItems:"flex-end",gap:6},time:{color:INK.inkSoft,fontSize:10},arrow:{color:INK.brandDeep,fontSize:22},unread:{minWidth:23,height:23,borderRadius:12,backgroundColor:INK.brand,alignItems:"center",justifyContent:"center",paddingHorizontal:6},unreadText:{color:INK.navy,fontSize:11,fontWeight:"900"}
});
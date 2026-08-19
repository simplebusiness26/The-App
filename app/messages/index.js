import React,{useCallback,useMemo,useState} from "react";
import {View,Text,Image,Pressable,ScrollView,ActivityIndicator,StyleSheet} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../../services/supabase";
import {entityTypeLabel} from "../../utils/places";
import {
  MESSAGE_VIEWS,
  DEFAULT_MESSAGE_VIEW,
  conversationsFor,
  listingSubtitle,
  unreadFor
} from "../../utils/messageViews";
import {INK} from "../../utils/tokens";

// DesignLab production direction: Living Inbox + Warm Flow.
//
// The information architecture is the Living Inbox idea: one inbox, explicit
// views, and context made visible where it helps. Warm Flow supplies the softer
// hierarchy and surfaces. Neither changes the messaging model below.
//
// All | Friends | Managers | Message Boards
//
// NONE OF THESE IS A NEW MESSAGING SYSTEM. Three already exist -- direct
// messages, the Link-up attendee board, the Activity Club members' board -- and
// this screen is navigation over them. The rules for which conversation belongs
// in which tab live in utils/messageViews.js so they can be tested without
// rendering anything.
//
// MANAGER IS A CAPABILITY, NOT AN ACCOUNT TYPE. The Managers tab is a filter
// over conversations about listings. It is not a second inbox, there is no
// manager account, and the same Explorer appears on both sides of it.
//
// BOARDS ARE DOORWAYS. They are listed here for quick access and then opened in
// the board system that already owns them. They are never copied into direct
// message tables.

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

function viewCopy(view,unread,boards){
  if(view==="friends") return {
    title:"Your people",
    body:unread.friends ? `${unread.friends} unread from friends` : "Caught up with friends"
  };
  if(view==="managers") return {
    title:"Places and managers",
    body:unread.managers ? `${unread.managers} unread about places` : "Caught up on place conversations"
  };
  if(view==="boards") return {
    title:"Shared spaces",
    body:boards.length ? `${boards.length} message board${boards.length===1 ? "" : "s"}` : "Boards from Link-ups and Activity Clubs"
  };
  return {
    title:"Everything together",
    body:unread.all ? `${unread.all} unread direct message${unread.all===1 ? "" : "s"}` : "No unread direct messages"
  };
}

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

    // A board list that fails must not take the direct inbox down with it.
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

  // All is still the same direct inbox, but the Living Inbox direction makes
  // its two meanings visible instead of presenting a flat undifferentiated list.
  const groups=useMemo(()=>{
    if(view!=="all") return [{key:view,label:"",rows:visible}];
    return [
      {key:"friends",label:"Friends",rows:visible.filter((row)=>row.kind==="friend")},
      {key:"places",label:"Places",rows:visible.filter((row)=>row.kind==="listing")}
    ].filter((group)=>group.rows.length>0);
  },[view,visible]);

  if(loading){
    return <View style={styles.centre}><ActivityIndicator size="large" color={INK.ink}/></View>;
  }

  const showingBoards=view==="boards";
  const summary=viewCopy(view,unread,boards);

  function DirectRow({row}){
    return(
      <Pressable
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
              {listingSubtitle(row,entityTypeLabel(row.target_type))}
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
    );
  }

  return(
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>People · places · plans</Text>
        <Text style={styles.title}>Messages</Text>
        <Text style={styles.intro}>One inbox, organised around what the conversation is actually for.</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
      >
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
              {count>0 && (
                <View style={[styles.tabCount,active && styles.tabCountActive]}>
                  <Text style={[styles.tabCountText,active && styles.tabCountTextActive]}>{count}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.summary} accessibilityRole="summary">
        <View style={styles.summaryMark}/>
        <View style={styles.summaryText}>
          <Text style={styles.summaryTitle}>{summary.title}</Text>
          <Text style={styles.summaryBody}>{summary.body}</Text>
        </View>
      </View>

      {!showingBoards && !!error && <View style={styles.card}><Text style={styles.muted}>{error}</Text></View>}
      {showingBoards && !!boardError && <View style={styles.card}><Text style={styles.muted}>{boardError}</Text></View>}

      {!showingBoards && !error && !visible.length && (
        <View style={styles.card}>
          <Text style={styles.emptyTitle}>
            {view==="friends" ? "No friend messages yet"
              : view==="managers" ? "No messages about a place yet"
              : "Nothing here yet"}
          </Text>
          <Text style={styles.muted}>
            {view==="managers"
              ? "You can message whoever manages a place from its page, about that place. Anything about a business, property, club or event appears here."
              : "You can message an Explorer once you follow each other, from their profile. You can message whoever manages a place from its page, about that place."}
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

      {showingBoards && !boardError && !boards.length && (
        <View style={styles.card}>
          <Text style={styles.emptyTitle}>No message boards yet</Text>
          <Text style={styles.muted}>
            Join a Link-up or an Activity Club and its board appears here. A board belongs to
            the people in it, so you will only ever see the ones you are part of.
          </Text>
          <Pressable
            style={styles.button}
            accessibilityRole="button"
            accessibilityLabel="Browse Link-ups"
            onPress={()=>router.push("/linkups")}
          >
            <Text style={styles.buttonText}>Browse Link-ups</Text>
          </Pressable>
        </View>
      )}

      {showingBoards && !boardError && boards.length>0 && (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Your boards</Text>
            <Text style={styles.sectionMeta}>Open the space where the conversation already lives</Text>
          </View>
          {boards.map((board)=>(
            <Pressable
              key={`${board.board_kind}-${board.board_id}`}
              style={[styles.row,styles.boardRow]}
              accessibilityRole="button"
              accessibilityLabel={`Open the ${board.title} board`}
              onPress={()=>router.push(board.route)}
            >
              <View style={[styles.avatar,styles.avatarBlank,styles.boardAvatar]}>
                <Text style={styles.initial}>{(board.title || "B").slice(0,1)}</Text>
              </View>

              <View style={styles.rowText}>
                <Text style={styles.name} numberOfLines={1}>{board.title}</Text>
                <Text style={styles.about} numberOfLines={1}>
                  {BOARD_LABEL[board.board_kind] || "Board"}{board.subtitle ? ` · ${board.subtitle}` : ""}
                </Text>
                <Text style={styles.preview} numberOfLines={1}>{board.last_message || "No messages yet"}</Text>
              </View>

              <View style={styles.rowEnd}>
                <Text style={styles.time}>{board.last_message_at ? when(board.last_message_at) : ""}</Text>
                <Text style={styles.openMark}>↗</Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      {!showingBoards && !error && groups.map((group)=>(
        <View key={group.key} style={styles.section}>
          {view==="all" && (
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>{group.label}</Text>
              <Text style={styles.sectionMeta}>
                {group.key==="friends" ? "Direct conversations" : "Conversations about places"}
              </Text>
            </View>
          )}
          {group.rows.map((row)=><DirectRow key={row.conversation_id} row={row}/>)}
        </View>
      ))}
    </ScrollView>
  );
}

const surface={
  backgroundColor:INK.card,
  borderWidth:1,
  borderColor:INK.hair,
  borderRadius:20
};

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:INK.paper},
  content:{paddingHorizontal:16,paddingTop:12,paddingBottom:110},
  centre:{flex:1,backgroundColor:INK.paper,alignItems:"center",justifyContent:"center"},
  heading:{paddingTop:4,paddingBottom:4},
  eyebrow:{color:INK.inkSoft,fontSize:11,fontWeight:"900",letterSpacing:1.1,textTransform:"uppercase"},
  title:{color:INK.ink,fontSize:34,fontWeight:"900",letterSpacing:-1.4,marginTop:4},
  intro:{color:INK.inkSoft,fontSize:13,lineHeight:18,marginTop:5,maxWidth:340},
  tabs:{flexDirection:"row",gap:8,paddingTop:14,paddingBottom:12,paddingRight:16},
  tab:{flexDirection:"row",alignItems:"center",gap:7,borderWidth:1,borderColor:INK.hair,borderRadius:99,paddingHorizontal:14,paddingVertical:10,minHeight:44,backgroundColor:INK.card},
  tabActive:{backgroundColor:INK.ink,borderColor:INK.ink},
  tabText:{color:INK.ink,fontWeight:"800",fontSize:13},
  tabTextActive:{color:INK.card},
  tabCount:{minWidth:20,height:20,borderRadius:10,backgroundColor:INK.ink,alignItems:"center",justifyContent:"center",paddingHorizontal:5},
  tabCountActive:{backgroundColor:INK.card},
  tabCountText:{color:INK.card,fontSize:10,fontWeight:"900"},
  tabCountTextActive:{color:INK.ink},
  summary:{...surface,flexDirection:"row",alignItems:"center",gap:11,padding:13,marginBottom:16},
  summaryMark:{width:10,height:10,borderRadius:5,backgroundColor:INK.ink},
  summaryText:{flex:1},
  summaryTitle:{color:INK.ink,fontSize:14,fontWeight:"900"},
  summaryBody:{color:INK.inkSoft,fontSize:11,marginTop:2},
  card:{...surface,padding:18,marginBottom:12},
  emptyTitle:{color:INK.ink,fontWeight:"900",fontSize:17,marginBottom:6},
  muted:{color:INK.inkSoft,fontSize:14,lineHeight:20},
  button:{marginTop:14,alignSelf:"flex-start",borderWidth:1,borderColor:INK.ink,borderRadius:99,paddingHorizontal:16,paddingVertical:10,minHeight:44,justifyContent:"center",backgroundColor:INK.paper},
  buttonText:{color:INK.ink,fontWeight:"800"},
  section:{marginBottom:8},
  sectionHead:{paddingHorizontal:2,paddingTop:1,paddingBottom:8},
  sectionTitle:{color:INK.ink,fontSize:12,fontWeight:"900",letterSpacing:0.5,textTransform:"uppercase"},
  sectionMeta:{color:INK.inkSoft,fontSize:10,marginTop:2},
  row:{...surface,flexDirection:"row",alignItems:"center",gap:12,padding:12,marginBottom:9,minHeight:76},
  boardRow:{borderStyle:"dashed"},
  avatar:{width:46,height:46,borderRadius:23,backgroundColor:INK.hair,borderWidth:1,borderColor:INK.hair},
  boardAvatar:{borderRadius:14},
  avatarBlank:{alignItems:"center",justifyContent:"center"},
  initial:{color:INK.ink,fontWeight:"900",fontSize:17},
  rowText:{flex:1,minWidth:0},
  name:{color:INK.ink,fontWeight:"900",fontSize:15},
  about:{color:INK.inkSoft,fontSize:11,fontWeight:"800",marginTop:2},
  preview:{color:INK.inkSoft,fontSize:13,marginTop:5},
  rowEnd:{alignItems:"flex-end",alignSelf:"stretch",justifyContent:"space-between",paddingVertical:2},
  time:{color:INK.inkSoft,fontSize:10},
  unread:{minWidth:22,height:22,borderRadius:11,backgroundColor:INK.ink,alignItems:"center",justifyContent:"center",paddingHorizontal:6},
  unreadText:{color:INK.card,fontSize:10,fontWeight:"900"},
  openMark:{color:INK.ink,fontSize:18,fontWeight:"700"}
});

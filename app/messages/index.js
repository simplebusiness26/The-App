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
import {TYPE} from "../../styles/typography";

// The inbox, and three other ways of looking at it.
//
// All | Friends | Managers | Message Boards
//
// NONE OF THESE IS A NEW MESSAGING SYSTEM. Three already exist -- direct
// messages, the Link-up attendee board, the Activity Club members' board -- and
// this screen is navigation over them. The rules for which conversation belongs
// in which tab live in utils/messageViews.js so they can be tested without
// rendering anything.
//
// TWO KINDS OF CONVERSATION, AND THE DIFFERENCE IS VISIBLE
//
//   friend    two Explorers who follow each other
//   listing   anybody, to whoever manages a place, about that place
//
// A manager needs to tell them apart at a glance: one is a friend, one is
// somebody asking whether the kitchen is still open. A listing thread now wears
// the listing's NAME, not just its type, and says which side of it you are on.
//
// MANAGER IS A CAPABILITY, NOT AN ACCOUNT TYPE. The Managers tab is a filter
// over conversations about listings. It is not a second inbox, there is no
// manager account, and the same Explorer appears on both sides of it.
//
// BOARDS ARE LISTED, NOT REIMPLEMENTED. get_message_boards() returns the boards
// the caller is already authorised to read, re-deriving the same conditions the
// boards' own read policies use. Opening one still goes through that board's
// policy; this cannot grant access to anything.
//
// GAZETTEER PASS (design round r001-a, directive 10): the four views are still
// exactly what utils/messageViews.js classifies -- that logic is untouched.
// What changed is presentation: the view switcher is now a ruled row of
// uppercase text tabs with a full-width ink underline on the active one, the
// same convention components/TabBar.js uses for its active tab, in place of
// four rounded pills. The rows below it are one-line ledger entries with a
// hairline between them instead of bordered, shadowed cards, and the last
// message time is right-aligned in tabular numerals.

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

    // Both in one go. Two round trips, not one per row -- the boards arrive
    // already filtered to what this Explorer may read.
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

    // A board list that fails must not take the inbox down with it. They are
    // separate systems and one being unavailable says nothing about the other.
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

  if(loading){
    return <View style={styles.centre}><ActivityIndicator size="large" color={INK.ink}/></View>;
  }

  const showingBoards=view==="boards";

  return(
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={TYPE.sectionLabel}>Inbox</Text>
      <Text style={TYPE.display}>Messages</Text>

      <View style={styles.tabs}>
        {MESSAGE_VIEWS.map((tab)=>{
          const active=tab.key===view;
          const count=tab.key==="boards" ? 0 : unread[tab.key];

          return(
            <Pressable
              key={tab.key}
              style={styles.tab}
              accessibilityRole="tab"
              accessibilityState={{selected:active}}
              accessibilityLabel={count ? `${tab.label}, ${count} unread` : tab.label}
              onPress={()=>setView(tab.key)}
            >
              <Text style={[styles.tabText,active && styles.tabTextActive]} numberOfLines={2}>
                {tab.label}
              </Text>
              {count>0 && (
                <View style={styles.tabCount}>
                  <Text style={styles.tabCountText}>{count}</Text>
                </View>
              )}
              <View style={[styles.marker,active && styles.markerActive]}/>
            </Pressable>
          );
        })}
      </View>

      {!showingBoards && !!error && <Text style={styles.emptyText}>{error}</Text>}
      {showingBoards && !!boardError && <Text style={styles.emptyText}>{boardError}</Text>}

      {!showingBoards && !error && !visible.length && (
        <View style={styles.notice}>
          <Text style={styles.emptyTitle}>
            {view==="friends" ? "No friend messages yet"
              : view==="managers" ? "No messages about a place yet"
              : "Nothing here yet"}
          </Text>
          {/* An instruction, not a mood. Both routes in, named. */}
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
        <View style={styles.notice}>
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

      {showingBoards && !!boards.length && (
        <View style={styles.sectionHead}>
          <Text style={TYPE.sectionLabel}>Message Boards</Text>
          <Text style={styles.count}>{boards.length}</Text>
        </View>
      )}

      {showingBoards && boards.map((board)=>(
        <Pressable
          key={`${board.board_kind}-${board.board_id}`}
          style={styles.row}
          accessibilityRole="button"
          accessibilityLabel={`Open the ${board.title} board`}
          onPress={()=>router.push(board.route)}
        >
          <View style={[styles.avatar,styles.avatarBlank]}>
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
          </View>
        </Pressable>
      ))}

      {!showingBoards && !!visible.length && (
        <View style={styles.sectionHead}>
          <Text style={TYPE.sectionLabel}>{MESSAGE_VIEWS.find(tab=>tab.key===view)?.label}</Text>
          <Text style={styles.count}>{visible.length}</Text>
        </View>
      )}

      {!showingBoards && visible.map((row)=>(
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
      ))}
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:INK.paper},
  content:{padding:20,paddingBottom:110},
  centre:{flex:1,backgroundColor:INK.paper,alignItems:"center",justifyContent:"center"},

  // The view switcher. Full-width ruled columns with an ink underline on the
  // active one -- components/TabBar.js's marker/markerActive convention, not
  // a pill.
  tabs:{flexDirection:"row",marginTop:20,borderBottomWidth:2,borderBottomColor:INK.hair},
  tab:{flex:1,alignItems:"center",gap:4,paddingTop:10,paddingBottom:8},
  tabText:{...TYPE.sectionLabel,color:INK.inkSoft,textAlign:"center"},
  tabTextActive:{color:INK.ink},
  tabCount:{minWidth:18,height:18,borderRadius:4,backgroundColor:INK.ink,alignItems:"center",justifyContent:"center",paddingHorizontal:4},
  tabCountText:{color:INK.card,fontSize:10,fontWeight:"900"},
  marker:{height:3,width:"100%",backgroundColor:"transparent",marginTop:2},
  markerActive:{backgroundColor:INK.ink},

  notice:{
    backgroundColor:INK.card,
    borderWidth:2,
    borderColor:INK.ink,
    borderRadius:4,
    padding:18,
    marginTop:18
  },
  emptyTitle:{...TYPE.rowTitle,marginBottom:6},
  muted:{...TYPE.body,color:INK.inkSoft},
  emptyText:{...TYPE.meta,paddingVertical:12},
  button:{
    marginTop:14,
    alignSelf:"flex-start",
    borderWidth:2,
    borderColor:INK.ink,
    borderRadius:6,
    paddingHorizontal:16,
    paddingVertical:9,
    backgroundColor:INK.paper
  },
  buttonText:{color:INK.ink,fontWeight:"800",fontSize:13},

  sectionHead:{
    flexDirection:"row",
    alignItems:"flex-end",
    justifyContent:"space-between",
    marginTop:18,
    paddingBottom:6,
    borderBottomWidth:2,
    borderBottomColor:INK.ink
  },
  count:{...TYPE.numeral,fontSize:16},

  row:{
    flexDirection:"row",
    alignItems:"center",
    gap:10,
    minHeight:58,
    paddingVertical:10,
    borderBottomWidth:1,
    borderBottomColor:INK.hair
  },
  avatar:{width:36,height:36,borderRadius:4,backgroundColor:INK.card,borderWidth:2,borderColor:INK.ink},
  avatarBlank:{alignItems:"center",justifyContent:"center"},
  initial:{color:INK.ink,fontWeight:"900",fontSize:14},
  rowText:{flex:1},
  name:{...TYPE.rowTitle},
  about:{...TYPE.meta,marginTop:1},
  preview:{...TYPE.body,color:INK.inkSoft,marginTop:2},
  rowEnd:{alignItems:"flex-end",gap:5,maxWidth:90},
  time:{...TYPE.numeral,fontSize:12,textAlign:"right"},
  unread:{minWidth:20,height:20,borderRadius:4,backgroundColor:INK.ink,alignItems:"center",justifyContent:"center",paddingHorizontal:5},
  unreadText:{color:INK.card,fontSize:11,fontWeight:"900"}
});

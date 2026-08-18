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
import {INK,TYPE,SHAPE} from "../../utils/tokens";
import {
  Action,
  Empty,
  Frame,
  MONO,
  Segmented,
  Notice,
  Panel,
  Screen,
  ScreenTitle
} from "../../components/instrument";
import {CREATE_HUB_CLEARANCE} from "../../components/CreateHub";

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

// The tab strip is the kit's Segmented. It used to be composed here, because
// each tab has to SPEAK a different sentence from the one it SHOWS -- "Friends,
// 2 unread" read aloud, "Friends" on the glass -- and Segmented took one label
// for both. It takes a per-item accessibilityLabel and a meta count now, so the
// local copy is gone: one selector shape in the app, defined once.
function messageTabs(unread){
  return MESSAGE_VIEWS.map((tab)=>{
    const count=tab.key==="boards" ? 0 : unread[tab.key];
    return{
      key:tab.key,
      label:tab.label,
      meta:count>0 ? count : null,
      accessibilityLabel:count ? `${tab.label}, ${count} unread` : tab.label
    };
  });
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
    return(
      <Screen>
        <View style={styles.centre}><ActivityIndicator size="large" color={INK.readout}/></View>
      </Screen>
    );
  }

  const showingBoards=view==="boards";

  return(
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenTitle eyebrow="INBOX" title="Messages"/>

        <Segmented items={messageTabs(unread)} active={view} onChange={setView} scroll/>

        {!showingBoards && !!error && <Notice tone="dispute" label="Not loaded">{error}</Notice>}
        {showingBoards && !!boardError && <Notice tone="dispute" label="Not loaded">{boardError}</Notice>}

        {!showingBoards && !error && !visible.length && (
          <Empty
            glyph="comment"
            title={view==="friends" ? "No friend messages yet"
              : view==="managers" ? "No messages about a place yet"
              : "Nothing here yet"}
            /* An instruction, not a mood. Both routes in, named. */
            instruction={view==="managers"
              ? "You can message whoever manages a place from its page, about that place. Anything about a business, property, club or event appears here."
              : "You can message an Explorer once you follow each other, from their profile. You can message whoever manages a place from its page, about that place."}
            action={
              <Action
                kind="primary"
                glyph="search"
                label="Find Explorers"
                accessibilityLabel="Find Explorers"
                onPress={()=>router.push("/explorers")}
              />
            }
          />
        )}

        {showingBoards && !boardError && !boards.length && (
          <Empty
            glyph="people"
            title="No message boards yet"
            instruction="Join a Link-up or an Activity Club and its board appears here. A board belongs to the people in it, so you will only ever see the ones you are part of."
            action={
              <Action
                kind="primary"
                glyph="search"
                label="Browse Link-ups"
                accessibilityLabel="Browse Link-ups"
                onPress={()=>router.push("/linkups")}
              />
            }
          />
        )}

        {showingBoards && boards.map((board)=>(
          <Pressable
            key={`${board.board_kind}-${board.board_id}`}
            accessibilityRole="button"
            accessibilityLabel={`Open the ${board.title} board`}
            onPress={()=>router.push(board.route)}
          >
            <Panel style={styles.row}>
              <Frame size={44} round style={styles.avatar}>
                <Text style={styles.initial}>{(board.title || "B").slice(0,1)}</Text>
              </Frame>

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
            </Panel>
          </Pressable>
        ))}

        {!showingBoards && visible.map((row)=>(
          <Pressable
            key={row.conversation_id}
            accessibilityRole="button"
            accessibilityLabel={`Open conversation with ${row.other_name}${row.unread_count ? `, ${row.unread_count} unread` : ""}`}
            onPress={()=>router.push(`/messages/${row.conversation_id}`)}
          >
            <Panel style={styles.row}>
              <Frame size={44} round style={styles.avatar}>
                {row.other_photo
                  ? <Image source={{uri:row.other_photo}} style={styles.avatarImage}/>
                  : <Text style={styles.initial}>{(row.other_name || "E").slice(0,1)}</Text>}
              </Frame>

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
                {row.unread_count>0 && <Text style={styles.unread}>{row.unread_count}</Text>}
              </View>
            </Panel>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles=StyleSheet.create({
  content:{paddingHorizontal:16,paddingBottom:24+CREATE_HUB_CLEARANCE},
  centre:{flex:1,alignItems:"center",justifyContent:"center"},

  // flexGrow:0 / flexShrink:0 and a centred content container. Without both, a
  // horizontal ScrollView inside a flex column claims the leftover vertical
  // space and stretches its children to fill it -- measured in this repo at
  // 402px-tall pills. docs/instrument-kit.md, rule nine.
  // The unread figure is a count the app made, so it is mono on the housing --
  // not a filled dot, which would spend a colour on chrome.

  row:{flexDirection:"row",alignItems:"center",gap:11,padding:11,marginBottom:9},
  avatar:{backgroundColor:INK.inset},
  avatarImage:{width:44,height:44,borderRadius:SHAPE.radius.pill},
  initial:{color:INK.readoutSoft,fontWeight:"700",fontSize:17},
  rowText:{flex:1,minWidth:0},
  name:{color:INK.readout,fontSize:TYPE.display.sizes.sm,fontWeight:"600",letterSpacing:-0.2},
  // What the conversation is ABOUT is a fact the app derived, so it is mono.
  about:{
    color:INK.readoutFaint,fontFamily:MONO,fontSize:TYPE.data.sizes.sm,
    textTransform:"uppercase",letterSpacing:0.6,marginTop:3
  },
  // What somebody wrote stays in the body face.
  preview:{color:INK.readoutSoft,fontSize:TYPE.body.sizes.sm,marginTop:3},
  rowEnd:{alignItems:"flex-end",gap:5},
  time:{color:INK.readoutFaint,fontFamily:MONO,fontSize:TYPE.data.sizes.sm,letterSpacing:0.5},
  unread:{
    color:INK.readout,fontFamily:MONO,fontSize:TYPE.data.sizes.sm,letterSpacing:0.5,
    borderWidth:SHAPE.border,borderColor:INK.hairlineStrong,borderRadius:SHAPE.radius.control,
    backgroundColor:INK.panelRaised,paddingHorizontal:6,paddingVertical:2,overflow:"hidden"
  }
});

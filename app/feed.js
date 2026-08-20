import React,{useCallback,useRef,useState} from "react";
import {ActivityIndicator,FlatList,RefreshControl,StyleSheet,Text,View} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../services/supabase";
import FeedCard,{listingRoute} from "../components/FeedCard";
import Explorers from "./explorers";
import Leaderboards from "./leaderboards";
import {CREATE_HUB_CLEARANCE} from "../components/CreateHub";
import {INK,TYPE,SHAPE} from "../utils/tokens";
import {Action,Empty,MONO,Notice,Screen,ScreenTitle,Segmented} from "../components/instrument";

// The Community tab's container. FINAL_PRODUCT_CONTRACT.md's architecture
// section folds Feed, Explorers and Leaderboard into ONE destination --
// "Community: Feed · Explorers · Leaderboard -- segmented within one
// destination" -- rather than three separate tab-bar stops. This file is
// what utils/navigation.js's Community tab and components/TabBar.js already
// point at (it was the simplest existing screen to grow into the container),
// so it stays app/feed.js rather than moving to a new route.
//
// THE OTHER TWO SEGMENTS ARE NOT REBUILT HERE. Explorers renders
// app/explorers.js's own default export inline, Leaderboard renders
// app/leaderboards.js's -- the exact same components app/_layout.js still
// registers as their own directly-navigable routes (a profile's "Find
// Explorers" empty state, a leaderboard-rank deep link, anything that still
// pushes "/explorers" or "/leaderboards" keeps working, per the brief's "no
// 404s"). Rendering the same function twice, once as a route and once inline,
// is what "reuse the logic, do not duplicate the query" means in React: one
// function, two places it gets mounted. useFocusEffect inside each still
// fires correctly nested here -- it reads the ambient Screen's focus state
// (this screen, /feed), not whether it is the outermost thing on it.
//
// The Feed segment's own quick actions still say router.push("/explorers")
// rather than switching the segment in place -- scripts/verify-social-layer.
// cjs pins that literal call, and pushing to the standalone screen is not
// wrong, only less immediate than a segment switch would be. Tapping the
// Community tab a second time, or the segmented control itself, is the
// one-tap in-place path the contract actually asks for.
//
// THE SELECTOR IS A DETENTED SWITCH, NOT THREE PILLS. Three filled pills with
// hard offset shadows said "the segment you are on is a state a place is in",
// which is the one thing the state inks are for. The kit's Segmented marks the
// active detent with a bright tick and a brightened label instead -- selection
// as a step up, never as a fill. See docs/design-system.md, rule 5.
const SEGMENTS=[
  {key:"feed",label:"Feed"},
  {key:"explorers",label:"Explorers"},
  {key:"leaderboard",label:"Leaderboard"}
];

export default function Community(){
  const [segment,setSegment]=useState("feed");
  // Explorers and Leaderboard mount the first time they are opened and then
  // stay mounted (hidden, not unmounted) behind the active one -- switching
  // segments toggles visibility rather than tearing a screen down and
  // refetching it every time somebody flips back to it. Feed itself needs no
  // entry here: it is the segment Community opens on, so it is always in the
  // tree from the very first render.
  const [visited,setVisited]=useState({explorers:false,leaderboard:false});

  function selectSegment(key){
    setSegment(key);
    if(key!=="feed") setVisited((current)=>current[key] ? current : {...current,[key]:true});
  }

  return(
    <Screen>
      <View style={communityStyles.selector}>
        <Segmented items={SEGMENTS} active={segment} onChange={selectSegment}/>
      </View>

      <View style={[communityStyles.segmentPane,segment!=="feed" && communityStyles.segmentPaneHidden]}>
        <Feed/>
      </View>
      {visited.explorers && (
        <View style={[communityStyles.segmentPane,segment!=="explorers" && communityStyles.segmentPaneHidden]}>
          <Explorers/>
        </View>
      )}
      {visited.leaderboard && (
        <View style={[communityStyles.segmentPane,segment!=="leaderboard" && communityStyles.segmentPaneHidden]}>
          <Leaderboards/>
        </View>
      )}
    </Screen>
  );
}

const communityStyles=StyleSheet.create({
  selector:{borderBottomWidth:SHAPE.border,borderBottomColor:INK.hairline,paddingBottom:2},
  segmentPane:{flex:1},
  segmentPaneHidden:{display:"none"}
});

// The feed itself, paginated and virtualised.
//
// WHAT IT USED TO DO, AND WHY IT WAS SLOW
//
//   rpc("get_explorer_social_feed",{p_limit:40,p_offset:0})
//
// Both numbers hard-coded. Forty rows was the entire feed for ever -- no second
// page and no way to ask for one -- and all forty mounted at once inside a
// ScrollView, which keeps every child alive whether or not it is on screen.
// Each card carried a LikeButton that called auth.getUser() in its own effect,
// so a screen of Moments fired forty auth round trips for one answer. And
// useFocusEffect refetched the lot with the loading spinner on, so returning
// from a Moment blanked the list and threw the scroll position away.
//
// WHAT IT DOES NOW
//
// FlatList, a page at a time, keyset cursor. Pages append rather than replace.
// A second request cannot start while one is in flight, the end of the feed
// stops the requests, and a page that fails leaves everything already loaded on
// screen with a retry -- losing twenty rows you had because the twenty-first
// failed is a worse outcome than the failure.
//
// Refreshing and loading more are different actions on purpose: refresh starts
// the feed again from the top, loading more never touches what is above it.

// One value, one place. The brief asked for roughly 15-25.
const PAGE_SIZE=20;

function Feed(){
  const [items,setItems]=useState([]);
  const [viewerId,setViewerId]=useState(null);
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [loadingMore,setLoadingMore]=useState(false);
  const [reachedEnd,setReachedEnd]=useState(false);
  const [error,setError]=useState("");
  const [pageError,setPageError]=useState("");

  // Not state. A guard that must be true the instant it is set, before any
  // render happens -- FlatList can fire onEndReached twice in one frame, and a
  // state flag would still read false on the second call.
  const inFlight=useRef(false);
  // The cursor: the created_at and item_id of the last row we hold.
  const cursor=useRef(null);

  const fetchPage=useCallback(async(after)=>{
    return supabase.rpc("get_explorer_social_feed",{
      p_limit:PAGE_SIZE,
      p_offset:0,
      p_before:after?.created_at ?? null,
      p_before_id:after?.item_id ?? null
    });
  },[]);

  const load=useCallback(async(showLoader=true)=>{
    if(inFlight.current) return;
    inFlight.current=true;

    if(showLoader) setLoading(true);
    setError("");
    setPageError("");

    const {data:{user}}=await supabase.auth.getUser();
    if(!user){
      inFlight.current=false;
      router.replace("/auth/login");
      return;
    }
    setViewerId(user.id);

    const {data,error:feedError}=await fetchPage(null);

    if(feedError){
      console.log(feedError);
      setError("Your feed could not be loaded.");
      setItems([]);
      cursor.current=null;
      setReachedEnd(false);
    }else{
      const page=data || [];
      setItems(page);
      cursor.current=page.length ? page[page.length-1] : null;
      setReachedEnd(page.length<PAGE_SIZE);
    }

    setLoading(false);
    setRefreshing(false);
    inFlight.current=false;
  },[fetchPage]);

  const loadMore=useCallback(async()=>{
    // Four separate reasons not to ask for another page, and every one of them
    // has to be checked here rather than by whoever calls this.
    if(inFlight.current || reachedEnd || loading || !cursor.current) return;

    inFlight.current=true;
    setLoadingMore(true);
    setPageError("");

    const {data,error:pageFetchError}=await fetchPage(cursor.current);

    if(pageFetchError){
      console.log(pageFetchError);
      // Everything already on screen stays. This is the whole reason the two
      // error states are separate.
      setPageError("More posts could not be loaded.");
    }else{
      const page=data || [];

      if(page.length===0){
        setReachedEnd(true);
      }else{
        setItems((current)=>{
          // Belt and braces over the keyset. The cursor should make a repeat
          // impossible, but a duplicate key in a list is a rendering bug that
          // is very hard to see and very easy to prevent.
          const seen=new Set(current.map((row)=>`${row.item_type}-${row.item_id}`));
          const fresh=page.filter((row)=>!seen.has(`${row.item_type}-${row.item_id}`));
          return fresh.length ? [...current,...fresh] : current;
        });
        cursor.current=page[page.length-1];
        if(page.length<PAGE_SIZE) setReachedEnd(true);
      }
    }

    setLoadingMore(false);
    inFlight.current=false;
  },[fetchPage,reachedEnd,loading]);

  useFocusEffect(useCallback(()=>{
    // Only the first arrival loads. Coming back from a Moment used to refetch
    // everything and blank the screen, which threw away the scroll position and
    // every page after the first.
    if(cursor.current===null) load();
  },[load]));

  const refresh=useCallback(()=>{
    setRefreshing(true);
    cursor.current=null;
    setReachedEnd(false);
    load(false);
  },[load]);

  const openItem=useCallback((item)=>{
    if(item.item_type==="moment"){
      router.push(`/moments/${item.item_id}`);
      return;
    }

    if(item.item_type==="memory"){
      router.push(`/memories/${item.item_id}`);
      return;
    }

    const route=listingRoute(item);
    if(route) router.push(route);
  },[]);

  const openComments=useCallback((item)=>{
    if(item.item_type==="moment") router.push(`/moments/${item.item_id}`);
    // A Memory's comments live on the Memory, the same way a Moment's do.
    else if(item.item_type==="memory") router.push(`/memories/${item.item_id}`);
    else router.push({pathname:`/social-comments/${item.item_id}`,params:{type:"review"}});
  },[]);

  const keyExtractor=useCallback((item)=>`${item.item_type}-${item.item_id}`,[]);

  const renderItem=useCallback(({item})=>(
    <View style={styles.body}>
      <FeedCard item={item} viewerId={viewerId} onOpen={openItem} onComments={openComments}/>
    </View>
  ),[viewerId,openItem,openComments]);

  const header=(
    <>
      <ScreenTitle
        eyebrow="YOUR EXPLORER COMMUNITY"
        title="Feed"
        meta="Reviews, favourites and Moments from the Explorers you follow."
      />

      <View style={styles.body}>
      <View style={styles.quickActions}>
        {/* The camera, not the uploader. A Moment is made by taking a photo. */}
        <Action
          kind="primary"
          glyph="camera"
          label="New Moment"
          style={styles.quickAction}
          onPress={()=>router.push("/camera")}
        />
        <Action
          kind="secondary"
          glyph="search"
          label="Find Explorers"
          style={styles.quickAction}
          onPress={()=>router.push("/explorers")}
        />
      </View>

      {loading && <ActivityIndicator size="large" color={INK.readoutSoft} style={styles.loader}/>}

      {!loading && !!error && (
        <Notice tone="dispute" label="Feed unavailable">{error}</Notice>
      )}

      {!loading && !error && items.length===0 && (
        <Empty
          glyph="people"
          title="Build your Explorer feed"
          instruction="Follow Explorers to see their reviews, Moments, Memories and favourite places here."
          action={<Action kind="primary" glyph="search" label="Find Explorers" onPress={()=>router.push("/explorers")}/>}
        />
      )}
      </View>
    </>
  );

  const footer=(
    <View style={[styles.body,styles.footer]}>
      {loadingMore && <ActivityIndicator color={INK.readoutSoft}/>}

      {!!pageError && (
        <Notice
          tone="scheduled"
          label="Page not loaded"
          action={
            <Action
              kind="secondary"
              glyph="refresh"
              label="Try again"
              accessibilityLabel="Try loading more posts again"
              onPress={loadMore}
            />
          }
        >
          {pageError}
        </Notice>
      )}

      {reachedEnd && items.length>0 && !pageError && (
        <Text style={styles.endText}>That is everything for now</Text>
      )}
    </View>
  );

  return(
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={loading || error ? [] : items}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={INK.readoutSoft}/>}
      onEndReached={loadMore}
      // Half a screen from the bottom. Far enough that the next page is usually
      // there before it is needed, near enough that it is not fetching pages
      // nobody will reach.
      onEndReachedThreshold={0.5}
      removeClippedSubviews={false}
      initialNumToRender={6}
      maxToRenderPerBatch={6}
      windowSize={7}
    />
  );
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:INK.ground},
  // The Create action floats over every screen; without its clearance the last
  // feed row sits underneath it. See CREATE_HUB_CLEARANCE in components/CreateHub.js.
  //
  // ScreenTitle carries its own horizontal gutter, so the list container does
  // not -- every row, the header's actions and the footer take it from `body`.
  content:{paddingBottom:24+CREATE_HUB_CLEARANCE},
  body:{paddingHorizontal:16},
  quickActions:{flexDirection:"row",gap:9,marginTop:14,marginBottom:16},
  quickAction:{flex:1},
  loader:{marginTop:45},
  footer:{paddingTop:8,paddingBottom:8},
  endText:{
    color:INK.readoutFaint,fontFamily:MONO,fontSize:TYPE.data.sizes.sm,
    letterSpacing:1,textTransform:"uppercase",textAlign:"center",paddingVertical:16
  }
});

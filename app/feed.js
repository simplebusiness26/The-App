import React,{useCallback,useRef,useState} from "react";
import {ActivityIndicator,FlatList,Pressable,RefreshControl,StyleSheet,Text,View} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../services/supabase";
import FeedCard,{listingRoute} from "../components/FeedCard";
import {INK} from "../utils/tokens";

// The feed, paginated and virtualised.
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

export default function Feed(){
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
    <FeedCard item={item} viewerId={viewerId} onOpen={openItem} onComments={openComments}/>
  ),[viewerId,openItem,openComments]);

  const header=(
    <>
      <View style={styles.headingRow}>
        <View style={styles.headingText}>
          <Text style={styles.eyebrow}>YOUR EXPLORER COMMUNITY</Text>
          <Text style={styles.title}>Feed</Text>
          <Text style={styles.subtitle}>Reviews, favourites and Moments from the Explorers you follow.</Text>
        </View>
      </View>

      <View style={styles.quickActions}>
        {/* The camera, not the uploader. A Moment is made by taking a photo. */}
        <Pressable style={styles.createButton} onPress={()=>router.push("/camera")}>
          <Text style={styles.createText}>＋ New Moment</Text>
        </Pressable>
        <Pressable style={styles.findButton} onPress={()=>router.push("/explorers")}>
          <Text style={styles.findText}>Find Explorers</Text>
        </Pressable>
      </View>

      {loading && <ActivityIndicator size="large" color={INK.blue} style={styles.loader}/>}

      {!loading && !!error && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>⚠️</Text>
          <Text style={styles.emptyTitle}>Feed unavailable</Text>
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      )}

      {!loading && !error && items.length===0 && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>🧭</Text>
          <Text style={styles.emptyTitle}>Build your Explorer feed</Text>
          <Text style={styles.emptyText}>Follow Explorers to see their reviews, Moments, Memories and favourite places here.</Text>
          <Pressable style={styles.emptyButton} onPress={()=>router.push("/explorers")}><Text style={styles.emptyButtonText}>Find Explorers</Text></Pressable>
        </View>
      )}
    </>
  );

  const footer=(
    <View style={styles.footer}>
      {loadingMore && <ActivityIndicator color={INK.blue}/>}

      {!!pageError && (
        <View style={styles.pageErrorCard}>
          <Text style={styles.pageErrorText}>{pageError}</Text>
          <Pressable
            style={styles.retryButton}
            accessibilityRole="button"
            accessibilityLabel="Try loading more posts again"
            onPress={loadMore}
          >
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      )}

      {reachedEnd && items.length>0 && !pageError && (
        <Text style={styles.endText}>That is everything for now.</Text>
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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={INK.blue}/>}
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
  screen:{flex:1,backgroundColor:INK.paper},
  content:{padding:18,paddingBottom:70},
  headingRow:{marginBottom:16},
  headingText:{flex:1},
  eyebrow:{color:INK.blue,fontSize:10,fontWeight:"900",letterSpacing:1},
  title:{color:INK.ink,fontSize:32,fontWeight:"900",marginTop:4},
  subtitle:{color:INK.inkSoft,fontSize:14,lineHeight:21,marginTop:6,maxWidth:540},
  quickActions:{flexDirection:"row",gap:10,marginBottom:17},
  createButton:{flex:1,backgroundColor:INK.blue,borderRadius:13,paddingVertical:13,alignItems:"center"},
  createText:{color:INK.card,fontWeight:"900"},
  findButton:{flex:1,backgroundColor:INK.card,borderColor:INK.ink,borderWidth:1,borderRadius:13,paddingVertical:13,alignItems:"center"},
  findText:{color:INK.ink,fontWeight:"900"},
  loader:{marginTop:45},
  footer:{paddingTop:4,paddingBottom:8,alignItems:"center"},
  endText:{color:INK.inkSoft,fontSize:12,paddingVertical:14},
  pageErrorCard:{backgroundColor:INK.card,borderColor:INK.ink,borderWidth:2,borderRadius:13,padding:14,alignItems:"center",alignSelf:"stretch"},
  pageErrorText:{color:INK.ink,fontSize:13,lineHeight:19,textAlign:"center"},
  retryButton:{marginTop:11,backgroundColor:INK.paper,borderColor:INK.ink,borderWidth:2,borderRadius:99,paddingHorizontal:18,paddingVertical:10,minHeight:44,justifyContent:"center"},
  retryText:{color:INK.ink,fontWeight:"900",fontSize:13},
  emptyCard:{backgroundColor:INK.card,borderColor:INK.ink,borderWidth:1,borderRadius:17,padding:27,alignItems:"center",marginTop:18},
  emptyIcon:{fontSize:36},
  emptyTitle:{color:INK.ink,fontSize:20,fontWeight:"900",textAlign:"center",marginTop:9},
  emptyText:{color:INK.inkSoft,lineHeight:21,textAlign:"center",marginTop:7},
  emptyButton:{backgroundColor:INK.blue,borderRadius:11,paddingHorizontal:18,paddingVertical:11,marginTop:16},
  emptyButtonText:{color:INK.card,fontWeight:"900"}
});

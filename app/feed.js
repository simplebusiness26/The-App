import React,{useCallback,useRef,useState} from "react";
import {ActivityIndicator,FlatList,Pressable,RefreshControl,StyleSheet,Text,View} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../services/supabase";
import FeedCard,{listingRoute} from "../components/FeedCard";
import AlexJourneyHeader from "../components/AlexJourneyHeader";
import {INK} from "../utils/tokens";

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
  const inFlight=useRef(false);
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
    if(inFlight.current || reachedEnd || loading || !cursor.current) return;
    inFlight.current=true;
    setLoadingMore(true);
    setPageError("");

    const {data,error:pageFetchError}=await fetchPage(cursor.current);
    if(pageFetchError){
      console.log(pageFetchError);
      setPageError("More posts could not be loaded.");
    }else{
      const page=data || [];
      if(page.length===0){
        setReachedEnd(true);
      }else{
        setItems((current)=>{
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
    else if(item.item_type==="memory") router.push(`/memories/${item.item_id}`);
    else router.push({pathname:`/social-comments/${item.item_id}`,params:{type:"review"}});
  },[]);

  const keyExtractor=useCallback((item)=>`${item.item_type}-${item.item_id}`,[]);
  const renderItem=useCallback(({item})=><FeedCard item={item} viewerId={viewerId} onOpen={openItem} onComments={openComments}/>,[viewerId,openItem,openComments]);

  const header=(
    <>
      <AlexJourneyHeader
        phase="REFLECT"
        title="What your circle discovered"
        description="Feed is where activity comes back as context: Moments, Memories, Reviews and favourites from Explorers you follow. It is reflection, not the front door to the city."
        meta="Community"
      >
        <Pressable style={styles.primaryAction} onPress={()=>router.push("/camera")}><Text style={styles.primaryActionText}>Open Camera</Text></Pressable>
        <Pressable style={styles.secondaryAction} onPress={()=>router.push("/explorers")}><Text style={styles.secondaryActionText}>Find Explorers</Text></Pressable>
      </AlexJourneyHeader>

      <View style={styles.streamIntro}>
        <Text style={styles.streamKicker}>RECENT CONTEXT</Text>
        <Text style={styles.streamTitle}>From people you chose to follow</Text>
      </View>

      {loading && <ActivityIndicator size="large" color={INK.brandDeep} style={styles.loader}/>}

      {!loading && !!error && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Feed unavailable</Text>
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      )}

      {!loading && !error && items.length===0 && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Build your reflection layer</Text>
          <Text style={styles.emptyText}>Follow Explorers to see their reviews, Moments, Memories and favourite places here.</Text>
          <Pressable style={styles.emptyButton} onPress={()=>router.push("/explorers")}><Text style={styles.emptyButtonText}>Find Explorers</Text></Pressable>
        </View>
      )}
    </>
  );

  const footer=(
    <View style={styles.footer}>
      {loadingMore && <ActivityIndicator color={INK.brandDeep}/>}
      {!!pageError && (
        <View style={styles.pageErrorCard}>
          <Text style={styles.pageErrorText}>{pageError}</Text>
          <Pressable style={styles.retryButton} accessibilityRole="button" accessibilityLabel="Try loading more posts again" onPress={loadMore}><Text style={styles.retryText}>Try again</Text></Pressable>
        </View>
      )}
      {reachedEnd && items.length>0 && !pageError && <Text style={styles.endText}>That is everything for now.</Text>}
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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={INK.brandDeep}/>}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      removeClippedSubviews={false}
      initialNumToRender={6}
      maxToRenderPerBatch={6}
      windowSize={7}
    />
  );
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:INK.paper},content:{padding:16,paddingBottom:80},
  primaryAction:{backgroundColor:INK.brand,borderRadius:14,paddingHorizontal:15,paddingVertical:12},primaryActionText:{color:INK.navy,fontWeight:"900"},
  secondaryAction:{backgroundColor:INK.navySoft,borderRadius:14,paddingHorizontal:15,paddingVertical:12},secondaryActionText:{color:INK.onNavy,fontWeight:"900"},
  streamIntro:{flexDirection:"row",alignItems:"flex-end",justifyContent:"space-between",gap:12,marginBottom:13,paddingHorizontal:3},streamKicker:{color:INK.brandDeep,fontSize:9,fontWeight:"900",letterSpacing:1},streamTitle:{color:INK.ink,fontSize:13,fontWeight:"800",textAlign:"right",flex:1},
  loader:{marginTop:45},footer:{paddingTop:4,paddingBottom:8,alignItems:"center"},endText:{color:INK.inkSoft,fontSize:12,paddingVertical:14},
  pageErrorCard:{backgroundColor:INK.card,borderColor:INK.red,borderWidth:1,borderRadius:16,padding:14,alignItems:"center",alignSelf:"stretch"},pageErrorText:{color:INK.ink,fontSize:13,lineHeight:19,textAlign:"center"},retryButton:{marginTop:11,backgroundColor:INK.navy,borderRadius:13,paddingHorizontal:18,paddingVertical:10,minHeight:44,justifyContent:"center"},retryText:{color:INK.onNavy,fontWeight:"900",fontSize:13},
  emptyCard:{backgroundColor:INK.card,borderColor:INK.hair,borderWidth:1,borderRadius:20,padding:27,alignItems:"flex-start",marginBottom:16},emptyTitle:{color:INK.ink,fontSize:20,fontWeight:"900"},emptyText:{color:INK.inkSoft,lineHeight:21,marginTop:7},emptyButton:{backgroundColor:INK.brand,borderRadius:13,paddingHorizontal:18,paddingVertical:11,marginTop:16},emptyButtonText:{color:INK.navy,fontWeight:"900"}
});

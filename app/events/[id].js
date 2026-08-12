import React,{useCallback,useState} from "react";
import {View,Text,Pressable,StyleSheet,Alert,Linking} from "react-native";
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {supabase} from "../../services/supabase";
import {loadPlaceReviews} from "../../utils/reviews";
import {formatEventPrice,formatEventRange,normalizeExternalUrl} from "../../utils/events";
import {EVENT_TYPE_LABEL} from "../../utils/markers";
import {INK} from "../../utils/tokens";
import PlaceLayout from "../../components/PlaceLayout";
import FavouriteButton from "../../components/FavouriteButton";
import EntityFollowButton from "../../components/EntityFollowButton";

// Packet 5b. An event is a dated thing, so it is a place page with a clock on
// it: the same hero, rating, reviews and photo viewer as a business, plus a
// start time that decides whether reviewing is open yet.
//
// event_reviews is its own table with its own column names, so its rows are
// normalised into the shape PlaceReview already renders rather than the layout
// growing a second review component.

export default function EventDetails(){
  const {id}=useLocalSearchParams();
  const eventId=Array.isArray(id) ? id[0] : id;

  const [event,setEvent]=useState(null);
  const [reviews,setReviews]=useState([]);
  const [user,setUser]=useState(null);
  const [profile,setProfile]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  useFocusEffect(useCallback(()=>{
    if(eventId) loadEvent();
  },[eventId]));

  async function loadEvent(){
    setLoading(true);
    setError("");

    const {data:{user:currentUser}}=await supabase.auth.getUser();
    setUser(currentUser || null);

    let profileRow=null;
    if(currentUser){
      const {data}=await supabase.from("profiles").select("id").eq("id",currentUser.id).single();
      profileRow=data || null;
    }
    setProfile(profileRow);

    const [eventResult,reviewResult]=await Promise.all([
      supabase.from("events").select("*").eq("id",eventId).single(),
      loadPlaceReviews("event",eventId)
    ]);

    if(eventResult.error){
      setError("This event could not be found or is no longer published.");
      setLoading(false);
      return;
    }

    setEvent(eventResult.data);
    setReviews(reviewResult.reviews);
    setLoading(false);
  }

  async function openBookingPage(){
    const url=normalizeExternalUrl(event?.booking_url);
    if(!url) return;

    try{
      const supported=await Linking.canOpenURL(url);
      if(!supported){
        Alert.alert("Link unavailable","This booking link cannot be opened on this device.");
        return;
      }
      await Linking.openURL(url);
    }catch{
      Alert.alert("Link unavailable","This booking link could not be opened.");
    }
  }

  function openReview(){
    if(!user){
      router.push("/auth/login");
      return;
    }
    if(new Date(event.starts_at)>new Date()){
      Alert.alert("Reviews unlock later","You can review this event once it has started.");
      return;
    }
    router.push(`/events/review/${event.id}`);
  }

  const isManager=!!user && event?.manager_id===user.id;
  const eventStarted=!!event && new Date(event.starts_at)<=new Date();
  const average=reviews.length
    ? (reviews.reduce((sum,item)=>sum+Number(item.rating || 0),0)/reviews.length).toFixed(1)
    : null;

  return(
    <PlaceLayout
      loading={loading}
      loadingLabel="Loading event..."
      error={error}
      name={event?.name}
      // The word the map will use when Packet 6 or 7 puts an event on it. The
      // event's own category is a fact about it, and sits in the info rows.
      typeLabel={EVENT_TYPE_LABEL}
      verifiedLabel={isManager && event?.status ? String(event.status).toUpperCase() : ""}
      description={event?.description || "The organiser has not added a description yet."}
      photos={event?.image_url ? [event.image_url] : []}
      photosEmptyLabel="No event photo yet"
      info={[
        {label:"WHAT",value:event?.category},
        {label:"WHEN",value:event ? `📅 ${formatEventRange(event.starts_at,event.ends_at)}` : ""},
        {label:"WHERE",value:event ? `📍 ${event.location || "Location"}${event.address ? `\n${event.address}` : ""}` : ""},
        {label:"PRICE",value:event ? formatEventPrice(event.price) : ""},
        {label:"CAPACITY",value:event ? String(event.capacity || "Open") : ""}
      ]}
      stats={event ? [
        {value:average || "—",label:"Review score"},
        {value:reviews.length,label:reviews.length===1 ? "Review" : "Reviews"}
      ] : null}
      rating={event ? {
        average,
        count:reviews.length,
        favourite:(
          // Save is private and for you; Follow is how its updates reach your
          // feed. Two different promises, so two controls rather than one.
          <View style={styles.placeActions}>
            <FavouriteButton
              targetType="event"
              targetId={event.id}
              targetName={event.name}
              targetImageUrl={event.image_url}
            />
            <EntityFollowButton
              targetType="event"
              targetId={event.id}
              targetName={event.name}
              compact
            />
          </View>
        )
      } : null}
      actions={event ? (
        <>
          {event.status==="published" && !!event.booking_url && (
            <Pressable
              style={styles.secondary}
              accessibilityRole="button"
              accessibilityLabel="Open the booking website"
              onPress={openBookingPage}
            >
              <Text style={styles.secondaryText}>Open booking website</Text>
            </Pressable>
          )}

          {!isManager && (
            // Not a disabled control and not a later stage: reviews genuinely
            // open when the event starts, and saying which it is now is state,
            // which is what this app is built on. The button stays pressable
            // and explains itself rather than going dead.
            <Pressable
              style={[styles.primary,!eventStarted && styles.locked]}
              accessibilityRole="button"
              accessibilityLabel={eventStarted ? "Leave an event review" : "Reviews unlock when the event starts"}
              onPress={openReview}
            >
              <Text style={eventStarted ? styles.primaryText : styles.lockedText}>
                {eventStarted ? "⭐ Leave an Event Review" : "🔒 Reviews unlock when the event starts"}
              </Text>
            </Pressable>
          )}
        </>
      ) : null}
      beforeReviews={isManager && event ? (
        <View style={styles.managerBox}>
          <Text style={styles.managerTitle}>Manager controls</Text>
          <Text style={styles.managerText}>Edit this listing or print its QR code from your dashboard.</Text>
          <View style={styles.buttonRow}>
            <Pressable
              style={styles.secondaryInline}
              accessibilityRole="button"
              accessibilityLabel="Edit this event"
              onPress={()=>router.push(`/events/edit/${event.id}`)}
            >
              <Text style={styles.secondaryText}>Edit event</Text>
            </Pressable>
            <Pressable
              style={styles.primaryInline}
              accessibilityRole="button"
              accessibilityLabel="Open the manager dashboard"
              onPress={()=>router.push("/manager/dashboard")}
            >
              <Text style={styles.primaryText}>Dashboard</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      reviews={reviews}
      viewerId={user?.id}
      reviewsEmpty={{
        title:"No event reviews yet",
        instruction:eventStarted
          ? "If you went, say what it was like."
          : "Reviews open once the event has started."
      }}
    />
  );
}

const styles=StyleSheet.create({
  placeActions:{flexDirection:"row",gap:10,flexWrap:"wrap",alignItems:"center"},
  primary:{minHeight:52,justifyContent:"center",alignItems:"center",backgroundColor:INK.ink,borderRadius:12,marginBottom:10},
  primaryText:{color:INK.card,fontWeight:"800"},
  primaryInline:{flex:1,minHeight:48,justifyContent:"center",alignItems:"center",backgroundColor:INK.ink,borderRadius:10},
  secondary:{minHeight:52,justifyContent:"center",alignItems:"center",borderWidth:2,borderColor:INK.ink,borderRadius:12,backgroundColor:INK.card,marginBottom:10},
  secondaryInline:{flex:1,minHeight:48,justifyContent:"center",alignItems:"center",borderWidth:2,borderColor:INK.ink,borderRadius:10,backgroundColor:INK.card},
  secondaryText:{color:INK.ink,fontWeight:"800"},
  locked:{backgroundColor:INK.card,borderWidth:2,borderColor:INK.hair},
  lockedText:{color:INK.inkSoft,fontWeight:"800"},
  managerBox:{marginTop:24,borderWidth:2,borderColor:INK.ink,borderRadius:12,padding:16,backgroundColor:INK.card},
  managerTitle:{fontSize:18,fontWeight:"800",color:INK.ink},
  managerText:{color:INK.inkSoft,lineHeight:20,marginTop:5},
  buttonRow:{flexDirection:"row",gap:10,marginTop:14}
});

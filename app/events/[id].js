import React,{useCallback,useState} from "react";
import {View,Text,StyleSheet,Alert,Linking} from "react-native";
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {supabase} from "../../services/supabase";
import {loadPlaceReviews} from "../../utils/reviews";
import {formatEventPrice,formatEventRange,normalizeExternalUrl} from "../../utils/events";
import {EVENT_TYPE_LABEL} from "../../utils/markers";
import {INK,TYPE} from "../../utils/tokens";
import {Action,Glyph,MONO,Panel,SectionRule} from "../../components/instrument";
import PlaceLayout from "../../components/PlaceLayout";
import MessageButton from "../../components/MessageButton";
import FavouriteButton from "../../components/FavouriteButton";
import EntityFollowButton from "../../components/EntityFollowButton";

// Packet 5b. An event is a dated thing, so it is a place page with a clock on
// it: the same hero, rating, reviews and photo viewer as a business, plus a
// start time that decides whether reviewing is open yet.
//
// event_reviews is its own table with its own column names, so its rows are
// normalised into the shape PlaceReview already renders rather than the layout
// growing a second review component.
//
// WHAT CHANGED IN THE REBUILD
//
// The slots this page hands the layout were hand-rolled Pressables: a filled
// ink block for the primary, a 2px-bordered block for the secondary, and copy
// carrying its own emoji -- a star before "Leave an Event Review", a padlock
// before "Reviews unlock when the event starts", a calendar and a map pin glued
// to the front of the WHEN and WHERE values. Every one of those is a kit part
// now: Action for the buttons, which take a stroked glyph off the 16x16 grid
// rather than a coloured sticker, and a Panel with a SectionRule for the
// manager box.
//
// The copy is untouched -- "Leave an Event Review" and "Reviews unlock when the
// event starts" say exactly what they said, because a locked review is a real
// state of a dated thing and not a placeholder for a later stage.

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
        // Nothing welded to the front of the value. The label already says
        // which question the row answers, and an emoji in a data row is
        // somebody else's typeface on an instrument face.
        {label:"WHEN",value:event ? formatEventRange(event.starts_at,event.ends_at) : ""},
        {label:"WHERE",value:event ? `${event.location || "Location"}${event.address ? `\n${event.address}` : ""}` : ""},
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
          {/*
            Anybody may ask whoever runs this place a question about it. It
            renders only when the listing actually has a manager -- the
            database refuses an unclaimed one and says so.
          */}
          <View style={styles.messageManagerRow}>
            <MessageButton targetType="event" targetId={event.id}/>
          </View>
          {event.status==="published" && !!event.booking_url && (
            <Action
              kind="secondary"
              label="Open booking website"
              glyph="external"
              style={styles.action}
              accessibilityLabel="Open the booking website"
              onPress={openBookingPage}
            />
          )}

          {!isManager && (
            // Not a disabled control and not a later stage: reviews genuinely
            // open when the event starts, and saying which it is now is state,
            // which is what this app is built on. The button stays pressable
            // and explains itself rather than going dead -- so it steps DOWN to
            // quiet rather than greying out, and the padlock is a stroked glyph
            // rather than an emoji the platform picked the colour of.
            <Action
              kind={eventStarted ? "primary" : "quiet"}
              label={eventStarted ? "Leave an Event Review" : "Reviews unlock when the event starts"}
              glyph={eventStarted ? "star" : "lock"}
              style={styles.action}
              accessibilityLabel={eventStarted ? "Leave an event review" : "Reviews unlock when the event starts"}
              onPress={openReview}
            />
          )}
        </>
      ) : null}
      beforeReviews={isManager && event ? (
        <View style={styles.managerBlock}>
          <SectionRule label="Manager controls" meta="YOU"/>
          <Panel style={styles.managerBox}>
            <View style={styles.managerHead}>
              <Glyph name="key" size={15} colour={INK.readoutSoft}/>
              <Text style={styles.managerLabel}>MANAGES THIS EVENT</Text>
            </View>
            <Text style={styles.managerText}>Edit this listing or print its QR code from your dashboard.</Text>
            <View style={styles.buttonRow}>
              <Action
                kind="secondary"
                label="Edit event"
                glyph="edit"
                style={styles.buttonCell}
                accessibilityLabel="Edit this event"
                onPress={()=>router.push(`/events/edit/${event.id}`)}
              />
              <Action
                kind="primary"
                label="Dashboard"
                glyph="chart"
                style={styles.buttonCell}
                accessibilityLabel="Open the manager dashboard"
                onPress={()=>router.push("/manager/dashboard")}
              />
            </View>
          </Panel>
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
  messageManagerRow:{marginBottom:10,alignItems:"flex-start"},
  placeActions:{flexDirection:"row",gap:10,flexWrap:"wrap",alignItems:"center"},
  action:{marginBottom:10},

  managerBlock:{marginTop:8},
  managerBox:{padding:14},
  managerHead:{flexDirection:"row",alignItems:"center",gap:7},
  managerLabel:{
    color:INK.readoutSoft,fontFamily:MONO,fontSize:TYPE.data.sizes.md,
    textTransform:"uppercase",letterSpacing:1
  },
  managerText:{color:INK.readoutSoft,fontSize:TYPE.body.sizes.md,lineHeight:TYPE.body.sizes.md*1.5,marginTop:7},
  buttonRow:{flexDirection:"row",gap:10,marginTop:14},
  buttonCell:{flex:1}
});

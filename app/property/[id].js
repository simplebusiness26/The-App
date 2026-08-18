import React,{useCallback,useState} from "react";
import {StyleSheet,Linking,View} from "react-native";
import {useFocusEffect,useLocalSearchParams,router} from "expo-router";
import {supabase} from "../../services/supabase";
import {loadPlaceReviews} from "../../utils/reviews";
import {PROPERTY_TYPE_LABEL} from "../../utils/markers";
import {Action} from "../../components/instrument";
import {nearestFirst} from "../../utils/geo";
import PlaceLayout from "../../components/PlaceLayout";
import MessageButton from "../../components/MessageButton";
import ClaimButton from "../../components/ClaimButton";
import FavouriteButton from "../../components/FavouriteButton";
import EntityFollowButton from "../../components/EntityFollowButton";

// Packet 5a. The twin of app/business/[id].js, and the reason the layout was
// worth extracting: the two screens were 236 and 240 lines of nearly identical
// markup, differing in the claim target, the QR button and one label.
//
// A property is a Place, so it shows the same type label its map pin does.

export default function PropertyDetails(){
  const params=useLocalSearchParams();
  const propertyId=Array.isArray(params.id) ? params.id[0] : params.id;

  const [property,setProperty]=useState(null);
  const [reviews,setReviews]=useState([]);
  const [similar,setSimilar]=useState([]);
  const [canClaim,setCanClaim]=useState(false);
  const [isOwner,setIsOwner]=useState(false);
  const [viewerId,setViewerId]=useState(null);
  const [managesThis,setManagesThis]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  useFocusEffect(useCallback(()=>{
    if(propertyId) loadAll();
  },[propertyId]));

  async function loadAll(){
    setLoading(true);
    setError("");

    const {data:{user}}=await supabase.auth.getUser();

    const [propertyResult,reviewsResult]=await Promise.all([
      supabase.from("properties").select("*").eq("id",propertyId).single(),
      loadPlaceReviews("property",propertyId)
    ]);

    if(propertyResult.error || !propertyResult.data){
      setError("This property could not be loaded.");
      setLoading(false);
      return;
    }

    setProperty(propertyResult.data);
    setReviews(reviewsResult.reviews);
    setViewerId(user?.id || null);

    // Who may reply is decided by the database, using the SAME function
    // respond_to_review checks before it writes. owner_id was the wrong test:
    // it is one way to manage a listing, not the definition of it, so a manager
    // who is not the owner row got no Reply button and could not answer their
    // own reviews.
    if(user){
      const {data:manages}=await supabase.rpc("listing_is_managed_by_user",{
        p_user_id:user.id,
        p_target_type:"property",
        p_target_id:propertyId
      });
      setManagesThis(manages===true);
    }else{
      setManagesThis(false);
    }
    setCanClaim(!!user);
    setIsOwner(!!user && propertyResult.data.owner_id===user.id);

    loadSimilar(propertyResult.data);
    setLoading(false);
  }

  async function loadSimilar(current){
    const {data}=await supabase
      .from("properties")
      .select("id,name,address,latitude,longitude")
      .neq("id",current.id)
      .limit(12);

    setSimilar(nearestFirst(current,data || []).slice(0,4).map((item)=>({
      id:item.id,
      name:item.name,
      detail:item.address,
      route:`/property/${item.id}`
    })));
  }

  function openBookingPage(){
    if(!property?.booking_url) return;
    const raw=property.booking_url.trim();
    Linking.openURL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  }

  const photos=property
    ? [...new Set((Array.isArray(property.photos) ? property.photos : []).filter(Boolean))]
    : [];

  const average=reviews.length
    ? (reviews.reduce((sum,item)=>sum+Number(item.rating || 0),0)/reviews.length).toFixed(1)
    : null;

  return(
    <PlaceLayout
      loading={loading}
      loadingLabel="Loading property..."
      error={error}
      name={property?.name}
      typeLabel={PROPERTY_TYPE_LABEL}
      // The tick is drawn by the layout now -- an emoji tick carried its own
      // colour and weight onto a two-colour instrument face.
      verifiedLabel={property?.owner_id ? "VERIFIED PROPERTY" : ""}
      description={property?.description}
      photos={photos}
      photosEmptyLabel="No property photos uploaded yet"
      // No emoji in front of a value. The label already says which field this
      // is, and a pin stuck to the front of the answer was saying it a second
      // time in somebody else's house style.
      info={[
        {label:"HOST",value:property?.host ? `Hosted by ${property.host}` : ""},
        {label:"ADDRESS",value:property?.address || ""}
      ]}
      rating={property ? {
        average,
        count:reviews.length,
        favourite:(
          // Save is private and for you; Follow is how its updates reach your
          // feed. Two different promises, so two controls rather than one.
          <View style={styles.placeActions}>
            <FavouriteButton
              targetType="property"
              targetId={property.id}
              targetName={property.name}
              targetImageUrl={photos[0] || null}
            />
            <EntityFollowButton
              targetType="property"
              targetId={property.id}
              targetName={property.name}
              compact
            />
          </View>
        )
      } : null}
      ownerAction={isOwner ? (
        <Action
          kind="quiet"
          label="Edit"
          glyph="edit"
          accessibilityLabel="Edit this property"
          style={styles.editButton}
          onPress={()=>router.push(`/property/edit/${propertyId}`)}
        />
      ) : null}
      actions={property ? (
        <>
          {/*
            Anybody may ask whoever runs this place a question about it. It
            renders only when the listing actually has a manager -- the
            database refuses an unclaimed one and says so.
          */}
          <View style={styles.messageManagerRow}>
            <MessageButton targetType="property" targetId={property.id}/>
          </View>
          {!!property.booking_url && (
            <Action
              kind="secondary"
              label="Open Booking Page"
              glyph="external"
              accessibilityLabel="Open the booking page"
              style={styles.secondary}
              onPress={openBookingPage}
            />
          )}

          {/* The one filled control on the page, and the only thing allowed to
              carry a state ink -- with dark text on it, per the contrast table
              in docs/design-system.md. */}
          <Action
            kind="primary"
            label="Leave a Property Review"
            glyph="star"
            accessibilityLabel="Leave a property review"
            style={styles.primary}
            onPress={()=>router.push(`/property/review/${propertyId}`)}
          />

          {isOwner && (
            <Action
              kind="secondary"
              label="Open Printable Verified-Review QR"
              glyph="qr"
              accessibilityLabel="Open the printable verified-review QR"
              style={styles.secondary}
              onPress={()=>router.push(`/manager/qr/property/${propertyId}`)}
            />
          )}

          {canClaim && !property.owner_id && <ClaimButton propertyId={propertyId}/>}
        </>
      ) : null}
      reviews={reviews}
      viewerId={viewerId}
      viewerManagesThis={managesThis}
      reviewsEmpty={{title:"No reviews yet",instruction:"Be the first to share your stay."}}
      similar={similar}
      similarLabel="Other stays nearby"
      footnote={{
        title:"Verified visit QR",
        body:"The on-site verification code is only available on the manager’s printable sign. It is not displayed publicly on this page."
      }}
    />
  );
}


const styles=StyleSheet.create({
  messageManagerRow:{marginBottom:10,alignItems:"flex-start"},
  placeActions:{flexDirection:"row",gap:10,flexWrap:"wrap",alignItems:"center"},
  editButton:{marginLeft:10,paddingHorizontal:12},
  primary:{marginBottom:10},
  secondary:{marginBottom:10}
});

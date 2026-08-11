import React,{useCallback,useState} from "react";
import {Text,Pressable,StyleSheet,Linking,View} from "react-native";
import {useFocusEffect,useLocalSearchParams,router} from "expo-router";
import {supabase} from "../../services/supabase";
import {loadPlaceReviews} from "../../utils/reviews";
import {PROPERTY_TYPE_LABEL} from "../../utils/markers";
import {INK} from "../../utils/tokens";
import {nearestFirst} from "../../utils/geo";
import PlaceLayout from "../../components/PlaceLayout";
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
      verifiedLabel={property?.owner_id ? "✓ VERIFIED PROPERTY" : ""}
      description={property?.description}
      photos={photos}
      photosEmptyLabel="No property photos uploaded yet"
      info={[
        {label:"HOST",value:property?.host ? `Hosted by ${property.host}` : ""},
        {label:"ADDRESS",value:property?.address ? `📍 ${property.address}` : ""}
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
        <Pressable
          style={styles.editButton}
          accessibilityRole="button"
          accessibilityLabel="Edit this property"
          onPress={()=>router.push(`/property/edit/${propertyId}`)}
        >
          <Text style={styles.editText}>Edit</Text>
        </Pressable>
      ) : null}
      actions={property ? (
        <>
          {!!property.booking_url && (
            <Pressable
              style={styles.secondary}
              accessibilityRole="button"
              accessibilityLabel="Open the booking page"
              onPress={openBookingPage}
            >
              <Text style={styles.secondaryText}>Open Booking Page</Text>
            </Pressable>
          )}

          <Pressable
            style={styles.primary}
            accessibilityRole="button"
            accessibilityLabel="Leave a property review"
            onPress={()=>router.push(`/property/review/${propertyId}`)}
          >
            <Text style={styles.primaryText}>⭐ Leave a Property Review</Text>
          </Pressable>

          {isOwner && (
            <Pressable
              style={styles.secondary}
              accessibilityRole="button"
              accessibilityLabel="Open the printable verified-review QR"
              onPress={()=>router.push(`/manager/qr/property/${propertyId}`)}
            >
              <Text style={styles.secondaryText}>Open Printable Verified-Review QR</Text>
            </Pressable>
          )}

          {canClaim && !property.owner_id && <ClaimButton propertyId={propertyId}/>}
        </>
      ) : null}
      reviews={reviews}
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
  placeActions:{flexDirection:"row",gap:10,flexWrap:"wrap",alignItems:"center"},
  editButton:{borderWidth:2,borderColor:INK.ink,borderRadius:10,paddingHorizontal:14,paddingVertical:9,marginLeft:10},
  editText:{color:INK.ink,fontWeight:"800"},
  primary:{minHeight:52,justifyContent:"center",alignItems:"center",backgroundColor:INK.ink,borderRadius:12,marginBottom:10},
  primaryText:{color:INK.card,fontWeight:"800"},
  secondary:{minHeight:52,justifyContent:"center",alignItems:"center",borderWidth:2,borderColor:INK.ink,borderRadius:12,backgroundColor:INK.card,marginBottom:10},
  secondaryText:{color:INK.ink,fontWeight:"800"}
});

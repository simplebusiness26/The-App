import React,{useCallback,useState} from "react";
import {Text,Pressable,StyleSheet,Linking,View} from "react-native";
import {useFocusEffect,useLocalSearchParams,router} from "expo-router";
import {supabase} from "../../services/supabase";
import {loadPlaceReviews} from "../../utils/reviews";
import {typeLabelForBusiness} from "../../utils/markers";
import {INK} from "../../utils/tokens";
import {nearestFirst} from "../../utils/geo";
import PlaceLayout from "../../components/PlaceLayout";
import MessageButton from "../../components/MessageButton";
import ClaimButton from "../../components/ClaimButton";
import FavouriteButton from "../../components/FavouriteButton";
import EntityFollowButton from "../../components/EntityFollowButton";

// Packet 5a. Everything this screen and app/property/[id].js once duplicated --
// hero, title, verification, type, rating, essential info, reviews, photo
// viewer -- now lives in components/PlaceLayout.js. What is left here is the
// part that is genuinely about a business: which table to read, which claim
// target to offer, and what "similar nearby" means for a place with a
// classification.
//
// Directions and "Book a table" are not here on purpose. The brief draws both
// on this page; both are later stages, and a dead button is worse than none.

export default function BusinessPage(){
  const params=useLocalSearchParams();
  const businessId=Array.isArray(params.id) ? params.id[0] : params.id;

  const [business,setBusiness]=useState(null);
  const [reviews,setReviews]=useState([]);
  const [similar,setSimilar]=useState([]);
  const [canClaim,setCanClaim]=useState(false);
  const [isOwner,setIsOwner]=useState(false);
  const [viewerId,setViewerId]=useState(null);
  const [managesThis,setManagesThis]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  useFocusEffect(useCallback(()=>{
    if(businessId) loadAll();
  },[businessId]));

  async function loadAll(){
    setLoading(true);
    setError("");

    const {data:{user}}=await supabase.auth.getUser();

    const [businessResult,reviewsResult]=await Promise.all([
      supabase.from("businesses").select("*").eq("id",businessId).single(),
      loadPlaceReviews("business",businessId)
    ]);

    if(businessResult.error || !businessResult.data){
      setError("This business could not be loaded.");
      setLoading(false);
      return;
    }

    setBusiness(businessResult.data);
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
        p_target_type:"business",
        p_target_id:businessId
      });
      setManagesThis(manages===true);
    }else{
      setManagesThis(false);
    }
    setCanClaim(!!user);
    setIsOwner(!!user && businessResult.data.owner_id===user.id);

    loadSimilar(businessResult.data);
    setLoading(false);
  }

  // "Similar nearby" means the same category, not the same type: a person
  // looking at a pub is usually open to the bar next door, and with only three
  // types seeded, matching on type would return nothing for most places.
  async function loadSimilar(current){
    const {data}=await supabase
      .from("businesses")
      .select("id,name,category,business_type,latitude,longitude")
      .eq("category",current.category)
      .neq("id",current.id)
      .limit(12);

    setSimilar(nearestFirst(current,data || []).slice(0,4).map((item)=>({
      id:item.id,
      name:item.name,
      detail:typeLabelForBusiness(item),
      route:`/business/${item.id}`
    })));
  }

  function callBusiness(){
    if(business?.phone) Linking.openURL(`tel:${business.phone}`);
  }

  function openWebsite(){
    if(!business?.website) return;
    const raw=business.website.trim();
    Linking.openURL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  }

  const photos=business
    ? [...new Set([business.image,...(Array.isArray(business.photos) ? business.photos : [])].filter(Boolean))]
    : [];

  const average=reviews.length
    ? (reviews.reduce((sum,item)=>sum+Number(item.rating || 0),0)/reviews.length).toFixed(1)
    : null;

  return(
    <PlaceLayout
      loading={loading}
      loadingLabel="Loading business..."
      error={error}
      name={business?.name}
      // The same function the map marker uses, so the page and the pin cannot
      // disagree about what this place is.
      typeLabel={business ? typeLabelForBusiness(business) : ""}
      verifiedLabel={business?.owner_id ? "✓ VERIFIED BUSINESS" : ""}
      description={business?.description}
      photos={photos}
      info={[
        {label:"ADDRESS",value:business?.address ? `📍 ${business.address}` : ""},
        {label:"OPENING HOURS",value:business?.opening_hours ? `🕒 ${business.opening_hours}` : ""}
      ]}
      rating={business ? {
        average,
        count:reviews.length,
        favourite:(
          // Save is private and for you; Follow is how its updates reach your
          // feed. Two different promises, so two controls rather than one.
          <View style={styles.placeActions}>
            <FavouriteButton
              targetType="business"
              targetId={business.id}
              targetName={business.name}
              targetImageUrl={photos[0] || null}
            />
            <EntityFollowButton
              targetType="business"
              targetId={business.id}
              targetName={business.name}
              compact
            />
          </View>
        )
      } : null}
      ownerAction={isOwner ? (
        <Pressable
          style={styles.editButton}
          accessibilityRole="button"
          accessibilityLabel="Edit this business"
          onPress={()=>router.push(`/business/edit/${businessId}`)}
        >
          <Text style={styles.editText}>Edit</Text>
        </Pressable>
      ) : null}
      actions={business ? (
        <>
          {/*
            Anybody may ask whoever runs this place a question about it. It
            renders only when the listing actually has a manager -- the
            database refuses an unclaimed one and says so.
          */}
          <View style={styles.messageManagerRow}>
            <MessageButton targetType="business" targetId={business.id}/>
          </View>
          <View style={styles.actionRow}>
            {!!business.phone && (
              <Pressable style={styles.action} accessibilityRole="button" accessibilityLabel="Call this business" onPress={callBusiness}>
                <Text style={styles.actionText}>📞 Call</Text>
              </Pressable>
            )}
            {!!business.website && (
              <Pressable style={styles.action} accessibilityRole="button" accessibilityLabel="Open the website" onPress={openWebsite}>
                <Text style={styles.actionText}>🌐 Website</Text>
              </Pressable>
            )}
          </View>

          <Pressable
            style={styles.primary}
            accessibilityRole="button"
            accessibilityLabel="Leave a business review"
            onPress={()=>router.push(`/business/review/${businessId}`)}
          >
            <Text style={styles.primaryText}>⭐ Leave a Business Review</Text>
          </Pressable>

          {canClaim && !business.owner_id && <ClaimButton businessId={businessId}/>}
        </>
      ) : null}
      reviews={reviews}
      viewerId={viewerId}
      viewerManagesThis={managesThis}
      reviewsEmpty={{title:"No reviews yet",instruction:"Be the first to share your experience."}}
      similar={similar}
      similarLabel="Similar nearby"
    />
  );
}


const styles=StyleSheet.create({
  messageManagerRow:{marginBottom:10,alignItems:"flex-start"},
  placeActions:{flexDirection:"row",gap:10,flexWrap:"wrap",alignItems:"center"},
  editButton:{borderWidth:2,borderColor:INK.ink,borderRadius:6,paddingHorizontal:14,paddingVertical:9,marginLeft:10},
  editText:{color:INK.ink,fontWeight:"800"},
  actionRow:{flexDirection:"row",gap:10,marginBottom:10},
  action:{flex:1,minHeight:48,justifyContent:"center",alignItems:"center",borderWidth:2,borderColor:INK.ink,borderRadius:6,backgroundColor:INK.card},
  actionText:{color:INK.ink,fontWeight:"800"},
  primary:{minHeight:52,justifyContent:"center",alignItems:"center",backgroundColor:INK.ink,borderRadius:6,marginBottom:10},
  primaryText:{color:INK.card,fontWeight:"800"}
});

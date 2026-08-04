import React,{useCallback,useState} from "react";
import {Text,Pressable,StyleSheet,Linking,View} from "react-native";
import {useFocusEffect,useLocalSearchParams,router} from "expo-router";
import {supabase} from "../../services/supabase";
import {typeLabelForBusiness} from "../../utils/markers";
import {INK} from "../../utils/tokens";
import PlaceLayout from "../../components/PlaceLayout";
import ClaimButton from "../../components/ClaimButton";
import FavouriteButton from "../../components/FavouriteButton";

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
      supabase.from("reviews").select("*").eq("business_id",businessId).eq("moderation_status","published").order("created_at",{ascending:false})
    ]);

    if(businessResult.error || !businessResult.data){
      setError("This business could not be loaded.");
      setLoading(false);
      return;
    }

    setBusiness(businessResult.data);
    setReviews(reviewsResult.data || []);
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

    setSimilar(nearest(current,data || []).slice(0,4).map((item)=>({
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
          <FavouriteButton
            targetType="business"
            targetId={business.id}
            targetName={business.name}
            targetImageUrl={photos[0] || null}
          />
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
      reviewsEmpty={{title:"No reviews yet",instruction:"Be the first to share your experience."}}
      similar={similar}
      similarLabel="Similar nearby"
    />
  );
}

// Rough great-circle ordering. Good enough to rank a dozen places in one town,
// and it degrades to "keep the given order" when coordinates are missing rather
// than dropping the row.
function nearest(from,rows){
  const lat=Number(from.latitude);
  const lng=Number(from.longitude);
  if(!Number.isFinite(lat) || !Number.isFinite(lng)) return rows;

  return [...rows].sort((a,b)=>distance(lat,lng,a)-distance(lat,lng,b));
}

function distance(lat,lng,row){
  const rowLat=Number(row.latitude);
  const rowLng=Number(row.longitude);
  if(!Number.isFinite(rowLat) || !Number.isFinite(rowLng)) return Number.MAX_SAFE_INTEGER;
  return (rowLat-lat)**2+(rowLng-lng)**2;
}

const styles=StyleSheet.create({
  editButton:{borderWidth:2,borderColor:INK.ink,borderRadius:10,paddingHorizontal:14,paddingVertical:9,marginLeft:10},
  editText:{color:INK.ink,fontWeight:"800"},
  actionRow:{flexDirection:"row",gap:10,marginBottom:10},
  action:{flex:1,minHeight:48,justifyContent:"center",alignItems:"center",borderWidth:2,borderColor:INK.ink,borderRadius:12,backgroundColor:INK.card},
  actionText:{color:INK.ink,fontWeight:"800"},
  primary:{minHeight:52,justifyContent:"center",alignItems:"center",backgroundColor:INK.ink,borderRadius:12,marginBottom:10},
  primaryText:{color:INK.card,fontWeight:"800"}
});

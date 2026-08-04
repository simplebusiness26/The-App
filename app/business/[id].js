import React,{useCallback,useState} from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  Linking,
  ActivityIndicator,
  Modal
} from "react-native";
import {useFocusEffect,useLocalSearchParams,router} from "expo-router";
import {supabase} from "../../services/supabase";
import ClaimButton from "../../components/ClaimButton";
import FavouriteButton from "../../components/FavouriteButton";

function formatReviewDate(value){
  if(!value) return "";
  return new Date(value).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"});
}

function getInitial(name){
  return name?.trim()?.charAt(0)?.toUpperCase() || "?";
}

function cleanPhotos(value){
  return Array.isArray(value) ? value.filter(photo=>typeof photo==="string" && photo.trim()).slice(0,3) : [];
}

export default function BusinessPage(){
  const params=useLocalSearchParams();
  const businessId=Array.isArray(params.id) ? params.id[0] : params.id;
  const [business,setBusiness]=useState(null);
  const [reviews,setReviews]=useState([]);
  const [canClaim,setCanClaim]=useState(false);
  const [isOwner,setIsOwner]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [selectedPhoto,setSelectedPhoto]=useState(null);

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

    if(user){
      const {data:profile}=await supabase.from("profiles").select("is_manager").eq("id",user.id).maybeSingle();
      setCanClaim(!!profile?.is_manager);
      setIsOwner(businessResult.data.owner_id===user.id);
    }else{
      setCanClaim(false);
      setIsOwner(false);
    }

    setLoading(false);
  }

  function callBusiness(){
    if(business?.phone) Linking.openURL(`tel:${business.phone}`);
  }

  function openWebsite(){
    if(!business?.website) return;
    const raw=business.website.trim();
    Linking.openURL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  }

  if(loading){
    return <View style={styles.center}><ActivityIndicator size="large" color="#a58cff"/><Text style={styles.loadingText}>Loading business...</Text></View>;
  }

  if(error || !business){
    return <View style={styles.center}><Text style={styles.errorText}>{error || "Business not found"}</Text></View>;
  }

  const photos=[business.image,...(Array.isArray(business.photos) ? business.photos : [])].filter(Boolean);
  const uniquePhotos=[...new Set(photos)];
  const average=reviews.length ? (reviews.reduce((sum,item)=>sum+Number(item.rating || 0),0)/reviews.length).toFixed(1) : null;

  return(
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {uniquePhotos.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
            {uniquePhotos.map((photo,index)=><Image key={`${photo}-${index}`} source={{uri:photo}} style={styles.heroPhoto}/>)}
          </ScrollView>
        ) : <View style={styles.photoFallback}><Text style={styles.mutedText}>No photos uploaded yet</Text></View>}

        <View style={styles.heroCard}>
          <View style={styles.titleRow}>
            <View style={{flex:1}}>
              <Text style={styles.title}>{business.name}</Text>
              <Text style={styles.category}>{business.category}</Text>
              {!!business.owner_id && <Text style={styles.verifiedBusiness}>✓ VERIFIED BUSINESS</Text>}
            </View>
            {isOwner && <Pressable style={styles.editButton} onPress={()=>router.push(`/business/edit/${businessId}`)}><Text style={styles.buttonText}>Edit</Text></Pressable>}
          </View>

          {!!business.description && <Text style={styles.description}>{business.description}</Text>}
          {!!business.address && <View style={styles.infoCard}><Text style={styles.infoLabel}>ADDRESS</Text><Text style={styles.infoText}>📍 {business.address}</Text></View>}
          {!!business.opening_hours && <View style={styles.infoCard}><Text style={styles.infoLabel}>OPENING HOURS</Text><Text style={styles.infoText}>🕒 {business.opening_hours}</Text></View>}

          <View style={styles.statsRow}>
            <View style={styles.statCard}><Text style={styles.statValue}>{average || "—"}</Text><Text style={styles.statLabel}>Average rating</Text></View>
            <View style={styles.statCard}><Text style={styles.statValue}>{reviews.length}</Text><Text style={styles.statLabel}>{reviews.length===1 ? "Review" : "Reviews"}</Text></View>
          </View>

          <FavouriteButton targetType="business" targetId={business.id} targetName={business.name} targetImageUrl={uniquePhotos[0] || null}/>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          <View style={styles.actionRow}>
            {!!business.phone && <Pressable style={styles.actionButton} onPress={callBusiness}><Text style={styles.buttonText}>📞 Call</Text></Pressable>}
            {!!business.website && <Pressable style={styles.actionButton} onPress={openWebsite}><Text style={styles.buttonText}>🌐 Website</Text></Pressable>}
          </View>
          <Pressable style={styles.reviewButton} onPress={()=>router.push(`/business/review/${businessId}`)}><Text style={styles.buttonText}>⭐ Leave a Business Review</Text></Pressable>
          {canClaim && !business.owner_id && <ClaimButton businessId={businessId}/>} 
        </View>

        <View style={styles.section}>
          <View style={styles.reviewHeading}><Text style={styles.sectionTitle}>Reviews</Text><Text style={styles.reviewCount}>{reviews.length}</Text></View>
          {!reviews.length ? <View style={styles.emptyCard}><Text style={styles.emptyTitle}>No reviews yet</Text><Text style={styles.mutedText}>Be the first to share your experience.</Text></View> : reviews.map(review=>{
            const reviewPhotos=cleanPhotos(review.photos);
            return(
              <Pressable key={review.id} style={styles.reviewCard} onPress={()=>review.user_id && router.push(`/profile/${review.user_id}`)} disabled={!review.user_id}>
                <View style={styles.reviewHeader}>
                  <View style={styles.reviewerRow}>
                    <View style={styles.avatar}><Text style={styles.avatarText}>{getInitial(review.name)}</Text></View>
                    <View style={{flex:1}}><Text style={styles.reviewerName}>{review.name || "Explorer"}</Text><Text style={styles.reviewDate}>{formatReviewDate(review.created_at)}</Text></View>
                  </View>
                  <View style={styles.pointsBadge}><Text style={styles.pointsText}>+{review.points_awarded || 0}</Text></View>
                </View>
                <Text style={styles.stars}>{"★".repeat(Number(review.rating || 0))}<Text style={styles.emptyStars}>{"★".repeat(Math.max(0,5-Number(review.rating || 0)))}</Text></Text>
                {!!review.review_title && <Text style={styles.reviewTitle}>{review.review_title}</Text>}
                <Text style={styles.reviewComment}>{review.comment}</Text>
                {!!review.verified_qr && <Text style={styles.verifiedReview}>✓ VERIFIED ON-SITE REVIEW</Text>}
                {!!reviewPhotos.length && <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reviewPhotoRow}>{reviewPhotos.map((photo,index)=><Pressable key={`${review.id}-${index}`} onPress={(event)=>{event?.stopPropagation?.();setSelectedPhoto(photo);}}><Image source={{uri:photo}} style={styles.reviewPhoto}/></Pressable>)}</ScrollView>}
                {!!review.video_url && <Pressable style={styles.videoButton} onPress={(event)=>{event?.stopPropagation?.();Linking.openURL(review.video_url);}}><Text style={styles.videoIcon}>▶</Text><View><Text style={styles.videoTitle}>Play video review</Text><Text style={styles.videoMeta}>30 seconds or less</Text></View></Pressable>}
                {!!review.user_id && <Text style={styles.profileHint}>Tap to view Explorer profile →</Text>}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <Modal visible={!!selectedPhoto} transparent animationType="fade" onRequestClose={()=>setSelectedPhoto(null)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalClose} onPress={()=>setSelectedPhoto(null)}><Text style={styles.modalCloseText}>×</Text></Pressable>
          <Pressable style={styles.modalArea} onPress={()=>setSelectedPhoto(null)}>{selectedPhoto && <Image source={{uri:selectedPhoto}} style={styles.modalImage} resizeMode="contain"/>}</Pressable>
        </View>
      </Modal>
    </>
  );
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:"#18181b"},
  content:{padding:16,paddingBottom:50},
  center:{flex:1,backgroundColor:"#18181b",alignItems:"center",justifyContent:"center",padding:28},
  loadingText:{color:"#aaaab2",marginTop:10},
  errorText:{color:"white",fontSize:18,textAlign:"center"},
  photoRow:{paddingRight:4,marginBottom:15},
  heroPhoto:{width:285,height:195,borderRadius:17,marginRight:11,backgroundColor:"#303036"},
  photoFallback:{height:155,borderRadius:17,backgroundColor:"#242429",alignItems:"center",justifyContent:"center",marginBottom:15},
  heroCard:{backgroundColor:"#222226",borderColor:"#44444b",borderWidth:1,borderRadius:18,padding:18},
  titleRow:{flexDirection:"row",alignItems:"flex-start"},
  title:{color:"white",fontSize:29,fontWeight:"900"},
  category:{color:"#b8a7e8",fontSize:16,fontWeight:"800",marginTop:6},
  verifiedBusiness:{alignSelf:"flex-start",color:"#8fe1aa",backgroundColor:"#173923",paddingHorizontal:9,paddingVertical:5,borderRadius:18,overflow:"hidden",fontSize:10,fontWeight:"900",marginTop:9},
  editButton:{backgroundColor:"#275bd6",borderRadius:10,paddingHorizontal:14,paddingVertical:10,marginLeft:10},
  description:{color:"#c3c3cb",fontSize:15,lineHeight:22,marginTop:14},
  infoCard:{backgroundColor:"#2a2a30",borderRadius:12,padding:13,marginTop:12},
  infoLabel:{color:"#9696a0",fontSize:10,fontWeight:"900",letterSpacing:0.6},
  infoText:{color:"white",fontSize:14,lineHeight:20,marginTop:5},
  statsRow:{flexDirection:"row",gap:9,marginTop:14},
  statCard:{flex:1,backgroundColor:"#2d2938",borderRadius:12,padding:13,alignItems:"center"},
  statValue:{color:"white",fontSize:22,fontWeight:"900"},
  statLabel:{color:"#9d94ae",fontSize:11,fontWeight:"700",marginTop:3},
  section:{marginTop:24},
  sectionTitle:{color:"white",fontSize:22,fontWeight:"900",marginBottom:11},
  actionRow:{flexDirection:"row",gap:10,marginBottom:10},
  actionButton:{flex:1,backgroundColor:"#27272c",borderColor:"#505058",borderWidth:1,padding:14,borderRadius:12},
  reviewButton:{backgroundColor:"#3212b6",padding:16,borderRadius:12,marginBottom:10},
  buttonText:{color:"white",fontWeight:"900",textAlign:"center"},
  reviewHeading:{flexDirection:"row",justifyContent:"space-between",alignItems:"center"},
  reviewCount:{color:"#bca9ff",fontWeight:"900",marginBottom:11},
  emptyCard:{backgroundColor:"#222226",borderColor:"#414147",borderWidth:1,borderRadius:14,padding:18,alignItems:"center"},
  emptyTitle:{color:"white",fontWeight:"900",fontSize:17,marginBottom:5},
  mutedText:{color:"#9999a2"},
  reviewCard:{backgroundColor:"#222226",borderColor:"#414147",borderWidth:1,borderRadius:15,padding:15,marginBottom:11},
  reviewHeader:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},
  reviewerRow:{flexDirection:"row",alignItems:"center",flex:1,paddingRight:10},
  avatar:{width:42,height:42,borderRadius:21,backgroundColor:"#30216c",alignItems:"center",justifyContent:"center",marginRight:10},
  avatarText:{color:"white",fontWeight:"900"},
  reviewerName:{color:"white",fontWeight:"900",fontSize:16},
  reviewDate:{color:"#8f8f99",fontSize:11,marginTop:2},
  pointsBadge:{backgroundColor:"#332553",borderRadius:18,paddingHorizontal:10,paddingVertical:6},
  pointsText:{color:"#c6b2ff",fontWeight:"900",fontSize:12},
  stars:{color:"#f5c542",fontSize:17,marginTop:11},
  emptyStars:{color:"#55555e"},
  reviewTitle:{color:"white",fontSize:17,fontWeight:"900",marginTop:9},
  reviewComment:{color:"#c3c3cb",fontSize:15,lineHeight:22,marginTop:6},
  verifiedReview:{alignSelf:"flex-start",color:"#87dfa6",backgroundColor:"#173923",paddingHorizontal:9,paddingVertical:5,borderRadius:15,overflow:"hidden",fontSize:9,fontWeight:"900",marginTop:10},
  reviewPhotoRow:{paddingTop:12},
  reviewPhoto:{width:120,height:120,borderRadius:10,backgroundColor:"#303036",marginRight:8},
  videoButton:{backgroundColor:"#302547",borderColor:"#5d4787",borderWidth:1,borderRadius:10,padding:12,flexDirection:"row",alignItems:"center",marginTop:12},
  videoIcon:{color:"white",fontSize:20,marginRight:11},
  videoTitle:{color:"white",fontWeight:"900"},
  videoMeta:{color:"#a6a0b4",fontSize:11,marginTop:2},
  profileHint:{color:"#9e89e5",fontWeight:"800",fontSize:11,marginTop:11},
  modalBackdrop:{flex:1,backgroundColor:"rgba(0,0,0,0.94)"},
  modalArea:{flex:1,alignItems:"center",justifyContent:"center",padding:15},
  modalImage:{width:"100%",height:"100%"},
  modalClose:{position:"absolute",top:45,right:20,zIndex:2,width:44,height:44,borderRadius:22,backgroundColor:"rgba(255,255,255,0.18)",alignItems:"center",justifyContent:"center"},
  modalCloseText:{color:"white",fontSize:34,lineHeight:36}
});

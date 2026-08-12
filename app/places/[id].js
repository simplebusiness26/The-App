import React,{useCallback,useState} from "react";
import {Image,Pressable,StyleSheet,Text,View} from "react-native";
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {supabase} from "../../services/supabase";
import {loadPlaceReviews,averageRating} from "../../utils/reviews";
import PlaceLayout from "../../components/PlaceLayout";
import EntityFollowButton from "../../components/EntityFollowButton";
import {publicPlaceTypeLabel} from "../../utils/places";
import {INK} from "../../utils/tokens";

// Packet 8e: the page a park has instead of a spelling.
//
// It uses the shared PlaceLayout like every other place type, with reviews
// switched off rather than emptied. There is no public_place_reviews table
// anywhere -- rendering "No reviews yet" would invite something the app cannot
// record, which is the same reasoning 5c applied to link-ups.
//
// Deliberately absent: what is happening here right now. Active check-ins and
// live activity at a place belong to the shared activity projection, which is
// its own packet. This page is the identity a park needs before any of that can
// point at it.

export default function PublicPlacePage(){
  const params=useLocalSearchParams();
  const placeId=Array.isArray(params.id) ? params.id[0] : params.id;

  const [place,setPlace]=useState(null);
  const [viewerId,setViewerId]=useState(null);
  const [area,setArea]=useState(null);
  const [moments,setMoments]=useState([]);
  const [reviews,setReviews]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  const load=useCallback(async()=>{
    if(!placeId) return;

    setLoading(true);
    setError("");

    const {data:{user}}=await supabase.auth.getUser();
    setViewerId(user?.id || null);

    const {data,error:placeError}=await supabase
      .from("public_places")
      .select("id,name,place_type,area_id,latitude,longitude,location_description,description,image_url,status")
      .eq("id",placeId)
      .maybeSingle();

    if(placeError || !data){
      setError("This public place could not be loaded.");
      setLoading(false);
      return;
    }

    setPlace(data);

    const [areaResult,momentResult,reviewResult]=await Promise.all([
      data.area_id
        ? supabase.from("geo_areas").select("id,name,area_type,parent_area_id").eq("id",data.area_id).maybeSingle()
        : Promise.resolve({data:null}),
      // Row level security decides which of these come back: a friends-only
      // Moment reaches its author and their mutual follows and nobody else.
      supabase
        .from("explorer_moments")
        .select("id,caption,media_type,media_url,thumbnail_url,created_at,user_id")
        .eq("target_type","public_place")
        .eq("target_id",placeId)
        .eq("status","published")
        .order("created_at",{ascending:false})
        .limit(12),
      // Parks could not be reviewed at all until 20260811140000 added
      // public_place to explorer_reviews.target_type. There has never been a
      // public_place_reviews table -- a park is a place, not its own concept,
      // so it reads from the same table as every other place.
      loadPlaceReviews("public_place",placeId)
    ]);

    setArea(areaResult.data || null);
    setMoments(momentResult.data || []);
    setReviews(reviewResult.reviews);
    setLoading(false);
  },[placeId]);

  useFocusEffect(useCallback(()=>{load();},[load]));

  return(
    <PlaceLayout
      loading={loading}
      loadingLabel="Loading public place..."
      error={error}
      name={place?.name}
      typeLabel={place ? publicPlaceTypeLabel(place.place_type) : ""}
      description={place?.description}
      photos={place?.image_url ? [place.image_url] : []}
      photosEmptyLabel="No photo of this place yet"
      reviews={reviews}
      viewerId={viewerId}
      rating={{
        average:averageRating(reviews),
        count:reviews.length
      }}
      reviewsEmpty={{
        title:"No reviews yet",
        instruction:"Been here? Say what it is like."
      }}
      info={[
        {label:"AREA",value:area ? area.name : ""},
        {label:"WHERE TO FIND IT",value:place?.location_description || ""}
      ]}
      beforeActions={place ? (
        <View style={styles.followRow}>
          <EntityFollowButton
            targetType="public_place"
            targetId={place.id}
            targetName={place.name}
          />
          {!!area && (
            <EntityFollowButton
              targetType="geo_area"
              targetId={area.id}
              targetName={area.name}
              compact
            />
          )}
        </View>
      ) : null}
      actions={place ? (
        <Pressable
          style={styles.primary}
          accessibilityRole="button"
          accessibilityLabel={`Post a Moment at ${place.name}`}
          onPress={()=>router.push(`/moments/create?target_type=public_place&target_id=${place.id}`)}
        >
          <Text style={styles.primaryText}>Post a Moment here</Text>
        </Pressable>
      ) : null}
      afterReviews={place ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Moments here</Text>

          {!moments.length ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No Moments here yet</Text>
              <Text style={styles.muted}>Post one from this place and it stays attached to it.</Text>
            </View>
          ) : (
            <View style={styles.momentGrid}>
              {moments.map((moment)=>(
                <Pressable
                  key={moment.id}
                  style={styles.moment}
                  accessibilityRole="button"
                  accessibilityLabel={moment.caption || "Open this Moment"}
                  onPress={()=>router.push(`/moments/${moment.id}`)}
                >
                  {moment.media_type==="image" || moment.thumbnail_url ? (
                    <Image
                      source={{uri:moment.thumbnail_url || moment.media_url}}
                      style={styles.momentImage}
                    />
                  ) : (
                    <View style={[styles.momentImage,styles.momentFallback]}>
                      <Text style={styles.muted}>Video</Text>
                    </View>
                  )}
                  {!!moment.caption && <Text style={styles.momentCaption} numberOfLines={2}>{moment.caption}</Text>}
                </Pressable>
              ))}
            </View>
          )}
        </View>
      ) : null}
      footnote={{
        title:"Who manages this place",
        body:"Public places are maintained by the Xplorer team. Anyone can attach a Moment or check in here; nobody posts as the place itself."
      }}
    />
  );
}

const card={
  backgroundColor:INK.card,
  borderWidth:2,
  borderColor:INK.ink,
  borderRadius:12
};

const styles=StyleSheet.create({
  followRow:{flexDirection:"row",gap:10,marginTop:16,flexWrap:"wrap"},
  primary:{minHeight:52,justifyContent:"center",alignItems:"center",backgroundColor:INK.ink,borderRadius:12},
  primaryText:{color:INK.card,fontWeight:"800"},
  section:{marginTop:24},
  sectionTitle:{color:INK.ink,fontSize:21,fontWeight:"800",marginBottom:11,letterSpacing:-0.3},
  emptyCard:{...card,padding:18,alignItems:"center"},
  emptyTitle:{color:INK.ink,fontWeight:"800",fontSize:17,marginBottom:5},
  muted:{color:INK.inkSoft,textAlign:"center",lineHeight:20},
  momentGrid:{flexDirection:"row",flexWrap:"wrap",gap:10},
  moment:{...card,width:150,padding:8},
  momentImage:{width:"100%",height:110,borderRadius:8,backgroundColor:INK.hair},
  momentFallback:{alignItems:"center",justifyContent:"center"},
  momentCaption:{color:INK.ink,fontSize:12,lineHeight:17,marginTop:7}
});

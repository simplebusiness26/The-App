import React,{useEffect,useState} from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator
} from "react-native";
import {router} from "expo-router";
import {supabase} from "../services/supabase";
import ExplorerReviewForm from "./ExplorerReviewForm";
import SocialImage from "./SocialImage";
import {INK} from "../utils/tokens";

// The Review Composer -- one parameterized component replacing the 5
// near-identical review-submission screens (business/property/activity_club/
// event/public_place). FINAL_PRODUCT_CONTRACT.md: "a single parameterized
// Review Composer (type + id) ... reachable two ways: from this global
// Create action, or contextually from any Listing Detail page's own 'Leave a
// review' action."
//
// The actual form -- rating, title, comment, media, points, QR verification --
// is entirely components/ExplorerReviewForm.js, unchanged. It was already the
// one real implementation all 5 old wrapper screens rendered; nothing about
// its Supabase queries, RLS assumptions or business logic changes here. This
// file only decides HOW you arrive at it:
//
//   type + id supplied  -> contextual entry. Render the form directly, no
//                          detour. This is what the 5 thin wrapper routes
//                          (app/business/review/[id].js etc.) do, and what a
//                          listing's own "Leave a review" button does.
//
//   neither supplied     -> generic entry, from the Create hub with no
//                          context. There is nowhere to send the form yet, so
//                          this shows a picker instead and hands off to the
//                          same contextual path the moment something is
//                          picked.
//
// `onNavigate(url)`, when supplied, is called instead of `router.push(url)` --
// same pattern as components/CameraCapture.js, so components/CreateHub.js can
// close its own overlay before the screen underneath changes. `onClose`, when
// supplied, renders a "Close" row for dismissing the picker without picking
// anything (only meaningful inside the hub; the 5 routed wrappers never pass
// it, and never need to -- the header's own Back arrow already closes them).
export default function ReviewComposer({type,id,qr,onNavigate,onClose}){
  if(type && id){
    return <ExplorerReviewForm targetType={type} targetId={id} qrCode={qr}/>;
  }

  return <RecentPlacePicker onNavigate={onNavigate} onClose={onClose}/>;
}

// Where each reviewable type's contextual route actually lives. The type
// vocabulary (explorer_reviews.target_type, ExplorerReviewForm's TARGET_CONFIG)
// and the route segment disagree in two places -- activity_club/activity-clubs
// and event/events -- so this table exists rather than string-mangling the
// type into a path and hoping.
const REVIEW_ROUTE_SEGMENT={
  business:"business",
  property:"property",
  activity_club:"activity-clubs",
  event:"events",
  public_place:"places"
};

const TYPE_LABEL={
  business:"Business",
  property:"Property",
  activity_club:"Activity club",
  event:"Event",
  public_place:"Public place"
};

function navigateTo(url,onNavigate){
  if(onNavigate){onNavigate(url);return;}
  router.push(url);
}

// The generic entry's picker: "somewhere you posted from recently."
//
// THERE IS NO "RECENTLY VIEWED" ANYWHERE IN THIS APP. Nothing records a page
// view today -- checked before writing this, per RULES.md ("open the file,
// don't infer from its name"). Inventing a view-history table or a client-side
// tracker is a real, separate feature with its own retention and privacy
// questions (RULES.md's privacy gates apply to anything that reconstructs
// where somebody has been), and is out of this packet's scope.
//
// The nearest REAL signal already flowing through Supabase is the Explorer's
// own recent Moments: app/moments/create.js already writes target_type/
// target_id/target_name/target_image_url onto every attached Moment, so the
// places somebody posted from recently are, honestly, the places they were
// just standing in. That is closer to "recently visited" than "recently
// viewed", so the picker says exactly that rather than borrowing the old
// drawer's words for a mechanism this app does not have. No mock or seed
// data (RULES.md) -- if you have posted nothing with a place attached, the
// list says so and points at the other way in.
function RecentPlacePicker({onNavigate,onClose}){
  const [state,setState]=useState({phase:"loading",places:[],error:""});

  useEffect(()=>{load();},[]);

  async function load(){
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){setState({phase:"signedOut",places:[],error:""});return;}

    const {data,error}=await supabase
      .from("explorer_moments")
      .select("target_type,target_id,target_name,target_image_url,created_at")
      .eq("user_id",user.id)
      .not("target_type","is",null)
      .not("target_id","is",null)
      .order("created_at",{ascending:false})
      .limit(30);

    if(error){
      setState({phase:"ready",places:[],error:error.message});
      return;
    }

    const seen=new Set();
    const places=[];
    for(const row of data || []){
      const key=`${row.target_type}:${row.target_id}`;
      if(seen.has(key)) continue;
      seen.add(key);
      places.push(row);
      if(places.length>=12) break;
    }

    setState({phase:"ready",places,error:""});
  }

  if(state.phase==="loading"){
    return <View style={styles.centre}><ActivityIndicator size="large" color={INK.ink}/></View>;
  }

  if(state.phase==="signedOut"){
    // Signed-out gated action: an inline "sign in to continue" scoped to this
    // action, per FINAL_PRODUCT_CONTRACT.md's UX behaviour section -- not a
    // redirect that drops you somewhere unrelated. There is no stable URL for
    // this picker itself to return to (the Create hub is an overlay, not a
    // routed screen), so login/signup here return to the app generally rather
    // than to a `next=`; that is the honest limit of "returns to the exact
    // in-progress action" when the action has no address of its own. The
    // contextual path above does not have this problem: ExplorerReviewForm
    // already redirects to /auth/login and back to the same routed URL.
    return (
      <View style={styles.centre}>
        <Text style={styles.gateTitle}>Sign in to write a review</Text>
        <Text style={styles.gateText}>
          Reviews are tied to your Explorer profile, so you will need to sign
          in before writing one.
        </Text>
        <Pressable
          style={styles.gatePrimary}
          accessibilityRole="button"
          accessibilityLabel="Log in"
          onPress={()=>navigateTo("/auth/login",onNavigate)}
        >
          <Text style={styles.gatePrimaryText}>Log in</Text>
        </Pressable>
        <Pressable
          style={styles.gateSecondary}
          accessibilityRole="button"
          accessibilityLabel="Create account"
          onPress={()=>navigateTo("/auth/signup",onNavigate)}
        >
          <Text style={styles.gateSecondaryText}>Create account</Text>
        </Pressable>
      </View>
    );
  }

  const places=state.places;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>REVIEW</Text>
      <Text style={styles.title}>What do you want to review?</Text>
      <Text style={styles.subtitle}>
        Pick somewhere you posted from recently, or open the place itself and
        use "Leave a review" there.
      </Text>

      {!!state.error && <Text style={styles.errorText}>{state.error}</Text>}

      {places.length===0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Nothing here yet</Text>
          {/* Empty states are instructions, not moods -- design-system.md. */}
          <Text style={styles.emptyText}>
            Post a Moment or a Memory from a business, stay, club, event or
            public place and it will show up here to review. Or open the
            place's own page and tap "Leave a review".
          </Text>
        </View>
      ) : places.map((place)=>(
        <Pressable
          key={`${place.target_type}:${place.target_id}`}
          style={styles.row}
          accessibilityRole="button"
          accessibilityLabel={`Review ${place.target_name || TYPE_LABEL[place.target_type] || "this place"}`}
          onPress={()=>{
            const segment=REVIEW_ROUTE_SEGMENT[place.target_type];
            if(!segment) return;
            navigateTo(`/${segment}/review/${place.target_id}`,onNavigate);
          }}
        >
          {/* SocialImage, not a raw Image -- target_image_url is denormalised
              from the place's own listing photo today, but the field name
              matches this codebase's private-media convention
              (scripts/verify-private-media.cjs / test/private-media.test.js),
              so it goes through the one signing component rather than being a
              second, unchecked place a bucket going private could silently
              break. */}
          <SocialImage uri={place.target_image_url} style={styles.rowImage}/>
          <View style={styles.rowText}>
            <Text style={styles.rowName} numberOfLines={1}>{place.target_name || "Xplorer listing"}</Text>
            <Text style={styles.rowType}>{TYPE_LABEL[place.target_type] || place.target_type}</Text>
          </View>
        </Pressable>
      ))}

      {!!onClose && (
        <Pressable style={styles.cancel} accessibilityRole="button" accessibilityLabel="Close" onPress={onClose}>
          <Text style={styles.cancelText}>Close</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:INK.paper},
  content:{padding:22,paddingBottom:60},
  centre:{flex:1,backgroundColor:INK.paper,alignItems:"center",justifyContent:"center",padding:28},
  eyebrow:{color:INK.blue,fontWeight:"800",fontSize:12,letterSpacing:1},
  title:{color:INK.ink,fontSize:26,fontWeight:"900",marginTop:6},
  subtitle:{color:INK.inkSoft,fontSize:14,lineHeight:20,marginTop:7,marginBottom:18},
  errorText:{color:INK.red,fontSize:13,marginBottom:12},

  emptyCard:{
    backgroundColor:INK.card,
    borderWidth:2,
    borderColor:INK.ink,
    borderRadius:12,
    padding:18,
    shadowColor:INK.ink,
    shadowOffset:{width:3,height:3},
    shadowOpacity:1,
    shadowRadius:0,
    elevation:0
  },
  emptyTitle:{color:INK.ink,fontSize:17,fontWeight:"800",marginBottom:6},
  emptyText:{color:INK.inkSoft,fontSize:14,lineHeight:20},

  row:{
    flexDirection:"row",
    alignItems:"center",
    backgroundColor:INK.card,
    borderWidth:2,
    borderColor:INK.ink,
    borderRadius:12,
    padding:12,
    marginBottom:10,
    shadowColor:INK.ink,
    shadowOffset:{width:3,height:3},
    shadowOpacity:1,
    shadowRadius:0,
    elevation:0
  },
  rowImage:{width:48,height:48,borderRadius:10,marginRight:12,backgroundColor:INK.paper},
  rowText:{flex:1},
  rowName:{color:INK.ink,fontSize:16,fontWeight:"800"},
  rowType:{color:INK.inkSoft,fontSize:11,fontWeight:"700",marginTop:2,textTransform:"uppercase",letterSpacing:0.6},

  cancel:{alignItems:"center",paddingVertical:14,marginTop:6},
  cancelText:{color:INK.inkSoft,fontWeight:"800",fontSize:14},

  gateTitle:{color:INK.ink,fontSize:22,fontWeight:"900",textAlign:"center"},
  gateText:{color:INK.inkSoft,fontSize:14,lineHeight:20,textAlign:"center",marginTop:10,marginBottom:20,maxWidth:320},
  gatePrimary:{backgroundColor:INK.blue,borderColor:INK.ink,borderWidth:2,borderRadius:24,paddingHorizontal:28,paddingVertical:14,minHeight:44,justifyContent:"center"},
  gatePrimaryText:{color:INK.card,fontWeight:"900",fontSize:15,textAlign:"center"},
  gateSecondary:{marginTop:10,borderColor:INK.ink,borderWidth:2,borderRadius:24,paddingHorizontal:24,paddingVertical:14,minHeight:44,justifyContent:"center"},
  gateSecondaryText:{color:INK.ink,fontWeight:"900",fontSize:15,textAlign:"center"}
});

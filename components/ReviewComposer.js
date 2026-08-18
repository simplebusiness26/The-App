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
import {CREATE_HUB_CLEARANCE} from "./CreateHub";
import {INK,SHAPE,TYPE} from "../utils/tokens";
import {Action,Empty,Frame,Glyph,MONO,Notice,Panel,Screen,ScreenTitle,SectionRule} from "./instrument";

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
    return <Screen style={styles.centre}><ActivityIndicator size="large" color={INK.exists}/></Screen>;
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
    //
    // A gate is a Notice with a scheduled edge, not a page of centred prose:
    // the instrument says what is blocking and what to do about it.
    return (
      <Screen>
        <ScrollView contentContainerStyle={[styles.content,{paddingBottom:CREATE_HUB_CLEARANCE+24}]}>
          <ScreenTitle eyebrow="REVIEW" title="Sign in to write a review"/>
          <Notice tone="scheduled" label="Sign in needed">
            Reviews are tied to your Explorer profile, so you will need to sign
            in before writing one.
          </Notice>
          <Action
            kind="primary"
            glyph="key"
            label="Log in"
            accessibilityLabel="Log in"
            onPress={()=>navigateTo("/auth/login",onNavigate)}
          />
          <Action
            kind="secondary"
            label="Create account"
            accessibilityLabel="Create account"
            style={styles.secondAction}
            onPress={()=>navigateTo("/auth/signup",onNavigate)}
          />
        </ScrollView>
      </Screen>
    );
  }

  const places=state.places;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.content,{paddingBottom:CREATE_HUB_CLEARANCE+24}]}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenTitle
          eyebrow="REVIEW"
          title="What do you want to review?"
          meta={'Pick somewhere you posted from recently, or open the place itself and use "Leave a review" there.'}
        />

        {!!state.error && <Notice tone="dispute" label="Not loaded">{state.error}</Notice>}

        <SectionRule label="Somewhere you posted from" meta={places.length ? String(places.length) : null}/>

        {places.length===0 ? (
          /* Empty states are instructions, not moods -- design-system.md. */
          <Empty
            glyph="pin"
            title="Nothing here yet"
            instruction={'Post a Moment or a Memory from a business, stay, club, event or public place and it will show up here to review. Or open the place\'s own page and tap "Leave a review".'}
          />
        ) : places.map((place)=>(
          <Pressable
            key={`${place.target_type}:${place.target_id}`}
            accessibilityRole="button"
            accessibilityLabel={`Review ${place.target_name || TYPE_LABEL[place.target_type] || "this place"}`}
            onPress={()=>{
              const segment=REVIEW_ROUTE_SEGMENT[place.target_type];
              if(!segment) return;
              navigateTo(`/${segment}/review/${place.target_id}`,onNavigate);
            }}
          >
            {/* A list row with a picture in it. The kit's `Row` takes a Glyph on
                its left, not a media well, so this is composed from `Panel` and
                `Frame` -- the same two parts components/FeedCard.js builds its
                own poster row from -- rather than inventing a second card. */}
            <Panel style={styles.row}>
              {/* SocialImage, not a raw Image -- target_image_url is denormalised
                  from the place's own listing photo today, but the field name
                  matches this codebase's private-media convention
                  (scripts/verify-private-media.cjs / test/private-media.test.js),
                  so it goes through the one signing component rather than being a
                  second, unchecked place a bucket going private could silently
                  break. */}
              <Frame size={46}>
                <SocialImage uri={place.target_image_url} style={styles.rowImage}/>
              </Frame>
              <View style={styles.rowText}>
                <Text style={styles.rowName} numberOfLines={1}>{place.target_name || "Xplorer listing"}</Text>
                <Text style={styles.rowType} numberOfLines={1}>{TYPE_LABEL[place.target_type] || place.target_type}</Text>
              </View>
              <Glyph name="forward" size={13} colour={INK.readoutFaint}/>
            </Panel>
          </Pressable>
        ))}

        {!!onClose && (
          <Action
            kind="quiet"
            label="Close"
            accessibilityLabel="Close"
            style={styles.close}
            onPress={onClose}
          />
        )}
      </ScrollView>
    </Screen>
  );
}

const styles=StyleSheet.create({
  content:{paddingHorizontal:16,paddingBottom:24},
  centre:{alignItems:"center",justifyContent:"center"},
  secondAction:{marginTop:10},

  row:{flexDirection:"row",alignItems:"center",gap:12,padding:11,marginBottom:8},
  rowImage:{width:46,height:46,backgroundColor:INK.inset},
  rowText:{flex:1,minWidth:0},
  rowName:{color:INK.readout,fontSize:TYPE.display.sizes.sm,fontWeight:"600",letterSpacing:-0.2},
  // What KIND of thing it is, which the app worked out -- so it is mono.
  rowType:{
    color:INK.readoutFaint,fontFamily:MONO,fontSize:TYPE.data.sizes.sm,
    textTransform:"uppercase",letterSpacing:0.8,marginTop:4
  },

  close:{marginTop:10,borderRadius:SHAPE.radius.control}
});

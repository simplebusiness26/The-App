import React,{useCallback,useMemo,useState} from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Image
} from "react-native";
import SocialImage from "./SocialImage";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../services/supabase";
import EndorseButton from "./EndorseButton";
import MyMap from "./MyMap";
import StoryRing from "./StoryRing";
import StoryViewer from "./StoryViewer";
import {managesAnyListing} from "../utils/permissions";
import {withNext} from "../utils/navigation";
import {INK,TYPE,SHAPE} from "../utils/tokens";
import {CREATE_HUB_CLEARANCE} from "./CreateHub";
import {
  Action,
  Chip,
  Empty,
  Frame,
  Glyph,
  KeyValue,
  Meter,
  MONO,
  Panel,
  ReadoutStrip,
  Row,
  Screen,
  ScreenTitle,
  Segmented,
  SectionRule
} from "./instrument";

// AN EXPLORER, READ OFF THE INSTRUMENT.
//
// Everything on this page that the app WORKED OUT -- counts, ranks, averages,
// endorsements, dates, categories -- is a measured value, so it is set in the
// data face and shown the way an instrument shows a reading: a ReadoutStrip
// across the top, KeyValues for stated facts, a Meter for a rating that used to
// be five repeated star characters. Everything a person WROTE -- their name,
// their bio, the text of a review -- stays in the body face.
//
// The emoji are gone: the pin beside an area, the map and pin on the fallback
// tiles, the play triangles, the speech bubble, the fullwidth plus on the two
// Moment buttons, the chevrons, and the five stars. All of them are Glyphs on
// the same 16x16 grid as the map markers now. Not one Supabase call, permission
// check, route or spoken label changed.

function dateLabel(value){
  if(!value) return "";
  return new Date(value).toLocaleDateString("en-GB",{
    day:"numeric",
    month:"short",
    year:"numeric"
  });
}

function listingRoute(item){
  if(item.target_type==="business") return `/business/${item.target_id}`;
  if(item.target_type==="property") return `/property/${item.target_id}`;
  if(item.target_type==="activity_club") return `/activity-clubs/${item.target_id}`;
  if(item.target_type==="event") return `/events/${item.target_id}`;
  return "/map";
}

// The face, in the bracketed well every picture in this app sits in.
function Avatar({profile,size=94}){
  return(
    <Frame size={size} round style={styles.avatarFrame}>
      {profile?.profile_photo
        ? <Image source={{uri:profile.profile_photo}} style={{width:size,height:size,borderRadius:SHAPE.radius.pill}}/>
        : <Text style={[styles.avatarLetter,{fontSize:size*0.38}]}>{profile?.full_name?.charAt(0)?.toUpperCase() || "E"}</Text>}
    </Frame>
  );
}

// Packet 8a: the scrapbook, in the brief's order.
//
// My Map is `ownerOnly`, which is what makes "a profile of another Explorer
// shows strictly less than your own" true by construction rather than by a
// screen remembering to hide something. A visitor is not shown an empty My Map;
// the tab is not in their list at all.
// Long enough that a slow connection still loads, short enough that a person
// is told something rather than left watching a spinner.
const LOAD_TIMEOUT_MS=15000;

const SCRAPBOOK_TABS=[
  {key:"adventures",label:"Adventures"},
  {key:"reviews",label:"Reviews"},
  {key:"mymap",label:"My Map",ownerOnly:true},
  {key:"collections",label:"Collections"},
  {key:"clubs",label:"Clubs"}
];

export default function ExplorerProfileScreen({profileId,ownProfile=false,belowIdentity=null}){
  const [resolvedId,setResolvedId]=useState(profileId || null);
  const [profile,setProfile]=useState(null);
  const [stats,setStats]=useState(null);
  const [reviews,setReviews]=useState([]);
  const [media,setMedia]=useState([]);
  const [favourites,setFavourites]=useState([]);
  // Live Moments only, and only as a count for the ring. The permanent grid
  // that used to live on this screen is gone -- a Moment is NOW, it expires,
  // and a permanent gallery of expiring things made a Moment into a worse
  // Memory. The Memory gallery below is the permanent one.
  const [storyOpen,setStoryOpen]=useState(false);
  const [liveMomentCount,setLiveMomentCount]=useState(0);
  const [memories,setMemories]=useState([]);
  const [reviewLikes,setReviewLikes]=useState({});
  const [reputation,setReputation]=useState(null);
  const [managesSomething,setManagesSomething]=useState(false);
  const [currentUser,setCurrentUser]=useState(null);
  const [monthlyNationalRank,setMonthlyNationalRank]=useState(null);
  const [monthlyLocalRank,setMonthlyLocalRank]=useState(null);
  const [clubs,setClubs]=useState([]);
  const [sort,setSort]=useState("recent");
  // Packet 8a: Adventures first, because the profile's job is to show what this
  // Explorer has actually done.
  const [scrapbookTab,setScrapbookTab]=useState("adventures");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  useFocusEffect(useCallback(()=>{
    loadProfile();
  },[profileId,ownProfile]));

  // Every await below is inside the try. Before this, a single rejected promise
  // -- a dropped connection, an RPC that throws rather than returning an error,
  // an auth call that fails -- skipped setLoading(false) entirely, and the
  // screen sat on a spinner with no message, no retry and nothing to tap. That
  // is indistinguishable from a blank screen, and it is what a person saw.
  //
  // `finally` is the point: the screen must always leave the loading state,
  // whatever happened. A caught failure gets a real error and a way out.
  async function loadProfile(){
    setLoading(true);
    setError("");

    // A rejected call is not the only way to get a blank screen -- a request
    // that never settles is worse, because nothing fires at all and the spinner
    // has no text, no message and nothing to tap. Reproduced in a real browser:
    // with the network black-holed, the profile rendered its header and then
    // nothing, indefinitely.
    //
    // The timer is cleared in `finally`. Left running it would outlive every
    // successful load, hold the app awake and keep Jest from exiting -- which
    // is exactly how this leak was found.
    let timer=null;

    try{
      await Promise.race([
        loadProfileInner(),
        new Promise((_,reject)=>{
          timer=setTimeout(()=>reject(new Error("Profile load timed out")),LOAD_TIMEOUT_MS);
        })
      ]);
    }catch(loadError){
      console.log("Profile load failed",loadError);
      setError("This profile could not be loaded.");
    }finally{
      if(timer) clearTimeout(timer);
      setLoading(false);
    }
  }

  async function loadProfileInner(){

    const {data:{user}}=await supabase.auth.getUser();
    setCurrentUser(user || null);

    const id=profileId || (ownProfile ? user?.id : null);
    setResolvedId(id || null);

    if(!id){
      // Deep-linking straight to /profile while signed out. TabBar's own
      // signedIn gate already sends the Me tab itself through withNext, but a
      // direct link still lands here -- so this follows the same "return to
      // the exact in-progress action" rule rather than dropping the visitor
      // on the splash.
      router.replace(withNext("/profile"));
      return;
    }

    const [profileResult,statsResult,reviewsResult,favouritesResult,momentsResult,memoriesResult]=await Promise.all([
      supabase.from("profiles").select("id,full_name,email,phone,profile_photo,bio,area,show_area,leaderboard_opt_in,is_admin").eq("id",id).single(),
      supabase.from("explorer_profile_stats").select("*").eq("user_id",id).maybeSingle(),
      supabase.from("explorer_reviews").select("*").eq("user_id",id).eq("status","published").order("created_at",{ascending:false}),
      supabase.from("explorer_favourites").select("*").eq("user_id",id).eq("is_public",true).order("sort_order",{ascending:true}).order("created_at",{ascending:false}),
      // Kept as a count for the stat card. Live ones only -- an expired Moment
      // is not a thing this Explorer currently has.
      supabase.from("explorer_moments").select("id").eq("user_id",id).eq("status","published").gt("expires_at",new Date().toISOString()),
      // Packet 8d. show_on_profile is not a permission -- row level security
      // decides what comes back, so a private Memory with the flag set reaches
      // its owner and nobody else. The scope only shapes the list.
      supabase.rpc("get_explorer_memories",{p_user_id:id,p_scope:"profile"})
    ]);

    if(profileResult.error || !profileResult.data){
      setError("This profile could not be loaded.");
      return;
    }

    const reviewRows=reviewsResult.data || [];
    let mediaRows=[];
    let likeMap={};

    if(reviewRows.length){
      const ids=reviewRows.map(item=>item.id);
      const [mediaResult,likesResult]=await Promise.all([
        supabase.from("review_media").select("*").in("review_id",ids).eq("moderation_status","published").order("sort_order",{ascending:true}),
        supabase.from("social_likes").select("target_id,user_id").eq("target_type","review").in("target_id",ids)
      ]);

      mediaRows=mediaResult.data || [];
      (likesResult.data || []).forEach(item=>{
        if(!likeMap[item.target_id]) likeMap[item.target_id]={count:0,liked:false};
        likeMap[item.target_id].count+=1;
        if(user && item.user_id===user.id) likeMap[item.target_id].liked=true;
      });
    }

    setProfile(profileResult.data);
    setStats(statsResult.data || null);
    setReviews(reviewRows);
    setMedia(mediaRows);
    setReviewLikes(likeMap);
    setFavourites(favouritesResult.data || []);
    setLiveMomentCount((momentsResult.data || []).length);

    // Anything this Explorer marked "keep as a Memory" that has since expired
    // becomes a Memory now. Nothing in this project runs on a timer, so the
    // transition is lazy and owner-scoped -- settle_my_moments only ever
    // touches the caller's own rows, which is why it is safe to call on load.
    if(user?.id===id) await supabase.rpc("settle_my_moments");
    setMemories(memoriesResult.data || []);

    // Packet 8a's Clubs tab. Approved memberships only: a pending application is
    // this Explorer asking, not a Club they are in, and putting it on a profile
    // any visitor can read would publish a request that was never accepted.
    // One tab failing must not cost the whole profile, so this is caught
    // separately: an empty Clubs tab is a far better outcome than no profile.
    try{
      const clubResult=await supabase
        .from("activity_memberships")
        .select("id,club_id,status,activity_clubs(id,name,category,location,status)")
        .eq("user_id",id)
        .eq("status","approved");

      setClubs((clubResult.data || []).filter(row=>row.activity_clubs));
    }catch(clubError){
      console.log("Clubs could not be loaded",clubError);
      setClubs([]);
    }

    const reputationResult=await supabase.rpc("get_explorer_review_reputation",{p_user_id:id});
    setReputation((reputationResult.data && reputationResult.data[0]) || null);

    // Only asked for your own profile: manages_any_listing() answers for the
    // caller, so it says nothing about somebody else's page.
    if(user && user.id===id){
      const {allowed}=await managesAnyListing();
      setManagesSomething(allowed);
    }else{
      setManagesSomething(false);
    }

    if(profileResult.data.leaderboard_opt_in!==false){
      const nationalResult=await supabase.rpc("get_explorer_leaderboard",{
        p_period:"monthly",
        p_scope:"national",
        p_area:null,
        p_limit:100
      });
      const nationalRow=(nationalResult.data || []).find(item=>item.user_id===id);
      setMonthlyNationalRank(nationalRow?.rank || null);

      if(profileResult.data.show_area && profileResult.data.area?.trim()){
        const localResult=await supabase.rpc("get_explorer_leaderboard",{
          p_period:"monthly",
          p_scope:"local",
          p_area:profileResult.data.area.trim(),
          p_limit:100
        });
        const localRow=(localResult.data || []).find(item=>item.user_id===id);
        setMonthlyLocalRank(localRow?.rank || null);
      }else{
        setMonthlyLocalRank(null);
      }
    }else{
      setMonthlyNationalRank(null);
      setMonthlyLocalRank(null);
    }
  }

  async function logout(){
    await supabase.auth.signOut();
    router.replace("/");
  }

  const mediaByReview=useMemo(()=>{
    const grouped={};
    media.forEach(item=>{
      if(!grouped[item.review_id]) grouped[item.review_id]=[];
      grouped[item.review_id].push(item);
    });
    return grouped;
  },[media]);

  const sortedReviews=useMemo(()=>{
    const rows=[...reviews];
    if(sort==="highest") return rows.sort((a,b)=>b.rating-a.rating || new Date(b.created_at)-new Date(a.created_at));
    if(sort==="lowest") return rows.sort((a,b)=>a.rating-b.rating || new Date(b.created_at)-new Date(a.created_at));
    return rows.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  },[reviews,sort]);

  const imageMedia=media.filter(item=>item.media_type==="image");
  const videoMedia=media.filter(item=>item.media_type==="video");
  const isOwner=!!currentUser && currentUser.id===resolvedId;

  if(loading){
    return(
      <Screen>
        <View style={styles.center}><ActivityIndicator size="large" color={INK.readout}/></View>
      </Screen>
    );
  }

  if(error || !profile){
    return(
      <Screen>
        <View style={styles.center}>
          <Empty
            glyph="warn"
            title="Profile unavailable"
            instruction={error || "This profile could not be loaded."}
            action={
              <Action
                kind="primary"
                glyph="refresh"
                label="Try again"
                accessibilityLabel="Try again"
                onPress={loadProfile}
              />
            }
          />
        </View>
      </Screen>
    );
  }

  return(
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/*
        THE HEAD PLATE.

        Packet 8a: three separately labelled figures.

        The brief names them Explorer Score, Average Review Score and Review
        Reputation. **Explorer Score does not exist yet** -- it belongs to
        Packet 9a, which builds the scoring engine and awards points
        server-side. `total_points` is review points and nothing else, so
        labelling it "Explorer Score" here would name a thing 9a has to build
        and then contradict.

        These are the three honest figures today's data supports. Each says
        what it counts, which is the point the brief was making: the old pair
        read AVG RATING and REVIEW POINTS, and neither said whose ratings or
        what the points were for.

        They were three pills in a row. They are one plate now -- three
        measurements with etched dividers between them -- because that is what
        an instrument does with three figures taken at the same time.
      */}
      <View style={styles.strips}>
        <View style={styles.stripCell} accessibilityLabel={`Average review score given: ${Number(stats?.average_rating_given || 0).toFixed(1)} out of 5`}>
          {/* "given", explicitly. An Explorer cannot receive a review --
              RULES.md: reviews attach to places, clubs and events. */}
          <Text style={styles.stripLabel}>AVG SCORE GIVEN</Text>
          <Text style={styles.stripValue}>{Number(stats?.average_rating_given || 0).toFixed(1)}</Text>
        </View>
        <View style={styles.stripDivider}/>
        <View style={styles.stripCell} accessibilityLabel={`Review points: ${stats?.total_points || 0}`}>
          <Text style={styles.stripLabel}>REVIEW POINTS</Text>
          <Text style={styles.stripValue}>{stats?.total_points || 0}</Text>
        </View>
        <View style={styles.stripDivider}/>
        <View style={styles.stripCell} accessibilityLabel={`Review reputation: ${Number(reputation?.total_endorsements || 0)} endorsements`}>
          <Text style={styles.stripLabel}>REVIEW REPUTATION</Text>
          <Text style={styles.stripValue}>{Number(reputation?.total_endorsements || 0)}</Text>
        </View>
      </View>

      <Panel style={styles.identity}>
        {/*
          The ring. It is the only way into somebody's live Moments now, and it
          draws nothing at all when there is nothing live -- an empty section is
          a thing a later change can accidentally populate, a ring that is not
          there cannot be tapped.
        */}
        <StoryRing ownerId={profile.id} size={112} onOpen={()=>setStoryOpen(true)}>
          <Avatar profile={profile} size={112}/>
        </StoryRing>

        <StoryViewer
          ownerId={profile.id}
          ownerName={profile.full_name || "Explorer"}
          visible={storyOpen}
          isOwner={isOwner}
          onClose={()=>setStoryOpen(false)}
        />
        <Text style={styles.profileName}>{profile.full_name || "Explorer"}</Text>
        {!!profile.show_area && !!profile.area?.trim() && (
          <View style={styles.areaRow}>
            <Glyph name="pin" size={13} colour={INK.readoutFaint}/>
            <Text style={styles.area}>{profile.area.trim()}</Text>
          </View>
        )}
        {!!profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}

        {isOwner && (
          <View style={styles.ownerActions}>
            {/* `compact` because these are two buttons sharing one row: at 412
                the full padding left "Edit profile" rendering as "EDIT PROFI…".
                Compact narrows the padding and the type, never the 44px
                target. */}
            <Action compact kind="secondary" glyph="edit" label="Edit profile" onPress={()=>router.push("/profile/edit")} style={styles.ownerAction}/>
            <Action compact kind="primary" glyph="camera" label="New Moment" onPress={()=>router.push("/camera")} style={styles.ownerAction}/>
          </View>
        )}
      </Panel>

      {/*
        Anything the surrounding screen wants directly under the identity card:
        the follower counts, the Follow button, safety options. These used to be
        stacked ABOVE this component, which pushed the whole profile down and
        clipped the top of the photo -- the counts appeared before you knew
        whose they were. Under the picture is where they belong.
      */}
      {belowIdentity}

      {/*
        MANAGE. The Me tab's tiered structure per FINAL_PRODUCT_CONTRACT.md:
        Profile (this screen) with My Places / Account & Safety / Admin Console
        underneath, replacing the drawer's old "Manage" and "Account" rows,
        which had no home at all once the drawer was removed.

        My Places is unconditional -- it is where an Explorer who manages
        nothing yet REQUESTS a capability (app/manager/dashboard.js is not
        gated on already managing something, on purpose: see
        hooks/useManagerGate.js's own comment). Gating this card on
        managesSomething would close the only door in, same mistake the old
        Manager-screen button made showing on account_type instead of on
        managing anything real.

        Admin Console only ever appears for profile.is_admin -- a separate
        flag from the manager capability layer, per CLAUDE.md's account model.
      */}
      {isOwner && (
        <>
          <SectionRule label="Manage"/>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open My Places, your manager tools"
            onPress={()=>router.push("/manager/dashboard")}
          >
            <Row
              glyph="building"
              title="My Places"
              sub={managesSomething ? "Businesses, properties, clubs and events you run" : "Request access to manage a listing"}
              right={<Glyph name="forward" size={13} colour={INK.readoutFaint}/>}
            />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open Account and Safety settings"
            onPress={()=>router.push("/settings")}
          >
            <Row
              glyph="settings"
              title="Account & Safety"
              sub="Notifications, safety, legal and your account"
              right={<Glyph name="forward" size={13} colour={INK.readoutFaint}/>}
            />
          </Pressable>

          {!!profile.is_admin && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open the Admin Console"
              onPress={()=>router.push("/admin/dashboard")}
            >
              <Row
                glyph="shield"
                title="Admin Console"
                sub="Claims, moderation and platform review queues"
                right={<Glyph name="forward" size={13} colour={INK.readoutFaint}/>}
              />
            </Pressable>
          )}
        </>
      )}

      {/* Four more measurements, on one plate. */}
      <SectionRule label="Activity"/>
      <ReadoutStrip
        items={[
          {label:"REVIEWS",value:String(stats?.review_count || 0)},
          {label:"VERIFIED",value:String(stats?.verified_review_count || 0)},
          {label:"VIDEOS",value:String(stats?.video_review_count || 0)},
          {label:"LIVE",value:String(liveMomentCount)}
        ]}
      />

      <SectionRule label="Standing"/>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open the leaderboards"
        onPress={()=>router.push("/leaderboards")}
      >
        <Row
          glyph="award"
          title="Leaderboard position"
          sub="Monthly, local and national"
          meta={monthlyLocalRank ? `LOCAL #${monthlyLocalRank}` : "LOCAL —"}
          metaSub={monthlyNationalRank ? `NATIONAL #${monthlyNationalRank}` : "NATIONAL —"}
        />
      </Pressable>

      {!!reputation && (
        <Panel style={styles.reputationCard}>
          <Text style={styles.reputationHeadline}>
            {Number(reputation.total_endorsements || 0)} useful review endorsement{Number(reputation.total_endorsements || 0)===1 ? "" : "s"}
          </Text>
          <KeyValue label="Reviews found useful" value={String(Number(reputation.reviews_with_endorsement || 0))}/>
          <KeyValue label="Avg. per review" value={Number(reputation.average_endorsements_per_review || 0).toFixed(1)}/>
          {!!reputation.most_useful_review_id && (
            <Text style={styles.reputationMostUseful}>
              Most useful review: {reputation.most_useful_review_target_name} · {Number(reputation.most_useful_review_count || 0)} people found it useful
            </Text>
          )}
        </Panel>
      )}

      {/*
        Packet 8a: the scrapbook tabs, replacing the flat run of sections the
        profile used to be. My Map appears in the list only for the owner, so a
        visitor is not offered a tab that would be empty for them -- they are
        not offered the tab at all.

        They were filled pills in an unconstrained horizontal ScrollView, then
        briefly a local copy of the kit's detented switch -- because each tab
        speaks "Show Reviews" while displaying "Reviews" and Segmented took one
        label for both. It takes a per-item accessibilityLabel now, so this is
        the kit's own selector again: one selector shape in the app.
      */}
      <Segmented
        scroll
        active={scrapbookTab}
        onChange={setScrapbookTab}
        items={SCRAPBOOK_TABS.filter(tab=>!tab.ownerOnly || isOwner).map(tab=>({
          key:tab.key,
          label:tab.label,
          accessibilityLabel:`Show ${tab.label}`
        }))}
      />

      {/*
        Packet 8b. Mounted only for the owner, which is the first of two locks --
        MyMap refuses again on the same comparison, and get_explorer_memories is
        SECURITY INVOKER so row level security refuses a third time.
      */}
      {scrapbookTab==="mymap" && isOwner && <MyMap ownerId={resolvedId} viewerId={currentUser?.id}/>}

      {scrapbookTab==="adventures" && <>
      <SectionRule label="Memories" meta={String(memories.length)}/>
      {memories.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tileScroll}
          contentContainerStyle={styles.tileRow}
        >
          {memories.map(item=>(
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={item.title || "Open this Memory"}
              onPress={()=>router.push(`/memories/${item.id}`)}
            >
              <Panel style={styles.tile}>
                <Frame ratio={1.45} style={styles.tileFrame}>
                  {item.media_url
                    ? <SocialImage uri={item.media_url} style={styles.tileImage}/>
                    : <Glyph name="map" size={22} colour={INK.readoutFaint}/>}
                </Frame>
                <Text style={styles.tileName} numberOfLines={2}>{item.title || item.target_name || "A Memory"}</Text>
                <Text style={styles.tileType}>{item.is_live ? "live" : "archived"}</Text>
              </Panel>
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <Empty
          glyph="bookmark"
          title="No Memories here yet"
          instruction={ownProfile
            ? "Keep a Memory of somewhere and choose whether it shows here."
            : "Nothing shared here yet."}
        />
      )}

      {/*
        THE PERMANENT MOMENTS GRID USED TO BE HERE.
        It listed every Moment somebody had ever posted, for ever, which made a
        Moment a Memory with a different name -- same photo, same permanence,
        two words for one thing. A Moment is NOW: it is live for a day, it is
        watched through the ring on the profile picture above, and then it goes.
        The gallery above this is the permanent one, and it is Memories.

        Nothing was deleted. Every Moment row is still in the database; it just
        no longer has a permanent home on a profile.
      */}
      <SectionRule label="Moments" meta={String(liveMomentCount)}/>
      {isOwner && (
        <Action
          kind="primary"
          glyph="camera"
          label="Share a new Moment"
          onPress={()=>router.push("/camera")}
          style={styles.wideAction}
        />
      )}
      <Empty
        glyph="live"
        title={liveMomentCount>0 ? "Live now" : "Nothing live"}
        instruction={liveMomentCount>0
          ? "Live Moments are watched through the ring on the profile picture above."
          : isOwner
            ? "Moments are live for a day and then they go. Post one and it appears as a ring on your profile picture."
            : "Nothing is live right now. Moments last a day."}
      />
      </>}

      {scrapbookTab==="reviews" && <>
      <SectionRule label="Review gallery" meta={String(imageMedia.length)}/>
      {imageMedia.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tileScroll}
          contentContainerStyle={styles.tileRow}
        >
          {imageMedia.map(item=>{
            const review=reviews.find(row=>row.id===item.review_id);
            return(
              <Pressable key={item.id} onPress={()=>review && router.push(listingRoute(review))}>
                <Frame size={166} ratio={1.15} style={styles.galleryFrame}>
                  <SocialImage uri={item.media_url} style={styles.galleryImage}/>
                  <View style={styles.galleryOverlay}>
                    <Text style={styles.galleryText} numberOfLines={1}>{review?.target_name || "Review"}</Text>
                  </View>
                </Frame>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        <Empty glyph="image" title="No review photographs yet" instruction="Images added to reviews will appear here."/>
      )}

      <SectionRule label="Reviews" meta={String(sortedReviews.length)}/>
      <View style={styles.sortRow}>
        {[{key:"recent",label:"Recent"},{key:"highest",label:"Highest"},{key:"lowest",label:"Lowest"}].map(option=>(
          <Chip
            key={option.key}
            label={option.label}
            selected={sort===option.key}
            onPress={()=>setSort(option.key)}
          />
        ))}
      </View>

      {sortedReviews.length ? sortedReviews.map(review=>{
        const reviewMedia=mediaByReview[review.id] || [];
        const photos=reviewMedia.filter(item=>item.media_type==="image");
        const video=reviewMedia.find(item=>item.media_type==="video");
        const likes=reviewLikes[review.id] || {count:0,liked:false};
        return(
          <Panel key={review.id} style={styles.reviewCard}>
            {/* The head strip every panel in the instrument carries: what kind
                of thing this is, and when. */}
            <Pressable onPress={()=>router.push(listingRoute(review))}>
              <View style={styles.reviewHead}>
                <Text style={styles.reviewType}>{review.target_type.replace("_"," ")}</Text>
                <View style={styles.reviewHeadLine}/>
                <Text style={styles.reviewDate}>{dateLabel(review.created_at).toUpperCase()}</Text>
              </View>
              <View style={styles.reviewTopRow}>
                <Text style={styles.reviewPlace}>{review.target_name}</Text>
                <Text style={styles.pointsBadge}>+{review.points_awarded || 0}</Text>
              </View>
            </Pressable>

            {/* A REVIEW SCORE IS A MEASUREMENT, SO IT IS READ OFF A SCALE.
                Five repeated star characters were a count you have to do
                yourself, in a shape belonging to the system font. */}
            <View style={styles.ratingRow} accessibilityLabel={`Rated ${review.rating} out of 5`}>
              <Meter value={review.rating} max={5} width={96} tone="exists" label="RATED"/>
              <Text style={styles.ratingValue}>{review.rating}/5</Text>
            </View>

            {!!review.title && <Text style={styles.reviewTitle}>{review.title}</Text>}
            <Text style={styles.reviewComment}>{review.comment}</Text>

            {/* Verified on-site is a fact the app checked, so it is a checked
                box on the housing rather than a green sticker. */}
            {!!review.verified_qr && (
              <View style={styles.verifiedRow}>
                <Glyph name="check" size={13} colour={INK.readoutSoft} weight={1.8}/>
                <Text style={styles.verifiedText}>VERIFIED ON-SITE REVIEW</Text>
              </View>
            )}

            {!!photos.length && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.tileScroll}
                contentContainerStyle={styles.reviewImageRow}
              >
                {photos.map(photo=>(
                  <Frame key={photo.id} size={116} style={styles.reviewImageFrame}>
                    <SocialImage uri={photo.media_url} style={styles.reviewImage}/>
                  </Frame>
                ))}
              </ScrollView>
            )}

            {!!video && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open video review"
                onPress={()=>router.push(`/social-comments/${review.id}`)}
              >
                <Row
                  glyph="play"
                  title="Open video review"
                  sub="Watch, like and join the discussion"
                  right={<Glyph name="forward" size={13} colour={INK.readoutFaint}/>}
                />
              </Pressable>
            )}

            <View style={styles.reviewActions}>
              <EndorseButton reviewId={review.id} ownerId={review.user_id} viewerId={currentUser?.id} initialCount={likes.count} initialEndorsed={likes.liked}/>
              {!!video && (
                <Pressable
                  style={styles.commentsLink}
                  accessibilityRole="button"
                  accessibilityLabel="Comments"
                  onPress={()=>router.push(`/social-comments/${review.id}`)}
                >
                  <Glyph name="comment" size={14} colour={INK.readoutSoft}/>
                  <Text style={styles.commentsLinkText}>COMMENTS</Text>
                </Pressable>
              )}
            </View>
          </Panel>
        );
      }) : (
        <Empty glyph="comment" title="No reviews yet" instruction="No reviews have been published yet."/>
      )}

      <SectionRule label="Video reviews" meta={String(videoMedia.length)}/>
      {videoMedia.length ? videoMedia.map(item=>{
        const review=reviews.find(row=>row.id===item.review_id);
        return(
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={`Open ${review?.title || review?.target_name || "this video review"}`}
            onPress={()=>review && router.push(`/social-comments/${review.id}`)}
          >
            <Panel style={styles.videoCard}>
              <Frame ratio={1.9} style={styles.videoPoster}>
                {item.thumbnail_url || review?.target_image_url
                  ? <SocialImage uri={item.thumbnail_url || review?.target_image_url} style={styles.videoPosterImage}/>
                  : null}
                <View style={styles.playCircle}>
                  <Glyph name="play" size={20} colour={INK.readout} weight={1.4}/>
                </View>
              </Frame>
              <View style={styles.videoCardBody}>
                <Text style={styles.videoCardTitle}>{review?.title || review?.target_name || "Video review"}</Text>
                <Text style={styles.videoCardPlace}>{review?.target_name}</Text>
                <Text style={styles.videoCardMeta}>{review ? `${review.rating}/5 · ${dateLabel(review.created_at)} · OPEN COMMENTS` : "VIDEO REVIEW"}</Text>
              </View>
            </Panel>
          </Pressable>
        );
      }) : (
        <Empty glyph="video" title="No video reviews yet" instruction="Video reviews will appear here."/>
      )}
      </>}

      {scrapbookTab==="collections" && <>
      <SectionRule label="Favourite places" meta={String(favourites.length)}/>
      {favourites.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tileScroll}
          contentContainerStyle={styles.tileRow}
        >
          {favourites.map(item=>(
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`Open ${item.target_name}`}
              onPress={()=>router.push(listingRoute(item))}
            >
              <Panel style={styles.tile}>
                <Frame ratio={1.45} style={styles.tileFrame}>
                  {item.target_image_url
                    ? <SocialImage uri={item.target_image_url} style={styles.tileImage}/>
                    : <Glyph name="pin" size={22} colour={INK.readoutFaint}/>}
                </Frame>
                <Text style={styles.tileName} numberOfLines={2}>{item.target_name}</Text>
                <Text style={styles.tileType}>{item.target_type.replace("_"," ")}</Text>
              </Panel>
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <Empty glyph="heart" title="No favourites shared" instruction="No favourite places have been shared yet."/>
      )}
      </>}

      {scrapbookTab==="clubs" && <>
      <SectionRule label="Clubs" meta={String(clubs.length)}/>
      {clubs.length ? clubs.map(row=>(
        <Pressable
          key={row.id}
          accessibilityRole="button"
          accessibilityLabel={`Open ${row.activity_clubs.name}`}
          onPress={()=>router.push(`/activity-clubs/${row.activity_clubs.id}`)}
        >
          <Row
            glyph="people"
            title={row.activity_clubs.name}
            sub={row.activity_clubs.location}
            meta={String(row.activity_clubs.category || "").toUpperCase()}
          />
        </Pressable>
      )) : (
        <Empty
          glyph="people"
          title="No Clubs yet"
          instruction={isOwner
            ? "Join a Club and the ones you are part of will be listed here."
            : "This Explorer is not part of any Club yet."}
        />
      )}
      </>}

      {isOwner && (
        <Action
          kind="secondary"
          glyph="close"
          label="Logout"
          accessibilityLabel="Logout"
          onPress={logout}
          style={styles.logout}
        />
      )}
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  // FIELD INSTRUMENT. A profile is not the map, so it spends NO state ink:
  // exists/scheduled/offer say what a PLACE is, and agree/dispute are a
  // manager's two answers to a review. A reputation score, a leaderboard rank
  // and a points badge are none of those -- they are readings, so they are set
  // in the readout on layered housing surfaces.
  //
  // This block is a third of the size it was, because the cards, pills, badges,
  // tabs and empty states all moved into components/instrument.js.
  screen:{flex:1,backgroundColor:INK.ground},
  // The Create action floats bottom-right over this screen; reserve its
  // footprint so the last row can be scrolled clear of it.
  content:{paddingHorizontal:16,paddingTop:14,paddingBottom:24+CREATE_HUB_CLEARANCE},
  center:{flex:1,backgroundColor:INK.ground,alignItems:"center",justifyContent:"center",padding:16},

  // The head plate. Built here rather than with ReadoutStrip for two reasons:
  // each cell carries its own spoken label ("Review points: 120") and
  // ReadoutStrip takes plain items, and Readout clamps its label to one line --
  // "REVIEW REPUTATION" is 17 mono characters and a third of a 412pt screen is
  // not wide enough for it, so it would have shipped as "REVIEW REPUTATI…".
  // Same geometry as the kit's strip, same dividers, label allowed to wrap.
  strips:{
    flexDirection:"row",
    alignItems:"stretch",
    backgroundColor:INK.panel,
    borderWidth:SHAPE.border,
    borderColor:INK.hairline,
    borderRadius:SHAPE.radius.card,
    paddingVertical:12,
    marginBottom:12
  },
  stripCell:{flex:1,alignItems:"center",paddingHorizontal:6},
  stripDivider:{width:1,backgroundColor:INK.hairline,marginVertical:2},
  // Label above value, the same way the kit's Readout sets one out, so the head
  // plate and the Activity strip further down read as the same instrument.
  stripLabel:{
    color:INK.readoutFaint,
    fontFamily:MONO,
    fontSize:TYPE.data.sizes.sm,
    textTransform:"uppercase",
    letterSpacing:TYPE.data.tracking*TYPE.data.sizes.sm,
    textAlign:"center",
    marginBottom:3
  },
  stripValue:{color:INK.readout,fontFamily:MONO,fontSize:20,fontWeight:"700",letterSpacing:-0.5},

  identity:{alignItems:"center",padding:18},
  avatarFrame:{backgroundColor:INK.inset},
  avatarLetter:{color:INK.readoutSoft,fontWeight:"700"},
  profileName:{
    color:INK.readout,
    fontSize:TYPE.display.sizes.xl,
    fontWeight:"700",
    letterSpacing:TYPE.display.tracking*TYPE.display.sizes.xl,
    textAlign:"center",
    marginTop:13
  },
  areaRow:{flexDirection:"row",alignItems:"center",gap:6,marginTop:6},
  area:{color:INK.readoutSoft,fontSize:TYPE.body.sizes.lg},
  bio:{
    color:INK.readoutSoft,
    fontSize:TYPE.body.sizes.lg,
    lineHeight:TYPE.body.sizes.lg*TYPE.body.lineHeight,
    textAlign:"center",
    marginTop:10,
    maxWidth:520
  },
  ownerActions:{flexDirection:"row",gap:9,marginTop:15,alignSelf:"stretch"},
  ownerAction:{flex:1},

  reputationCard:{padding:15,marginBottom:8},
  reputationHeadline:{
    color:INK.readout,
    fontSize:TYPE.display.sizes.md,
    fontWeight:"700",
    letterSpacing:-0.3,
    marginBottom:4
  },
  reputationMostUseful:{
    color:INK.readoutSoft,
    fontSize:TYPE.body.sizes.sm,
    lineHeight:TYPE.body.sizes.sm*TYPE.body.lineHeight,
    marginTop:11
  },


  // A horizontal ScrollView in a flex column claims the leftover vertical space
  // and stretches its children to fill it unless both of these are set --
  // measured in this repo at 402px-tall pills.
  tileScroll:{flexGrow:0,flexShrink:0},
  tileRow:{alignItems:"center",paddingRight:10,gap:10},
  tile:{width:150,padding:9},
  tileFrame:{width:"100%",backgroundColor:INK.inset},
  tileImage:{width:"100%",height:"100%"},
  tileName:{color:INK.readout,fontSize:TYPE.body.sizes.md,fontWeight:"600",marginTop:9},
  tileType:{
    color:INK.readoutSoft,
    fontFamily:MONO,
    fontSize:TYPE.data.sizes.md,
    letterSpacing:TYPE.data.tracking*TYPE.data.sizes.md,
    textTransform:"uppercase",
    marginTop:4
  },

  galleryFrame:{backgroundColor:INK.inset},
  galleryImage:{width:"100%",height:"100%"},
  galleryOverlay:{position:"absolute",left:0,right:0,bottom:0,backgroundColor:"rgba(11,14,18,0.82)",padding:8},
  galleryText:{color:INK.readout,fontSize:TYPE.body.sizes.sm,fontWeight:"600"},

  sortRow:{flexDirection:"row",flexWrap:"wrap",gap:7,marginBottom:12},

  reviewCard:{padding:15,marginBottom:12},
  reviewHead:{flexDirection:"row",alignItems:"center",gap:9,marginBottom:11},
  reviewType:{
    color:INK.readoutSoft,
    fontFamily:MONO,
    fontSize:TYPE.data.sizes.md,
    letterSpacing:TYPE.data.tracking*TYPE.data.sizes.md,
    textTransform:"uppercase"
  },
  reviewHeadLine:{flex:1,height:1,backgroundColor:INK.hairline},
  reviewDate:{
    color:INK.readoutFaint,
    fontFamily:MONO,
    fontSize:TYPE.data.sizes.sm,
    letterSpacing:0.5
  },
  reviewTopRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:10},
  reviewPlace:{flex:1,color:INK.readout,fontSize:TYPE.display.sizes.md,fontWeight:"700",letterSpacing:-0.3},
  pointsBadge:{
    color:INK.readout,
    fontFamily:MONO,
    fontSize:TYPE.data.sizes.lg,
    letterSpacing:0.5,
    backgroundColor:INK.panelRaised,
    borderWidth:SHAPE.border,
    borderColor:INK.hairlineStrong,
    borderRadius:SHAPE.radius.control,
    paddingHorizontal:9,
    paddingVertical:4,
    overflow:"hidden"
  },

  ratingRow:{flexDirection:"row",alignItems:"center",gap:10,marginTop:12},
  ratingValue:{
    color:INK.readout,
    fontFamily:MONO,
    fontSize:TYPE.data.sizes.lg,
    letterSpacing:0.9,
    textTransform:"uppercase"
  },

  reviewTitle:{color:INK.readout,fontSize:TYPE.display.sizes.sm,fontWeight:"600",marginTop:11},
  reviewComment:{
    color:INK.readout,
    fontSize:TYPE.body.sizes.lg,
    lineHeight:TYPE.body.sizes.lg*TYPE.body.lineHeight,
    marginTop:7
  },
  verifiedRow:{flexDirection:"row",alignItems:"center",gap:6,marginTop:12},
  verifiedText:{
    color:INK.readoutSoft,
    fontFamily:MONO,
    fontSize:TYPE.data.sizes.sm,
    letterSpacing:0.9,
    textTransform:"uppercase"
  },
  reviewImageRow:{alignItems:"center",paddingTop:13,gap:9},
  reviewImageFrame:{backgroundColor:INK.inset},
  reviewImage:{width:"100%",height:"100%"},

  reviewActions:{
    flexDirection:"row",
    alignItems:"center",
    gap:9,
    marginTop:13,
    paddingTop:12,
    borderTopWidth:SHAPE.border,
    borderTopColor:INK.hairline
  },
  commentsLink:{flexDirection:"row",alignItems:"center",gap:6,minHeight:36,paddingHorizontal:11},
  commentsLinkText:{
    color:INK.readoutSoft,
    fontFamily:MONO,
    fontSize:TYPE.data.sizes.md,
    letterSpacing:0.9,
    textTransform:"uppercase"
  },

  videoCard:{marginBottom:12,overflow:"hidden"},
  videoPoster:{width:"100%",backgroundColor:INK.inset},
  videoPosterImage:{width:"100%",height:"100%"},
  // A ringed dial over the frame, not a black blob: the play control is the same
  // shape language as the shutter it was filmed with.
  playCircle:{
    position:"absolute",
    width:54,
    height:54,
    borderRadius:SHAPE.radius.pill,
    backgroundColor:"rgba(11,14,18,0.78)",
    borderWidth:SHAPE.border,
    borderColor:INK.hairlineStrong,
    alignItems:"center",
    justifyContent:"center",
    paddingLeft:3
  },
  videoCardBody:{padding:14},
  videoCardTitle:{color:INK.readout,fontSize:TYPE.display.sizes.md,fontWeight:"700",letterSpacing:-0.3},
  videoCardPlace:{color:INK.readoutSoft,fontSize:TYPE.body.sizes.md,marginTop:4},
  videoCardMeta:{
    color:INK.readoutFaint,
    fontFamily:MONO,
    fontSize:TYPE.data.sizes.md,
    letterSpacing:TYPE.data.tracking*TYPE.data.sizes.md,
    marginTop:5
  },

  wideAction:{marginBottom:8},
  logout:{marginTop:25}
});

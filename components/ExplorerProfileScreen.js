import React,{useCallback,useMemo,useState} from "react";
import {
  Platform,
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

// Native matches a single family name, not a CSS stack -- see the same note in
// components/HappeningSegments.js.
const MONO=Platform.select({ios:"Menlo",android:"monospace",default:TYPE.data.family});

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

function Avatar({profile,size=94}){
  if(profile?.profile_photo){
    return <Image source={{uri:profile.profile_photo}} style={{width:size,height:size,borderRadius:size/2,backgroundColor:INK.panelRaised}}/>;
  }

  return(
    <View style={[styles.avatarFallback,{width:size,height:size,borderRadius:size/2}]}>
      <Text style={[styles.avatarLetter,{fontSize:size*0.38}]}>{profile?.full_name?.charAt(0)?.toUpperCase() || "E"}</Text>
    </View>
  );
}

function StatCard({label,value,accent=false}){
  return(
    <View style={[styles.statCard,accent && styles.statCardAccent]}>
      <Text style={[styles.statValue,accent && styles.statValueAccent]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function EmptyCard({children}){
  return <View style={styles.emptyCard}><Text style={styles.emptyText}>{children}</Text></View>;
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
    return <View style={styles.center}><ActivityIndicator size="large" color={INK.readout}/></View>;
  }

  if(error || !profile){
    return(
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Profile unavailable</Text>
        <Text style={styles.errorText}>{error || "This profile could not be loaded."}</Text>
        <Pressable
          style={styles.primaryButton}
          accessibilityRole="button"
          accessibilityLabel="Try again"
          onPress={loadProfile}
        >
          <Text style={styles.primaryButtonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  return(
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.profileCard}>
        {/*
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
        */}
        <View style={styles.topScoreRow}>
          <View style={styles.scorePill} accessibilityLabel={`Average review score given: ${Number(stats?.average_rating_given || 0).toFixed(1)} out of 5`}>
            <Text style={styles.scoreNumber}>{Number(stats?.average_rating_given || 0).toFixed(1)}</Text>
            {/* "given", explicitly. An Explorer cannot receive a review --
                RULES.md: reviews attach to places, clubs and events. */}
            <Text style={styles.scoreLabel}>AVG SCORE GIVEN</Text>
          </View>
          <View style={[styles.scorePill,styles.pointsPill]} accessibilityLabel={`Review points: ${stats?.total_points || 0}`}>
            <Text style={styles.pointsNumber}>{stats?.total_points || 0}</Text>
            <Text style={styles.scoreLabel}>REVIEW POINTS</Text>
          </View>
          <View style={[styles.scorePill,styles.reputationPill]} accessibilityLabel={`Review reputation: ${Number(reputation?.total_endorsements || 0)} endorsements`}>
            <Text style={styles.reputationNumber}>{Number(reputation?.total_endorsements || 0)}</Text>
            <Text style={styles.scoreLabel}>REVIEW REPUTATION</Text>
          </View>
        </View>

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
        {!!profile.show_area && !!profile.area?.trim() && <Text style={styles.area}>📍 {profile.area.trim()}</Text>}
        {!!profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}

        {isOwner && (
          <View style={styles.ownerActions}>
            <Pressable style={styles.editProfileButton} onPress={()=>router.push("/profile/edit")}><Text style={styles.editProfileText}>Edit profile</Text></Pressable>
            <Pressable style={styles.newMomentButton} onPress={()=>router.push("/camera")}><Text style={styles.newMomentText}>＋ New Moment</Text></Pressable>
          </View>
        )}
      </View>

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
        <View style={styles.manageSection}>
          <Text style={styles.sectionEyebrowDark}>MANAGE</Text>

          <Pressable
            style={styles.manageRow}
            accessibilityRole="button"
            accessibilityLabel="Open My Places, your manager tools"
            onPress={()=>router.push("/manager/dashboard")}
          >
            <View style={styles.manageRowText}>
              <Text style={styles.manageRowTitle}>My Places</Text>
              <Text style={styles.manageRowSub}>
                {managesSomething ? "Businesses, properties, clubs and events you run" : "Request access to manage a listing"}
              </Text>
            </View>
            <Text style={styles.manageRowChevron}>›</Text>
          </Pressable>

          <Pressable
            style={styles.manageRow}
            accessibilityRole="button"
            accessibilityLabel="Open Account and Safety settings"
            onPress={()=>router.push("/settings")}
          >
            <View style={styles.manageRowText}>
              <Text style={styles.manageRowTitle}>Account &amp; Safety</Text>
              <Text style={styles.manageRowSub}>Notifications, safety, legal and your account</Text>
            </View>
            <Text style={styles.manageRowChevron}>›</Text>
          </Pressable>

          {!!profile.is_admin && (
            <Pressable
              style={[styles.manageRow,styles.manageRowLast]}
              accessibilityRole="button"
              accessibilityLabel="Open the Admin Console"
              onPress={()=>router.push("/admin/dashboard")}
            >
              <View style={styles.manageRowText}>
                <Text style={styles.manageRowTitle}>Admin Console</Text>
                <Text style={styles.manageRowSub}>Claims, moderation and platform review queues</Text>
              </View>
              <Text style={styles.manageRowChevron}>›</Text>
            </Pressable>
          )}
        </View>
      )}

      <View style={styles.statsGrid}>
        <StatCard label="Reviews" value={stats?.review_count || 0}/>
        <StatCard label="Verified" value={stats?.verified_review_count || 0}/>
        <StatCard label="Videos" value={stats?.video_review_count || 0} accent/>
        <StatCard label="Live Moments" value={liveMomentCount} accent/>
      </View>

      <Pressable style={styles.rankCard} onPress={()=>router.push("/leaderboards")}>
        <View>
          <Text style={styles.sectionEyebrow}>MONTHLY LEADERBOARD</Text>
          <Text style={styles.rankTitle}>Leaderboard position</Text>
        </View>
        <View style={styles.rankValues}>
          <Text style={styles.rankText}>Local {monthlyLocalRank ? `#${monthlyLocalRank}` : "—"}</Text>
          <Text style={styles.rankText}>National {monthlyNationalRank ? `#${monthlyNationalRank}` : "—"}</Text>
        </View>
      </Pressable>

      {!!reputation && (
        <View style={styles.reputationCard}>
          <Text style={styles.sectionEyebrow}>REVIEW REPUTATION</Text>
          <Text style={styles.reputationHeadline}>
            {Number(reputation.total_endorsements || 0)} useful review endorsement{Number(reputation.total_endorsements || 0)===1 ? "" : "s"}
          </Text>
          <View style={styles.reputationRow}>
            <View style={styles.reputationStat}>
              <Text style={styles.reputationValue}>{Number(reputation.reviews_with_endorsement || 0)}</Text>
              <Text style={styles.reputationLabel}>Reviews found useful</Text>
            </View>
            <View style={styles.reputationStat}>
              <Text style={styles.reputationValue}>{Number(reputation.average_endorsements_per_review || 0).toFixed(1)}</Text>
              <Text style={styles.reputationLabel}>Avg. per review</Text>
            </View>
          </View>
          {!!reputation.most_useful_review_id && (
            <Text style={styles.reputationMostUseful}>
              Most useful review: {reputation.most_useful_review_target_name} · {Number(reputation.most_useful_review_count || 0)} people found it useful
            </Text>
          )}
        </View>
      )}

      {/*
        Packet 8a: the scrapbook tabs, replacing the flat run of sections the
        profile used to be. My Map appears in the list only for the owner, so a
        visitor is not offered a tab that would be empty for them -- they are
        not offered the tab at all.
      */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrapbookTabRow} contentContainerStyle={styles.scrapbookTabContent}>
        {SCRAPBOOK_TABS.filter(tab=>!tab.ownerOnly || isOwner).map(tab=>(
          <Pressable
            key={tab.key}
            style={[styles.scrapbookTab,scrapbookTab===tab.key && styles.scrapbookTabActive]}
            accessibilityRole="button"
            accessibilityLabel={`Show ${tab.label}`}
            onPress={()=>setScrapbookTab(tab.key)}
          >
            <Text style={[styles.scrapbookTabText,scrapbookTab===tab.key && styles.scrapbookTabTextActive]}>{tab.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/*
        Packet 8b. Mounted only for the owner, which is the first of two locks --
        MyMap refuses again on the same comparison, and get_explorer_memories is
        SECURITY INVOKER so row level security refuses a third time.
      */}
      {scrapbookTab==="mymap" && isOwner && <MyMap ownerId={resolvedId} viewerId={currentUser?.id}/>}

      {scrapbookTab==="adventures" && <>
      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Memories</Text><Text style={styles.sectionCount}>{memories.length}</Text></View>
      {memories.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalRow}>
          {memories.map(item=>(
            <Pressable
              key={item.id}
              style={styles.favouriteCard}
              accessibilityRole="button"
              accessibilityLabel={item.title || "Open this Memory"}
              onPress={()=>router.push(`/memories/${item.id}`)}
            >
              {item.media_url ? <SocialImage uri={item.media_url} style={styles.favouriteImage}/> : <View style={styles.favouriteFallback}><Text style={styles.favouriteEmoji}>🗺️</Text></View>}
              <Text style={styles.favouriteName} numberOfLines={2}>{item.title || item.target_name || "A Memory"}</Text>
              <Text style={styles.favouriteType}>{item.is_live ? "live" : "archived"}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <EmptyCard>
          {ownProfile
            ? "Keep a Memory of somewhere and choose whether it shows here."
            : "Nothing shared here yet."}
        </EmptyCard>
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
      {isOwner && <Pressable style={styles.createMomentWide} onPress={()=>router.push("/camera")}><Text style={styles.createMomentWideText}>＋ Share a new Moment</Text></Pressable>}
      <EmptyCard>
        {liveMomentCount>0
          ? "Live Moments are watched through the ring on the profile picture above."
          : isOwner
            ? "Moments are live for a day and then they go. Post one and it appears as a ring on your profile picture."
            : "Nothing is live right now. Moments last a day."}
      </EmptyCard>
      </>}

      {scrapbookTab==="reviews" && <>
      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Review gallery</Text><Text style={styles.sectionCount}>{imageMedia.length}</Text></View>
      {imageMedia.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalRow}>
          {imageMedia.map(item=>{
            const review=reviews.find(row=>row.id===item.review_id);
            return(
              <Pressable key={item.id} style={styles.galleryCard} onPress={()=>review && router.push(listingRoute(review))}>
                <SocialImage uri={item.media_url} style={styles.galleryImage}/>
                <View style={styles.galleryOverlay}><Text style={styles.galleryText} numberOfLines={1}>{review?.target_name || "Review"}</Text></View>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : <EmptyCard>Images added to reviews will appear here.</EmptyCard>}

      <View style={styles.reviewHeadingRow}>
        <Text style={styles.sectionTitle}>Reviews</Text>
        <View style={styles.sortRow}>
          {[{key:"recent",label:"Recent"},{key:"highest",label:"Highest"},{key:"lowest",label:"Lowest"}].map(option=>(
            <Pressable key={option.key} style={[styles.sortButton,sort===option.key && styles.sortButtonActive]} onPress={()=>setSort(option.key)}>
              <Text style={[styles.sortText,sort===option.key && styles.sortTextActive]}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {sortedReviews.length ? sortedReviews.map(review=>{
        const reviewMedia=mediaByReview[review.id] || [];
        const photos=reviewMedia.filter(item=>item.media_type==="image");
        const video=reviewMedia.find(item=>item.media_type==="video");
        const likes=reviewLikes[review.id] || {count:0,liked:false};
        return(
          <View key={review.id} style={styles.reviewCard}>
            <Pressable onPress={()=>router.push(listingRoute(review))}>
              <View style={styles.reviewTopRow}>
                <View style={styles.reviewTitleWrap}>
                  <Text style={styles.reviewPlace}>{review.target_name}</Text>
                  <Text style={styles.reviewType}>{review.target_type.replace("_"," ")} · {dateLabel(review.created_at)}</Text>
                </View>
                <View style={styles.pointsBadge}><Text style={styles.pointsBadgeText}>+{review.points_awarded || 0}</Text></View>
              </View>
            </Pressable>

            <Text style={styles.reviewStars}>{"★".repeat(review.rating)}<Text style={styles.emptyStars}>{"★".repeat(5-review.rating)}</Text></Text>
            {!!review.title && <Text style={styles.reviewTitle}>{review.title}</Text>}
            <Text style={styles.reviewComment}>{review.comment}</Text>
            {!!review.verified_qr && <View style={styles.verifiedBadge}><Text style={styles.verifiedText}>✓ VERIFIED ON-SITE REVIEW</Text></View>}

            {!!photos.length && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reviewImageRow}>
                {photos.map(photo=><SocialImage key={photo.id} uri={photo.media_url} style={styles.reviewImage}/>)}
              </ScrollView>
            )}

            {!!video && (
              <Pressable style={styles.videoButton} onPress={()=>router.push(`/social-comments/${review.id}`)}>
                <Text style={styles.videoButtonIcon}>▶</Text>
                <View style={{flex:1}}>
                  <Text style={styles.videoButtonTitle}>Open video review</Text>
                  <Text style={styles.videoButtonText}>Watch, like and join the discussion</Text>
                </View>
              </Pressable>
            )}

            <View style={styles.reviewActions}>
              <EndorseButton reviewId={review.id} ownerId={review.user_id} viewerId={currentUser?.id} initialCount={likes.count} initialEndorsed={likes.liked}/>
              {!!video && <Pressable style={styles.commentsLink} onPress={()=>router.push(`/social-comments/${review.id}`)}><Text style={styles.commentsLinkText}>💬 Comments</Text></Pressable>}
            </View>
          </View>
        );
      }) : <EmptyCard>No reviews have been published yet.</EmptyCard>}

      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Video reviews</Text><Text style={styles.sectionCount}>{videoMedia.length}</Text></View>
      {videoMedia.length ? videoMedia.map(item=>{
        const review=reviews.find(row=>row.id===item.review_id);
        return(
          <Pressable key={item.id} style={styles.videoCard} onPress={()=>review && router.push(`/social-comments/${review.id}`)}>
            <View style={styles.videoPoster}>
              {item.thumbnail_url || review?.target_image_url ? <SocialImage uri={item.thumbnail_url || review?.target_image_url} style={styles.videoPosterImage}/> : <Text style={styles.largePlay}>▶</Text>}
              <View style={styles.playOverlay}><Text style={styles.playOverlayText}>▶</Text></View>
            </View>
            <View style={styles.videoCardBody}>
              <Text style={styles.videoCardTitle}>{review?.title || review?.target_name || "Video review"}</Text>
              <Text style={styles.videoCardPlace}>{review?.target_name}</Text>
              <Text style={styles.videoCardMeta}>{review ? `${review.rating}/5 · ${dateLabel(review.created_at)} · Open comments` : "Video review"}</Text>
            </View>
          </Pressable>
        );
      }) : <EmptyCard>Video reviews will appear here.</EmptyCard>}
      </>}

      {scrapbookTab==="collections" && <>
      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Favourite places</Text><Text style={styles.sectionCount}>{favourites.length}</Text></View>
      {favourites.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalRow}>
          {favourites.map(item=>(
            <Pressable key={item.id} style={styles.favouriteCard} onPress={()=>router.push(listingRoute(item))}>
              {item.target_image_url ? <SocialImage uri={item.target_image_url} style={styles.favouriteImage}/> : <View style={styles.favouriteFallback}><Text style={styles.favouriteEmoji}>📍</Text></View>}
              <Text style={styles.favouriteName} numberOfLines={2}>{item.target_name}</Text>
              <Text style={styles.favouriteType}>{item.target_type.replace("_"," ")}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : <EmptyCard>No favourite places have been shared yet.</EmptyCard>}

      </>}

      {scrapbookTab==="clubs" && <>
      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Clubs</Text><Text style={styles.sectionCount}>{clubs.length}</Text></View>
      {clubs.length ? clubs.map(row=>(
        <Pressable
          key={row.id}
          style={styles.reviewCard}
          accessibilityRole="button"
          accessibilityLabel={`Open ${row.activity_clubs.name}`}
          onPress={()=>router.push(`/activity-clubs/${row.activity_clubs.id}`)}
        >
          <Text style={styles.reviewPlace}>{row.activity_clubs.name}</Text>
          <Text style={styles.reviewType}>{row.activity_clubs.category} · {row.activity_clubs.location}</Text>
        </Pressable>
      )) : (
        <EmptyCard>
          {isOwner
            ? "Join a Club and the ones you are part of will be listed here."
            : "This Explorer is not part of any Club yet."}
        </EmptyCard>
      )}
      </>}

      {isOwner && <Pressable style={styles.logoutButton} onPress={logout}><Text style={styles.logoutText}>Logout</Text></Pressable>}
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  // FIELD INSTRUMENT. A profile is not the map, so it spends NO state ink:
  // exists/scheduled/offer say what a PLACE is, and agree/dispute are a
  // manager's two answers to a review. A reputation score, a leaderboard rank
  // and a points badge are none of those -- they are readings, so they are set
  // in the readout on layered housing surfaces. That is also what fixed the
  // 1.99:1 reputation headline: there is no filled state colour left to put
  // light text on.
  screen:{flex:1,backgroundColor:INK.ground},
  // The Create action floats bottom-right over this screen; reserve its
  // footprint so the last row can be scrolled clear of it.
  content:{padding:18,paddingBottom:24+CREATE_HUB_CLEARANCE},
  center:{flex:1,backgroundColor:INK.ground,alignItems:"center",justifyContent:"center",padding:28},
  errorTitle:{color:INK.readout,fontSize:TYPE.display.sizes.lg,fontWeight:"700"},
  errorText:{color:INK.readoutSoft,textAlign:"center",marginTop:8},

  profileCard:{
    backgroundColor:INK.panel,
    borderColor:INK.hairline,
    borderWidth:SHAPE.border,
    borderRadius:SHAPE.radius.sheet,
    padding:20,
    alignItems:"center"
  },
  topScoreRow:{width:"100%",flexDirection:"row",justifyContent:"space-between",gap:6,marginBottom:12},
  scorePill:{
    flex:1,
    minWidth:82,
    backgroundColor:INK.panelRaised,
    borderColor:INK.hairline,
    borderWidth:SHAPE.border,
    borderRadius:SHAPE.radius.card,
    paddingHorizontal:8,
    paddingVertical:9,
    alignItems:"center"
  },
  // Emphasis is an edge, not a fill.
  reputationPill:{borderColor:INK.hairlineStrong},
  pointsPill:{borderColor:INK.hairlineStrong},
  // Numbers the app worked out: mono.
  reputationNumber:{color:INK.readout,fontFamily:MONO,fontSize:20},
  scoreNumber:{color:INK.readout,fontFamily:MONO,fontSize:20},
  pointsNumber:{color:INK.readout,fontFamily:MONO,fontSize:20},
  scoreLabel:{
    color:INK.readoutSoft,
    fontFamily:MONO,
    fontSize:TYPE.data.sizes.sm,
    letterSpacing:TYPE.data.tracking*TYPE.data.sizes.sm,
    textTransform:"uppercase",
    marginTop:2
  },

  avatarFallback:{backgroundColor:INK.panelRaised,alignItems:"center",justifyContent:"center"},
  avatarLetter:{color:INK.readout,fontWeight:"700"},
  profileName:{
    color:INK.readout,
    fontSize:TYPE.display.sizes.xl,
    fontWeight:"700",
    letterSpacing:TYPE.display.tracking*TYPE.display.sizes.xl,
    textAlign:"center",
    marginTop:13
  },
  area:{color:INK.readoutSoft,fontSize:TYPE.body.sizes.lg,marginTop:6},
  bio:{
    color:INK.readoutSoft,
    fontSize:TYPE.body.sizes.lg,
    lineHeight:TYPE.body.sizes.lg*TYPE.body.lineHeight,
    textAlign:"center",
    marginTop:10,
    maxWidth:520
  },

  ownerActions:{flexDirection:"row",gap:9,marginTop:15},
  editProfileButton:{
    borderColor:INK.hairlineStrong,
    borderWidth:SHAPE.border,
    borderRadius:SHAPE.radius.control,
    paddingHorizontal:16,
    paddingVertical:10
  },
  editProfileText:{color:INK.readout,fontWeight:"600"},
  // The one lit control: the readout itself, with dark ground text on it.
  newMomentButton:{
    backgroundColor:INK.readout,
    borderColor:INK.readout,
    borderWidth:SHAPE.border,
    borderRadius:SHAPE.radius.control,
    paddingHorizontal:16,
    paddingVertical:10
  },
  newMomentText:{color:INK.ground,fontWeight:"700"},

  manageSection:{
    backgroundColor:INK.panel,
    borderColor:INK.hairline,
    borderWidth:SHAPE.border,
    borderRadius:SHAPE.radius.sheet,
    marginTop:16,
    paddingTop:14,
    paddingHorizontal:16,
    paddingBottom:4
  },
  sectionEyebrowDark:{
    color:INK.readoutSoft,
    fontFamily:MONO,
    fontSize:TYPE.data.sizes.md,
    letterSpacing:TYPE.data.tracking*TYPE.data.sizes.md,
    textTransform:"uppercase",
    marginBottom:6
  },
  manageRow:{
    flexDirection:"row",
    alignItems:"center",
    justifyContent:"space-between",
    paddingVertical:14,
    borderTopWidth:SHAPE.border,
    borderTopColor:INK.hairline
  },
  manageRowLast:{},
  manageRowText:{flex:1,paddingRight:10},
  manageRowTitle:{color:INK.readout,fontSize:16,fontWeight:"700"},
  manageRowSub:{color:INK.readoutSoft,fontSize:TYPE.body.sizes.sm,marginTop:3,lineHeight:17},
  manageRowChevron:{color:INK.readoutSoft,fontSize:22,fontWeight:"600"},

  statsGrid:{flexDirection:"row",flexWrap:"wrap",gap:10,marginTop:13},
  statCard:{
    width:"48%",
    flexGrow:1,
    backgroundColor:INK.panel,
    borderColor:INK.hairline,
    borderWidth:SHAPE.border,
    borderRadius:SHAPE.radius.card,
    padding:15,
    alignItems:"center"
  },
  statCardAccent:{backgroundColor:INK.panelRaised,borderColor:INK.hairlineStrong},
  statValue:{color:INK.readout,fontFamily:MONO,fontSize:25},
  statValueAccent:{color:INK.readout},
  statLabel:{
    color:INK.readoutSoft,
    fontFamily:MONO,
    fontSize:TYPE.data.sizes.md,
    letterSpacing:TYPE.data.tracking*TYPE.data.sizes.md,
    textTransform:"uppercase",
    marginTop:3
  },

  rankCard:{
    backgroundColor:INK.panelRaised,
    borderColor:INK.hairlineStrong,
    borderWidth:SHAPE.border,
    borderRadius:SHAPE.radius.card,
    padding:16,
    marginTop:13,
    flexDirection:"row",
    justifyContent:"space-between",
    alignItems:"center"
  },
  sectionEyebrow:{
    color:INK.readoutSoft,
    fontFamily:MONO,
    fontSize:TYPE.data.sizes.md,
    letterSpacing:TYPE.data.tracking*TYPE.data.sizes.md,
    textTransform:"uppercase"
  },
  rankTitle:{color:INK.readout,fontWeight:"700",fontSize:16,marginTop:4},
  rankValues:{alignItems:"flex-end"},
  rankText:{color:INK.readoutSoft,fontFamily:MONO,fontSize:TYPE.data.sizes.lg,marginVertical:2},

  reputationCard:{
    backgroundColor:INK.panelRaised,
    borderColor:INK.hairlineStrong,
    borderWidth:SHAPE.border,
    borderRadius:SHAPE.radius.card,
    padding:16,
    marginTop:13
  },
  reputationHeadline:{color:INK.readout,fontSize:18,fontWeight:"700",marginTop:5},
  reputationRow:{flexDirection:"row",gap:22,marginTop:13},
  reputationStat:{alignItems:"flex-start"},
  reputationValue:{color:INK.readout,fontFamily:MONO,fontSize:22},
  reputationLabel:{
    color:INK.readoutSoft,
    fontFamily:MONO,
    fontSize:TYPE.data.sizes.md,
    letterSpacing:TYPE.data.tracking*TYPE.data.sizes.md,
    textTransform:"uppercase",
    marginTop:2
  },
  reputationMostUseful:{
    color:INK.readoutSoft,
    fontSize:TYPE.body.sizes.sm,
    lineHeight:18,
    marginTop:13
  },

  sectionHeader:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginTop:27,marginBottom:11},
  sectionTitle:{
    color:INK.readout,
    fontSize:TYPE.display.sizes.lg,
    fontWeight:"700",
    letterSpacing:TYPE.display.tracking*TYPE.display.sizes.lg
  },
  sectionCount:{
    color:INK.readoutSoft,
    fontFamily:MONO,
    fontSize:TYPE.data.sizes.lg,
    letterSpacing:TYPE.data.tracking*TYPE.data.sizes.lg
  },

  horizontalRow:{paddingRight:10},
  favouriteCard:{
    width:145,
    backgroundColor:INK.panel,
    borderColor:INK.hairline,
    borderWidth:SHAPE.border,
    borderRadius:SHAPE.radius.card,
    padding:9,
    marginRight:10
  },
  favouriteImage:{width:"100%",height:95,borderRadius:8,backgroundColor:INK.inset},
  favouriteFallback:{
    width:"100%",
    height:95,
    borderRadius:8,
    backgroundColor:INK.panelRaised,
    alignItems:"center",
    justifyContent:"center"
  },
  favouriteEmoji:{fontSize:29},
  favouriteName:{color:INK.readout,fontWeight:"700",fontSize:14,marginTop:9},
  favouriteType:{
    color:INK.readoutSoft,
    fontFamily:MONO,
    fontSize:TYPE.data.sizes.md,
    letterSpacing:TYPE.data.tracking*TYPE.data.sizes.md,
    textTransform:"uppercase",
    marginTop:4
  },

  galleryCard:{width:165,height:145,borderRadius:SHAPE.radius.card,overflow:"hidden",marginRight:10,backgroundColor:INK.inset},
  galleryImage:{width:"100%",height:"100%"},
  galleryOverlay:{position:"absolute",left:0,right:0,bottom:0,backgroundColor:"rgba(11,14,18,0.78)",padding:8},
  galleryText:{color:INK.readout,fontSize:TYPE.body.sizes.sm,fontWeight:"600"},

  emptyCard:{
    backgroundColor:INK.panel,
    borderColor:INK.hairline,
    borderWidth:SHAPE.border,
    borderRadius:SHAPE.radius.card,
    padding:18
  },
  emptyText:{color:INK.readoutSoft,textAlign:"center",lineHeight:20},

  reviewHeadingRow:{marginTop:28,marginBottom:11},
  sortRow:{flexDirection:"row",gap:7,marginTop:11},
  sortButton:{
    backgroundColor:INK.panel,
    borderColor:INK.hairline,
    borderWidth:SHAPE.border,
    borderRadius:SHAPE.radius.pill,
    paddingHorizontal:12,
    paddingVertical:7
  },
  sortButtonActive:{backgroundColor:INK.panelRaised,borderColor:INK.hairlineStrong},
  sortText:{
    color:INK.readoutSoft,
    fontFamily:MONO,
    fontSize:TYPE.data.sizes.md,
    letterSpacing:TYPE.data.tracking*TYPE.data.sizes.md,
    textTransform:"uppercase"
  },
  sortTextActive:{color:INK.readout},

  reviewCard:{
    backgroundColor:INK.panel,
    borderColor:INK.hairline,
    borderWidth:SHAPE.border,
    borderRadius:SHAPE.radius.sheet,
    padding:16,
    marginBottom:12
  },
  reviewTopRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},
  reviewTitleWrap:{flex:1,paddingRight:10},
  reviewPlace:{color:INK.readout,fontSize:18,fontWeight:"700"},
  reviewType:{
    color:INK.readoutSoft,
    fontFamily:MONO,
    fontSize:TYPE.data.sizes.md,
    letterSpacing:TYPE.data.tracking*TYPE.data.sizes.md,
    textTransform:"uppercase",
    marginTop:3
  },
  pointsBadge:{
    backgroundColor:INK.panelRaised,
    borderColor:INK.hairlineStrong,
    borderWidth:SHAPE.border,
    borderRadius:SHAPE.radius.pill,
    paddingHorizontal:10,
    paddingVertical:6
  },
  pointsBadgeText:{color:INK.readout,fontFamily:MONO,fontSize:TYPE.data.sizes.lg},
  reviewStars:{color:INK.readout,fontSize:18,letterSpacing:1,marginTop:12},
  emptyStars:{color:INK.readoutSoft},
  reviewTitle:{color:INK.readout,fontSize:17,fontWeight:"700",marginTop:10},
  reviewComment:{
    color:INK.readout,
    fontSize:TYPE.body.sizes.lg,
    lineHeight:TYPE.body.sizes.lg*TYPE.body.lineHeight,
    marginTop:7
  },
  // A verified visit is a fact the app checked, so it is a mono readout on a
  // raised surface -- not the manager's agree ink, which belongs to a review
  // reply and nothing else.
  verifiedBadge:{
    alignSelf:"flex-start",
    backgroundColor:INK.panelRaised,
    borderColor:INK.hairlineStrong,
    borderWidth:SHAPE.border,
    borderRadius:SHAPE.radius.pill,
    paddingHorizontal:10,
    paddingVertical:6,
    marginTop:12
  },
  verifiedText:{
    color:INK.readout,
    fontFamily:MONO,
    fontSize:TYPE.data.sizes.md,
    letterSpacing:TYPE.data.tracking*TYPE.data.sizes.md,
    textTransform:"uppercase"
  },
  reviewImageRow:{paddingTop:13},
  reviewImage:{width:115,height:115,borderRadius:SHAPE.radius.control,backgroundColor:INK.inset,marginRight:9},
  videoButton:{
    backgroundColor:INK.panelRaised,
    borderColor:INK.hairlineStrong,
    borderWidth:SHAPE.border,
    borderRadius:SHAPE.radius.card,
    padding:12,
    flexDirection:"row",
    alignItems:"center",
    marginTop:13
  },
  videoButtonIcon:{color:INK.readout,fontSize:20,marginRight:12},
  videoButtonTitle:{color:INK.readout,fontWeight:"700"},
  videoButtonText:{color:INK.readoutSoft,fontSize:TYPE.body.sizes.sm,marginTop:2},
  reviewActions:{flexDirection:"row",alignItems:"center",gap:9,marginTop:13},
  commentsLink:{paddingHorizontal:11,paddingVertical:9},
  commentsLinkText:{color:INK.readoutSoft,fontWeight:"600",fontSize:TYPE.body.sizes.sm},

  scrapbookTabRow:{marginTop:26,maxHeight:52},
  scrapbookTabContent:{gap:7},
  scrapbookTab:{
    backgroundColor:INK.panel,
    borderColor:INK.hairline,
    borderWidth:SHAPE.border,
    borderRadius:SHAPE.radius.pill,
    paddingHorizontal:15,
    paddingVertical:11
  },
  scrapbookTabActive:{backgroundColor:INK.panelRaised,borderColor:INK.hairlineStrong},
  scrapbookTabText:{
    color:INK.readoutSoft,
    fontFamily:MONO,
    fontSize:TYPE.data.sizes.md,
    letterSpacing:TYPE.data.tracking*TYPE.data.sizes.md,
    textTransform:"uppercase"
  },
  scrapbookTabTextActive:{color:INK.readout},

  mediaTabRow:{
    flexDirection:"row",
    backgroundColor:INK.inset,
    borderColor:INK.hairline,
    borderWidth:SHAPE.border,
    borderRadius:SHAPE.radius.card,
    padding:4,
    marginTop:28,
    marginBottom:12
  },
  mediaTab:{flex:1,padding:11,borderRadius:SHAPE.radius.control,alignItems:"center"},
  mediaTabActive:{backgroundColor:INK.panelRaised},
  mediaTabText:{color:INK.readoutSoft,fontWeight:"600"},
  mediaTabTextActive:{color:INK.readout},

  videoCard:{
    backgroundColor:INK.panel,
    borderColor:INK.hairline,
    borderWidth:SHAPE.border,
    borderRadius:SHAPE.radius.card,
    overflow:"hidden",
    marginBottom:12
  },
  videoPoster:{height:165,backgroundColor:INK.inset,alignItems:"center",justifyContent:"center"},
  videoPosterImage:{width:"100%",height:"100%"},
  largePlay:{color:INK.readout,fontSize:42},
  playOverlay:{
    position:"absolute",
    width:52,
    height:52,
    borderRadius:26,
    backgroundColor:"rgba(11,14,18,0.78)",
    alignItems:"center",
    justifyContent:"center"
  },
  playOverlayText:{color:INK.readout,fontSize:20,marginLeft:3},
  videoCardBody:{padding:14},
  videoCardTitle:{color:INK.readout,fontSize:18,fontWeight:"700"},
  videoCardPlace:{color:INK.readoutSoft,fontWeight:"600",marginTop:4},
  videoCardMeta:{
    color:INK.readoutSoft,
    fontFamily:MONO,
    fontSize:TYPE.data.sizes.md,
    letterSpacing:TYPE.data.tracking*TYPE.data.sizes.md,
    marginTop:5
  },

  createMomentWide:{
    backgroundColor:INK.readout,
    borderRadius:SHAPE.radius.card,
    paddingVertical:14,
    alignItems:"center",
    marginBottom:12
  },
  createMomentWideText:{color:INK.ground,fontWeight:"700"},

  momentGrid:{flexDirection:"row",flexWrap:"wrap",gap:10},
  momentCard:{
    width:"48%",
    flexGrow:1,
    backgroundColor:INK.panel,
    borderColor:INK.hairline,
    borderWidth:SHAPE.border,
    borderRadius:SHAPE.radius.card,
    overflow:"hidden"
  },
  momentMediaWrap:{height:170,backgroundColor:INK.inset,alignItems:"center",justifyContent:"center"},
  momentImage:{width:"100%",height:"100%"},
  momentPlay:{
    position:"absolute",
    width:44,
    height:44,
    borderRadius:22,
    backgroundColor:"rgba(11,14,18,0.78)",
    alignItems:"center",
    justifyContent:"center"
  },
  momentPlayText:{color:INK.readout,fontSize:17,marginLeft:3},
  momentBody:{padding:10},
  momentCaption:{color:INK.readout,fontSize:TYPE.body.sizes.md,fontWeight:"600",lineHeight:18},
  momentMeta:{
    color:INK.readoutSoft,
    fontFamily:MONO,
    fontSize:TYPE.data.sizes.sm,
    letterSpacing:TYPE.data.tracking*TYPE.data.sizes.sm,
    marginTop:5
  },

  primaryButton:{backgroundColor:INK.readout,padding:16,borderRadius:SHAPE.radius.card,marginTop:15},
  primaryButtonText:{color:INK.ground,fontWeight:"700",textAlign:"center"},
  // Logging out is not a manager disputing a review, so it is not INK.dispute.
  // The design system reserves that ink for exactly two jobs and says in as
  // many words that it is never a generic error colour.
  logoutButton:{
    backgroundColor:INK.panel,
    borderColor:INK.hairlineStrong,
    borderWidth:SHAPE.border,
    padding:16,
    borderRadius:SHAPE.radius.card,
    marginTop:25
  },
  logoutText:{color:INK.readout,fontWeight:"700",textAlign:"center"}
});

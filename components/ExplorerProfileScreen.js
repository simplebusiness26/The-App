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
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../services/supabase";
import EndorseButton from "./EndorseButton";
import MyMap from "./MyMap";
import StoryRing from "./StoryRing";
import StoryViewer from "./StoryViewer";
import {managesAnyListing} from "../utils/permissions";

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
    return <Image source={{uri:profile.profile_photo}} style={{width:size,height:size,borderRadius:size/2,backgroundColor:"#303036"}}/>;
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
      router.replace("/auth/login");
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
    return <View style={styles.center}><ActivityIndicator size="large" color="#a58cff"/></View>;
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
          onClose={()=>setStoryOpen(false)}
        />
        <Text style={styles.profileName}>{profile.full_name || "Explorer"}</Text>
        {!!profile.show_area && !!profile.area?.trim() && <Text style={styles.area}>📍 {profile.area.trim()}</Text>}
        {!!profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}

        {isOwner && (
          <View style={styles.ownerActions}>
            <Pressable style={styles.editProfileButton} onPress={()=>router.push("/profile/edit")}><Text style={styles.editProfileText}>Edit profile</Text></Pressable>
            <Pressable style={styles.newMomentButton} onPress={()=>router.push("/camera")}><Text style={styles.newMomentText}>＋ New Moment</Text></Pressable>
            {/*
              This was the one thing the separate Manager screen had that this
              one did not. It is now shown to anybody who actually manages
              something, which is the real question -- the old screen showed it
              on account_type, so a Manager who ran nothing still got the
              button and an Explorer who ran a club did not.
            */}
            {managesSomething && <Pressable style={styles.managerDashboardButton} onPress={()=>router.push("/manager/dashboard")}><Text style={styles.editProfileText}>Manager dashboard</Text></Pressable>}
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
              {item.media_url ? <Image source={{uri:item.media_url}} style={styles.favouriteImage}/> : <View style={styles.favouriteFallback}><Text style={styles.favouriteEmoji}>🗺️</Text></View>}
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
                <Image source={{uri:item.media_url}} style={styles.galleryImage}/>
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
                {photos.map(photo=><Image key={photo.id} source={{uri:photo.media_url}} style={styles.reviewImage}/>)}
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
              {item.thumbnail_url || review?.target_image_url ? <Image source={{uri:item.thumbnail_url || review?.target_image_url}} style={styles.videoPosterImage}/> : <Text style={styles.largePlay}>▶</Text>}
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
              {item.target_image_url ? <Image source={{uri:item.target_image_url}} style={styles.favouriteImage}/> : <View style={styles.favouriteFallback}><Text style={styles.favouriteEmoji}>📍</Text></View>}
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

      {isOwner && <Pressable style={styles.logoutButton} onPress={logout}><Text style={styles.primaryButtonText}>Logout</Text></Pressable>}
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:"#18181b"},
  content:{padding:18,paddingBottom:70},
  center:{flex:1,backgroundColor:"#18181b",alignItems:"center",justifyContent:"center",padding:28},
  errorTitle:{color:"white",fontSize:23,fontWeight:"900"},
  errorText:{color:"#b8b8c0",textAlign:"center",marginTop:8},
  profileCard:{backgroundColor:"#222226",borderColor:"#45454c",borderWidth:1,borderRadius:20,padding:20,alignItems:"center"},
  topScoreRow:{width:"100%",flexDirection:"row",justifyContent:"space-between",gap:6,marginBottom:12},
  scorePill:{flex:1,minWidth:82,backgroundColor:"#303036",borderRadius:15,paddingHorizontal:8,paddingVertical:9,alignItems:"center"},
  reputationPill:{backgroundColor:"#152a1e",borderColor:"#286640",borderWidth:1},
  reputationNumber:{color:"#83e0a5",fontSize:20,fontWeight:"900"},
  pointsPill:{backgroundColor:"#2a2145",borderColor:"#5f4994",borderWidth:1},
  scoreNumber:{color:"white",fontSize:20,fontWeight:"900"},
  pointsNumber:{color:"#c8b6ff",fontSize:20,fontWeight:"900"},
  scoreLabel:{color:"#a7a7b0",fontSize:9,fontWeight:"900",letterSpacing:0.5,marginTop:2},
  avatarFallback:{backgroundColor:"#3212b6",alignItems:"center",justifyContent:"center"},
  avatarLetter:{color:"white",fontWeight:"900"},
  profileName:{color:"white",fontSize:30,fontWeight:"900",textAlign:"center",marginTop:13},
  area:{color:"#c5b6f5",fontSize:15,marginTop:6},
  bio:{color:"#b9b9c1",fontSize:15,lineHeight:22,textAlign:"center",marginTop:10,maxWidth:520},
  ownerActions:{flexDirection:"row",gap:9,marginTop:15},
  editProfileButton:{borderColor:"#6852a5",borderWidth:1,borderRadius:11,paddingHorizontal:16,paddingVertical:10},
  managerDashboardButton:{borderColor:"#6852a5",borderWidth:1,borderRadius:11,paddingHorizontal:16,paddingVertical:10},
  editProfileText:{color:"#d9cefa",fontWeight:"900"},
  newMomentButton:{backgroundColor:"#3212b6",borderRadius:11,paddingHorizontal:16,paddingVertical:10},
  newMomentText:{color:"white",fontWeight:"900"},
  statsGrid:{flexDirection:"row",flexWrap:"wrap",gap:10,marginTop:13},
  statCard:{width:"48%",flexGrow:1,backgroundColor:"#222226",borderColor:"#3f3f45",borderWidth:1,borderRadius:14,padding:15,alignItems:"center"},
  statCardAccent:{backgroundColor:"#271e42",borderColor:"#594392"},
  statValue:{color:"white",fontSize:25,fontWeight:"900"},
  statValueAccent:{color:"#c3afff"},
  statLabel:{color:"#9f9fa7",fontWeight:"700",fontSize:12,marginTop:3},
  rankCard:{backgroundColor:"#221d30",borderColor:"#50416e",borderWidth:1,borderRadius:15,padding:16,marginTop:13,flexDirection:"row",justifyContent:"space-between",alignItems:"center"},
  sectionEyebrow:{color:"#a993ed",fontSize:10,fontWeight:"900",letterSpacing:0.7},
  rankTitle:{color:"white",fontWeight:"900",fontSize:16,marginTop:4},
  rankValues:{alignItems:"flex-end"},
  rankText:{color:"#c9b9f7",fontWeight:"800",fontSize:12,marginVertical:2},
  reputationCard:{backgroundColor:"#152a1e",borderColor:"#286640",borderWidth:1,borderRadius:15,padding:16,marginTop:13},
  reputationHeadline:{color:"white",fontSize:18,fontWeight:"900",marginTop:5},
  reputationRow:{flexDirection:"row",gap:22,marginTop:13},
  reputationStat:{alignItems:"flex-start"},
  reputationValue:{color:"#83e0a5",fontSize:22,fontWeight:"900"},
  reputationLabel:{color:"#9fc7ac",fontWeight:"700",fontSize:11,marginTop:2},
  reputationMostUseful:{color:"#bcdfc9",fontSize:12,lineHeight:18,marginTop:13},
  sectionHeader:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginTop:27,marginBottom:11},
  sectionTitle:{color:"white",fontSize:23,fontWeight:"900"},
  sectionCount:{color:"#a58cff",fontWeight:"900"},
  horizontalRow:{paddingRight:10},
  favouriteCard:{width:145,backgroundColor:"#222226",borderColor:"#414147",borderWidth:1,borderRadius:14,padding:9,marginRight:10},
  favouriteImage:{width:"100%",height:95,borderRadius:10,backgroundColor:"#303036"},
  favouriteFallback:{width:"100%",height:95,borderRadius:10,backgroundColor:"#30294a",alignItems:"center",justifyContent:"center"},
  favouriteEmoji:{fontSize:29},
  favouriteName:{color:"white",fontWeight:"900",fontSize:14,marginTop:9},
  favouriteType:{color:"#9999a3",fontSize:11,textTransform:"capitalize",marginTop:4},
  galleryCard:{width:165,height:145,borderRadius:14,overflow:"hidden",marginRight:10,backgroundColor:"#2a2a30"},
  galleryImage:{width:"100%",height:"100%"},
  galleryOverlay:{position:"absolute",left:0,right:0,bottom:0,backgroundColor:"rgba(0,0,0,0.72)",padding:8},
  galleryText:{color:"white",fontSize:12,fontWeight:"800"},
  emptyCard:{backgroundColor:"#222226",borderColor:"#3f3f45",borderWidth:1,borderRadius:14,padding:18},
  emptyText:{color:"#9999a3",textAlign:"center",lineHeight:20},
  reviewHeadingRow:{marginTop:28,marginBottom:11},
  sortRow:{flexDirection:"row",gap:7,marginTop:11},
  sortButton:{backgroundColor:"#252529",borderColor:"#3f3f46",borderWidth:1,borderRadius:20,paddingHorizontal:12,paddingVertical:7},
  sortButtonActive:{backgroundColor:"#3212b6",borderColor:"#5b3de0"},
  sortText:{color:"#aaaab2",fontSize:12,fontWeight:"800"},
  sortTextActive:{color:"white"},
  reviewCard:{backgroundColor:"#222226",borderColor:"#414147",borderWidth:1,borderRadius:16,padding:16,marginBottom:12},
  reviewTopRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},
  reviewTitleWrap:{flex:1,paddingRight:10},
  reviewPlace:{color:"white",fontSize:18,fontWeight:"900"},
  reviewType:{color:"#92929b",fontSize:11,textTransform:"capitalize",marginTop:3},
  pointsBadge:{backgroundColor:"#292044",borderRadius:20,paddingHorizontal:10,paddingVertical:6},
  pointsBadgeText:{color:"#c4b0ff",fontWeight:"900",fontSize:12},
  reviewStars:{color:"#f5c542",fontSize:18,letterSpacing:1,marginTop:12},
  emptyStars:{color:"#55555e"},
  reviewTitle:{color:"white",fontSize:17,fontWeight:"900",marginTop:10},
  reviewComment:{color:"#c2c2ca",fontSize:15,lineHeight:22,marginTop:7},
  verifiedBadge:{alignSelf:"flex-start",backgroundColor:"#123b25",borderColor:"#286640",borderWidth:1,borderRadius:20,paddingHorizontal:10,paddingVertical:6,marginTop:12},
  verifiedText:{color:"#83e0a5",fontSize:10,fontWeight:"900",letterSpacing:0.4},
  reviewImageRow:{paddingTop:13},
  reviewImage:{width:115,height:115,borderRadius:11,backgroundColor:"#303036",marginRight:9},
  videoButton:{backgroundColor:"#271f3c",borderColor:"#534280",borderWidth:1,borderRadius:12,padding:12,flexDirection:"row",alignItems:"center",marginTop:13},
  videoButtonIcon:{color:"white",fontSize:20,marginRight:12},
  videoButtonTitle:{color:"white",fontWeight:"900"},
  videoButtonText:{color:"#a7a0b8",fontSize:11,marginTop:2},
  reviewActions:{flexDirection:"row",alignItems:"center",gap:9,marginTop:13},
  commentsLink:{paddingHorizontal:11,paddingVertical:9},
  commentsLinkText:{color:"#bca8ff",fontWeight:"900",fontSize:12},
  scrapbookTabRow:{marginTop:26,maxHeight:52},
  scrapbookTabContent:{gap:7},
  scrapbookTab:{backgroundColor:"#222226",borderColor:"#3f3f46",borderWidth:1,borderRadius:20,paddingHorizontal:15,paddingVertical:11},
  scrapbookTabActive:{backgroundColor:"#3212b6",borderColor:"#5b3de0"},
  scrapbookTabText:{color:"#aaaab2",fontWeight:"900",fontSize:13},
  scrapbookTabTextActive:{color:"white"},
  mediaTabRow:{flexDirection:"row",backgroundColor:"#222226",borderRadius:13,padding:4,marginTop:28,marginBottom:12},
  mediaTab:{flex:1,padding:11,borderRadius:10,alignItems:"center"},
  mediaTabActive:{backgroundColor:"#3212b6"},
  mediaTabText:{color:"#9999a2",fontWeight:"900"},
  mediaTabTextActive:{color:"white"},
  videoCard:{backgroundColor:"#222226",borderColor:"#414147",borderWidth:1,borderRadius:15,overflow:"hidden",marginBottom:12},
  videoPoster:{height:165,backgroundColor:"#0d0d0f",alignItems:"center",justifyContent:"center"},
  videoPosterImage:{width:"100%",height:"100%"},
  largePlay:{color:"white",fontSize:42},
  playOverlay:{position:"absolute",width:52,height:52,borderRadius:26,backgroundColor:"rgba(0,0,0,0.72)",alignItems:"center",justifyContent:"center"},
  playOverlayText:{color:"white",fontSize:20,marginLeft:3},
  videoCardBody:{padding:14},
  videoCardTitle:{color:"white",fontSize:18,fontWeight:"900"},
  videoCardPlace:{color:"#c0b0f2",fontWeight:"700",marginTop:4},
  videoCardMeta:{color:"#92929b",fontSize:12,marginTop:5},
  createMomentWide:{backgroundColor:"#3212b6",borderRadius:13,paddingVertical:14,alignItems:"center",marginBottom:12},
  createMomentWideText:{color:"white",fontWeight:"900"},
  momentGrid:{flexDirection:"row",flexWrap:"wrap",gap:10},
  momentCard:{width:"48%",flexGrow:1,backgroundColor:"#222226",borderColor:"#414147",borderWidth:1,borderRadius:14,overflow:"hidden"},
  momentMediaWrap:{height:170,backgroundColor:"#0d0d0f",alignItems:"center",justifyContent:"center"},
  momentImage:{width:"100%",height:"100%"},
  momentPlay:{position:"absolute",width:44,height:44,borderRadius:22,backgroundColor:"rgba(0,0,0,0.72)",alignItems:"center",justifyContent:"center"},
  momentPlayText:{color:"white",fontSize:17,marginLeft:3},
  momentBody:{padding:10},
  momentCaption:{color:"white",fontSize:13,fontWeight:"800",lineHeight:18},
  momentMeta:{color:"#92929b",fontSize:10,marginTop:5},
  primaryButton:{backgroundColor:"#3212b6",padding:16,borderRadius:12,marginTop:15},
  logoutButton:{backgroundColor:"#8f171d",padding:16,borderRadius:12,marginTop:25},
  primaryButtonText:{color:"white",fontWeight:"900",textAlign:"center"}
});

import React,{useCallback,useEffect,useState} from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image
} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../services/supabase";
import {CREATE_HUB_CLEARANCE} from "../components/CreateHub";
import {INK,TYPE,SHAPE} from "../utils/tokens";
import {
  Action,
  Chip,
  Empty,
  Frame,
  KeyValue,
  Meter,
  MONO,
  Notice,
  Panel,
  Readout,
  Row,
  Screen,
  ScreenTitle,
  SectionRule,
  Segmented
} from "../components/instrument";

// The Explorer Score board.
//
// THIS IS THE SCREEN THE KIT WAS BUILT FOR. Every number on it is something the
// app measured -- a rank, a points total, a period -- so almost nothing here is
// hand-drawn. The rank card is a Readout pair on a raised plate, each row is a
// Row with its rank and points in the mono meta column, the scoring rules are
// KeyValue definition lines, and the two selectors are detented Segmenteds
// rather than filled tab pills.
//
// FIRST PLACE IS NOT A STATE INK. The old board painted the top three in the
// dispute red and the "where you stand" card in the map's `exists` cyan --
// docs/design-system.md is explicit that those inks say what a PLACE is and a
// manager's two answers, and being top of a leaderboard is neither. The top of
// the board steps up a surface (panel -> panelRaised) and brightens its readout
// instead, which is the same move a selected chip makes everywhere else.

const PERIODS=[{key:"weekly",label:"Weekly"},{key:"monthly",label:"Monthly"}];
const SCOPES=[{key:"local",label:"Local"},{key:"national",label:"National"}];

function Avatar({row}){
  return(
    <Frame size={34} round style={styles.avatarFrame}>
      {row.profile_photo
        ? <Image source={{uri:row.profile_photo}} style={styles.avatar}/>
        : <Text style={styles.avatarLetter}>{row.full_name?.charAt(0)?.toUpperCase() || "E"}</Text>}
    </Frame>
  );
}

export default function Leaderboards(){
  const [period,setPeriod]=useState("weekly");
  const [scope,setScope]=useState("local");
  const [profile,setProfile]=useState(null);
  const [rows,setRows]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  useFocusEffect(useCallback(()=>{
    loadProfile();
  },[]));

  useEffect(()=>{
    if(profile) loadLeaderboard();
  },[period,scope,profile?.area,profile?.show_area]);

  async function loadProfile(){
    setLoading(true);
    setError("");
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){
      router.replace("/auth/login");
      return;
    }

    const {data,error:profileError}=await supabase
      .from("profiles")
      .select("id,full_name,area,show_area,leaderboard_opt_in")
      .eq("id",user.id)
      .single();

    if(profileError || !data){
      setError("Your Explorer profile could not be loaded.");
      setLoading(false);
      return;
    }

    setProfile(data);
  }

  async function loadLeaderboard(){
    if(!profile) return;
    if(scope==="local" && (!profile.show_area || !profile.area?.trim())){
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const {data,error:leaderboardError}=await supabase.rpc("get_explorer_leaderboard",{
      p_period:period,
      p_scope:scope,
      p_area:scope==="local" ? profile.area.trim() : null,
      p_limit:50
    });

    if(leaderboardError){
      setError(leaderboardError.message || "The leaderboard could not be loaded.");
      setRows([]);
    }else{
      setRows(data || []);
    }
    setLoading(false);
  }

  const needsArea=scope==="local" && (!profile?.show_area || !profile?.area?.trim());

  // From the rows already loaded. A second query would be a second thing to
  // keep in step, and this page has no need to ask the database anything the
  // list has not already answered.
  const ownRow=rows.find(row=>row.user_id===profile?.id) || null;

  // The leader's total is the scale everybody else's meter is read against. It
  // is already on screen, so no extra reading and nothing new exposed.
  const topPoints=rows.reduce((most,row)=>Math.max(most,Number(row.points || 0)),0);
  const periodWord=period==="monthly" ? "MONTH" : "WEEK";

  return(
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        {/*
          Decision 1, settled: this ranks on explorer_score_events, the scoring
          ledger. It used to add up review points only, so a board called Explorer
          Score measured nothing except how much you had written. It now counts
          reviews, check-ins and endorsements, each dated and capped.
        */}
        <ScreenTitle
          eyebrow="EXPLORER SCORE RANKINGS"
          title="Leaderboard"
          meta="Explorers ranked by their Explorer Score this week and this month. Test accounts are excluded."
        />

        <View style={styles.selector}>
          <Segmented items={PERIODS} active={period} onChange={setPeriod}/>
        </View>
        <View style={styles.selector}>
          <Segmented items={SCOPES} active={scope} onChange={setScope}/>
        </View>

        <View style={styles.body}>

        {scope==="local" && profile?.show_area && !!profile?.area?.trim() && (
          <View style={styles.areaRow}>
            <Chip label={profile.area.trim()} glyph="pin"/>
          </View>
        )}

        {/*
          Packet 9b: the rank card.

          The list shows the top of the board. Everybody who is not on it learns
          nothing, which is the majority of people and exactly the ones a
          leaderboard should be telling where they stand. This says it plainly,
          including when the honest answer is "not yet".

          It is derived from the rows already fetched -- no second query, and
          therefore nothing new exposed. When the viewer is outside the fetched
          window the card says so rather than inventing a position.
        */}
        {!needsArea && !loading && !error && (
          <Panel
            raised
            style={styles.rankCard}
            accessibilityLabel={ownRow
              ? `You are ranked ${ownRow.rank} with ${ownRow.points} point${ownRow.points===1 ? "" : "s"}`
              : "You are not ranked in this period yet"}
          >
            <Text style={styles.rankEyebrow}>WHERE YOU STAND</Text>
            {ownRow ? (
              <View style={styles.rankFigures}>
                <Readout label="RANK" value={`#${ownRow.rank}`} size="lg"/>
                <View style={styles.rankDivider}/>
                {/*
                  Points and nothing else. The review count used to sit here, and
                  next to a ledger total it is a leak: review points are fixed
                  (5, or 15 verified), so points minus review points is check-in
                  points, and the halving rule turns that back into roughly how
                  many different places somebody has been. Your own split is
                  yours -- get_explorer_score_breakdown() -- and is not on a
                  public board.
                */}
                <Readout label={`POINTS THIS ${periodWord}`} value={String(ownRow.points)} size="lg"/>
              </View>
            ) : (
              <>
                <View style={styles.rankFigures}>
                  <Readout label="RANK" value="—" size="lg" tone="readoutFaint"/>
                </View>
                {/* An instruction, not a mood. design-system.md bans the mood. */}
                <Text style={styles.rankInstruction}>
                  {profile?.leaderboard_opt_in===false
                    ? "You have opted out of leaderboards. Turn it on in your profile to appear here."
                    : "Review somewhere you went, or check in while you are there, and you will appear here."}
                </Text>
              </>
            )}
          </Panel>
        )}

        {needsArea ? (
          <Notice
            tone="scheduled"
            label="Local rankings"
            action={<Action kind="primary" glyph="edit" label="Edit Profile" onPress={()=>router.push("/profile/edit")}/>}
          >
            Add a public area to join local rankings. Your exact address is never needed. Add a town or area and choose to display it publicly.
          </Notice>
        ) : loading ? (
          <View style={styles.loadingBox}><ActivityIndicator size="large" color={INK.readoutSoft}/></View>
        ) : error ? (
          <Notice tone="dispute" label="Not loaded">{error}</Notice>
        ) : rows.length===0 ? (
          <Empty
            glyph="chart"
            title="No points yet"
            instruction="Write a review, check in somewhere, or be useful to another Explorer. The first points in this period start the board."
          />
        ) : (
          <>
            <SectionRule label={`${scope} ${period}`} meta={`${rows.length} RANKED`}/>
            {rows.map(row=>{
              const own=row.user_id===profile?.id;
              const top=row.rank<=3;
              return(
                <Row
                  key={row.user_id}
                  title={`${row.full_name}${own ? " · You" : ""}`}
                  sub={row.area || "Area hidden"}
                  meta={`#${row.rank}`}
                  metaSub={`${row.points} PTS`}
                  right={<Avatar row={row}/>}
                  style={[top && styles.topRow,own && styles.ownRow]}
                  onPress={()=>router.push(`/profile/${row.user_id}`)}
                >
                  {/* The score read off a ticked track, against the leader's
                      total. A bare number says how many; the meter says how far. */}
                  <View style={styles.meterRow}>
                    <Meter value={Number(row.points || 0)} max={topPoints || 1} width={116} tone="exists"/>
                  </View>
                </Row>
              );
            })}
          </>
        )}

        {/*
          These are the ledger's rules (20260810040000 and 20260812150000), not
          the old review-points table. Getting this wrong is worse than saying
          nothing: a scoring rule people read and act on has to be the rule that
          runs.
        */}
        <SectionRule label="How your Explorer Score is earned"/>
        <Panel style={styles.rulesCard}>
          <KeyValue label="Write a review" value="5 points"/>
          <KeyValue label="Review with the QR scanned on site" value="15 points"/>
          <KeyValue label="Check in somewhere new" value="10 points"/>
          <KeyValue label="Somebody finds your review useful" value="1 point"/>
        </Panel>
        <Text style={styles.ruleNote}>
          Checking in at the same place again is worth less each time — the score rewards seeing your area, not one habit. A review earns up to 5 points from other Explorers finding it useful. Deleting a review, or somebody taking their endorsement back, removes those points.
        </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles=StyleSheet.create({
  // ScreenTitle and Segmented both carry their own horizontal gutter, so the
  // scroll container does not -- everything else gets it from `body`.
  content:{paddingBottom:24+CREATE_HUB_CLEARANCE},
  body:{paddingHorizontal:16},

  selector:{marginTop:6},

  areaRow:{flexDirection:"row",marginTop:12},

  rankCard:{padding:16,marginTop:14,marginBottom:6},
  rankEyebrow:{
    color:INK.readoutSoft,fontFamily:MONO,fontSize:TYPE.data.sizes.md,
    letterSpacing:1,textTransform:"uppercase"
  },
  rankFigures:{flexDirection:"row",alignItems:"flex-end",gap:16,marginTop:12},
  rankDivider:{width:1,alignSelf:"stretch",backgroundColor:INK.hairline,marginVertical:2},
  rankInstruction:{
    color:INK.readoutSoft,fontSize:TYPE.body.sizes.md,
    lineHeight:TYPE.body.sizes.md*TYPE.body.lineHeight,marginTop:12
  },

  loadingBox:{padding:50,alignItems:"center"},

  // Top of the board: a step up the surface and a stronger edge. Never a fill.
  topRow:{backgroundColor:INK.panelRaised},
  ownRow:{borderColor:INK.hairlineStrong},
  meterRow:{flexDirection:"row",marginTop:8},

  avatarFrame:{backgroundColor:INK.inset,marginBottom:4},
  avatar:{width:34,height:34,borderRadius:SHAPE.radius.pill},
  avatarLetter:{color:INK.readoutSoft,fontSize:14,fontWeight:"700"},

  rulesCard:{paddingHorizontal:14,paddingVertical:4},
  ruleNote:{
    color:INK.readoutSoft,fontSize:TYPE.body.sizes.sm,
    lineHeight:TYPE.body.sizes.sm*TYPE.body.lineHeight,marginTop:10
  }
});

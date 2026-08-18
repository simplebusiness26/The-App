import React,{useCallback,useMemo,useState} from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image
} from "react-native";
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {supabase} from "../../../services/supabase";
import {CREATE_HUB_CLEARANCE} from "../../../components/CreateHub";
import {INK,TYPE,SHAPE} from "../../../utils/tokens";
import {
  Action,
  Chip,
  Frame,
  Glyph,
  KeyValue,
  Meter,
  MONO,
  Notice,
  Panel,
  Screen,
  ScreenTitle,
  SectionRule
} from "../../../components/instrument";

// Where a membership stands, opened from a notification.
//
// The old version drew a 76px coloured disc holding a tick or a cross set at
// 44px in the system font, on a card whose border changed colour with the
// outcome. That is a status page shouting a mood. An instrument reports: a mono
// state chip, a stroked glyph, the ceiling the club is running against, and a
// sentence saying what it means now.
//
// No agree/dispute here. Approving somebody into a club is a decision about
// access, not a manager answering a review -- see docs/design-system.md.

function firstParam(value){
  return Array.isArray(value) ? value[0] : value || null;
}

function formatDate(value){
  if(!value) return "";
  return new Date(value).toLocaleString([],{
    day:"numeric",
    month:"short",
    year:"numeric",
    hour:"2-digit",
    minute:"2-digit"
  });
}

const STATUS_COPY={
  approved:{
    eyebrow:"Current membership status",
    glyph:"check",
    title:"Membership approved",
    description:name=>`${name} is currently an approved member and has access to the private message board.`,
    next:[
      "The explorer currently has private message-board access",
      "They remain included in the club's approved-member count",
      "You can remove their membership from the Manager Dashboard"
    ]
  },
  rejected:{
    eyebrow:"Application decision",
    glyph:"close",
    title:"Application rejected",
    description:name=>`${name}'s application was not approved. They are not a member of this club.`,
    next:[
      "The explorer was notified of the decision",
      "They do not have private message-board access",
      "They can submit another application later"
    ]
  },
  removed:{
    eyebrow:"Current membership status",
    glyph:"close",
    title:"Membership ended",
    description:name=>`${name} was previously approved, but is no longer a member. Their private message-board access has been removed.`,
    next:[
      "The explorer was notified that their membership ended",
      "They no longer have private message-board access",
      "They can apply to join the club again"
    ]
  },
  left:{
    eyebrow:"Current membership status",
    glyph:"close",
    title:"Member left the club",
    description:name=>`${name} is no longer a member and no longer has access to the private message board.`,
    next:[
      "The explorer is no longer in the approved-member count",
      "Their private message-board access is disabled",
      "They can apply to join again later"
    ]
  },
  pending:{
    eyebrow:"Membership request",
    glyph:"warn",
    title:"Decision still required",
    description:name=>`${name}'s request is still waiting for approval or rejection.`,
    next:[
      "This request still needs a manager decision",
      "The explorer does not yet have message-board access",
      "Open the Action Centre to review the application"
    ]
  }
};

function NextStep({glyph,text}){
  return(
    <View style={styles.nextStepRow}>
      <View style={styles.nextStepGlyph}>
        <Glyph name={glyph} size={13} colour={INK.readoutSoft}/>
      </View>
      <Text style={styles.nextStepText}>{text}</Text>
    </View>
  );
}

export default function ManagerMembershipStatus(){
  const params=useLocalSearchParams();
  const membershipId=firstParam(params.id);

  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [membership,setMembership]=useState(null);
  const [club,setClub]=useState(null);
  const [memberProfile,setMemberProfile]=useState(null);
  const [approvedCount,setApprovedCount]=useState(0);

  useFocusEffect(useCallback(()=>{
    if(membershipId) loadStatus();
  },[membershipId]));

  async function loadStatus(){
    setLoading(true);
    setError("");

    const {data:{user}}=await supabase.auth.getUser();

    if(!user){
      router.replace("/auth/login");
      return;
    }

    const {data:membershipRow,error:membershipError}=await supabase
      .from("activity_memberships")
      .select("*")
      .eq("id",membershipId)
      .maybeSingle();

    if(membershipError || !membershipRow){
      setError("This membership record could not be found.");
      setLoading(false);
      return;
    }

    const {data:clubRow,error:clubError}=await supabase
      .from("activity_clubs")
      .select("id,name,member_limit,manager_id")
      .eq("id",membershipRow.club_id)
      .eq("manager_id",user.id)
      .maybeSingle();

    if(clubError || !clubRow){
      setError("You do not manage the Activity Club linked to this membership.");
      setLoading(false);
      return;
    }

    const [profileResult,countResult]=await Promise.all([
      supabase
        .from("profiles")
        .select("id,full_name,profile_photo")
        .eq("id",membershipRow.user_id)
        .maybeSingle(),
      supabase
        .from("activity_memberships")
        .select("id",{count:"exact",head:true})
        .eq("club_id",membershipRow.club_id)
        .eq("status","approved")
    ]);

    setMembership(membershipRow);
    setClub(clubRow);
    setMemberProfile(profileResult.data || null);
    setApprovedCount(countResult.count || 0);
    setLoading(false);
  }

  const status=membership?.status || "pending";
  const copy=STATUS_COPY[status] || {
    eyebrow:"Current membership status",
    glyph:"info",
    title:"Membership status updated",
    description:name=>`${name}'s current membership status is ${status}.`,
    next:["The membership record has changed","Review the Manager Dashboard for more details"]
  };

  const memberName=memberProfile?.full_name || membership?.applicant_name || "Explorer";
  const pending=status==="pending";

  const decisionLabel=useMemo(()=>{
    if(!membership?.decided_at) return "";
    if(status==="approved") return `Approved ${formatDate(membership.decided_at)}`;
    if(status==="rejected") return `Rejected ${formatDate(membership.decided_at)}`;
    if(status==="removed") return `Membership ended ${formatDate(membership.decided_at)}`;
    if(status==="left") return `Left ${formatDate(membership.decided_at)}`;
    return `Updated ${formatDate(membership.decided_at)}`;
  },[membership,status]);

  if(loading){
    return(
      <Screen style={styles.centre}>
        <ActivityIndicator size="large" color={INK.readout}/>
        <Text style={styles.centreText}>Loading current membership status…</Text>
      </Screen>
    );
  }

  if(error || !membership || !club){
    return(
      <Screen>
        <ScreenTitle eyebrow="Membership" title="Membership status unavailable"/>
        <View style={styles.body}>
          <Notice
            tone="exists"
            label="Not loaded"
            action={
              <Action
                kind="secondary"
                glyph="grid"
                label="Open Manager Dashboard"
                accessibilityLabel="Open the Manager Dashboard"
                onPress={()=>router.push("/manager/dashboard")}
              />
            }
          >
            {error || "The membership could not be loaded."}
          </Notice>
        </View>
      </Screen>
    );
  }

  const limit=club.member_limit || 20;

  return(
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ScreenTitle
          eyebrow={copy.eyebrow}
          title="Membership status"
          meta={club.name}
          right={<Chip label={status}/>}
        />

        <View style={styles.body}>
          <Panel style={styles.card}>
            <View style={styles.head}>
              <View style={styles.headGlyph}>
                <Glyph name={copy.glyph} size={15} colour={INK.readoutSoft}/>
              </View>
              <Text style={styles.headKind}>{copy.eyebrow}</Text>
              <View style={styles.headLine}/>
            </View>

            <View style={styles.identity}>
              <Frame size={48} round style={styles.avatarFrame}>
                {memberProfile?.profile_photo
                  ? <Image source={{uri:memberProfile.profile_photo}} style={styles.avatar}/>
                  : <Text style={styles.avatarLetter}>{memberName.slice(0,1).toUpperCase()}</Text>}
              </Frame>
              <View style={styles.identityText}>
                <Text style={styles.memberName} numberOfLines={1}>{memberName}</Text>
                {!!membership.applied_at && (
                  <Text style={styles.memberMeta}>Applied {formatDate(membership.applied_at)}</Text>
                )}
              </View>
            </View>

            <Text style={styles.resultTitle}>{copy.title}</Text>
            <Text style={styles.resultText}>{copy.description(memberName)}</Text>

            {!!decisionLabel && <KeyValue label="Decided" value={decisionLabel}/>}

            {/* Capacity has a ceiling, so it is read off a track. */}
            <View style={styles.meterRow}>
              <Meter
                value={approvedCount}
                max={limit}
                width={140}
                tone="exists"
                label="Approved"
                valueLabel={`${approvedCount}/${limit}`}
              />
            </View>

            <Action
              kind="primary"
              glyph={pending ? "bell" : "people"}
              label={pending ? "Review this request" : "View current club members"}
              accessibilityLabel={pending ? "Review this membership request" : "View the current club members"}
              onPress={()=>{
                if(pending){
                  router.replace(`/manager/requests?club=${club.id}&membership=${membership.id}&view=requests`);
                }else{
                  router.push(`/manager/dashboard?club=${club.id}&view=members`);
                }
              }}
            />
          </Panel>

          <SectionRule label="What this means now"/>

          <Panel style={styles.nextCard}>
            {copy.next.map((item,index)=>(
              <NextStep
                key={`${item}-${index}`}
                glyph={index===copy.next.length-1 ? "info" : "check"}
                text={item}
              />
            ))}
          </Panel>

          <View style={styles.navRow}>
            <Action
              kind="secondary" glyph="bell" label="Notifications"
              accessibilityLabel="Open notifications"
              onPress={()=>router.push("/notifications")}
              style={styles.button}
            />
            <Action
              kind="secondary" glyph="grid" label="Dashboard"
              accessibilityLabel="Open the Manager Dashboard"
              onPress={()=>router.push("/manager/dashboard")}
              style={styles.button}
            />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const MONO_META={fontFamily:MONO,textTransform:"uppercase",letterSpacing:0.9};

const styles=StyleSheet.create({
  scroll:{paddingBottom:CREATE_HUB_CLEARANCE+24},
  body:{paddingHorizontal:16},
  centre:{alignItems:"center",justifyContent:"center",gap:12,padding:28},
  centreText:{color:INK.readoutSoft,fontSize:TYPE.body.sizes.md,textAlign:"center"},

  card:{padding:14,marginTop:4},
  head:{flexDirection:"row",alignItems:"center",gap:9,marginBottom:12},
  headGlyph:{
    width:28,height:28,borderRadius:SHAPE.radius.control,
    alignItems:"center",justifyContent:"center",
    backgroundColor:INK.inset,borderWidth:SHAPE.border,borderColor:INK.hairline
  },
  headKind:{...MONO_META,color:INK.readoutSoft,fontSize:TYPE.data.sizes.md},
  headLine:{flex:1,height:1,backgroundColor:INK.hairline},

  identity:{flexDirection:"row",alignItems:"center",gap:12},
  avatarFrame:{backgroundColor:INK.inset},
  avatar:{width:48,height:48,borderRadius:SHAPE.radius.pill},
  avatarLetter:{color:INK.readoutSoft,fontWeight:"700",fontSize:18},
  identityText:{flex:1,minWidth:0},
  memberName:{color:INK.readout,fontSize:TYPE.display.sizes.sm,fontWeight:"600",letterSpacing:-0.2},
  memberMeta:{color:INK.readoutSoft,fontSize:TYPE.body.sizes.sm,marginTop:3},

  resultTitle:{
    color:INK.readout,fontSize:TYPE.display.sizes.md,fontWeight:"700",
    letterSpacing:-0.3,marginTop:14
  },
  resultText:{
    color:INK.readoutSoft,fontSize:TYPE.body.sizes.md,
    lineHeight:TYPE.body.sizes.md*1.5,marginTop:6
  },

  meterRow:{marginTop:12,marginBottom:12},

  nextCard:{padding:13},
  nextStepRow:{flexDirection:"row",alignItems:"flex-start",gap:10,paddingVertical:7},
  nextStepGlyph:{
    width:26,height:26,borderRadius:SHAPE.radius.control,
    alignItems:"center",justifyContent:"center",
    backgroundColor:INK.inset,borderWidth:SHAPE.border,borderColor:INK.hairline
  },
  nextStepText:{
    flex:1,color:INK.readout,fontSize:TYPE.body.sizes.md,
    lineHeight:TYPE.body.sizes.md*1.5
  },

  navRow:{flexDirection:"row",gap:9,marginTop:14},
  button:{flex:1}
});

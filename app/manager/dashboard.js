import React,{useCallback,useMemo,useState} from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image
} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../../services/supabase";
import QRCodeGenerator from "../../components/QRCodeGenerator";
import {CREATE_HUB_CLEARANCE} from "../../components/CreateHub";
import {useFeedback} from "../../context/FeedbackContext";
import {formatEventDate,formatEventPrice} from "../../utils/events";
import {INK,TYPE,SHAPE} from "../../utils/tokens";
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
  ReadoutStrip,
  Row,
  Screen,
  ScreenTitle,
  SectionRule
} from "../../components/instrument";

// The manager's console: everything they run, and everything waiting on them.
//
// It is the most data-dense screen in the app, so it is the one the instrument
// suits best. Counts are readouts, capacity is a meter with a real ceiling, and
// every group is an etched rule with its count on the end. The old version drew
// four kinds of card by hand and hung an emoji off each heading -- a shop, a
// house, a runner and a party popper: four different type designers' idea of
// what a listing looks like.
//
// No state ink appears anywhere on this screen except as a Meter fill and a
// Chip dot. `scheduled` and `offer` say what a PLACE is; a listing you manage
// is not a pin on a map, and a pending approval is not a happening.

const ENABLED_STATUSES=["active","trial"];

// One group's etched rule, its count, and whether the capability behind it is
// unlocked. Selection/state is a mono chip, never a coloured pill.
function CapabilityHeader({title,count,status,requestStatus,onRequest}){
  const enabled=ENABLED_STATUSES.includes(status);
  const label=enabled
    ? status
    : requestStatus==="pending" ? "request pending" : status || "inactive";

  return(
    <>
      <SectionRule label={title} meta={String(count)}/>
      <View style={styles.capabilityRow}>
        <Chip
          label={label}
          glyph={enabled ? "check" : "lock"}
          selected={enabled}
        />
        {!enabled && requestStatus!=="pending" && (
          <Action
            kind="secondary"
            glyph="key"
            label="Request access"
            accessibilityLabel={`Request access to ${title}`}
            onPress={onRequest}
          />
        )}
      </View>
    </>
  );
}

// The code, and the way to print it. The QR keeps its own light quiet zone --
// see components/QRCodeGenerator.js for why it is the one thing here that is
// not on the housing.
function QRBlock({type,id,children}){
  return(
    <View style={styles.qrRow}>
      {children}
      <View style={styles.qrCopy}>
        <Text style={styles.qrLabel}>Verified review code</Text>
        <Action
          kind="secondary"
          glyph="qr"
          label="Open printable QR"
          accessibilityLabel="Open the printable QR code for this listing"
          onPress={()=>router.push(`/manager/qr/${type}/${id}`)}
          style={styles.qrButton}
        />
      </View>
    </View>
  );
}

function MemberIdentity({membership,profiles}){
  const profile=profiles[membership.user_id];
  const name=profile?.full_name || membership.applicant_name || "Explorer";

  return(
    <View style={styles.memberIdentity}>
      <Frame size={38} round style={styles.avatarFrame}>
        {profile?.profile_photo
          ? <Image source={{uri:profile.profile_photo}} style={styles.avatar}/>
          : <Text style={styles.avatarLetter}>{name.slice(0,1).toUpperCase()}</Text>}
      </Frame>

      <View style={styles.memberNameWrap}>
        <Text style={styles.memberName} numberOfLines={1}>{name}</Text>
        <Text style={styles.memberAccess}>Message board access enabled</Text>
      </View>
    </View>
  );
}

export default function ManagerDashboard(){
  const {showFeedback}=useFeedback();

  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [user,setUser]=useState(null);
  const [capabilities,setCapabilities]=useState({
    businesses_status:"inactive",
    properties_status:"inactive",
    activity_clubs_status:"inactive",
    events_status:"inactive"
  });
  const [requests,setRequests]=useState({});
  const [businesses,setBusinesses]=useState([]);
  const [properties,setProperties]=useState([]);
  const [clubs,setClubs]=useState([]);
  const [events,setEvents]=useState([]);
  const [memberships,setMemberships]=useState([]);
  const [memberProfiles,setMemberProfiles]=useState({});
  const [workingId,setWorkingId]=useState(null);

  useFocusEffect(useCallback(()=>{
    loadDashboard();
  },[]));

  async function loadDashboard(){
    setLoading(true);
    setError("");

    const {data:{user:currentUser}}=await supabase.auth.getUser();

    if(!currentUser){
      router.replace("/auth/login");
      return;
    }

    setUser(currentUser);

    const [
      capabilityResult,
      requestResult,
      businessResult,
      propertyResult,
      clubResult,
      eventResult
    ]=await Promise.all([
      supabase.from("manager_capabilities").select("*").eq("user_id",currentUser.id).maybeSingle(),
      supabase.from("manager_capability_requests").select("capability,status").eq("user_id",currentUser.id),
      supabase.from("businesses").select("*").eq("owner_id",currentUser.id).order("name",{ascending:true}),
      supabase.from("properties").select("*").eq("owner_id",currentUser.id).order("created_at",{ascending:false}),
      supabase.from("activity_clubs").select("*").eq("manager_id",currentUser.id).order("created_at",{ascending:false}),
      supabase.from("events").select("*").eq("manager_id",currentUser.id).order("starts_at",{ascending:true})
    ]);

    if(capabilityResult.error){
      setError("Manager capabilities could not be loaded.");
      setLoading(false);
      return;
    }

    setCapabilities(capabilityResult.data || {
      businesses_status:"active",
      properties_status:"active",
      activity_clubs_status:"inactive",
      events_status:"inactive"
    });

    const requestMap={};
    (requestResult.data || []).forEach(item=>{
      requestMap[item.capability]=item.status;
    });

    setRequests(requestMap);
    setBusinesses(businessResult.data || []);
    setProperties(propertyResult.data || []);
    setClubs(clubResult.data || []);
    setEvents(eventResult.data || []);

    const clubIds=(clubResult.data || []).map(club=>club.id);

    if(clubIds.length){
      const {data:membershipRows,error:membershipError}=await supabase
        .from("activity_memberships")
        .select("*")
        .in("club_id",clubIds)
        .in("status",["pending","approved"])
        .order("applied_at",{ascending:true});

      if(membershipError) console.log(membershipError);

      const rows=membershipRows || [];
      setMemberships(rows);

      const approvedUserIds=[...new Set(
        rows.filter(item=>item.status==="approved").map(item=>item.user_id)
      )];

      if(approvedUserIds.length){
        const {data:profileRows}=await supabase
          .from("profiles")
          .select("id,full_name,profile_photo")
          .in("id",approvedUserIds);

        const profileMap={};
        (profileRows || []).forEach(item=>{
          profileMap[item.id]=item;
        });
        setMemberProfiles(profileMap);
      }else{
        setMemberProfiles({});
      }
    }else{
      setMemberships([]);
      setMemberProfiles({});
    }

    setLoading(false);
  }

  const pendingByClub=useMemo(
    ()=>groupMemberships(memberships,"pending"),
    [memberships]
  );

  const approvedByClub=useMemo(
    ()=>groupMemberships(memberships,"approved"),
    [memberships]
  );

  const totalPending=useMemo(
    ()=>memberships.filter(item=>item.status==="pending").length,
    [memberships]
  );

  function groupMemberships(rows,status){
    const grouped={};

    rows.filter(item=>item.status===status).forEach(item=>{
      if(!grouped[item.club_id]) grouped[item.club_id]=[];
      grouped[item.club_id].push(item);
    });

    return grouped;
  }

  function capabilityEnabled(capability){
    return ENABLED_STATUSES.includes(capabilities?.[`${capability}_status`]);
  }

  function membershipName(membership){
    const profile=memberProfiles[membership.user_id];
    return profile?.full_name || membership.applicant_name || "Explorer";
  }

  async function requestCapability(capability,label){
    if(!user) return;

    setWorkingId(`request-${capability}`);
    const now=new Date().toISOString();

    const {error:requestError}=await supabase
      .from("manager_capability_requests")
      .upsert({
        user_id:user.id,
        capability,
        status:"pending",
        request_note:`Access requested for ${label}`,
        requested_at:now,
        updated_at:now
      },{onConflict:"user_id,capability"});

    setWorkingId(null);

    if(requestError){
      showFeedback(requestError.message,"error","Request not sent");
      return;
    }

    showFeedback(`${label} access has been requested.`,"success","Request sent");
    await loadDashboard();
  }

  async function removeMember(membership,club){
    const name=membershipName(membership);
    setWorkingId(membership.id);

    const {error:updateError}=await supabase
      .from("activity_memberships")
      .update({
        status:"removed",
        decided_at:new Date().toISOString()
      })
      .eq("id",membership.id)
      .eq("status","approved");

    setWorkingId(null);

    if(updateError){
      showFeedback(updateError.message,"error","Member not removed");
      return;
    }

    showFeedback(
      `${name} was removed and their private-board access was revoked.`,
      "success",
      "Member removed"
    );

    await loadDashboard();
  }

  function confirmRemoveMember(membership,club){
    const name=membershipName(membership);

    Alert.alert(
      "Remove member?",
      `${name} will immediately lose access to ${club.name}'s private message board.`,
      [
        {text:"Cancel",style:"cancel"},
        {
          text:"Remove",
          style:"destructive",
          onPress:()=>removeMember(membership,club)
        }
      ]
    );
  }

  if(loading){
    return(
      <Screen style={styles.centre}>
        <ActivityIndicator size="large" color={INK.readout}/>
        <Text style={styles.centreText}>Loading manager dashboard…</Text>
      </Screen>
    );
  }

  if(error){
    return(
      <Screen>
        <ScreenTitle eyebrow="Manager" title="Manager dashboard"/>
        <View style={styles.body}>
          <Notice tone="exists" label="Not loaded">{error}</Notice>
        </View>
      </Screen>
    );
  }

  const businessesEnabled=capabilityEnabled("businesses");
  const propertiesEnabled=capabilityEnabled("properties");
  const activitiesEnabled=capabilityEnabled("activity_clubs");
  const eventsEnabled=capabilityEnabled("events");

  return(
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ScreenTitle
          eyebrow="Manager"
          title="Manager dashboard"
          meta="Manage listings, approved members and printable QR codes from one place."
        />

        <View style={styles.body}>
          <ReadoutStrip
            items={[
              {label:"Business",value:String(businesses.length)},
              {label:"Property",value:String(properties.length)},
              {label:"Clubs",value:String(clubs.length)},
              {label:"Events",value:String(events.length)}
            ]}
          />

          {/* The one thing on this screen that is waiting on a person. */}
          <SectionRule label="Action centre" meta={String(totalPending)}/>

          <Row
            glyph="bell"
            title={totalPending>0
              ? `${totalPending} membership request${totalPending===1 ? "" : "s"} need a decision`
              : "No pending membership requests"}
            sub="Approvals and other decisions are kept separate from listing management."
            meta={String(totalPending)}
            metaSub="pending"
          />

          <Action
            kind={totalPending>0 ? "primary" : "secondary"}
            glyph="forward"
            label={totalPending>0 ? "Review pending actions" : "Open Action Centre"}
            accessibilityLabel="Open the Manager Action Centre"
            onPress={()=>router.push("/manager/requests")}
          />

          {/* ------------------------------------------------------------ */}
          {/* Businesses                                                    */}
          {/* ------------------------------------------------------------ */}
          <CapabilityHeader
            title="Businesses"
            count={businesses.length}
            status={capabilities.businesses_status}
            requestStatus={requests.businesses}
            onRequest={()=>requestCapability("businesses","Businesses")}
          />

          {businessesEnabled ? <>
            <Action
              kind="quiet"
              glyph="external"
              label="Open Business Dashboard"
              accessibilityLabel="Open the full Business Dashboard"
              onPress={()=>router.push("/business/dashboard")}
              style={styles.linkAction}
            />

            {businesses.length===0 && (
              <Empty
                glyph="building"
                title="No businesses yet"
                instruction="Create your first business listing."
              />
            )}

            {businesses.map(business=>(
              <Panel key={business.id} style={styles.card}>
                <Text style={styles.cardTitle} numberOfLines={2}>{business.name}</Text>
                <KeyValue label="Detail" value={business.category || business.address || "—"}/>

                <QRBlock type="business" id={business.id}>
                  <QRCodeGenerator businessId={business.id} size={96}/>
                </QRBlock>

                <View style={styles.buttons}>
                  <Action
                    kind="secondary" glyph="edit" label="Edit"
                    accessibilityLabel={`Edit ${business.name}`}
                    onPress={()=>router.push(`/business/edit/${business.id}`)}
                    style={styles.button}
                  />
                  <Action
                    kind="secondary" glyph="external" label="Public profile"
                    accessibilityLabel={`View ${business.name}'s public profile`}
                    onPress={()=>router.push(`/business/${business.id}`)}
                    style={styles.button}
                  />
                </View>
              </Panel>
            ))}

            <Action
              kind="primary" glyph="plus" label="Add a business"
              accessibilityLabel="Add a business"
              onPress={()=>router.push("/business/add")}
              style={styles.add}
            />
          </> : (
            <Notice tone="exists" label="Locked">
              Request this capability to create and manage business listings.
            </Notice>
          )}

          {/* ------------------------------------------------------------ */}
          {/* Properties                                                    */}
          {/* ------------------------------------------------------------ */}
          <CapabilityHeader
            title="Properties"
            count={properties.length}
            status={capabilities.properties_status}
            requestStatus={requests.properties}
            onRequest={()=>requestCapability("properties","Properties")}
          />

          {propertiesEnabled ? <>
            <Action
              kind="quiet"
              glyph="external"
              label="Open Property Dashboard"
              accessibilityLabel="Open the full Property Dashboard"
              onPress={()=>router.push("/property/dashboard")}
              style={styles.linkAction}
            />

            {properties.length===0 && (
              <Empty
                glyph="bed"
                title="No properties yet"
                instruction="Create your first property listing."
              />
            )}

            {properties.map(property=>(
              <Panel key={property.id} style={styles.card}>
                <Text style={styles.cardTitle} numberOfLines={2}>{property.name}</Text>
                <KeyValue label="Address" value={property.address || "—"}/>

                <QRBlock type="property" id={property.id}>
                  <QRCodeGenerator propertyId={property.id} size={96}/>
                </QRBlock>

                <View style={styles.buttons}>
                  <Action
                    kind="secondary" glyph="edit" label="Edit"
                    accessibilityLabel={`Edit ${property.name}`}
                    onPress={()=>router.push(`/property/edit/${property.id}`)}
                    style={styles.button}
                  />
                  <Action
                    kind="secondary" glyph="external" label="Public profile"
                    accessibilityLabel={`View ${property.name}'s public profile`}
                    onPress={()=>router.push(`/property/${property.id}`)}
                    style={styles.button}
                  />
                </View>
              </Panel>
            ))}

            <Action
              kind="primary" glyph="plus" label="Add a property"
              accessibilityLabel="Add a property"
              onPress={()=>router.push("/property/add")}
              style={styles.add}
            />
          </> : (
            <Notice tone="exists" label="Locked">
              Request this capability to create and manage property listings.
            </Notice>
          )}

          {/* ------------------------------------------------------------ */}
          {/* Activity Clubs                                                */}
          {/* ------------------------------------------------------------ */}
          <CapabilityHeader
            title="Activity Clubs"
            count={clubs.length}
            status={capabilities.activity_clubs_status}
            requestStatus={requests.activity_clubs}
            onRequest={()=>requestCapability("activity_clubs","Activity Clubs")}
          />

          {activitiesEnabled ? <>
            {clubs.length===0 && (
              <Empty
                glyph="people"
                title="No Activity Clubs yet"
                instruction="Create your first club listing."
              />
            )}

            {clubs.map(club=>{
              const pending=pendingByClub[club.id] || [];
              const approved=approvedByClub[club.id] || [];
              const limit=club.member_limit || 20;
              const full=approved.length>=limit;

              return(
                <Panel key={club.id} style={styles.card}>
                  <View style={styles.head}>
                    <Text style={styles.headKind}>Activity club listing</Text>
                    <View style={styles.headLine}/>
                    {full ? <Text style={styles.headFull}>Full</Text> : null}
                  </View>

                  <Text style={styles.cardTitle} numberOfLines={2}>{club.name}</Text>
                  <KeyValue label="Category" value={club.category || "—"}/>
                  <KeyValue label="Where" value={club.location || "—"}/>

                  {/* Membership has a real ceiling, so it is read off a ticked
                      track rather than written out as a fraction. */}
                  <View style={styles.meterRow}>
                    <Meter
                      value={approved.length}
                      max={limit}
                      width={140}
                      tone="exists"
                      label="Approved"
                      valueLabel={`${approved.length}/${limit}`}
                    />
                  </View>

                  {/* A card inside a card steps UP a surface -- panelRaised
                      with a stronger hairline -- rather than repeating the
                      same plate at the same tone. */}
                  <Row
                    glyph="bell"
                    style={styles.nestedRow}
                    title={pending.length>0
                      ? `${pending.length} pending request${pending.length===1 ? "" : "s"}`
                      : "No pending requests"}
                    sub="Review membership decisions in the Action Centre."
                    meta={String(pending.length)}
                  />

                  <Action
                    kind={pending.length>0 ? "primary" : "secondary"}
                    glyph="forward"
                    label={pending.length>0 ? "Review requests" : "View requests"}
                    accessibilityLabel={`Review membership requests for ${club.name}`}
                    onPress={()=>router.push(`/manager/requests?club=${club.id}&view=requests`)}
                  />

                  <QRBlock type="activity" id={club.id}>
                    <QRCodeGenerator activityClubId={club.id} size={96}/>
                  </QRBlock>

                  <View style={styles.buttons}>
                    <Action
                      kind="secondary" glyph="edit" label="Edit"
                      accessibilityLabel={`Edit ${club.name}`}
                      onPress={()=>router.push(`/activity-clubs/edit/${club.id}`)}
                      style={styles.button}
                    />
                    <Action
                      kind="secondary" glyph="external" label="Public profile"
                      accessibilityLabel={`View ${club.name}'s public profile`}
                      onPress={()=>router.push(`/activity-clubs/${club.id}`)}
                      style={styles.button}
                    />
                  </View>

                  <Action
                    kind="secondary"
                    glyph="lock"
                    label="Open private message board"
                    accessibilityLabel={`Open the private message board for ${club.name}`}
                    onPress={()=>router.push(`/activity-clubs/message-board/${club.id}`)}
                    style={styles.wide}
                  />

                  <SectionRule label="Approved members" meta={String(approved.length)}/>

                  {approved.length===0 ? (
                    <Empty
                      glyph="people"
                      title={`No approved members in ${club.name}`}
                      instruction="Approve a membership request in the Action Centre and the Explorer appears here."
                    />
                  ) : approved.map(member=>(
                    <Panel key={member.id} raised style={styles.memberCard}>
                      <MemberIdentity membership={member} profiles={memberProfiles}/>
                      <Action
                        kind="quiet"
                        glyph="close"
                        label={workingId===member.id ? "Removing…" : "Remove member"}
                        accessibilityLabel={`Remove ${membershipName(member)} from ${club.name}`}
                        disabled={workingId===member.id}
                        onPress={()=>confirmRemoveMember(member,club)}
                        style={styles.wide}
                      />
                    </Panel>
                  ))}
                </Panel>
              );
            })}

            <Action
              kind="primary" glyph="plus" label="Add an Activity Club"
              accessibilityLabel="Add an Activity Club"
              onPress={()=>router.push("/activity-clubs/add")}
              style={styles.add}
            />
          </> : (
            <Notice tone="exists" label="Locked">
              Request this paid capability to create clubs and approve explorer members.
            </Notice>
          )}

          {/* ------------------------------------------------------------ */}
          {/* Events                                                        */}
          {/* ------------------------------------------------------------ */}
          <CapabilityHeader
            title="Events"
            count={events.length}
            status={capabilities.events_status}
            requestStatus={requests.events}
            onRequest={()=>requestCapability("events","Events")}
          />

          {eventsEnabled ? <>
            {events.length===0 && (
              <Empty
                glyph="calendar"
                title="No events yet"
                instruction="Create your first public event listing."
              />
            )}

            {events.map(event=>(
              <Panel key={event.id} style={styles.card}>
                <View style={styles.head}>
                  <Text style={styles.headKind}>Event</Text>
                  <View style={styles.headLine}/>
                  <Text style={styles.headState}>{event.status}</Text>
                </View>

                <Text style={styles.cardTitle} numberOfLines={2}>{event.name}</Text>

                <KeyValue label="Category" value={event.category || "—"}/>
                <KeyValue label="Price" value={formatEventPrice(event.price)}/>
                <KeyValue label="Starts" value={formatEventDate(event.starts_at)}/>
                <KeyValue label="Where" value={event.location || event.address || "—"}/>

                <QRBlock type="event" id={event.id}>
                  <QRCodeGenerator eventId={event.id} size={96}/>
                </QRBlock>

                <View style={styles.buttons}>
                  <Action
                    kind="secondary" glyph="edit" label="Edit"
                    accessibilityLabel={`Edit ${event.name}`}
                    onPress={()=>router.push(`/events/edit/${event.id}`)}
                    style={styles.button}
                  />
                  <Action
                    kind="secondary" glyph="external" label="View listing"
                    accessibilityLabel={`View ${event.name}`}
                    onPress={()=>router.push(`/events/${event.id}`)}
                    style={styles.button}
                  />
                </View>
              </Panel>
            ))}

            <Action
              kind="primary" glyph="plus" label="Add an event"
              accessibilityLabel="Add an event"
              onPress={()=>router.push("/events/add")}
              style={styles.add}
            />
          </> : (
            <Notice tone="exists" label="Locked">
              Request the Events capability to create and manage event listings.
            </Notice>
          )}
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

  capabilityRow:{flexDirection:"row",alignItems:"center",gap:9,flexWrap:"wrap",marginBottom:10},
  linkAction:{alignSelf:"flex-start",marginBottom:10},

  nestedRow:{backgroundColor:INK.panelRaised,borderColor:INK.hairlineStrong},

  card:{padding:14,marginBottom:10},
  head:{flexDirection:"row",alignItems:"center",gap:9,marginBottom:9},
  headKind:{...MONO_META,color:INK.readoutSoft,fontSize:TYPE.data.sizes.md},
  headLine:{flex:1,height:1,backgroundColor:INK.hairline},
  headState:{...MONO_META,color:INK.readoutFaint,fontSize:TYPE.data.sizes.sm},
  headFull:{...MONO_META,color:INK.readout,fontSize:TYPE.data.sizes.sm},
  cardTitle:{color:INK.readout,fontSize:TYPE.display.sizes.md,fontWeight:"700",letterSpacing:-0.3},

  meterRow:{marginTop:11,marginBottom:4},

  qrRow:{
    flexDirection:"row",alignItems:"center",gap:14,marginTop:12,paddingTop:12,
    borderTopWidth:SHAPE.border,borderTopColor:INK.hairline
  },
  qrCopy:{flex:1,minWidth:0,gap:9},
  qrLabel:{...MONO_META,color:INK.readout,fontSize:TYPE.data.sizes.md},
  qrButton:{alignSelf:"stretch"},

  buttons:{flexDirection:"row",gap:9,marginTop:12},
  button:{flex:1},
  wide:{marginTop:9},
  add:{marginTop:4,marginBottom:6},

  memberCard:{padding:12,marginBottom:8},
  memberIdentity:{flexDirection:"row",alignItems:"center",gap:11},
  avatarFrame:{backgroundColor:INK.inset},
  avatar:{width:38,height:38,borderRadius:SHAPE.radius.pill},
  avatarLetter:{color:INK.readoutSoft,fontWeight:"700",fontSize:15},
  memberNameWrap:{flex:1,minWidth:0},
  memberName:{color:INK.readout,fontSize:TYPE.display.sizes.sm,fontWeight:"600",letterSpacing:-0.2},
  memberAccess:{color:INK.readoutSoft,fontSize:TYPE.body.sizes.sm,marginTop:3}
});

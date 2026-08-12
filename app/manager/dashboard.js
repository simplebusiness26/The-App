import React,{useCallback,useMemo,useState} from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Image
} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../../services/supabase";
import QRCodeGenerator from "../../components/QRCodeGenerator";
import {useFeedback} from "../../context/FeedbackContext";
import {formatEventDate,formatEventPrice} from "../../utils/events";
import {INK} from "../../utils/tokens";

const ENABLED_STATUSES=["active","trial"];

function CapabilityHeader({title,status,requestStatus,onRequest}){
  const enabled=ENABLED_STATUSES.includes(status);

  return(
    <View style={styles.capabilityHeader}>
      <View style={styles.capabilityHeadingText}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={[styles.statusPill,enabled ? styles.activePill : styles.inactivePill]}>
          {enabled ? status : requestStatus==="pending" ? "request pending" : status || "inactive"}
        </Text>
      </View>

      {!enabled && requestStatus!=="pending" && (
        <Pressable style={styles.requestButton} onPress={onRequest}>
          <Text style={styles.requestButtonText}>Request access</Text>
        </Pressable>
      )}
    </View>
  );
}

function QRBlock({type,id,children}){
  return(
    <View style={styles.qrSection}>
      <View style={styles.qrPreview}>{children}</View>
      <Pressable
        style={styles.printQrButton}
        onPress={()=>router.push(`/manager/qr/${type}/${id}`)}
      >
        <Text style={styles.printQrText}>Open printable QR</Text>
      </Pressable>
    </View>
  );
}

function MemberIdentity({membership,profiles}){
  const profile=profiles[membership.user_id];
  const name=profile?.full_name || membership.applicant_name || "Explorer";

  return(
    <View style={styles.memberIdentity}>
      {profile?.profile_photo ? (
        <Image source={{uri:profile.profile_photo}} style={styles.memberAvatar}/>
      ) : (
        <View style={styles.memberAvatarFallback}>
          <Text style={styles.memberInitial}>{name.slice(0,1).toUpperCase()}</Text>
        </View>
      )}

      <View style={styles.memberNameWrap}>
        <Text style={styles.applicantName}>{name}</Text>
        <Text style={styles.memberAccessText}>Message board access enabled</Text>
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
      <View style={styles.loading}>
        <ActivityIndicator size="large"/>
        <Text style={styles.loadingText}>Loading manager dashboard...</Text>
      </View>
    );
  }

  if(error){
    return(
      <View style={styles.loading}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  const businessesEnabled=capabilityEnabled("businesses");
  const propertiesEnabled=capabilityEnabled("properties");
  const activitiesEnabled=capabilityEnabled("activity_clubs");
  const eventsEnabled=capabilityEnabled("events");

  return(
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Manager Dashboard</Text>
      <Text style={styles.subtitle}>
        Manage listings, approved members and printable QR codes from one place.
      </Text>

      <View style={[styles.actionCard,totalPending>0 && styles.actionCardActive]}>
        <View style={styles.actionCardTop}>
          <View style={styles.actionCardText}>
            <Text style={styles.actionEyebrow}>MANAGER ACTION CENTRE</Text>
            <Text style={styles.actionTitle}>
              {totalPending>0
                ? `${totalPending} membership request${totalPending===1 ? "" : "s"} need a decision`
                : "No pending membership requests"
              }
            </Text>
            <Text style={styles.actionText}>
              Approvals and other decisions are kept separate from listing management.
            </Text>
          </View>

          <View style={[styles.actionCount,totalPending===0 && styles.actionCountClear]}>
            <Text style={styles.actionCountNumber}>{totalPending}</Text>
            <Text style={styles.actionCountLabel}>pending</Text>
          </View>
        </View>

        <Pressable
          style={styles.actionButton}
          onPress={()=>router.push("/manager/requests")}
        >
          <Text style={styles.actionButtonText}>
            {totalPending>0 ? "Review pending actions" : "Open Action Centre"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <CapabilityHeader
          title={`🏪 Businesses (${businesses.length})`}
          status={capabilities.businesses_status}
          requestStatus={requests.businesses}
          onRequest={()=>requestCapability("businesses","Businesses")}
        />

        {businessesEnabled ? <>
          {businesses.length===0 && (
            <EmptyCard title="No businesses yet" text="Create your first business listing."/>
          )}

          {businesses.map(business=>(
            <View key={business.id} style={styles.card}>
              <Text style={styles.cardTitle}>{business.name}</Text>
              <Text style={styles.cardSub}>{business.category || business.address}</Text>

              <QRBlock type="business" id={business.id}>
                <QRCodeGenerator businessId={business.id} size={120}/>
              </QRBlock>

              <View style={styles.buttonRow}>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={()=>router.push(`/business/edit/${business.id}`)}
                >
                  <Text style={styles.secondaryButtonText}>Edit</Text>
                </Pressable>

                <Pressable
                  style={styles.darkButton}
                  onPress={()=>router.push(`/business/${business.id}`)}
                >
                  <Text style={styles.buttonText}>Public profile</Text>
                </Pressable>
              </View>
            </View>
          ))}

          <Pressable style={styles.addButton} onPress={()=>router.push("/business/add")}>
            <Text style={styles.buttonText}>➕ Add Business</Text>
          </Pressable>
        </> : (
          <LockedCard text="Request this capability to create and manage business listings."/>
        )}
      </View>

      <View style={styles.section}>
        <CapabilityHeader
          title={`🏠 Properties (${properties.length})`}
          status={capabilities.properties_status}
          requestStatus={requests.properties}
          onRequest={()=>requestCapability("properties","Properties")}
        />

        {propertiesEnabled ? <>
          {properties.length===0 && (
            <EmptyCard title="No properties yet" text="Create your first property listing."/>
          )}

          {properties.map(property=>(
            <View key={property.id} style={styles.card}>
              <Text style={styles.cardTitle}>{property.name}</Text>
              <Text style={styles.cardSub}>{property.address}</Text>

              <QRBlock type="property" id={property.id}>
                <QRCodeGenerator propertyId={property.id} size={120}/>
              </QRBlock>

              <View style={styles.buttonRow}>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={()=>router.push(`/property/edit/${property.id}`)}
                >
                  <Text style={styles.secondaryButtonText}>Edit</Text>
                </Pressable>

                <Pressable
                  style={styles.darkButton}
                  onPress={()=>router.push(`/property/${property.id}`)}
                >
                  <Text style={styles.buttonText}>Public profile</Text>
                </Pressable>
              </View>
            </View>
          ))}

          <Pressable style={styles.addButton} onPress={()=>router.push("/property/add")}>
            <Text style={styles.buttonText}>➕ Add Property</Text>
          </Pressable>
        </> : (
          <LockedCard text="Request this capability to create and manage property listings."/>
        )}
      </View>

      <View style={styles.section}>
        <CapabilityHeader
          title={`🏃 Activity Clubs (${clubs.length})`}
          status={capabilities.activity_clubs_status}
          requestStatus={requests.activity_clubs}
          onRequest={()=>requestCapability("activity_clubs","Activity Clubs")}
        />

        {activitiesEnabled ? <>
          {clubs.length===0 && (
            <EmptyCard title="No Activity Clubs yet" text="Create your first club listing."/>
          )}

          {clubs.map(club=>{
            const pending=pendingByClub[club.id] || [];
            const approved=approvedByClub[club.id] || [];
            const limit=club.member_limit || 20;
            const full=approved.length>=limit;

            return(
              <View key={club.id} style={styles.clubCard}>
                <Text style={styles.clubEyebrow}>ACTIVITY CLUB LISTING</Text>
                <Text style={styles.cardTitle}>{club.name}</Text>
                <Text style={styles.cardSub}>{club.category} · {club.location}</Text>

                <View style={styles.capacityRow}>
                  <Text style={styles.memberCount}>Approved: {approved.length} / {limit}</Text>
                  {full && <Text style={styles.fullPill}>FULL</Text>}
                </View>

                <View style={[styles.requestSummary,pending.length>0 && styles.requestSummaryActive]}>
                  <View style={styles.requestSummaryText}>
                    <Text style={styles.requestSummaryTitle}>
                      {pending.length>0
                        ? `${pending.length} pending request${pending.length===1 ? "" : "s"}`
                        : "No pending requests"
                      }
                    </Text>
                    <Text style={styles.requestSummarySub}>
                      Review membership decisions in the Action Centre.
                    </Text>
                  </View>

                  <Pressable
                    style={styles.reviewButton}
                    onPress={()=>router.push(`/manager/requests?club=${club.id}&view=requests`)}
                  >
                    <Text style={styles.reviewButtonText}>
                      {pending.length>0 ? "Review" : "View"}
                    </Text>
                  </Pressable>
                </View>

                <QRBlock type="activity" id={club.id}>
                  <QRCodeGenerator activityClubId={club.id} size={120}/>
                </QRBlock>

                <View style={styles.buttonRow}>
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={()=>router.push(`/activity-clubs/edit/${club.id}`)}
                  >
                    <Text style={styles.secondaryButtonText}>Edit</Text>
                  </Pressable>

                  <Pressable
                    style={styles.darkButton}
                    onPress={()=>router.push(`/activity-clubs/${club.id}`)}
                  >
                    <Text style={styles.buttonText}>Public profile</Text>
                  </Pressable>
                </View>

                <Pressable
                  style={styles.boardButton}
                  onPress={()=>router.push(`/activity-clubs/message-board/${club.id}`)}
                >
                  <Text style={styles.buttonText}>Open private message board</Text>
                </Pressable>

                <View style={styles.memberSectionHeader}>
                  <Text style={styles.applicationTitle}>Approved members</Text>
                  <Text style={styles.memberSectionClub}>{club.name}</Text>
                  <Text style={styles.memberSectionCount}>
                    {approved.length} approved member{approved.length===1 ? "" : "s"}
                  </Text>
                </View>

                {approved.length===0 ? (
                  <View style={styles.noApplications}>
                    <Text style={styles.noApplicationsText}>
                      No approved members in {club.name}.
                    </Text>
                  </View>
                ) : approved.map(member=>(
                  <View key={member.id} style={styles.approvedMemberCard}>
                    <MemberIdentity membership={member} profiles={memberProfiles}/>
                    <Pressable
                      style={styles.removeButton}
                      disabled={workingId===member.id}
                      onPress={()=>confirmRemoveMember(member,club)}
                    >
                      <Text style={styles.removeButtonText}>
                        {workingId===member.id ? "Removing..." : "Remove member"}
                      </Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            );
          })}

          <Pressable style={styles.addButton} onPress={()=>router.push("/activity-clubs/add")}>
            <Text style={styles.buttonText}>➕ Add Activity Club</Text>
          </Pressable>
        </> : (
          <LockedCard text="Request this paid capability to create clubs and approve explorer members."/>
        )}
      </View>

      <View style={styles.section}>
        <CapabilityHeader
          title={`🎉 Events (${events.length})`}
          status={capabilities.events_status}
          requestStatus={requests.events}
          onRequest={()=>requestCapability("events","Events")}
        />

        {eventsEnabled ? <>
          {events.length===0 && (
            <EmptyCard title="No events yet" text="Create your first public event listing."/>
          )}

          {events.map(event=>(
            <View key={event.id} style={styles.card}>
              <View style={styles.eventHeading}>
                <Text style={styles.cardTitle}>{event.name}</Text>
                <Text style={styles.eventStatus}>{event.status}</Text>
              </View>
              <Text style={styles.cardSub}>{event.category} · {formatEventPrice(event.price)}</Text>
              <Text style={styles.eventDate}>📅 {formatEventDate(event.starts_at)}</Text>
              <Text style={styles.cardSub}>📍 {event.location || event.address}</Text>

              <QRBlock type="event" id={event.id}>
                <QRCodeGenerator eventId={event.id} size={120}/>
              </QRBlock>

              <View style={styles.buttonRow}>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={()=>router.push(`/events/edit/${event.id}`)}
                >
                  <Text style={styles.secondaryButtonText}>Edit</Text>
                </Pressable>

                <Pressable
                  style={styles.darkButton}
                  onPress={()=>router.push(`/events/${event.id}`)}
                >
                  <Text style={styles.buttonText}>View listing</Text>
                </Pressable>
              </View>
            </View>
          ))}

          <Pressable style={styles.addButton} onPress={()=>router.push("/events/add")}>
            <Text style={styles.buttonText}>➕ Add Event</Text>
          </Pressable>
        </> : (
          <LockedCard text="Request the Events capability to create and manage event listings."/>
        )}
      </View>
    </ScrollView>
  );
}

function EmptyCard({title,text}){
  return(
    <View style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function LockedCard({text}){
  return(
    <View style={styles.lockedCard}>
      <Text>{text}</Text>
    </View>
  );
}

const styles=StyleSheet.create({
  container:{flex:1,backgroundColor:INK.card},
  content:{padding:20,paddingBottom:60},
  loading:{flex:1,justifyContent:"center",alignItems:"center",padding:30},
  loadingText:{marginTop:16,color:INK.ink},
  errorText:{fontSize:18,textAlign:"center"},
  title:{fontSize:32,fontWeight:"bold",marginTop:10},
  subtitle:{fontSize:16,color:INK.inkSoft,lineHeight:23,marginBottom:20,marginTop:6},
  actionCard:{backgroundColor:INK.card,borderWidth:1,borderColor:INK.ink,borderRadius:16,padding:17,marginBottom:30},
  actionCardActive:{backgroundColor:INK.card,borderColor:INK.yellow},
  actionCardTop:{flexDirection:"row",alignItems:"flex-start",gap:14},
  actionCardText:{flex:1},
  actionEyebrow:{fontSize:11,fontWeight:"bold",color:INK.red,letterSpacing:0.5},
  actionTitle:{fontSize:19,fontWeight:"bold",marginTop:5},
  actionText:{fontSize:14,color:INK.inkSoft,lineHeight:20,marginTop:5},
  actionCount:{minWidth:68,backgroundColor:INK.yellow,borderRadius:13,paddingVertical:9,paddingHorizontal:11,alignItems:"center"},
  actionCountClear:{backgroundColor:INK.card},
  actionCountNumber:{fontSize:23,fontWeight:"bold"},
  actionCountLabel:{fontSize:10,fontWeight:"bold",textTransform:"uppercase"},
  actionButton:{backgroundColor:INK.blue,padding:13,borderRadius:10,marginTop:14},
  actionButtonText:{color:INK.card,fontWeight:"bold",textAlign:"center"},
  section:{marginBottom:34},
  capabilityHeader:{marginBottom:14},
  capabilityHeadingText:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:10},
  sectionTitle:{fontSize:23,fontWeight:"bold",flexShrink:1},
  statusPill:{fontSize:12,fontWeight:"bold",textTransform:"capitalize",paddingHorizontal:10,paddingVertical:6,borderRadius:20,overflow:"hidden"},
  activePill:{backgroundColor:INK.card,color:INK.green},
  inactivePill:{backgroundColor:INK.card,color:INK.red},
  requestButton:{backgroundColor:INK.blue,padding:13,borderRadius:10,marginTop:12,alignSelf:"flex-start"},
  requestButtonText:{color:INK.card,fontWeight:"bold"},
  card:{backgroundColor:INK.card,padding:18,borderRadius:14,marginBottom:15,borderWidth:1,borderColor:INK.ink},
  clubCard:{backgroundColor:INK.card,padding:18,borderRadius:18,marginBottom:28,borderWidth:2,borderColor:INK.ink},
  clubEyebrow:{fontSize:11,fontWeight:"bold",color:INK.blue,letterSpacing:0.6,marginBottom:7},
  cardTitle:{fontSize:21,fontWeight:"bold"},
  cardSub:{fontSize:15,color:INK.inkSoft,marginTop:5},
  eventHeading:{flexDirection:"row",alignItems:"flex-start",justifyContent:"space-between",gap:10},
  eventStatus:{fontSize:11,fontWeight:"bold",textTransform:"uppercase",color:INK.blue,backgroundColor:INK.card,paddingHorizontal:9,paddingVertical:5,borderRadius:16,overflow:"hidden"},
  eventDate:{fontSize:14,fontWeight:"600",color:INK.blue,marginTop:10,lineHeight:20},
  capacityRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginTop:10},
  memberCount:{fontWeight:"700",color:INK.blue},
  fullPill:{backgroundColor:INK.card,color:INK.red,fontSize:12,fontWeight:"bold",paddingHorizontal:9,paddingVertical:5,borderRadius:20,overflow:"hidden"},
  requestSummary:{flexDirection:"row",alignItems:"center",gap:12,backgroundColor:INK.card,borderRadius:11,padding:13,marginTop:14,borderWidth:1,borderColor:INK.ink},
  requestSummaryActive:{backgroundColor:INK.card,borderColor:INK.yellow},
  requestSummaryText:{flex:1},
  requestSummaryTitle:{fontWeight:"bold",fontSize:16},
  requestSummarySub:{fontSize:12,color:INK.inkSoft,marginTop:3},
  reviewButton:{backgroundColor:INK.blue,paddingHorizontal:14,paddingVertical:10,borderRadius:9},
  reviewButtonText:{color:INK.card,fontWeight:"bold"},
  qrSection:{flexDirection:"row",alignItems:"center",gap:16,marginTop:16,paddingTop:16,borderTopWidth:1,borderColor:INK.hair},
  qrPreview:{padding:8,backgroundColor:INK.card},
  printQrButton:{flex:1,backgroundColor:INK.card,padding:14,borderRadius:10},
  printQrText:{color:INK.blue,fontWeight:"bold",textAlign:"center"},
  buttonRow:{flexDirection:"row",gap:10,marginTop:12},
  darkButton:{flex:1,backgroundColor:INK.ink,padding:14,borderRadius:10},
  secondaryButton:{flex:1,backgroundColor:INK.card,padding:14,borderRadius:10,borderWidth:1,borderColor:INK.ink},
  secondaryButtonText:{color:INK.ink,fontWeight:"bold",textAlign:"center"},
  boardButton:{backgroundColor:INK.blue,padding:14,borderRadius:10,marginTop:10},
  addButton:{backgroundColor:INK.blue,padding:16,borderRadius:12,marginTop:8},
  buttonText:{color:INK.card,textAlign:"center",fontWeight:"bold"},
  emptyCard:{backgroundColor:INK.card,padding:20,borderRadius:14,borderWidth:1,borderColor:INK.ink},
  emptyTitle:{fontSize:18,fontWeight:"bold"},
  emptyText:{fontSize:15,color:INK.inkSoft,marginTop:8,lineHeight:21},
  lockedCard:{backgroundColor:INK.card,padding:18,borderRadius:14,borderWidth:1,borderColor:INK.yellow},
  memberSectionHeader:{marginTop:22,marginBottom:10,paddingTop:18,borderTopWidth:2,borderColor:INK.ink},
  applicationTitle:{fontSize:18,fontWeight:"bold"},
  memberSectionClub:{fontSize:15,fontWeight:"700",color:INK.blue,marginTop:4},
  memberSectionCount:{fontSize:12,color:INK.inkSoft,marginTop:3},
  noApplications:{backgroundColor:INK.card,padding:14,borderRadius:10,borderWidth:1,borderColor:INK.ink},
  noApplicationsText:{color:INK.ink,lineHeight:20},
  approvedMemberCard:{backgroundColor:INK.card,padding:14,borderRadius:11,marginBottom:10,borderWidth:1,borderColor:INK.ink},
  memberIdentity:{flexDirection:"row",alignItems:"center"},
  memberAvatar:{width:44,height:44,borderRadius:22,backgroundColor:INK.hair},
  memberAvatarFallback:{width:44,height:44,borderRadius:22,backgroundColor:INK.blue,alignItems:"center",justifyContent:"center"},
  memberInitial:{color:INK.card,fontWeight:"bold",fontSize:18},
  memberNameWrap:{marginLeft:11,flex:1},
  applicantName:{fontSize:17,fontWeight:"bold"},
  memberAccessText:{fontSize:12,color:INK.inkSoft,marginTop:3},
  removeButton:{borderWidth:1,borderColor:INK.red,padding:11,borderRadius:9,marginTop:12},
  removeButtonText:{color:INK.red,fontWeight:"bold",textAlign:"center"}
});

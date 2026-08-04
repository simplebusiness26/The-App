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
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {supabase} from "../../../services/supabase";

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
    eyebrow:"CURRENT MEMBERSHIP STATUS",
    icon:"✓",
    title:"Membership approved",
    description:name=>`${name} is currently an approved member and has access to the private message board.`,
    next:[
      "The explorer currently has private message-board access",
      "They remain included in the club's approved-member count",
      "You can remove their membership from the Manager Dashboard"
    ]
  },
  rejected:{
    eyebrow:"APPLICATION DECISION",
    icon:"×",
    title:"Application rejected",
    description:name=>`${name}'s application was not approved. They are not a member of this club.`,
    next:[
      "The explorer was notified of the decision",
      "They do not have private message-board access",
      "They can submit another application later"
    ]
  },
  removed:{
    eyebrow:"CURRENT MEMBERSHIP STATUS",
    icon:"×",
    title:"Membership ended",
    description:name=>`${name} was previously approved, but is no longer a member. Their private message-board access has been removed.`,
    next:[
      "The explorer was notified that their membership ended",
      "They no longer have private message-board access",
      "They can apply to join the club again"
    ]
  },
  left:{
    eyebrow:"CURRENT MEMBERSHIP STATUS",
    icon:"×",
    title:"Member left the club",
    description:name=>`${name} is no longer a member and no longer has access to the private message board.`,
    next:[
      "The explorer is no longer in the approved-member count",
      "Their private message-board access is disabled",
      "They can apply to join again later"
    ]
  },
  pending:{
    eyebrow:"MEMBERSHIP REQUEST",
    icon:"!",
    title:"Decision still required",
    description:name=>`${name}'s request is still waiting for approval or rejection.`,
    next:[
      "This request still needs a manager decision",
      "The explorer does not yet have message-board access",
      "Open the Action Centre to review the application"
    ]
  }
};

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

    const {data:account,error:accountError}=await supabase
      .from("profiles")
      .select("is_manager")
      .eq("id",user.id)
      .single();

    if(accountError || !account?.is_manager){
      setError("A manager account is required to view this membership status.");
      setLoading(false);
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
    eyebrow:"CURRENT MEMBERSHIP STATUS",
    icon:"i",
    title:"Membership status updated",
    description:name=>`${name}'s current membership status is ${status}.`,
    next:["The membership record has changed","Review the Manager Dashboard for more details"]
  };

  const memberName=memberProfile?.full_name || membership?.applicant_name || "Explorer";
  const negative=["rejected","removed","left"].includes(status);
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
      <View style={styles.center}>
        <ActivityIndicator size="large"/>
        <Text style={styles.loadingText}>Loading current membership status...</Text>
      </View>
    );
  }

  if(error || !membership || !club){
    return(
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Membership status unavailable</Text>
        <Text style={styles.errorText}>{error || "The membership could not be loaded."}</Text>
        <Pressable style={styles.primaryButton} onPress={()=>router.push("/manager/dashboard")}>
          <Text style={styles.buttonText}>Open Manager Dashboard</Text>
        </Pressable>
      </View>
    );
  }

  return(
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headingRow}>
        <View style={styles.headingText}>
          <Text style={styles.pageTitle}>Membership status</Text>
          <Text style={styles.pageSubtitle}>{club.name}</Text>
        </View>
        <View style={styles.statusPill}>
          <Text style={styles.statusPillText}>{status.toUpperCase()}</Text>
        </View>
      </View>

      <View style={[
        styles.resultCard,
        negative ? styles.negativeCard : pending ? styles.pendingCard : styles.approvedCard
      ]}>
        <Text style={styles.eyebrow}>{copy.eyebrow}</Text>

        <View style={[
          styles.iconCircle,
          negative ? styles.negativeIcon : pending ? styles.pendingIcon : styles.approvedIcon
        ]}>
          <Text style={styles.iconText}>{copy.icon}</Text>
        </View>

        <View style={styles.identityRow}>
          {memberProfile?.profile_photo ? (
            <Image source={{uri:memberProfile.profile_photo}} style={styles.avatar}/>
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitial}>{memberName.slice(0,1).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.identityText}>
            <Text style={styles.memberName}>{memberName}</Text>
            {!!membership.applied_at && (
              <Text style={styles.dateText}>Applied {formatDate(membership.applied_at)}</Text>
            )}
          </View>
        </View>

        <Text style={styles.resultTitle}>{copy.title}</Text>
        <Text style={styles.resultText}>{copy.description(memberName)}</Text>
        {!!decisionLabel && <Text style={styles.decisionDate}>{decisionLabel}</Text>}

        <View style={styles.capacityCard}>
          <Text style={styles.capacityIcon}>👥</Text>
          <View style={styles.capacityTextWrap}>
            <Text style={styles.capacityLabel}>Current club capacity</Text>
            <Text style={styles.capacityValue}>
              {approvedCount} of {club.member_limit || 20} members approved
            </Text>
          </View>
        </View>

        {pending ? (
          <Pressable
            style={styles.primaryButton}
            onPress={()=>router.replace(`/manager/requests?club=${club.id}&membership=${membership.id}&view=requests`)}
          >
            <Text style={styles.buttonText}>Review this request</Text>
          </Pressable>
        ) : (
          <Pressable
            style={styles.primaryButton}
            onPress={()=>router.push(`/manager/dashboard?club=${club.id}&view=members`)}
          >
            <Text style={styles.buttonText}>View current club members</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.nextCard}>
        <Text style={styles.nextTitle}>What this means now</Text>
        {copy.next.map((item,index)=>(
          <View key={`${item}-${index}`} style={styles.nextRow}>
            <View style={[
              styles.nextDot,
              index===copy.next.length-1 ? styles.infoDot : negative ? styles.negativeDot : styles.successDot
            ]}>
              <Text style={styles.nextDotText}>{index===copy.next.length-1 ? "i" : "✓"}</Text>
            </View>
            <Text style={styles.nextText}>{item}</Text>
          </View>
        ))}
      </View>

      <View style={styles.navigationRow}>
        <Pressable style={styles.secondaryButton} onPress={()=>router.push("/notifications")}>
          <Text style={styles.secondaryText}>Notifications</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={()=>router.push("/manager/dashboard")}>
          <Text style={styles.secondaryText}>Manager Dashboard</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  container:{flex:1,backgroundColor:"#f5f7fb"},
  content:{padding:20,paddingBottom:70},
  center:{flex:1,alignItems:"center",justifyContent:"center",padding:30,backgroundColor:"#f5f7fb"},
  loadingText:{marginTop:14,color:"#666"},
  errorTitle:{fontSize:23,fontWeight:"bold",textAlign:"center"},
  errorText:{fontSize:15,color:"#666",textAlign:"center",lineHeight:22,marginTop:10},
  headingRow:{flexDirection:"row",alignItems:"flex-start",gap:12,marginBottom:18},
  headingText:{flex:1},
  pageTitle:{fontSize:30,fontWeight:"bold"},
  pageSubtitle:{fontSize:16,color:"#68717b",marginTop:5},
  statusPill:{backgroundColor:"#fff1df",borderWidth:1,borderColor:"#d89a3a",borderRadius:18,paddingHorizontal:12,paddingVertical:8},
  statusPillText:{fontSize:11,fontWeight:"bold",color:"#8a4d00"},
  resultCard:{borderRadius:18,padding:22,borderWidth:1,alignItems:"center"},
  approvedCard:{backgroundColor:"#edf8f0",borderColor:"#4ba965"},
  negativeCard:{backgroundColor:"#fff0ef",borderColor:"#d83c31"},
  pendingCard:{backgroundColor:"#fff8df",borderColor:"#d29b00"},
  eyebrow:{fontSize:11,fontWeight:"bold",letterSpacing:0.7,color:"#68717b",alignSelf:"flex-start"},
  iconCircle:{width:76,height:76,borderRadius:38,alignItems:"center",justifyContent:"center",marginTop:18},
  approvedIcon:{backgroundColor:"#24953e"},
  negativeIcon:{backgroundColor:"#cf3028"},
  pendingIcon:{backgroundColor:"#bd8100"},
  iconText:{fontSize:44,fontWeight:"bold",color:"white",lineHeight:48},
  identityRow:{alignSelf:"stretch",flexDirection:"row",alignItems:"center",marginTop:20,padding:13,borderRadius:12,backgroundColor:"rgba(255,255,255,0.62)"},
  avatar:{width:54,height:54,borderRadius:27,backgroundColor:"#ddd"},
  avatarFallback:{width:54,height:54,borderRadius:27,backgroundColor:"#5633a8",alignItems:"center",justifyContent:"center"},
  avatarInitial:{fontSize:21,fontWeight:"bold",color:"white"},
  identityText:{flex:1,marginLeft:12},
  memberName:{fontSize:19,fontWeight:"bold"},
  dateText:{fontSize:12,color:"#69727b",marginTop:4},
  resultTitle:{fontSize:27,fontWeight:"bold",textAlign:"center",marginTop:22},
  resultText:{fontSize:16,lineHeight:23,textAlign:"center",color:"#52605a",marginTop:10},
  decisionDate:{fontSize:12,fontWeight:"600",color:"#69727b",marginTop:10},
  capacityCard:{alignSelf:"stretch",flexDirection:"row",alignItems:"center",backgroundColor:"rgba(255,255,255,0.62)",borderRadius:12,padding:14,marginTop:20},
  capacityIcon:{fontSize:28,marginRight:12},
  capacityTextWrap:{flex:1},
  capacityLabel:{fontSize:15,fontWeight:"bold"},
  capacityValue:{fontSize:13,color:"#5b655f",marginTop:3},
  primaryButton:{alignSelf:"stretch",backgroundColor:"#1637c9",paddingVertical:15,paddingHorizontal:18,borderRadius:11,marginTop:20},
  buttonText:{color:"white",fontWeight:"bold",textAlign:"center",fontSize:15},
  nextCard:{backgroundColor:"white",borderWidth:1,borderColor:"#dfe3e8",borderRadius:16,padding:20,marginTop:16},
  nextTitle:{fontSize:20,fontWeight:"bold",marginBottom:15},
  nextRow:{flexDirection:"row",alignItems:"flex-start",marginBottom:14},
  nextDot:{width:26,height:26,borderRadius:13,alignItems:"center",justifyContent:"center",marginRight:11},
  successDot:{backgroundColor:"#52a765"},
  negativeDot:{backgroundColor:"#ca443b"},
  infoDot:{backgroundColor:"#4c6fd1"},
  nextDotText:{color:"white",fontSize:13,fontWeight:"bold"},
  nextText:{flex:1,fontSize:15,lineHeight:21,color:"#343b43"},
  navigationRow:{flexDirection:"row",gap:10,marginTop:16},
  secondaryButton:{flex:1,borderWidth:1,borderColor:"#aeb5c0",backgroundColor:"white",padding:13,borderRadius:10},
  secondaryText:{fontWeight:"bold",textAlign:"center",color:"#263447"}
});

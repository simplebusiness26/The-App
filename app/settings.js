import React,{useCallback,useState} from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert
} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../services/supabase";
import {useFeedback} from "../context/FeedbackContext";
import {sendRecoveryEmail} from "../utils/passwordRecovery";

const CAPABILITIES=[
  {key:"businesses",label:"Businesses"},
  {key:"properties",label:"Properties"},
  {key:"activity_clubs",label:"Activity clubs"},
  {key:"events",label:"Events"}
];

const ENABLED_STATUSES=["active","trial"];

function CapabilityRow({label,status}){
  const enabled=ENABLED_STATUSES.includes(status);

  return(
    <View style={styles.capabilityRow}>
      <Text style={styles.capabilityLabel}>{label}</Text>
      <Text style={[styles.capabilityPill,enabled ? styles.pillOn : styles.pillOff]}>
        {status || "inactive"}
      </Text>
    </View>
  );
}

// One setting for the whole app, four answers. Each carries the sentence a
// person reads back once they have chosen it -- privacy controls read as
// sentences about people, per docs/design-system.md, never
// "Visibility: restricted".
//
// Everyone means every Explorer using the app. It does not mean the public
// internet: a signed-out visitor sees the map and nothing about any person.
const VISIBILITY_CHOICES=[
  {key:"nobody",label:"Nobody",sentence:"Nobody can see what you share."},
  {key:"close_friends",label:"Close friends",sentence:"Only the people on your close friends list can see what you share."},
  {key:"friends",label:"Friends",sentence:"People you and they both follow can see what you share."},
  {key:"everyone",label:"Everyone",sentence:"Any Explorer using Xplorer can see what you share."}
];

export default function Settings(){
  const {showFeedback}=useFeedback();

  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [savingPrivacy,setSavingPrivacy]=useState(false);
  const [sendingReset,setSendingReset]=useState(false);

  const [email,setEmail]=useState("");
  const [area,setArea]=useState("");
  const [showArea,setShowArea]=useState(false);
  const [leaderboardOptIn,setLeaderboardOptIn]=useState(true);
  const [visibility,setVisibility]=useState("nobody");
  const [capabilities,setCapabilities]=useState(null);

  // What they currently manage, so the confirmation can say exactly what is
  // about to happen to it rather than "your listings".
  const [listings,setListings]=useState({businesses:0,properties:0,activity_clubs:0,events:0});
  // null | 'become' | 'stop'. The confirmation is drawn in the page rather than
  // in Alert.alert. Alert would work -- FeedbackProvider replaces it on web,
  // where react-native-web's own is an empty function -- but this one is not a
  // yes/no. Downgrading is a choice between two outcomes that each need
  // explaining, and a three-button system dialog is the wrong shape for that.
  const [confirming,setConfirming]=useState(null);
  const [workingManager,setWorkingManager]=useState(false);

  const load=useCallback(async()=>{
    setLoading(true);
    setError("");

    const {data:{user}}=await supabase.auth.getUser();
    if(!user){router.replace("/auth/login");return;}

    const {data:profile,error:profileError}=await supabase
      .from("profiles")
      .select("email,area,show_area,leaderboard_opt_in,visibility")
      .eq("id",user.id)
      .maybeSingle();

    if(profileError){
      setError("Your settings could not be loaded.");
      setLoading(false);
      return;
    }

    // Signup returns early without writing a profile row when email
    // confirmation is on, so a verified user can arrive here with nothing to
    // read. Say so rather than rendering empty controls that save nowhere.
    if(!profile){
      setError("No profile was found for this account. Please contact support.");
      setLoading(false);
      return;
    }

    setEmail(profile.email || user.email || "");
    setArea(profile.area || "");
    setShowArea(!!profile.show_area);
    setLeaderboardOptIn(profile.leaderboard_opt_in!==false);
    // Anything unrecognised reads as nobody. A visibility control that fails
    // open on a value it does not understand is the wrong way round.
    setVisibility(
      VISIBILITY_CHOICES.some((choice)=>choice.key===profile.visibility)
        ? profile.visibility
        : "nobody"
    );

    // There is no manager role to check. 20260803120000_unify_account_model
    // retired it: everyone is an Explorer, and managing places is a capability
    // granted on top. So the statuses are read for every account, and the
    // dashboard's own defaults are mirrored here for an account that has no
    // manager_capabilities row yet.
    const {data:capabilityRow}=await supabase
      .from("manager_capabilities")
      .select("businesses_status,properties_status,activity_clubs_status,events_status")
      .eq("user_id",user.id)
      .maybeSingle();

    // Every default is inactive. It used to say businesses and properties were
    // 'active' for an account with no row at all, which stopped being true when
    // 20260811120000 flipped those column defaults -- so Settings was telling
    // people they could list a business while the insert policy refused it.
    setCapabilities(capabilityRow || {
      businesses_status:"inactive",
      properties_status:"inactive",
      activity_clubs_status:"inactive",
      events_status:"inactive"
    });

    const [businessCount,propertyCount,clubCount,eventCount]=await Promise.all([
      supabase.from("businesses").select("id",{count:"exact",head:true}).eq("owner_id",user.id),
      supabase.from("properties").select("id",{count:"exact",head:true}).eq("owner_id",user.id),
      supabase.from("activity_clubs").select("id",{count:"exact",head:true}).eq("manager_id",user.id),
      supabase.from("events").select("id",{count:"exact",head:true}).eq("manager_id",user.id)
    ]);

    setListings({
      businesses:businessCount.count || 0,
      properties:propertyCount.count || 0,
      activity_clubs:clubCount.count || 0,
      events:eventCount.count || 0
    });

    setLoading(false);
  },[]);

  useFocusEffect(useCallback(()=>{load();},[load]));

  async function savePrivacy(){
    if(showArea && !area.trim()){
      showFeedback("Add a town or area before choosing to display it publicly.","error");
      return;
    }

    setSavingPrivacy(true);

    const {data:{user}}=await supabase.auth.getUser();
    if(!user){router.replace("/auth/login");return;}

    const {data,error:updateError}=await supabase
      .from("profiles")
      .update({
        area:area.trim(),
        show_area:showArea,
        leaderboard_opt_in:leaderboardOptIn,
        visibility
      })
      .eq("id",user.id)
      .select();

    setSavingPrivacy(false);

    if(updateError){
      showFeedback(updateError.message,"error");
      return;
    }

    if(!data || data.length===0){
      showFeedback("Your privacy settings were not saved.","error");
      return;
    }

    showFeedback("Your privacy settings have been updated.");
  }

  // -------------------------------------------------------------------------
  // Becoming a manager, and stopping
  // -------------------------------------------------------------------------
  // Both go through a function in the database rather than an update from here,
  // for the same reason every other rule in this app does: the client asks, the
  // database decides, and there is one place to read what actually happens.

  async function becomeManager(){
    setWorkingManager(true);
    const {error:rpcError}=await supabase.rpc("become_manager");
    setWorkingManager(false);

    if(rpcError){
      showFeedback(rpcError.message,"error","Could not switch the tools on");
      return;
    }

    setConfirming(null);
    showFeedback(
      "You can list a business or property, and start an activity club or an event.",
      "success",
      "Manager tools are on"
    );
    await load();
  }

  async function stopManaging(listingChoice){
    setWorkingManager(true);
    const {data,error:rpcError}=await supabase.rpc("stop_managing",{p_listings:listingChoice});
    setWorkingManager(false);

    if(rpcError){
      showFeedback(rpcError.message,"error","Could not switch the tools off");
      return;
    }

    setConfirming(null);

    // Say what was actually done, using the numbers the function returned --
    // not the numbers this screen was holding before it ran.
    const unclaimed=Number(data?.unclaimed || 0);
    const removed=Number(data?.removed || 0);
    const parts=[];
    if(unclaimed) parts.push(`${unclaimed} left on the map with no owner`);
    if(removed) parts.push(`${removed} removed`);

    showFeedback(
      parts.length ? `${parts.join(", ")}.` : "You had nothing listed.",
      "success",
      "Manager tools are off"
    );
    await load();
  }

  function confirmPasswordReset(){
    if(!email){
      showFeedback("No email address is set on this account.","error");
      return;
    }

    Alert.alert(
      "Send a password reset link?",
      `We will email ${email} a link to set a new password. You will be signed out here, because a reset link must never open inside an existing session.`,
      [
        {text:"Cancel",style:"cancel"},
        {text:"Send link",onPress:sendReset}
      ]
    );
  }

  async function sendReset(){
    setSendingReset(true);

    try{
      await sendRecoveryEmail(supabase,email);
      showFeedback(`Check ${email} for a link to set a new password.`,"success","Reset link sent");
      router.replace("/auth/login");
    }catch(resetError){
      setSendingReset(false);
      showFeedback(resetError.message || "The reset email could not be sent.","error");
    }
  }

  function confirmLogout(){
    Alert.alert(
      "Log out?",
      "You will need to sign in again to use your Explorer profile.",
      [
        {text:"Cancel",style:"cancel"},
        {text:"Log out",style:"destructive",onPress:logout}
      ]
    );
  }

  async function logout(){
    await supabase.auth.signOut();
    router.replace("/");
  }

  // A manager is somebody with at least one capability switched on. There is no
  // account type to read -- 20260803120000 retired it -- so this IS the answer,
  // and it is the same column the insert policies check.
  const isManager=CAPABILITIES.some(({key})=>
    ENABLED_STATUSES.includes(capabilities?.[`${key}_status`])
  );

  // What they manage, as a sentence, so the confirmation names it rather than
  // saying "your listings" and leaving somebody to guess.
  const managedParts=[
    listings.businesses && `${listings.businesses} business${listings.businesses===1 ? "" : "es"}`,
    listings.properties && `${listings.properties} propert${listings.properties===1 ? "y" : "ies"}`,
    listings.activity_clubs && `${listings.activity_clubs} activity club${listings.activity_clubs===1 ? "" : "s"}`,
    listings.events && `${listings.events} event${listings.events===1 ? "" : "s"}`
  ].filter(Boolean);

  const managedSentence=managedParts.length
    ? `You manage ${managedParts.join(", ").replace(/, ([^,]*)$/," and $1")}.`
    : "You have nothing listed, so there is nothing to decide about — the tools just switch off.";

  if(loading){
    return <View style={styles.center}><ActivityIndicator size="large" color="#a58cff"/></View>;
  }

  if(error){
    return <View style={styles.center}><Text style={styles.errorText}>{error}</Text></View>;
  }

  return(
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>Your account, what you share, and how you sign in.</Text>

      <Text style={styles.sectionTitle}>Profile</Text>
      <Pressable style={styles.linkCard} onPress={()=>router.push("/profile/edit")}>
        <View style={styles.linkTextWrap}>
          <Text style={styles.linkTitle}>Edit profile</Text>
          <Text style={styles.linkText}>Your name, photo, bio and phone number.</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Privacy</Text>
      <Text style={styles.helpText}>Use a town or broad area only. Xplorer does not need your exact address.</Text>

      <TextInput
        style={styles.input}
        placeholder="Town or area, e.g. Hastings"
        placeholderTextColor="#888891"
        value={area}
        onChangeText={setArea}
        maxLength={100}
        editable={!savingPrivacy}
      />

      {/*
        The one audience control. It is not a location setting and is not named
        like one -- a setting called "location sharing" invites a second one
        called "post sharing" beside it, and then there is no single answer any
        more.
      */}
      <View style={styles.settingBlock}>
        <Text style={styles.settingTitle}>Your visibility</Text>
        <Text style={styles.settingText}>
          Who can see what you share, across the whole app. It starts at nobody and only you
          can change it.
        </Text>
        <View style={styles.choiceRow}>
          {VISIBILITY_CHOICES.map((choice)=>(
            <Pressable
              key={choice.key}
              accessibilityRole="radio"
              accessibilityState={{checked:visibility===choice.key}}
              accessibilityLabel={choice.sentence}
              style={[styles.choice,visibility===choice.key && styles.choiceActive]}
              onPress={()=>setVisibility(choice.key)}
              disabled={savingPrivacy}
            >
              <Text style={[styles.choiceTitle,visibility===choice.key && styles.choiceTitleActive]}>{choice.label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.settingText}>
          {VISIBILITY_CHOICES.find((choice)=>choice.key===visibility)?.sentence}
        </Text>
      </View>

      <View style={styles.settingRow}>
        <View style={styles.settingTextWrap}>
          <Text style={styles.settingTitle}>Display my area</Text>
          <Text style={styles.settingText}>Shows your chosen town or area on your public profile and local leaderboard.</Text>
        </View>
        <Switch value={showArea} onValueChange={setShowArea} disabled={savingPrivacy}/>
      </View>

      <View style={styles.settingRow}>
        <View style={styles.settingTextWrap}>
          <Text style={styles.settingTitle}>Appear on the leaderboard</Text>
          <Text style={styles.settingText}>Turn this off to keep earning your Explorer Score without appearing in the public ranking.</Text>
        </View>
        <Switch value={leaderboardOptIn} onValueChange={setLeaderboardOptIn} disabled={savingPrivacy}/>
      </View>

      <Pressable
        style={[styles.primaryButton,savingPrivacy && styles.disabled]}
        onPress={savePrivacy}
        disabled={savingPrivacy}
      >
        <Text style={styles.primaryText}>{savingPrivacy ? "Saving..." : "Save privacy settings"}</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Managing places</Text>
      <Text style={styles.helpText}>
        There is no separate manager account. A manager is an Explorer with the
        tools switched on, and you can switch them on and off yourself.
      </Text>

      <View style={styles.capabilityCard}>
        {CAPABILITIES.map(({key,label})=>(
          <CapabilityRow
            key={key}
            label={label}
            status={capabilities?.[`${key}_status`]}
          />
        ))}
      </View>

      {/*
        The confirmations are drawn here, in the page, rather than as system
        dialogs. Not because Alert is broken -- FeedbackProvider swaps in a
        working one on web -- but because the downgrade is not a yes/no: it is a
        choice between two outcomes that each need a sentence of explanation,
        and neither fits on a system button.
      */}
      {!isManager && confirming!=="become" && (
        <Pressable
          style={styles.primaryButton}
          accessibilityRole="button"
          accessibilityLabel="Become a manager"
          onPress={()=>setConfirming("become")}
        >
          <Text style={styles.primaryText}>Become a manager</Text>
        </Pressable>
      )}

      {!isManager && confirming==="become" && (
        <View style={styles.confirmCard}>
          <Text style={styles.confirmTitle}>Are you sure?</Text>
          <Text style={styles.confirmText}>
            You will be able to list a business or a property, and start an
            activity club or an event. Your account does not change and nothing
            about your profile changes — it is the same Explorer with more tools.
          </Text>
          <Text style={styles.confirmText}>
            This does not give you anybody else&apos;s business. Taking over a
            place that is already listed is a claim, and an administrator decides
            those.
          </Text>
          <Text style={styles.confirmText}>You can switch it off again here whenever you want.</Text>

          <View style={styles.confirmRow}>
            <Pressable
              style={[styles.confirmYes,workingManager && styles.disabled]}
              accessibilityRole="button"
              accessibilityLabel="Yes, switch the manager tools on"
              disabled={workingManager}
              onPress={becomeManager}
            >
              <Text style={styles.confirmYesText}>{workingManager ? "Working..." : "Yes, switch them on"}</Text>
            </Pressable>
            <Pressable
              style={styles.confirmNo}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              disabled={workingManager}
              onPress={()=>setConfirming(null)}
            >
              <Text style={styles.confirmNoText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      )}

      {isManager && (
        <Pressable style={styles.linkCard} onPress={()=>router.push("/manager/dashboard")}>
          <View style={styles.linkTextWrap}>
            <Text style={styles.linkTitle}>Open manager dashboard</Text>
            <Text style={styles.linkText}>Your listings, and everything you manage.</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      )}

      {isManager && confirming!=="stop" && (
        <Pressable
          style={styles.stopManagingButton}
          accessibilityRole="button"
          accessibilityLabel="Stop being a manager"
          onPress={()=>setConfirming("stop")}
        >
          <Text style={styles.stopManagingText}>Stop being a manager</Text>
        </Pressable>
      )}

      {isManager && confirming==="stop" && (
        <View style={styles.confirmCard}>
          <Text style={styles.confirmTitle}>What happens to what you manage?</Text>
          <Text style={styles.confirmText}>{managedSentence}</Text>

          {(listings.activity_clubs>0 || listings.events>0) && (
            <Text style={styles.confirmWarning}>
              A club or an event always belongs to somebody, so there is no way to
              leave one behind without an owner. Either way you choose, your
              {listings.activity_clubs>0 ? ` ${listings.activity_clubs} club${listings.activity_clubs===1 ? "" : "s"}` : ""}
              {listings.activity_clubs>0 && listings.events>0 ? " and" : ""}
              {listings.events>0 ? ` ${listings.events} event${listings.events===1 ? "" : "s"}` : ""}
              {" "}will be removed.
            </Text>
          )}

          <Pressable
            style={[styles.choiceCard,workingManager && styles.disabled]}
            accessibilityRole="button"
            accessibilityLabel="Leave my businesses and properties on the map with no owner"
            disabled={workingManager}
            onPress={()=>stopManaging("unclaim")}
          >
            <Text style={styles.choiceTitle}>Leave them unclaimed</Text>
            <Text style={styles.choiceText}>
              Your businesses and properties stay on the map with nobody managing
              them, exactly like every place nobody has claimed yet. Their reviews
              and photos stay. Somebody else can claim them later — including you.
            </Text>
          </Pressable>

          <Pressable
            style={[styles.choiceCard,styles.choiceDanger,workingManager && styles.disabled]}
            accessibilityRole="button"
            accessibilityLabel="Delete everything I manage"
            disabled={workingManager}
            onPress={()=>stopManaging("delete")}
          >
            <Text style={styles.choiceTitle}>Delete them</Text>
            <Text style={styles.choiceText}>
              Everything you manage comes off the map, along with its reviews. This
              cannot be undone. Moments and Memories other Explorers took there are
              theirs and are kept — they just stop being attached to a place.
            </Text>
          </Pressable>

          <Pressable
            style={styles.confirmNo}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            disabled={workingManager}
            onPress={()=>setConfirming(null)}
          >
            <Text style={styles.confirmNoText}>{workingManager ? "Working..." : "Cancel, keep managing"}</Text>
          </Pressable>
        </View>
      )}

      <Text style={styles.sectionTitle}>Safety</Text>
      <Pressable style={styles.linkCard} onPress={()=>router.push("/safety/blocked")}>
        <View style={styles.linkTextWrap}>
          <Text style={styles.linkTitle}>Blocked Explorers</Text>
          <Text style={styles.linkText}>People you have blocked, and where to unblock them.</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Sign in</Text>
      <Pressable
        style={[styles.secondaryButton,sendingReset && styles.disabled]}
        onPress={confirmPasswordReset}
        disabled={sendingReset}
      >
        <Text style={styles.secondaryText}>{sendingReset ? "Sending..." : "Send me a password reset link"}</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Account</Text>
      <Pressable style={styles.dangerButton} onPress={confirmLogout}>
        <Text style={styles.primaryText}>Log out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:"#18181b"},
  content:{padding:22,paddingBottom:70},
  center:{flex:1,backgroundColor:"#18181b",alignItems:"center",justifyContent:"center",padding:40},
  title:{color:"white",fontSize:31,fontWeight:"900"},
  subtitle:{color:"#aaaab3",fontSize:15,lineHeight:22,marginTop:6},
  errorText:{color:"#ffb5bc",fontSize:16,fontWeight:"700",textAlign:"center",lineHeight:22},
  sectionTitle:{color:"white",fontSize:21,fontWeight:"900",marginTop:28,marginBottom:10},
  helpText:{color:"#9999a2",lineHeight:20,marginBottom:12},
  input:{backgroundColor:"#222226",borderColor:"#44444b",borderWidth:1,borderRadius:12,padding:14,color:"white",fontSize:16,marginBottom:13},
  settingRow:{backgroundColor:"#222226",borderColor:"#414147",borderWidth:1,borderRadius:14,padding:15,flexDirection:"row",alignItems:"center",marginBottom:11},
  settingTextWrap:{flex:1,paddingRight:12},
  settingTitle:{color:"white",fontWeight:"900",fontSize:16},
  settingText:{color:"#9999a2",fontSize:12,lineHeight:18,marginTop:4},
  linkCard:{backgroundColor:"#222226",borderColor:"#414147",borderWidth:1,borderRadius:14,padding:15,flexDirection:"row",alignItems:"center",marginBottom:11},
  linkTextWrap:{flex:1,paddingRight:12},
  linkTitle:{color:"white",fontWeight:"900",fontSize:16},
  linkText:{color:"#9999a2",fontSize:12,lineHeight:18,marginTop:4},
  chevron:{color:"#85858e",fontSize:26,fontWeight:"900"},
  settingBlock:{paddingVertical:14,borderBottomWidth:1,borderBottomColor:"#2c2c33"},
  choiceRow:{flexDirection:"row",gap:8,marginTop:11,marginBottom:9},
  choice:{flex:1,backgroundColor:"#25252a",borderColor:"#44444c",borderWidth:1,borderRadius:11,paddingVertical:11,alignItems:"center"},
  choiceActive:{backgroundColor:"#2d2152",borderColor:"#644be0"},
  choiceTitle:{color:"#aaaab3",fontWeight:"800",fontSize:12},
  choiceTitleActive:{color:"white"},
  confirmCard:{backgroundColor:"#1e1e22",borderColor:"#3a3a42",borderWidth:1,borderRadius:14,padding:16,marginBottom:11},
  confirmTitle:{color:"#f4f4f8",fontSize:17,fontWeight:"900",marginBottom:8},
  confirmText:{color:"#b9b9c4",fontSize:13,lineHeight:19,marginBottom:8},
  confirmWarning:{color:"#f0c36d",fontSize:13,lineHeight:19,marginBottom:10,fontWeight:"700"},
  confirmRow:{flexDirection:"row",gap:10,marginTop:4},
  confirmYes:{flex:1,backgroundColor:"#3212b6",borderRadius:12,paddingVertical:13,alignItems:"center"},
  confirmYesText:{color:"white",fontWeight:"900",fontSize:14},
  confirmNo:{flex:1,backgroundColor:"#2b2b31",borderColor:"#4a4a55",borderWidth:1,borderRadius:12,paddingVertical:13,alignItems:"center"},
  confirmNoText:{color:"#d5d5dc",fontWeight:"800",fontSize:14},
  choiceCard:{backgroundColor:"#26262c",borderColor:"#43434e",borderWidth:1,borderRadius:12,padding:14,marginBottom:10},
  choiceDanger:{borderColor:"#7a2a24"},
  choiceTitle:{color:"#f4f4f8",fontSize:15,fontWeight:"900",marginBottom:5},
  choiceText:{color:"#b9b9c4",fontSize:13,lineHeight:19},
  // Named for what it is rather than "danger": there is already a dangerButton
  // further down this same StyleSheet, and a duplicate key in an object literal
  // silently keeps the LAST one -- so this button would have quietly worn the
  // wrong style.
  stopManagingButton:{backgroundColor:"#3a1c18",borderColor:"#7a2a24",borderWidth:1,borderRadius:12,paddingVertical:14,alignItems:"center",marginBottom:11},
  stopManagingText:{color:"#f0a79c",fontWeight:"900",fontSize:14},
  capabilityCard:{backgroundColor:"#1e1e22",borderColor:"#3a3a42",borderWidth:1,borderRadius:14,padding:6,marginBottom:11},
  capabilityRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:10,paddingVertical:9},
  capabilityLabel:{color:"#d5d5dc",fontSize:14,fontWeight:"700"},
  capabilityPill:{fontSize:11,fontWeight:"900",overflow:"hidden",borderRadius:8,paddingHorizontal:9,paddingVertical:4,textTransform:"uppercase"},
  pillOn:{backgroundColor:"#123f2c",color:"#7fe0ab"},
  pillOff:{backgroundColor:"#33333a",color:"#9999a2"},
  primaryButton:{backgroundColor:"#3212b6",padding:16,borderRadius:13,alignItems:"center",marginTop:8},
  primaryText:{color:"white",fontWeight:"900",fontSize:16},
  secondaryButton:{borderColor:"#66529e",borderWidth:1,borderRadius:13,padding:16,alignItems:"center"},
  secondaryText:{color:"#d7cdf5",fontWeight:"900",fontSize:16},
  dangerButton:{backgroundColor:"#b42318",padding:16,borderRadius:13,alignItems:"center"},
  disabled:{opacity:0.55}
});

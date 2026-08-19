import React,{useCallback,useState} from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking
} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../services/supabase";
import {useFeedback} from "../context/FeedbackContext";
import {sendRecoveryEmail} from "../utils/passwordRecovery";
import {
  ATTRIBUTION,
  ATTRIBUTION_COPYRIGHT,
  ATTRIBUTION_URL,
  STYLE_CHOICES
} from "../utils/mapProvider";
import {
  RADIUS_CHOICES,
  mapPreferences,
  setMapPreferences
} from "../utils/mapPreferences";
import {PUSH_CATEGORIES} from "../utils/pushCategories";
import {
  captureCopyIsSupported,
  defaultCapturePreferences,
  loadCapturePreferences,
  saveCapturePreferences,
  VIDEO_QUALITIES
} from "../utils/capturePreferences";
import {
  enablePushOnThisDevice,
  forgetThisDevice,
  loadPushPreferences,
  noPushes,
  pushIsSupported,
  savePushPreferences
} from "../utils/push";
import {INK,TYPE,SHAPE} from "../utils/tokens";
import {
  Action,
  Chip,
  Dial,
  Field,
  fieldInputStyle,
  KeyValue,
  MONO,
  Notice,
  Panel,
  Row,
  Screen,
  ScreenTitle,
  SectionRule,
  Segmented,
  Toggle,
  TickScale
} from "../components/instrument";
import {CREATE_HUB_CLEARANCE} from "../components/CreateHub";

const CAPABILITIES=[
  {key:"businesses",label:"Businesses"},
  {key:"properties",label:"Properties"},
  {key:"activity_clubs",label:"Activity clubs"},
  {key:"events",label:"Events"}
];

const ENABLED_STATUSES=["active","trial"];

// A capability's status is a stated fact about this account, so it is a mono
// definition line -- label, etched leader, value -- rather than a coloured pill.
// The old green pill spent `agree` on it, and `agree` is a manager replying to a
// review and nothing else (docs/design-system.md). An inactive one simply reads
// fainter; it is not an error and does not get an error's colour.
function CapabilityRow({label,status}){
  const enabled=ENABLED_STATUSES.includes(status);

  return(
    <KeyValue
      label={label}
      value={status || "inactive"}
      tone={enabled ? undefined : "readoutFaint"}
    />
  );
}

// THE FIVE TIERS.
//
// SectionRule marks a section; a tier is a whole zone of them, so it needs to
// read heavier without becoming a second heading style. It is the same ticked
// rule ScreenTitle draws under a page title -- the instrument's own divider,
// reused, rather than a 2px black bar borrowed from the print system.
function TierRule({label}){
  return(
    <View style={styles.tier}>
      <Text style={styles.tierLabel}>{label}</Text>
      <View style={styles.tierRule}>
        <TickScale width={64} height={9} count={9} majorEvery={4} colour={INK.hairlineStrong}/>
        <View style={styles.tierLine}/>
      </View>
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

  // WHO IS SIGNED IN, HELD WHERE THE HANDLERS CAN SEE IT.
  //
  // logout(), togglePushMaster() and togglePushCategory() all read `user?.id`,
  // and `user` was only ever destructured INSIDE load() -- so at runtime every
  // one of them threw a ReferenceError. Logging out was broken, and so was
  // every push toggle. No test caught it because they assert on the source
  // text rather than calling the handlers, and the optional chaining made it
  // look safe. The session is now held in state and set by load().
  const [user,setUser]=useState(null);
  const [loading,setLoading]=useState(true);

  // MAP & LOCATION. Two answers a person gives once and never again: which of
  // the three maps to open on, and how far "near me" reaches. Neither is a fact
  // about a person and neither decides who may see what, so neither is a
  // profiles column -- utils/mapPreferences.js says where they are kept and
  // what that costs.
  const [mapPrefs,setMapPrefs]=useState(()=>mapPreferences());

  function changeMap(next){
    setMapPrefs(setMapPreferences(next));
  }
  const [error,setError]=useState("");
  const [savingPrivacy,setSavingPrivacy]=useState(false);
  const [sendingReset,setSendingReset]=useState(false);
  const [deleteConfirm,setDeleteConfirm]=useState("");
  const [deleting,setDeleting]=useState(false);
  const [pushes,setPushes]=useState(noPushes);
  // Capture defaults. The viewfinder reads these; this is where they are set.
  const [captureDefaults,setCaptureDefaults]=useState(defaultCapturePreferences);
  // The word, exactly, and not while a delete is already running.
  const canDelete=deleteConfirm.trim().toUpperCase()==="DELETE" && !deleting;

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
    setUser(user);

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

    // A missing row means every category is off, which is what the database
    // defaults say and what loadPushPreferences returns.
    setPushes(await loadPushPreferences(user.id));
    // Same rule as the push row: a missing row means the defaults, and the
    // defaults are what the column defaults say.
    setCaptureDefaults(await loadCapturePreferences(user.id));

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
    // Take this device off the list first. Otherwise somebody's old phone --
    // or a shared one -- keeps buzzing with somebody else's messages after they
    // have signed out of it.
    await forgetThisDevice(user?.id);
    await supabase.auth.signOut();
    router.replace("/");
  }

  // The master switch is where the permission is asked for, because it is the
  // first moment somebody has said they want any of this.
  async function togglePushMaster(next){
    if(!next){
      const updated={...pushes,enabled:false};
      setPushes(updated);
      await savePushPreferences(user?.id,updated);
      return;
    }

    const {granted,error}=await enablePushOnThisDevice(user?.id);

    if(!granted){
      // A refusal is an answer, not a failure to retry. The switch goes back so
      // the screen tells the truth about what will happen.
      setPushes((current)=>({...current,enabled:false}));
      if(error) showFeedback(error,"error","Not turned on");
      else showFeedback("Your phone did not allow notifications. You can change that in your phone's settings.","error","Not turned on");
      return;
    }

    const updated={...pushes,enabled:true};
    setPushes(updated);
    const saved=await savePushPreferences(user?.id,updated);
    if(saved.error) showFeedback(saved.error,"error","Not saved");
  }

  // One writer for all three capture defaults: they live in one row, and three
  // separate savers would be three chances to write two of them.
  async function changeCaptureDefault(key,value){
    const updated={...captureDefaults,[key]:value};
    setCaptureDefaults(updated);
    const saved=await saveCapturePreferences(user?.id,updated);
    if(saved.error) showFeedback(saved.error,"error","Not saved");
  }

  async function togglePushCategory(key,next){
    const updated={...pushes,[key]:next};
    setPushes(updated);
    const saved=await savePushPreferences(user?.id,updated);
    if(saved.error) showFeedback(saved.error,"error","Not saved");
  }

  // DELETE, typed. Not a second "are you sure": somebody tapping through two
  // dialogues has not necessarily read either, and this is the one action in
  // the app that cannot be undone.
  async function deleteAccount(){
    if(!canDelete) return;

    setDeleting(true);
    const {error}=await supabase.rpc("delete_my_account");
    setDeleting(false);

    if(error){
      // The refusal is a real message with real numbers in it -- "hand over or
      // close what you manage first" -- so it is shown rather than replaced
      // with something generic.
      showFeedback(error.message || "Your account could not be deleted.","error","Not deleted");
      return;
    }

    // The row is gone; the session in memory is not.
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
    return(
      <Screen>
        <View style={styles.center}><ActivityIndicator size="large" color={INK.readout}/></View>
      </Screen>
    );
  }

  if(error){
    return(
      <Screen>
        <View style={styles.center}>
          <Notice tone="dispute" label="Not loaded">{error}</Notice>
        </View>
      </Screen>
    );
  }

  return(
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenTitle eyebrow="YOUR ACCOUNT" title="Account & Safety"/>
        <Text style={styles.lead}>Your account, what you share, and how you sign in.</Text>

        {/*
          FIVE TIERS, PER FINAL_PRODUCT_CONTRACT.md's Me -> Account & Safety
          entry: Profile / Notifications / Safety / Legal / Account. Every field,
          toggle and handler below is the one that was already on this screen;
          what changed is that they are kit parts now -- a Row per line, a
          SectionRule per group, a KeyValue for anything that is a stated fact.
        */}
        <TierRule label="Profile"/>
        <View style={styles.tierGap}/>

        <Row
          glyph="person"
          title="Edit profile"
          sub="Your name, photo, bio and phone number."
          onPress={()=>router.push("/profile/edit")}
        />

        <SectionRule label="Privacy"/>
        <Text style={styles.helpText}>Use a town or broad area only. Xplorer does not need your exact address.</Text>

        <Field label="Town or area" hint="A town or broad area, e.g. Hastings.">
          <TextInput
            style={fieldInputStyle}
            placeholder="Town or area, e.g. Hastings"
            placeholderTextColor={INK.readoutFaint}
            value={area}
            onChangeText={setArea}
            maxLength={100}
            editable={!savingPrivacy}
          />
        </Field>

        {/*
          The one audience control. It is not a location setting and is not named
          like one -- a setting called "location sharing" invites a second one
          called "post sharing" beside it, and then there is no single answer any
          more.

          The four choices were pills that filled with a state ink when chosen.
          exists/scheduled/offer say what a PLACE is; which audience you picked is
          not one of those, so a chosen choice steps a surface and strengthens its
          edge instead. The spoken label is still the whole sentence, and the
          radio role and checked state are unchanged -- the Chip draws the shape,
          the Pressable around it says what choosing it means.
        */}
        <Panel style={styles.visibility}>
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
                style={styles.choice}
                onPress={()=>setVisibility(choice.key)}
                disabled={savingPrivacy}
              >
                <Chip label={choice.label} selected={visibility===choice.key} style={styles.choiceChip}/>
              </Pressable>
            ))}
          </View>
          <Text style={styles.settingSentence}>
            {VISIBILITY_CHOICES.find((choice)=>choice.key===visibility)?.sentence}
          </Text>
        </Panel>

        {/* THE KIT'S TOGGLE, NOT THE PLATFORM SWITCH.
            A platform Switch brings iOS's and Android's own shape, its own
            green, and a filled track -- three things this design decides for
            itself. The instrument's answer is a bracketed tick on the housing:
            the whole row is the target, so the sentence explaining the claim is
            part of the control rather than a caption beside it. */}
        <Toggle
          label="Display my area"
          hint="Shows your chosen town or area on your public profile and local leaderboard."
          value={showArea}
          onChange={setShowArea}
          disabled={savingPrivacy}
        />

        <Toggle
          label="Appear on the leaderboard"
          hint="Turn this off to keep earning your Explorer Score without appearing in the public ranking."
          value={leaderboardOptIn}
          onChange={setLeaderboardOptIn}
          disabled={savingPrivacy}
        />

        <Action
          kind="primary"
          glyph="check"
          label={savingPrivacy ? "Saving..." : "Save privacy settings"}
          accessibilityLabel="Save privacy settings"
          disabled={savingPrivacy}
          onPress={savePrivacy}
          style={styles.savePrivacy}
        />

        {/*
          CAPTURE DEFAULTS.

          The locked spec's configuration rung for the camera: the three
          decisions somebody makes once and should never be asked about again
          while they are trying to take a picture. Everything else about the
          camera is on the camera; these three are here because they are
          preferences, not controls.

          utils/capturePreferences.js is the only file that reads or writes
          them, and components/CameraCapture.js obeys all three.
        */}
        <SectionRule label="Capture defaults"/>

        <Toggle
          glyph="grid"
          label="Grid overlay"
          hint="Draws a rule-of-thirds grid in the viewfinder. It is never in the picture."
          value={!!captureDefaults.grid}
          onChange={(next)=>changeCaptureDefault("grid",next)}
          accessibilityLabel="Show a grid in the viewfinder"
        />

        {captureCopyIsSupported() ? (
          <Toggle
            glyph="download"
            label="Keep a copy on this phone"
            hint="A capture lands in temporary storage the phone can clear. This copies it somewhere it will not be. It does not write to your photo library — that needs a module Xplorer does not include."
            value={!!captureDefaults.saveToLibrary}
            onChange={(next)=>changeCaptureDefault("saveToLibrary",next)}
            accessibilityLabel="Keep a copy of every capture on this phone"
          />
        ) : (
          <Text style={styles.helpText}>
            Keeping a copy of a capture only works on a phone. In a browser, a
            Moment or a Memory is uploaded and nothing is kept locally.
          </Text>
        )}

        <Field
          label="Video quality"
          hint="A phone that cannot record at the size you pick records at the highest it has."
        >
          <Segmented
            items={VIDEO_QUALITIES.map((quality)=>({
              key:quality.key,
              label:quality.label,
              accessibilityLabel:`Record video at ${quality.label}. ${quality.help}`
            }))}
            active={captureDefaults.videoQuality}
            onChange={(next)=>changeCaptureDefault("videoQuality",next)}
          />
        </Field>

        {/*
          NOTIFICATIONS TIER.

          PUSH NOTIFICATIONS, EVERY ONE OFF UNTIL SOMEBODY TURNS IT ON.

          The permission is asked for HERE, when a switch goes on -- never on
          launch. A push prompt on first open, before anybody knows what the app
          is, is how notifications get turned off for ever.

          Categories mirror the notifications that already exist rather than
          inventing a second vocabulary; utils/pushCategories.js is the list and
          scripts/verify-push.cjs checks it against the database. No quick-
          action toggle lives here -- that is fc-01, deferred pending a product
          decision, and this tier is push categories only, same as before.
        */}
        <TierRule label="Notifications"/>
        <SectionRule label="Notifications on your phone"/>
        {!pushIsSupported() ? (
          <Text style={styles.helpText}>
            Push notifications only work on a phone. Everything still appears in
            the app.
          </Text>
        ) : (
          <>
            <Toggle
              glyph="bell"
              label="Send me push notifications"
              hint="Off means off, whatever the switches below say."
              value={!!pushes.enabled}
              onChange={togglePushMaster}
              accessibilityLabel="Send me push notifications"
            />

            {PUSH_CATEGORIES.map((category)=>(
              <Toggle
                key={category.key}
                label={category.label}
                hint={category.help}
                value={!!pushes[category.key]}
                disabled={!pushes.enabled}
                onChange={(next)=>togglePushCategory(category.key,next)}
                accessibilityLabel={category.label}
              />
            ))}
          </>
        )}

        {/* SAFETY TIER. */}
        <TierRule label="Safety"/>
        <View style={styles.tierGap}/>
        <Row
          glyph="shield"
          title="Blocked Explorers"
          sub="People you have blocked, and where to unblock them."
          onPress={()=>router.push("/safety/blocked")}
        />

        {/*
          LEGAL TIER.

          Reachable from here and from sign-up, because a policy nobody can find
          is not a policy. Both are marked as drafts on the screen itself -- see
          the note in utils/legal.js.

          THE PERMANENT HOME OF THE MAP CREDIT.

          The map itself carries no attribution control any more -- both of
          MapLibre's are turned off in components/LivingMap.js and
          LivingMap.web.js. That is only defensible because the credit is still in
          the app, in two places that cannot be missed: the startup screen shows
          it for five seconds on every launch, and this section states it
          permanently with a link to the licence. If this section is ever
          deleted, the map has to get its credit back --
          test/map-attribution.test.js is what enforces that.
        */}
        {/*
          MAP & LOCATION.

          The locked spec's configuration level for the map: the default style,
          how far "near me" reaches, and the OpenStreetMap credit. All three in
          one group, because they are one subject -- somebody who has come here
          to change the map is the person most likely to want to know where the
          map comes from.

          THE ATTRIBUTION MOVED HERE. IT DID NOT SHRINK.

          The map itself carries no attribution control -- both of MapLibre's
          are turned off in components/LivingMap.js and LivingMap.web.js. That
          is only defensible because the credit is still in the app, in two
          places that cannot be missed: the startup screen shows it for five
          seconds on every launch, and this section states it permanently with a
          link to the licence. It is at reading size, on a panel of its own,
          with the link as a real 44px control. If this section is ever deleted,
          the map has to get its credit back -- test/map-attribution.test.js is
          what enforces that.
        */}
        <TierRule label="Map & location"/>
        <SectionRule label="Map defaults"/>
        <Text style={styles.helpText}>
          What the map opens on, and how far Live Nearby looks. Changing either
          takes effect straight away, including on a map already open.
        </Text>

        <Panel style={styles.mapCard}>
          <Text style={styles.mapLabel}>DEFAULT MAP STYLE</Text>
          <Segmented
            items={STYLE_CHOICES.map((choice)=>({
              key:choice.key,
              label:choice.label,
              accessibilityLabel:`${choice.label} map style. ${choice.sentence}`
            }))}
            active={mapPrefs.styleKey}
            onChange={(next)=>changeMap({styleKey:next})}
          />
          <Text style={styles.mapSentence}>
            {STYLE_CHOICES.find((choice)=>choice.key===mapPrefs.styleKey)?.sentence || ""}
          </Text>
        </Panel>

        <Panel style={styles.mapCard}>
          <Text style={styles.mapLabel}>DEFAULT LIVE-NEARBY RADIUS</Text>
          <Dial
            values={RADIUS_CHOICES}
            active={mapPrefs.radiusKm}
            onChange={(next)=>changeMap({radiusKm:next})}
            width={236}
            format={(value)=>`${value}KM`}
          />
          <Text style={styles.mapSentence}>
            Live Nearby opens looking {mapPrefs.radiusKm}km around you. You can still
            widen or narrow it on that screen.
          </Text>
        </Panel>

        <SectionRule label="About and licences"/>
        <Panel style={styles.licence}>
          <Text style={styles.licenceLabel}>MAP DATA</Text>
          <Text style={styles.licenceText}>{ATTRIBUTION}</Text>
          <Text style={styles.licenceText}>{ATTRIBUTION_COPYRIGHT}</Text>
          <Text style={styles.licenceSmall}>
            Xplorer&apos;s maps are built from OpenStreetMap, a free map of the
            world made by volunteers. The data is available under the Open
            Database Licence.
          </Text>
          <Pressable
            style={styles.licenceLink}
            accessibilityRole="link"
            accessibilityLabel="Open the OpenStreetMap copyright and licence page"
            onPress={()=>Linking.openURL(ATTRIBUTION_URL)}
          >
            <Text style={styles.licenceLinkText}>{ATTRIBUTION_URL}</Text>
          </Pressable>
        </Panel>

        <TierRule label="Legal"/>
        <SectionRule label="Privacy and terms"/>
        <Row
          glyph="lock"
          title="Privacy policy"
          sub="What Xplorer stores, who can see it, and how to get rid of it."
          onPress={()=>router.push("/legal/privacy")}
        />
        <Row
          glyph="clipboard"
          title="Terms"
          sub="What Xplorer is, and what is expected of everybody using it."
          onPress={()=>router.push("/legal/terms")}
        />

        {/*
          ACCOUNT TIER: whether you have manager tools switched on at all,
          signing in, and the account itself. Managing individual businesses,
          properties, clubs and events lives at Me -> My Places now -- this is
          the account-level switch that turns the capability on and off, which
          is a different question from what any one listing looks like.
        */}
        <TierRule label="Account"/>
        <SectionRule label="Managing places"/>
        <Text style={styles.helpText}>
          There is no separate manager account. A manager is an Explorer with the
          tools switched on, and you can switch them on and off yourself.
        </Text>

        <Panel style={styles.capabilityCard}>
          {CAPABILITIES.map(({key,label})=>(
            <CapabilityRow
              key={key}
              label={label}
              status={capabilities?.[`${key}_status`]}
            />
          ))}
        </Panel>

        {/*
          The confirmations are drawn here, in the page, rather than as system
          dialogs. Not because Alert is broken -- FeedbackProvider swaps in a
          working one on web -- but because the downgrade is not a yes/no: it is a
          choice between two outcomes that each need a sentence of explanation,
          and neither fits on a system button.
        */}
        {!isManager && confirming!=="become" && (
          <Action
            kind="secondary"
            glyph="key"
            label="Become a manager"
            onPress={()=>setConfirming("become")}
            style={styles.spaced}
          />
        )}

        {!isManager && confirming==="become" && (
          <Panel raised style={styles.confirmCard}>
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
              <Action
                kind="primary"
                glyph="check"
                label={workingManager ? "Working..." : "Yes, switch them on"}
                accessibilityLabel="Yes, switch the manager tools on"
                disabled={workingManager}
                onPress={becomeManager}
                style={styles.confirmButton}
              />
              <Action
                kind="quiet"
                label="Cancel"
                accessibilityLabel="Cancel"
                disabled={workingManager}
                onPress={()=>setConfirming(null)}
                style={styles.confirmButton}
              />
            </View>
          </Panel>
        )}

        {isManager && (
          <Row
            glyph="building"
            title="Open My Places"
            sub="Your listings, and everything you manage."
            onPress={()=>router.push("/manager/dashboard")}
          />
        )}

        {isManager && confirming!=="stop" && (
          <Action
            kind="secondary"
            glyph="minus"
            label="Stop being a manager"
            onPress={()=>setConfirming("stop")}
            style={styles.spaced}
          />
        )}

        {isManager && confirming==="stop" && (
          <Panel raised style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>What happens to what you manage?</Text>
            <Text style={styles.confirmText}>{managedSentence}</Text>

            {(listings.activity_clubs>0 || listings.events>0) && (
              <Notice tone="scheduled" label="This cannot be avoided">
                A club or an event always belongs to somebody, so there is no way to
                leave one behind without an owner. Either way you choose, your
                {listings.activity_clubs>0 ? ` ${listings.activity_clubs} club${listings.activity_clubs===1 ? "" : "s"}` : ""}
                {listings.activity_clubs>0 && listings.events>0 ? " and" : ""}
                {listings.events>0 ? ` ${listings.events} event${listings.events===1 ? "" : "s"}` : ""}
                {" "}will be removed.
              </Notice>
            )}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Leave my businesses and properties on the map with no owner"
              disabled={workingManager}
              onPress={()=>stopManaging("unclaim")}
              style={workingManager && styles.disabled}
            >
              <Row
                glyph="flag"
                title="Leave them unclaimed"
                sub="Your businesses and properties stay on the map with nobody managing them, exactly like every place nobody has claimed yet. Their reviews and photos stay. Somebody else can claim them later — including you."
              />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete everything I manage"
              disabled={workingManager}
              onPress={()=>stopManaging("delete")}
              style={workingManager && styles.disabled}
            >
              {/* No state ink on it. exists/scheduled/offer say what a PLACE
                  is and agree/dispute are a manager's two answers to a review;
                  a destructive choice is neither, and the danger here is carried
                  by the words, which say exactly what goes. */}
              <Row
                glyph="trash"
                title="Delete them"
                sub="Everything you manage comes off the map, along with its reviews. This cannot be undone. Moments and Memories other Explorers took there are theirs and are kept — they just stop being attached to a place."
              />
            </Pressable>

            <Action
              kind="quiet"
              label={workingManager ? "Working..." : "Cancel, keep managing"}
              accessibilityLabel="Cancel"
              disabled={workingManager}
              onPress={()=>setConfirming(null)}
            />
          </Panel>
        )}

        <SectionRule label="Sign in"/>
        <Action
          kind="secondary"
          glyph="mail"
          label={sendingReset ? "Sending..." : "Send me a password reset link"}
          accessibilityLabel="Send me a password reset link"
          disabled={sendingReset}
          onPress={confirmPasswordReset}
        />

        <Action
          kind="secondary"
          glyph="close"
          label="Log out"
          onPress={confirmLogout}
        />

        {/*
          DELETING YOUR ACCOUNT, FROM INSIDE THE APP.

          Apple and Google both require this before you can publish, and there was
          none. It is behind a typed confirmation rather than a second "are you
          sure": this is the one action in the app that cannot be undone, and a
          person tapping through two dialogues has not necessarily read either.

          What it does and what it keeps is decided in the database, not here --
          delete_my_account() (20260814020000). This screen only says so.
        */}
        <Panel raised style={styles.deleteCard}>
          <Text style={styles.confirmTitle}>Delete my account</Text>
          <Text style={styles.confirmText}>
            Everything you posted goes: your profile, your Moments, your Memories,
            your reviews, your photographs and your messages. What other people
            wrote stays — a review somebody left on a place is theirs, and a
            Link-up other people came to still happened.
          </Text>
          <Text style={styles.confirmText}>
            This cannot be undone. Type DELETE below to turn the button on.
          </Text>

          <Field label="Type DELETE to confirm">
            <TextInput
              style={fieldInputStyle}
              value={deleteConfirm}
              onChangeText={setDeleteConfirm}
              placeholder="DELETE"
              placeholderTextColor={INK.readoutFaint}
              autoCapitalize="characters"
              autoCorrect={false}
              accessibilityLabel="Type DELETE to confirm"
            />
          </Field>

          <Action
            kind="danger"
            glyph="trash"
            label={deleting ? "Deleting..." : "Delete my account for ever"}
            disabled={!canDelete}
            onPress={deleteAccount}
          />
        </Panel>
      </ScrollView>
    </Screen>
  );
}

const styles=StyleSheet.create({
  content:{paddingHorizontal:16,paddingBottom:24+CREATE_HUB_CLEARANCE},
  center:{flex:1,alignItems:"center",justifyContent:"center",padding:24},

  // A tier is a zone, not another heading: mono label over the same ticked rule
  // ScreenTitle draws, with enough air above it to read as a new part of the
  // instrument rather than the next line of the same list.
  tier:{marginTop:34,marginBottom:4},
  tierLabel:{
    color:INK.readout,
    fontFamily:MONO,
    fontSize:TYPE.data.sizes.lg,
    textTransform:"uppercase",
    letterSpacing:1.4
  },
  tierRule:{flexDirection:"row",alignItems:"flex-end",marginTop:8},
  tierLine:{flex:1,height:1,backgroundColor:INK.hairlineStrong},
  // A tier whose first child is a Row rather than a SectionRule has no rule
  // margin to sit under, so it gets the same air explicitly.
  tierGap:{height:12},

  // ScreenTitle's meta line is clamped to one line -- right for a place's
  // "2.4 KM · OPEN NOW", wrong for a sentence, which it silently truncates with
  // an ellipsis. Anything longer than a readout goes here instead.
  lead:{
    color:INK.readoutSoft,
    fontSize:TYPE.body.sizes.md,
    lineHeight:TYPE.body.sizes.md*TYPE.body.lineHeight,
    marginTop:-2,
    marginBottom:14
  },
  helpText:{
    color:INK.readoutSoft,
    fontSize:TYPE.body.sizes.md,
    lineHeight:TYPE.body.sizes.md*TYPE.body.lineHeight,
    marginBottom:12
  },

  visibility:{padding:14,marginBottom:8},
  settingTitle:{color:INK.readout,fontSize:TYPE.display.sizes.sm,fontWeight:"600",letterSpacing:-0.2},
  settingText:{
    color:INK.readoutSoft,
    fontSize:TYPE.body.sizes.sm,
    lineHeight:TYPE.body.sizes.sm*TYPE.body.lineHeight,
    marginTop:4
  },
  // The sentence a person reads back once they have chosen. It is the answer the
  // control gives, so it gets the readout rather than the soft metadata grey.
  settingSentence:{
    color:INK.readout,
    fontSize:TYPE.body.sizes.md,
    lineHeight:TYPE.body.sizes.md*TYPE.body.lineHeight,
    marginTop:4
  },
  choiceRow:{flexDirection:"row",flexWrap:"wrap",gap:6,marginTop:12,marginBottom:10},
  choice:{minHeight:SHAPE.tapTarget,justifyContent:"center"},
  choiceChip:{minHeight:36,paddingHorizontal:13},

  savePrivacy:{marginTop:6},
  spaced:{marginTop:8},
  disabled:{opacity:0.55},

  // MAP & LOCATION. Same panel as the licence below it, so the group reads as
  // one subject rather than a settings block with a legal notice stapled on.
  mapCard:{padding:15,marginTop:10},
  mapLabel:{
    color:INK.readoutSoft,
    fontFamily:MONO,
    fontSize:TYPE.data.sizes.sm,
    letterSpacing:1,
    textTransform:"uppercase",
    marginBottom:11
  },
  // A sentence somebody reads back once they have chosen, so it is the body
  // face. What they chose is a measurement and stays in mono, on the control.
  mapSentence:{
    color:INK.readoutSoft,
    fontSize:TYPE.body.sizes.sm,
    lineHeight:TYPE.body.sizes.sm*1.5,
    marginTop:12
  },

  licence:{padding:15},
  licenceLabel:{
    color:INK.readoutSoft,
    fontFamily:MONO,
    fontSize:TYPE.data.sizes.md,
    textTransform:"uppercase",
    letterSpacing:TYPE.data.tracking*TYPE.data.sizes.md,
    marginBottom:9
  },
  licenceText:{
    color:INK.readout,
    fontSize:TYPE.body.sizes.lg,
    lineHeight:TYPE.body.sizes.lg*TYPE.body.lineHeight
  },
  licenceSmall:{
    color:INK.readoutSoft,
    fontSize:TYPE.body.sizes.md,
    lineHeight:TYPE.body.sizes.md*TYPE.body.lineHeight,
    marginTop:9
  },
  licenceLink:{marginTop:11,minHeight:SHAPE.tapTarget,justifyContent:"center"},
  licenceLinkText:{
    color:INK.exists,
    fontFamily:MONO,
    fontSize:TYPE.data.sizes.md,
    letterSpacing:0.5,
    textDecorationLine:"underline"
  },

  capabilityCard:{paddingHorizontal:14,paddingVertical:4,marginBottom:11},

  confirmCard:{padding:15,marginTop:10,marginBottom:11},
  confirmTitle:{color:INK.readout,fontSize:TYPE.display.sizes.md,fontWeight:"700",letterSpacing:-0.3,marginBottom:9},
  confirmText:{
    color:INK.readoutSoft,
    fontSize:TYPE.body.sizes.md,
    lineHeight:TYPE.body.sizes.md*TYPE.body.lineHeight,
    marginBottom:9
  },
  confirmRow:{flexDirection:"row",gap:9,marginTop:4},
  confirmButton:{flex:1},

  deleteCard:{padding:15,marginTop:14}
});

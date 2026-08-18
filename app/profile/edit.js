import React,{useEffect,useState} from "react";
import {View,Text,TextInput,StyleSheet,Image,ScrollView,ActivityIndicator} from "react-native";
import * as ImagePicker from "expo-image-picker";
import {supabase} from "../../services/supabase";
import {router} from "expo-router";
import {useFeedback} from "../../context/FeedbackContext";
import {INK,TYPE,SHAPE} from "../../utils/tokens";
import {
  Action,
  Field,
  fieldInputStyle,
  Frame,
  MONO,
  Notice,
  Row,
  Screen,
  ScreenTitle,
  SectionRule
} from "../../components/instrument";
import {CREATE_HUB_CLEARANCE} from "../../components/CreateHub";

export default function EditProfile(){
  const {showFeedback}=useFeedback();

  const [name,setName]=useState("");
  const [phone,setPhone]=useState("");
  const [bio,setBio]=useState("");
  const [photo,setPhoto]=useState("");
  const [file,setFile]=useState(null);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");

  useEffect(()=>{loadProfile();},[]);

  async function loadProfile(){
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){
      router.replace("/auth/login");
      return;
    }

    const {data,error:profileError}=await supabase
      .from("profiles")
      .select("full_name,phone,bio,profile_photo")
      .eq("id",user.id)
      .single();

    if(profileError || !data){
      setError("Your profile could not be loaded.");
      setLoading(false);
      return;
    }

    setName(data.full_name || "");
    setPhone(data.phone || "");
    setBio(data.bio || "");
    setPhoto(data.profile_photo || "");
    setLoading(false);
  }

  async function pickImage(){
    setError("");
    const result=await ImagePicker.launchImageLibraryAsync({
      mediaTypes:ImagePicker.MediaTypeOptions.Images,
      allowsEditing:true,
      aspect:[1,1],
      quality:0.75
    });

    if(!result.canceled && result.assets?.[0]){
      setFile(result.assets[0]);
      setPhoto(result.assets[0].uri);
    }
  }

  async function saveProfile(){
    if(saving) return;
    setError("");

    if(!name.trim()){
      setError("Add your name before saving.");
      return;
    }

    setSaving(true);

    try{
      const {data:{user},error:userError}=await supabase.auth.getUser();
      if(userError || !user) throw new Error("You must be logged in to edit your profile.");

      let imageUrl=photo;
      if(file){
        const extension=(file.fileName?.split(".").pop() || file.mimeType?.split("/").pop() || "jpg").replace("jpeg","jpg");
        const response=await fetch(file.uri);
        if(!response.ok) throw new Error("The selected profile photo could not be read.");
        const bytes=await response.arrayBuffer();
        const filename=`${user.id}/profile-${Date.now()}.${extension}`;

        const {error:uploadError}=await supabase.storage
          .from("profile-images")
          .upload(filename,bytes,{
            contentType:file.mimeType || `image/${extension}`,
            upsert:true
          });
        if(uploadError) throw new Error(uploadError.message);

        const {data}=supabase.storage.from("profile-images").getPublicUrl(filename);
        imageUrl=data?.publicUrl || imageUrl;
      }

      const {data:saved,error:updateError}=await supabase
        .from("profiles")
        .update({
          full_name:name.trim(),
          phone:phone.trim(),
          bio:bio.trim(),
          profile_photo:imageUrl
        })
        .eq("id",user.id)
        .select();

      if(updateError) throw new Error(updateError.message);
      if(!saved || saved.length===0) throw new Error("Your profile was not saved.");

      showFeedback("Your profile has been updated.");
      router.back();
    }catch(saveError){
      console.error("Profile save error:",saveError);
      setError(saveError?.message || "Your profile could not be saved.");
    }finally{
      setSaving(false);
    }
  }

  if(loading){
    return(
      <Screen>
        <View style={styles.center}><ActivityIndicator size="large" color={INK.readout}/></View>
      </Screen>
    );
  }

  return(
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenTitle eyebrow="YOUR ACCOUNT" title="Edit profile"/>
        <Text style={styles.lead}>Control how your Xplorer profile appears to other people.</Text>

        {/* A refusal is an edge and a mono eyebrow, never a filled red box. */}
        {!!error && <Notice tone="dispute" label="Not saved">{error}</Notice>}

        {/*
          The photograph sits in the same bracketed Frame the viewfinder uses,
          which is what ties every picture in this app back to the camera that
          took it -- a soft circle on a card was the old system.
        */}
        <View style={styles.photoSection}>
          <Frame size={124} round style={styles.photoFrame}>
            {photo
              ? <Image source={{uri:photo}} style={styles.image}/>
              : <Text style={styles.imageLetter}>{name.charAt(0)?.toUpperCase() || "E"}</Text>}
          </Frame>
          <Action
            kind="secondary"
            glyph="camera"
            label="Choose profile photo"
            accessibilityLabel="Choose Profile Photo"
            disabled={saving}
            onPress={pickImage}
            style={styles.photoButton}
          />
        </View>

        <SectionRule label="About you"/>

        <Field label="Name" required>
          <TextInput
            style={fieldInputStyle}
            placeholder="Name"
            placeholderTextColor={INK.readoutFaint}
            value={name}
            onChangeText={setName}
            maxLength={80}
            editable={!saving}
          />
        </Field>

        <Field label="Phone">
          <TextInput
            style={fieldInputStyle}
            placeholder="Phone number"
            placeholderTextColor={INK.readoutFaint}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            editable={!saving}
          />
        </Field>

        <Field label="Bio">
          <TextInput
            style={[fieldInputStyle,styles.textarea]}
            placeholder="A short bio about you"
            placeholderTextColor={INK.readoutFaint}
            value={bio}
            onChangeText={setBio}
            multiline
            maxLength={300}
            editable={!saving}
          />
        </Field>
        {/* A character count is a figure the app worked out, so it is mono and
            it sits at the end of the well it counts rather than reading as a
            sentence under it. */}
        <Text style={styles.count}>{bio.length}/300</Text>

        <SectionRule label="Elsewhere"/>

        <Row
          glyph="settings"
          title="Area and privacy"
          sub="Your town, whether it is shown publicly, and leaderboard visibility now live in Settings."
          onPress={()=>router.push("/settings")}
        />

        <Action
          kind="primary"
          glyph="check"
          label="Save profile"
          accessibilityLabel="Save Profile"
          loading={saving}
          onPress={saveProfile}
          style={styles.save}
        />
      </ScrollView>
    </Screen>
  );
}

const styles=StyleSheet.create({
  content:{paddingHorizontal:16,paddingBottom:24+CREATE_HUB_CLEARANCE},
  center:{flex:1,alignItems:"center",justifyContent:"center"},

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
  photoSection:{alignItems:"center",marginTop:6,marginBottom:6},
  photoFrame:{backgroundColor:INK.inset},
  image:{width:124,height:124,borderRadius:SHAPE.radius.pill},
  imageLetter:{color:INK.readoutSoft,fontSize:44,fontWeight:"700"},
  photoButton:{marginTop:13},

  // The one hand-set dimension left on this screen: a bio needs room to be a
  // paragraph, and fieldInputStyle is sized for a single line.
  textarea:{minHeight:108,textAlignVertical:"top",paddingTop:11},
  count:{
    color:INK.readoutFaint,
    fontFamily:MONO,
    fontSize:TYPE.data.sizes.md,
    letterSpacing:0.5,
    textAlign:"right",
    marginTop:-11
  },

  save:{marginTop:18}
});

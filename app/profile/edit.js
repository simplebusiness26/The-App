import React,{useEffect,useState} from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Image,
  ScrollView,
  ActivityIndicator
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import {supabase} from "../../services/supabase";
import {router} from "expo-router";
import {useFeedback} from "../../context/FeedbackContext";

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
    return <View style={styles.center}><ActivityIndicator size="large" color="#a58cff"/></View>;
  }

  return(
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Edit Profile</Text>
      <Text style={styles.subtitle}>Control how your Guestbook profile appears to other people.</Text>

      {!!error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}

      <View style={styles.photoSection}>
        {photo ? <Image source={{uri:photo}} style={styles.image}/> : <View style={styles.imageFallback}><Text style={styles.imageLetter}>{name.charAt(0)?.toUpperCase() || "E"}</Text></View>}
        <Pressable style={styles.photoButton} onPress={pickImage} disabled={saving}>
          <Text style={styles.photoButtonText}>Choose Profile Photo</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>Name</Text>
      <TextInput style={styles.input} placeholder="Name" placeholderTextColor="#888891" value={name} onChangeText={setName} maxLength={80} editable={!saving}/>

      <Text style={styles.label}>Phone</Text>
      <TextInput style={styles.input} placeholder="Phone number" placeholderTextColor="#888891" keyboardType="phone-pad" value={phone} onChangeText={setPhone} editable={!saving}/>

      <Text style={styles.label}>Bio</Text>
      <TextInput style={styles.textarea} placeholder="A short bio about you" placeholderTextColor="#888891" value={bio} onChangeText={setBio} multiline maxLength={300} editable={!saving}/>
      <Text style={styles.characterCount}>{bio.length}/300</Text>

      <Pressable style={styles.settingRow} onPress={()=>router.push("/settings")}>
        <View style={styles.settingTextWrap}>
          <Text style={styles.settingTitle}>Area and privacy</Text>
          <Text style={styles.settingText}>Your town, whether it is shown publicly, and leaderboard visibility now live in Settings.</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <Pressable style={[styles.saveButton,saving && styles.disabled]} onPress={saveProfile} disabled={saving}>
        {saving ? <View style={styles.savingRow}><ActivityIndicator color="white"/><Text style={styles.saveText}>Saving profile...</Text></View> : <Text style={styles.saveText}>Save Profile</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:"#18181b"},
  content:{padding:22,paddingBottom:60},
  center:{flex:1,backgroundColor:"#18181b",alignItems:"center",justifyContent:"center"},
  title:{color:"white",fontSize:31,fontWeight:"900"},
  subtitle:{color:"#aaaab3",fontSize:15,lineHeight:22,marginTop:6,marginBottom:18},
  errorBox:{backgroundColor:"#3d171b",borderColor:"#83363d",borderWidth:1,borderRadius:12,padding:13,marginBottom:15},
  errorText:{color:"#ffb5bc",fontWeight:"700",lineHeight:20},
  photoSection:{alignItems:"center",marginBottom:22},
  image:{width:120,height:120,borderRadius:60,backgroundColor:"#303036"},
  imageFallback:{width:120,height:120,borderRadius:60,backgroundColor:"#3212b6",alignItems:"center",justifyContent:"center"},
  imageLetter:{color:"white",fontSize:44,fontWeight:"900"},
  photoButton:{borderColor:"#66529e",borderWidth:1,borderRadius:11,paddingHorizontal:18,paddingVertical:10,marginTop:12},
  photoButtonText:{color:"#d7cdf5",fontWeight:"900"},
  label:{color:"white",fontWeight:"900",fontSize:14,marginBottom:7},
  input:{backgroundColor:"#222226",borderColor:"#44444b",borderWidth:1,borderRadius:12,padding:14,color:"white",fontSize:16,marginBottom:15},
  textarea:{backgroundColor:"#222226",borderColor:"#44444b",borderWidth:1,borderRadius:12,padding:14,color:"white",fontSize:16,minHeight:105,textAlignVertical:"top"},
  characterCount:{color:"#85858e",fontSize:11,textAlign:"right",marginTop:5},
  sectionTitle:{color:"white",fontSize:21,fontWeight:"900",marginTop:25},
  helpText:{color:"#9999a2",lineHeight:20,marginTop:5,marginBottom:12},
  settingRow:{backgroundColor:"#222226",borderColor:"#414147",borderWidth:1,borderRadius:14,padding:15,flexDirection:"row",alignItems:"center",marginBottom:11},
  settingTextWrap:{flex:1,paddingRight:12},
  settingTitle:{color:"white",fontWeight:"900",fontSize:16},
  settingText:{color:"#9999a2",fontSize:12,lineHeight:18,marginTop:4},
  chevron:{color:"#85858e",fontSize:26,fontWeight:"900"},
  saveButton:{backgroundColor:"#3212b6",padding:17,borderRadius:13,alignItems:"center",marginTop:24},
  saveText:{color:"white",fontWeight:"900",fontSize:16,marginLeft:9},
  savingRow:{flexDirection:"row",alignItems:"center"},
  disabled:{opacity:0.55}
});

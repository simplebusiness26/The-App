import React,{useState,useCallback} from "react";

import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView
} from "react-native";

import {supabase} from "../../services/supabase";
import {classificationLabel} from "../../utils/taxonomy";

import {router} from "expo-router";

import {useFocusEffect} from "expo-router";

import QRCodeGenerator from "../../components/QRCodeGenerator";
import GateNotice from "../../components/GateNotice";
import {useManagerGate} from "../../hooks/useManagerGate";
import {INK} from "../../utils/tokens";

// Reached from Me -> My Places -> "Open Business Dashboard", once at least one
// business is enabled -- per FINAL_PRODUCT_CONTRACT.md's routeCoverage, this
// is the per-listing-row detail behind that capability card, not a screen
// with a skin of its own. useManagerGate still refuses a direct visit from
// somebody who manages nothing (see GateNotice).
export default function BusinessDashboard(){
  // Packet 4: entitlement is decided by public.manages_any_listing() in the
  // database, not by the drawer having hidden the row that leads here.
  const managerGate=useManagerGate();

  const [businesses,setBusinesses]=useState([]);
  const [status,setStatus]=useState("Loading...");

  useFocusEffect(
    useCallback(()=>{
      loadDashboard();
    },[])
  );

  async function loadDashboard(){
    setStatus("Loading...");

    const {data:{user}}=await supabase.auth.getUser();

    if(!user){
      setStatus("Please login");
      return;
    }

    const {data,error}=await supabase
      .from("businesses")
      .select("*")
      .eq("owner_id",user.id);

    if(error){
      console.log(error);
      setStatus("Error loading businesses");
      return;
    }

    setBusinesses(data || []);

    if(data.length){
      setStatus("Your Businesses");
    }else{
      setStatus("No business listings yet");
    }
  }

  if(!managerGate.allowed){
    return <GateNotice checking={managerGate.checking} message={managerGate.error}/>;
  }

  return(
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Business Dashboard</Text>
      <Text style={styles.subtitle}>{status}</Text>

      {businesses.length===0 && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            No businesses yet. Add your first business listing below.
          </Text>
        </View>
      )}

      {businesses.map((business)=>(
        <View key={business.id} style={styles.card}>
          <Text style={styles.name}>{business.name}</Text>
          <Text style={styles.cardSub}>{classificationLabel(business)}</Text>

          <View style={styles.qrSection}>
            <View style={styles.qrPreview}>
              <QRCodeGenerator businessId={business.id}/>
            </View>
            <Text style={styles.qrHint}>Customer QR code</Text>
          </View>

          <View style={styles.buttonRow}>
            <Pressable
              style={styles.secondaryButton}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${business.name}`}
              onPress={()=>router.push(`/business/edit/${business.id}`)}
            >
              <Text style={styles.secondaryButtonText}>Edit</Text>
            </Pressable>

            <Pressable
              style={styles.darkButton}
              accessibilityRole="button"
              accessibilityLabel={`View ${business.name}'s public profile`}
              onPress={()=>router.push(`/business/${business.id}`)}
            >
              <Text style={styles.buttonText}>Public profile</Text>
            </Pressable>
          </View>
        </View>
      ))}

      <Pressable
        style={styles.addButton}
        accessibilityRole="button"
        accessibilityLabel="Add a business listing"
        onPress={()=>router.push("/business/add")}
      >
        <Text style={styles.addButtonText}>➕ Add Business Listing</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  container:{flex:1,backgroundColor:INK.paper},
  content:{padding:20,paddingBottom:50},
  title:{fontSize:28,fontWeight:"900",color:INK.ink},
  subtitle:{fontSize:14,color:INK.inkSoft,marginTop:6,marginBottom:18},
  emptyCard:{backgroundColor:INK.card,borderColor:INK.hair,borderWidth:1.5,borderRadius:14,padding:18},
  emptyText:{color:INK.inkSoft,lineHeight:20},
  card:{backgroundColor:INK.card,borderColor:INK.ink,borderWidth:2,borderRadius:14,padding:16,marginTop:16,shadowColor:INK.ink,shadowOffset:{width:3,height:3},shadowOpacity:1,shadowRadius:0,elevation:0},
  name:{fontSize:19,fontWeight:"900",color:INK.ink},
  cardSub:{color:INK.inkSoft,fontSize:13,marginTop:4},
  qrSection:{flexDirection:"row",alignItems:"center",gap:14,marginTop:14,paddingTop:14,borderTopWidth:1.5,borderTopColor:INK.hair},
  qrPreview:{padding:6,backgroundColor:INK.card,borderRadius:8},
  qrHint:{color:INK.inkSoft,fontSize:12,flex:1},
  buttonRow:{flexDirection:"row",gap:10,marginTop:14},
  darkButton:{flex:1,backgroundColor:INK.ink,padding:13,borderRadius:10,alignItems:"center"},
  secondaryButton:{flex:1,backgroundColor:INK.card,borderColor:INK.ink,borderWidth:2,padding:13,borderRadius:10,alignItems:"center"},
  secondaryButtonText:{color:INK.ink,fontWeight:"800"},
  addButton:{backgroundColor:INK.blue,borderColor:INK.blue,borderWidth:2,padding:16,borderRadius:12,marginTop:22},
  addButtonText:{color:INK.card,textAlign:"center",fontWeight:"900"},
  buttonText:{color:INK.card,textAlign:"center",fontWeight:"800"}
});

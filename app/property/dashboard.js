import React,{useEffect,useState} from "react";

import {
  View,
  Text,
  StyleSheet,
  Pressable
} from "react-native";

import {supabase} from "../../services/supabase";

import {router} from "expo-router";

import QRCodeGenerator from "../../components/QRCodeGenerator";
import GateNotice from "../../components/GateNotice";
import {useManagerGate} from "../../hooks/useManagerGate";
import {INK} from "../../utils/tokens";

// Reached from Me -> My Places -> "Open Property Dashboard", once at least
// one property is enabled -- same per-listing-row template as the Business
// Dashboard, per FINAL_PRODUCT_CONTRACT.md's routeCoverage.
export default function PropertyDashboard(){
  // Packet 4: entitlement is decided by public.manages_any_listing() in the
  // database, not by the drawer having hidden the row that leads here.
  const managerGate=useManagerGate();

  const [properties,setProperties]=useState([]);
  const [status,setStatus]=useState("Loading...");

  useEffect(()=>{
    loadDashboard();
  },[]);

  async function loadDashboard(){
    const {data:{user}}=await supabase.auth.getUser();

    if(!user){
      setStatus("Please login");
      return;
    }

    // Get approved property claims
    const {data:claims,error:claimError}=await supabase
      .from("claims")
      .select("property_id")
      .eq("user_id",user.id)
      .eq("status","approved");

    if(claimError){
      console.log(claimError);
      setStatus("Error loading claims");
      return;
    }

    if(!claims || claims.length===0){
      setStatus("No property listings yet");
      return;
    }

    const ids=claims.map(item=>item.property_id);

    const {data,error}=await supabase
      .from("properties")
      .select("*")
      .in("id",ids);

    if(error){
      console.log(error);
      setStatus("Error loading properties");
      return;
    }

    setProperties(data || []);

    if(data.length){
      setStatus("Your Properties");
    }
  }

  if(!managerGate.allowed){
    return <GateNotice checking={managerGate.checking} message={managerGate.error}/>;
  }

  return(
    <View style={styles.container}>
      <Text style={styles.title}>Property Dashboard</Text>
      <Text style={styles.subtitle}>{status}</Text>

      {properties.length===0 && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            No properties yet. Add your first property listing below.
          </Text>
        </View>
      )}

      {properties.map(property=>(
        <View key={property.id} style={styles.card}>
          <Text style={styles.name}>{property.name}</Text>
          <Text style={styles.cardSub}>Hosted by {property.host || "—"}</Text>

          <View style={styles.qrSection}>
            <View style={styles.qrPreview}>
              <QRCodeGenerator propertyId={property.id}/>
            </View>
            <Text style={styles.qrHint}>Guest review QR code</Text>
          </View>

          <View style={styles.buttonRow}>
            <Pressable
              style={styles.secondaryButton}
              accessibilityRole="button"
              accessibilityLabel={`View ${property.name}'s public profile`}
              onPress={()=>router.push(`/property/${property.id}`)}
            >
              <Text style={styles.secondaryButtonText}>Public profile</Text>
            </Pressable>

            <Pressable
              style={styles.secondaryButton}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${property.name}`}
              onPress={()=>router.push(`/property/edit/${property.id}`)}
            >
              <Text style={styles.secondaryButtonText}>Edit</Text>
            </Pressable>
          </View>

          <Pressable
            style={styles.darkButton}
            accessibilityRole="button"
            accessibilityLabel={`Manage reviews for ${property.name}`}
            onPress={()=>router.push("/property/reviews")}
          >
            <Text style={styles.buttonText}>Manage Reviews</Text>
          </Pressable>
        </View>
      ))}

      <Pressable
        style={styles.addButton}
        accessibilityRole="button"
        accessibilityLabel="Add a property listing"
        onPress={()=>router.push("/property/add")}
      >
        <Text style={styles.addButtonText}>➕ Add Property Listing</Text>
      </Pressable>
    </View>
  );
}

const styles=StyleSheet.create({
  container:{flex:1,backgroundColor:INK.paper,padding:20,paddingBottom:50},
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
  darkButton:{backgroundColor:INK.ink,padding:13,borderRadius:10,marginTop:10,alignItems:"center"},
  secondaryButton:{flex:1,backgroundColor:INK.card,borderColor:INK.ink,borderWidth:2,padding:13,borderRadius:10,alignItems:"center"},
  secondaryButtonText:{color:INK.ink,fontWeight:"800"},
  addButton:{backgroundColor:INK.blue,borderColor:INK.blue,borderWidth:2,padding:16,borderRadius:12,marginTop:22},
  addButtonText:{color:INK.card,textAlign:"center",fontWeight:"900"},
  buttonText:{color:INK.card,textAlign:"center",fontWeight:"800"}
});

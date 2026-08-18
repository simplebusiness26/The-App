import React,{useEffect,useState} from "react";
import {View,Text,StyleSheet,ScrollView} from "react-native";
import {router} from "expo-router";

import {supabase} from "../../services/supabase";
import QRCodeGenerator from "../../components/QRCodeGenerator";
import GateNotice from "../../components/GateNotice";
import {CREATE_HUB_CLEARANCE} from "../../components/CreateHub";
import {useManagerGate} from "../../hooks/useManagerGate";
import {INK,TYPE,SHAPE} from "../../utils/tokens";
import {
  Action,
  Empty,
  KeyValue,
  MONO,
  Panel,
  ReadoutStrip,
  Screen,
  ScreenTitle,
  SectionRule
} from "../../components/instrument";

// Reached from Me -> My Places -> "Open Property Dashboard", once at least
// one property is enabled -- same per-listing-row template as the Business
// Dashboard, per FINAL_PRODUCT_CONTRACT.md's routeCoverage. Built from the same
// kit parts for the same reason: two dashboards hand-drawing the same plate is
// how they start disagreeing about what a listing looks like.
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
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ScreenTitle
          eyebrow="Manager"
          title="Property dashboard"
          meta={status}
        />

        <View style={styles.body}>
          <ReadoutStrip
            items={[
              {label:"Listings",value:String(properties.length)},
              {label:"Codes live",value:String(properties.length)}
            ]}
          />

          <SectionRule label="Your properties" meta={String(properties.length)}/>

          {properties.length===0 ? (
            <Empty
              glyph="bed"
              title="No properties yet"
              instruction="Add your first property listing and its guest review QR code is generated with it."
            />
          ) : properties.map((property)=>(
            <Panel key={property.id} style={styles.card}>
              <View style={styles.head}>
                <Text style={styles.headKind}>Property</Text>
                <View style={styles.headLine}/>
              </View>

              <Text style={styles.name} numberOfLines={2}>{property.name}</Text>

              <KeyValue label="Hosted by" value={property.host || "—"}/>

              <View style={styles.qrRow}>
                <QRCodeGenerator propertyId={property.id} size={104}/>
                <View style={styles.qrCopy}>
                  <Text style={styles.qrLabel}>Guest review QR code</Text>
                  <Text style={styles.qrHint}>
                    Guests scan this before they leave, and the review they write counts as a verified visit.
                  </Text>
                </View>
              </View>

              <View style={styles.buttons}>
                <Action
                  kind="secondary"
                  glyph="external"
                  label="Public profile"
                  accessibilityLabel={`View ${property.name}'s public profile`}
                  onPress={()=>router.push(`/property/${property.id}`)}
                  style={styles.button}
                />
                <Action
                  kind="secondary"
                  glyph="edit"
                  label="Edit"
                  accessibilityLabel={`Edit ${property.name}`}
                  onPress={()=>router.push(`/property/edit/${property.id}`)}
                  style={styles.button}
                />
              </View>

              <Action
                kind="secondary"
                glyph="comment"
                label="Manage reviews"
                accessibilityLabel={`Manage reviews for ${property.name}`}
                onPress={()=>router.push("/property/reviews")}
                style={styles.wide}
              />
            </Panel>
          ))}

          <Action
            kind="primary"
            glyph="plus"
            label="Add a property listing"
            accessibilityLabel="Add a property listing"
            onPress={()=>router.push("/property/add")}
            style={styles.add}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const MONO_META={fontFamily:MONO,textTransform:"uppercase",letterSpacing:0.9};

const styles=StyleSheet.create({
  scroll:{paddingBottom:CREATE_HUB_CLEARANCE+24},
  body:{paddingHorizontal:16},

  card:{padding:14,marginBottom:10},
  head:{flexDirection:"row",alignItems:"center",gap:9,marginBottom:9},
  headKind:{...MONO_META,color:INK.readoutSoft,fontSize:TYPE.data.sizes.md},
  headLine:{flex:1,height:1,backgroundColor:INK.hairline},
  name:{color:INK.readout,fontSize:TYPE.display.sizes.md,fontWeight:"700",letterSpacing:-0.3},

  qrRow:{
    flexDirection:"row",alignItems:"center",gap:14,marginTop:12,paddingTop:12,
    borderTopWidth:SHAPE.border,borderTopColor:INK.hairline
  },
  qrCopy:{flex:1,minWidth:0},
  qrLabel:{...MONO_META,color:INK.readout,fontSize:TYPE.data.sizes.md},
  qrHint:{
    color:INK.readoutSoft,fontSize:TYPE.body.sizes.sm,
    lineHeight:TYPE.body.sizes.sm*1.5,marginTop:5
  },

  buttons:{flexDirection:"row",gap:9,marginTop:12},
  button:{flex:1},
  wide:{marginTop:9},
  add:{marginTop:14}
});

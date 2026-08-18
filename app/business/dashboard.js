import React,{useState,useCallback} from "react";
import {View,Text,StyleSheet,ScrollView} from "react-native";
import {router,useFocusEffect} from "expo-router";

import {supabase} from "../../services/supabase";
import {classificationLabel} from "../../utils/taxonomy";
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

// Reached from Me -> My Places -> "Open Business Dashboard", once at least one
// business is enabled -- per FINAL_PRODUCT_CONTRACT.md's routeCoverage, this
// is the per-listing-row detail behind that capability card, not a screen
// with a skin of its own. useManagerGate still refuses a direct visit from
// somebody who manages nothing (see GateNotice).
//
// It is an instrument panel: a readout strip for the totals, an etched rule per
// group, and one machined plate per listing. The old version drew its own card
// with a 2px border and a hard offset shadow, which is what a listing looked
// like under the print system.
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
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ScreenTitle
          eyebrow="Manager"
          title="Business dashboard"
          meta={status}
        />

        <View style={styles.body}>
          <ReadoutStrip
            items={[
              {label:"Listings",value:String(businesses.length)},
              {label:"Codes live",value:String(businesses.length)}
            ]}
          />

          <SectionRule label="Your businesses" meta={String(businesses.length)}/>

          {businesses.length===0 ? (
            <Empty
              glyph="building"
              title="No businesses yet"
              instruction="Add your first business listing and its customer QR code is generated with it."
            />
          ) : businesses.map((business)=>(
            <Panel key={business.id} style={styles.card}>
              <View style={styles.head}>
                <Text style={styles.headKind}>Business</Text>
                <View style={styles.headLine}/>
              </View>

              <Text style={styles.name} numberOfLines={2}>{business.name}</Text>

              <KeyValue label="Classified" value={classificationLabel(business)}/>

              <View style={styles.qrRow}>
                <QRCodeGenerator businessId={business.id} size={104}/>
                <View style={styles.qrCopy}>
                  <Text style={styles.qrLabel}>Customer QR code</Text>
                  <Text style={styles.qrHint}>
                    Explorers scan this on site, and the review they leave counts as a verified visit.
                  </Text>
                </View>
              </View>

              <View style={styles.buttons}>
                <Action
                  kind="secondary"
                  glyph="edit"
                  label="Edit"
                  accessibilityLabel={`Edit ${business.name}`}
                  onPress={()=>router.push(`/business/edit/${business.id}`)}
                  style={styles.button}
                />
                <Action
                  kind="secondary"
                  glyph="external"
                  label="Public profile"
                  accessibilityLabel={`View ${business.name}'s public profile`}
                  onPress={()=>router.push(`/business/${business.id}`)}
                  style={styles.button}
                />
              </View>
            </Panel>
          ))}

          <Action
            kind="primary"
            glyph="plus"
            label="Add a business listing"
            accessibilityLabel="Add a business listing"
            onPress={()=>router.push("/business/add")}
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
  add:{marginTop:14}
});

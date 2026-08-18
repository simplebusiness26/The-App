import React,{useState} from "react";
import {View,Text,Pressable,ActivityIndicator,StyleSheet} from "react-native";
import * as Location from "expo-location";
import {LOCATION_DETAIL,roundLocation} from "../utils/places";
import {INK,SHAPE,TYPE} from "../utils/tokens";
import {Glyph,MONO,Notice} from "./instrument";

// Where a Moment or a Memory says it happened.
//
// WHY IT EXISTS
//
// A Memory had no location handling at all. app/memories/create.js never asked
// for one and never sent one, so a Memory that was not attached to a listing
// carried no coordinates and never appeared on the map -- the trigger in
// 20260805120300 only fills them in from an attached place. The owner: "the app
// needs to take your location coz that's how it knows where to put your moment
// on the map".
//
// A Moment could add one, but only at one precision, and only as a yes/no.
//
// THE PRIVACY RULES THIS FOLLOWS, WHICH ARE NOT NEGOTIABLE (RULES.md)
//
//   Nothing is on by default. Neither button is pre-selected, and touching
//   neither is a real answer: no coordinates are sent, and the database falls
//   back to the Explorer's own canonical area.
//
//   Never automatic. The permission is asked for when somebody presses a button
//   that says what it does, not on mount, and a refusal is a refusal.
//
//   It says which one it is using, in words, before it is used -- and after,
//   so a glance at a half-filled form still tells the truth.
//
//   The rounding happens HERE, on the device. A precise coordinate never leaves
//   it. The database rounds again on insert, which is the floor rather than the
//   protection.
//
// It does not invent a new word for an audience. Who can see the post is a
// separate question, answered by the audience control on the same screen; this
// only decides how precise the pin is.

export default function AddLocation({value,onChange,thing="Moment"}){
  const [working,setWorking]=useState("");
  const [problem,setProblem]=useState("");

  async function take(detail){
    setWorking(detail);
    setProblem("");

    try{
      const permission=await Location.requestForegroundPermissionsAsync();
      if(permission?.status!=="granted"){
        throw new Error(`Location permission was not granted, so this ${thing} will carry your area only.`);
      }

      const position=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced});
      const latitude=roundLocation(position?.coords?.latitude,detail);
      const longitude=roundLocation(position?.coords?.longitude,detail);

      // Half a coordinate is not a location -- the same rule the database
      // applies on insert.
      if(latitude===null || longitude===null) throw new Error("Your location could not be read.");

      onChange?.({latitude,longitude,detail});
    }catch(locationError){
      onChange?.(null);
      setProblem(locationError.message || "Your location could not be added.");
    }

    setWorking("");
  }

  const chosen=value?.detail || null;

  return(
    <View>
      {/* A field label, mono. It names a field; it is not a sentence. The
          "(optional)" half is a fact about the field, so it stays mono too --
          it used to be a lighter weight of the same body face, which read as an
          aside rather than as part of the label. */}
      <View style={styles.labelRow}>
        <Text style={styles.label}>LOCATION</Text>
        <Text style={styles.optional}>OPTIONAL</Text>
      </View>

      <View style={styles.row}>
        {[
          {
            detail:LOCATION_DETAIL.EXACT,
            title:"This spot",
            hint:"Roughly 100 metres"
          },
          {
            detail:LOCATION_DETAIL.AREA,
            title:"My area only",
            hint:"Roughly a kilometre"
          }
        ].map((option)=>{
          const active=chosen===option.detail;

          return(
            <Pressable
              key={option.detail}
              style={[styles.option,active && styles.optionActive]}
              disabled={!!working}
              accessibilityRole="button"
              accessibilityState={{selected:active}}
              accessibilityLabel={
                active
                  ? `Remove the location from this ${thing}`
                  : `Put this ${thing} on the map at ${option.title.toLowerCase()}, ${option.hint.toLowerCase()}`
              }
              onPress={()=>{
                if(active){onChange?.(null);setProblem("");return;}
                take(option.detail);
              }}
            >
              {working===option.detail
                ? <ActivityIndicator color={INK.readoutSoft}/>
                : (
                  <>
                    {/*
                      SELECTION IS A SURFACE STEP, NOT A FILL.
                      Both options used to fill with the compatibility alias
                      that is now the near-white readout colour, so the chosen
                      precision was the brightest thing on the form. A chosen
                      precision is not a state a place is in, so it takes no
                      state ink at all:
                      panel -> panelRaised, a stronger edge, a brighter label
                      and a drawn tick where the emoji tick used to be.
                    */}
                    <View style={styles.optionHead}>
                      {active ? <Glyph name="check" size={13} colour={INK.readout} weight={1.8}/> : null}
                      <Text style={[styles.optionTitle,active && styles.optionTitleActive]}>
                        {option.title.toUpperCase()}
                      </Text>
                    </View>
                    <Text style={[styles.optionHint,active && styles.optionHintActive]}>{option.hint}</Text>
                  </>
                )}
            </Pressable>
          );
        })}
      </View>

      {/* What happens to the coordinate, in words, before and after. This is a
          privacy control, so it reads as a sentence about people. */}
      <Text style={styles.hint}>
        {chosen===LOCATION_DETAIL.EXACT
          ? `Rounded to about 100 metres before it is sent. Tap again to take it off.`
          : chosen===LOCATION_DETAIL.AREA
            ? `Rounded to about a kilometre before it is sent, so it lands in your area rather than at your door. Tap again to take it off.`
            : `Choose neither and this ${thing} carries no coordinates at all — just your area, which nobody can see on the map.`}
      </Text>

      {!!problem && (
        <View accessibilityRole="alert" style={styles.problem}>
          <Notice tone="scheduled" label="NO LOCATION">{problem}</Notice>
        </View>
      )}
    </View>
  );
}

const MONO_META={fontFamily:MONO,letterSpacing:0.9,textTransform:"uppercase"};

const styles=StyleSheet.create({
  labelRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginTop:18,marginBottom:7},
  label:{...MONO_META,color:INK.readoutSoft,fontSize:TYPE.data.sizes.md},
  optional:{...MONO_META,color:INK.readoutFaint,fontSize:TYPE.data.sizes.sm},

  row:{flexDirection:"row",gap:10},
  option:{
    flex:1,minHeight:64,justifyContent:"center",alignItems:"center",gap:4,padding:10,
    backgroundColor:INK.panel,borderColor:INK.hairline,borderWidth:SHAPE.border,
    borderRadius:SHAPE.radius.control
  },
  optionActive:{backgroundColor:INK.panelRaised,borderColor:INK.hairlineStrong},
  optionHead:{flexDirection:"row",alignItems:"center",gap:6},
  optionTitle:{...MONO_META,color:INK.readoutSoft,fontSize:TYPE.data.sizes.md,textAlign:"center"},
  optionTitleActive:{color:INK.readout},
  optionHint:{
    color:INK.readoutFaint,fontSize:TYPE.body.sizes.sm,
    lineHeight:TYPE.body.sizes.sm*1.4,textAlign:"center"
  },
  optionHintActive:{color:INK.readoutSoft},

  hint:{
    color:INK.readoutFaint,fontSize:TYPE.body.sizes.sm,
    lineHeight:TYPE.body.sizes.sm*1.5,marginTop:9
  },
  problem:{marginTop:10}
});

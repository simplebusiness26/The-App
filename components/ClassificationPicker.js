import React from "react";
import {View,Text,Pressable,StyleSheet} from "react-native";
import {CATEGORIES,typesForCategory,UNCLASSIFIED} from "../utils/taxonomy";
import MarkerPreview from "./MarkerPreview";
import {INK} from "../utils/tokens";

// The only classification control in the app. It reads utils/taxonomy.js and
// nothing else, so the forms cannot drift from the database catalogue -- the
// pair it produces is the pair businesses_classification_fk enforces.
//
// Changing the category resets the type, because a type belongs to exactly one
// category and keeping the old one would submit a pair the database refuses.
export default function ClassificationPicker({
  category,
  businessType,
  onChange,
  disabled,
  claimed=true
}){
  const types=typesForCategory(category || UNCLASSIFIED);

  function selectCategory(nextCategory){
    if(nextCategory===category) return;
    onChange({category:nextCategory,businessType:UNCLASSIFIED});
  }

  function selectType(nextType){
    onChange({category:category || UNCLASSIFIED,businessType:nextType});
  }

  return(
    <View style={styles.wrap}>
      <Text style={styles.label}>Category *</Text>
      <View style={styles.chips}>
        {CATEGORIES.map((item)=>(
          <Pressable
            key={item.key}
            style={[styles.chip,category===item.key && styles.chipActive]}
            disabled={disabled}
            onPress={()=>selectCategory(item.key)}
          >
            <Text style={[styles.chipText,category===item.key && styles.chipTextActive]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Type</Text>
      <Text style={styles.help}>
        Only a few types exist so far. Pick &quot;Not yet classified&quot; if none fits — the
        category is still recorded.
      </Text>
      <View style={styles.chips}>
        {types.map((item)=>(
          <Pressable
            key={item.key}
            style={[styles.chip,businessType===item.key && styles.chipActive]}
            disabled={disabled}
            onPress={()=>selectType(item.key)}
          >
            <Text style={[styles.chipText,businessType===item.key && styles.chipTextActive]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <MarkerPreview
        category={category || UNCLASSIFIED}
        businessType={businessType || UNCLASSIFIED}
        claimed={claimed}
      />
    </View>
  );
}

const styles=StyleSheet.create({
  wrap:{marginBottom:15},
  label:{fontWeight:"900",fontSize:14,marginBottom:7,marginTop:6},
  help:{color:"#777",fontSize:12,lineHeight:17,marginBottom:8},
  chips:{flexDirection:"row",flexWrap:"wrap",gap:8},
  chip:{borderWidth:1,borderColor:INK.ink,borderRadius:18,paddingHorizontal:13,paddingVertical:8},
  chipActive:{backgroundColor:INK.blue,borderColor:INK.blue},
  chipText:{fontSize:13,fontWeight:"700",color:"#333"},
  chipTextActive:{color:"white"}
});

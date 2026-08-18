import React from "react";
import {View,StyleSheet} from "react-native";
import {CATEGORIES,typesForCategory,UNCLASSIFIED} from "../utils/taxonomy";
import MarkerPreview from "./MarkerPreview";
import {Chip,Field} from "./instrument";

// The only classification control in the app. It reads utils/taxonomy.js and
// nothing else, so the forms cannot drift from the database catalogue -- the
// pair it produces is the pair businesses_classification_fk enforces.
//
// Changing the category resets the type, because a type belongs to exactly one
// category and keeping the old one would submit a pair the database refuses.
//
// REBUILT ON THE KIT. It used to hand-roll two rows of 18px pills that filled
// with a state ink when selected -- `exists` spent on "this chip is chosen",
// which is not a state a place is in (docs/design-system.md). They are `Chip`s
// in a `Field` well now: selection steps the surface and strengthens the edge,
// the labels are mono because a category is something the app catalogues, and
// the asterisk in "Category *" is the kit's REQUIRED marker instead of
// punctuation a screen reader reads as a star.
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
    <View>
      <Field label="Category" required>
        <View style={styles.chips}>
          {CATEGORIES.map((item)=>(
            <Chip
              key={item.key}
              label={item.label}
              selected={category===item.key}
              disabled={disabled}
              onPress={()=>selectCategory(item.key)}
            />
          ))}
        </View>
      </Field>

      <Field
        label="Type"
        hint={"Only a few types exist so far. Pick “Not yet classified” if none fits — the category is still recorded."}
      >
        <View style={styles.chips}>
          {types.map((item)=>(
            <Chip
              key={item.key}
              label={item.label}
              selected={businessType===item.key}
              disabled={disabled}
              onPress={()=>selectType(item.key)}
            />
          ))}
        </View>
      </Field>

      <MarkerPreview
        category={category || UNCLASSIFIED}
        businessType={businessType || UNCLASSIFIED}
        claimed={claimed}
      />
    </View>
  );
}

const styles=StyleSheet.create({
  chips:{flexDirection:"row",flexWrap:"wrap",gap:8,padding:10}
});

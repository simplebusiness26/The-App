import React from "react";
import {View,Text,ScrollView,StyleSheet} from "react-native";
import DiscoverCard,{CARD_WIDTH} from "./DiscoverCard";
import {INK} from "../utils/tokens";

// One section of Discover, side to side instead of down the page.
//
// The owner: the lists "are too long". Seven sections of six stacked boxes is
// forty-two boxes and a very long scroll to reach the bottom one, so nobody
// ever did -- the sections below the fold may as well not have existed.
//
// Sideways, each section costs one card's height whatever is in it, and the
// section headings stay close enough together to be a menu.
//
// A plain horizontal ScrollView, snapped to the card pitch. No paging library:
// RULES.md says ask before adding a dependency, and there is nothing here worth
// asking for.

export default function DiscoverCarousel({title,items=[],empty,onSeeOnMap}){
  return(
    <View style={styles.section}>
      <View style={styles.head}>
        <Text style={styles.title}>{title}</Text>
        {items.length>0 && <Text style={styles.count}>{items.length}</Text>}
      </View>

      {items.length===0 ? (
        // An empty state is an instruction, not a mood (design-system.md).
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{empty}</Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          // Snapped, so a card never sits half off the edge looking broken.
          snapToInterval={CARD_WIDTH+CARD_GAP}
          decelerationRate="fast"
          contentContainerStyle={styles.row}
        >
          {items.map((item)=>(
            <DiscoverCard key={item.id} item={item} onSeeOnMap={onSeeOnMap}/>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const CARD_GAP=12;

const styles=StyleSheet.create({
  section:{marginTop:24},
  head:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:10},
  title:{fontSize:20,fontWeight:"800",color:INK.ink,letterSpacing:-0.3},
  count:{fontSize:12,fontWeight:"800",color:INK.inkSoft},
  empty:{borderTopWidth:2,borderTopColor:INK.hair,paddingTop:12},
  emptyText:{fontSize:13,lineHeight:19,color:INK.inkSoft},
  // Room on the right for the offset shadow, which is drawn outside the border.
  row:{gap:CARD_GAP,paddingRight:8,paddingBottom:6}
});

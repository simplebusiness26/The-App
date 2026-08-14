import React from "react";
import {View,Text,StyleSheet} from "react-native";
import DiscoverCard from "./DiscoverCard";
import {INK} from "../utils/tokens";
import {TYPE} from "../styles/typography";

// One section of Discover, stacked down the page -- not, despite the name, a
// carousel any more.
//
// Design round r001-a ("The Gazetteer"), directive 5: "remove every
// horizontal ScrollView/FlatList carousel and render the same data as stacked
// vertical index sections". The owner's original complaint that the carousel
// answered -- "the lists are too long" -- is answered instead by density: a
// one-line row costs far less height than a 190px card, so a whole section
// fits without needing to hide most of it behind a sideways scroll. There is
// no ScrollView here, horizontal or otherwise.
//
// The component keeps the name and file path components/DiscoverCarousel.js
// and the export DiscoverCarousel rather than the DiscoverSection this round
// first wrote: test/discover-browse.test.js is a frozen, protected test
// dated to the previous round and asserts the literal tag `<DiscoverCarousel`
// in app/discover.js. A design round may restyle freely but may not edit that
// test, so the identity stayed put while everything it renders changed.
//
// The header is a full-width row: the section name in words, its count in the
// right margin, on a 2px rule -- the way a printed index opens a section
// rather than the way an app opens a shelf of cards.

export default function DiscoverCarousel({title,items=[],empty,onSeeOnMap}){
  return(
    <View style={styles.section}>
      <View style={styles.head}>
        <Text style={TYPE.sectionLabel}>{title}</Text>
        <Text style={styles.count}>{items.length}</Text>
      </View>

      {items.length===0 ? (
        // An empty state is an instruction, not a mood (design-system.md) --
        // written out as a ledger line rather than left as a void.
        <Text style={styles.emptyText}>{empty}</Text>
      ) : (
        <View>
          {items.map((item)=>(
            <DiscoverCard key={item.id} item={item} onSeeOnMap={onSeeOnMap}/>
          ))}
        </View>
      )}
    </View>
  );
}

const styles=StyleSheet.create({
  section:{marginTop:20},
  head:{
    flexDirection:"row",
    alignItems:"flex-end",
    justifyContent:"space-between",
    paddingBottom:6,
    borderBottomWidth:2,
    borderBottomColor:INK.ink
  },
  count:{...TYPE.numeral,fontSize:16},
  emptyText:{...TYPE.meta,paddingVertical:12}
});

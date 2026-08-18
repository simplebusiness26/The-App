import React from "react";
import {View,ScrollView,StyleSheet} from "react-native";
import DiscoverCard,{CARD_WIDTH} from "./DiscoverCard";
import {Empty,SectionRule} from "./instrument";

// One section of Discover, side to side instead of down the page.
//
// The owner: the lists "are too long". Seven sections of six stacked boxes is
// forty-two boxes and a very long scroll to reach the bottom one, so nobody
// ever did -- the sections below the fold may as well not have existed.
//
// Sideways, each section costs one card's height whatever is in it, and the
// section headings stay close enough together to be a menu.
//
// THE HEADING IS A SECTION RULE NOW, NOT A DISPLAY HEADING WITH A LINE UNDER
// IT. A bare 20px heading with a bare count beside it is a document; an etched
// rule with a mono eyebrow and the count hung on the far end is an instrument
// reading out how many of a thing it found. Same information, and the count is
// no longer optional -- a section that measured zero says zero rather than
// hiding the number.
//
// A plain horizontal ScrollView, snapped to the card pitch. No paging library:
// RULES.md says ask before adding a dependency, and there is nothing here worth
// asking for. flexGrow:0/flexShrink:0 and a centred content container are not
// cosmetic -- without them a horizontal ScrollView inside a flex column claims
// every leftover pixel of height and stretches its cards to fill it.

export default function DiscoverCarousel({title,items=[],empty,onSeeOnMap}){
  return(
    <View style={styles.section}>
      <SectionRule label={title} meta={String(items.length)}/>

      {items.length===0 ? (
        // An empty state is an instruction, not a mood (design-system.md), so
        // the section's own copy is the instruction.
        //
        // COMPACT, BECAUSE THERE ARE SIX OF THESE IN ONE COLUMN. Discover
        // stacks a carousel per section, and on a brand-new account every one
        // of them is empty -- six full-size dials, each saying "No reading
        // yet", is about 3000px of the app apologising. Rendered and measured;
        // the compact row says the same thing in one line. The section's own
        // name is already directly above in the SectionRule, so the title here
        // says what is missing rather than repeating the heading.
        <Empty compact title="Nothing yet" instruction={empty} glyph="search"/>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          // Snapped, so a card never sits half off the edge looking broken.
          snapToInterval={CARD_WIDTH+CARD_GAP}
          decelerationRate="fast"
          style={styles.scroll}
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
  section:{marginBottom:4},
  scroll:{flexGrow:0,flexShrink:0},
  row:{gap:CARD_GAP,paddingRight:8,paddingBottom:4,alignItems:"center"}
});

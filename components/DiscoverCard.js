import React from "react";
import {View,Text,Pressable,StyleSheet} from "react-native";
import {router} from "expo-router";
import PlaceMarker from "./PlaceMarker";
import SocialImage from "./SocialImage";
import {INK} from "../utils/tokens";
import {TYPE} from "../styles/typography";

// One ledger row in a Discover section.
//
// WHAT THIS REPLACES
//
// An image-first carousel card: a photo, a half-height text overlay, a score
// badge and a map button, 240x190, six or seven of them scrolling sideways per
// section. The gazetteer round (design r001-a) replaces that with the same
// information as a one-line index entry -- a small bordered thumbnail, the
// name and type in text, and the distance in the right margin -- so the
// screen reads as an index of what is nearby rather than a wall of pictures.
//
// THE REASON IS STILL NOT OPTIONAL
//
// utils/discover.js drops any item it cannot compute a reason for, and
// scripts/verify-discover.cjs fails the build if a recommendation renders
// without one. It still renders here, as its own line -- a row with a blank
// line where the reason goes is an item that should never have reached the
// screen.
//
// NO STOCK PHOTOGRAPH. A manager who has uploaded nothing gets the same glyph
// its map pin uses, in the thumbnail's place. A generic image of somewhere
// else would be the app telling a small lie about a real place, every time.

export default function DiscoverCard({item,onSeeOnMap}){
  if(!item) return null;

  const score=item.rating;
  const hasPlace=Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude));
  const distanceKm=Number(item.distance_km);
  const hasDistance=Number.isFinite(distanceKm);

  return(
    <Pressable
      style={styles.row}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${item.reason}.`}
      onPress={()=>item.route && router.push(item.route)}
    >
      <View style={styles.thumb}>
        {item.image
          ? <SocialImage uri={item.image} style={styles.thumbImage} accessibilityIgnoresInvertColors/>
          : (!!item.marker && <PlaceMarker marker={item.marker} size={26}/>)
        }
      </View>

      <View style={styles.textCol}>
        <Text style={TYPE.rowTitle} numberOfLines={1}>{item.title}</Text>
        {!!item.subtitle && <Text style={TYPE.meta} numberOfLines={1}>{item.subtitle}</Text>}
        {/* The reason, which is never optional on this screen. */}
        <Text style={styles.reason} numberOfLines={1}>{item.reason}</Text>
      </View>

      <View style={styles.endCol}>
        <Text style={styles.distance} numberOfLines={1}>
          {hasDistance ? `${distanceKm} km` : "—"}
        </Text>
        {!!score?.count && (
          <Text
            style={styles.score}
            accessibilityLabel={`Rated ${score.average} out of 5 from ${score.count} reviews`}
          >
            ★ {score.average}
          </Text>
        )}
        {/* "A little map logo to see it on the map." Only when there is a
            place to see -- a Link-up with no coordinates has nothing to
            show. Stops the row's own press from also firing. */}
        {hasPlace && (
          <Pressable
            style={styles.mapButton}
            accessibilityRole="button"
            accessibilityLabel={`See ${item.title} on the map`}
            hitSlop={8}
            onPress={(event)=>{event?.stopPropagation?.();onSeeOnMap?.(item);}}
          >
            <Text style={styles.mapIcon}>◎</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

const styles=StyleSheet.create({
  row:{
    flexDirection:"row",
    alignItems:"center",
    minHeight:52,
    paddingVertical:8,
    gap:10,
    borderBottomWidth:1,
    borderBottomColor:INK.hair
  },
  thumb:{
    width:40,
    height:40,
    borderWidth:2,
    borderColor:INK.ink,
    backgroundColor:INK.card,
    alignItems:"center",
    justifyContent:"center",
    overflow:"hidden"
  },
  thumbImage:{width:"100%",height:"100%"},
  textCol:{flex:1},
  // The reason. Never optional -- see the note above.
  reason:{...TYPE.meta,color:INK.ink,fontWeight:"800",marginTop:1},
  endCol:{alignItems:"flex-end",gap:3},
  distance:{...TYPE.numeral,fontSize:14},
  score:{...TYPE.meta,color:INK.ink},
  mapButton:{
    width:24,
    height:24,
    borderRadius:4,
    alignItems:"center",
    justifyContent:"center",
    backgroundColor:INK.card,
    borderWidth:2,
    borderColor:INK.ink
  },
  mapIcon:{color:INK.ink,fontSize:12,fontWeight:"900",lineHeight:14}
});

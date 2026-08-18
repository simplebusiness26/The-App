import React from "react";
import {View,Text,TextInput,Pressable,ScrollView,StyleSheet} from "react-native";
import {INK,TYPE,SHAPE} from "../utils/tokens";
import {Glyph,MONO} from "./instrument";

// The map's controls, out of the way until somebody wants them.
//
// WHAT WAS THERE BEFORE
//
// A search box and TWO rows of chips, drawn permanently across the top of the
// map. In the owner's screenshots they cover a third of the screen, and one of
// them covers a photo bubble. Their words: "look at the logins and the buttons
// in the way -- put the search behind an icon button and same for the filters,
// have them so they can be hidden after as well."
//
// So the map opens clean. Two chips, matching the header's own chip
// (components/Header.js), so the top of the screen reads as one set of controls
// rather than a header plus a pile of map furniture.
//
//   Magnifier   opens the search field. Tap again and it goes.
//   Sliders     opens the filters. Tap again and they go.
//
// Both closed to start with, both toggles, and only one open at a time -- two
// panels stacked over a map is the thing this replaces.
//
// It decides nothing. Every filter value and setter comes from
// hooks/useLivingMap.js exactly as before; this is the surface they are drawn
// on and it could be swapped for another without the map noticing.

export const PANELS={NONE:null,SEARCH:"search",FILTERS:"filters"};

export default function MapControls({
  open,
  onOpen,
  search,
  onSearch,
  typeFilters=[],
  typeFilter,
  onTypeFilter,
  timeWindows=[],
  timeWindow,
  onTimeWindow,
  showLive,
  onShowLive,
  showPosts,
  onShowPosts,
  showHeat,
  onShowHeat,
  historical,
  onHistorical,
  // Public places (parks/beaches/viewpoints) have their own directory --
  // app/places/index.js -- and until now nothing on the restyled map could
  // reach it: the old drawer's "Explore > Public places" row was the only
  // door in, and Packet 21 removed the drawer. This is a third icon, not a
  // panel toggle -- pressing it leaves the map rather than opening a sheet
  // over it, so it calls straight through rather than going via `onOpen`.
  // This file still decides nothing: the screen owns the actual navigation.
  onOpenList
}){
  const toggle=(panel)=>onOpen?.(open===panel ? PANELS.NONE : panel);

  return(
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.chips} pointerEvents="box-none">
        <Pressable
          style={[styles.chip,open===PANELS.SEARCH && styles.chipOpen]}
          accessibilityRole="button"
          accessibilityState={{selected:open===PANELS.SEARCH}}
          accessibilityLabel={open===PANELS.SEARCH ? "Hide the search box" : "Search the map"}
          hitSlop={8}
          onPress={()=>toggle(PANELS.SEARCH)}
        >
          <Glyph name="search" size={17} colour={open===PANELS.SEARCH ? INK.readout : INK.readoutSoft} weight={1.6}/>
        </Pressable>

        <Pressable
          style={[styles.chip,open===PANELS.FILTERS && styles.chipOpen]}
          accessibilityRole="button"
          accessibilityState={{selected:open===PANELS.FILTERS}}
          accessibilityLabel={open===PANELS.FILTERS ? "Hide the map filters" : "Filter the map"}
          hitSlop={8}
          onPress={()=>toggle(PANELS.FILTERS)}
        >
          <Glyph name="filter" size={17} colour={open===PANELS.FILTERS ? INK.readout : INK.readoutSoft} weight={1.6}/>
        </Pressable>

        {/* Public places, as a flat list. Not a toggle -- there is nothing to
            hide again, it is a door to a screen the map does not have. */}
        {!!onOpenList && (
          <Pressable
            style={styles.chip}
            accessibilityRole="button"
            accessibilityLabel="See public places as a list"
            hitSlop={8}
            onPress={onOpenList}
          >
            <Glyph name="map" size={17} colour={INK.readoutSoft} weight={1.6}/>
          </Pressable>
        )}

        {/* What is currently narrowed, so a filter left on is never invisible.
            A map quietly hiding two thirds of itself is worse than a chip. */}
        {open===PANELS.NONE && !!activeLabel({typeFilters,typeFilter,historical}) && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{activeLabel({typeFilters,typeFilter,historical})}</Text>
          </View>
        )}
      </View>

      {open===PANELS.SEARCH && (
        <View style={styles.panel}>
          <TextInput
            style={styles.search}
            placeholder="Search businesses, stays or clubs..."
            placeholderTextColor={INK.readoutFaint}
            value={search}
            onChangeText={onSearch}
            accessibilityLabel="Search the map"
            autoFocus
            returnKeyType="search"
          />
          {!!search && (
            <Pressable
              style={styles.clear}
              accessibilityRole="button"
              accessibilityLabel="Clear the search"
              hitSlop={8}
              onPress={()=>onSearch?.("")}
            >
              <Glyph name="close" size={13} colour={INK.readoutSoft} weight={1.7}/>
            </Pressable>
          )}
        </View>
      )}

      {open===PANELS.FILTERS && (
        <View style={styles.panel}>
          {/*
            TWO QUESTIONS, ASKED SEPARATELY.

            It used to be one row of fifteen chips where "Activity Clubs" and
            "Tonight" sat side by side as if they were the same kind of choice.
            They are not: one is what sort of thing, the other is when.
          */}
          <Text style={styles.heading}>What</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {typeFilters.map(({key,label})=>(
              <Chip
                key={key}
                label={label}
                on={typeFilter===key}
                onPress={()=>onTypeFilter?.(key)}
                describe={`Show ${label}`}
              />
            ))}
          </ScrollView>

          <Text style={styles.heading}>When</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            <Chip
              label="Happening"
              on={showLive}
              onPress={()=>onShowLive?.(!showLive)}
              describe={showLive ? "Hide what is happening" : "Show what is happening"}
            />
            {timeWindows.map(({key,label})=>(
              <Chip
                key={key}
                label={label}
                on={showLive && timeWindow===key}
                disabled={!showLive}
                onPress={()=>onTimeWindow?.(key)}
                describe={`Show what is happening ${label.toLowerCase()}`}
              />
            ))}
          </ScrollView>

          <Text style={styles.heading}>Layers</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            <Chip
              label="Posts"
              on={showPosts}
              onPress={()=>onShowPosts?.(!showPosts)}
              describe={showPosts ? "Hide Moments and Memories" : "Show Moments and Memories"}
            />
            <Chip
              label="Busy"
              on={showHeat}
              onPress={()=>onShowHeat?.(!showHeat)}
              describe={showHeat ? "Hide busy areas" : "Show busy areas"}
            />
            {/*
              MEMORIES ONLY -- and the map becomes a history rather than a
              filter of the live one. It is in Layers rather than in What
              because it changes the whole map, not what is on it.
            */}
            <Chip
              label="Memories"
              on={historical}
              onPress={()=>onHistorical?.(!historical)}
              describe={historical ? "Leave the Memories timeline" : "Show Memories on a timeline"}
            />
          </ScrollView>
        </View>
      )}
    </View>
  );
}

function Chip({label,on,disabled,onPress,describe}){
  return(
    <Pressable
      style={[styles.filter,on && styles.filterOn,disabled && styles.filterOff]}
      accessibilityRole="button"
      accessibilityState={{selected:!!on,disabled:!!disabled}}
      accessibilityLabel={describe}
      disabled={disabled}
      onPress={onPress}
    >
      <Text style={on ? styles.filterTextOn : styles.filterText}>{label}</Text>
    </Pressable>
  );
}

// One short phrase for what is narrowed, or nothing at all when the map is
// showing everything.
function activeLabel({typeFilters,typeFilter,historical}){
  if(historical) return "Memories";
  if(!typeFilter || typeFilter==="all") return "";
  return typeFilters.find((entry)=>entry.key===typeFilter)?.label || "";
}

const styles=StyleSheet.create({
  wrap:{position:"absolute",left:10,right:10,zIndex:10},
  chips:{flexDirection:"row",alignItems:"center",gap:8},
  // MACHINED, NOT WHITE CIRCLES.
  //
  // These were 40px circles with a 2px INK.ink border -- and after the palette
  // moved, INK.ink is the near-white READOUT colour, so the map's three
  // controls rendered as three white rings holding the text characters
  // U+2315, U+2261 and U+25A4 standing in for icons. Both halves of that are
  // the print system surviving a recolour. They are now the instrument's own
  // control: a 6px-radius panel with a 1px hairline and a drawn glyph, which
  // is the same shape the header chips and every button in the kit take.
  chip:{
    width:38,
    height:38,
    borderRadius:SHAPE.radius.control,
    alignItems:"center",
    justifyContent:"center",
    backgroundColor:INK.panel,
    borderWidth:SHAPE.border,
    borderColor:INK.hairlineStrong,
    ...SHAPE.shadow.floating
  },
  // Open steps a surface and strengthens the edge. It does NOT fill: which
  // panel is open is not a state a place is in.
  chipOpen:{backgroundColor:INK.panelRaised,borderColor:INK.readoutSoft},
  badge:{
    minHeight:30,
    justifyContent:"center",
    paddingHorizontal:10,
    borderRadius:SHAPE.radius.control,
    backgroundColor:INK.panel,
    borderWidth:SHAPE.border,
    borderColor:INK.hairline
  },
  // A filter left on is a system state the app is reporting, so it is mono.
  badgeText:{
    color:INK.readout,fontFamily:MONO,fontSize:TYPE.data.sizes.md,
    textTransform:"uppercase",letterSpacing:0.8
  },
  panel:{
    marginTop:8,
    backgroundColor:INK.panel,
    borderWidth:SHAPE.border,
    borderColor:INK.hairline,
    borderRadius:SHAPE.radius.card,
    padding:10,
    ...SHAPE.shadow.floating
  },
  // The search box is a well cut into the panel, one surface step down, like
  // every other input in the instrument.
  search:{
    minHeight:44,
    paddingHorizontal:12,
    paddingRight:40,
    color:INK.readout,
    fontSize:TYPE.body.sizes.lg,
    backgroundColor:INK.inset,
    borderWidth:SHAPE.border,
    borderColor:INK.hairline,
    borderRadius:SHAPE.radius.control
  },
  clear:{position:"absolute",right:18,top:20,width:28,height:28,alignItems:"center",justifyContent:"center"},
  heading:{
    color:INK.readoutFaint,fontFamily:MONO,fontSize:TYPE.data.sizes.sm,letterSpacing:1,
    textTransform:"uppercase",marginTop:6,marginBottom:7
  },
  row:{gap:7,paddingRight:4,paddingBottom:8},
  filter:{
    backgroundColor:INK.panel,
    paddingHorizontal:12,
    minHeight:34,
    justifyContent:"center",
    borderRadius:SHAPE.radius.control,
    borderWidth:SHAPE.border,
    borderColor:INK.hairline
  },
  filterOn:{backgroundColor:INK.panelRaised,borderColor:INK.hairlineStrong},
  filterOff:{opacity:0.45},
  filterText:{
    color:INK.readoutSoft,fontFamily:MONO,fontSize:TYPE.data.sizes.md,
    textTransform:"uppercase",letterSpacing:0.7
  },
  filterTextOn:{color:INK.readout,fontWeight:"600"}
});

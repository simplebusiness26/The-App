import React from "react";
import {View,Text,TextInput,Pressable,ScrollView,StyleSheet} from "react-native";
import {INK} from "../utils/tokens";

export const PANELS={NONE:null,SEARCH:"search",FILTERS:"filters"};

// Same values and setters from useLivingMap; new interaction language. Search
// and Layers sit in one dark decision dock so the map reads as a spatial handoff
// rather than a canvas covered in unrelated outlined chips.
export default function MapControls({
  open,onOpen,search,onSearch,typeFilters=[],typeFilter,onTypeFilter,
  timeWindows=[],timeWindow,onTimeWindow,showLive,onShowLive,showPosts,onShowPosts,
  showHeat,onShowHeat,historical,onHistorical
}){
  const toggle=(panel)=>onOpen?.(open===panel ? PANELS.NONE : panel);
  const narrowed=activeLabel({typeFilters,typeFilter,historical});

  return(
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.command}>
        <View style={styles.commandCopy} pointerEvents="none">
          <Text style={styles.kicker}>MAP CONTEXT</Text>
          <Text style={styles.commandTitle}>{narrowed || "Everything nearby"}</Text>
        </View>

        <Pressable
          style={[styles.mode,open===PANELS.SEARCH && styles.modeOn]}
          accessibilityRole="button"
          accessibilityState={{selected:open===PANELS.SEARCH}}
          accessibilityLabel={open===PANELS.SEARCH ? "Hide the search box" : "Search the map"}
          onPress={()=>toggle(PANELS.SEARCH)}
        >
          <Text style={[styles.modeGlyph,open===PANELS.SEARCH && styles.modeGlyphOn]}>⌕</Text>
          <Text style={[styles.modeLabel,open===PANELS.SEARCH && styles.modeLabelOn]}>Search</Text>
        </Pressable>

        <Pressable
          style={[styles.mode,open===PANELS.FILTERS && styles.modeOn]}
          accessibilityRole="button"
          accessibilityState={{selected:open===PANELS.FILTERS}}
          accessibilityLabel={open===PANELS.FILTERS ? "Hide the map filters" : "Filter the map"}
          onPress={()=>toggle(PANELS.FILTERS)}
        >
          <Text style={[styles.modeGlyph,open===PANELS.FILTERS && styles.modeGlyphOn]}>≡</Text>
          <Text style={[styles.modeLabel,open===PANELS.FILTERS && styles.modeLabelOn]}>Layers</Text>
        </Pressable>
      </View>

      {open===PANELS.SEARCH && (
        <View style={styles.panel}>
          <Text style={styles.panelKicker}>FIND A PLACE</Text>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.search}
              placeholder="Business, stay or club"
              placeholderTextColor={INK.inkSoft}
              value={search}
              onChangeText={onSearch}
              accessibilityLabel="Search the map"
              autoFocus
              returnKeyType="search"
            />
            {!!search && (
              <Pressable style={styles.clear} accessibilityRole="button" accessibilityLabel="Clear the search" onPress={()=>onSearch?.("")}>
                <Text style={styles.clearText}>Clear</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {open===PANELS.FILTERS && (
        <View style={styles.panel}>
          <FilterGroup title="What">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
              {typeFilters.map(({key,label})=>(
                <Chip key={key} label={label} on={typeFilter===key} onPress={()=>onTypeFilter?.(key)} describe={`Show ${label}`}/>
              ))}
            </ScrollView>
          </FilterGroup>

          <FilterGroup title="When">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
              <Chip label="Happening" on={showLive} onPress={()=>onShowLive?.(!showLive)} describe={showLive ? "Hide what is happening" : "Show what is happening"}/>
              {timeWindows.map(({key,label})=>(
                <Chip key={key} label={label} on={showLive && timeWindow===key} disabled={!showLive} onPress={()=>onTimeWindow?.(key)} describe={`Show what is happening ${label.toLowerCase()}`}/>
              ))}
            </ScrollView>
          </FilterGroup>

          <FilterGroup title="Context layers">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
              <Chip label="Posts" on={showPosts} onPress={()=>onShowPosts?.(!showPosts)} describe={showPosts ? "Hide Moments and Memories" : "Show Moments and Memories"}/>
              <Chip label="Busy" on={showHeat} onPress={()=>onShowHeat?.(!showHeat)} describe={showHeat ? "Hide busy areas" : "Show busy areas"}/>
              <Chip label="Memories" on={historical} onPress={()=>onHistorical?.(!historical)} describe={historical ? "Leave the Memories timeline" : "Show Memories on a timeline"}/>
            </ScrollView>
          </FilterGroup>
        </View>
      )}
    </View>
  );
}

function FilterGroup({title,children}){
  return <View style={styles.group}><Text style={styles.heading}>{title}</Text>{children}</View>;
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

function activeLabel({typeFilters,typeFilter,historical}){
  if(historical) return "Memory timeline";
  if(!typeFilter || typeFilter==="all") return "";
  return typeFilters.find((entry)=>entry.key===typeFilter)?.label || "";
}

const styles=StyleSheet.create({
  wrap:{position:"absolute",left:10,right:10,zIndex:10},
  command:{
    minHeight:56,flexDirection:"row",alignItems:"center",gap:6,
    backgroundColor:INK.navy,borderRadius:20,padding:6
  },
  commandCopy:{flex:1,paddingHorizontal:9,minWidth:0},
  kicker:{color:INK.brand,fontSize:8,fontWeight:"900",letterSpacing:1},
  commandTitle:{color:INK.onNavy,fontSize:13,fontWeight:"900",marginTop:2},
  mode:{minWidth:58,height:44,borderRadius:15,alignItems:"center",justifyContent:"center",backgroundColor:INK.navySoft},
  modeOn:{backgroundColor:INK.brand},
  modeGlyph:{color:INK.onNavy,fontSize:16,fontWeight:"900",lineHeight:17},
  modeGlyphOn:{color:INK.navy},
  modeLabel:{color:INK.onNavySoft,fontSize:8,fontWeight:"800",marginTop:1},
  modeLabelOn:{color:INK.navy},
  panel:{marginTop:7,backgroundColor:INK.card,borderWidth:1,borderColor:INK.hair,borderRadius:20,padding:12},
  panelKicker:{color:INK.brandDeep,fontSize:9,fontWeight:"900",letterSpacing:1,marginBottom:7},
  searchRow:{flexDirection:"row",alignItems:"center",gap:8},
  search:{flex:1,minHeight:46,paddingHorizontal:13,color:INK.ink,fontSize:15,backgroundColor:INK.paper,borderRadius:14},
  clear:{minHeight:44,justifyContent:"center",paddingHorizontal:12,borderRadius:13,backgroundColor:INK.navy},
  clearText:{color:INK.onNavy,fontWeight:"800",fontSize:11},
  group:{marginBottom:8},
  heading:{color:INK.inkSoft,fontWeight:"900",fontSize:10,letterSpacing:.8,textTransform:"uppercase",marginBottom:7},
  row:{gap:7,paddingRight:4,paddingBottom:4},
  filter:{backgroundColor:INK.paper,paddingHorizontal:13,minHeight:38,justifyContent:"center",borderRadius:14,borderWidth:1,borderColor:INK.hair},
  filterOn:{backgroundColor:INK.navy,borderColor:INK.navy},
  filterOff:{opacity:.4},
  filterText:{fontWeight:"800",color:INK.ink,fontSize:12},
  filterTextOn:{color:INK.onNavy,fontWeight:"900",fontSize:12}
});

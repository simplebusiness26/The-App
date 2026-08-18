import React,{useState} from "react";
import {Text,StyleSheet,Pressable,ScrollView} from "react-native";
import {router} from "expo-router";
import PlacePanel from "./PlacePanel";
import SearchBar from "./SearchBar";
import {CREATE_HUB_CLEARANCE} from "./CreateHub";
import {CARD_KINDS} from "../utils/placeCards";
import {classificationLabel} from "../utils/taxonomy";
import {ACTIVITY_STATE_SENTENCE,TIME_WINDOWS} from "../utils/liveActivity";
import {useLivingMap} from "../hooks/useLivingMap";
import {INK,TYPE} from "../utils/tokens";
import {Chip,Empty,MONO,Row,Screen,SectionRule,Segmented} from "./instrument";

// The list view of the Living Map.
//
// It used to be the ONLY view: EXPO_PUBLIC_GOOGLE_MAPS_API_KEY was never set,
// so app/map.js fell through to this and the app had no map at all. Packet 21
// gave it one, and this stopped being the map.
//
// It is kept, and reachable, because it earns its place: it works when the map
// will not load, it is the better surface for a screen reader, and browsing
// what is near you without a map is a real way to use this app. What it is no
// longer is a substitute for being unable to draw one.
//
// REBUILT ON THE KIT. This file was one long line of StyleSheet holding a
// stadium-pill filter row whose selected chip filled with what is now the
// near-white readout colour, four hand-drawn card shapes and a 22px bare
// heading per section. It is Screen / SearchBar / Segmented / SectionRule /
// Row / Empty now, and the StyleSheet is a tenth of the size, because the
// shapes moved into components/instrument.js where every screen shares them.
//
// THE MINI PIN HAS GONE FROM THE ROWS. docs/design-system.md: "The glass pin is
// the memorable thing in this design... Don't add a second signature." A
// frosted 30px disc repeated down a list is the map's one signature spent on
// chrome, and it cost a native BlurView per row. What the pin said is still
// said: the state is the row's left edge (StateEdge, via Row's `tone`), and the
// type is spelled out in words in the row itself.

// Each window gets its own sentence. "Nothing here yet" is banned, and a single
// generic line would be the same mood in three costumes.
function emptyActivityInstruction(timeWindow){
  if(timeWindow==="tonight") return "Nothing is on tonight yet. Start a Link-up and it will show here.";
  if(timeWindow==="weekend") return "The weekend is open. Create an Event or a Link-up to put something on it.";
  return "Nothing is happening this minute. Check in somewhere or start a Link-up to change that.";
}

const TYPE_ITEMS=[
  {key:"all",label:"All"},
  {key:"business",label:"Businesses"},
  {key:"property",label:"Properties"},
  {key:"activity",label:"Activity Clubs"}
];

export default function PlacesList({header}){
  // ONE BRAIN, TWO VIEWS.
  //
  // This file used to carry its own copy of everything: the three reads, the
  // signed-out guard, the error isolation, the search matcher, the type filter
  // and the time window -- all of it duplicated almost line for line in
  // app/map.js. Two copies of a rule is two chances for the list and the map to
  // disagree about what is in front of somebody.
  //
  // It is the same hook the map uses now. The list is a VIEW of the Living Map,
  // not a second implementation of it, which is why a Map/List switch can put
  // them side by side without either lying.
  const map=useLivingMap();

  const {search,setSearch,typeFilter,setTypeFilter,timeWindow,setTimeWindow}=map;
  const [openKey,setOpenKey]=useState(null);

  // The hook returns one filtered list with a `kind` on each row. The sections
  // below want them split, and splitting a list is not a second read model.
  const filteredBusinesses=map.places.filter((row)=>row.kind===CARD_KINDS.BUSINESS);
  const filteredProperties=map.places.filter((row)=>row.kind===CARD_KINDS.PROPERTY);
  const filteredClubs=map.places.filter((row)=>row.kind===CARD_KINDS.CLUB);

  const visibleActivity=map.activity;

  // The whole row, not just its card: components/PlacePanel.js shows the
  // picture and the description, and both live on the row.
  const tapped=map.places.find((row)=>row.card?.key===openKey) || null;

  return(
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        {header}

        <SearchBar
          value={search}
          onChange={setSearch}
          label="Search"
          placeholder="Search businesses, stays or clubs"
        />

        {/* A detented selector, not five filled pills. Being the chosen filter
            is not a state a PLACE is in, so it never takes a state ink --
            selection is a brighter label over a lit detent. */}
        <Segmented items={TYPE_ITEMS} active={typeFilter} onChange={setTypeFilter} scroll/>

        {/*
          Packet 8f1. First, deliberately. CLAUDE.md's ordering asks "What is
          around me?" then "What is happening now?", and until this packet the
          second question had no answer anywhere on the map. A section below the
          business list would technically answer it and would never be seen.
        */}
        <SectionRule label="Happening" meta={String(visibleActivity.length)}/>

        {/*
          The window chips keep their spoken labels. The kit's Chip and
          Segmented both use the visible label as the accessible one, and
          "Show what is happening tonight" says more than "Tonight" -- so the
          Chip is drawn inside a Pressable that carries the real sentence, and
          the Chip itself is left inert.

          flexGrow:0 / flexShrink:0 and a centred content container, because a
          horizontal ScrollView inside a flex column otherwise claims the
          leftover height and stretches every chip to fill it.
        */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.windowScroll}
          contentContainerStyle={styles.windowRow}
        >
          {TIME_WINDOWS.map(({key,label})=>(
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={`Show what is happening ${label.toLowerCase()}`}
              accessibilityState={{selected:timeWindow===key}}
              onPress={()=>setTimeWindow(key)}
            >
              <Chip label={label} selected={timeWindow===key}/>
            </Pressable>
          ))}
        </ScrollView>

        {visibleActivity.length
          ? visibleActivity.map((item)=>(
            <Row
              key={item.key}
              // `scheduled` is what a live thing IS. It is a 2px left edge here
              // rather than a fill, so every label inside the row stays legible.
              tone="scheduled"
              title={item.title}
              sub={ACTIVITY_STATE_SENTENCE[item.state]}
              onPress={()=>item.deepLink && router.push(item.deepLink)}
            >
              {!!item.subtitle && <Text style={styles.rowWhere} numberOfLines={2}>{item.subtitle}</Text>}
            </Row>
          ))
          : (
            // An empty state is an instruction, not a mood (design-system.md).
            <Empty
              glyph="live"
              title="Nothing live in this window"
              instruction={emptyActivityInstruction(timeWindow)}
            />
          )}

        {(typeFilter==="all" || typeFilter==="business") && <>
          <SectionRule label="Businesses" meta={String(filteredBusinesses.length)}/>
          {filteredBusinesses.length
            ? filteredBusinesses.map((place)=>(
              <Row
                key={place.id}
                tone={place.card?.marker?.state || "exists"}
                title={place.name}
                onPress={()=>setOpenKey(`${CARD_KINDS.BUSINESS}-${place.id}`)}
              >
                {/* The classification is something the app worked out from the
                    type a manager picked, so it is mono. The address is what a
                    person typed, so it is not. */}
                <Text style={styles.rowKind}>{classificationLabel(place).toUpperCase()}</Text>
                {!!place.address && <Text style={styles.rowWhere} numberOfLines={2}>{place.address}</Text>}
              </Row>
            ))
            : <Empty glyph="building" title="No businesses match" instruction="Clear the search, or widen the filter above."/>}
        </>}

        {(typeFilter==="all" || typeFilter==="property") && <>
          <SectionRule label="Properties" meta={String(filteredProperties.length)}/>
          {filteredProperties.length
            ? filteredProperties.map((property)=>(
              <Row
                key={property.id}
                tone={property.card?.marker?.state || "exists"}
                title={property.name}
                onPress={()=>setOpenKey(`${CARD_KINDS.PROPERTY}-${property.id}`)}
              >
                {!!property.host && <Text style={styles.rowWhere}>{property.host}</Text>}
                {!!property.address && <Text style={styles.rowWhere} numberOfLines={2}>{property.address}</Text>}
              </Row>
            ))
            : <Empty glyph="bed" title="No stays match" instruction="Clear the search, or widen the filter above."/>}
        </>}

        {(typeFilter==="all" || typeFilter==="activity") && <>
          <SectionRule label="Activity Clubs" meta={String(filteredClubs.length)}/>
          {filteredClubs.length
            ? filteredClubs.map((club)=>(
              <Row
                key={club.id}
                tone={club.card?.marker?.state || "scheduled"}
                title={club.name}
                onPress={()=>setOpenKey(`${CARD_KINDS.CLUB}-${club.id}`)}
              >
                <Text style={styles.rowKind}>{String(club.category || "").toUpperCase()} · {String(club.status || "").toUpperCase()}</Text>
                {!!(club.address || club.location) && (
                  <Text style={styles.rowWhere} numberOfLines={2}>{club.address || club.location}</Text>
                )}
              </Row>
            ))
            : <Empty glyph="people" title="No clubs match" instruction="Clear the search, or widen the filter above."/>}
        </>}
      </ScrollView>

      {/* The same panel the map opens, so the two surfaces cannot grow two
          different ideas of what a place looks like. */}
      {!!tapped && <PlacePanel place={tapped} onClose={()=>setOpenKey(null)}/>}
    </Screen>
  );
}

const styles=StyleSheet.create({
  // CREATE_HUB_CLEARANCE, or the last row of the last section sits underneath
  // the floating Create action.
  content:{padding:16,paddingBottom:24+CREATE_HUB_CLEARANCE},

  windowScroll:{flexGrow:0,flexShrink:0,marginBottom:4},
  windowRow:{alignItems:"center",gap:8,paddingRight:4},

  rowKind:{
    color:INK.readoutFaint,fontFamily:MONO,fontSize:TYPE.data.sizes.sm,
    letterSpacing:0.8,marginTop:4
  },
  rowWhere:{
    color:INK.readoutSoft,fontSize:TYPE.body.sizes.sm,
    lineHeight:TYPE.body.sizes.sm*1.5,marginTop:3
  }
});

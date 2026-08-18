import React,{useCallback,useMemo,useState} from "react";
import {ActivityIndicator,Pressable,ScrollView,StyleSheet,Text,View} from "react-native";
import {router,useFocusEffect} from "expo-router";
import {supabase} from "../../services/supabase";
import {PUBLIC_PLACE_TYPES,publicPlaceTypeLabel} from "../../utils/places";
import {INK,TYPE} from "../../utils/tokens";
import SearchBar from "../../components/SearchBar";
import {CREATE_HUB_CLEARANCE} from "../../components/CreateHub";
import {Chip,Empty,MONO,Notice,Row,Screen,ScreenTitle,SectionRule} from "../../components/instrument";

// Packet 8e: the parks, beaches and viewpoints that had no identity until now.
//
// Before this, a park existed only as whatever a person typed into a check-in,
// so "Alexandra Park" and "alexandra park" were two places and neither could be
// opened, followed or attached to anything. These rows are canonical: one park,
// one id, one page.
//
// The list is deliberately plain. It is a way into a place page, not a
// discovery surface -- Discover already exists and owns that job.

export default function PublicPlaces(){
  const [places,setPlaces]=useState([]);
  const [areas,setAreas]=useState({});
  const [type,setType]=useState(null);
  const [query,setQuery]=useState("");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  const load=useCallback(async()=>{
    setLoading(true);
    setError("");

    const [placeResult,areaResult]=await Promise.all([
      supabase
        .from("public_places")
        .select("id,name,place_type,area_id,location_description,image_url")
        .eq("status","published")
        .order("name",{ascending:true})
        .limit(200),
      supabase.from("geo_areas").select("id,name,area_type").eq("status","active")
    ]);

    if(placeResult.error){
      setError("Public places could not be loaded.");
      setPlaces([]);
    }else{
      setPlaces(placeResult.data || []);
    }

    const lookup={};
    for(const area of areaResult.data || []) lookup[area.id]=area.name;
    setAreas(lookup);

    setLoading(false);
  },[]);

  useFocusEffect(useCallback(()=>{load();},[load]));

  const filtered=useMemo(()=>{
    const term=query.trim().toLowerCase();
    return places.filter((place)=>{
      if(type && place.place_type!==type) return false;
      if(!term) return true;
      return `${place.name} ${place.location_description || ""}`.toLowerCase().includes(term);
    });
  },[places,type,query]);

  if(loading){
    return(
      <Screen style={styles.centre}>
        <ActivityIndicator size="large" color={INK.readoutSoft}/>
        <Text style={styles.centreText}>Loading public places...</Text>
      </Screen>
    );
  }

  return(
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* The engraved plate. It was a 28px bold word and a grey sentence --
            a document's masthead. The eyebrow says what KIND of list this is
            before the name of it, which is how every page in this app opens. */}
        <ScreenTitle
          eyebrow="Public places"
          title="Parks, beaches and viewpoints"
          meta="The rest of the map that nobody owns."
        />

        <View style={styles.body}>
          {!!error && (
            <View accessibilityRole="alert" style={styles.problem}>
              <Notice tone="scheduled" label="NOT LOADED">{error}</Notice>
            </View>
          )}

          <SearchBar
            value={query}
            onChange={setQuery}
            label="Search public places"
            placeholder="Search public places"
          />

          {/*
            The chips keep their spoken labels. The kit's Chip uses its visible
            label as its accessible one, and "Show every type of public place"
            says more than "All" -- so each Chip is drawn inside a Pressable
            carrying the real sentence, and the Chip itself is left inert.

            flexGrow:0 / flexShrink:0 and a centred content container, because
            a horizontal ScrollView in a flex column otherwise claims the
            leftover height and stretches every chip to fill it.
          */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipScroll}
            contentContainerStyle={styles.chipRow}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Show every type of public place"
              accessibilityState={{selected:!type}}
              onPress={()=>setType(null)}
            >
              <Chip label="All" selected={!type}/>
            </Pressable>
            {PUBLIC_PLACE_TYPES.map((item)=>(
              <Pressable
                key={item.key}
                accessibilityRole="button"
                accessibilityLabel={`Show ${item.label}`}
                accessibilityState={{selected:type===item.key}}
                onPress={()=>setType(type===item.key ? null : item.key)}
              >
                <Chip label={item.label} selected={type===item.key}/>
              </Pressable>
            ))}
          </ScrollView>

          <SectionRule label="Places" meta={String(filtered.length)}/>

          {!filtered.length ? (
            <Empty
              glyph="map"
              title="No public places here yet"
              /* An empty state is an instruction, not a mood. */
              instruction="Public places are added by the Xplorer team. Check in at one by name and it can be added as a place everybody shares."
            />
          ) : filtered.map((place)=>(
            <Row
              key={place.id}
              glyph="pin"
              title={place.name}
              onPress={()=>router.push(`/places/${place.id}`)}
            >
              {/* What kind of place and which area it is in are both things the
                  app looked up, so they are mono. Where to find it is a
                  sentence somebody wrote, so it is not. */}
              <Text style={styles.cardKind}>
                {publicPlaceTypeLabel(place.place_type)}
                {place.area_id && areas[place.area_id] ? ` · ${areas[place.area_id]}` : ""}
              </Text>
              {!!place.location_description && (
                <Text style={styles.cardDetail} numberOfLines={2}>{place.location_description}</Text>
              )}
            </Row>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const MONO_META={fontFamily:MONO,letterSpacing:0.9,textTransform:"uppercase"};

const styles=StyleSheet.create({
  // ScreenTitle carries its own horizontal padding, so the scroll view does
  // not. CREATE_HUB_CLEARANCE, or the last row sits under the Create action.
  content:{paddingBottom:24+CREATE_HUB_CLEARANCE},
  body:{paddingHorizontal:16},

  centre:{alignItems:"center",justifyContent:"center",padding:28},
  centreText:{...MONO_META,color:INK.readoutFaint,fontSize:TYPE.data.sizes.md,marginTop:12},

  problem:{marginTop:14,marginBottom:2},

  chipScroll:{flexGrow:0,flexShrink:0},
  chipRow:{alignItems:"center",gap:8,paddingRight:4},

  cardKind:{...MONO_META,color:INK.readoutFaint,fontSize:TYPE.data.sizes.sm,letterSpacing:0.8,marginTop:4},
  cardDetail:{
    color:INK.readoutSoft,fontSize:TYPE.body.sizes.sm,
    lineHeight:TYPE.body.sizes.sm*1.5,marginTop:3
  }
});

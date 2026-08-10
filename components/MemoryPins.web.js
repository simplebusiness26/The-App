import React from "react";
import {ScrollView,StyleSheet} from "react-native";
import {router} from "expo-router";
import MemoryRow from "./MemoryRow";

// Packet 8b, web build.
//
// THIS FILE EXISTS BECAUSE `react-native-maps` HAS NO WEB BUILD.
//
// Its package.json declares only `main` and `react-native` entries -- no
// `browser` field -- so importing it from anything reachable on web pulls a
// native-only module into the web bundle. `app/map.web.js` has existed for
// exactly this reason since the map was built: the web map is PlacesList and
// never touches react-native-maps.
//
// 8b missed that and imported MapView straight into components/MyMap.js, which
// components/ExplorerProfileScreen.js imports -- so every profile on web went
// blank. Jest did not catch it because test/setup.js mocks react-native-maps,
// and the mock is what makes the native-only import look fine.
//
// So the platform split lives here rather than in a runtime branch: on web
// there is no map, and the import cannot happen because this file does not
// contain it.

export default function MemoryPins({memories}){
  return(
    <ScrollView style={styles.list} contentContainerStyle={styles.content}>
      {memories.map(memory=>(
        <MemoryRow
          key={memory.id}
          memory={memory}
          onPress={()=>router.push(`/memories/${memory.id}`)}
        />
      ))}
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  list:{maxHeight:320},
  content:{paddingBottom:4}
});

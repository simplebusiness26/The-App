import React from "react";
import {View,StyleSheet} from "react-native";
import {Stack} from "expo-router";
import {SafeAreaProvider} from "react-native-safe-area-context";
import {usePathname} from "expo-router";
import Header,{useHeaderClearance} from "../components/Header";
import {headerFloatsOver} from "../utils/navigation";
import TabBar from "../components/TabBar";
import QuickAccessDrawer from "../components/QuickAccessDrawer";
import {FeedbackProvider} from "../context/FeedbackContext";
import {NotificationProvider} from "../context/NotificationContext";
import {DrawerProvider} from "../context/DrawerContext";
import ErrorBoundary from "../components/ErrorBoundary";
import StartupSplash from "../components/StartupSplash";
import VisibilityWelcome from "../components/VisibilityWelcome";
import {INK} from "../utils/tokens";

export const unstable_settings={initialRouteName:"index"};

// Packet 3. The TabBar sits below the Stack rather than around it, so it
// survives every push instead of only the five tab roots, and so no route file
// had to move to gain one. SafeAreaProvider is here because the bar reads the
// bottom inset; nothing else in the app had needed it.
// The header floats over the stack rather than sitting inside the navigator.
//
// Inside it, `header:()=> <Header/>` reserved its height on EVERY screen, which
// is the owner's "it drops the whole page down" -- and on the map it put a
// card-coloured bar with a border across the top, so the search box started
// below the map instead of on it.
//
// Out here it is one absolutely positioned layer. Space is reserved only on the
// screens it does not float over, so nothing on a page is ever covered, and the
// map and the camera get the full screen they are supposed to have.
function Shell({children}){
  const pathname=usePathname();
  const clearHeader=useHeaderClearance();
  const floats=headerFloatsOver(pathname);

  return(
    <>
      <View style={[styles.stack,!floats && {paddingTop:clearHeader}]}>
        {children}
      </View>
      {/* box-none, so the gaps between the three controls belong to whatever is
          underneath -- the map pans through them. */}
      <View style={styles.header} pointerEvents="box-none">
        <Header/>
      </View>
    </>
  );
}

export default function Layout(){
  return(
    <SafeAreaProvider>
      {/*
        Outermost, and above the providers on purpose: React 18 unmounts the
        whole root when a render throws with nothing to catch it, which is why a
        crash on one screen showed as a completely black page with no header,
        no tab bar and nothing to tap. A blank screen is the worst possible
        failure report; this makes a crash name itself.
      */}
      <ErrorBoundary>
      <FeedbackProvider>
        <NotificationProvider>
          <DrawerProvider>
            <View style={styles.shell}>
            <Shell>
        {/*
          THE HEADER IS NOT A STACK BAR ANY MORE.

          `header:()=> <Header/>` put it INSIDE the navigator, which reserves
          its height on every screen -- the owner's "it drops the whole page
          down". It also meant a 60px card-coloured bar with a border across
          the top of the map, so the search box started below the map rather
          than on it.

          It is rendered once below, over the stack, and reserves space only on
          screens it does not float over. See components/Header.js and
          headerFloatsOver() in utils/navigation.js.
        */}
        <Stack screenOptions={{headerShown:false}}>
          <Stack.Screen name="index" options={{headerShown:false}}/>
          <Stack.Screen name="settings"/>
          <Stack.Screen name="map"/>
          <Stack.Screen name="messages/index"/>
          <Stack.Screen name="messages/[id]"/>
          <Stack.Screen name="discover"/>
          <Stack.Screen name="scan"/>
          <Stack.Screen name="camera"/>
          <Stack.Screen name="qr/[code]"/>
          <Stack.Screen name="profile"/>
          <Stack.Screen name="profile/[id]"/>
          <Stack.Screen name="profile/edit"/>
          <Stack.Screen name="explorers"/>
          <Stack.Screen name="connections/[id]"/>
          <Stack.Screen name="feed"/>
          <Stack.Screen name="moments/create"/>
          <Stack.Screen name="moments/[id]"/>
          <Stack.Screen name="memories/create"/>
          <Stack.Screen name="memories/[id]"/>
          <Stack.Screen name="social-comments/[id]"/>
          <Stack.Screen name="leaderboards"/>
          <Stack.Screen name="notifications"/>

          <Stack.Screen name="linkups/index"/>
          <Stack.Screen name="linkups/create"/>
          <Stack.Screen name="linkups/[id]"/>
          <Stack.Screen name="linkups/edit/[id]"/>
          <Stack.Screen name="linkups/board/[id]"/>
          <Stack.Screen name="live"/>
          <Stack.Screen name="checkins/create"/>
          <Stack.Screen name="safety/blocked"/>

          <Stack.Screen name="auth/signup"/>
          <Stack.Screen name="auth/login"/>
          <Stack.Screen name="auth/forgot-password"/>
          <Stack.Screen name="auth/update-password"/>

          <Stack.Screen name="manager/dashboard"/>
          <Stack.Screen name="manager/requests"/>
          <Stack.Screen name="manager/qr/[type]/[id]"/>
          <Stack.Screen name="manager/membership-status/[id]"/>

          <Stack.Screen name="business/[id]"/>
          <Stack.Screen name="business/dashboard"/>
          <Stack.Screen name="business/add"/>
          <Stack.Screen name="business/edit/[id]"/>
          <Stack.Screen name="business/review/[id]"/>
          <Stack.Screen name="business/review-action"/>

          <Stack.Screen name="property/[id]"/>
          <Stack.Screen name="property/dashboard"/>
          <Stack.Screen name="property/add"/>
          <Stack.Screen name="property/edit/[id]"/>
          <Stack.Screen name="property/reviews"/>
          <Stack.Screen name="property/review/[id]"/>
          <Stack.Screen name="property/review-action"/>


          <Stack.Screen name="places/index"/>
          <Stack.Screen name="places/[id]"/>
          <Stack.Screen name="places/review/[id]"/>

          <Stack.Screen name="activity-clubs/index"/>
          <Stack.Screen name="activity-clubs/[id]"/>
          <Stack.Screen name="activity-clubs/add"/>
          <Stack.Screen name="activity-clubs/edit/[id]"/>
          <Stack.Screen name="activity-clubs/message-board/[id]"/>
          <Stack.Screen name="activity-clubs/review/[id]"/>

          <Stack.Screen name="events/index"/>
          <Stack.Screen name="events/[id]"/>
          <Stack.Screen name="events/add"/>
          <Stack.Screen name="events/edit/[id]"/>
          <Stack.Screen name="events/review/[id]"/>

          <Stack.Screen name="admin/claims"/>
          <Stack.Screen name="admin/activities"/>
          <Stack.Screen name="admin/areas"/>
          <Stack.Screen name="admin/audit"/>
          <Stack.Screen name="admin/dashboard"/>
          <Stack.Screen name="admin/explorers"/>
          <Stack.Screen name="admin/listings"/>
          <Stack.Screen name="admin/moderation"/>
          <Stack.Screen name="admin/public-places"/>
        </Stack>
            </Shell>

              <TabBar/>
              <QuickAccessDrawer/>

              {/*
                Shown once, to a new Explorer, before they post into a void they
                did not know they were in. It sets nothing on anybody's behalf --
                see the note in components/VisibilityWelcome.js. Placed here
                rather than on a route because the app opens on the map and a
                deep link straight to a place page is still somebody's first
                time; it renders nothing at all once seen.
              */}
              <VisibilityWelcome/>

              {/*
                Last child, so it covers the header, the tab bar and whatever
                route the app opened on. It is HERE rather than on the home
                route because the credit it carries has to be shown on every
                start -- a deep link straight to a place page is still the app
                starting, and the map data is still OpenStreetMap's.

                It removes itself after five seconds and does not come back.
              */}
              <StartupSplash/>
            </View>
          </DrawerProvider>
        </NotificationProvider>
      </FeedbackProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles=StyleSheet.create({
  // Paper, not nothing. With no colour here the app's own backdrop is whatever
  // the platform puts behind it, and on both web and Android that is black --
  // which is what showed through the footer's see-through strip and read as a
  // black line above the navigation. The footer no longer relies on this, but
  // an unpainted root is how that class of bug happens in the first place.
  shell:{flex:1,backgroundColor:INK.paper},
  stack:{flex:1},
  // Above the stack, below the tab bar, the drawer and the splash -- all of
  // which are later children of the shell and must stay on top of it.
  header:{position:"absolute",top:0,left:0,right:0,zIndex:40}
});

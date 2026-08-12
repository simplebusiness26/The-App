import React from "react";
import {View,StyleSheet} from "react-native";
import {Stack} from "expo-router";
import {SafeAreaProvider} from "react-native-safe-area-context";
import Header from "../components/Header";
import TabBar from "../components/TabBar";
import QuickAccessDrawer from "../components/QuickAccessDrawer";
import {FeedbackProvider} from "../context/FeedbackContext";
import {NotificationProvider} from "../context/NotificationContext";
import {DrawerProvider} from "../context/DrawerContext";
import ErrorBoundary from "../components/ErrorBoundary";

export const unstable_settings={initialRouteName:"index"};

// Packet 3. The TabBar sits below the Stack rather than around it, so it
// survives every push instead of only the five tab roots, and so no route file
// had to move to gain one. SafeAreaProvider is here because the bar reads the
// bottom inset; nothing else in the app had needed it.
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
            <View style={styles.stack}>
        <Stack screenOptions={{headerShown:true,header:()=> <Header />}}>
          <Stack.Screen name="index" options={{headerShown:false}}/>
          <Stack.Screen name="settings"/>
          <Stack.Screen name="map"/>
          <Stack.Screen name="messages"/>
          <Stack.Screen name="discover"/>
          <Stack.Screen name="create"/>
          <Stack.Screen name="scan"/>
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
            </View>

              <TabBar/>
              <QuickAccessDrawer/>
            </View>
          </DrawerProvider>
        </NotificationProvider>
      </FeedbackProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles=StyleSheet.create({
  shell:{flex:1},
  stack:{flex:1}
});

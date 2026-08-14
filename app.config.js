module.exports = () => ({
  expo: {
    name: "Xplorer",
    // THE APP IS CALLED XPLORER EVERYWHERE NOW.
    //
    // These three said "guestbook" and were deliberately left alone, because
    // changing a bundle identifier on a PUBLISHED app makes it a new app: new
    // listing, no reviews, and existing users stop getting updates.
    //
    // Confirmed with the owner: never published to either store. So there is
    // nothing to migrate and nothing to lose, and leaving a dead product name
    // in the identity of every build was the worse option.
    //
    // The APK already on a phone becomes a SEPARATE app. It will not update --
    // it has to be uninstalled and the new one installed. Nothing is lost: the
    // data is in Supabase, not on the phone.
    slug: "xplorer",
    version: "1.0.0",
    orientation: "portrait",
    userInterfaceStyle: "light",
    platforms: ["ios", "android", "web"],
    web: {
      bundler: "metro"
    },
    android: {
      // No maps configuration. MapLibre needs no key, no account and no card,
      // so there is nothing to configure and nothing to leak. The Google Maps
      // block that used to sit here went with react-native-maps.
      package: "com.xplorer.app"
    },
    ios: {
      bundleIdentifier: "com.xplorer.app"
    },
    plugins: [
      // MapLibre's native map. The plugin is what wires the SDK into the
      // generated Android and iOS projects -- on iOS it adds MLRN.post_install
      // to the Podfile, which cannot be done any other way.
      //
      // It means the app CANNOT run in Expo Go any more. That is not a
      // regression to work around: this repository has never used Expo Go for a
      // build, and .github/workflows/build-apk.yml already runs `expo prebuild`
      // and Gradle, which is a custom native build. The plugin joins that
      // pipeline with nothing else to change.
      "@maplibre/maplibre-react-native",
      [
        "expo-camera",
        {
          cameraPermission: "Allow Xplorer to scan verified review QR codes",
          microphonePermission: "Allow Xplorer to record video reviews",
          recordAudioAndroid: true,
          barcodeScannerEnabled: true
        }
      ]
    ]
  }
});

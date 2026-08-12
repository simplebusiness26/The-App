const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

module.exports = () => ({
  expo: {
    name: "Xplorer",
    // slug, android.package and ios.bundleIdentifier still say guestbook, and
    // are deliberately left alone. The slug is what ties this source tree to
    // its Expo project, and the two identifiers are the app's identity in the
    // stores -- changing either is a migration with consequences outside this
    // repository, not a rename. Nobody sees any of the three; `name` above is
    // the string that appears under the icon.
    slug: "guestbook",
    version: "1.0.0",
    orientation: "portrait",
    userInterfaceStyle: "light",
    platforms: ["ios", "android", "web"],
    web: {
      bundler: "metro"
    },
    android: {
      package: "com.guestbook.app",
      ...(googleMapsApiKey
        ? {config: {googleMaps: {apiKey: googleMapsApiKey}}}
        : {})
    },
    ios: {
      bundleIdentifier: "com.guestbook.app"
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

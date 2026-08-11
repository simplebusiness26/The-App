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

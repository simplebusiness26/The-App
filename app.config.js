const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

module.exports = () => ({
  expo: {
    name: "Guestbook",
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
          cameraPermission: "Allow Guestbook to scan verified review QR codes",
          microphonePermission: "Allow Guestbook to record video reviews",
          recordAudioAndroid: true,
          barcodeScannerEnabled: true
        }
      ]
    ]
  }
});

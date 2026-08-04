// Packet 0 — the verification harness.
//
// These are smoke tests: they mount a route and assert it does not throw. They
// deliberately do not assert behaviour. The gap they close is the one that let
// a menu lose ten links while five verify:* scripts stayed green -- those
// scripts read source text, and nothing in this repository could previously
// tell you whether a screen renders at all.

module.exports={
  preset:"jest-expo",
  setupFilesAfterEnv:["<rootDir>/test/setup.js"],
  testMatch:["<rootDir>/test/**/*.test.js"],
  transformIgnorePatterns:[
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg))"
  ],
  clearMocks:true,
  // The first route to pull in a heavy component tree exceeded the 5s default
  // on transform cost alone, not on any hang in the screen.
  testTimeout:30000
};

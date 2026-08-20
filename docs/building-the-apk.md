# Building an installable APK

The app is a **managed** Expo project: there is no `android/` directory in the
repository and `app.config.js` is the source of truth for native configuration.
`expo prebuild` generates the native project from it. That generated directory
is gitignored on purpose — checking it in would give the repo two places that
decide the package name, the permissions and the icons, and they would drift.

So an APK is built, not committed:

```bash
npx expo prebuild --platform android --no-install
cd android
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
# -> android/app/build/outputs/apk/release/app-release.apk
```

`arm64-v8a` is every Android phone made since about 2017 and cuts the APK from
175 MB (all four ABIs) to 67 MB. Drop the flag for a universal build.

## What you need

- **JDK 21** (`java -version`)
- **Android SDK** with `platforms;android-35`, `build-tools;35.0.0` and
  `platform-tools`. Without Android Studio:

  ```bash
  curl -O https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
  mkdir -p ~/android-sdk/cmdline-tools && unzip -q commandlinetools-linux-*.zip -d ~/android-sdk/cmdline-tools
  mv ~/android-sdk/cmdline-tools/cmdline-tools ~/android-sdk/cmdline-tools/latest
  yes | ~/android-sdk/cmdline-tools/latest/bin/sdkmanager --sdk_root=$HOME/android-sdk --licenses
  ~/android-sdk/cmdline-tools/latest/bin/sdkmanager --sdk_root=$HOME/android-sdk \
    "platform-tools" "platforms;android-35" "build-tools;35.0.0"
  export ANDROID_HOME=$HOME/android-sdk
  ```

## Signing

`assembleRelease` with no keystore configured signs with the Android **debug**
key. That is fine for sideloading and for handing a build to somebody to try —
Android will ask them to allow installs from that source — and it is not fine
for the Play Store, which needs a real upload key. Nothing here configures one
yet, deliberately: a signing key is a secret and does not belong in this repo.

## Behind a proxy

Gradle does not read `HTTPS_PROXY` from the environment, and it needs a Java
truststore rather than a PEM bundle. In `android/gradle.properties`:

```properties
systemProp.https.proxyHost=127.0.0.1
systemProp.https.proxyPort=<port>
systemProp.javax.net.ssl.trustStore=/path/to/truststore.jks
systemProp.javax.net.ssl.trustStorePassword=changeit
```

Maven Central rate-limits hard through a shared proxy and answers **429**. The
build is resumable — every attempt caches what it managed to fetch — so a retry
loop with backoff gets there. Seven attempts, in the run that produced the first
APK from this tree.

## What is in it

Confirm the build carries the design rather than a stale bundle:

```bash
unzip -l app-release.apk | grep -E "index.android.bundle|\.ttf"
```

Seven font files (two Archivo, three Instrument Sans, two Martian Mono) and one
`assets/index.android.bundle` of a few MB. Those seven faces are the winning
design system's; if they are missing, the APK predates it.

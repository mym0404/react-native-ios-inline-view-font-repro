# iOS inline View font reproduction

Reproduces inherited-font loss for `<View>` inside `<Text>` in React Native Fabric on iOS, with the same cases available on Android. The blue box bottom should meet the red text baseline. Each row reports the baseline from `onTextLayout`, the View bottom from `ref.measure()`, and their difference in iOS points or Android dp. Allow one physical pixel for layout rounding.

Upstream draft PR: [react/react-native#58967](https://github.com/react/react-native/pull/58967).

**Verified on iPhone 17 Pro / iOS 26.5 with `agent-device`.** The unpatched attachment uses Helvetica 12 with descender `-2.759766 pt`. The patch resolves the inherited font and reduces the measured errors in ordinary, tall, wrapped, and scaled cases to less than one physical pixel. Explicit `lineHeight` retains a separate baseline-offset error; nested Text cannot be measured with this View's public `measure()` call. See [results and limitations](evidence/RESULTS.md).

**Android comparison verified on API 37 with `agent-device`.** All nine measurable samples, including `lineHeight: 48`, have absolute errors below `0.0001 dp` at font scales 1.0 and 1.75. Android uses its native sans-serif, serif, and monospace families. See [Android measurements, screenshots, and logs](evidence/ANDROID.md).

| Before | After |
| --- | --- |
| ![Before](evidence/before.png) | ![After](evidence/after.png) |

The reproduction runs against React Native **main**, built from source at `1449daad5e133c80fd643caccf9633201cb4c4f9` (2026-10-09). It uses RNTester's Playground so the JavaScript and native renderer come from the same checkout.

## Run the unpatched reproduction

Requires macOS, Xcode with an iOS Simulator runtime, Node 24, Yarn 1.22.22, Ruby with Bundler, CocoaPods, CMake, and `agent-device` on `PATH`.

```sh
git clone https://github.com/mym0404/react-native-ios-inline-view-font-repro.git
cd react-native-ios-inline-view-font-repro
git clone https://github.com/react/react-native.git react-native
cd react-native
git switch --detach 1449daad5e133c80fd643caccf9633201cb4c4f9
yarn install --frozen-lockfile
yarn --cwd packages/react-native-codegen build
cp ../App.js packages/rn-tester/js/examples/Playground/InlineViewFontRepro.js
cp ../RNTesterPlayground.js packages/rn-tester/js/examples/Playground/RNTesterPlayground.js
cd packages/rn-tester
bundle install
bundle exec pod update hermes-engine --no-repo-update
```

Start Metro in a separate terminal from the React Native checkout:

```sh
yarn start --port 8089
```

Build the source-based app:

```sh
xcodebuild -workspace packages/rn-tester/RNTesterPods.xcworkspace \
  -scheme RNTester -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5' \
  -derivedDataPath build/repro CODE_SIGNING_ALLOWED=NO build
agent-device boot --platform ios --device 'iPhone 17 Pro' --session inline-font-repro
agent-device install build/repro/Build/Products/Debug-iphonesimulator/RNTester.app \
  --platform ios --device 'iPhone 17 Pro' --session inline-font-repro
agent-device open com.meta.RNTester.localDevelopment --platform ios \
  --device 'iPhone 17 Pro' --session inline-font-repro --foreground \
  --metro-host 127.0.0.1 --metro-port 8089 \
  --launch-url rntester://example/PlaygroundExample/inline-view-font
```

The deep link opens **Inline View Font** directly. Compare the blue box bottom to the red baseline and read the error. Scroll to the remaining cases. You can also select the **Playground** tab.

To exercise font scaling, use `agent-device settings text-size` to record the existing category, set `accessibility-large`, and scroll to **Scaled / Helvetica 20**. Restore the recorded category after the comparison.

## Apply the fix

From the React Native checkout:

```sh
git apply ../fix.patch
```

Rebuild and reinstall the native app using the same commands above. A Metro reload alone does not rebuild Objective-C++.

## Run the Android comparison

Requires JDK 17, Node 24, Yarn 1.22.22, an arm64 Android Emulator, and `agent-device` on `PATH`. The pinned main revision uses Android SDK 37.0, Build Tools 37.0.0, NDK 28.2.13676358, and CMake 3.30.5. Set `ANDROID_HOME` to the SDK directory.

From the React Native checkout at the revision above, bundle the fixture into RNTester so it opens directly and can run without a Metro server:

```sh
yarn install --frozen-lockfile
yarn --cwd packages/react-native-codegen build
cp ../App.js packages/rn-tester/js/examples/Playground/InlineViewFontRepro.js
cp ../RNTesterEntry.js packages/rn-tester/js/InlineViewFontReproEntry.js
mkdir -p packages/rn-tester/android/app/src/main/assets
yarn --cwd packages/rn-tester react-native bundle \
  --config metro.config.js --platform android --dev false \
  --entry-file js/InlineViewFontReproEntry.js \
  --bundle-output android/app/src/main/assets/RNTesterApp.android.bundle
./gradlew :packages:rn-tester:android:app:assembleDebug \
  -PreactNativeArchitectures=arm64-v8a \
  -PreactNativeDevServerPort=8089 \
  --no-daemon --max-workers=6 --console=plain
agent-device boot --platform android --device p1 --session android-inline-font
agent-device install packages/rn-tester/android/app/build/outputs/apk/debug/app-arm64-v8a-debug.apk \
  --platform android --device p1 --session android-inline-font
agent-device open com.facebook.react.uiapp --platform android --device p1 \
  --session android-inline-font --foreground \
  --metro-host 127.0.0.1 --metro-port 8089
agent-device wait text 'Inline View Font' 15000 --session android-inline-font
agent-device logs path --session android-inline-font
```

Replace `p1` with the name of your arm64 emulator. Keep the compiler version resolved by `yarn install` in `packages/react-native/package.json` until the native build finishes; main's committed `hermes-compiler: 0.0.0` is a placeholder. The tested compiler version was `260318099.0.4`.

Record the current text-size setting, then compare the scaled row:

```sh
agent-device settings text-size --session android-inline-font
agent-device settings text-size accessibility-large --session android-inline-font
agent-device open com.facebook.react.uiapp --session android-inline-font --relaunch --foreground \
  --metro-host 127.0.0.1 --metro-port 8089
agent-device scroll bottom --session android-inline-font --settle
```

`INLINE_VIEW_ENVIRONMENT` records the actual font scale; `accessibility-large` produced 1.75 on the tested emulator. Restore the recorded setting and close the session after testing. The Android comparison uses the existing main renderer; the iOS patch does not change Android code.

## Native diagnostics

`diagnostics.patch` adds temporary logging at the actual attachment measurement. It is separate from the proposed fix and is not part of the upstream PR. Apply it before either build to inspect the attachment font, surrounding font, descender, glyph bounds, baseline, and View frame:

```sh
git apply ../diagnostics.patch
agent-device logs clear --restart --session inline-font-repro
agent-device open com.meta.RNTester.localDevelopment --platform ios \
  --device 'iPhone 17 Pro' --session inline-font-repro --relaunch --foreground \
  --metro-host 127.0.0.1 --metro-port 8089 \
  --launch-url rntester://example/PlaygroundExample/inline-view-font
agent-device logs path --session inline-font-repro
```

Remove the diagnostic instrumentation after collecting evidence:

```sh
git apply -R ../diagnostics.patch
agent-device close --session inline-font-repro
```

## Why this happens

`BaseTextShadowNode::buildAttributedString` already puts the surrounding Text attributes on the attachment fragment. `RCTNSAttributedStringFragmentFromFragment` drops the font when it creates an `NSTextAttachment` string. The frame calculation later reads `NSFontAttributeName` from that attachment character and adds its descender to the y coordinate.

The fix sets only the attachment's effective font with the same resolver used for ordinary text. It preserves the attachment and the existing placement formula. Apple's [NSAttributedString documentation](https://developer.apple.com/documentation/foundation/nsattributedstring) describes the default font used when font information is absent. See `evidence/` for the actual simulator observations.

If Watchman cannot access the checkout, use a temporary Metro config that merges RNTester's existing config with `resolver.useWatchman: false`, then pass its absolute path through `--config` when starting Metro or bundling. This only changes file watching. Stop Metro and remove the temporary config after testing.

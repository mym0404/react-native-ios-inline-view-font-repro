# Simulator results

Verified 2026-10-09 against React Native main `1449daad5e133c80fd643caccf9633201cb4c4f9`, built from source. Environment: Xcode 27.0 (27A266a), iPhone 17 Pro, iOS 26.5, Fabric, Node 24.18.0, Yarn 1.22.22, agent-device 0.21.22. The simulator has three physical pixels per point. The ordinary samples disable font scaling; the final sample enables it. The text-size setting was restored to its original `large` category after testing.

## Observations

Before the fix, attachment font attributes become **Helvetica 12**, with descender **-2.759766 pt**, even when the enclosing text uses Helvetica 32, Times New Roman 32, Courier Bold 24, or a scaled font. This is an observed UIKit fallback, not a nil font. The measured alignment error depends on the difference between that descender and the enclosing font's descender; it is not a constant 2.67 pt displacement relative to the text baseline.

For Helvetica 32, the native measurement records:

```text
Before: attachment font Helvetica 12, descender -2.759766
        inherited font Helvetica 32, descender -7.359375
        baseline 29.440625, View bottom 34.040234
After:  attachment font Helvetica 32, descender -7.359375
        inherited font Helvetica 32, descender -7.359375
        baseline 29.440625, View bottom 29.440625
```

The native View bottom exactly meets the native baseline in the cases without explicit lineHeight. Public View measurements add pixel-grid rounding.

| Sample | Before error (pt) | After error (pt) |
| --- | ---: | ---: |
| Helvetica 12 control | 0.000 | 0.000 |
| System 20 | 1.957 | -0.043 |
| Helvetica 32 | 4.559 | -0.107 |
| Times New Roman 32 | 4.151 | 0.151 |
| Courier Bold 24 | 3.000 | 0.000 |
| Tall View / Helvetica 20 | 2.000 | 0.000 |
| Wrapped / Helvetica 24 | 2.653 | -0.014 |
| Scaled Helvetica 20, default text size | 1.933 | -0.067 |
| Scaled Helvetica 20, accessibility-large | 7.235 | -0.099 |
| Helvetica 32 / lineHeight 48 | 10.293 | 5.626 |

Positive errors place the box bottom below the red text baseline. Native scaled-font diagnostics show the attachment changing from Helvetica 12 to Helvetica **42.859998**, matching its enclosing text, with descender **-9.856962**.

## Limits observed during verification

- **Explicit lineHeight:** the font inheritance bug is fixed, but the existing glyph-bound placement formula still leaves 5.6 pt of native error (5.626 pt after pixel rounding) in the lineHeight 48 sample. `RCTApplyBaselineOffsetForRange` applies `(48 - 36.8) / 2 = 5.6` pt to center the font in the requested line height. The attachment frame calculation uses the glyph bounds and font descender without accounting for `NSBaselineOffsetAttributeName`: its bottom is `48 - 7.359375 = 40.640625`, while TextKit reports the text baseline at `35.040625`. The difference is exactly 5.6 pt. The patch does not change this placement arithmetic.
- **Nested Text:** the inline View is visible, but the public `ref.measure()` returns a zero-size frame through the nested Text node. The UI reports `View measurement unavailable`; it does not display that frame as a valid alignment error. Inspect this row visually. The identical inner-font attachment is resolved through the same native fragment path.
- **Warnings:** source builds emitted existing deprecation, documentation, and third-party warnings. The modified attributed-string conversion compiled without errors.

The UI's `error` is the View bottom minus the text baseline, not a runtime error. Small residual values come from different rounding paths: `onTextLayout` reports fractional text coordinates, while `ParagraphShadowNode::layout` rounds attachment origins to the physical pixel grid. For Helvetica 32, the native attachment y is `11.107292`, but its public frame y is `11.000000`; the displayed error is therefore about `-0.107292` pt. At three pixels per point, one pixel is `0.333333` pt. This rounding difference is separate from the 5.6 pt lineHeight error.

## Evidence

- [Android comparison](ANDROID.md), including the same lineHeight, wrapping, tall View, and font-scaling cases.
- [Before](before.png) and [after](after.png), same top-of-screen samples.
- [Before lower samples](before-bottom.png) and [after lower samples](after-bottom.png).
- [Before font scaling](before-scaled.png) and [after font scaling](after-scaled.png).
- [Before log](before.log), [after log](after.log), and [structured measurements](measurements.json). Logs contain only the reproduction's diagnostic records. The JSON includes native measurements and the JavaScript measurement events.

## Verification

- ✅ RNTester source build before the fix: succeeded.
- ✅ RNTester source build with the font fix: succeeded.
- ✅ Native diagnostic instrumentation removed after capturing evidence.
- ✅ Existing `RCTAttributedTextUtilsTest` and `RCTFontTests`: **35 passed, 0 failed, 0 skipped**, on the final code without diagnostic instrumentation. [XCTest result summary](tests.json).
- ✅ `node scripts/clang-format.js --check packages/react-native/ReactCommon/react/renderer/textlayoutmanager/platform/ios/react/renderer/textlayoutmanager/RCTAttributedTextUtils.mm`: passed.
- ✅ Prettier and RNTester ESLint checks for the reproduction: passed.
- ✅ `git diff --check`: passed.
- ✅ Parsed native logs confirm that every patched attachment font name and size matches the surrounding font. The measured cases without lineHeight are within one physical pixel of the baseline.
- ⚠️ The lineHeight and nested-measurement limitations above remain visible in the reproduction.

The attributed-text utility test source is not registered in RNTester's default Xcode test target. For this run, the existing source was temporarily added to that target (no test implementation was changed), then the project change was removed before committing the fix:

```sh
ruby -rxcodeproj -e 'project = Xcodeproj::Project.open("packages/rn-tester/RNTesterPods.xcodeproj"); target = project.targets.find { |item| item.name == "RNTesterUnitTests" }; reference = project.new_file("../react-native/React/Tests/Text/RCTAttributedTextUtilsTest.mm"); target.source_build_phase.add_file_reference(reference); project.save'
xcodebuild -workspace packages/rn-tester/RNTesterPods.xcworkspace \
  -scheme RNTesterUnitTests -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5' \
  -derivedDataPath build/repro CODE_SIGNING_ALLOWED=NO \
  -only-testing:RNTesterUnitTests/RCTAttributedTextUtilsTest \
  -only-testing:RNTesterUnitTests/RCTFontTests test
```

# Testing on Android

The mechanics behind SKILL.md, section 10 "Tests". Read it before writing or changing tests, setting up CI, or taking the PR screenshots.

## Unit tests

Run with `kotlinx-coroutines-test` and a `MainDispatcherRule`; a ViewModel test asserts the sequence of states with Turbine, never internals. A test that needs no Android class runs on the JVM; Robolectric only where a resource or a DAO is involved.

## Screenshot tests

Screenshot tests are the two-viewport rule here.

- Each screen state has a preview test (Compose Preview Screenshot Testing, or Roborazzi) at a phone (`Pixel 8`) and a tablet (`Pixel Tablet`) device spec, light and dark, at font scale 1 and 1.5, in every shipped locale.
- Reference images are committed; a changed screen updates its references in the same PR and the image diff is reviewed. An unintended change is a bug.
- These are the screenshots the UI rule asks for. The fallback is a run on an emulator with the `demo` flavor captured by `adb exec-out screencap`, named `<screen>-<device>-<locale>`.

## End-to-end on a managed device

- A small set of instrumented flows: a `smoke` test suite (launch, sign-in, home) and one class per critical flow, on a Gradle Managed Device (`pixel8Api35`) against the `demo` flavor.
- Run each in every shipped locale: set the per-app language with `AppCompatDelegate.setApplicationLocales` at the start of the test, and assert on strings read from that locale's resources.
- Spinners never settle on their own: use `waitUntil { onAllNodesWithTag(...).fetchSemanticsNodes().isNotEmpty() }` with a `testTag` on the thing waited for, never `Thread.sleep`.

## CI tiers

- **Fast, on every PR:** `./gradlew spotlessCheck detekt lint testDemoDebugUnitTest validateDemoDebugScreenshotTest assembleDemoDebug` (Linux runner, Gradle cache).
- **Full, on a `v*` tag, the weekly run and manual runs:** the managed-device instrumented suite (`./gradlew pixel8Api35DemoDebugAndroidTest`), on a Linux runner with KVM (`ubuntu-latest` supports it with `enableKvm`); it opens an issue when red.
- Emulator minutes stay out of the PR tier, because CI minutes are budgeted and the instrumented suite is the slow part.

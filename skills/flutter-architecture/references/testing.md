# Flutter tests and checks: the mechanics

Detail behind SKILL.md, section 9 "Tests and checks". The test layout tree and the "Before reporting work done" list stay there; this file holds how each tier is wired and run.

## Widget and unit tests (`test/`)

- `test/support/pumpLocalized` pumps at 390x844 with the shipped theme and the real dictionaries, so a widget test sees the layout, colours and copy a phone user gets.
- Fakes live in `test/support/` (`RecordingLogger`, `MapFeatureConfig`, fixed repositories, `makeTweet`); repositories are tested against the `integrations/in_memory/` adapters, the same ones the e2e tier runs on.
- Cubits are tested with `expectLater(cubit.stream, emitsInOrder(...))`; each page gets a widget test per state.
- `test/architecture/dependency_rule_test.dart` scans `lib/` imports against the table in SKILL.md, section 1 "Layers and the dependency rule", and fails with the offending lines.
- `test/application/` holds the i18n parity scan, validators, the page shell at 390/768/1280, and the shared widgets.
- **What stays a widget test:** anything that does not need the real app wired through `IocManager`: a cubit, a page's states with fakes, the i18n parity scan. An integration test that only pumps one widget with fakes belongs in `test/`.

## End-to-end with `integration_test`

The SDK's `integration_test` package runs real widget tests inside the running app, on a device, an emulator or a browser. It is the Flutter equivalent of the Playwright tier and follows the same rules: critical flows only, at least a phone window and a desktop one, every shipped locale, a smoke set on every PR and the full set on release.

- **Backend:** always the in-memory one (`--dart-define=IN_MEMORY_BACKEND=true`), seeded with the demo account and tweets, so the flows are deterministic and CI needs no vendor config. A flow that must prove the real boundary is a manual signed-in pass on a device with the Firebase files, reported with what was seen.
- **Web, which is what CI runs:** `chromedriver --port=4444` in the background, then
  `flutter drive -d web-server --browser-name=chrome --browser-dimension=390,844 --driver=test_driver/integration_test.dart --target=integration_test/smoke_test.dart --dart-define=IN_MEMORY_BACKEND=true`.
  `--browser-dimension` is how the phone window is set; run the same target again with `1280,800` for desktop. Headless is the default on `web-server`.
- **Device or emulator:** `flutter test integration_test --dart-define=IN_MEMORY_BACKEND=true -d <device id>`; the window is the device, so run it on one phone profile and, for tablet layouts, one tablet.
- **Locale:** `tester.platformDispatcher.localeTestValue = const Locale('es')` before pumping, then assert on the Spanish dictionary's strings (load it from `assets/i18n/es.json`, never hard-code). Every shipped locale gets the same flow.
- **Waiting:** spinners never settle, so `pumpAndSettle` is not the tool; a `pumpUntil(tester, finder)` helper pumps in short steps until the finder matches or a timeout fails the test with the screen's current text.
- **Helpers** in `integration_test/support/`: `pumpUntil(tester, finder)`, `signInAsDemo(tester)`, `setLocale(tester, 'es')`, `takeScreenshot(binding, name)`.

## Screenshots

`await binding.takeScreenshot('home-390-es')` in the test, saved by `integrationDriver(onScreenshot:)` in `test_driver/integration_test.dart`, which writes `screenshots/<name>.png`. Name them `<screen>-<width>-<locale>` and link them in the PR. These are the screenshots the UI rule asks for; the manual browser recipe in the repo's `docs/development.md` is the fallback when drive cannot run.

## CI tiers

- **Fast job (every PR push and push to main):** adds chromedriver (`nanasess/setup-chromedriver`) to the usual checks and runs `smoke_test.dart` at 390 once.
- **Full job (`v*` tag, the weekly schedule, manual runs):** every `integration_test/` file at both dimensions and every locale; opens an issue when red.
- Emulator runs stay out of CI unless a change is Android-specific; they cost minutes an app this size does not need.

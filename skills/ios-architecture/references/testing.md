# iOS tests and checks: mechanics

The detail behind SKILL.md, section 11 "Tests and checks". The test layout tree and the "Before reporting work done" list stay in SKILL.md; this file holds how each tier is written and run.

## Unit tests

Swift Testing (`@Test`, `#expect`), `@MainActor` where the subject is. A view model test drives intents and asserts the sequence of states, never private state, because the state sequence is what the view renders. Fakes come from the in-memory adapters or a `TestSupport` target, never a mocking framework, so the fake the tests use is the same one previews and UI tests use.

## Snapshot tests

Snapshot tests are how this stack meets the two-viewport rule.

- Each screen state is recorded with `swift-snapshot-testing` at `.iPhone13` and `.iPadPro11` layouts, light and dark, in every shipped locale. Inject the locale through the environment.
- References are committed. A changed screen updates its references in the same PR and the image diff is reviewed; an unintended change is a bug, never something to re-record "to make CI green".
- These are the screenshots the UI rule asks for. The fallback is `xcrun simctl io booted screenshot` against the `Demo` scheme, named `<screen>-<device>-<locale>`.

## End-to-end (XCUITest)

- Kept to the critical flows, run against the in-memory backend on an iPhone and an iPad simulator.
- Launched per locale with `-IN_MEMORY_BACKEND YES -AppleLanguages (es) -AppleLocale es_ES`.
- Spinners never settle: wait with `XCTNSPredicateExpectation` or `waitForExistence(timeout:)` on an accessibility identifier, never `sleep`.
- Each flow attaches screenshots (`XCTAttachment(screenshot:)`, `.keepAlways`) named `<screen>-<device>-<locale>`; they are the screenshots linked in the PR.

## Locales in tests

Every tier that renders UI covers every shipped locale: snapshots inject the locale through the environment, XCUITest passes `-AppleLanguages` and `-AppleLocale` at launch. The String Catalog test (SKILL.md, section 10 "Copy") runs with the unit tests.

## Lint and format

`swiftlint --strict` with `file_length` (300), `function_body_length` (40), `type_body_length`, `file_name` and `force_cast`/`force_try` as errors, and a baseline for today's offenders that may only shrink; `swiftformat --lint`. Never a disable comment to get past them.

## CI tiers, and the macOS multiplier

GitHub's macOS runners bill at ten times the Linux rate against the shared minutes budget, so the PR tier is the smallest run that proves the build:

1. `swiftlint --strict` and `swiftformat --lint`.
2. `xcodebuild build-for-testing` once.
3. `xcodebuild test-without-building -testPlan Smoke` on one iPhone simulator (unit, snapshot and the smoke UI flow).

The full plan, `App.xctestplan` (every UI flow, both simulators, every locale), runs on a `v*` tag, the weekly run and manual runs, and opens an issue when red. Cache DerivedData and SwiftPM.

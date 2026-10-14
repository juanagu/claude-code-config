# React Native tests and checks: the mechanics

Read alongside SKILL.md, section 8 "Every outside dependency has a fake" and section 9 "Tests and checks", which hold the test layout and what each tier covers. This file holds how each tier is built and run.

## MSW handlers and the contract check

- `tests/support/msw/` holds MSW handlers for every call in a feature's `lib/`, seeded with demo data. The same handlers serve component and screen tests and the `demo` app variant (`EXPO_PUBLIC_BACKEND=in-memory`) that Maestro and reviewers run.
- MSW intercepts at the network, so the feature's real `lib/` functions and their Zod parsing run in every test; mocking the `lib/` module instead would skip the code most likely to break on a shape change.
- The handlers are validated in CI against the backend's published response contract (`contracts:sync` vendors it, `contracts:check` validates the handlers and demo data against it), as the web app does. A handler that only agrees with itself stays green while the real backend has changed shape.
- A new call in `lib/` gets its handler in the same change, validated against the contract, with a component test per state.

## Component tests

- React Native Testing Library, under `tests/components/`. Screens and components are tested by behaviour: `getByRole`, `getByText` with the dictionary's string, disabled state. Never internals, because a refactor that keeps the behaviour should keep the test green.
- Route files and layouts (guards, redirects) are tested through `expo-router/testing-library`'s `renderRouter`.
- Test providers (query client, theme, i18n) live in `tests/support/`. `jest.useFakeTimers()` only when a test needs them.
- A test that never renders a screen (a `lib/` function, a hook via `renderHook`, a store, the i18n parity test) is a Jest unit test under `tests/unit/`, never a Maestro flow.

## Maestro flows on both platforms

- Maestro is the e2e tier. Every flow runs on an iOS simulator and an Android emulator, against the development build with the in-memory backend, because the in-memory backend makes the flow deterministic and needs no running stack.
- Every flow runs in every shipped locale: launch with `--env LOCALE=es` (read by the app's dev settings) and assert on the dictionary's strings, so a missing or untranslated key fails the flow.
- Spinners never settle on their own: wait with `extendedWaitUntil` on a `testID`, never a fixed `sleep`, which is either flaky or slow.
- `.maestro/smoke.yaml` is the fast tier (launch, sign-in, home, default locale); one `<flow>.yaml` per critical path (sign-in and sign-up with their failures, the feed and a like, compose, each toggle off); shared settings in `.maestro/config.yaml`.

## Screenshots

- Screenshots come from the flows: `takeScreenshot: <screen>-<platform>-<locale>`, at a phone and a tablet on each platform (iPhone and iPad, a phone and a tablet AVD), light and dark. These are the screenshots the UI rule asks the PR to link.
- The fallback, when a state has no flow, is `xcrun simctl io booted screenshot` (iOS) or `adb exec-out screencap` (Android) against the demo variant.

## Lint, types and size

- `tsc --noEmit`; ESLint with `eslint-config-expo`, `unicorn/filename-case`, `eslint-plugin-boundaries`, `max-lines` (300) and `max-lines-per-function` (40), with a baseline of today's offenders that may only shrink. Never a disable comment to get past them.
- `npx expo-doctor` and `npx expo install --check` are green before a PR.

## CI tiers

- **Fast, on every PR, on a Linux runner:** lint, typecheck, Jest, `npx expo-doctor`, `contracts:check`, and `npx expo export` to prove the bundle builds.
- **Full, on a `v*` tag, the weekly run and manual runs:** an EAS build per platform (or a local prebuild on the runner) and every Maestro flow. Android runs on a Linux runner with KVM; iOS on a macOS runner, which bills at ten times the Linux rate and is why iOS flows stay out of the PR tier. A red full run opens an issue.
- Because the PR tier runs no Maestro flow, the flows a change touches are run locally on both platforms before pushing.

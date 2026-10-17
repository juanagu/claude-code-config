# Feature flags on Android

The mechanics behind SKILL.md, section 9 "Copy, toggles and checks". Read it before adding or changing a toggle.

## The port

Toggle keys and defaults live in one `FeatureFlags` object. A `FeatureFlagsRepository` port in `core:data` has two operations:

- `fun flag(key: FlagKey): StateFlow<Boolean>`, seeded from the defaults.
- `suspend fun load()`, the remote config or DataStore read with a short timeout.

A `load()` that fails keeps the defaults (off in production, per the Feature flags rule) and logs through the `Logger` port.

## The splash gate

`MainActivity` keeps the splash screen on (`setKeepOnScreenCondition`) until a `StartupViewModel` has awaited `load()`, so every later read is synchronous. Never `runBlocking` to wait for it.

## Gating a screen with a ViewModel

- The ViewModel exposes `enabled: StateFlow<Boolean> = flags.flag(key)` as its own property, never a case of the sealed `UiState`.
- The Route collects `enabled` first and hands the boolean to `FeatureGate`, a pure composable in `core:designsystem` that depends on nothing, so the module table in SKILL.md, section 1 "Layers and the dependency rule" holds.
- The Route collects `uiState` only inside the gate. With `WhileSubscribed` the data flow starts on first collection, and SKILL.md, section 3 "Unidirectional data flow" forbids work in `init`, so a feature that is off never loads.

## Gating a render-only feature

A feature with no ViewModel is gated by `app`: its entry provider reads `flags.flag(key)` and passes `enabled` into the Route.

## Where flags are never read

Never in a use case: a flag is a UI entry-point decision, not a business rule. Never read twice (in the ViewModel and again in the screen); the ViewModel's `enabled` flow, collected once by the Route, is the only read.

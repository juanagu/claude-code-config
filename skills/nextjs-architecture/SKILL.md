---
name: "nextjs-architecture"
description: "The architecture every Next.js/React web app and Astro static site in this setup follows: App Router feature folders with a lib/ port per feature, Server Components by default, route-group layouts for route- or session-dependent chrome, tokens in Tailwind @theme with shared primitives in src/shared/ui/, Astro islands only where needed, and the test layout. Invoke before writing, reviewing or planning any code under a Next.js or Astro project (src/, app/, tests/), and when deciding where a new file goes. Not for Flutter (flutter-architecture), Fastify (fastify-architecture), or an Expo/React Native project, whose app/ holds _layout.tsx route files (react-native-architecture); nor native Android or iOS (android-architecture, ios-architecture)."
---

# Next.js and Astro architecture

When a project has its own `docs/architecture.md`, that doc wins on specifics; this skill is the default shape and the checklist.

## 1. Next.js: layers and the dependency rule

```
src/
  app/                      routes only: page.tsx, layout.tsx, route handlers; each thin, importing from features/
    (app)/layout.tsx        route-group layout for route- or session-dependent chrome (auth header, per-route nav)
  features/<feature>/
    components/             presentational and compositional; never fetch
    hooks/                  state, effects, decisions
    lib/                    the feature's port: narrow server reads (server-only) and client calls, response types beside them; routes.ts for every href the feature owns
    feature_readme.md       purpose, exposed interface (the exports other features may import), data flow
  shared/
    ui/                     primitives (Button, Field, FormErrorMessage, brand mark) with their own feature_readme.md
    lib/                    transport only: base URL, cookie forwarding, timeout, response parsing, the error envelope
  i18n/                     one dictionary per locale typed by one Dictionary interface
  proxy.ts / middleware.ts  locale negotiation and redirect guards; shares one session validator with getSession()
```

- File names are kebab-case (`login-form.tsx` exports `LoginForm`, `use-session-refresh.ts` exports `useSessionRefresh`, and Astro components alike: `site-header.astro`); Next's reserved files (`page.tsx`, `layout.tsx`, `route.ts`) and `feature_readme.md` keep their names. ESLint enforces it with `unicorn/filename-case` (`kebabCase`).
- App Router, TypeScript strict. Server Components by default; `"use client"` only where interactivity or state requires it.
- **Components never fetch**, so each feature touches the backend contract in one place and components test without a network. Server reads live in the feature's `lib/` as narrow functions marked `server-only`, which makes an accidental import into a client bundle (with its cookies or secrets) a build error; mutations go in the feature's own server actions or its `lib/` client; pages and components call those.
- A feature owns its calls to the backend as narrow functions in its own `lib/`; `shared/lib` holds only the transport and the error envelope. No interface/adapter pair per fetch: on the frontend the feature's narrow `lib/` module is the port.
- A feature imports another only through the exports its `feature_readme.md` lists as its exposed interface (e.g. `auth/lib/routes.ts` for every auth href). `shared/` never imports a feature.
- Validate all external input (forms, search params, API responses) at the boundary.
- Business logic lives outside components (hooks, `lib/`); a component over ~200 lines, or one that both decides and renders, splits into a hook and presentational pieces.
- Feature code moves to `shared/` only once a second feature imports it.

## 2. Chrome, navigation and refresh

- Route- or session-dependent chrome lives in a route-group layout such as `app/(app)/layout.tsx`, never the root layout: shared layouts don't re-render on soft navigation, so a root layout that branches on route or session goes stale and `router.refresh()` won't fix it.
- After a client mutation that changes Server Component output (sign-in/out, locale, a setting), call `router.refresh()` **after** any `router.push()`; a refresh still pending when a navigation is dispatched is discarded.
- Guest-only and signed-in-only routes are guarded in `proxy.ts`/`middleware.ts` from one `isSession` validator shared with `getSession()`.
- Anything that renders on more than one route is checked against every route's existing shell for duplicated branding or redundant controls.

## 3. Design system

- Tokens defined once in Tailwind v4 `@theme` (colors, type scale, spacing, radii); everything reads them through utility classes. No raw hex or px in components.
- Primitives in `src/shared/ui/`; feature code composes them and never writes a variant's class string inline. The same long `className` in two files means a missing primitive: extract it.
- Mobile-first: the smallest-viewport layout first, enhanced upward with `min-width` breakpoints. A desktop-first component with `flex-wrap` bolted on is not mobile-first.
- A new primitive, variant, token or anything that renders on more than one route is a `designer` decision, not an engineer's.

## 4. i18n

- All UI copy comes from `src/i18n/{en,es}.ts` dictionaries typed by one `Dictionary` interface, and every new string goes into both: the shared type makes a key missing in either locale a typecheck error, while a hard-coded string ships untranslated unnoticed. The locale is a cookie negotiated from `Accept-Language` in the proxy.
- Every locale the project ships is verified on screen, not only the default.

## 5. Astro static and marketing sites

Static output by default, `client:*` islands only where a component needs JS, and landing pages designed desktop-led (1280 first, then 390 as its own adaptation). §3 (design system) applies, with the CSS still written base-up; §6 applies where the site has the pieces it names (a static site with no backend needs no fake backend or contract check); i18n takes the Astro form in the reference (one content dictionary per locale, path-based locales), because static output has no proxy to negotiate a cookie.

Read `references/astro.md` before writing or reviewing code in an Astro project.

## 6. Tests and checks

```
tests/
  unit/                 vitest for lib/ logic and hooks; a test that never opens a page is a unit test, never a Playwright spec
  e2e/<feature>*.spec.ts  Playwright for critical flows, two projects: chromium and mobile-chromium (390x844); layout assertions in the mobile project too
  support/              a fake backend server validated in CI against the backend's published schema (and its CORS headers)
```

- Server-side fetches cannot be intercepted with `page.route`: Playwright gets two `webServer` entries, the fake backend first, then the production build pointed at it. Extend that fake instead of mocking in the page.
- A `test:e2e:smoke` script (sign-in, home, the header at 390, route guards) is the fast CI tier; the full suite runs on a release tag and on a schedule.
- Boundary and size rules are enforced by lint once the repo opts in (`eslint-plugin-boundaries` or `dependency-cruiser`, `max-lines`, `max-lines-per-function`) with a baseline of today's offenders that may only shrink. Never add a disable comment to get past them.

Before reporting work done: lint, typecheck, unit tests, the e2e specs the change touches (CI on a PR runs only the smoke set), a production build, and screenshots at 390 and desktop for every state and every locale the change touches.

## 7. What goes wrong, and the correct form

| Seen in reviews | Do this instead |
| --- | --- |
| A component calling `fetch` | A `server-only` function in the feature's `lib/`, called from the page |
| One `apiClient` with every backend operation injected everywhere | Narrow functions per feature in its `lib/`; `shared/lib` only transports |
| Auth header or nav in the root layout | `app/(app)/layout.tsx` |
| `router.refresh()` before `router.push()` | Push first, refresh after: the navigation discards a pending refresh |
| Variant class string copied into a second file | Extract the primitive into `src/shared/ui/` |
| `LoginForm.tsx`, `authCookies.ts`: file named after its symbol | `login-form.tsx`, `auth-cookies.ts`; the export keeps its name |
| A Playwright spec asserting on a `lib/` function's return value | A vitest unit test |
| Desktop-only Playwright project | Add the mobile project before signing off |
| A fake backend that only agrees with itself | Validate it in CI against the backend's schema |

## Checklist for a review brief

1. Components never fetch; reads (`server-only`) and mutations sit in the feature's `lib/`.
2. Cross-feature imports only through each feature's exposed interface; `shared/` imports no feature.
3. Chrome that depends on route or session lives in a route-group layout.
4. No raw hex or px; primitives composed, none hand-rolled; mobile-first CSS.
5. Every string comes from both dictionaries; every shipped locale verified.
6. Unit tests in vitest, e2e in both Playwright projects, the fake backend validated against the real schema.
7. Files ~300 lines, functions ~40, components ~200.
8. File names kebab-case, framework-reserved names excepted; `unicorn/filename-case` green.

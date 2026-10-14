# Astro static and marketing sites

Read with SKILL.md: its sections on the design system (tokens, primitives, mobile-first CSS) and tests apply to an Astro project too; its i18n section does not, because it negotiates a cookie in a proxy that static output doesn't have. This file holds what differs in Astro, i18n included.

- `output: 'static'` by default; needing per-request SSR is a hint the project belongs on Next.js, which is built for it.
- Tailwind v4 with tokens in `@theme`; components organized by section (hero, features, footer), not by type.
- i18n via one content dictionary per locale implementing a shared interface, so a key missing in one locale fails typecheck; path-based locales (`/en`, `/es`) when pages must be crawlable per language, because a cookie-negotiated locale shows a crawler only the default.
- Images through `astro:assets`, not raw `<img>`, because it emits sized, optimized images and prevents layout shift.
- `client:*` islands only where a component truly needs JS (language switcher, copy button, live badge); every island ships its framework runtime to the page.
- Landing pages are designed desktop-led (1280 first), then 390 as its own adaptation; the CSS is still written base-up with `min-width` breakpoints.

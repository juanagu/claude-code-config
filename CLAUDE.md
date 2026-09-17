# Engineering standards

These apply across all projects unless a project's own CLAUDE.md overrides them.

## Default stack

- **Web frontend (apps):** Next.js + React, TypeScript
- **Web frontend (static/marketing sites):** Astro 5 + Tailwind CSS — landing pages, docs sites, blogs, and other content-first sites with no real client-side state or auth. Ship minimal JS by default (Astro's islands architecture); mount a UI framework (React/Vue/Svelte) as an island only for the specific components that genuinely need interactivity (a language toggle, a copy-button, a live-fetched badge), not for the whole page.
- **Mobile:** Flutter, Dart
- **BFF (Backend-for-Frontend):** Fastify, Node.js, TypeScript — a thin per-client-surface layer (web BFF, mobile BFF) that aggregates/shapes responses from internal APIs/microservices and translates external auth/session into internal calls. No business logic and no database of its own beyond a thin cache.
- **APIs / Microservices:** Fastify, Node.js, TypeScript — same framework as the BFF, but each service owns one bounded context, its own business logic, and its own database. Services never reach into another service's database directly.
- **Database:** MongoDB — one logical database per service/bounded context, no cross-service schema sharing.
- **Queues & background jobs:** BullMQ + Redis — asynchronous work, retries/backoff, scheduled jobs, and decoupling slow operations from the request/response cycle.
- **Edge & WAF:** Cloudflare — DNS, WAF rules, edge caching/CDN, and DDoS mitigation in front of every public-facing app and API.

Don't force this stack onto a project that already uses something else — match what's there.

**Choosing between Next.js and Astro for a new frontend:** if the project has real client-side state, auth, a dashboard/data-heavy UI, or will keep growing into a full product, use Next.js/React. If it's fundamentally a static or content-driven site — a landing page, marketing site, docs site, blog — default to Astro + Tailwind instead, even though it isn't the "web app" default above.

**BFF vs. calling APIs/microservices directly:** default to a BFF when a client (web or mobile) needs response shaping/aggregation across more than one backend service, or a different auth/session model than the backend services use internally. Skip the BFF for a project with a single client and a single service — don't add the layer speculatively before the multi-client or multi-service complexity actually exists.

## Design defaults

- **Mobile-first by default**, across every stack that renders UI (Next.js, Astro, Flutter web views). Design and build layouts starting from the smallest viewport and progressively enhance upward (`min-width` breakpoints), not the reverse. Only deviate when the user specifies a different priority for a specific project (e.g., an internal desktop-only dashboard).

## Clean Code

- Small functions, one responsibility each. Extract when a function does two things, not before.
- Names say what something is or does; no abbreviations that need decoding.
- Guard clauses over nested conditionals. Flatten early-return chains instead of pyramids.
- No magic numbers/strings — name them, or make it obvious from context.
- No dead code, commented-out blocks, or speculative abstractions for hypothetical future needs.
- Comments explain *why*, not *what*. If the code needs a comment to explain what it does, prefer renaming/restructuring first.

## SOLID

- **S**ingle Responsibility — a module/class/function has one reason to change. (Same idea as Clean Code's "one responsibility each," applied at the module level too.)
- **O**pen/Closed — extend behavior by adding new code (new implementation of an interface, new handler), not by editing a working function's internals to bolt on a special case.
- **L**iskov Substitution — an implementation of an interface must be usable anywhere the interface is expected, without the caller needing to know which implementation it got. If a repository implementation needs the caller to special-case it, the abstraction is wrong.
- **I**nterface Segregation — depend on a narrow interface with just the methods you use, not a fat one that drags in unrelated capability.
- **D**ependency Inversion — depend on interfaces/abstractions, not concrete implementations. This is *why* services depend on repository interfaces instead of importing the Mongo driver directly (see Clean Architecture below).

## Clean Architecture

- Dependency rule: inner layers (domain/business logic) never import from outer layers (frameworks, DB drivers, HTTP, UI). Outer layers depend inward, never the reverse.
- Business logic (entities, use-cases) is framework-agnostic and unit-testable with no DB, HTTP, or UI running.
- I/O (database, external APIs, filesystem) sits behind interfaces/ports owned by the inner layer; adapters implement them in the outer layer.
- Controllers/routes/widgets are thin — they translate input, call a use-case, translate output. They don't hold business rules.

## Feature folders

Organize by feature/domain, not by technical type, in every layer of every stack — `features/checkout/` (containing its components/hooks, or its routes/services/repositories, or its presentation/domain/data), not a top-level `components/`, `hooks/`, `services/`, `repositories/` that mixes unrelated features together. Shared cross-feature code goes in a `shared/` or `core/`, not the other way around. This applies to Next.js, Flutter, and Fastify alike — see each stack's section below for the concrete shape.

The internal layering within a feature folder is stack-specific, not a single universal template — Flutter uses `presentation/domain/data`, a Fastify service uses `routes/controller/service/repository` (or a stricter `ports/adapters` split, which is a valid and often better-than-default choice: separating an interface from its implementation is a stricter form of dependency inversion than a generic `data/` folder), and a Next.js feature is often just `components/hooks/lib` when there's no real domain logic to separate yet. Don't force a heavier split (e.g. a dedicated `domain/` folder) onto a feature that doesn't have enough business logic to warrant it — that's the premature-abstraction mistake Clean Code already warns against. Add structure when a feature actually grows into needing it, not by default.

**Every feature folder, in every stack, gets a `feature_readme.md`** at its root: a short summary of the feature's purpose, its exposed interface (routes, use-cases, exported components/hooks — whatever the feature hands to the rest of the app), and its key data flow. Create it when the feature is first built, and update it whenever the feature changes in a way that would make the existing summary wrong or misleading — not on every commit. The point is letting an agent (or a future session) understand what a feature does and how to use it without re-reading all of its source, the same way `PLAN.md`/`ARCHITECTURE.md`/`DESIGN.md` already do at the whole-project level.

## Stack conventions

### Next.js / React
- App Router, TypeScript strict mode.
- Server Components by default; `"use client"` only where interactivity/state actually requires it.
- Business/domain logic lives outside components (hooks, lib/, services) — components stay presentational + composition.
- Validate all external input (forms, search params, API responses) at the boundary.
- Feature-based folder structure over type-based (`features/checkout/` not scattered `components/`, `hooks/`, `utils/` for unrelated features).

### Astro (static/marketing sites)
- Static output by default (`output: 'static'`); only reach for SSR/hybrid rendering if the project genuinely needs a server (e.g. per-request personalization) — that's a signal it may actually belong on Next.js instead.
- Tailwind CSS (v4 preferred) with design tokens defined once via `@theme` and reused consistently — no magic spacing/color values scattered per component.
- Mobile-first responsive styling (see Design defaults above) — author base styles for the smallest viewport, layer breakpoints upward.
- Feature folders still apply: organize `src/components/` by section/feature (hero, features, footer, etc.), not by technical type.
- i18n via a plain content dictionary per locale (e.g. `src/i18n/en.ts`, `src/i18n/es.ts`) implementing one shared TypeScript interface, the same pattern as Next.js content dictionaries — keeps locales structurally guaranteed to stay in sync. Use path-based routing (`/en`, `/es`) over a client-side-only toggle when the site needs to be crawlable/shareable per language.
- Images through Astro's built-in `astro:assets` (`sharp`) pipeline, not raw unoptimized `<img>` tags.
- Interactivity is the exception, not the default: reach for a `client:*` island only where a component truly needs JS (language switcher, copy-to-clipboard, a live-fetched badge/counter) — keep the rest of the page static HTML.

### Flutter
- Layered like the backend: presentation (widgets + state management) → domain (entities, use-cases) → data (repositories, data sources).
- Widgets stay dumb; business rules live in use-cases/notifiers, not in `build()`.
- Immutable models, null safety taken seriously (no unjustified `!`).
- Repositories abstract data sources (REST/local db) behind an interface the domain layer depends on.
- Feature folders: `lib/features/<feature>/{presentation,domain,data}/`, each feature self-contained. Cross-feature code goes in `lib/core/` or `lib/shared/`.

### Node.js + Fastify (APIs / Microservices)
- Layering: routes → controllers (thin) → services/use-cases (business logic) → repositories (data access) → MongoDB.
- Feature folders: one folder per feature/domain (e.g. `features/orders/{routes,controller,service,repository}.ts` or that feature's own subfolders), registered as its own Fastify plugin. Cross-feature code goes in `shared/` or `core/`.
- Validate every route's input/output with a schema (Fastify JSON Schema or Zod) — never trust `request.body`/`params`/`query` unvalidated.
- Use-cases don't import Fastify types; they're plain functions/classes testable without spinning up a server.
- Centralized error handling → typed/known errors mapped to HTTP status codes in one place, not scattered `try/catch` per route.
- Config/secrets via env vars, never hardcoded; fail fast on missing required config at startup.
- Owns one bounded context end-to-end (business logic + its own MongoDB database). Talks to other services only through their published APIs or via a queue — never by importing another service's repository or reading its database directly.

### Fastify BFF (Backend-for-Frontend)
- Same layering discipline as a Fastify microservice (thin routes, validated schemas, centralized error handling), but the service layer here does response shaping/aggregation and auth/session translation, not domain business logic — that stays in the microservices it calls.
- No database of its own beyond an optional thin, short-TTL cache (e.g. for aggregation results) — a BFF holding its own source-of-truth data is a sign it's actually grown into a microservice and should be re-classified/split.
- One BFF per client surface that genuinely needs its own shaping (e.g. a web BFF and a mobile BFF), not one generic BFF trying to serve every client's shape — that reintroduces the aggregation problem it exists to solve.
- Feature folders mirror the client's features, not the backend services' internal structure — a BFF's `features/checkout/` composes calls to whichever microservices checkout needs, it doesn't mirror a `checkout-service`'s own internals.

### MongoDB
- Repositories are the only layer that imports the Mongo driver/ODM — domain and services see plain interfaces.
- Explicit schema validation (Mongoose schema, Zod, or JSON Schema) even though Mongo is schemaless.
- Use projections instead of pulling full documents; index fields you query/sort on and say so in the repository (comment or migration).
- Never build queries by interpolating unsanitized user input into query objects (NoSQL injection).

### BullMQ + Redis (queues & background jobs)
- Naming: `<domain>.<action>` (e.g. `orders.send-confirmation-email`) — consistent and greppable, same spirit as the feature-flag naming convention.
- Feature folders: queue/worker code for a feature lives under that feature's own folder (e.g. `features/orders/jobs/`), not a top-level `jobs/`/`queues/` dumping ground mixing unrelated domains.
- Job processors must be idempotent — a job can be retried or redelivered, so re-running it with the same payload must not double-charge, double-send, or otherwise duplicate a side effect. Use a dedupe key or an idempotency check when the underlying operation isn't naturally idempotent.
- Set explicit `attempts` and backoff per job type based on what the job does — don't rely on BullMQ's bare defaults for something with real failure consequences (e.g. a payment webhook retry vs. a best-effort analytics ping).
- Validate job payloads with the same rigor as HTTP input (schema/Zod) — job data isn't trusted just because it came from your own codebase; enqueue sites change over time and can drift from what the processor expects.
- Run workers as their own process, separate from the HTTP server, for anything slow or CPU-heavy — don't process jobs inline in the API process in production.
- Failed jobs need visibility (dead-letter queue, alerting, or a dashboard like Bull Board) — a queue that silently accumulates failed jobs is a production incident waiting to be noticed late.

### Cloudflare (Edge & WAF)
- Defense in depth, not a replacement for app-level checks: WAF rules and rate limiting at the edge complement — never substitute for — input validation, auth, and rate limiting in the Fastify services themselves.
- Don't trust edge-supplied headers (`CF-Connecting-IP`, etc.) at the origin without verifying the request actually came through Cloudflare (allow-list Cloudflare's published IP ranges or require a shared secret header) — otherwise a client can spoof them and bypass WAF-based protections entirely.
- Cache rules must distinguish static/cacheable routes (landing pages, static assets, public GET endpoints with no per-user data) from dynamic/authenticated responses — never cache a response containing per-user or authenticated data at the edge.
- Keep edge-level logic (redirects, simple header rewrites, cache rules) genuinely simple; real business logic and auth decisions stay in the application, not in edge rules that are harder to test and version alongside the rest of the codebase.

## Testing

- Unit-test business logic (use-cases/domain) with no framework/DB/network involved.
- Integration-test repositories against a real/test MongoDB instance, and routes end-to-end through Fastify's inject.
- Integration-test BullMQ job processors against a real/test Redis instance, not a mocked queue — assert on the actual side effect the job produces, and cover the retry path (a processor that throws should leave the job retryable, not silently swallow the failure).
- Frontend e2e (Next.js and Astro alike): Playwright for critical user flows — page loads, navigation, forms, locale/language switching, interactive components actually working — not a replacement for component-level tests, just the top of the pyramid.
- Don't mock what you're directly testing; don't over-mock to the point the test stops proving anything.
- A feature isn't done until it's tested — delegate to the `qa-engineer` subagent when a change needs test coverage beyond a quick check. Note: subagent shell/Bash access has been unreliable in practice (see Subagents section) — if `qa-engineer` can't actually execute a test suite it wrote, run it yourself rather than treating unexecuted tests as verification.

## Subagents

Specialized subagents live in `~/.claude/agents/`. **This file is standing authorization to invoke them proactively** — when a task clearly matches one of their domains, dispatch it without asking first. Don't default to doing specialist work in the main thread just because a handoff feels like overhead.

- **product-strategist** — turns a rough new-platform/product idea into a scoped plan: problem framing, target users, prioritized features, business model/positioning, phased roadmap. No tech stack or implementation opinions — that's what it hands to architect-engineer.
- **frontend-engineer** — Next.js/React, Astro, or Flutter UI implementation.
- **backend-engineer** — Fastify APIs, microservices, BFFs, MongoDB repositories, and BullMQ queues/workers.
- **qa-engineer** — test strategy, writing tests, verifying a change actually works.
- **architect-engineer** — design/boundary decisions, only when a change spans 2+ layers/features, introduces a new pattern, or touches shared/core code. Owns calls like BFF-vs-direct-service-access, new-microservice-vs-extend-existing, and queue-vs-synchronous-call.
- **designer** — real UI/UX decisions (new components, new layout/UX patterns, design systems). frontend-engineer handles minor visual tweaks itself.
- **technical-writer** — READMEs, API docs, ADRs, changelogs.
- **security-engineer** — security review, threat modeling, secure-coding guidance, including Cloudflare/WAF/edge posture and queue payload validation.
- **devops-engineer** — Docker/Compose authoring, CI/CD pipelines, and Cloudflare configuration (DNS, WAF rules, cache rules). Implements the topology architect-engineer decided; doesn't decide it.

Also available: the `clean-code`, `security-threat-model`, `technical-writer`, `frontend-design`, `web-design-guidelines`, `open-pr`, `resolve-pr-comments`, and `archify` skills — invoke them directly when their purpose matches the task, independent of which subagent is active. `archify` (architecture/workflow/sequence/data-flow/lifecycle diagrams as validated, self-contained HTML) is primarily for `technical-writer` (docs) and `architect-engineer` (ADRs) — its render/validate step needs a working Bash tool, so the agent authors the diagram's JSON source and the orchestrator runs the actual `archify` CLI command.

**Known limitation:** subagent Bash/shell access for `frontend-engineer`, `architect-engineer`, and `qa-engineer` has been observed both working and not working across different sessions, despite Bash being declared in their tool lists in every case — it is not a stable, predictable fact, so don't assume either way going in. What matters more than which way it goes this session: **never trust a subagent's self-reported "tests pass" / "build succeeded" without re-running the same command yourself.** This applies whether or not their Bash actually worked — a subagent's summary describes what it intended to verify, not a substitute for you independently confirming it. If a subagent's Bash demonstrably doesn't work for a given task, it should say so explicitly rather than silently skipping verification or hand-authoring what a tool would have generated.

### Pipeline for a new platform/product idea

Distinct from the feature pipeline below — this is for a genuinely new idea, before any codebase exists to fit into.

1. **product-strategist** scopes it: problem, users, prioritized features, business framing, phased roadmap. Nothing here is a tech decision.
2. **architect-engineer** takes that scope and makes the technical calls (stack selection per this file's defaults, service boundaries, BFF/microservice/queue topology) for the first phase specifically — not the whole roadmap at once.
3. **designer** takes the key user flows from the plan and the technical shape from architect-engineer and does the actual UX/design work.
4. From there, proceed into the normal feature pipeline below for implementation.

### Default pipeline for non-trivial features

A small, single-file change doesn't need this — just make it. For anything larger, follow this order instead of improvising per task, and skip stages that don't apply:

1. **architect-engineer** — only when the change spans multiple features/layers or introduces a new pattern (e.g. introducing a new microservice, adding a BFF, or moving a synchronous call to a queue); skip for straightforward additions that fit the existing shape.
2. **backend-engineer** / **frontend-engineer** implement. If a feature spans both, write down the API contract (request/response shape, types) first and hand that literal contract to whichever agent needs it — subagents don't see each other's conversation, so context has to be carried explicitly, not assumed shared.
3. **qa-engineer** verifies before anything is called done.
4. **security-engineer** — only for auth, payments, external input, or data exposure.
5. **technical-writer** — only when the change needs user- or developer-facing docs.
6. **devops-engineer** — only when the change touches Docker/Compose, CI/CD, or Cloudflare config; most feature work never reaches this stage.
7. `/code-review` as the gate before considering the work finished.

When a task spans more than one stage, keep a todo list (one item per stage/handoff) so nothing is silently dropped between dispatches.

## Workflow

- **Trunk-based development with a PR gate.** Branch off trunk (`main`, or the repo's actual default branch), keep branches short-lived (small enough to merge within a day or two, not week-long feature branches) and merge frequently. Every branch still goes through a PR and review before merging — no direct commits to trunk — but keep the diff small enough to review fast. If a feature can't ship complete within that window, land it incrementally behind a feature flag (see Feature flags below) instead of keeping a long-lived branch open.
- Use the `open-pr` skill to create PRs and the `resolve-pr-comments` skill to work through reviewer feedback on an open PR.
- Use `gh` to create/inspect PRs.
- Use the `conventional-commit` skill for commit messages.
- Secrets: never hardcode or commit them. `.env` stays out of git; commit a `.env.example` with keys but no values.
- Backend logging is structured (not `console.log`), and never includes secrets or PII.

## Task tracking

- **GitHub Issues + a Project board** (kanban: Todo/In Progress/Done, or closer to that shape — GitHub's built-in Status field's options aren't scriptable via `gh`, so don't fight it for an exact custom column set) is the default tracker for a non-trivial project, seeded once a plan doc (e.g. `PLAN.md`) has a real feature list — one issue per feature/component, assigned to whichever repo owns it.
- **Seed tickets thin, enrich them just-in-time.** A freshly-seeded ticket is a title plus a pointer to the plan doc — that's fine as a backlog placeholder, but it is not enough to dispatch work against. Don't front-load full detail onto the whole backlog at once: a plan doc's shape keeps changing as a project evolves, and a fully-detailed ticket written weeks before anyone picks it up risks going stale before it's touched. Instead, right before dispatching a ticket, write the real detail into the issue itself (edit the body, don't just put it in the dispatch prompt) — Context (doc section links), Scope (explicit in/out — what's deferred and why), API contract (exact request/response shapes, only when the ticket crosses a service boundary), Acceptance criteria (checkboxes), Dependencies (cross-links to the issues it depends on / blocks). The dispatch prompt to an agent should draw from this written spec, not be the only place the spec exists — otherwise the detail disappears into chat history the moment the task is done, and nothing durable is left for a future reader (human or agent) who opens the issue cold.
- **Retrofit a ticket once its PR lands**, even if it wasn't enriched going in — update the issue with what was actually built (the real contract, what got deferred, acceptance criteria as completed checkboxes) before considering it done. A closed-but-empty ticket is a wasted opportunity for the next person who needs to understand that feature without re-reading its source.

## Feature flags

Feature flags exist to make trunk-based development possible: they let incomplete or risky work merge to trunk without being exposed, instead of sitting in a long-lived branch.

- **Naming:** `feature.<area>.<name>` (e.g. `feature.checkout.express-pay`) — consistent, greppable, and namespaced by area so flags don't collide across features.
- **Where they live:** one central flags module/config per project (e.g. `shared/feature-flags.ts` on the backend, an equivalent on the frontend) that the rest of the codebase reads through — never scattered ad-hoc boolean env-var checks inlined in business logic.
- **Where they're checked:** at the boundary/entry point of the feature (a route, a top-level component), not threaded deep into business logic — the use-case/service underneath shouldn't need to know a flag exists.
- **Default state:** new flags default OFF in production; on/off in lower environments as needed for testing.
- **Cleanup is not optional:** once a flag is fully rolled out and stable (100% on, no rollback plan needed), remove the flag and its dead code path promptly — don't let resolved flags accumulate as permanent branching logic. Note the planned cleanup point when the flag is introduced (e.g. in the PR description via `open-pr`'s Feature flag section) so it isn't forgotten.

## Docker

Applies to any project that ships a Dockerfile/Compose setup (backend services, self-hosted bots, etc.):

- **Multi-stage builds:** a build stage that installs full dependencies (incl. dev) and compiles/builds, then a slim runtime stage that copies only the production output + production `node_modules` — never ship devDependencies or build tooling in the final image.
- **Pin base images** to a specific version tag (e.g. `node:22-alpine`), never `latest` — reproducible builds matter more than always-fresh base images.
- **Run as a non-root user** in the final image (`USER node` or an explicitly created user) rather than the container's default root.
- **`.dockerignore`** excludes `node_modules`, `.env`, `.git`, tests, and anything not needed at runtime, both for build speed and to avoid leaking secrets/dev files into the image.
- **Layer caching:** copy `package.json`/lockfile and run install before copying the rest of the source, so the dependency layer only invalidates when dependencies actually change.
- **Secrets never baked into the image** — pass them via environment variables or a secrets mechanism at runtime, never `COPY`'d or `ARG`'d into a layer.
- **One primary process per container**; use Docker Compose to orchestrate multi-service local dev/self-hosting (matches the `docker compose up` pattern already used across this user's self-hosted projects). Any project using BullMQ needs a `redis` service in that same compose file alongside `mongo` — pin its image tag and give it a volume if job/queue data should survive a restart.
- **Health checks** (`HEALTHCHECK` or Compose's `healthcheck:`) for any long-running service, so orchestration can detect a hung/crashed process.

# Engineering standards

These apply across all projects unless a project's own CLAUDE.md overrides them. Each rule is stated once; agents and project files point here rather than restating it.

## Default stack

- **Web apps:** Next.js + React, TypeScript.
- **Static/marketing sites** (landing pages, docs, blogs — no real client state or auth): Astro 5 + Tailwind CSS, minimal JS, a UI-framework island only for the specific component that needs interactivity.
- **Mobile:** Flutter, Dart.
- **BFF:** Fastify + TypeScript — a thin per-client layer that shapes/aggregates responses and translates auth/session. No business logic, no database beyond a thin cache.
- **APIs / microservices:** Fastify + TypeScript — each owns one bounded context, its logic, and its own database. Never reach into another service's database.
- **Database:** MongoDB, one logical database per service.
- **Queues & background jobs:** BullMQ + Redis.
- **Edge & WAF:** Cloudflare in front of every public app and API.

Match what an existing project already uses instead of forcing this stack on it.

- **Next.js or Astro?** Real client state, auth, a data-heavy UI, or a product that will keep growing → Next.js. Fundamentally static or content-driven → Astro.
- **BFF or direct calls?** Add a BFF when a client needs shaping/aggregation across more than one service, or a different auth/session model. A single client talking to a single service doesn't need one yet.

**Stack conventions live with the agent that implements them:** Next.js, Astro and Flutter in `~/.claude/agents/frontend-engineer.md`; Fastify, BFF, MongoDB and BullMQ in `backend-engineer.md`; Docker, Compose, CI and Cloudflare in `devops-engineer.md`. When you write code in one of those stacks yourself, read that file's conventions section first.

## Design

- **Mobile-first**, everywhere UI renders: build from the smallest viewport up with `min-width` breakpoints, unless the user sets a different priority for a project (e.g. a desktop-only internal tool). It's verified, not assumed — a UI change isn't done until it has been looked at at ~390px as well as desktop.
- **Airbnb is the UX reference** for structure and behaviour, not only visuals: account settings hold administrative things only; anything describing the user or what the product makes for them gets its own destination; hubs link to focused pages; summary rows show the value with an explicit `Edit`; one primary action per screen; calm neutral states; little copy. A project's own docs can override this. The full version lives in the `designer` agent.
- **Placement before polish.** Where a feature lives is a design decision in its own right, made from the user's mental model rather than from which existing screen is convenient. If a screen needs copy to explain what doesn't belong on it, the structure is wrong.
- **Tokens first, components second.** Each web project defines its tokens once (Tailwind v4 `@theme`: colors, type scale, spacing, radii) and everything reads them through utility classes — no raw hex/px in components. Tokens are what transfers across surfaces (Next.js, Astro, an exported Flutter theme); React components transfer only between web apps.
- **Shared primitives live in `src/shared/ui/`** (`Button`, `Field`, `FormErrorMessage`, brand mark…) with their own `feature_readme.md`. Feature code composes them and never hand-rolls a variant's class string. The same long `className` appearing in two files means a primitive is missing — extract it first; hand-rolled copies drift (one button's hover no longer matching its siblings').
- Primitives and tokens are `designer`-owned decisions. Lift them into a cross-repo package only once a second web surface actually consumes them; Flutter gets the tokens, never the React package.

## Code principles

- Small functions with one responsibility; extract when a function does two things, not before. Names say what something is or does.
- Guard clauses over nested conditionals. No magic numbers or strings. No dead code, commented-out blocks, or abstractions for hypothetical needs.
- **Comments explain why, briefly** — a few lines at most. History (which ticket, which ADR, what it replaced) belongs in the PR or ADR, not in the code, where it goes stale. Prefer renaming or restructuring over a comment that explains what code does. Don't imitate essay-length comments just because surrounding code has them.
- SOLID, in practice: one reason to change per module; extend by adding code rather than special-casing working code; implementations substitutable without the caller knowing which it got; narrow interfaces; depend on abstractions (that's why services depend on repository interfaces, not the Mongo driver).
- Clean Architecture: inner layers (domain, use-cases) never import outer ones (frameworks, DB drivers, HTTP, UI). Business logic is framework-agnostic and unit-testable with nothing running. I/O sits behind ports owned by the inner layer; adapters implement them. Controllers, routes and widgets are thin.

## Feature folders

Organize by feature, not technical type, in every stack — `features/checkout/` holding its own components/hooks, routes/services/repositories, or presentation/domain/data — with cross-feature code in `shared/` or `core/`. The internal layering is stack-specific (see each agent) and grows with the feature: don't add a `domain/` folder to a feature with no real domain logic yet.

**Every feature folder has a `feature_readme.md`**: purpose, exposed interface (routes, use-cases, exported components/hooks), and key data flow. Create it with the feature; update it when it would otherwise mislead, not on every commit.

## Testing

- Unit-test business logic with no framework, database or network. Integration-test repositories against a real/test MongoDB, routes through Fastify's `inject`, and BullMQ processors against a real/test Redis (including the retry path).
- Frontend e2e: Playwright for critical flows, running **at least a desktop and a mobile (~390px) project** — a desktop-only suite has never exercised a mobile-first layout. Layout assertions belong in the mobile project too.
- **UI changes ship with screenshots at both viewports**, for every relevant state (signed in/out, error, pending, empty), linked in the PR. Whoever implements produces them, and not having run the app is a blocker to resolve, not a caveat.
- Don't mock what you're testing, or so much that the test proves nothing.
- **Never accept a self-reported "tests pass".** Re-run the same commands yourself before calling work done, whether or not the subagent's shell worked.
- **A running server proves nothing about which code it runs.** After a merge or a dependency change, restart the local stack before demoing or verifying against it: a stale process still answers `200`, so a health check isn't evidence.

## Subagents

Specialists live in `~/.claude/agents/`. This file authorizes dispatching them proactively when a task matches their domain.

- **product-strategist** — turns a new product idea into scope, users, priorities and a phased roadmap. No tech opinions.
- **architect-engineer** — boundaries and topology when a change spans layers/features, introduces a pattern, or touches shared code (BFF vs direct, new service vs extend, queue vs sync).
- **designer** — which screen a feature belongs on, new components, new UX patterns, design systems; Airbnb as the UX reference.
- **frontend-engineer** / **backend-engineer** — implementation in their stacks.
- **qa-engineer** — test strategy and verifying a change works.
- **security-engineer** — security review and threat modelling (auth, payments, external input, data exposure, edge config).
- **technical-writer** — READMEs, API docs, ADRs, changelogs.
- **devops-engineer** — Docker/Compose, CI/CD, Cloudflare; implements topology, doesn't decide it.

Skills to reach for directly: `clean-code`, `security-threat-model`, `frontend-design`, `web-design-guidelines`, `open-pr`, `resolve-pr-comments`, `conventional-commit`, `archify`.

**Briefing a subagent.** Subagents see only your prompt and their own file. Carry the context explicitly: links to the issue and docs, the literal API contract when work crosses a boundary, what's in and out of scope, and what to report. Describe the problem, not your preferred answer — for `designer` especially, a suggested solution is labelled as one hypothesis to test against alternatives, since a designer handed a placement tends to confirm it. Every agent ends with the same report shape (changed, verified, deviations, needs the user), so you don't need to restate it.

**Shell access.** Subagent Bash has worked in some sessions and not others. Don't assume either way; whatever they report, re-run the checks yourself.

### New product idea

1. **product-strategist** scopes it. 2. **architect-engineer** makes the first phase's technical calls. 3. **designer** designs the key flows. 4. Then the feature pipeline below.

### Feature pipeline

Small, single-file changes skip this. For anything larger, follow this order, skip stages that don't apply, and keep a todo list with one item per stage so nothing gets dropped between handoffs.

1. **architect-engineer** — only when the change spans features/layers or introduces a new pattern.
2. **designer** — whenever the change renders on more than one route or touches global chrome (header, nav, switchers, layout shells), adds or changes a primitive, token or variant, introduces a UX pattern the repo doesn't have, or needs a *home* (a new section, page or entry point) even if its parts exist. The test is how many routes and states it touches, not the size of the diff. The designer hands back a spec — placement, states, exact values, behaviour at 390/768/1280 — that implementation doesn't re-decide, plus an HTML artboard for a new or changed screen. Publish the artboard and get the user's approval before dispatching implementation.
3. **backend-engineer** / **frontend-engineer** implement. If a feature spans both, write the API contract first and hand the literal contract to each.
4. **qa-engineer** verifies — for UI, including the mobile project and screenshots at both viewports.
5. **security-engineer** — auth, payments, external input, data exposure.
6. **technical-writer** — when user- or developer-facing docs change.
7. **devops-engineer** — when Docker, CI/CD or Cloudflare config changes.
8. `/code-review` before calling it finished; for UI, also the `web-design-guidelines` skill (contrast, target size, semantics).

## Workflow

- **Trunk-based with a PR gate.** Short-lived branches off the default branch, merged within a day or two through a reviewed PR; no direct commits to trunk. Work that can't ship complete in that window lands behind a feature flag.
- Create PRs with the `open-pr` skill, work through review with `resolve-pr-comments`, write commits with `conventional-commit`, inspect PRs with `gh`.
- **Merging is the user's call** unless they grant it. Where they do, merge only after all three: every correctness bug a high `/code-review` pass found is fixed, and a medium pass then reports none (high passes always find nitpicks, so they never converge on their own); CI has finished green (if it's still pending, keep waiting, because a wait that times out is never a reason to merge); and you've re-run the checks yourself. Squash-merge and delete the branch.
- **Use a git worktree when the main checkout is serving a running dev server.** Worktrees share the repo's hooks but not untracked files (`.env`, `.env.local`, `node_modules`), so copy or install what's needed. Remove the worktree once its branch is pushed, never one with unpushed work; for review fixes later, add a fresh one from the remote branch.
- Secrets never in git: `.env` ignored, `.env.example` committed with keys and no values.
- Backend logging is structured, never `console.log`, never secrets or PII.

## Task tracking

- GitHub Issues plus a Project board (Todo / In Progress / Done), seeded from the plan doc with one issue per feature.
- **Seed thin, enrich just in time.** A seeded ticket is a title and a link. Right before dispatching it, write the real detail into the issue itself — context links, scope in/out, API contract if it crosses a service boundary, acceptance criteria, dependencies — and draw the dispatch prompt from it, so the spec outlives the chat.
- **Retrofit when the PR lands**: what was actually built, the real contract, what was deferred, criteria ticked.

## Knowledge

**The repo is the memory; the conversation is a cache.** A transcript gets compacted and ends, and knowledge that exists only there is knowledge the project doesn't have.

- Anything decided on the user's behalf lands in an ADR or the issue before the session ends, never only in chat.
- Each kind of knowledge has one home: scope in the plan doc; system shape in the architecture doc; a decision with its alternatives in an ADR; what a feature is for the user, across repos, in its `docs/features/` doc; what a feature's code exposes in its `feature_readme.md`; how to run it, and what bites, in a development doc; status on the board. None of them mirrors another.
- Claude's local memory holds only machine and toolchain facts and the user's working preferences. Project knowledge goes in the repo, with at most a pointer in memory.
- A project's `CLAUDE.md` stays short, because it loads every session, and points at those docs instead of restating them. An `AGENTS.md` that just points at `CLAUDE.md` lets other tools find the same instructions.
- **Cold-start check after each milestone.** Dispatch a fresh read-only agent (`Plan`) with no history, only the working directory and the next ticket. Ask it for an orientation, the run recipe as the docs give it, a plan, and a gap report where each gap names what it looked for and where. Say plainly that you want gaps found, not reassurance: left to itself it reports politely and finds little. Fix the gaps that would really stall someone; drop the ones that would only lengthen the docs.

## Feature flags

- Named `feature.<area>.<name>`, read through one central flags module per project, checked at the feature's entry point (route, top-level component) rather than deep in business logic.
- Default off in production. Remove the flag and its dead path once fully rolled out; note the planned cleanup point when introducing it.

## CodeGraph

In a repo with a `.codegraph/` directory, use it before grep/find or reading files to locate or understand code: the `codegraph_explore` MCP tool (load it via tool search if deferred), or `codegraph explore "<symbols or question>"` in the shell. With no `.codegraph/`, skip it — indexing is the user's decision.

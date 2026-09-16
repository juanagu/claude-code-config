# claude-code-config

Personal [Claude Code](https://claude.com/claude-code) setup: global engineering standards, subagent definitions, and custom skills. Kept here so it's easy to bring onto a new machine instead of rebuilding it from scratch.

## What's in here

- **`CLAUDE.md`** — global engineering standards (`~/.claude/CLAUDE.md`): default stack, Clean Code/SOLID/Clean Architecture rules, feature-folder conventions, per-stack conventions (Next.js, Astro, Flutter, Fastify BFF/microservices, MongoDB, BullMQ+Redis, Cloudflare), testing standards, subagent roster and pipelines, trunk-based git workflow, feature flags, and Docker conventions.
- **`agents/`** — 9 subagent definitions (`~/.claude/agents/`):
  - `product-strategist` — turns a raw platform idea into a scoped plan (features, users, business model, roadmap). No implementation opinions.
  - `architect-engineer` — system/module design decisions, ADRs, BFF/microservice/queue topology calls.
  - `frontend-engineer` — Next.js/React, Astro, Flutter UI implementation.
  - `backend-engineer` — Fastify BFFs/APIs/microservices, MongoDB repositories, BullMQ workers.
  - `devops-engineer` — Docker/Compose, CI/CD, Cloudflare (WAF/cache/DNS) configuration.
  - `qa-engineer` — test strategy and verification, including Playwright e2e.
  - `designer` — UI/UX decisions, design systems.
  - `security-engineer` — security review across the whole stack.
  - `technical-writer` — READMEs, API docs, ADRs, changelogs.
- **`skills/`** — custom skills (`~/.claude/skills/`): `clean-code`, `conventional-commit`, `find-skills`, `frontend-design`, `pdf`, `security-threat-model`, `technical-writer`, `web-design-guidelines`, `open-pr`, `resolve-pr-comments`.
- **`install.ps1`** / **`install.sh`** — copy everything above into `~/.claude` on a new machine.

## Not included on purpose

- `archify` (architecture/workflow/sequence diagram skill) — it's a third-party skill from [tt-a1i/archify](https://github.com/tt-a1i/archify), vendored here would just go stale. Reinstall it instead:
  ```
  npx skills add tt-a1i/archify -g
  ```
  If that fails because `git` isn't installed/on PATH yet, download it manually instead:
  ```powershell
  Invoke-WebRequest -Uri "https://github.com/tt-a1i/archify/archive/refs/heads/main.zip" -OutFile archify.zip
  Expand-Archive archify.zip -DestinationPath archify-extract
  Copy-Item -Recurse archify-extract\archify-main\archify "$HOME\.claude\skills\archify"
  cd "$HOME\.claude\skills\archify"
  npm install --omit=dev
  node bin/archify.mjs doctor   # should report "Archify is ready."
  ```
- Anything under `~/.claude` that's machine/account-specific or sensitive: `.credentials.json`, `history.jsonl`, `sessions/`, `projects/` (per-project memory and transcripts), `cache/`, `settings.local.json`.

## Setting up on a new machine

1. Clone this repo.
2. Windows: `./install.ps1`. macOS/Linux: `./install.sh`.
3. Reinstall `archify` if you use it (see above).
4. Restart Claude Code (or start a new session) so it picks up the updated `~/.claude` config.

## Keeping this in sync

This repo doesn't auto-sync with `~/.claude` — when you update `CLAUDE.md`, an agent, or a skill locally, copy the change back here and commit it (or re-run the install script in reverse: copy from `~/.claude` into this repo).

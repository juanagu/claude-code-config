# claude-code-config

Personal [Claude Code](https://claude.com/claude-code) setup: global engineering standards, subagent definitions, and custom skills. Kept here so it's easy to bring onto a new machine instead of rebuilding it from scratch.

## What's in here

- **`CLAUDE.md`** — global engineering standards: default stack and how to choose within it, design defaults (mobile-first, Airbnb as the UX reference, placement before polish, tokens and primitives), code principles, feature folders, testing, the subagent roster and pipelines, workflow, task tracking, feature flags. Stack-specific conventions live in the agent that implements that stack.
- **`agents/`** — 9 subagent definitions (`~/.claude/agents/`):
  - `product-strategist` — turns a raw platform idea into a scoped plan (features, users, business model, roadmap). No implementation opinions.
  - `architect-engineer` — system/module design decisions, ADRs, BFF/microservice/queue topology calls.
  - `frontend-engineer` — Next.js/React, Astro, Flutter UI implementation; holds those stacks' conventions.
  - `backend-engineer` — Fastify BFFs/APIs/microservices, MongoDB repositories, BullMQ workers; holds those stacks' conventions.
  - `devops-engineer` — Docker/Compose, CI/CD, Cloudflare (WAF/cache/DNS) configuration and conventions.
  - `qa-engineer` — test strategy and verification, including Playwright e2e.
  - `designer` — where a feature belongs, UI/UX decisions and design systems, with Airbnb as the UX reference.
  - `security-engineer` — security review across the whole stack.
  - `technical-writer` — READMEs, API docs, ADRs, changelogs.
- **`skills/`** — custom skills (`~/.claude/skills/`): `clean-code`, `conventional-commit`, `find-skills`, `frontend-design`, `pdf`, `security-threat-model`, `technical-writer`, `web-design-guidelines`, `open-pr`, `resolve-pr-comments`.
- **`install.ps1`** / **`install.sh`** — link `~/.claude` to this repo (an `@` import for `CLAUDE.md`, junctions/symlinks for `agents/` and each skill), backing up whatever they replace.

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

There is only one copy. After running the install script, `~/.claude/CLAUDE.md` imports this repo's `CLAUDE.md` and `~/.claude/agents` and the skills point into this repo, so editing either path edits the same file. Commit changes here through a PR like any other repo. (It used to be copy-based, and the two copies drifted apart.)

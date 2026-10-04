# claude-code-config

My global [Claude Code](https://claude.com/claude-code) setup: engineering standards, subagents and skills. It lives in a repo so a new machine gets it in a couple of commands, and so changes to how Claude works go through a reviewed PR like any other code.

## How it works

There is one copy of the config, and it's this repo. The install script points `~/.claude` at it:

| `~/.claude/…` | Points to | How |
| --- | --- | --- |
| `CLAUDE.md` | `CLAUDE.md` | a one-line `@` import |
| `agents/` | `agents/` | junction (Windows) / symlink |
| `skills/<name>/` | `skills/<name>/` | one junction / symlink per skill; skills installed from elsewhere are left alone |

Edit a file through either path and you edit the same file. Nothing needs syncing; it just needs committing.

## What's in here

### `CLAUDE.md`: global standards

These load into every session. Default stack and how to choose within it; design defaults (mobile-first, Airbnb as the UX reference, placement before polish, tokens and shared primitives); code principles; feature folders with a `feature_readme.md`; testing; the subagent roster and the feature pipeline; trunk-based workflow; task tracking; feature flags; CodeGraph.

Stack-specific conventions (Next.js, Fastify, Docker…) live in the agent that implements that stack, so they load only when that agent runs.

### `agents/`: subagents

| Agent | Use it for |
| --- | --- |
| `product-strategist` | Turning a raw product idea into scope, users, priorities and a phased roadmap. No tech opinions. |
| `architect-engineer` | Boundaries and topology (BFF vs direct, new service vs extend, queue vs sync), short ADRs. |
| `designer` | Where a feature belongs, new components and UX patterns, design tokens. Airbnb as the UX reference. |
| `frontend-engineer` | Next.js/React, Astro and Flutter implementation, plus those stacks' conventions. |
| `backend-engineer` | Fastify BFFs/APIs, MongoDB repositories, BullMQ workers, plus those stacks' conventions. |
| `qa-engineer` | Test strategy and verification, including Playwright at desktop and ~390px. |
| `security-engineer` | Security review and threat modelling across the stack. |
| `technical-writer` | READMEs, API docs, ADRs, changelogs. |
| `devops-engineer` | Docker/Compose, CI/CD, Cloudflare configuration. |

Each one ends with the same report shape (changed, verified, deviations, needs the user). The order they run in is the feature pipeline in `CLAUDE.md`.

### `skills/`

| Skill | What it does |
| --- | --- |
| `open-pr` | Opens a PR the trunk-based way: checks the branch, runs local checks, writes the description, creates it with `gh`. |
| `resolve-pr-comments` | Triages unresolved review comments, fixes them, replies and resolves threads, asking before posting. |
| `conventional-commit` | Writes Conventional Commits messages. |
| `clean-code` | Clean Code refactoring guidance. |
| `frontend-design` | Distinctive, production-grade UI. |
| `web-design-guidelines` | Audits UI against web interface guidelines (contrast, target size, semantics). |
| `security-threat-model` | Repo-grounded threat model written as Markdown. |
| `technical-writer` | Documentation writing guidance. |
| `find-skills` | Finds and installs other skills. |
| `pdf` | Reads, fills, merges and creates PDFs. |

## Prerequisites

The config expects these on `PATH`. The install script doesn't install them.

| Tool | Needed for |
| --- | --- |
| `git`, [`gh`](https://cli.github.com/) (logged in) | The PR workflow; `open-pr` and `resolve-pr-comments` call `gh`. |
| Node.js | `npx skills add` and archify. |
| `codegraph` | The CodeGraph section of `CLAUDE.md` and the `codegraph_explore` MCP tool. Optional: without it Claude falls back to grep/Read. |
| [`rtk`](https://github.com/rtk-ai/rtk) | The Bash `PreToolUse` hook in my `settings.json` (see below). |

## Setting up a new machine

1. Install the prerequisites above.
2. Clone this repo somewhere permanent, since `~/.claude` will point into it. Moving it later means re-running the install.
3. Run the install script. It's safe to re-run, and anything it replaces is moved to `~/.claude/backup-<timestamp>/` first.
   - Windows: `./install.ps1` (junctions, no admin rights needed)
   - macOS/Linux: `./install.sh`
4. Recreate `~/.claude/settings.json` (see below).
5. Reinstall archify if you use it (see below).
6. Start a new Claude Code session so it reads the new config.

Check it worked: `/agents` should list the nine agents, and `/memory` should show the user `CLAUDE.md` importing this repo's.

## Not in this repo

### `settings.json`

`~/.claude/settings.json` isn't tracked yet. Mine holds:

- a `PreToolUse` hook on `Bash` that runs `rtk hook claude`
- `mcp__codegraph__*` in `permissions.allow`
- `"env": { "ENABLE_TOOL_SEARCH": "auto" }`, `"autoUpdatesChannel": "latest"`, `"tui": "fullscreen"`

If it ends up in this repo, the install script should copy it rather than link it. Claude Code rewrites the file itself (`/config`, "always allow" prompts), which can break a link, and on Windows a file symlink needs admin rights anyway.

### archify

[tt-a1i/archify](https://github.com/tt-a1i/archify) is a third-party diagram skill. A vendored copy here would go stale, so reinstall it instead:

```sh
npx skills add tt-a1i/archify -g
```

If that fails because `git` isn't on `PATH` yet:

```powershell
Invoke-WebRequest -Uri "https://github.com/tt-a1i/archify/archive/refs/heads/main.zip" -OutFile archify.zip
Expand-Archive archify.zip -DestinationPath archify-extract
Copy-Item -Recurse archify-extract\archify-main\archify "$HOME\.claude\skills\archify"
cd "$HOME\.claude\skills\archify"
npm install --omit=dev
node bin/archify.mjs doctor   # should report "Archify is ready."
```

### Machine and account state

`.credentials.json`, `settings.local.json`, `history.jsonl`, `projects/` (per-project memory and transcripts), `sessions/`, `cache/` and the rest of `~/.claude` stay out of git. They're per-machine, sensitive, or both.

## Making changes

- Edit the files here, or through `~/.claude/`, which is the same thing.
- **New skill:** add `skills/<name>/SKILL.md`, then re-run the install script so it gets linked. Agents need no re-run, because the whole folder is linked.
- **New agent:** add `agents/<name>.md`, then add it to the roster in `CLAUDE.md` and to the table above.
- Open a new session to pick up the change, then ship it through a PR (`open-pr`).

## Gotchas

- **Tools that edit `~/.claude/CLAUDE.md`.** Some installers (CodeGraph's, for one) append their instructions to the user `CLAUDE.md`. Here that file should hold only the `@` import: move anything useful into this repo's `CLAUDE.md` and delete the rest. Otherwise it loads twice, and the next install run moves it to a backup without telling you.
- **Agent frontmatter must be valid YAML.** If an agent's `description` contains a `: `, quote it, or the agent silently fails to load.

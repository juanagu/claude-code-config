# claude-code-config

My global [Claude Code](https://claude.com/claude-code) setup: engineering standards, subagents and skills. It lives in a repo so a new machine gets it in a couple of commands, and so changes to how Claude works go through a reviewed PR like any other code.

It's opinionated: a specific stack (Next.js, Astro, Fastify, MongoDB, BullMQ, Flutter, Cloudflare), trunk-based development, and Airbnb as the UX reference. If you want to borrow it, fork it and change `CLAUDE.md` to match how you work. See [Using it yourself](#using-it-yourself).

## How it works

There is one copy of the config, and it's this repo. The install script points `~/.claude` at it:

| `~/.claude/…` | Comes from | How |
| --- | --- | --- |
| `CLAUDE.md` | `CLAUDE.md` | a one-line `@` import |
| `agents/` | `agents/` | junction (Windows) / symlink |
| `skills/<name>/` for skills written here | `skills/<name>/` | one junction / symlink per skill |
| `skills/<name>/` for third-party skills | `skills.txt` | installed from upstream with [`npx skills`](https://github.com/vercel-labs/skills) |

Edit a file through either path and you edit the same file. Nothing needs syncing; it just needs committing. Third-party skills aren't vendored, so they never go stale here and their licenses stay with their authors.

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

### Skills

Written here, in `skills/`:

| Skill | What it does |
| --- | --- |
| `open-pr` | Opens a PR the trunk-based way: checks the branch, runs local checks, writes the description, creates it with `gh`. |
| `resolve-pr-comments` | Triages unresolved review comments, fixes them, replies and resolves threads, asking before posting. |

Installed from upstream, listed in `skills.txt`:

| Skill | Source | What it does |
| --- | --- | --- |
| `conventional-commit` | [github/awesome-copilot](https://github.com/github/awesome-copilot) | Conventional Commits messages. |
| `clean-code` | [sickn33/antigravity-awesome-skills](https://github.com/sickn33/antigravity-awesome-skills) | Clean Code refactoring pass. |
| `frontend-design` | [anthropics/skills](https://github.com/anthropics/skills) | Distinctive, production-grade UI. |
| `web-design-guidelines` | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | Audits UI against web interface guidelines (contrast, target size, semantics). |
| `security-threat-model` | [openai/skills](https://github.com/openai/skills) | Repo-grounded threat model written as Markdown. |
| `find-skills` | [vercel-labs/skills](https://github.com/vercel-labs/skills) | Finds and installs other skills. |
| `archify` | [tt-a1i/archify](https://github.com/tt-a1i/archify) | Architecture, sequence and data-flow diagrams as standalone HTML. |

To add one, add a `<github repo> <skill name>` line to `skills.txt` and re-run the install script. Each run installs the current upstream version, unpinned, and needs network access. Read a skill's diff before re-running if you care what changed: its `SKILL.md` loads into every session.

Two skills that used to be vendored here are gone on purpose: `pdf`, because its license doesn't allow redistribution and Claude already ships it as `anthropic-skills:pdf`; and the `technical-writer` skill, because it was removed upstream and the `technical-writer` agent covers the job.

## Prerequisites

The install script doesn't install these.

| Tool | Needed for |
| --- | --- |
| `git` | `npx skills` clones each skill's repo. |
| Node.js (`npx`) | Installing the skills in `skills.txt`. Without it, the script links everything else and skips them. |
| [`gh`](https://cli.github.com/), logged in | `open-pr` and `resolve-pr-comments`. |
| `codegraph` | Optional. The CodeGraph section of `CLAUDE.md` and its `codegraph_explore` MCP tool; without it Claude falls back to grep/Read. |
| [`rtk`](https://github.com/rtk-ai/rtk) | Optional. Only if you copy my `settings.json` hook (see below). |

## Setting up a new machine

1. Install the prerequisites.
2. Clone this repo somewhere permanent, since `~/.claude` will point into it. Moving it later means re-running the install.
3. Run the install script. It's safe to re-run, and anything it replaces is moved to `~/.claude/backup-<timestamp>/` first.
   - Windows: `./install.ps1` (junctions, no admin rights needed)
   - macOS/Linux: `./install.sh`
4. Recreate `~/.claude/settings.json` if you want my hooks and permissions (see below).
5. Start a new Claude Code session so it reads the new config.

Check it worked: `/agents` should list the nine agents, and `/memory` should show the user `CLAUDE.md` importing this repo's.

## Not in this repo

### `settings.json`

`~/.claude/settings.json` isn't tracked yet. Mine holds:

- a `PreToolUse` hook on `Bash` that runs `rtk hook claude`
- `mcp__codegraph__*` in `permissions.allow`
- `"env": { "ENABLE_TOOL_SEARCH": "auto" }`, `"autoUpdatesChannel": "latest"`, `"tui": "fullscreen"`

If it ends up in this repo, the install script should copy it rather than link it. Claude Code rewrites the file itself (`/config`, "always allow" prompts), which can break a link, and on Windows a file symlink needs admin rights anyway.

### Machine and account state

`.credentials.json`, `settings.local.json`, `history.jsonl`, `projects/` (per-project memory and transcripts), `sessions/`, `cache/` and the rest of `~/.claude` stay out of git. They're per-machine, sensitive, or both.

## Making changes

- Edit the files here, or through `~/.claude/`, which is the same thing.
- **New skill of your own:** add `skills/<name>/SKILL.md`, then re-run the install script so it gets linked. **Third-party skill:** add it to `skills.txt` instead.
- **New agent:** add `agents/<name>.md`, then add it to the roster in `CLAUDE.md` and to the table above. No re-run needed, because the whole folder is linked.
- Open a new session to pick up the change, then ship it through a PR (`open-pr`).

## Using it yourself

Fork it rather than installing it as-is: `CLAUDE.md` is one person's defaults. The parts most likely to transfer are the agent roster and pipeline, the report shape every agent ends with, and the two PR skills. The stack and design sections are the ones to rewrite.

## Gotchas

- **Tools that edit `~/.claude/CLAUDE.md`.** Some installers (CodeGraph's, for one) append their instructions to the user `CLAUDE.md`, and `codegraph upgrade` does it again, along with a `UserPromptSubmit` hook in `settings.json`. Here that file should hold only the `@` import: move anything useful into this repo's `CLAUDE.md` and delete the rest. Otherwise it loads twice, and the next install run moves it to `~/.claude/backup-<timestamp>/`, so anything you meant to keep is easy to miss.
- **Agent frontmatter must be valid YAML.** If an agent's `description` contains a `: `, quote it, or the agent silently fails to load.
- **Line endings.** `.gitattributes` keeps `*.sh` as LF. With `core.autocrlf=true` it would otherwise be checked out as CRLF, and `./install.sh` fails under Git Bash or WSL.

## License

[MIT](LICENSE) for everything written here. Skills in `skills.txt` are installed from their own repos under their own licenses.

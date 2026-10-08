---
name: "open-pr"
description: "Opens a pull request following this user's trunk-based-with-PR-gate workflow: verifies the branch is short-lived and off trunk, runs local checks, writes a structured PR description, and creates it via gh. Trigger when the user asks to open/create a PR, put up a PR, or ship a branch for review. Do not trigger for reviewing an existing PR (use code-review) or for resolving review feedback (use resolve-pr-comments)."
---

# Open PR

Create a pull request that fits this user's trunk-based development model (see `~/.claude/CLAUDE.md` Workflow section): short-lived branches, small diffs, PR review gate before merging to trunk, incomplete work shipped behind a feature flag rather than left in a long-lived branch.

## Quick start

1. Confirm current state: `git status`, `git branch --show-current`, `git log main..HEAD --oneline` (or the actual trunk branch name if not `main`).
2. If there are uncommitted changes, handle them first (stage/commit using the `conventional-commit` skill) — don't open a PR with a dirty working tree.
3. If you're on trunk itself, stop and tell the user — a PR needs a branch.

## Workflow

### 1. Sanity-check branch size and age
- `git log main..HEAD --oneline | wc -l` (commit count) and glance at `git diff main...HEAD --stat` for file/line count.
- If the diff looks large (many unrelated files, or clearly multiple features bundled), flag it to the user before proceeding — trunk-based dev wants small, fast-to-review PRs. Suggest splitting if it's an easy call; otherwise proceed if the user confirms it's intentionally one unit of work.
- If the branch has been open a long time relative to its size (stale, likely to conflict), mention it — don't silently let long-lived branches become the norm.

### 2. Run local checks before pushing
- Run this project's lint/type-check/test commands if they exist (check `package.json` scripts, or the project's README/CLAUDE.md for the actual commands).
- Run the e2e specs the change touches, where the project has a Playwright suite: the PR's CI runs only the smoke set, so this is the only time the rest runs before release.
- If checks fail, fix them or stop and tell the user — don't open a PR on a known-broken branch.
- For non-trivial changes, run the `clean-code` skill or invoke `qa-engineer`/relevant subagent per this repo's pipeline before considering the branch ready, if that hasn't already happened earlier in the task.

### 3. Push the branch
- If the project's CLAUDE.md grants Claude merge rights, push without asking: a project that lets you merge has already let you push. Otherwise confirm once per branch before `git push`, not per action within it.
- `git push -u origin <branch-name>`. The `git-guard` hook refuses a push to trunk or a force-push to it; if it fires, you are on the wrong branch, so fix that rather than retrying.

### 4. Write the PR description
Use conventional-commit-style semantics for the title (`type(scope): summary`, matching the `conventional-commit` skill's types). Structure the body as:

```markdown
## Summary
<1-3 bullets: what changed and why>

## Changes
<bullet list of the concrete changes, grouped by area/feature if it spans more than one>

## Testing
<how this was verified: tests added/run, manual verification steps, screenshots/GIFs for UI changes>

## Feature flag
<if this ships incomplete work behind a flag per the trunk-based model: name the flag, its default state, and the rollout/cleanup plan. Omit this section entirely if no flag is involved.>

## Related
<issue links, e.g. "Closes #123", or omit if none>
```

Pull the actual summary/changes from `git log main..HEAD` and `git diff main...HEAD`, not from memory of the conversation — the diff is the source of truth for what's actually in the PR.

### 5. Create the PR
- `gh pr create --title "<type(scope): summary>" --body "<description from step 4>"`.
- Open it ready for review, not as a draft: CI's fast tier is meant to run on every push, and it costs minutes only where the full suite would not.
- Default to a regular (non-draft) PR unless the user says the work is still in progress, in which case use `--draft`.
- If the user mentioned specific reviewers or the repo has an obvious CODEOWNERS pattern, add `--reviewer`; otherwise skip it rather than guessing.
- Report the PR URL back to the user.

### 6. Gate before merge
- Remind the user (don't do it unprompted) that `/code-review` is the gate before this PR should be considered mergeable, if it hasn't run yet.
- This skill only opens the PR — it does not merge it. Merging trunk-based work is still the user's call once CI is green and review is approved.

## Notes
- If the user's repo doesn't use `main` as trunk (e.g. `master`, `trunk`), detect the actual default branch via `gh repo view --json defaultBranchRef` rather than assuming.
- Never force-push over a PR branch without explicit confirmation for that specific push.

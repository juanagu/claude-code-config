#!/usr/bin/env bash
# Links ~/.claude to this repo so there is one copy of the config, not two:
#   ~/.claude/CLAUDE.md  -> a one-line import of this repo's CLAUDE.md
#   ~/.claude/agents     -> symlink to this repo's agents/
#   ~/.claude/skills/<x> -> symlink per skill in this repo (others left alone)
# then installs the third-party skills listed in skills.txt from upstream with `npx skills`.
# Anything replaced is moved to ~/.claude/backup-<timestamp>/ first. Re-running is safe.
# On Windows use install.ps1 (junctions need no admin rights; symlinks do).
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
claude_dir="$HOME/.claude"
backup_dir="$claude_dir/backup-$(date +%Y%m%d-%H%M%S)"

mkdir -p "$claude_dir/skills"

backup() { mkdir -p "$backup_dir"; mv "$1" "$backup_dir/"; }

link() {
  local path="$1" target="$2"
  [ -L "$path" ] && [ "$(readlink "$path")" = "$target" ] && return
  [ -e "$path" ] || [ -L "$path" ] && backup "$path"
  ln -s "$target" "$path"
}

import="@$script_dir/CLAUDE.md"
if [ ! -f "$claude_dir/CLAUDE.md" ] || [ "$(cat "$claude_dir/CLAUDE.md")" != "$import" ]; then
  [ -e "$claude_dir/CLAUDE.md" ] && backup "$claude_dir/CLAUDE.md"
  printf '%s\n' "$import" > "$claude_dir/CLAUDE.md"
fi

link "$claude_dir/agents" "$script_dir/agents"
for skill_dir in "$script_dir/skills/"*/; do
  link "$claude_dir/skills/$(basename "$skill_dir")" "${skill_dir%/}"
done

# A skill that moved from skills/ to skills.txt leaves a link to a folder that no longer exists.
for skill_link in "$claude_dir/skills/"*; do
  [ -L "$skill_link" ] && [ ! -e "$skill_link" ] || continue
  case "$(readlink "$skill_link")" in "$script_dir/skills/"*) rm "$skill_link" ;; esac
done

echo "Linked ~/.claude to $script_dir (CLAUDE.md import, agents/ and skills/ symlinks)."
[ -d "$backup_dir" ] && echo "Replaced files were moved to $backup_dir"

if ! command -v npx >/dev/null 2>&1; then
  echo "npx not found: skipped the skills in skills.txt. Install Node.js and re-run."
  exit 0
fi
failed=""
while read -r repo skill; do
  # </dev/null: npx would otherwise swallow the rest of skills.txt from stdin.
  npx -y skills add "$repo" --skill "$skill" --global --agent claude-code --yes </dev/null || failed="$failed $skill"
done < <(grep -vE '^[[:space:]]*(#|$)' "$script_dir/skills.txt")
[ -z "$failed" ] || { echo "Failed to install:$failed"; exit 1; }

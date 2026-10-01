#!/usr/bin/env bash
# Links ~/.claude to this repo so there is one copy of the config, not two:
#   ~/.claude/CLAUDE.md  -> a one-line import of this repo's CLAUDE.md
#   ~/.claude/agents     -> symlink to this repo's agents/
#   ~/.claude/skills/<x> -> symlink per skill in this repo (others left alone)
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

echo "Linked ~/.claude to $script_dir (CLAUDE.md import, agents/ and skills/ symlinks)."
[ -d "$backup_dir" ] && echo "Replaced files were moved to $backup_dir" || true
echo "archify isn't included here (see README) — reinstall it separately if you use it."

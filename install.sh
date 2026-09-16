#!/usr/bin/env bash
# Installs this repo's CLAUDE.md, agents/, and skills/ into ~/.claude on this machine.
# Existing files at the destination are overwritten; anything else in ~/.claude is untouched.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
claude_dir="$HOME/.claude"

mkdir -p "$claude_dir/agents" "$claude_dir/skills"

cp "$script_dir/CLAUDE.md" "$claude_dir/CLAUDE.md"
cp "$script_dir/agents/"*.md "$claude_dir/agents/"

for skill_dir in "$script_dir/skills/"*/; do
  name="$(basename "$skill_dir")"
  rm -rf "$claude_dir/skills/$name"
  cp -R "$skill_dir" "$claude_dir/skills/$name"
done

echo "Installed CLAUDE.md, agents/, and skills/ into $claude_dir"
echo "Don't forget: archify isn't included here (see README) — reinstall it separately if you use it."

// Installs a shim in this checkout's own hooks directory that runs the committed
// .githooks/pre-push of whichever branch is checked out. Wire it up as
//   "prepare": "node scripts/install-git-hooks.mjs"
// so `npm ci` installs it. Never sets core.hooksPath: that is shared by every
// worktree and would disable other hooks in .git/hooks.
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MARKER = '# managed-by: install-git-hooks';
const SHIM = `#!/bin/sh
${MARKER}
# Runs this worktree's committed hook if its branch has one.
hook="$(git rev-parse --show-toplevel)/.githooks/pre-push"
[ -f "$hook" ] || exit 0
exec sh "$hook" "$@"
`;

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

function main() {
  if (process.env.CI) return;
  try {
    if (git('rev-parse', '--is-inside-work-tree') !== 'true') return;
  } catch {
    return;
  }
  if (!existsSync(resolve(git('rev-parse', '--show-toplevel'), '.githooks/pre-push'))) return;

  const target = resolve(git('rev-parse', '--git-path', 'hooks'), 'pre-push');
  if (existsSync(target) && !readFileSync(target, 'utf8').includes(MARKER)) {
    console.warn(`install-git-hooks: ${target} exists and is not managed here; left alone.`);
    return;
  }
  writeFileSync(target, SHIM);
  chmodSync(target, 0o755);
}

main();

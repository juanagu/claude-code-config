// Installs a shim in the repo's shared hooks directory (common to all worktrees)
// that runs the committed .githooks/pre-push of whichever worktree is pushing.
// Wire it up as  "prepare": "node scripts/install-git-hooks.mjs"  so `npm ci`
// installs it. Never sets core.hooksPath: it is shared by every worktree and
// would disable other hooks in .git/hooks. Never fails `npm ci`: problems warn.
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const MARKER = '# managed-by: install-git-hooks';
const SHIM = `#!/bin/sh
${MARKER}
# Runs this worktree's committed hook if its branch has one.
hook="$(git rev-parse --show-toplevel)/.githooks/pre-push"
[ -f "$hook" ] || exit 0
exec sh "$hook" "$@"
`;

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const warn = (message) => console.warn(`install-git-hooks: ${message}`);

function hooksPathSetting() {
  try {
    return git('config', '--get', 'core.hooksPath');
  } catch {
    return '';
  }
}

function install() {
  if (process.env.CI) return;
  if (git('rev-parse', '--is-inside-work-tree') !== 'true') return;
  const committed = resolve(git('rev-parse', '--show-toplevel'), '.githooks/pre-push');
  if (!existsSync(committed)) return;

  const hooksPath = hooksPathSetting();
  if (hooksPath) return warn(`core.hooksPath is set to ${hooksPath}; pre-push hook not installed`);
  if (readFileSync(committed, 'utf8').includes('')) {
    warn('.githooks/pre-push has CRLF line endings and will fail under sh; add ".githooks/* text eol=lf" to .gitattributes and re-checkout it');
  }

  const target = resolve(git('rev-parse', '--git-common-dir'), 'hooks/pre-push');
  if (existsSync(target) && !readFileSync(target, 'utf8').includes(MARKER)) {
    return warn(`${target} exists and is not managed here; left alone`);
  }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, SHIM);
  chmodSync(target, 0o755);
}

try {
  install();
} catch (error) {
  warn(`pre-push hook not installed: ${error.message}`);
}

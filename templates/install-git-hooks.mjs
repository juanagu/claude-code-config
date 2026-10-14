// Points git at the committed .githooks/ directory. Wire it up as
//   "prepare": "node scripts/install-git-hooks.mjs"
// so `npm ci` installs the hook. Does nothing in CI or outside a git checkout.
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync } from 'node:fs';

const HOOKS_DIR = '.githooks';

if (process.env.CI || !existsSync('.git') || !existsSync(HOOKS_DIR)) process.exit(0);

execFileSync('git', ['config', 'core.hooksPath', HOOKS_DIR]);
// Git ignores a hook that isn't executable; the mode is lost on some checkouts.
chmodSync(`${HOOKS_DIR}/pre-push`, 0o755);

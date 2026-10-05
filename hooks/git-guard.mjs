#!/usr/bin/env node
// PreToolUse hook on Bash. Enforces the mechanical half of the trunk-based workflow in
// ~/.claude/CLAUDE.md so it never depends on the model remembering a sentence:
//   - no commit or merge while on trunk, no push straight to trunk, no force-push to it
//   - no --no-verify
//   - no branch switch in a checkout listed in ~/.claude/git-guard.json (it serves a dev server)
// Blocks with exit code 2 and the reason on stderr. Any error in the hook itself fails open.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_TRUNKS = ["main", "master"];
const BLOCK_EXIT_CODE = 2;

export function configPath() {
  return path.join(process.env.GIT_GUARD_HOME ?? homedir(), ".claude", "git-guard.json");
}

function git(dir, args) {
  return execFileSync("git", ["-C", dir, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

function normalize(p) {
  return path.resolve(p).replace(/\\/g, "/").replace(/\/$/, "").toLowerCase();
}

function loadProtectedCheckouts() {
  const file = configPath();
  if (!existsSync(file)) return [];
  const config = JSON.parse(readFileSync(file, "utf8"));
  return (config.protectedCheckouts ?? []).map(normalize);
}

function trunkOf(dir) {
  try {
    return git(dir, ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"]).replace(/^origin\//, "");
  } catch {
    return null;
  }
}

function isRef(dir, name) {
  try {
    git(dir, ["rev-parse", "--verify", "--quiet", `${name}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

function splitSegments(command) {
  return command
    .split(/\s*(?:&&|\|\||;|\||\n)\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function tokens(segment) {
  const matches = segment.match(/"[^"]*"|'[^']*'|\S+/g) ?? [];
  return matches.map((t) => t.replace(/^["']|["']$/g, ""));
}

function parseGit(toks) {
  let i = 0;
  while (i < toks.length && (toks[i] === "rtk" || /^[A-Za-z_][A-Za-z0-9_]*=/.test(toks[i]))) i++;
  if (toks[i] !== "git") return null;
  i++;
  let dirOverride = null;
  while (i < toks.length && toks[i].startsWith("-")) {
    if (toks[i] === "-C") {
      dirOverride = toks[i + 1];
      i += 2;
      continue;
    }
    if (toks[i] === "-c") {
      i += 2;
      continue;
    }
    i++;
  }
  return { sub: toks[i], rest: toks.slice(i + 1), dirOverride };
}

function isForce(rest) {
  return rest.some(
    (a) => a === "-f" || a === "--force" || a.startsWith("--force-with-lease") || /^-[a-zA-Z]*f[a-zA-Z]*$/.test(a),
  );
}

function pushTargetsTrunk(rest, onTrunk, trunk) {
  if (rest.includes("--delete") || rest.includes("-d")) return false;
  const refs = rest.filter((a) => !a.startsWith("-"));
  const named = refs.some((a) => a === trunk || a.endsWith(`:${trunk}`) || (a === "HEAD" && onTrunk));
  const implicit = refs.length <= 1 && onTrunk;
  return named || implicit;
}

function switchReason(toplevel) {
  return (
    `${toplevel} serves a running dev server (it is listed in ~/.claude/git-guard.json); ` +
    "switching its branch hot-reloads other code under whoever is using the app. " +
    "Use a worktree instead: git worktree add ../<repo>-wt-<name> -b <type>/<name>, then copy .env and run npm ci there."
  );
}

function checkoutSwitches(dir, rest) {
  if (rest.includes("--") || rest.includes("-p") || rest.includes("--patch")) return false;
  const args = rest.filter((a) => !a.startsWith("-"));
  if (rest.includes("-b") || rest.includes("-B")) return true;
  return args.some((a) => isRef(dir, a));
}

function checkGit({ sub, rest }, dir, protectedCheckouts) {
  if (rest.includes("--no-verify")) {
    return "--no-verify skips the repo's hooks. Fix what the hook reports instead.";
  }
  let branch;
  let toplevel;
  try {
    branch = git(dir, ["rev-parse", "--abbrev-ref", "HEAD"]);
    toplevel = git(dir, ["rev-parse", "--show-toplevel"]);
  } catch {
    return null;
  }
  const trunk = trunkOf(dir) ?? (DEFAULT_TRUNKS.includes(branch) ? branch : DEFAULT_TRUNKS[0]);
  const onTrunk = branch === trunk;

  if (sub === "commit" && onTrunk) {
    return `You are on ${branch}. Direct commits to trunk aren't allowed: git switch -c <type>/<name> first, then open a PR.`;
  }
  if (sub === "merge" && onTrunk) {
    return `Merging into ${branch} locally bypasses the PR gate. Open a PR and merge it there (gh pr merge --squash --delete-branch).`;
  }
  if (sub === "push" && pushTargetsTrunk(rest, onTrunk, trunk)) {
    return isForce(rest)
      ? `Force-pushing ${trunk} rewrites shared history. Not allowed.`
      : `Pushing straight to ${trunk} bypasses the PR gate. Push a branch and open a PR.`;
  }
  if (protectedCheckouts.includes(normalize(toplevel))) {
    if (sub === "switch") return switchReason(toplevel);
    if (sub === "checkout" && checkoutSwitches(dir, rest)) return switchReason(toplevel);
  }
  return null;
}

export function check(command, cwd) {
  const protectedCheckouts = loadProtectedCheckouts();
  let dir = cwd;
  for (const segment of splitSegments(command)) {
    const toks = tokens(segment);
    if (toks[0] === "cd" && toks[1]) {
      dir = path.resolve(dir, toks[1].replace(/^~(?=\/|$)/, homedir()));
      continue;
    }
    const parsed = parseGit(toks);
    if (!parsed) continue;
    const repoDir = parsed.dirOverride ? path.resolve(dir, parsed.dirOverride) : dir;
    const reason = checkGit(parsed, repoDir, protectedCheckouts);
    if (reason) return reason;
  }
  return null;
}

function main() {
  let reason = null;
  try {
    const input = JSON.parse(readFileSync(0, "utf8"));
    if (input.tool_name !== "Bash") return 0;
    const command = input.tool_input?.command ?? "";
    if (!/\bgit\b/.test(command)) return 0;
    reason = check(command, input.cwd ?? process.cwd());
  } catch {
    return 0;
  }
  if (!reason) return 0;
  process.stderr.write(`git-guard: ${reason}\n`);
  return BLOCK_EXIT_CODE;
}

function invokedDirectly() {
  if (!process.argv[1]) return false;
  try {
    // realpath: ~/.claude/hooks is a junction or symlink into the config repo.
    return realpathSync(path.resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (invokedDirectly()) {
  process.exit(main());
}

#!/usr/bin/env node
// PreToolUse hook on Bash and PowerShell. Enforces the mechanical half of the trunk-based workflow in
// ~/.claude/CLAUDE.md so it never depends on the model remembering a sentence:
//   - no commit, merge, rebase, cherry-pick, revert or am while on trunk
//   - no push straight to trunk, no force-push to or deletion of it
//   - no --no-verify, commit -n, or a -c override that disables hooks or signing
//   - no branch switch in a checkout listed in ~/.claude/git-guard.json (it serves a dev server)
// Blocks with exit code 2 and the reason on stderr. Any error in the hook itself fails open.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SHELL_TOOLS = new Set(["Bash", "PowerShell"]);
const CD_COMMANDS = new Set(["cd", "pushd", "Set-Location", "sl", "chdir"]);
const WRITES_COMMITS = new Set(["commit", "merge", "rebase", "cherry-pick", "revert", "am"]);
const CREATE_FLAGS = new Set(["-b", "-B", "-c", "-C", "--orphan"]);
const DISABLING_CONFIG = /^(core\.hookspath|commit\.gpgsign|gpg\.)/i;
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

// Git Bash and WSL write C:\x as /c/x or /mnt/c/x; path.resolve would turn those into C:\c\x.
function toNativePath(p) {
  const expanded = p.replace(/^~(?=\/|$)/, homedir());
  if (process.platform !== "win32") return expanded;
  const posixDrive = expanded.match(/^\/(?:mnt\/)?([A-Za-z])(\/.*)?$/);
  return posixDrive ? `${posixDrive[1].toUpperCase()}:${posixDrive[2] ?? "/"}` : expanded;
}

function normalize(p) {
  return path.resolve(toNativePath(p)).replace(/\\/g, "/").replace(/\/$/, "").toLowerCase();
}

function loadProtectedCheckouts() {
  const file = configPath();
  if (!existsSync(file)) return [];
  const config = JSON.parse(readFileSync(file, "utf8"));
  return (config.protectedCheckouts ?? []).map(normalize);
}

function isRef(dir, name) {
  try {
    git(dir, ["rev-parse", "--verify", "--quiet", `${name}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

function trunkOf(dir, branch) {
  try {
    return git(dir, ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"]).replace(/^origin\//, "");
  } catch {
    return DEFAULT_TRUNKS.find((t) => t === branch || isRef(dir, t)) ?? DEFAULT_TRUNKS[0];
  }
}

// Splits on shell separators outside quotes, and skips heredoc bodies (a commit message is not a command).
function splitSegments(command) {
  const segments = [];
  let current = "";
  let quote = null;
  let i = 0;
  while (i < command.length) {
    const ch = command[i];
    if (quote) {
      if (ch === quote) quote = null;
      current += ch;
      i++;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      i++;
    } else if (ch === "\n" && /<<-?\s*['"]?(\w+)['"]?/.test(current)) {
      const delimiter = current.match(/<<-?\s*['"]?(\w+)['"]?/)[1];
      const end = command.indexOf(`\n${delimiter}`, i);
      segments.push(current);
      current = "";
      i = end === -1 ? command.length : end + delimiter.length + 1;
    } else if (ch === "\n" || ch === ";" || ch === "|" || command.startsWith("&&", i)) {
      segments.push(current);
      current = "";
      i += command.startsWith("&&", i) || command.startsWith("||", i) ? 2 : 1;
    } else {
      current += ch;
      i++;
    }
  }
  segments.push(current);
  return segments.map((s) => s.trim()).filter(Boolean);
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
  const configs = [];
  while (i < toks.length && toks[i].startsWith("-")) {
    if (toks[i] === "-C") dirOverride = toks[i + 1];
    if (toks[i] === "-c") configs.push(toks[i + 1] ?? "");
    i += toks[i] === "-C" || toks[i] === "-c" ? 2 : 1;
  }
  return { sub: toks[i], rest: toks.slice(i + 1), dirOverride, configs };
}

function positionals(rest) {
  return rest.filter((a) => !a.startsWith("-") || a === "-");
}

function skipsHooks(sub, rest, configs) {
  if (rest.includes("--no-verify")) return true;
  if (configs.some((c) => DISABLING_CONFIG.test(c))) return true;
  return sub === "commit" && rest.some((a) => /^-[a-zA-Z]*n[a-zA-Z]*$/.test(a));
}

function isForce(rest) {
  return rest.some(
    (a) => a === "-f" || a === "--force" || a.startsWith("--force-with-lease") || /^-[a-zA-Z]*f[a-zA-Z]*$/.test(a),
  );
}

// `+main`, `refs/heads/main`, `HEAD:main` and `feat:refs/heads/main` all land on main.
function destinationOf(refspec) {
  const dst = refspec.includes(":") ? refspec.slice(refspec.indexOf(":") + 1) : refspec;
  return dst.replace(/^\+/, "").replace(/^refs\/heads\//, "");
}

function isHead(ref) {
  return ref === "HEAD" || ref === "@" || /^(HEAD|@)[~^]/.test(ref);
}

function pushReason(rest, onTrunk, trunk) {
  const refs = positionals(rest);
  const named = refs.some((a) => destinationOf(a) === trunk || (isHead(a) && onTrunk));
  if (rest.includes("--delete") || rest.includes("-d")) {
    return named ? `Deleting the remote ${trunk} isn't allowed.` : null;
  }
  const everything = rest.includes("--all") || rest.includes("--mirror");
  const implicit = refs.length <= 1 && onTrunk && !rest.includes("--tags");
  if (!named && !implicit && !everything) return null;
  return isForce(rest) || refs.some((a) => a.startsWith("+"))
    ? `Force-pushing ${trunk} rewrites shared history. Not allowed.`
    : `Pushing straight to ${trunk} bypasses the PR gate. Push a branch and open a PR.`;
}

function switchReason(toplevel) {
  return (
    `${toplevel} serves a running dev server (it is listed in ~/.claude/git-guard.json); ` +
    "switching its branch hot-reloads other code under whoever is using the app. " +
    "Use a worktree instead: git worktree add ../<repo>-wt-<name> -b <type>/<name>, then copy .env and run npm ci there."
  );
}

// The branch a `switch`/`checkout` lands on, or null when it only touches files.
// "-" (the previous branch) and a branch that exists only on origin both count as a switch.
function switchTarget(dir, sub, rest) {
  if (rest.includes("--") || rest.includes("-p") || rest.includes("--patch")) return null;
  const create = rest.findIndex((a) => CREATE_FLAGS.has(a));
  if (create !== -1) return rest[create + 1] ?? "-";
  const args = positionals(rest);
  if (sub === "switch") return args[0] ?? null;
  if (args.length !== 1) return null;
  const [arg] = args;
  const looksLikeBranch = arg === "-" || isRef(dir, arg) || isRef(dir, `origin/${arg}`) || !existsSync(path.resolve(dir, arg));
  return looksLikeBranch ? arg : null;
}

function checkGit({ sub, rest, configs }, dir, state) {
  if (skipsHooks(sub, rest, configs)) return "--no-verify (or a config override of hooks/signing) is not allowed. Fix what the hook reports instead.";
  let branch;
  let toplevel;
  try {
    toplevel = git(dir, ["rev-parse", "--show-toplevel"]);
    branch = state.branches.get(normalize(toplevel)) ?? git(dir, ["rev-parse", "--abbrev-ref", "HEAD"]);
  } catch {
    return null;
  }
  const trunk = trunkOf(dir, branch);
  const onTrunk = branch === trunk;

  if (WRITES_COMMITS.has(sub) && onTrunk) {
    return `You are on ${branch}. Writing commits to trunk locally (${sub}) bypasses the PR gate: git switch -c <type>/<name> first, then open a PR.`;
  }
  if (sub === "push") return pushReason(rest, onTrunk, trunk);
  if (sub === "switch" || sub === "checkout") {
    const target = switchTarget(dir, sub, rest);
    if (!target) return null;
    if (state.protectedCheckouts.includes(normalize(toplevel))) return switchReason(toplevel);
    if (target !== "-") state.branches.set(normalize(toplevel), target);
  }
  return null;
}

export function check(command, cwd) {
  const state = { protectedCheckouts: loadProtectedCheckouts(), branches: new Map() };
  let dir = toNativePath(cwd);
  for (const segment of splitSegments(command)) {
    const toks = tokens(segment);
    if (CD_COMMANDS.has(toks[0]) && toks[1]) {
      dir = path.resolve(dir, toNativePath(toks[1]));
      continue;
    }
    const parsed = parseGit(toks);
    if (!parsed) continue;
    const repoDir = parsed.dirOverride ? path.resolve(dir, toNativePath(parsed.dirOverride)) : dir;
    const reason = checkGit(parsed, repoDir, state);
    if (reason) return reason;
  }
  return null;
}

function main() {
  let reason = null;
  try {
    const input = JSON.parse(readFileSync(0, "utf8"));
    if (!SHELL_TOOLS.has(input.tool_name)) return 0;
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

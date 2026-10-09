#!/usr/bin/env node
// `npx -y github:juanagu/claude-code-config [-- --dir <path> <install.mjs options>]`
// clones a permanent copy of the repo, or fast-forwards the one it finds, then runs
// that copy's install.mjs. npx's own copy is a cache entry npm replaces at will, so
// ~/.claude must never link into it.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

// The clone URL comes from package.json's `repository`, so a fork that edits that one
// field bootstraps itself. `--repo <url or path>` overrides it.
const DEFAULT_DIR = join(homedir(), "Projects", "claude-code-config");

const args = process.argv.slice(2);
if (args[0] === "--") args.shift();
let dirArg = process.env.CLAUDE_CODE_CONFIG_DIR ?? null;
let repo = null;
const passthrough = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--dir") dirArg = args[++i];
  else if (args[i] === "--repo") repo = args[++i];
  else passthrough.push(args[i]);
}
repo ??= repoFromPackage();

const dir = resolve(dirArg ?? (await chooseDir()));

if (!existsSync(join(dir, ".git"))) {
  if (existsSync(dir)) fail(`${dir} exists and is not a git clone. Pass --dir <path> to use another location.`);
  console.log(`Cloning ${repo} into ${dir}`);
  run("git", ["clone", repo, dir]);
} else {
  const dirty = spawnSync("git", ["-C", dir, "status", "--porcelain"], { encoding: "utf8" }).stdout?.trim();
  if (dirty) fail(`${dir} has uncommitted changes. Commit or stash them, then run this again.`);
  console.log(`Updating ${dir}`);
  run("git", ["-C", dir, "pull", "--ff-only"]);
}

const install = spawnSync(process.execPath, [join(dir, "install.mjs"), ...passthrough], { stdio: "inherit" });
process.exit(install.status ?? 1);

async function chooseDir() {
  if (existsSync(join(DEFAULT_DIR, ".git")) || !stdin.isTTY || !stdout.isTTY) return DEFAULT_DIR;
  const rl = createInterface({ input: stdin, output: stdout });
  const answer = (await rl.question(`Where should the clone live? ~/.claude will point into it. [${DEFAULT_DIR}] `)).trim();
  rl.close();
  return answer || DEFAULT_DIR;
}

function repoFromPackage() {
  const pkg = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "package.json"), "utf8"));
  const spec = typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url;
  if (!spec) fail("package.json has no `repository` field, so there is nothing to clone.");
  const github = spec.match(/^github:([^/]+\/[^/]+?)(?:\.git)?$/);
  return github ? `https://github.com/${github[1]}.git` : spec;
}

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, { stdio: "inherit" });
  if (result.error) fail(`${command} could not be started: ${result.error.message}`);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

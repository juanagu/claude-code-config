#!/usr/bin/env node
// `npx -y github:juanagu/claude-code-config [--dir <path>] [--repo <url>] [install.mjs options]`
// clones a permanent copy of the repo, or fast-forwards the one it finds, then runs that
// copy's install.mjs. npx's own copy is a cache entry npm replaces at will, so ~/.claude
// must never link into it. The clone URL comes from package.json's `repository`, so a
// fork that edits that one field bootstraps itself.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { cloneTargetFromPackage, parseBootstrapArgs, sameRepo } from "../scripts/install/bootstrap.mjs";
import { gitOriginUrl, gitPull, runNode } from "../scripts/install/env.mjs";
import { readJson } from "../scripts/install/json.mjs";
import { expandHome } from "../scripts/install/paths.mjs";

const DEFAULT_DIR = join(homedir(), "Projects", "claude-code-config");
const packageJson = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");

try {
  const { dir: dirArg, repo: repoArg, passthrough } = parseBootstrapArgs(process.argv.slice(2), process.env);
  const target = repoArg ? { url: repoArg, ref: null } : cloneTargetFromPackage(readJson(packageJson));
  const dir = resolve(expandHome(dirArg ?? (await chooseDir())));

  if (existsSync(join(dir, ".git"))) update(dir, target.url);
  else clone(dir, target);

  if (!existsSync(join(dir, "install.mjs"))) fail(`${dir} has no install.mjs. Is it a clone of this repo?`);
  process.exit(runNode(join(dir, "install.mjs"), passthrough));
} catch (error) {
  fail(error.message);
}

// The pull happens here, in the always-fresh npx copy, so a clone from before
// install.mjs existed is brought up to date before its installer is run.
function update(dir, url) {
  const origin = gitOriginUrl(dir);
  if (origin && !sameRepo(origin, url)) fail(`${dir} is a clone of ${origin}, not ${url}. Pass --dir <path> for a second clone.`);
  console.log(`Updating ${dir}${origin ? ` from ${origin}` : ""}`);
  gitPull(dir);
}

function clone(dir, { url, ref }) {
  if (existsSync(dir)) fail(`${dir} exists and is not a git clone. Pass --dir <path> to use another location.`);
  console.log(`Cloning ${url}${ref ? ` (${ref})` : ""} into ${dir}`);
  const result = spawnSync("git", ["clone", ...(ref ? ["--branch", ref] : []), url, dir], { stdio: "inherit" });
  if (result.error) fail(`git could not be started: ${result.error.message}`);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

async function chooseDir() {
  if (existsSync(join(DEFAULT_DIR, ".git")) || !stdin.isTTY || !stdout.isTTY) return DEFAULT_DIR;
  const rl = createInterface({ input: stdin, output: stdout });
  const answer = (await rl.question(`Where should the clone live? ~/.claude will point into it. [${DEFAULT_DIR}] `)).trim();
  rl.close();
  return answer || DEFAULT_DIR;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

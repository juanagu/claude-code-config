#!/usr/bin/env node
// `npx -y github:juanagu/claude-code-config [-- --dir <path> --repo <url> <install.mjs options>]`
// clones a permanent copy of the repo and runs that copy's install.mjs, or hands an
// existing clone to `install.mjs --update`. npx's own copy is a cache entry npm replaces
// at will, so ~/.claude must never link into it. The clone URL comes from package.json's
// `repository`, so a fork that edits that one field bootstraps itself.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { cloneUrlFromPackage, parseBootstrapArgs } from "../scripts/install/bootstrap.mjs";
import { readJson } from "../scripts/install/json.mjs";
import { expandHome } from "../scripts/install/paths.mjs";

const DEFAULT_DIR = join(homedir(), "Projects", "claude-code-config");
const packageJson = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");

try {
  const { dir: dirArg, repo: repoArg, passthrough } = parseBootstrapArgs(process.argv.slice(2), process.env);
  const repo = repoArg ?? cloneUrlFromPackage(readJson(packageJson));
  const dir = resolve(expandHome(dirArg ?? (await chooseDir())));

  if (existsSync(join(dir, ".git"))) {
    console.log(`Updating ${dir}`);
    process.exit(runInstall(dir, ["--update", ...passthrough]));
  }
  if (existsSync(dir)) fail(`${dir} exists and is not a git clone. Pass --dir <path> to use another location.`);
  console.log(`Cloning ${repo} into ${dir}`);
  run("git", ["clone", repo, dir]);
  process.exit(runInstall(dir, passthrough));
} catch (error) {
  fail(error.message);
}

async function chooseDir() {
  if (existsSync(join(DEFAULT_DIR, ".git")) || !stdin.isTTY || !stdout.isTTY) return DEFAULT_DIR;
  const rl = createInterface({ input: stdin, output: stdout });
  const answer = (await rl.question(`Where should the clone live? ~/.claude will point into it. [${DEFAULT_DIR}] `)).trim();
  rl.close();
  return answer || DEFAULT_DIR;
}

function runInstall(dir, args) {
  const result = spawnSync(process.execPath, [join(dir, "install.mjs"), ...args], { stdio: "inherit" });
  return result.status ?? 1;
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

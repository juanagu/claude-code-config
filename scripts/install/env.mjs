import { spawnSync } from "node:child_process";

export function hasCommand(name) {
  const probe =
    process.platform === "win32"
      ? spawnSync("where", [name], { stdio: "ignore", shell: true })
      : spawnSync("sh", ["-c", `command -v ${name}`], { stdio: "ignore" });
  return probe.status === 0;
}

// Runs a script with this Node, sharing the terminal; the exit code comes back.
export function runNode(script, args) {
  const result = spawnSync(process.execPath, [script, ...args], { stdio: "inherit" });
  if (result.error) {
    console.error(`${script} could not be started: ${result.error.message}`);
    return 1;
  }
  return result.status ?? 1;
}

// Fast-forwards the clone. Untracked files are fine; a modified tracked file is not,
// since a pull could not be undone cleanly over it.
export function gitPull(repoDir) {
  const status = git(repoDir, ["status", "--porcelain", "--untracked-files=no"]);
  if (status.error) throw new Error(`git could not be started: ${status.error.message}`);
  if (status.status !== 0) throw new Error(`${repoDir} is not a git clone, so there is nothing to pull.`);
  if (status.stdout.trim()) throw new Error(`${repoDir} has uncommitted changes. Commit or stash them before updating.`);
  const pull = spawnSync("git", ["-C", repoDir, "pull", "--ff-only"], { stdio: "inherit" });
  if (pull.status !== 0) throw new Error("git pull --ff-only failed.");
}

export function gitOriginUrl(repoDir) {
  const result = git(repoDir, ["remote", "get-url", "origin"]);
  return result.status === 0 ? result.stdout.trim() : null;
}

function git(repoDir, args) {
  return spawnSync("git", ["-C", repoDir, ...args], { encoding: "utf8" });
}

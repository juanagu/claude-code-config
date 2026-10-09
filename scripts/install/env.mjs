import { spawnSync } from "node:child_process";

export function hasCommand(name) {
  const probe =
    process.platform === "win32"
      ? spawnSync("where", [name], { stdio: "ignore", shell: true })
      : spawnSync("sh", ["-c", `command -v ${name}`], { stdio: "ignore" });
  return probe.status === 0;
}

// Fast-forwards the clone. Untracked files are fine; a modified tracked file is not,
// since a pull could not be undone cleanly over it.
export function gitPull(repoDir) {
  const status = spawnSync("git", ["-C", repoDir, "status", "--porcelain", "--untracked-files=no"], { encoding: "utf8" });
  if (status.status !== 0) throw new Error(`${repoDir} is not a git clone, so --update has nothing to pull.`);
  if (status.stdout.trim()) throw new Error(`${repoDir} has uncommitted changes. Commit or stash them before --update.`);
  const pull = spawnSync("git", ["-C", repoDir, "pull", "--ff-only"], { stdio: "inherit" });
  if (pull.status !== 0) throw new Error("git pull --ff-only failed.");
}

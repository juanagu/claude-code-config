// Run with: node --test hooks/git-guard.test.mjs
// Builds two throwaway repos (one listed as protected) and drives the hook the way Claude Code does:
// JSON on stdin, exit 0 to allow, exit 2 to block.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

const HOOK = path.join(import.meta.dirname, "git-guard.mjs");
const onWindows = process.platform === "win32";

let home;
let protectedRepo;
let plainRepo;

function sh(dir, args) {
  return execFileSync("git", ["-C", dir, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function makeRepo(root, name) {
  const dir = path.join(root, name);
  mkdirSync(dir);
  sh(dir, ["init", "-q", "-b", "main"]);
  sh(dir, ["config", "user.email", "t@example.com"]);
  sh(dir, ["config", "user.name", "t"]);
  writeFileSync(path.join(dir, "a.txt"), "a\n");
  sh(dir, ["add", "."]);
  sh(dir, ["commit", "-q", "-m", "init"]);
  sh(dir, ["branch", "feat/x"]);
  return dir;
}

function posix(p) {
  return p.replace(/^([A-Za-z]):/, (_, d) => `/${d.toLowerCase()}`).replace(/\\/g, "/");
}

function run(command, cwd, toolName = "Bash") {
  const input = JSON.stringify({ tool_name: toolName, cwd, tool_input: { command } });
  const result = spawnSync(process.execPath, [HOOK], {
    input,
    encoding: "utf8",
    env: { ...process.env, GIT_GUARD_HOME: home },
  });
  return { code: result.status, stderr: result.stderr };
}

function blocked(command, cwd, toolName) {
  const r = run(command, cwd, toolName);
  assert.equal(r.code, 2, `expected block for "${command}", got ${r.code}\n${r.stderr}`);
  assert.match(r.stderr, /^git-guard: /);
}

function allowed(command, cwd, toolName) {
  const r = run(command, cwd, toolName);
  assert.equal(r.code, 0, `expected allow for "${command}", got ${r.code}\n${r.stderr}`);
}

function onBranch(repo, fn) {
  sh(repo, ["switch", "-q", "feat/x"]);
  try {
    fn();
  } finally {
    sh(repo, ["switch", "-q", "main"]);
  }
}

before(() => {
  home = mkdtempSync(path.join(tmpdir(), "git-guard-"));
  protectedRepo = makeRepo(home, "served");
  plainRepo = makeRepo(home, "plain");
  mkdirSync(path.join(home, ".claude"));
  writeFileSync(path.join(home, ".claude", "git-guard.json"), JSON.stringify({ protectedCheckouts: [protectedRepo] }));
});

after(() => rmSync(home, { recursive: true, force: true }));

describe("trunk protection (any repo)", () => {
  it("blocks a commit on trunk", () => blocked("git commit -m x", plainRepo));
  it("blocks a commit on trunk inside a compound command", () => blocked("git add . && git commit -m x", plainRepo));
  it("blocks a local merge on trunk", () => blocked("git merge feat/x", plainRepo));
  it("blocks an implicit push while on trunk", () => blocked("git push", plainRepo));
  it("blocks a push naming trunk", () => blocked("git push origin main", plainRepo));
  it("blocks a force-push naming trunk", () => blocked("git push --force origin main", plainRepo));
  it("blocks the + force refspec and refs/heads/ forms", () => {
    blocked("git push origin +main", plainRepo);
    blocked("git push origin refs/heads/main", plainRepo);
    blocked("git push origin HEAD:main", plainRepo);
  });
  it("blocks deleting the remote trunk", () => blocked("git push origin --delete main", plainRepo));
  it("blocks --all and --mirror", () => {
    blocked("git push --all origin", plainRepo);
    blocked("git push --mirror origin", plainRepo);
  });
  it("blocks --no-verify anywhere", () => blocked("git commit --no-verify -m x", plainRepo));
  it("blocks commit -n on a branch too", () => onBranch(plainRepo, () => blocked("git commit -n -m x", plainRepo)));
  it("allows push -n (dry run) on a branch", () => onBranch(plainRepo, () => allowed("git push -n origin feat/x", plainRepo)));
  it("allows pushing only tags from trunk", () => allowed("git push --tags", plainRepo));
  it("allows a commit on a branch, and a branch push", () =>
    onBranch(plainRepo, () => {
      allowed("git commit -m x", plainRepo);
      allowed("git push -u origin feat/x", plainRepo);
      allowed("git push --force-with-lease origin feat/x", plainRepo);
    }));
  it("allows creating a branch and committing in one command", () => {
    allowed("git switch -c feat/y && git commit -m x", plainRepo);
    allowed("git checkout -b feat/y && git commit -m x && git push -u origin feat/y", plainRepo);
  });
  it("allows deleting a remote branch", () => allowed("git push origin --delete feat/x", plainRepo));
  it("allows read-only git", () => allowed("git status && git log --oneline -5", plainRepo));
  it("honours git -C <dir>", () => blocked(`git -C "${plainRepo}" commit -m x`, home));
  it("honours cd in a compound command", () => blocked(`cd "${plainRepo}" && git commit -m x`, home));
  it("applies to the PowerShell tool", () => {
    blocked("git commit -m x", plainRepo, "PowerShell");
    blocked(`Set-Location '${plainRepo}'; git commit -m x`, home, "PowerShell");
  });
  it("understands Git Bash paths on Windows", { skip: !onWindows }, () => {
    blocked(`cd ${posix(plainRepo)} && git commit -m x`, home);
    blocked(`git -C ${posix(plainRepo)} commit -m x`, home);
    blocked("git commit -m x", posix(plainRepo));
  });
});

describe("branch switching in a protected checkout", () => {
  it("blocks git switch", () => blocked("git switch feat/x", protectedRepo));
  it("blocks git checkout <branch>", () => blocked("git checkout feat/x", protectedRepo));
  it("blocks git checkout -b and switch -c", () => {
    blocked("git checkout -b feat/y", protectedRepo);
    blocked("git switch -c feat/y", protectedRepo);
  });
  it("allows restoring files with --", () => allowed("git checkout -- a.txt", protectedRepo));
  it("allows restoring a path that is not a ref", () => allowed("git checkout a.txt", protectedRepo));
  it("allows restoring a path from a ref", () => allowed("git checkout HEAD a.txt", protectedRepo));
  it("allows switching in a repo that is not protected", () => allowed("git switch feat/x", plainRepo));
});

describe("fail open", () => {
  it("ignores non-git commands", () => allowed("npm test", plainRepo));
  it("ignores other tools", () => allowed("git commit -m x", plainRepo, "Read"));
  it("allows on malformed input", () => {
    const r = spawnSync(process.execPath, [HOOK], { input: "not json", encoding: "utf8" });
    assert.equal(r.status, 0);
  });
  it("allows outside a repository", () => allowed("git commit -m x", home));
});

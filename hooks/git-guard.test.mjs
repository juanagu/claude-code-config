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

function run(command, cwd) {
  const input = JSON.stringify({ tool_name: "Bash", cwd, tool_input: { command } });
  const result = spawnSync(process.execPath, [HOOK], {
    input,
    encoding: "utf8",
    env: { ...process.env, GIT_GUARD_HOME: home },
  });
  return { code: result.status, stderr: result.stderr };
}

function blocked(command, cwd) {
  const r = run(command, cwd);
  assert.equal(r.code, 2, `expected block for "${command}", got ${r.code}\n${r.stderr}`);
  assert.match(r.stderr, /^git-guard: /);
}

function allowed(command, cwd) {
  const r = run(command, cwd);
  assert.equal(r.code, 0, `expected allow for "${command}", got ${r.code}\n${r.stderr}`);
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
  it("blocks --no-verify anywhere", () => blocked("git commit --no-verify -m x", plainRepo));
  it("allows a commit after switching to a branch in the same command", () => {
    sh(plainRepo, ["switch", "-q", "feat/x"]);
    try {
      allowed("git commit -m x", plainRepo);
      allowed("git push -u origin feat/x", plainRepo);
      allowed("git push --force-with-lease origin feat/x", plainRepo);
    } finally {
      sh(plainRepo, ["switch", "-q", "main"]);
    }
  });
  it("allows deleting a remote branch", () => allowed("git push origin --delete feat/x", plainRepo));
  it("allows read-only git", () => allowed("git status && git log --oneline -5", plainRepo));
  it("honours git -C <dir>", () => blocked(`git -C "${plainRepo}" commit -m x`, home));
  it("honours cd in a compound command", () => blocked(`cd "${plainRepo}" && git commit -m x`, home));
});

describe("branch switching in a protected checkout", () => {
  it("blocks git switch", () => blocked("git switch feat/x", protectedRepo));
  it("blocks git checkout <branch>", () => blocked("git checkout feat/x", protectedRepo));
  it("blocks git checkout -b", () => blocked("git checkout -b feat/y", protectedRepo));
  it("allows restoring files with --", () => allowed("git checkout -- a.txt", protectedRepo));
  it("allows restoring a path that is not a ref", () => allowed("git checkout a.txt", protectedRepo));
  it("allows switching in a repo that is not protected", () => allowed("git switch feat/x", plainRepo));
});

describe("fail open", () => {
  it("ignores non-git commands", () => allowed("npm test", plainRepo));
  it("ignores other tools", () => {
    const r = spawnSync(process.execPath, [HOOK], {
      input: JSON.stringify({ tool_name: "Read", cwd: plainRepo, tool_input: {} }),
      encoding: "utf8",
      env: { ...process.env, GIT_GUARD_HOME: home },
    });
    assert.equal(r.status, 0);
  });
  it("allows on malformed input", () => {
    const r = spawnSync(process.execPath, [HOOK], { input: "not json", encoding: "utf8" });
    assert.equal(r.status, 0);
  });
  it("allows outside a repository", () => allowed("git commit -m x", home));
});

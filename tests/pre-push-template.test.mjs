// templates/pre-push under sh in a throwaway repo: tag pushes skip, a branch push runs the
// scripts only when it is the checked-out HEAD, and a mixed push still runs them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, copyFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const template = join(dirname(dirname(fileURLToPath(import.meta.url))), "templates", "pre-push");
const ZERO = "0".repeat(40);
const git = (dir, ...args) => execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd: dir, encoding: "utf8" }).trim();

function withRepo(fn) {
  const dir = mkdtempSync(join(tmpdir(), "pre-push-"));
  try {
    git(dir, "init", "-q", "-b", "main");
    mkdirSync(join(dir, "node_modules"));
    const marker = join(dir, "ran");
    const touch = "node -e \"require('fs').appendFileSync('ran','x')\"";
    const scripts = Object.fromEntries(["lint", "typecheck", "test"].map((name) => [name, touch]));
    writeFileSync(join(dir, "package.json"), JSON.stringify({ scripts, devDependencies: { x: "1" } }));
    git(dir, "add", "-A");
    git(dir, "commit", "-q", "-m", "a");
    const head = git(dir, "rev-parse", "HEAD");
    git(dir, "commit", "-q", "--allow-empty", "-m", "b");
    const other = git(dir, "rev-parse", "HEAD");
    git(dir, "reset", "-q", "--hard", head);
    copyFileSync(template, join(dir, "pre-push"));
    fn({ dir, head, other, ran: () => existsSync(marker) });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const push = (dir, lines) => spawnSync("sh", ["pre-push", "origin"], { cwd: dir, input: lines.join("\n") + "\n", encoding: "utf8", env: { ...process.env, CI: "" } });

test("a tag-only push exits 0 without running the scripts", () => {
  withRepo(({ dir, head, ran }) => {
    assert.equal(push(dir, [`refs/tags/v1 ${head} refs/tags/v1 ${ZERO}`]).status, 0);
    assert.equal(ran(), false);
  });
});

test("a branch push of HEAD runs the scripts", () => {
  withRepo(({ dir, head, ran }) => {
    assert.equal(push(dir, [`refs/heads/f ${head} refs/heads/f ${ZERO}`]).status, 0);
    assert.equal(ran(), true);
  });
});

test("a branch push of a sha that is not HEAD fails closed", () => {
  withRepo(({ dir, other, ran }) => {
    assert.equal(push(dir, [`refs/heads/f ${other} refs/heads/f ${ZERO}`]).status, 1);
    assert.equal(ran(), false);
  });
});

test("a tag mixed with HEAD's branch still runs the scripts", () => {
  withRepo(({ dir, head, ran }) => {
    const result = push(dir, [`refs/tags/v1 ${head} refs/tags/v1 ${ZERO}`, `refs/heads/f ${head} refs/heads/f ${ZERO}`]);
    assert.equal(result.status, 0);
    assert.equal(ran(), true);
  });
});

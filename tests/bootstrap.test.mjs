import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { cloneUrlFromPackage, parseBootstrapArgs } from "../scripts/install/bootstrap.mjs";
import { expandHome } from "../scripts/install/paths.mjs";

const repoDir = dirname(dirname(fileURLToPath(import.meta.url)));
const bootstrap = join(repoDir, "bin", "bootstrap.mjs");

test("--dir and --repo are the bootstrapper's, the rest passes through, every -- is dropped", () => {
  const parsed = parseBootstrapArgs(["--", "--dir", "~/cfg", "--", "--yes", "--repo", "https://x/y.git", "--claude-dir", "/c"], {});
  assert.deepEqual(parsed, { dir: "~/cfg", repo: "https://x/y.git", passthrough: ["--yes", "--claude-dir", "/c"] });
});

test("the directory can come from the environment, and --dir without a value is an error", () => {
  assert.equal(parseBootstrapArgs([], { CLAUDE_CODE_CONFIG_DIR: "/opt/cfg" }).dir, "/opt/cfg");
  assert.throws(() => parseBootstrapArgs(["--dir", "--yes"]), /--dir needs a value/);
});

test("a leading ~ expands to the home directory", () => {
  assert.equal(expandHome("~/Projects/x", "/home/me"), join("/home/me", "Projects", "x"));
  assert.equal(expandHome("~", "/home/me"), "/home/me");
  assert.equal(expandHome("/abs/~/x", "/home/me"), "/abs/~/x");
});

test("every repository spec npm accepts becomes a URL git can clone", () => {
  assert.equal(cloneUrlFromPackage({ repository: "github:me/fork" }), "https://github.com/me/fork.git");
  assert.equal(cloneUrlFromPackage({ repository: "github:me/fork.git" }), "https://github.com/me/fork.git");
  assert.equal(cloneUrlFromPackage({ repository: { type: "git", url: "git+https://github.com/me/fork.git" } }), "https://github.com/me/fork.git");
  assert.equal(cloneUrlFromPackage({ repository: "https://example.com/r.git" }), "https://example.com/r.git");
  assert.throws(() => cloneUrlFromPackage({}), /repository/);
});

// Clones this repo's committed HEAD from disk, so a change has to be committed before
// this case sees it. Skips npx and every question, so it needs no network or terminal.
test("bootstrap clones into --dir, installs there, and takes the update path on the second run", (t) => {
  const tmp = mkdtempSync(join(tmpdir(), "claude-bootstrap-"));
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const clone = join(tmp, "clone");
  const claude = join(tmp, "claude");
  const args = ["--repo", repoDir, "--dir", clone, "--", "--claude-dir", claude, "--skip-skills", "--no-optional"];

  const first = spawnSync(process.execPath, [bootstrap, ...args], { encoding: "utf8" });
  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stdout, /Cloning/);
  assert.ok(existsSync(join(clone, ".git")));
  assert.equal(readFileSync(join(claude, "CLAUDE.md"), "utf8").trim(), `@${clone.split(sep).join("/")}/CLAUDE.md`);

  writeFileSync(join(clone, "untracked-notes.md"), "mine");
  const second = spawnSync(process.execPath, [bootstrap, ...args], { encoding: "utf8" });
  assert.equal(second.status, 0, second.stderr);
  assert.match(second.stdout, /Updating/);

  writeFileSync(join(clone, "README.md"), "edited");
  const dirty = spawnSync(process.execPath, [bootstrap, ...args], { encoding: "utf8" });
  assert.equal(dirty.status, 1);
  assert.match(dirty.stderr, /uncommitted changes/);
});

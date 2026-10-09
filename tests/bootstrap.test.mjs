import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { cloneTargetFromPackage, parseBootstrapArgs, sameRepo } from "../scripts/install/bootstrap.mjs";
import { expandHome } from "../scripts/install/paths.mjs";

const repoDir = dirname(dirname(fileURLToPath(import.meta.url)));
const bootstrap = join(repoDir, "bin", "bootstrap.mjs");

test("--dir and --repo are the bootstrapper's, the rest passes through, every -- is dropped", () => {
  const parsed = parseBootstrapArgs(["--", "--dir", "~/cfg", "--", "--yes", "--repo", "https://x/y.git", "--claude-dir", "/c"], {});
  assert.deepEqual(parsed, { dir: "~/cfg", repo: "https://x/y.git", passthrough: ["--yes", "--claude-dir", "/c"] });
});

test("the directory can come from the environment, an empty value counts as unset, and --dir without a value is an error", () => {
  assert.equal(parseBootstrapArgs([], { CLAUDE_CODE_CONFIG_DIR: "/opt/cfg" }).dir, "/opt/cfg");
  assert.equal(parseBootstrapArgs([], { CLAUDE_CODE_CONFIG_DIR: "" }).dir, null);
  assert.throws(() => parseBootstrapArgs(["--dir", "--yes"]), /--dir needs a value/);
});

test("a leading ~ expands to the home directory", () => {
  assert.equal(expandHome("~/Projects/x", "/home/me"), join("/home/me", "Projects", "x"));
  assert.equal(expandHome("~", "/home/me"), "/home/me");
  assert.equal(expandHome("/abs/~/x", "/home/me"), "/abs/~/x");
});

test("every repository spec npm accepts becomes a URL git can clone, with its ref", () => {
  const github = { url: "https://github.com/me/fork.git", ref: null };
  assert.deepEqual(cloneTargetFromPackage({ repository: "github:me/fork" }), github);
  assert.deepEqual(cloneTargetFromPackage({ repository: "github:me/fork.git" }), github);
  assert.deepEqual(cloneTargetFromPackage({ repository: "me/fork" }), github);
  assert.deepEqual(cloneTargetFromPackage({ repository: "github:me/fork#main" }), { ...github, ref: "main" });
  assert.deepEqual(cloneTargetFromPackage({ repository: { type: "git", url: "git+https://github.com/me/fork.git" } }), github);
  assert.deepEqual(cloneTargetFromPackage({ repository: "https://example.com/r.git" }), { url: "https://example.com/r.git", ref: null });
  assert.throws(() => cloneTargetFromPackage({ repository: "gitlab:me/fork" }), /not supported/);
  assert.throws(() => cloneTargetFromPackage({}), /repository/);
});

test("the same repository is recognised across URL spellings", () => {
  assert.ok(sameRepo("https://github.com/me/fork.git", "https://github.com/Me/Fork"));
  assert.ok(sameRepo("git@github.com:me/fork.git", "https://github.com/me/fork.git"));
  assert.ok(sameRepo("git@gitlab.com:me/cfg.git", "https://gitlab.com/me/cfg.git"));
  assert.ok(sameRepo("ssh://git@gitlab.com/me/cfg.git", "https://gitlab.com/me/cfg"));
  assert.ok(sameRepo("https://me@gitlab.com/me/cfg.git", "https://gitlab.com/me/cfg"));
  assert.ok(!sameRepo("https://github.com/me/fork.git", "https://github.com/me/other.git"));
});

// Clones this repo's committed HEAD from disk, so a change to install.mjs has to be
// committed before the install step sees it. Skips npx and every question, so it needs
// no network or terminal.
test("bootstrap clones into --dir, installs there, updates on the second run, and refuses a dirty clone or another repo", (t) => {
  const tmp = mkdtempSync(join(tmpdir(), "claude-bootstrap-"));
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const clone = join(tmp, "clone");
  const claude = join(tmp, "claude");
  const args = ["--repo", repoDir, "--dir", clone, "--", "--claude-dir", claude, "--skip-skills", "--no-optional"];
  const bootstrapWith = (...extra) => spawnSync(process.execPath, [bootstrap, ...extra], { encoding: "utf8" });

  const first = bootstrapWith(...args);
  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stdout, /Cloning/);
  assert.ok(existsSync(join(clone, ".git")));
  assert.equal(readFileSync(join(claude, "CLAUDE.md"), "utf8").trim(), `@${realpathSync(clone).split(sep).join("/")}/CLAUDE.md`);

  writeFileSync(join(clone, "untracked-notes.md"), "mine");
  const second = bootstrapWith(...args);
  assert.equal(second.status, 0, second.stderr);
  assert.match(second.stdout, /Updating/);

  const other = bootstrapWith("--repo", "https://github.com/someone-else/other.git", "--dir", clone, "--claude-dir", claude, "--skip-skills", "--no-optional");
  assert.equal(other.status, 1);
  assert.match(other.stderr, /is a clone of/);

  writeFileSync(join(clone, "README.md"), "edited");
  const dirty = bootstrapWith(...args);
  assert.equal(dirty.status, 1);
  assert.match(dirty.stderr, /uncommitted changes/);
});

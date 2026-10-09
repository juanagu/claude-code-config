import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repoDir = dirname(dirname(fileURLToPath(import.meta.url)));
const installer = join(repoDir, "install.mjs");
const posix = (path) => path.split(sep).join("/");

// Every run skips npx, so the suite needs no network, and decides each optional
// piece by flag, so it never waits on a prompt.
function run(claudeDir, ...extra) {
  return spawnSync(process.execPath, [installer, "--claude-dir", claudeDir, "--skip-skills", ...extra], { encoding: "utf8" });
}

function freshDir(t) {
  const dir = mkdtempSync(join(tmpdir(), "claude-install-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

const isLinkTo = (path, target) => lstatSync(path).isSymbolicLink() && realpathSync(path) === realpathSync(target);
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const settingsOf = (dir) => readJson(join(dir, "settings.json"));
const hookCommands = (settings) => (settings.hooks?.PreToolUse ?? []).flatMap((entry) => entry.hooks.map((hook) => hook.command));
const backupsIn = (dir) => readdirSync(dir).filter((name) => name.startsWith("backup-"));
const writeJson = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);

test("a fresh directory gets the import, the links and settings from the template", (t) => {
  const dir = freshDir(t);
  const result = run(dir, "--no-optional");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(join(dir, "CLAUDE.md"), "utf8").trim(), `@${posix(repoDir)}/CLAUDE.md`);
  assert.ok(isLinkTo(join(dir, "agents"), join(repoDir, "agents")));
  assert.ok(isLinkTo(join(dir, "hooks"), join(repoDir, "hooks")));
  for (const skill of readdirSync(join(repoDir, "skills"))) {
    assert.ok(isLinkTo(join(dir, "skills", skill), join(repoDir, "skills", skill)), skill);
  }
  const commands = hookCommands(settingsOf(dir));
  assert.ok(commands.some((command) => command.includes("hooks/git-guard.mjs") && command.includes(posix(dir))));
  assert.ok(!commands.some((command) => command.includes("rtk")));
  assert.deepEqual(backupsIn(dir), []);
});

test("a second run changes nothing and makes no backup", (t) => {
  const dir = freshDir(t);
  assert.equal(run(dir, "--no-optional").status, 0);
  const before = readFileSync(join(dir, "settings.json"), "utf8");
  const again = run(dir, "--no-optional");
  assert.equal(again.status, 0, again.stderr);
  assert.equal(readFileSync(join(dir, "settings.json"), "utf8"), before);
  assert.deepEqual(backupsIn(dir), []);
});

test("a real agents directory and a different CLAUDE.md are moved to a backup", (t) => {
  const dir = freshDir(t);
  mkdirSync(join(dir, "agents"));
  writeFileSync(join(dir, "agents", "mine.md"), "mine");
  writeFileSync(join(dir, "CLAUDE.md"), "# mine\n");
  assert.equal(run(dir, "--no-optional").status, 0);
  const [backup, ...others] = backupsIn(dir);
  assert.ok(backup);
  assert.deepEqual(others, []);
  assert.equal(readFileSync(join(dir, backup, "agents", "mine.md"), "utf8"), "mine");
  assert.equal(readFileSync(join(dir, backup, "CLAUDE.md"), "utf8"), "# mine\n");
  assert.ok(isLinkTo(join(dir, "agents"), join(repoDir, "agents")));
});

test("a skill link whose target is gone is removed", (t) => {
  const dir = freshDir(t);
  const gone = join(dir, "gone-skill");
  mkdirSync(join(dir, "skills"), { recursive: true });
  mkdirSync(gone);
  symlinkSync(gone, join(dir, "skills", "gone-skill"), "junction");
  rmSync(gone, { recursive: true });
  const result = run(dir, "--no-optional");
  assert.equal(result.status, 0, result.stderr);
  assert.ok(!existsSync(join(dir, "skills", "gone-skill")));
  assert.match(result.stdout, /Removed broken skill links: gone-skill/);
});

test("an existing settings.json that already has the hook is left byte for byte", (t) => {
  const dir = freshDir(t);
  const settings = { model: "opus", hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: `node "${posix(dir)}/hooks/git-guard.mjs"` }] }] } };
  writeJson(join(dir, "settings.json"), settings);
  const before = readFileSync(join(dir, "settings.json"), "utf8");
  assert.equal(run(dir, "--no-optional").status, 0);
  assert.equal(readFileSync(join(dir, "settings.json"), "utf8"), before);
});

test("--no-optional adds only the git-guard hook to an existing settings.json", (t) => {
  const dir = freshDir(t);
  writeJson(join(dir, "settings.json"), { model: "opus" });
  assert.equal(run(dir, "--no-optional").status, 0);
  const settings = settingsOf(dir);
  assert.equal(settings.model, "opus");
  assert.deepEqual(hookCommands(settings), [`node "${posix(dir)}/hooks/git-guard.mjs"`]);
  assert.equal(settings.permissions, undefined);
});

test("--yes merges the rtk hook and the CodeGraph rule once, and remembers the answers", (t) => {
  const dir = freshDir(t);
  writeJson(join(dir, "settings.json"), { permissions: { allow: ["Read"] } });
  assert.equal(run(dir, "--yes").status, 0);
  assert.equal(run(dir, "--yes").status, 0);
  const settings = settingsOf(dir);
  assert.deepEqual(settings.permissions.allow, ["Read", "mcp__codegraph__*"]);
  assert.deepEqual(hookCommands(settings).filter((command) => command.includes("rtk")), ["rtk hook claude"]);
  assert.equal(hookCommands(settings).filter((command) => command.includes("git-guard")).length, 1);
  const answers = readJson(join(dir, "config-install.json"));
  assert.equal(answers.rtk, true);
  assert.equal(answers.codegraph, true);
  assert.equal(answers.gitGuard, true);
});

test("explicit --rtk and --no-codegraph beat the defaults", (t) => {
  const dir = freshDir(t);
  writeJson(join(dir, "settings.json"), {});
  assert.equal(run(dir, "--rtk", "--no-codegraph").status, 0);
  const settings = settingsOf(dir);
  assert.ok(hookCommands(settings).includes("rtk hook claude"));
  assert.equal(settings.permissions, undefined);
});

test("an unknown option fails with a message and touches nothing", (t) => {
  const dir = freshDir(t);
  const result = run(dir, "--bogus");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unknown option --bogus/);
  assert.deepEqual(readdirSync(dir), []);
});

test("--help prints the options", () => {
  const result = spawnSync(process.execPath, [installer, "--help"], { encoding: "utf8" });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /--claude-dir <dir>/);
});

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

test("--yes merges the rtk hook and the CodeGraph rule once, and keeps no answers", (t) => {
  const dir = freshDir(t);
  writeJson(join(dir, "settings.json"), { permissions: { allow: ["Read"] } });
  assert.equal(run(dir, "--yes").status, 0);
  assert.equal(run(dir, "--yes").status, 0);
  const settings = settingsOf(dir);
  assert.deepEqual(settings.permissions.allow, ["Read", "mcp__codegraph__*"]);
  assert.deepEqual(hookCommands(settings).filter((command) => command.includes("rtk")), ["rtk hook claude"]);
  assert.equal(hookCommands(settings).filter((command) => command.includes("git-guard")).length, 1);
  assert.deepEqual(readJson(join(dir, "config-install.json")), {});
});

test("--no-optional keeps no answers, so a later run can still ask", (t) => {
  const dir = freshDir(t);
  assert.equal(run(dir, "--no-optional").status, 0);
  assert.deepEqual(readJson(join(dir, "config-install.json")), {});
});

test("explicit --rtk and --no-codegraph beat the defaults and are remembered", (t) => {
  const dir = freshDir(t);
  writeJson(join(dir, "settings.json"), {});
  assert.equal(run(dir, "--rtk", "--no-codegraph").status, 0);
  const settings = settingsOf(dir);
  assert.ok(hookCommands(settings).includes("rtk hook claude"));
  assert.equal(settings.permissions, undefined);
  assert.deepEqual(readJson(join(dir, "config-install.json")), { rtk: true, codegraph: false });
});

test("an earlier no to the git-guard hook is honoured under --no-optional", (t) => {
  const dir = freshDir(t);
  writeJson(join(dir, "settings.json"), {});
  writeJson(join(dir, "config-install.json"), { gitGuard: false });
  assert.equal(run(dir, "--no-optional").status, 0);
  assert.deepEqual(settingsOf(dir), {});
});

test("a settings.json with a BOM is read; one that is not JSON fails naming the file", (t) => {
  const dir = freshDir(t);
  writeFileSync(join(dir, "settings.json"), "\uFEFF{}");
  assert.equal(run(dir, "--no-optional").status, 0);
  writeFileSync(join(dir, "settings.json"), "{ oops");
  const result = run(dir, "--no-optional");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /settings\.json is not valid JSON/);
});

test("an unknown option fails with a message and touches nothing", (t) => {
  const dir = freshDir(t);
  const result = run(dir, "--bogus");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unknown option --bogus/);
  assert.deepEqual(readdirSync(dir), []);
});

test("a settings.json that is not JSON stops the run before anything is moved or linked", (t) => {
  const dir = freshDir(t);
  mkdirSync(join(dir, "agents"));
  writeFileSync(join(dir, "agents", "mine.md"), "mine");
  writeFileSync(join(dir, "settings.json"), "{ oops");
  const result = run(dir, "--no-optional");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /settings\.json is not valid JSON/);
  assert.ok(!lstatSync(join(dir, "agents")).isSymbolicLink());
  assert.ok(!existsSync(join(dir, "CLAUDE.md")));
  assert.deepEqual(backupsIn(dir), []);
});

test("--yes adds no rtk hook when rtk is not on PATH, since the hook would fail every shell call", (t) => {
  const dir = freshDir(t);
  writeJson(join(dir, "settings.json"), {});
  const noPath = { ...process.env, PATH: "", Path: "" };
  const result = spawnSync(process.execPath, [installer, "--claude-dir", dir, "--skip-skills", "--yes"], { encoding: "utf8", env: noPath });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(!hookCommands(settingsOf(dir)).includes("rtk hook claude"));
  assert.ok(hookCommands(settingsOf(dir)).some((command) => command.includes("git-guard")));
});

test("an explicit --rtk without rtk on PATH adds the hook and says so", (t) => {
  const dir = freshDir(t);
  writeJson(join(dir, "settings.json"), {});
  const noPath = { ...process.env, PATH: "", Path: "" };
  const result = spawnSync(process.execPath, [installer, "--claude-dir", dir, "--skip-skills", "--rtk", "--no-codegraph"], { encoding: "utf8", env: noPath });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(hookCommands(settingsOf(dir)).includes("rtk hook claude"));
  assert.match(result.stdout, /rtk is not on PATH/);
});

test("--help prints the options", () => {
  const result = spawnSync(process.execPath, [installer, "--help"], { encoding: "utf8" });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /--claude-dir <dir>/);
});

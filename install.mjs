#!/usr/bin/env node
// One copy of the config: ~/.claude points into this clone. Links agents/, hooks/ and
// the skills written here, writes the CLAUDE.md import, creates settings.json from the
// template when missing, asks about the optional pieces, installs the third-party
// skills. Re-running is safe; `node install.mjs --help` lists the options.
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { HELP, parseArgs } from "./scripts/install/args.mjs";
import { gitPull, hasCommand, runNode } from "./scripts/install/env.mjs";
import { writeJson } from "./scripts/install/json.mjs";
import { createLinker } from "./scripts/install/link.mjs";
import { createPrompter } from "./scripts/install/prompts.mjs";
import * as settings from "./scripts/install/settings.mjs";
import { installSkill, linkRepoSkills, readSkillList } from "./scripts/install/skills.mjs";

const self = fileURLToPath(import.meta.url);
const repoDir = dirname(self);
const RTK_URL = "https://github.com/rtk-ai/rtk";

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) {
    console.log(HELP);
    return 0;
  }
  if (flags.update) return updateThenRerun();

  const claudeDir = flags.claudeDir ? resolve(flags.claudeDir) : join(homedir(), ".claude");
  // Everything that must parse is read first, so a broken file leaves ~/.claude as it was.
  const current = settings.readSettings(claudeDir, repoDir);
  const prompter = createPrompter({ file: join(claudeDir, "config-install.json"), ...flags });

  const skillsDir = join(claudeDir, "skills");
  mkdirSync(skillsDir, { recursive: true });
  const linker = createLinker(claudeDir);
  linker.writeImport(join(claudeDir, "CLAUDE.md"), repoDir);
  linker.link(join(claudeDir, "agents"), join(repoDir, "agents"));
  linker.link(join(claudeDir, "hooks"), join(repoDir, "hooks"));
  linkRepoSkills(linker, repoDir, skillsDir);
  const swept = linker.sweepBrokenLinks(skillsDir);
  console.log(`Linked ${claudeDir} to ${repoDir} (CLAUDE.md import; agents/, hooks/ and skills/ links).`);
  if (swept.length) console.log(`Removed broken skill links: ${swept.join(", ")}`);

  await configureSettings(claudeDir, current, prompter, flags);
  const failed = flags.skipSkills ? [] : await installSkills(prompter);
  prompter.save();

  const backup = linker.backupDir();
  if (backup) console.log(`Replaced files were moved to ${backup}`);
  if (failed.length) {
    console.error(`Failed to install: ${failed.join(", ")}`);
    return 1;
  }
  console.log("Start a new Claude Code session to pick up the config.");
  return 0;
}

// The pull may change this very code, so the pulled installer runs in a fresh process.
function updateThenRerun() {
  gitPull(repoDir);
  return runNode(self, process.argv.slice(2).filter((arg) => arg !== "--update"));
}

// The template is written whole when settings.json is missing. An existing file is the
// user's: each addition is offered, and only the ones accepted are merged in.
async function configureSettings(claudeDir, { path, settings: current, created }, prompter, flags) {
  const added = [await offerGitGuard(claudeDir, current, prompter), await offerRtk(current, prompter, flags), await offerCodegraph(current, prompter, flags)];
  if (!created && !added.includes(true)) return;
  writeJson(path, current);
  console.log(`${created ? "Wrote" : "Updated"} ${path}.`);
}

async function offerGitGuard(claudeDir, current, prompter) {
  if (settings.hasHook(current, settings.GIT_GUARD_NEEDLE)) return false;
  if (!(await prompter.confirm("gitGuard", "settings.json has no git-guard hook. Add it?", true, { essential: true }))) return false;
  settings.addHook(current, settings.GIT_GUARD_MATCHER, settings.gitGuardCommand(claudeDir));
  return true;
}

// A hook for a binary that is missing fails on every shell call, so --yes adds it only
// when rtk is there, and an explicit yes gets a warning.
async function offerRtk(current, prompter, flags) {
  if (settings.hasHook(current, settings.RTK_NEEDLE)) return false;
  const installed = hasCommand("rtk");
  let add;
  if (flags.rtk !== null) add = prompter.decide("rtk", flags.rtk);
  else if (flags.yes) add = installed;
  else add = await prompter.confirm("rtk", `Add the rtk hook, which compresses shell output (rtk is ${installed ? "" : "not "}on PATH, ${RTK_URL})?`, installed);
  if (!add) return false;
  if (!installed) console.log(`rtk is not on PATH: its hook fails on every shell call until it is installed (${RTK_URL}).`);
  settings.addHook(current, settings.RTK_MATCHER, settings.RTK_COMMAND);
  return true;
}

async function offerCodegraph(current, prompter, flags) {
  if (settings.hasAllowRule(current, settings.CODEGRAPH_RULE)) return false;
  const installed = hasCommand("codegraph");
  const note = installed ? "codegraph is on PATH" : "codegraph is not on PATH; the rule is harmless until it is";
  const add = flags.codegraph !== null ? prompter.decide("codegraph", flags.codegraph) : await prompter.confirm("codegraph", `Allow the CodeGraph MCP tools without a prompt (${note})?`, installed);
  if (!add) return false;
  settings.addAllowRule(current, settings.CODEGRAPH_RULE);
  return true;
}

async function installSkills(prompter) {
  if (!hasCommand("npx")) {
    console.log("npx not found: skipped the skills in skills.txt. Install npm and re-run.");
    return [];
  }
  const wanted = readSkillList(join(repoDir, "skills.txt"));
  for (const skill of readSkillList(join(repoDir, "skills.optional.txt"))) {
    if (await prompter.confirm(`skill:${skill.name}`, `Install the ${skill.name} skill (${skill.description})?`, false)) wanted.push(skill);
  }
  return wanted.filter((skill) => !installSkill(skill)).map((skill) => skill.name);
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error.message);
    process.exit(1);
  },
);

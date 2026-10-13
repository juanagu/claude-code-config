// Cross-references in the prose that loads into sessions: a `§N` pointer names a section that exists
// (in the skill itself, or in the skill an agent names next to it), every architecture skill's
// description says which sibling skills it is not for, and every agent-like or architecture-skill
// name points at a file that exists. Each of these has cost a review round when it drifted.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { frontmatter } from "./support/frontmatter.mjs";

const repoDir = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (path) => readFileSync(join(repoDir, path), "utf8");
const withoutCode = (text) => text.replace(/```[\s\S]*?```/g, "");

const skillNames = readdirSync(join(repoDir, "skills")).filter((name) => existsSync(join(repoDir, "skills", name, "SKILL.md")));
const skillFile = (name) => `skills/${name}/SKILL.md`;
const agentNames = readdirSync(join(repoDir, "agents"))
  .filter((f) => f.endsWith(".md"))
  .map((f) => f.replace(/\.md$/, ""));
const agentFiles = agentNames.map((name) => `agents/${name}.md`);
const architectureSkills = skillNames.filter((name) => name.endsWith("-architecture"));
const proseFiles = ["CLAUDE.md", "README.md", ...agentFiles, ...skillNames.map(skillFile)];

const sectionsOf = (skill) => new Set([...read(skillFile(skill)).matchAll(/^## (\d+)\./gm)].map((m) => m[1]));
const SECTION_POINTER = /§(\d+)/g;
// "`android-architecture` skill, §10" or "`flutter-architecture` skill (§9)": a pointer into another skill.
const CROSS_POINTER = /`([a-z-]+-architecture)` skill[,]? \(?§(\d+)/g;

for (const name of skillNames) {
  test(`${skillFile(name)}: every §N pointer names a section that exists`, () => {
    const sections = sectionsOf(name);
    const pointers = new Set([...withoutCode(read(skillFile(name))).matchAll(SECTION_POINTER)].map((m) => m[1]));
    const dangling = [...pointers].filter((n) => !sections.has(n));
    assert.deepEqual(dangling, [], `dangling: ${dangling.map((n) => `§${n}`).join(", ")}`);
  });
}

for (const file of ["CLAUDE.md", ...agentFiles]) {
  test(`${file}: every "\`<skill>\` skill, §N" pointer names a section of that skill`, () => {
    const dangling = [...withoutCode(read(file)).matchAll(CROSS_POINTER)]
      .filter(([, skill, n]) => !skillNames.includes(skill) || !sectionsOf(skill).has(n))
      .map(([, skill, n]) => `${skill} §${n}`);
    assert.deepEqual(dangling, [], `dangling: ${dangling.join(", ")}`);
  });
}

for (const name of architectureSkills) {
  test(`${name}: its description names every other architecture skill it is not for`, () => {
    const text = frontmatter(join(repoDir, skillFile(name))).description ?? "";
    const at = text.toLowerCase().lastIndexOf("not for");
    assert.notEqual(at, -1, "the description has no \"Not for\" clause");
    const notFor = text.slice(at);
    const missing = architectureSkills.filter((other) => other !== name && !notFor.includes(other));
    assert.deepEqual(missing, [], `missing from "Not for": ${missing.join(", ")}`);
  });
}

// An agent-like name ends the way an existing agent's name does (…-engineer, …-writer, designer).
const agentSuffixes = new Set(agentNames.map((name) => name.split("-").pop()));
const NAME = /\b[a-z]+(?:-[a-z]+)*\b/g;
const looksLikeAgent = (name) => agentSuffixes.has(name.split("-").pop()) && name.includes("-");

for (const file of proseFiles) {
  test(`${file}: every agent-like and architecture-skill name exists`, () => {
    const names = new Set([...withoutCode(read(file)).matchAll(NAME)].map((m) => m[0]));
    const dangling = [...names].filter(
      (name) => (looksLikeAgent(name) && !agentNames.includes(name)) || (name.endsWith("-architecture") && !skillNames.includes(name)),
    );
    assert.deepEqual(dangling, [], `dangling: ${dangling.join(", ")}`);
  });
}

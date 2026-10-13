// Cross-references in the prose that loads into sessions: a `§N` pointer in a skill names a section that
// exists, every architecture skill's description says which sibling skills it is not for, and every
// backticked agent or architecture-skill name points at a file that exists. Each of these has cost a
// review round when it drifted.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoDir = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (path) => readFileSync(join(repoDir, path), "utf8");

const skillNames = readdirSync(join(repoDir, "skills"));
const skillFiles = skillNames.map((name) => `skills/${name}/SKILL.md`);
const agentNames = readdirSync(join(repoDir, "agents"))
  .filter((f) => f.endsWith(".md"))
  .map((f) => f.replace(/\.md$/, ""));
const agentFiles = agentNames.map((name) => `agents/${name}.md`);
const architectureSkills = skillNames.filter((name) => name.endsWith("-architecture"));
const proseFiles = ["CLAUDE.md", "README.md", ...agentFiles, ...skillFiles];

function description(skillFile) {
  const match = read(skillFile).match(/^description:\s*"?(.*?)"?\s*$/m);
  assert.ok(match, `${skillFile}: no description in the frontmatter`);
  return match[1];
}

for (const file of skillFiles) {
  test(`${file}: every §N pointer names a section that exists`, () => {
    const text = read(file);
    const sections = new Set([...text.matchAll(/^## (\d+)\./gm)].map((m) => m[1]));
    const pointers = new Set([...text.matchAll(/§(\d+)/g)].map((m) => m[1]));
    const dangling = [...pointers].filter((n) => !sections.has(n));
    assert.deepEqual(dangling, [], `dangling: ${dangling.map((n) => `§${n}`).join(", ")}`);
  });
}

for (const name of architectureSkills) {
  test(`${name}: its description names every other architecture skill it is not for`, () => {
    const notFor = description(`skills/${name}/SKILL.md`).split(/Not for/)[1] ?? "";
    const missing = architectureSkills.filter((other) => other !== name && !notFor.includes(other));
    assert.deepEqual(missing, [], `missing from "Not for": ${missing.join(", ")}`);
  });
}

const AGENT_REF = /`([a-z]+(?:-[a-z]+)*)`/g;
const looksLikeAgent = (name) => /-engineer$|-strategist$|-writer$/.test(name) || name === "designer";

for (const file of proseFiles) {
  test(`${file}: every backticked agent and architecture-skill name exists`, () => {
    const refs = new Set([...read(file).matchAll(AGENT_REF)].map((m) => m[1]));
    const dangling = [...refs].filter(
      (name) => (looksLikeAgent(name) && !agentNames.includes(name)) || (name.endsWith("-architecture") && !skillNames.includes(name)),
    );
    assert.deepEqual(dangling, [], `dangling: ${dangling.join(", ")}`);
  });
}

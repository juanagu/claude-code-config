// Every agent names its model as a family alias, so a session run on a smaller
// model cannot downgrade an agent by accident and each follows its family's
// latest release (CLAUDE.md, Subagents).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const agentsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "agents");
const MODELS = new Set(["opus", "sonnet", "haiku"]);

function frontmatter(path) {
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  assert.equal(lines[0], "---", `${basename(path)}: no frontmatter`);
  const end = lines.indexOf("---", 1);
  assert.notEqual(end, -1, `${basename(path)}: unterminated frontmatter`);
  const fields = {};
  for (const line of lines.slice(1, end)) {
    const i = line.indexOf(":");
    if (i > 0) fields[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return fields;
}

const files = readdirSync(agentsDir).filter((f) => f.endsWith(".md"));

test("there are agents to check", () => {
  assert.ok(files.length > 0);
});

for (const file of files) {
  test(`${file} names a model alias and its own name`, () => {
    const fm = frontmatter(join(agentsDir, file));
    assert.ok(MODELS.has(fm.model), `model is "${fm.model}", expected one of ${[...MODELS].join(", ")}`);
    assert.equal(fm.name, basename(file, ".md"));
  });
}

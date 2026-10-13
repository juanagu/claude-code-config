// Every agent names its model as a family alias, so a session run on a smaller
// model cannot downgrade an agent by accident and each follows its family's
// latest release (CLAUDE.md, Subagents).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { frontmatter } from "./support/frontmatter.mjs";

const agentsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "agents");
const MODELS = new Set(["opus", "sonnet", "haiku"]);

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

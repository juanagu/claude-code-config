// The YAML frontmatter of an agent or skill file as a flat map of string fields. Quoted values lose
// their quotes; a block scalar (`description: >`) is refused, so a parse never silently returns ">".
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { basename } from "node:path";

export function frontmatter(path) {
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  assert.equal(lines[0], "---", `${basename(path)}: no frontmatter`);
  const end = lines.indexOf("---", 1);
  assert.notEqual(end, -1, `${basename(path)}: unterminated frontmatter`);
  const fields = {};
  for (const line of lines.slice(1, end)) {
    const i = line.indexOf(":");
    if (i <= 0) continue;
    const value = line.slice(i + 1).trim();
    assert.ok(!/^[>|]/.test(value), `${basename(path)}: block scalars are not supported (${line.slice(0, i)})`);
    fields[line.slice(0, i).trim()] = value.replace(/^"(.*)"$/, "$1");
  }
  return fields;
}

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";

// Yes/no questions whose answers are kept in <claudeDir>/config-install.json, so a
// re-run or --update asks only what it has not asked before. Without a terminal the
// default answer is used and not remembered.
export function createPrompter({ file, yes, noOptional, ask }) {
  const saved = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  const interactive = Boolean(stdin.isTTY && stdout.isTTY);

  async function confirm(key, question, fallback = false) {
    if (yes) return remember(key, true);
    if (noOptional) return remember(key, false);
    if (!ask && typeof saved[key] === "boolean") return saved[key];
    if (!interactive) return fallback;
    const rl = createInterface({ input: stdin, output: stdout });
    const answer = (await rl.question(`${question} ${fallback ? "[Y/n]" : "[y/N]"} `)).trim().toLowerCase();
    rl.close();
    return remember(key, answer === "" ? fallback : answer.startsWith("y"));
  }

  function remember(key, value) {
    saved[key] = value;
    return value;
  }

  function save() {
    writeFileSync(file, `${JSON.stringify(saved, null, 2)}\n`);
  }

  return { confirm, save, interactive };
}

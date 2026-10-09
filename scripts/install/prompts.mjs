import { existsSync } from "node:fs";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { readJson, writeJson } from "./json.mjs";

// Yes/no questions. An answer given at the prompt, or by an explicit flag through
// decide(), is kept in <claudeDir>/config-install.json so a re-run or --update asks
// only what it has not asked before. --yes and --no-optional apply to one run and are
// not kept; without a terminal the default is used and not kept either.
export function createPrompter({ file, yes, noOptional, ask }) {
  const saved = existsSync(file) ? readJson(file) : {};
  const interactive = Boolean(stdin.isTTY && stdout.isTTY);

  // An essential piece (the git-guard hook) is still added under --no-optional,
  // unless an earlier run said no to it.
  async function confirm(key, question, fallback = false, { essential = false } = {}) {
    if (yes) return true;
    if (noOptional) return essential ? (saved[key] ?? fallback) : false;
    if (!ask && typeof saved[key] === "boolean") return saved[key];
    if (!interactive) return fallback;
    const rl = createInterface({ input: stdin, output: stdout });
    const answer = (await rl.question(`${question} ${fallback ? "[Y/n]" : "[y/N]"} `)).trim().toLowerCase();
    rl.close();
    return decide(key, answer === "" ? fallback : answer.startsWith("y"));
  }

  function decide(key, value) {
    saved[key] = value;
    return value;
  }

  function save() {
    writeJson(file, saved);
  }

  return { confirm, decide, save };
}

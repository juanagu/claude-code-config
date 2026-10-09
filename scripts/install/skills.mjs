import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// One skill per line in skills.txt and skills.optional.txt:
//   <github repo> <skill name> [description shown when asking]
export function readSkillList(file) {
  return readFileSync(file, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const [repo, name, ...rest] = line.split(/\s+/);
      return { repo, name, description: rest.join(" ") };
    });
}

export function linkRepoSkills(linker, repoDir, skillsDir) {
  const source = join(repoDir, "skills");
  return readdirSync(source)
    .filter((name) => statSync(join(source, name)).isDirectory())
    .map((name) => linker.link(join(skillsDir, name), join(source, name)));
}

export function installSkill({ repo, name }) {
  // stdin is closed: npx would otherwise read whatever follows on the terminal.
  const result = spawnSync("npx", ["-y", "skills", "add", repo, "--skill", name, "--global", "--agent", "claude-code", "--yes"], {
    stdio: ["ignore", "inherit", "inherit"],
    shell: process.platform === "win32",
  });
  return result.status === 0;
}

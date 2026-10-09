export const HELP = `Usage: node install.mjs [options]

Links ~/.claude to this clone, writes settings.json from the template when it is
missing, offers the optional pieces, and installs the third-party skills.

  --update              git pull --ff-only in this clone first (refuses a dirty tree)
  --claude-dir <dir>    the Claude config directory (default: ~/.claude)
  --yes                 accept every optional piece without asking
  --no-optional         the core setup only, no questions
  --ask                 ask again about pieces answered on an earlier run
  --skip-skills         do not run npx for the third-party skills
  --rtk, --no-rtk       decide the rtk hook without asking
  --codegraph, --no-codegraph
                        decide the CodeGraph allow rule without asking
  -h, --help

Answers are kept in <claude-dir>/config-install.json, so a re-run asks only
about pieces it has not asked about before.`;

const BOOLEAN_FLAGS = {
  "--update": "update",
  "--yes": "yes",
  "--no-optional": "noOptional",
  "--ask": "ask",
  "--skip-skills": "skipSkills",
  "--help": "help",
  "-h": "help",
};

export function parseArgs(argv) {
  const flags = { claudeDir: null, update: false, yes: false, noOptional: false, ask: false, skipSkills: false, rtk: null, codegraph: null, help: false };
  const args = argv[0] === "--" ? argv.slice(1) : argv;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--claude-dir") {
      flags.claudeDir = args[++i];
      if (!flags.claudeDir) throw new Error("--claude-dir needs a path.");
      continue;
    }
    if (arg === "--rtk" || arg === "--no-rtk") {
      flags.rtk = arg === "--rtk";
      continue;
    }
    if (arg === "--codegraph" || arg === "--no-codegraph") {
      flags.codegraph = arg === "--codegraph";
      continue;
    }
    const key = BOOLEAN_FLAGS[arg];
    if (!key) throw new Error(`Unknown option ${arg}. Try --help.`);
    flags[key] = true;
  }
  return flags;
}

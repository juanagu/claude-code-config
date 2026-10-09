// The pure parts of bin/bootstrap.mjs, kept apart so they can be tested without git.

// `--dir` and `--repo` are the bootstrapper's own; everything else goes to install.mjs.
// npx may or may not swallow the `--` separator, so it is dropped wherever it appears.
export function parseBootstrapArgs(argv, env = {}) {
  const args = argv.filter((arg) => arg !== "--");
  const parsed = { dir: env.CLAUDE_CODE_CONFIG_DIR ?? null, repo: null, passthrough: [] };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dir") parsed.dir = requireValue(args, i++);
    else if (args[i] === "--repo") parsed.repo = requireValue(args, i++);
    else parsed.passthrough.push(args[i]);
  }
  return parsed;
}

function requireValue(args, i) {
  const value = args[i + 1];
  if (!value || value.startsWith("--")) throw new Error(`${args[i]} needs a value.`);
  return value;
}

// npm accepts `github:owner/name`, a plain URL, `git+https://…` and the object form.
export function cloneUrlFromPackage(pkg) {
  const spec = typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url;
  if (!spec) throw new Error("package.json has no `repository` field, so there is nothing to clone.");
  const github = spec.match(/^github:([^/]+\/[^/]+?)(?:\.git)?$/);
  if (github) return `https://github.com/${github[1]}.git`;
  return spec.replace(/^git\+/, "");
}

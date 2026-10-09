import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readJson, writeJson } from "./json.mjs";
import { toPosix } from "./paths.mjs";

export const GIT_GUARD_NEEDLE = "hooks/git-guard.mjs";
export const GIT_GUARD_MATCHER = "Bash|PowerShell";
export const RTK_NEEDLE = "rtk hook";
export const RTK_MATCHER = "Bash";
export const RTK_COMMAND = "rtk hook claude";
export const CODEGRAPH_RULE = "mcp__codegraph__*";

// settings.json is copied from the template, never linked: Claude Code rewrites it.
export function readSettings(claudeDir, repoDir) {
  const path = join(claudeDir, "settings.json");
  if (existsSync(path)) return { path, settings: readJson(path), created: false };
  const template = readFileSync(join(repoDir, "settings.template.json"), "utf8").replaceAll("__CLAUDE_DIR__", toPosix(claudeDir));
  return { path, settings: JSON.parse(template), created: true };
}

export function gitGuardCommand(claudeDir) {
  return `node "${toPosix(claudeDir)}/hooks/git-guard.mjs"`;
}

export function hasHook(settings, needle) {
  return (settings.hooks?.PreToolUse ?? []).some((entry) =>
    (entry.hooks ?? []).some((hook) => typeof hook.command === "string" && hook.command.includes(needle)),
  );
}

export function addHook(settings, matcher, command) {
  settings.hooks ??= {};
  settings.hooks.PreToolUse ??= [];
  settings.hooks.PreToolUse.push({ matcher, hooks: [{ type: "command", command }] });
}

export function hasAllowRule(settings, rule) {
  return (settings.permissions?.allow ?? []).includes(rule);
}

export function addAllowRule(settings, rule) {
  settings.permissions ??= {};
  settings.permissions.allow ??= [];
  settings.permissions.allow.push(rule);
}

export const writeSettings = writeJson;

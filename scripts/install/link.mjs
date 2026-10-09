import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, renameSync, rmdirSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, join, resolve, sep } from "node:path";

export function toPosix(path) {
  return path.split(sep).join("/");
}

export function samePath(a, b) {
  const normalise = (path) => resolve(path.replace(/^\\\\\?\\/, "")).replace(/[\\/]+$/, "");
  const [x, y] = [normalise(a), normalise(b)];
  return process.platform === "win32" ? x.toLowerCase() === y.toLowerCase() : x === y;
}

function lstat(path) {
  try {
    return lstatSync(path);
  } catch {
    return null;
  }
}

function removeLink(path) {
  try {
    unlinkSync(path);
  } catch {
    rmdirSync(path);
  }
}

// Links entries of the Claude directory into the clone. A real file or directory in
// the way is moved to backup-<timestamp>/ first; a link in the way holds no data and
// is removed.
export function createLinker(claudeDir) {
  const backupDir = join(claudeDir, `backup-${timestamp()}`);
  let backedUp = false;

  function backup(path) {
    mkdirSync(backupDir, { recursive: true });
    renameSync(path, join(backupDir, basename(path)));
    backedUp = true;
  }

  function linksTo(path, target) {
    const stat = lstat(path);
    return Boolean(stat?.isSymbolicLink() && samePath(readlinkSync(path), target));
  }

  function link(path, target) {
    if (linksTo(path, target)) return false;
    const stat = lstat(path);
    if (stat?.isSymbolicLink()) removeLink(path);
    else if (stat) backup(path);
    // "junction" makes a directory junction on Windows, which needs no admin rights,
    // and is ignored on every other platform.
    symlinkSync(target, path, "junction");
    return true;
  }

  function writeImport(path, repoDir) {
    const line = `@${toPosix(repoDir)}/CLAUDE.md`;
    if (existsSync(path) && readFileSync(path, "utf8").trim() === line) return false;
    if (lstat(path)) backup(path);
    writeFileSync(path, `${line}\n`);
    return true;
  }

  function sweepBrokenLinks(dir) {
    const removed = [];
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (lstat(full)?.isSymbolicLink() && !existsSync(full)) {
        removeLink(full);
        removed.push(name);
      }
    }
    return removed;
  }

  return { link, writeImport, sweepBrokenLinks, backupDir: () => (backedUp ? backupDir : null) };
}

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\..*/, "").replace("T", "-");
}

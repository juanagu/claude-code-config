#!/usr/bin/env bash
# Builds a sandbox repo for one open-pr eval: setup.sh <target-dir> <happy|on-main-dirty|failing-tests>
# origin is a local bare repo, so a push is real but goes nowhere.
set -euo pipefail
target="$1"; mode="$2"
# A fresh target only: re-running into an old sandbox would keep its refs and pushes.
if [ -e "$target" ]; then echo "setup.sh: $target already exists; pass a new directory" >&2; exit 1; fi
mkdir -p "$target"; cd "$target"
git init -q --bare origin.git
git init -q -b main repo; cd repo
git config user.email eval@example.com; git config user.name eval
git remote add origin ../origin.git
# open-pr pushes without asking only where the project's CLAUDE.md grants it.
printf '# notifications-svc\n\nClaude may push branches and open PRs here without asking.\n' > CLAUDE.md

cat > package.json <<'EOF'
{
  "name": "notifications-svc",
  "private": true,
  "type": "module",
  "scripts": {
    "lint": "node scripts/lint.mjs",
    "test": "node --test"
  }
}
EOF
mkdir -p scripts src test
cat > scripts/lint.mjs <<'EOF'
import { readdirSync } from "node:fs";
const bad = readdirSync("src").filter((f) => /[A-Z]/.test(f));
if (bad.length) { console.error("filename-case:", bad.join(", ")); process.exit(1); }
console.log("lint ok");
EOF
cat > src/format-date.js <<'EOF'
export const formatDate = (d) => d.toISOString().slice(0, 10);
EOF
cat > test/format-date.test.js <<'EOF'
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDate } from "../src/format-date.js";
test("formats", () => assert.equal(formatDate(new Date("2026-01-02T10:00:00Z")), "2026-01-02"));
EOF
printf '# notifications-svc\n\nRun `npm run lint` and `npm test` before pushing.\n' > README.md
git add -A; git commit -qm "chore: initial commit"; git push -q -u origin main

add_unread_count() {
  cat > src/unread-count.js <<'EOF'
export function unreadCount(items) {
  return items.filter((n) => !n.read).length;
}
EOF
  cat > test/unread-count.test.js <<EOF
import { test } from "node:test";
import assert from "node:assert/strict";
import { unreadCount } from "../src/unread-count.js";
test("counts unread", () => assert.equal(unreadCount([{ read: false }, { read: true }]), $1));
EOF
}

case "$mode" in
  happy)
    git checkout -qb feat/unread-count
    add_unread_count 1
    git add -A; git commit -qm "feat(notifications): add unreadCount helper"
    printf 'test("is zero when everything is read", () => assert.equal(unreadCount([{ read: true }]), 0));\n' >> test/unread-count.test.js
    git add -A; git commit -qm "test(notifications): cover the all-read case"
    ;;
  on-main-dirty)
    add_unread_count 1
    printf '\nUnread counts come from `src/unread-count.js`.\n' >> README.md
    ;;
  failing-tests)
    git checkout -qb feat/unread-count
    add_unread_count 2
    git add -A; git commit -qm "feat(notifications): add unreadCount helper"
    ;;
esac

mkdir -p ../gh-fixtures
printf '{"defaultBranchRef":{"name":"main"},"nameWithOwner":"acme/notifications-svc"}\n' > ../gh-fixtures/repo-view.json

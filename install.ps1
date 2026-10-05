#Requires -Version 5.1
<#
  Links ~/.claude to this repo so there is one copy of the config, not two.

  - ~/.claude/CLAUDE.md becomes a one-line import of this repo's CLAUDE.md.
  - ~/.claude/agents and ~/.claude/hooks become directory junctions to this repo's agents/ and hooks/.
  - Each skill in this repo's skills/ is junctioned into ~/.claude/skills/;
    skills installed from elsewhere are left alone.
  - ~/.claude/settings.json is written from settings.template.json when missing (copied, not linked).
  - The third-party skills listed in skills.txt are installed from upstream
    with `npx skills`.

  Anything replaced is moved to ~/.claude/backup-<timestamp>/ first. Junctions
  need no admin rights. Re-running is safe.
#>

param([string]$ClaudeDir = (Join-Path $HOME ".claude"))

$ErrorActionPreference = "Stop"
$claudeDir = $ClaudeDir
$skillsDir = Join-Path $claudeDir "skills"
$backupDir = Join-Path $claudeDir ("backup-" + (Get-Date -Format "yyyyMMdd-HHmmss"))

function Test-JunctionTo($path, $target) {
    $item = Get-Item $path -Force -ErrorAction SilentlyContinue
    return $item -and $item.LinkType -eq "Junction" -and ($item.Target -replace '\\$','') -eq ($target -replace '\\$','')
}

function Set-Junction($path, $target) {
    if (Test-JunctionTo $path $target) { return }
    if (Test-Path $path) {
        New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
        Move-Item $path (Join-Path $backupDir (Split-Path $path -Leaf))
    }
    New-Item -ItemType Junction -Path $path -Target $target | Out-Null
}

New-Item -ItemType Directory -Force -Path $skillsDir | Out-Null

$claudeMd = Join-Path $claudeDir "CLAUDE.md"
$import = "@" + ((Join-Path $PSScriptRoot "CLAUDE.md") -replace "\\", "/")
if (-not ((Test-Path $claudeMd) -and ((Get-Content $claudeMd -Raw).Trim() -eq $import))) {
    if (Test-Path $claudeMd) {
        New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
        Move-Item $claudeMd (Join-Path $backupDir "CLAUDE.md")
    }
    # No BOM: PowerShell 5.1's -Encoding utf8 writes one, and it would sit in front of the "@".
    [IO.File]::WriteAllText($claudeMd, "$import`n", (New-Object Text.UTF8Encoding $false))
}

Set-Junction (Join-Path $claudeDir "agents") (Join-Path $PSScriptRoot "agents")
Set-Junction (Join-Path $claudeDir "hooks") (Join-Path $PSScriptRoot "hooks")

# settings.json is copied, never linked: Claude Code rewrites it itself. Created only when missing;
# an existing one is left alone and told what it lacks.
$settings = Join-Path $claudeDir "settings.json"
$hookNeedle = "hooks/git-guard.mjs"
if (-not (Test-Path $settings)) {
    $template = Get-Content (Join-Path $PSScriptRoot "settings.template.json") -Raw
    $template = $template -replace "__CLAUDE_DIR__", ($claudeDir -replace "\\", "/")
    [IO.File]::WriteAllText($settings, $template, (New-Object Text.UTF8Encoding $false))
    Write-Host "Wrote $settings from settings.template.json."
} elseif (-not ((Get-Content $settings -Raw) -match [regex]::Escape($hookNeedle))) {
    Write-Host "NOTE: $settings exists and has no git-guard hook. Add the PreToolUse entry from settings.template.json."
}

Get-ChildItem (Join-Path $PSScriptRoot "skills") -Directory | ForEach-Object {
    Set-Junction (Join-Path $skillsDir $_.Name) $_.FullName
}

# A broken junction (a skill that moved to skills.txt, or a clone that moved) would block reinstalling it.
Get-ChildItem $skillsDir -Force | Where-Object {
    $_.LinkType -eq "Junction" -and -not (Test-Path ([string]$_.Target))
} | ForEach-Object { [IO.Directory]::Delete($_.FullName) }

Write-Host "Linked ~/.claude to $PSScriptRoot (CLAUDE.md import; agents/, hooks/ and skills/ junctions)."
if (Test-Path $backupDir) { Write-Host "Replaced files were moved to $backupDir" }

if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
    Write-Host "npx not found: skipped the skills in skills.txt. Install Node.js and re-run."
    return
}
$failed = @()
Get-Content (Join-Path $PSScriptRoot "skills.txt") | Where-Object { $_ -notmatch '^\s*(#|$)' } | ForEach-Object {
    $repo, $skill = -split $_
    npx -y skills add $repo --skill $skill --global --agent claude-code --yes
    if ($LASTEXITCODE -ne 0) { $failed += $skill }
}
if ($failed) { Write-Host "Failed to install: $($failed -join ', ')"; exit 1 }

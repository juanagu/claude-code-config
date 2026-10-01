#Requires -Version 5.1
<#
  Links ~/.claude to this repo so there is one copy of the config, not two.

  - ~/.claude/CLAUDE.md becomes a one-line import of this repo's CLAUDE.md.
  - ~/.claude/agents becomes a directory junction to this repo's agents/.
  - Each skill in this repo's skills/ is junctioned into ~/.claude/skills/;
    skills installed from elsewhere (e.g. archify) are left alone.

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

Get-ChildItem (Join-Path $PSScriptRoot "skills") -Directory | ForEach-Object {
    Set-Junction (Join-Path $skillsDir $_.Name) $_.FullName
}

Write-Host "Linked ~/.claude to $PSScriptRoot (CLAUDE.md import, agents/ and skills/ junctions)."
if (Test-Path $backupDir) { Write-Host "Replaced files were moved to $backupDir" }
Write-Host "archify isn't included here (see README) - reinstall it separately if you use it."

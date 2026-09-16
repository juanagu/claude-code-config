#Requires -Version 5.1
<#
  Installs this repo's CLAUDE.md, agents/, and skills/ into ~/.claude on this machine.
  Existing files at the destination are overwritten; anything else in ~/.claude is untouched.
#>

$claudeDir = Join-Path $HOME ".claude"
$agentsDir = Join-Path $claudeDir "agents"
$skillsDir = Join-Path $claudeDir "skills"

New-Item -ItemType Directory -Force -Path $agentsDir | Out-Null
New-Item -ItemType Directory -Force -Path $skillsDir | Out-Null

Copy-Item (Join-Path $PSScriptRoot "CLAUDE.md") $claudeDir -Force
Copy-Item (Join-Path $PSScriptRoot "agents\*.md") $agentsDir -Force

Get-ChildItem (Join-Path $PSScriptRoot "skills") -Directory | ForEach-Object {
    $dest = Join-Path $skillsDir $_.Name
    if (Test-Path $dest) { Remove-Item -Recurse -Force $dest }
    Copy-Item $_.FullName $dest -Recurse
}

Write-Host "Installed CLAUDE.md, agents/, and skills/ into $claudeDir"
Write-Host "Don't forget: archify isn't included here (see README) — reinstall it separately if you use it."

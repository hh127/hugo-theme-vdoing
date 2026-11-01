<#
.SYNOPSIS
  Full verification: build, check internal links, capture screenshots (inline Edge capture).

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File tools/verify.ps1
  powershell -NoProfile -ExecutionPolicy Bypass -File tools/verify.ps1 -UseQA
#>
param(
  [string]$Destination = "public",
  [int]$Port = 8899,
  [int]$Width = 1440,
  [int]$Height = 1000,
  [switch]$UseQA
)
$ErrorActionPreference = "Continue"
Set-Location (Split-Path -Parent $PSScriptRoot)
$fail = 0

Write-Host "==> hugo build" -ForegroundColor Cyan
$configArgs = @()
if ($UseQA) { $configArgs = @("--config", "hugo.toml,tools/qa.toml") }
$cacheDir = Join-Path (Get-Location) ".tmp/cache-verify"
$buildOut = & hugo @configArgs --minify --destination $Destination --cacheDir $cacheDir --noBuildLock --logLevel warn 2>&1
if ($LASTEXITCODE -ne 0) { Write-Host ($buildOut | Out-String) -ForegroundColor Red; $fail++ }
else { Write-Host ($buildOut | Select-Object -Last 10 | Out-String) }

Write-Host "==> check links" -ForegroundColor Cyan
$linkOut = & python tools/check_links.py $Destination 2>&1
Write-Host ($linkOut | Out-String)
if ($LASTEXITCODE -ne 0) { $fail++ }

$root = (Resolve-Path -LiteralPath $Destination).Path
$tmpDir = Join-Path (Get-Location) ".tmp"
New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null

function Test-Server([int]$p) {
  try { $r = Invoke-WebRequest -Uri "http://127.0.0.1:$p/" -UseBasicParsing -TimeoutSec 2; return $r.StatusCode -eq 200 }
  catch { return $false }
}
if (-not (Test-Server $Port)) {
  $log = Join-Path $tmpDir "server-$Port.log"
  $p = Start-Process -FilePath "python" -ArgumentList "-m","http.server",$Port,"--directory",$root -WindowStyle Hidden -PassThru -RedirectStandardOutput $log -RedirectStandardError "$log.err"
  Set-Content -Path (Join-Path $tmpDir "server-$Port.pid") -Value $p.Id
  for ($i = 0; $i -lt 40; $i++) { Start-Sleep -Milliseconds 300; if (Test-Server $Port) { break } }
  if (-not (Test-Server $Port)) { Write-Host "static server failed on port $Port" -ForegroundColor Red; exit 1 }
}

$edgeCandidates = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
)
$edge = $edgeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { Write-Host "Chrome/Edge not found" -ForegroundColor Red; exit 1 }

function Capture([string]$page, [string]$name, [int]$w, [int]$h) {
  $out = Join-Path $tmpDir "verify-$name.png"
  $profile = Join-Path $tmpDir ("edge-prof-" + [guid]::NewGuid().ToString("N").Substring(0, 8))
  $url = "http://127.0.0.1:$Port" + $page
  $edgeArgs = @(
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--disable-extensions",
    "--no-first-run", "--no-default-browser-check",
    "--virtual-time-budget=8000",
    "--user-data-dir=$profile",
    "--screenshot=$out",
    "--window-size=$w,$h",
    $url
  )
  $proc = Start-Process -FilePath $edge -ArgumentList $edgeArgs -PassThru -WindowStyle Hidden
  if (-not $proc.WaitForExit(45000)) { try { $proc.Kill() } catch {} }
  Start-Sleep -Milliseconds 200
  Remove-Item -Recurse -Force $profile -ErrorAction SilentlyContinue
  if (Test-Path $out) { Write-Host ("  {0,-10} OK" -f $name); return $true }
  Write-Host ("  {0,-10} FAILED" -f $name) -ForegroundColor Red
  return $false
}

Write-Host "==> screenshots" -ForegroundColor Cyan
$shots = @(
  @{ Page = "/"; Name = "home" },
  @{ Page = "/pages/8143cc480faf9a11/"; Name = "article" },
  @{ Page = "/archives/"; Name = "archives" },
  @{ Page = "/web/"; Name = "catalogue" },
  @{ Page = "/friends/"; Name = "friends" },
  @{ Page = "/categories/"; Name = "categories" },
  @{ Page = "/tags/"; Name = "tags" },
  @{ Page = "/?mode=dark"; Name = "dark" },
  @{ Page = "/about/"; Name = "about" }
)
foreach ($s in $shots) {
  if (-not (Capture $s.Page $s.Name $Width $Height)) { $fail++ }
}
if (-not (Capture "/" "mobile" 500 1000)) { $fail++ }

if ($fail -gt 0) { Write-Host "FAILED ($fail)" -ForegroundColor Red; exit 1 }
Write-Host "OK" -ForegroundColor Green

<#
.SYNOPSIS
  Serve a Hugo build directory and capture a screenshot with headless Chrome/Edge.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File tools/screenshot.ps1 -BuildDir .tmp/build-article -Page "/" -Port 8901 -Out .tmp/a.png
#>
param(
  [string]$BuildDir = "public",
  [string]$Page = "/",
  [int]$Port = 8901,
  [string]$Out = ".tmp/shot.png",
  [int]$Width = 1440,
  [int]$Height = 1200,
  [int]$TimeBudget = 6000
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path -LiteralPath $BuildDir).Path
$edgeCandidates = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
)
$edge = $edgeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { throw "Chrome/Edge not found" }

function Test-Server([int]$p) {
  try { $r = Invoke-WebRequest -Uri "http://127.0.0.1:$p/" -UseBasicParsing -TimeoutSec 2; return $r.StatusCode -eq 200 }
  catch { return $false }
}

$tmpDir = Join-Path (Get-Location) ".tmp"
New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null

if (-not (Test-Server $Port)) {
  $log = Join-Path $tmpDir "server-$Port.log"
  $p = Start-Process -FilePath "python" -ArgumentList "-m","http.server",$Port,"--directory",$root -WindowStyle Hidden -PassThru -RedirectStandardOutput $log -RedirectStandardError "$log.err"
  Set-Content -Path (Join-Path $tmpDir "server-$Port.pid") -Value $p.Id
  for ($i = 0; $i -lt 30; $i++) { Start-Sleep -Milliseconds 300; if (Test-Server $Port) { break } }
  if (-not (Test-Server $Port)) { throw "static server failed on port $Port" }
}

$outPath = Join-Path (Get-Location) $Out
New-Item -ItemType Directory -Force -Path (Split-Path $outPath -Parent) | Out-Null
$url = "http://127.0.0.1:$Port" + $Page
# fresh profile per run: a killed headless instance leaves a lock that breaks reuse
$profileDir = Join-Path $tmpDir ("edge-profile-" + [guid]::NewGuid().ToString("N").Substring(0, 8))

$edgeArgs = @(
  "--headless=new", "--disable-gpu", "--hide-scrollbars", "--disable-extensions",
  "--no-first-run", "--no-default-browser-check",
  "--virtual-time-budget=$TimeBudget",
  "--user-data-dir=$profileDir",
  "--screenshot=$outPath",
  "--window-size=$Width,$Height",
  $url
)
$proc = Start-Process -FilePath $edge -ArgumentList $edgeArgs -PassThru -WindowStyle Hidden
if (-not $proc.WaitForExit(90000)) { try { $proc.Kill() } catch {} }
Start-Sleep -Milliseconds 300
Remove-Item -Recurse -Force $profileDir -ErrorAction SilentlyContinue
if (Test-Path $outPath) { Write-Output "OK $outPath" } else { throw "screenshot failed: $url" }

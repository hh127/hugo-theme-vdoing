<#
.SYNOPSIS
  Serve a Hugo build directory and capture a screenshot with headless Edge/Chrome.

.DESCRIPTION
  视口宽度由 CDP 的 Emulation.setDeviceMetricsOverride 精确设定 (见 tools/screenshot.cjs)。
  不要改回 `--screenshot --window-size` 的方式: 那样 --window-size=1280 的实际
  innerWidth 只有 1254, 会把 1279/1280 断点附近的页面截成错误布局。

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File tools/screenshot.ps1 -BuildDir public -Page "/" -Port 8901 -Out .tmp/a.png -Width 1440
#>
param(
  [string]$BuildDir = "public",
  [string]$Page = "/",
  [int]$Port = 8901,
  [string]$Out = ".tmp/shot.png",
  [int]$Width = 1440,
  [int]$Height = 1200,
  [int]$TimeBudget = 7000
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

$outPath = if ([System.IO.Path]::IsPathRooted($Out)) { $Out } else { Join-Path (Get-Location) $Out }
New-Item -ItemType Directory -Force -Path (Split-Path $outPath -Parent) | Out-Null
$url = "http://127.0.0.1:$Port" + $Page

# 每次用全新 profile: 被 kill 的 headless 实例会留下 lock, 复用会失败
$profileDir = Join-Path $tmpDir ("edge-prof-" + [guid]::NewGuid().ToString("N").Substring(0, 8))
$cdpPort = Get-Random -Minimum 9300 -Maximum 9399

$edgeArgs = @(
  "--headless=new", "--disable-gpu", "--hide-scrollbars", "--disable-extensions",
  "--no-first-run", "--no-default-browser-check",
  "--user-data-dir=$profileDir",
  "--remote-debugging-port=$cdpPort",
  "about:blank"
)
$proc = Start-Process -FilePath $edge -ArgumentList $edgeArgs -PassThru -WindowStyle Hidden
try {
  $cjs = Join-Path (Get-Location) "tools/screenshot.cjs"
  & node $cjs $url $outPath $Width $Height $cdpPort $TimeBudget
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path $outPath)) { throw "screenshot failed: $url" }
} finally {
  if ($proc -and -not $proc.HasExited) { try { $proc.Kill() } catch {} }
  Start-Sleep -Milliseconds 200
  if ($profileDir) { Remove-Item -Recurse -Force $profileDir -ErrorAction SilentlyContinue }
}
Write-Output "OK $outPath"

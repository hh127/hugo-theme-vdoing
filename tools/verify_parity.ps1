<#
.SYNOPSIS
  Acceptance checks for the fixes listed in docs/parity-gaps.md.
  Builds the site, inspects generated HTML/JSON/JS/SCSS and asserts each fixed item.

.DESCRIPTION
  Static assertions run by default. With -Toggles an extra build uses
  .tmp/parity-override.toml to verify switches really work:
  updateBar.showToArticle / search / prevLinks / pageStyle fallback /
  head + customCss injection / thirdpartySearch / bodyBgImgOpacity=0.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File tools/verify_parity.ps1
  powershell -NoProfile -ExecutionPolicy Bypass -File tools/verify_parity.ps1 -Toggles -UseQA
#>
param(
  [string]$Destination = ".tmp/build-parity",
  [string]$ToggleDestination = ".tmp/build-parity-toggle",
  [switch]$Toggles,
  [switch]$UseQA
)

$ErrorActionPreference = "Continue"
Set-Location (Split-Path -Parent $PSScriptRoot)
$script:pass = 0
$script:fail = 0

function Check([string]$name, [bool]$ok, [string]$detail = "") {
  if ($ok) { $script:pass++; Write-Host ("  [PASS] {0} {1}" -f $name, $detail) -ForegroundColor Green }
  else { $script:fail++; Write-Host ("  [FAIL] {0} {1}" -f $name, $detail) -ForegroundColor Red }
}

function Read-Page([string]$root, [string]$rel) {
  $p = Join-Path $root $rel
  if (Test-Path -LiteralPath $p) { return (Get-Content -LiteralPath $p -Raw -Encoding utf8) }
  return ""
}

function Build-Site([string]$dest, [string[]]$configArgs) {
  $cacheDir = Join-Path (Get-Location) (".tmp/cache-" + ($dest -replace '[\\/]', '-'))
  # no --minify: assertions rely on quoted attributes
  & hugo @configArgs --destination $dest --cacheDir $cacheDir --noBuildLock --logLevel warn 2>&1 | Out-Null
  return ($LASTEXITCODE -eq 0)
}

function Count-HtmlPages([string]$root) {
  return (Get-ChildItem -LiteralPath $root -Recurse -Filter *.html -ErrorAction SilentlyContinue).Count
}

# ---------------------------------------------------------------- static output
Write-Host "==> build ($Destination)" -ForegroundColor Cyan
$configArgs = @()
if ($UseQA) { $configArgs = @("--config", "hugo.toml,tools/qa.toml") }
Check "hugo build" (Build-Site $Destination $configArgs)

if (-not (Test-Path -LiteralPath $Destination)) { Write-Host "build failed, abort" -ForegroundColor Red; exit 1 }

Write-Host "==> internal links" -ForegroundColor Cyan
$linkOut = & python tools/check_links.py $Destination 2>&1
$linkText = ($linkOut | Out-String)
Write-Host ($linkText.Trim())
Check "internal links" ($LASTEXITCODE -eq 0) ($linkText.Trim() -split "`n" | Select-Object -First 1)

$pages = Count-HtmlPages $Destination
Check "html pages" ($pages -gt 200) "pages=$pages"

Write-Host "==> P0 gitalk / zooming config keys" -ForegroundColor Cyan
$article = Read-Page $Destination "pages\8143cc480faf9a11\index.html"
$gitalkJson = [regex]::Match($article, 'window\.__GITALK__\s*=\s*(\{.*?\});', 'Singleline').Groups[1].Value
Check "gitalk clientID camelCase" ($gitalkJson -match '"clientID"') ($gitalkJson.Substring(0, [Math]::Min(80, $gitalkJson.Length)))
Check "gitalk no lowercase clientid key" ($gitalkJson -cnotmatch '"clientid"\s*:')
Check "gitalk clientSecret camelCase" ($gitalkJson -match '"clientSecret"')
$zoomJson = [regex]::Match($article, 'window\.__ZOOMING__\s*=\s*(\{.*?\});', 'Singleline').Groups[1].Value
Check "zooming bgColor camelCase" ($zoomJson -match '"bgColor"') $zoomJson
Check "zooming no lowercase bgcolor key" ($zoomJson -cnotmatch '"bgcolor"\s*:')

Write-Host "==> P1 prev/next page nav" -ForegroundColor Cyan
$dupPages = New-Object System.Collections.Generic.List[string]
$navPages = 0
Get-ChildItem -LiteralPath $Destination -Recurse -Filter *.html | ForEach-Object {
  $t = Get-Content -LiteralPath $_.FullName -Raw -Encoding utf8
  $pm = [regex]::Match($t, 'class="[^"]*page-nav-centre-prev"[^>]*href="([^"]+)"')
  $nm = [regex]::Match($t, 'class="[^"]*page-nav-centre-next"[^>]*href="([^"]+)"')
  if ($pm.Success -and $nm.Success) {
    $script:navPages++
    if ($pm.Groups[1].Value -eq $nm.Groups[1].Value) { $dupPages.Add($_.FullName.Replace((Resolve-Path $Destination).Path, '')) }
  }
}
Check "prev != next everywhere" ($dupPages.Count -eq 0) "both=$navPages, dup=$($dupPages.Count) $(if($dupPages.Count){'e.g.'+$dupPages[0]})"
Check "prev/next coverage" ($navPages -gt 100) "pages with both links=$navPages"

Write-Host "==> P0 404 runtime random / gitalk local asset" -ForegroundColor Cyan
$notFound = Read-Page $Destination "404.html"
Check "404 data-msgs present" ($notFound -match 'data-msgs')
Check "404 messages list" (([regex]::Matches($notFound, '\u3002|\uFF1F|Four-Oh-Four')).Count -ge 3) ""
Check "gitalk local asset referenced" ($article -match '/gitalk/gitalk\.min\.js')

Write-Host "==> P1 code-group content conversion" -ForegroundColor Cyan
$cg = Read-Page $Destination "pages\8481d1\index.html"
Check "code-group page no raw tags" ($cg -notmatch '<code-group|<code-block')
Check "code-group page has tab DOM" ($cg -match 'code-group') ""

Write-Host "==> P1 search index (light list index + lazy full-text index)" -ForegroundColor Cyan
$indexJson = Read-Page $Destination "index.json"
$searchJson = Read-Page $Destination "search-index.json"
Check "light index.json exists" ($indexJson.Length -gt 0) ("size={0:N0}KB" -f ($indexJson.Length / 1KB))
Check "light index.json size" ($indexJson.Length -lt 400KB) ("size={0:N0}KB" -f ($indexJson.Length / 1KB))
Check "light index.json has no full text" ($indexJson -cnotmatch '"content"\s*:')
Check "search-index.json exists" ($searchJson.Length -gt 0) ("size={0:N0}KB" -f ($searchJson.Length / 1KB))
Check "search-index.json has content" ($searchJson -cmatch '"content"\s*:')
Check "search-index.json has headers field" ($searchJson -match '"headers"')
try {
  $light = $indexJson | ConvertFrom-Json
  $full = $searchJson | ConvertFrom-Json
  Check "light index entries" ($light.Count -ge 200) "count=$($light.Count)"
  Check "full index entries" ($full.Count -ge 200) "count=$($full.Count)"
  $withHeaders = @($full | Where-Object { $_.headers -and $_.headers.Count -gt 0 }).Count
  Check "full index headers non-empty" ($withHeaders -gt 100) "withHeaders=$withHeaders"
} catch { Check "index.json parses" $false $_.Exception.Message }

Write-Host "==> P1 categories/tags page size + no-js fallback" -ForegroundColor Cyan
$catSize = (Get-Item -LiteralPath (Join-Path $Destination "categories\index.html") -ErrorAction SilentlyContinue).Length
$tagSize = (Get-Item -LiteralPath (Join-Path $Destination "tags\index.html") -ErrorAction SilentlyContinue).Length
$catHtml = Read-Page $Destination "categories\index.html"
$tagHtml = Read-Page $Destination "tags\index.html"
Check "categories page shrunk" ($catSize -gt 0 -and $catSize -lt 120KB) ("size={0:N0}KB" -f ($catSize / 1KB))
Check "tags page shrunk" ($tagSize -gt 0 -and $tagSize -lt 120KB) ("size={0:N0}KB" -f ($tagSize / 1KB))
Check "categories has noscript" ($catHtml -match '<noscript')
Check "categories has canonical" ($catHtml -match 'rel="canonical"')

Write-Host "==> P1 home excerpt keeps rich text" -ForegroundColor Cyan
$homeHtml = Read-Page $Destination "index.html"
Check "home excerpt has img" ($homeHtml -match '(?s)class="excerpt[^"]*"[^>]*>.*?<img')
Check "home excerpt not plainified" ($homeHtml -match '(?s)class="excerpt')

Write-Host "==> P2 archives / catalogue / demo" -ForegroundColor Cyan
$arch = Read-Page $Destination "archives\index.html"
Check "archives progressive loading" ($arch -match '(?i)load.?more|data-archives|archives-more|\u52a0\u8f7d\u66f4\u591a')
$catalogue = Read-Page $Destination "web\index.html"
# catalogue frontmatter has editLink: false (same as the original site), so the edit link is hidden by design.
# The audit gap was that catalogue pages lost PageEdit/PageNav entirely; assert the wrapper partials render.
Check "catalogue page-edit block" ($catalogue -match 'class="page-edit"|class="last-updated"')
Check "catalogue has prev/next" ($catalogue -match 'page-nav')
$demo = Read-Page $Destination "pages\40b4db2d38ba85f2\index.html"
Check "demo preview/code toggle" ($demo -match 'demo-(toggle|tabs|preview)|\u9884\u89c8')

Write-Host "==> source wiring assertions" -ForegroundColor Cyan
$zoomJs = Get-Content -LiteralPath "themes/vdoing/assets/js/zoom.js" -Raw
Check "zoom.js wheel" ($zoomJs -match 'wheel')
Check "zoom.js drag pan" ($zoomJs -match 'mousedown|pointerdown')
Check "zoom.js touch gestures" ($zoomJs -match 'touchstart|touchmove')
$searchJs = Get-Content -LiteralPath "themes/vdoing/assets/js/search.js" -Raw
Check "search.js keyboard nav" (($searchJs -match 'ArrowDown') -and ($searchJs -match 'ArrowUp') -and ($searchJs -match 'Enter'))
Check "search.js headers anchors" ($searchJs -match 'headers')
Check "search.js lazy full-text index" (($searchJs -match 'search-index\.json') -and ($searchJs -match 'search-loading'))
$anchorJs = Get-Content -LiteralPath "themes/vdoing/assets/js/anchor-compat.js" -Raw
Check "anchor compat (VuePress slugify)" (($anchorJs -match 'vpSlug') -and ($anchorJs -match 'hashchange'))
$tagsBarHtml = Get-Content -LiteralPath "themes/vdoing/layouts/partials/tags-bar.html" -Raw
Check "tag colors stable (fnv32a)" ($tagsBarHtml -match 'fnv32a')
$sidebarTree = Get-Content -LiteralPath "themes/vdoing/layouts/partials/sidebar-tree.html" -Raw
Check "sidebar displayAllHeaders" ($sidebarTree -match 'displayAllHeaders')
$tocJs = Get-Content -LiteralPath "themes/vdoing/assets/js/toc-scroll.js" -Raw
Check "toc-scroll smoothScroll wiring" ($tocJs -match 'smoothScroll')
$shellJs = Get-Content -LiteralPath "themes/vdoing/assets/js/shell.js" -Raw
Check "shell.js mode key migration" (($shellJs -match "'mode'") -and ($shellJs -match 'vdoing-mode'))
$navHtml = Get-Content -LiteralPath "themes/vdoing/layouts/partials/nav.html" -Raw
Check "nav external target/rel" (($navHtml -match 'target="_blank"') -and ($navHtml -match 'noopener'))
Check "nav repoLabel platform inference" ($navHtml -match 'gitlab|bitbucket|repoLabel')
$pageEdit = Get-Content -LiteralPath "themes/vdoing/layouts/partials/page-edit.html" -Raw
Check "page-edit Bitbucket" ($pageEdit -match 'bitbucket')
Check "page-edit outbound icon" ($pageEdit -match 'outbound|icon-|svg')
Check "page-edit last updated from git" ($pageEdit -match 'GitInfo')
$headHtml = Get-Content -LiteralPath "themes/vdoing/layouts/partials/head.html" -Raw
Check "head custom injection points" (($headHtml -match 'customCss') -and ($headHtml -match 'Params.head|site.Params.head'))
$migrate = Get-Content -LiteralPath "tools/migrate_content.py" -Raw
Check "migrate script code-group rule" ($migrate -match 'code-group')
Check "migrate script categoryText" ($migrate -match 'categoryText')

# ---------------------------------------------------------------- toggle builds
if ($Toggles) {
  Write-Host "==> switch toggles build ($ToggleDestination)" -ForegroundColor Cyan
  $override = Join-Path (Get-Location) ".tmp/parity-override.toml"
  @'
# temporary override for acceptance: trigger every "config not wired" branch
[params]
  search = false
  prevLinks = false
  nextLinks = false
  pageStyle = "bogus"
  bodyBgImg = ["/img/logo.png"]
  bodyBgImgOpacity = 0
  head = '<meta name="parity-head" content="1">'
  customCss = '.parity-css{color:red}'
[params.updateBar]
  showToArticle = false
[[params.thirdpartySearch]]
  name = "Baidu"
  link = "https://www.baidu.com/s?wd={query}"
'@ | Set-Content -LiteralPath $override -Encoding ascii
  $toggleArgs = @("--config", "hugo.toml,.tmp/parity-override.toml")
  Check "toggle build" (Build-Site $ToggleDestination $toggleArgs)

  $tArticle = Read-Page $ToggleDestination "pages\8143cc480faf9a11\index.html"
  $tHome = Read-Page $ToggleDestination "index.html"
  Check "updateBar.showToArticle=false" ($tArticle -notmatch 'class="article-list"')
  Check "prevLinks=false" ($tArticle -notmatch 'page-nav-centre-prev')
  Check "pageStyle bogus falls back to card" ($tArticle -match 'theme-style-card' -and $tArticle -notmatch 'theme-style-bogus')
  Check "head injection works" ($tArticle -match 'parity-head')
  Check "customCss injection works" ($tArticle -match 'parity-css')
  Check "search=false hides box" (($tArticle -notmatch 'search-box') -and ($tArticle -notmatch '<input[^>]+search'))
  Check "thirdpartySearch works" (($tArticle -match 'baidu\.com') -or ($tHome -match 'baidu\.com'))
  Check "bodyBgImgOpacity=0 works" (($tArticle -match 'opacity:\s*0(?![.\d])') -or ($tArticle -match '--body-bg-opacity:\s*0(?![.\d])'))
}

Write-Host ""
if ($script:fail -gt 0) { Write-Host ("RESULT: FAILED ({0} passed, {1} failed)" -f $script:pass, $script:fail) -ForegroundColor Red; exit 1 }
Write-Host ("RESULT: OK ({0} passed)" -f $script:pass) -ForegroundColor Green

<#
  LazyMAL one-shot deploy — ships to BOTH hosts.

    ./deploy.ps1 ["commit message"]

  1. Type-checks + builds the frontend for Cloudflare (root base). Aborts on fail.
  2. Deploys that build to Cloudflare Pages  -> https://lazymal.pages.dev
  3. Deploys the Cloudflare Worker (api/).
  4. Commits & pushes — the deploy.yml GitHub Action then rebuilds with the
     /lazymal/ base and publishes to GitHub Pages.
#>
param(
  [string]$Message = "Deploy: $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
)

# Note: don't use 'Stop' — native tools (git) write harmless warnings to
# stderr, which 'Stop' would treat as fatal. We gate on $LASTEXITCODE instead.
$ErrorActionPreference = 'Continue'
$root = $PSScriptRoot
Set-Location $root

function Step($text) { Write-Host "`n=== $text ===" -ForegroundColor Magenta }

# 1. Frontend build for Cloudflare Pages (root base). Also our fail-fast gate.
Step 'Building frontend (Cloudflare, root base)'
$env:DEPLOY_TARGET = 'cloudflare'
npm run build
$buildExit = $LASTEXITCODE
Remove-Item Env:DEPLOY_TARGET
if ($buildExit -ne 0) { Write-Host 'Frontend build failed — aborting.' -ForegroundColor Red; exit 1 }

# 2. Cloudflare Pages (production deployment -> lazymal.pages.dev).
Step 'Deploying to Cloudflare Pages'
# Clear any stale redirected deploy config that trips `wrangler pages deploy`.
if (Test-Path '.wrangler\deploy\config.json') { Remove-Item '.wrangler\deploy\config.json' -Force }
npx wrangler pages deploy dist --project-name lazymal --branch main --commit-dirty=true
if ($LASTEXITCODE -ne 0) { Write-Host 'Cloudflare Pages deploy failed — aborting.' -ForegroundColor Red; exit 1 }

# 3. Cloudflare Worker (API).
Step 'Deploying Worker (Cloudflare)'
Push-Location "$root\api"
npx wrangler deploy --config ./wrangler.toml
$workerExit = $LASTEXITCODE
Pop-Location
if ($workerExit -ne 0) { Write-Host 'Worker deploy failed — aborting.' -ForegroundColor Red; exit 1 }

# 4. Push frontend — triggers the GitHub Pages Action (builds with /lazymal/ base).
Step 'Pushing frontend (-> GitHub Pages Action)'
git add -A
$dirty = git status --porcelain
if ($dirty) {
  git commit -q -m $Message
  Write-Host "Committed: $Message"
} else {
  Write-Host 'No source changes to commit — pushing any pending commits.'
}
git push -q
if ($LASTEXITCODE -ne 0) { Write-Host 'git push failed.' -ForegroundColor Red; exit 1 }

Step 'Done'
Write-Host 'Live on:' -ForegroundColor Green
Write-Host '  Cloudflare Pages -> https://lazymal.pages.dev' -ForegroundColor Green
Write-Host '  GitHub Pages     -> building via Actions (gh run watch)' -ForegroundColor DarkGray

<#
  LazyMAL one-shot deploy.

    ./deploy.ps1 ["commit message"]

  1. Type-checks + builds the frontend (aborts if it fails).
  2. Deploys the Cloudflare Worker (api/).
  3. Commits & pushes — the deploy.yml GitHub Action then builds and
     publishes the site to GitHub Pages.
#>
param(
  [string]$Message = "Deploy: $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
Set-Location $root

function Step($text) { Write-Host "`n=== $text ===" -ForegroundColor Magenta }

# 1. Frontend build (tsc -b && vite build) — fail fast before touching anything.
Step 'Building frontend'
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host 'Frontend build failed — aborting.' -ForegroundColor Red; exit 1 }

# 2. Cloudflare Worker.
Step 'Deploying Worker (Cloudflare)'
Push-Location "$root\api"
npx wrangler deploy --config ./wrangler.toml
$workerExit = $LASTEXITCODE
Pop-Location
if ($workerExit -ne 0) { Write-Host 'Worker deploy failed — aborting.' -ForegroundColor Red; exit 1 }

# 3. Push frontend — triggers the GitHub Pages Action.
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
Write-Host 'Worker is live. Pages is building via GitHub Actions — check:' -ForegroundColor Green
Write-Host '  gh run watch' -ForegroundColor DarkGray

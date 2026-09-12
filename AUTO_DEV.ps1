$ErrorActionPreference = 'SilentlyContinue'

Write-Host 'One Market Auto Dev' -ForegroundColor Cyan
Write-Host 'Le site va rester lance et GitHub sera verifie automatiquement.' -ForegroundColor Gray
Write-Host ''

$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $repo

if (-not (Test-Path 'node_modules')) {
  Write-Host 'Installation des dependances...' -ForegroundColor Yellow
  npm.cmd install
}

# Lance Vite dans une autre fenetre PowerShell.
Start-Process powershell -ArgumentList '-NoExit','-Command',"cd '$repo'; npm.cmd run dev"

Write-Host 'Synchronisation GitHub active. Laisse cette fenetre ouverte.' -ForegroundColor Green
Write-Host 'Quand une mise a jour arrive, elle sera recuperee automatiquement.' -ForegroundColor Gray

while ($true) {
  git fetch origin main | Out-Null

  $local = git rev-parse HEAD
  $remote = git rev-parse origin/main

  if ($local -ne $remote) {
    Write-Host ''
    Write-Host 'Nouvelle version detectee. Mise a jour...' -ForegroundColor Yellow
    git pull --ff-only origin main

    if ($LASTEXITCODE -eq 0) {
      Write-Host 'Mise a jour terminee. Vite recharge le site automatiquement.' -ForegroundColor Green
    } else {
      Write-Host 'La mise a jour automatique a echoue. Verifie les modifications locales.' -ForegroundColor Red
    }
  }

  Start-Sleep -Seconds 5
}

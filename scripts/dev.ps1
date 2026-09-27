<#
.SYNOPSIS
  MedTrouxa — desenvolvimento no Windows (PowerShell).
.EXAMPLE
  .\scripts\dev.ps1 up        # sobe tudo em Docker (site :5173, API :3000)
  .\scripts\dev.ps1 local     # só banco/redis em Docker; API e site rodando no Windows (hot reload)
  .\scripts\dev.ps1 logs      # acompanha os logs da API
  .\scripts\dev.ps1 down      # para tudo (mantém os dados)
  .\scripts\dev.ps1 reset     # para e APAGA os dados de desenvolvimento
  .\scripts\dev.ps1 test      # testes e checagens (backend, site e app)
  .\scripts\dev.ps1 failover  # mostra os nós do Postgres
#>
param([ValidateSet('up', 'local', 'logs', 'down', 'reset', 'test', 'failover', 'mobile')] [string]$Acao = 'up')
$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

function Assert-Docker {
  docker info *> $null
  if ($LASTEXITCODE -ne 0) { throw 'Docker não está rodando. Abra o Docker Desktop (modo contêineres Linux / WSL2) e tente de novo.' }
}
function Wait-Api {
  Write-Host 'Aguardando a API...' -NoNewline
  for ($i = 0; $i -lt 90; $i++) {
    try { $r = Invoke-RestMethod http://localhost:3000/api/health -TimeoutSec 2; if ($r.status -eq 'ok') { Write-Host ' ok'; return } } catch { }
    Start-Sleep 2; Write-Host '.' -NoNewline
  }
  Write-Warning 'A API demorou para responder. Veja: .\scripts\dev.ps1 logs'
}

switch ($Acao) {
  'up' {
    Assert-Docker
    if (-not (Test-Path .env)) { Copy-Item .env.example .env; Write-Host 'Criado .env (opcional: coloque ANTHROPIC_API_KEY para a Coruja IA)' }
    docker compose up -d --build
    Wait-Api
    Write-Host "`nSite:  http://localhost:5173`nAPI:   http://localhost:3000/api`nAdmin: admin@medtrouxa.dev / Coruja#Dev2026`nCódigos de e-mail aparecem em: .\scripts\dev.ps1 logs" -ForegroundColor Green
  }
  'local' {
    Assert-Docker
    docker compose up -d pg-0 pg-1 pg-2 pgpool redis
    Write-Host 'Banco e Redis no ar. Abrindo API e site em janelas separadas...'
    $api = "Set-Location (Join-Path '$Root' 'backend'); npm install; `$env:REDIS_URL='redis://:devredis@localhost:6379'; npm run start:dev"
    $web = "Set-Location (Join-Path '$Root' 'frontend'); npm install; npm run dev"
    Start-Process powershell -ArgumentList '-NoExit', '-Command', $api
    Start-Process powershell -ArgumentList '-NoExit', '-Command', $web
    Write-Host 'Site: http://localhost:5173  (proxy /api -> :3000)' -ForegroundColor Green
  }
  'logs' { docker compose logs -f --tail 200 backend }
  'down' { docker compose down }
  'reset' {
    $ok = Read-Host 'Isto APAGA o banco de desenvolvimento. Digite APAGAR para confirmar'
    if ($ok -eq 'APAGAR') { docker compose down -v } else { Write-Host 'Cancelado.' }
  }
  'test' {
    Push-Location backend;  npm install; npx tsc --noEmit -p .; npx jest; Pop-Location
    Push-Location frontend; npm install; npx tsc -b; Pop-Location
    Push-Location mobile;   npm install; npm run verify; Pop-Location
  }
  'failover' {
    docker compose exec pgpool bash -c 'PGPASSWORD=adminpass psql -h localhost -U postgres -c "show pool_nodes"'
    Write-Host "Teste: docker compose stop pg-0  (outro nó assume em ~30s)  |  docker compose start pg-0"
    Write-Host "Se todos os nós caíram juntos (ex.: reinício do Docker): docker compose restart pgpool"
  }
  'mobile' {
    Push-Location mobile; npm install
    $env:EXPO_PUBLIC_API_URL = 'http://localhost:3000/api'
    Write-Host 'Emulador Android usa http://10.0.2.2:3000/api automaticamente. Celular físico: use o IP do PC na rede.'
    npx expo start
    Pop-Location
  }
}

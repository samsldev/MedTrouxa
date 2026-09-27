<#
.SYNOPSIS
  MedTrouxa — produção numa VPS Windows (PowerShell). Requer Docker Desktop com contêineres LINUX (WSL2).
.EXAMPLE
  .\scripts\prod.ps1 secrets   # 1ª vez: cria .env.production com todos os segredos fortes gerados
  .\scripts\prod.ps1 up        # sobe/atualiza tudo (build + migrations automáticas + HTTPS)
  .\scripts\prod.ps1 update    # git pull + rebuild sem derrubar o banco
  .\scripts\prod.ps1 status    # contêineres, saúde da API e nós do Postgres
  .\scripts\prod.ps1 logs      # logs da API (Ctrl+C para sair)
  .\scripts\prod.ps1 backup    # backup imediato (além do diário automático)
  .\scripts\prod.ps1 restore -Arquivo backups\medtrouxa-AAAAMMDD-HHMM.sql.gz.enc
  .\scripts\prod.ps1 down      # para tudo (dados preservados)
#>
param(
  [ValidateSet('secrets', 'up', 'update', 'status', 'logs', 'backup', 'restore', 'down')] [string]$Acao = 'status',
  [string]$Arquivo
)
$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root
$Compose = @('compose', '-f', 'docker-compose.prod.yml', '--env-file', '.env.production')

function New-Secret([int]$Bytes = 48) {
  $b = New-Object byte[] $Bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
  [Convert]::ToBase64String($b).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}
function Assert-Env {
  if (-not (Test-Path .env.production)) { throw 'Falta .env.production. Rode primeiro: .\scripts\prod.ps1 secrets' }
  $vazios = Get-Content .env.production | Where-Object { $_ -match '^(DOMAIN|DB_PASSWORD|JWT_SECRET|ENCRYPTION_KEY|BACKUP_PASSPHRASE|MP_ACCESS_TOKEN|MP_PUBLIC_KEY|MP_WEBHOOK_SECRET|ADMIN_EMAIL)=\s*$' }
  if ($vazios) { throw "Preencha no .env.production: $($vazios -join ', ')" }
}
function Assert-Docker {
  docker info *> $null
  if ($LASTEXITCODE -ne 0) { throw 'Docker não está rodando.' }
  if ((docker info --format '{{.OSType}}') -ne 'linux') { throw 'O Docker está em modo Windows containers. Troque para Linux containers (WSL2).' }
}
function Invoke-Compose { & docker @Compose @args; if ($LASTEXITCODE -ne 0) { throw "docker compose falhou ($LASTEXITCODE)" } }

switch ($Acao) {
  'secrets' {
    if (Test-Path .env.production) { throw '.env.production já existe — não vou sobrescrever seus segredos.' }
    $gerar = @{
      DB_PASSWORD = New-Secret; PG_ADMIN_PASSWORD = New-Secret; PGPOOL_ADMIN_PASSWORD = New-Secret; REPMGR_PASSWORD = New-Secret
      REDIS_PASSWORD = New-Secret; JWT_SECRET = New-Secret 64; BACKUP_PASSPHRASE = New-Secret 48
    }
    # ENCRYPTION_KEY: 32 bytes do gerador criptográfico, em base64 padrão (equivale a openssl rand -base64 32)
    $k = New-Object byte[] 32; [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($k); $gerar.ENCRYPTION_KEY = [Convert]::ToBase64String($k)
    $linhas = Get-Content .env.production.example | ForEach-Object {
      if ($_ -match '^([A-Z_]+)=\s*$' -and $gerar.ContainsKey($Matches[1])) { "$($Matches[1])=$($gerar[$Matches[1]])" } else { $_ }
    }
    [IO.File]::WriteAllText((Join-Path $Root ".env.production"), (($linhas -join "`n") + "`n"))   # LF, sem BOM
    Write-Host "Criado .env.production com segredos fortes. Agora preencha: DOMAIN, ADMIN_EMAIL, ADMIN_PASSWORD, MP_*, SMTP_URL, ANTHROPIC_API_KEY e (se for emitir nota) NFSE_*." -ForegroundColor Green
    Write-Warning 'Guarde uma cópia do .env.production fora do servidor: sem ENCRYPTION_KEY e BACKUP_PASSPHRASE não dá para ler o 2FA nem os backups.'
  }
  'up' {
    Assert-Docker; Assert-Env
    Invoke-Compose up -d --build
    Write-Host 'Subindo... (migrations rodam sozinhas; o HTTPS é emitido pelo Caddy no primeiro acesso)'
    Start-Sleep 20
    & $PSCommandPath status
  }
  'update' {
    Assert-Docker; Assert-Env
    git pull --ff-only
    Invoke-Compose build backend frontend
    Invoke-Compose up -d --no-deps backend frontend
    & $PSCommandPath status
  }
  'status' {
    Invoke-Compose ps
    $domain = (Get-Content .env.production | Where-Object { $_ -match '^DOMAIN=' }) -replace '^DOMAIN=', ''
    try { $h = Invoke-RestMethod "https://$domain/api/health" -TimeoutSec 10; Write-Host "API: $($h.status) | banco: $($h.db.node) | redis: $($h.redis)" -ForegroundColor Green }
    catch { Write-Warning "https://$domain/api/health não respondeu: $($_.Exception.Message)" }
  }
  'logs' { Invoke-Compose logs -f --tail 200 backend }
  'backup' {
    Invoke-Compose exec -T backup sh -c 'f=/backups/medtrouxa-$(date +%Y%m%d-%H%M)-manual.sql.gz.enc; pg_dump --no-owner | gzip | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:BACKUP_PASSPHRASE -out "$f" && echo "backup ok: $f"'
  }
  'restore' {
    if (-not $Arquivo -or -not (Test-Path $Arquivo)) { throw 'Informe o arquivo: -Arquivo backups\medtrouxa-....sql.gz.enc' }
    $nome = Split-Path $Arquivo -Leaf
    $ok = Read-Host "Isto SOBRESCREVE o banco de produção com $nome. Digite RESTAURAR para confirmar"
    if ($ok -ne 'RESTAURAR') { Write-Host 'Cancelado.'; return }
    Invoke-Compose stop backend
    Invoke-Compose exec -T backup psql -v ON_ERROR_STOP=1 -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
    Invoke-Compose exec -T backup sh -c "openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE -in /backups/$nome | gunzip | psql -v ON_ERROR_STOP=1 --single-transaction"
    Invoke-Compose start backend
    Write-Host 'Restaurado.' -ForegroundColor Green
  }
  'down' { Invoke-Compose down }
}

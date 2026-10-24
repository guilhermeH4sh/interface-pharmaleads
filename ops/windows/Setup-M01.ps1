param([string]$Python = '3.12')
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
Push-Location $repoRoot
try {
    $env:UV_CACHE_DIR = Join-Path $repoRoot '.uv-cache'
    $env:npm_config_cache = Join-Path $repoRoot '.npm-cache'
    uv sync --locked --python $Python --no-python-downloads
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao sincronizar Python. Instale Python 3.12 e uv; ou informe -Python com caminho absoluto.' }
    npm.cmd --prefix apps/web ci
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao instalar frontend. Requer Node 24 e npm.' }
} finally { Pop-Location }

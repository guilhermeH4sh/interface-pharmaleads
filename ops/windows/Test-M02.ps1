param([switch]$Integration)
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
Push-Location $repoRoot
try {
    $python = Join-Path $repoRoot '.venv/Scripts/python.exe'
    & $python -m ruff check packages/backend/src tests/unit tests/integration database/migrations
    if ($LASTEXITCODE -ne 0) { throw 'Ruff falhou.' }
    & $python -m ruff format --check packages/backend/src tests/unit tests/integration database/migrations
    if ($LASTEXITCODE -ne 0) { throw 'Formatação falhou.' }
    & $python -m mypy
    if ($LASTEXITCODE -ne 0) { throw 'Tipos falharam.' }
    & $python -m pytest tests/unit -q
    if ($LASTEXITCODE -ne 0) { throw 'Testes unitários falharam.' }
    if ($Integration) {
        if ($env:PHARMALEADS_M02_INTEGRATION -ne '1') {
            throw 'Integração exige opt-in explícito PHARMALEADS_M02_INTEGRATION=1 e banco local descartável.'
        }
        & $python -m pytest tests/integration/test_m02_database.py -q
        if ($LASTEXITCODE -ne 0) { throw 'Integração PostgreSQL falhou.' }
    } else {
        Write-Output 'Integração não executada. Testes locais não provam grants/migrations em servidor.'
    }
} finally { Pop-Location }

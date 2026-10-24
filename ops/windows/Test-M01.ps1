$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
Push-Location $repoRoot
try {
    $python = Join-Path $repoRoot '.venv/Scripts/python.exe'
    & $python -m ruff check packages/backend/src tests/unit
    if ($LASTEXITCODE -ne 0) { throw 'Ruff falhou.' }
    & $python -m ruff format --check packages/backend/src tests/unit
    if ($LASTEXITCODE -ne 0) { throw 'Formatação Python falhou.' }
    & $python -m mypy
    if ($LASTEXITCODE -ne 0) { throw 'Tipos Python falharam.' }
    & $python -m pytest tests/unit -q
    if ($LASTEXITCODE -ne 0) { throw 'Testes Python falharam.' }
    foreach ($task in @('lint','typecheck','test','build','test:e2e')) {
        npm.cmd --prefix apps/web run $task
        if ($LASTEXITCODE -ne 0) { throw "Verificação web falhou: $task" }
    }
} finally { Pop-Location }

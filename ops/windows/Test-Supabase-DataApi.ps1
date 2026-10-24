$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$python = Join-Path $repoRoot '.venv/Scripts/python.exe'
$name = 'PHARMALEADS_DATA_API_PUBLISHABLE_KEY'

if (-not (Test-Path -LiteralPath $python -PathType Leaf)) {
    throw 'Python do projeto não encontrado. Execute ops/windows/Setup-M01.ps1 antes.'
}
if (Test-Path "Env:$name") {
    throw "A variável $name já está definida; use uma sessão PowerShell limpa."
}

$publishableKey = Read-Host 'Chave publicável do projeto (sb_publishable_...)'
if ($publishableKey -notmatch '^sb_publishable_[A-Za-z0-9_-]+$') {
    throw 'Copie somente a chave publicável existente no painel Supabase.'
}

try {
    Set-Item "Env:$name" $publishableKey
    Push-Location $repoRoot
    try {
        & $python -m pharmaleads.infrastructure.data_api
        if ($LASTEXITCODE -ne 0) {
            throw 'A prova read-only da Data API falhou; consulte o status acima.'
        }
    } finally {
        Pop-Location
    }
} finally {
    Remove-Item "Env:$name" -ErrorAction SilentlyContinue
    Remove-Variable publishableKey -ErrorAction SilentlyContinue
}

param()

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$python = Join-Path $repoRoot '.venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $python -PathType Leaf)) {
    throw 'Execute Setup-M01.ps1 primeiro.'
}
$expectedFiles = @(
    Get-ChildItem -LiteralPath (Join-Path $repoRoot '.m05-stage') -Filter 'records.ndjson' -Recurse |
        Where-Object { $_.Directory.Name -like 'pilot-100-*' }
)
if ($expectedFiles.Count -ne 1) {
    throw 'Arquivo único do piloto de 100 leads não foi localizado.'
}

$managedNames = @(
    'PHARMALEADS_DATA_API_PUBLISHABLE_KEY',
    'PHARMALEADS_DATA_API_ACCESS_TOKEN'
)
foreach ($name in $managedNames) {
    if ([Environment]::GetEnvironmentVariable($name, 'Process')) {
        throw "Use uma sessao PowerShell limpa; variavel ja definida: $name"
    }
}

function Read-SecretValue([string]$Prompt) {
    $secure = Read-Host $Prompt -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
}

try {
    $key = Read-SecretValue 'Chave publicavel sb_publishable_...'
    if ($key -notmatch '^sb_publishable_[A-Za-z0-9_-]+$') {
        throw 'Use somente a chave publicavel do projeto.'
    }
    $token = Read-SecretValue 'Access token JWT atualizado do usuario operador'
    if (($token -split '\.').Count -ne 3) {
        throw 'Access token JWT invalido.'
    }
    [Environment]::SetEnvironmentVariable($managedNames[0], $key, 'Process')
    [Environment]::SetEnvironmentVariable($managedNames[1], $token, 'Process')
    $key = $null
    $token = $null

    Push-Location $repoRoot
    try {
        & $python -m pharmaleads.infrastructure.m07_audit_cli `
            --expected-file $expectedFiles[0].FullName `
            --confirmed-lead-id 60 `
            --confirmed-url 'https://fdc.com.br/'
        if ($LASTEXITCODE -ne 0) {
            throw 'Auditoria remota dos 100 leads não foi concluida.'
        }
    }
    finally {
        Pop-Location
    }
}
finally {
    foreach ($name in $managedNames) {
        [Environment]::SetEnvironmentVariable($name, $null, 'Process')
    }
    Remove-Variable key, token -ErrorAction SilentlyContinue
}

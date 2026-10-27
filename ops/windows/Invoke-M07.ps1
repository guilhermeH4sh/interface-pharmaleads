param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('validar', 'validar-arquivo', 'propor', 'revisar')]
    [string]$Command,

    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Arguments
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$python = Join-Path $repoRoot '.venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $python -PathType Leaf)) {
    throw 'Execute Setup-M01.ps1 primeiro.'
}

Push-Location $repoRoot
try {
    & $python -m pharmaleads.infrastructure.site_cli $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw 'Operação M07 não foi concluída.'
    }
}
finally {
    Pop-Location
}

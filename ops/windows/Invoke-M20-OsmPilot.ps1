param(
    [Parameter(Mandatory = $true)]
    [int[]]$LeadId,
    [string]$PbfFile,
    [switch]$DownloadPbf
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$python = Join-Path $repoRoot '.venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $python -PathType Leaf)) {
    throw 'Execute Setup-M01.ps1 primeiro.'
}
if ($LeadId.Count -lt 1 -or $LeadId.Count -gt 20 -or ($LeadId | Where-Object { $_ -lt 1 })) {
    throw 'Informe de 1 a 20 IDs positivos da UF SP.'
}
if ($PbfFile -and $DownloadPbf) { throw 'Use PbfFile ou DownloadPbf, não os dois.' }

$managedNames = @('PHARMALEADS_DATA_API_PUBLISHABLE_KEY', 'PHARMALEADS_DATA_API_ACCESS_TOKEN')
foreach ($name in $managedNames) {
    if ([Environment]::GetEnvironmentVariable($name, 'Process')) {
        throw "Use uma sessao PowerShell limpa; variavel ja definida: $name"
    }
}

function Read-SecretValue([string]$Prompt) {
    $secure = Read-Host $Prompt -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

try {
    $key = Read-SecretValue 'Chave publicavel sb_publishable_...'
    if ($key -notmatch '^sb_publishable_[A-Za-z0-9_-]+$') { throw 'Chave publicavel inválida.' }
    $token = Read-SecretValue 'Access token JWT atualizado do usuario operador'
    if (($token -split '\.').Count -ne 3) { throw 'Access token JWT invalido.' }
    [Environment]::SetEnvironmentVariable($managedNames[0], $key, 'Process')
    [Environment]::SetEnvironmentVariable($managedNames[1], $token, 'Process')
    $key = $null
    $token = $null

    $arguments = @('-m', 'pharmaleads.infrastructure.m20_cli')
    foreach ($id in $LeadId) { $arguments += '--lead-id'; $arguments += $id }
    if ($PbfFile) { $arguments += '--pbf-file'; $arguments += $PbfFile }
    if ($DownloadPbf) { $arguments += '--download-pbf' }
    $arguments += '--apply'
    Push-Location $repoRoot
    try {
        & $python @arguments
        if ($LASTEXITCODE -ne 0) { throw 'Descoberta OSM M20 falhou.' }
    }
    finally { Pop-Location }
}
finally {
    foreach ($name in $managedNames) {
        [Environment]::SetEnvironmentVariable($name, $null, 'Process')
    }
    Remove-Variable key, token -ErrorAction SilentlyContinue
}

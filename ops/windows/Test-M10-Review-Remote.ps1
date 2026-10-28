param(
    [int]$LeadId = 60,
    [string[]]$ContactId = @(),
    [ValidateSet('approved', 'rejected')]
    [string]$Decision
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$python = Join-Path $repoRoot '.venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $python -PathType Leaf)) {
    throw 'Execute Setup-M01.ps1 primeiro.'
}
if ($LeadId -lt 1) { throw 'LeadId deve ser positivo.' }

$managedNames = @(
    'PHARMALEADS_DATA_API_PUBLISHABLE_KEY',
    'PHARMALEADS_DATA_API_ACCESS_TOKEN',
    'PHARMALEADS_TABLE_WRITE_APPROVED'
)
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
    if ($ContactId.Count -eq 0) {
        $ContactId = (Read-Host 'ID do contato a revisar').Split(',', [StringSplitOptions]::RemoveEmptyEntries)
    }
    if (-not $Decision) {
        $Decision = Read-Host 'Decisão (approved ou rejected)'
    }
    if ($ContactId.Count -eq 0 -or $Decision -notin @('approved', 'rejected')) {
        throw 'Revisão M10 inválida.'
    }
    [Environment]::SetEnvironmentVariable($managedNames[0], $key, 'Process')
    [Environment]::SetEnvironmentVariable($managedNames[1], $token, 'Process')
    [Environment]::SetEnvironmentVariable($managedNames[2], 'public.pharmaleads', 'Process')
    $key = $null
    $token = $null

    $arguments = @('-m', 'pharmaleads.infrastructure.m10_review_cli', '--lead-id', $LeadId,
        '--decision', $Decision, '--apply')
    foreach ($id in $ContactId) { $arguments += '--contact-id'; $arguments += $id }
    Push-Location $repoRoot
    try {
        & $python @arguments
        if ($LASTEXITCODE -ne 0) { throw 'Revisão remota M10 falhou.' }
    }
    finally { Pop-Location }
}
finally {
    foreach ($name in $managedNames) {
        [Environment]::SetEnvironmentVariable($name, $null, 'Process')
    }
    Remove-Variable key, token -ErrorAction SilentlyContinue
}

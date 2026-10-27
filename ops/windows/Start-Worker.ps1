param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$')]
    [string]$WorkerId,
    [switch]$Once
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$python = Join-Path $repoRoot '.venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $python)) { throw 'Execute Setup-M01.ps1 primeiro.' }

$required = @(
    'PHARMALEADS_DATA_API_PUBLISHABLE_KEY',
    'PHARMALEADS_DATA_API_ACCESS_TOKEN',
    'PHARMALEADS_TABLE_WRITE_APPROVED'
)
foreach ($name in $required) {
    if (-not [Environment]::GetEnvironmentVariable($name, 'Process')) {
        throw "Variavel de processo obrigatoria ausente: $name"
    }
}
if ($env:PHARMALEADS_TABLE_WRITE_APPROVED -ne 'public.pharmaleads') {
    throw 'Destino operacional diferente de public.pharmaleads.'
}

$arguments = @('-m', 'pharmaleads.infrastructure.worker_cli', '--worker-id', $WorkerId)
if ($Once) { $arguments += '--once' }
& $python @arguments
if ($LASTEXITCODE -ne 0) { throw 'Worker M06 encerrado com falha.' }

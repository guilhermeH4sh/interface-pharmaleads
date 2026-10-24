param(
    [ValidateSet('direct', 'session')]
    [string]$ConnectionMode = 'session',
    [string]$CaCertificate,
    [ValidatePattern('^[a-zA-Z_][a-zA-Z0-9_]*$')]
    [string]$DatabaseRole = 'postgres'
)

$ErrorActionPreference = 'Stop'
$projectRef = 'qxsdcrywsjkrpcbfgbxb'
$sessionHost = 'aws-1-sa-east-1.pooler.supabase.com'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$python = Join-Path $repoRoot '.venv/Scripts/python.exe'
if (-not $CaCertificate) {
    $CaCertificate = Join-Path $repoRoot '.tmp/supabase/prod-ca-2021.crt'
}

if (-not (Test-Path -LiteralPath $python -PathType Leaf)) {
    throw 'Python do projeto não encontrado. Execute ops/windows/Setup-M01.ps1 antes.'
}
if (-not $CaCertificate -or -not (Test-Path -LiteralPath $CaCertificate -PathType Leaf)) {
    throw 'Informe -CaCertificate com o caminho do certificado CA baixado do projeto Supabase.'
}
$dbHost = if ($ConnectionMode -eq 'direct') { "db.$projectRef.supabase.co" } else { $sessionHost }
$dbUser = if ($ConnectionMode -eq 'direct') { $DatabaseRole } else { "$DatabaseRole.$projectRef" }
$names = @(
    'PHARMALEADS_DB_ENVIRONMENT', 'PHARMALEADS_DB_URL',
    'PHARMALEADS_DB_TARGET_HOST', 'PHARMALEADS_DB_TARGET_DATABASE',
    'PHARMALEADS_DB_CONNECTION_MODE', 'PHARMALEADS_DB_PROJECT_REF',
    'PHARMALEADS_DB_SSLROOTCERT', 'PHARMALEADS_DB_LOCAL_TEST',
    'PHARMALEADS_DB_POOL_SIZE'
)
foreach ($name in $names) {
    if (Test-Path "Env:$name") {
        throw "A variável $name já está definida. Use uma sessão PowerShell limpa para evitar sobrescrevê-la."
    }
}

$password = Read-Host 'Senha PostgreSQL deste projeto (não aparece na tela)' -AsSecureString
$passwordPtr = [IntPtr]::Zero
try {
    $passwordPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPtr)
    $encodedPassword = [Uri]::EscapeDataString($plainPassword)
    $encodedUser = [Uri]::EscapeDataString($dbUser)
    $env:PHARMALEADS_DB_ENVIRONMENT = 'development'
    $env:PHARMALEADS_DB_URL = "postgresql+psycopg://${encodedUser}:${encodedPassword}@${dbHost}:5432/postgres"
    $env:PHARMALEADS_DB_TARGET_HOST = $dbHost
    $env:PHARMALEADS_DB_TARGET_DATABASE = 'postgres'
    $env:PHARMALEADS_DB_CONNECTION_MODE = $ConnectionMode
    $env:PHARMALEADS_DB_PROJECT_REF = $projectRef
    $env:PHARMALEADS_DB_SSLROOTCERT = (Resolve-Path -LiteralPath $CaCertificate).Path
    $env:PHARMALEADS_DB_LOCAL_TEST = 'false'
    $env:PHARMALEADS_DB_POOL_SIZE = '1'

    Push-Location $repoRoot
    try {
        & $python -m pharmaleads.infrastructure.database.cli inspect
        if ($LASTEXITCODE -ne 0) {
            throw 'Inspeção somente leitura falhou. Confira host, usuário, TLS e credencial no painel.'
        }
    } finally {
        Pop-Location
    }
} finally {
    foreach ($name in $names) {
        Remove-Item "Env:$name" -ErrorAction SilentlyContinue
    }
    if ($passwordPtr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPtr)
    }
    Remove-Variable plainPassword, encodedPassword, password -ErrorAction SilentlyContinue
}

param(
    [Parameter(Mandatory = $true)][string]$File,
    [Parameter(Mandatory = $true)][ValidateSet('insert', 'update')][string]$Mode,
    [switch]$Apply
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$python = Join-Path $repoRoot '.venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $python)) { throw 'Execute Setup-M01.ps1 primeiro.' }

$arguments = @('-m', 'pharmaleads.infrastructure.data_api_writer', '--file', $File, '--mode', $Mode)
if ($Apply) { $arguments += '--apply' }
if ($Apply -and [Environment]::GetEnvironmentVariable('PHARMALEADS_TABLE_WRITE_APPROVED', 'Process') -ne 'public.pharmaleads') {
    throw 'Escrita bloqueada ate revisao da politica da tabela e liberacao operacional.'
}
$setKeyHere = $false
try {
    if ($Apply -and -not [Environment]::GetEnvironmentVariable('PHARMALEADS_DATA_API_PUBLISHABLE_KEY', 'Process')) {
        $secureKey = Read-Host 'Chave publicavel sb_publishable_... do projeto autorizado' -AsSecureString
        $keyPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
        try {
            $plainKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPtr)
            if ($plainKey -notmatch '^sb_publishable_[A-Za-z0-9_-]+$') {
                throw 'Use somente a chave publicavel sb_publishable_...'
            }
            [Environment]::SetEnvironmentVariable('PHARMALEADS_DATA_API_PUBLISHABLE_KEY', $plainKey, 'Process')
            $setKeyHere = $true
        }
        finally {
            $plainKey = $null
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPtr)
        }
    }
    & $python @arguments
    if ($LASTEXITCODE -ne 0) { throw 'Importacao nao concluida. Nenhum sucesso foi presumido.' }
}
finally {
    if ($setKeyHere) {
        [Environment]::SetEnvironmentVariable('PHARMALEADS_DATA_API_PUBLISHABLE_KEY', $null, 'Process')
    }
}

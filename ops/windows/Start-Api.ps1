param([switch]$ConnectSupabase)
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$python = Join-Path $repoRoot '.venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $python)) { throw 'Execute Setup-M01.ps1 primeiro.' }
$setKeyHere = $false
try {
    if ($ConnectSupabase -and -not [Environment]::GetEnvironmentVariable('PHARMALEADS_DATA_API_PUBLISHABLE_KEY', 'Process')) {
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
    & $python -m pharmaleads.api
    if ($LASTEXITCODE -ne 0) { throw 'API encerrada com falha. Confira a configuracao PHARMALEADS_*.' }
}
finally {
    if ($setKeyHere) {
        [Environment]::SetEnvironmentVariable('PHARMALEADS_DATA_API_PUBLISHABLE_KEY', $null, 'Process')
    }
}

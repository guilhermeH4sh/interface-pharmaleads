$ErrorActionPreference = 'Stop'
$webRoot = (Resolve-Path (Join-Path $PSScriptRoot '../../apps/web')).Path
npm.cmd --prefix $webRoot run dev
if ($LASTEXITCODE -ne 0) { throw 'Frontend encerrado com falha.' }

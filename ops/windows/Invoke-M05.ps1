param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('validar', 'dry-run', 'importar', 'coletar-oficial', 'amostrar', 'promover', 'relatorio')]
    [string]$Command,
    [string[]]$InputFile,
    [string]$Output,
    [string]$Competencia,
    [string]$Stage,
    [int]$Size = 100,
    [int]$BatchSize = 100,
    [switch]$Apply
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$python = Join-Path $repoRoot '.venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $python)) { throw 'Execute Setup-M01.ps1 primeiro.' }

$arguments = @('-m', 'pharmaleads.infrastructure.receita_cli', $Command)
if ($Command -in @('validar', 'dry-run', 'importar')) {
    if (-not $InputFile) { throw 'Informe -InputFile com os ZIPs oficiais locais.' }
    foreach ($item in $InputFile) { $arguments += @('--input', $item) }
}
if ($Command -in @('dry-run', 'importar')) {
    if (-not $Competencia) { throw 'Informe -Competencia no formato AAAA-MM-DD.' }
    $stageOutput = if ($Output) { $Output } else { '.m05-stage' }
    $arguments += @('--output', $stageOutput, '--competencia', $Competencia)
}
if ($Command -in @('promover', 'relatorio')) {
    if (-not $Stage) { throw 'Informe -Stage com o diretório gerado pela importação.' }
    $arguments += @('--stage', $Stage)
}
if ($Command -eq 'amostrar') {
    if (-not $Stage) { throw 'Informe -Stage com o diretório gerado pela importação.' }
    $stageOutput = if ($Output) { $Output } else { '.m05-stage' }
    $arguments += @('--stage', $Stage, '--output', $stageOutput, '--size', $Size)
}
if ($Command -eq 'promover') {
    $arguments += @('--batch-size', $BatchSize)
    if ($Apply) { $arguments += '--apply' }
}
if ($Command -eq 'relatorio' -and $Output) { $arguments += @('--output', $Output) }

& $python @arguments
if ($LASTEXITCODE -ne 0) { throw 'Operação M05 não concluída.' }

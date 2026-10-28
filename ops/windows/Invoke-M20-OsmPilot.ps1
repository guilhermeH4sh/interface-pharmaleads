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

function Read-M20Credentials {
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    $form = New-Object System.Windows.Forms.Form
    $form.Text = 'PharmaLeads M20 — credenciais temporárias'
    $form.Width = 520
    $form.Height = 245
    $form.StartPosition = 'CenterScreen'
    $form.FormBorderStyle = 'FixedDialog'
    $form.MaximizeBox = $false

    $keyLabel = New-Object System.Windows.Forms.Label
    $keyLabel.Text = 'Chave publicável do Supabase'
    $keyLabel.Left = 18; $keyLabel.Top = 20; $keyLabel.Width = 460
    $form.Controls.Add($keyLabel)
    $keyBox = New-Object System.Windows.Forms.TextBox
    $keyBox.Left = 18; $keyBox.Top = 43; $keyBox.Width = 465
    $form.Controls.Add($keyBox)

    $tokenLabel = New-Object System.Windows.Forms.Label
    $tokenLabel.Text = 'JWT atualizado do operador (campo protegido)'
    $tokenLabel.Left = 18; $tokenLabel.Top = 78; $tokenLabel.Width = 460
    $form.Controls.Add($tokenLabel)
    $tokenBox = New-Object System.Windows.Forms.TextBox
    $tokenBox.Left = 18; $tokenBox.Top = 101; $tokenBox.Width = 465
    $tokenBox.UseSystemPasswordChar = $true
    $form.Controls.Add($tokenBox)

    $confirm = New-Object System.Windows.Forms.Button
    $confirm.Text = 'Continuar'
    $confirm.Left = 300; $confirm.Top = 145; $confirm.Width = 88
    $confirm.DialogResult = [System.Windows.Forms.DialogResult]::OK
    $form.Controls.Add($confirm)
    $cancel = New-Object System.Windows.Forms.Button
    $cancel.Text = 'Cancelar'
    $cancel.Left = 395; $cancel.Top = 145; $cancel.Width = 88
    $cancel.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
    $form.Controls.Add($cancel)
    $form.AcceptButton = $confirm
    $form.CancelButton = $cancel

    if ($form.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
        throw 'Credenciais não informadas.'
    }
    return [pscustomobject]@{ Key = $keyBox.Text.Trim(); Token = $tokenBox.Text.Trim() }
}

try {
    Write-Host 'Abrindo a janela de credenciais do M20...'
    $credential = Read-M20Credentials
    $key = [regex]::Replace([string]$credential.Key, '[^A-Za-z0-9_-]', '')
    if ($key -notmatch '^sb_publishable_[A-Za-z0-9_-]+$') { throw 'Chave publicavel inválida.' }
    $token = $credential.Token
    if (($token -split '\.').Count -ne 3) { throw 'Access token JWT invalido.' }
    [Environment]::SetEnvironmentVariable($managedNames[0], $key, 'Process')
    [Environment]::SetEnvironmentVariable($managedNames[1], $token, 'Process')
    $key = $null
    $token = $null
    Remove-Variable credential -ErrorAction SilentlyContinue

    $arguments = @('-m', 'pharmaleads.infrastructure.m20_cli')
    foreach ($id in $LeadId) { $arguments += '--lead-id'; $arguments += $id }
    if ($PbfFile) { $arguments += '--pbf-file'; $arguments += $PbfFile }
    if ($DownloadPbf) { $arguments += '--download-pbf' }
    $arguments += '--apply'
    if ($DownloadPbf) { Write-Host 'Credenciais recebidas. Baixando e lendo o extrato OSM temporário...' }
    else { Write-Host 'Credenciais recebidas. Consultando os candidatos OSM...' }
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
    Remove-Variable key, token, credential -ErrorAction SilentlyContinue
}

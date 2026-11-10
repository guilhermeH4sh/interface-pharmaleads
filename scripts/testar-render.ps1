[CmdletBinding()]
param(
    [switch]$Iniciar
)

$ErrorActionPreference = 'Stop'
$api = 'https://api.render.com/v1'
$nome = 'pharmaleads-collector'
$chave = Read-Host 'Cole a chave da API do Render e pressione Enter' -AsSecureString
if (!$chave.Length) {
    throw 'A chave da API esta vazia.'
}

$credencial = [pscredential]::new('render', $chave)
$cabecalhos = @{
    Authorization = 'Bearer ' + $credencial.GetNetworkCredential().Password.Trim()
    Accept = 'application/json'
}
$etapa = 'buscar o servico'

try {
    Write-Host "Buscando $nome na conta do Render..."
    $lista = Invoke-RestMethod -Uri "$api/services?name=$nome&includePreviews=false&limit=100" -Headers $cabecalhos -TimeoutSec 30
    $servicos = @($lista | ForEach-Object { $_.service } | Where-Object { $_.name -eq $nome -and $_.type -eq 'web_service' })
    if ($servicos.Count -ne 1 -or $servicos[0].id -notmatch '^srv-[a-z0-9]+$') {
        throw "Esperava um Web Service chamado $nome, mas encontrei $($servicos.Count). Confira a conta e o nome no Render."
    }
    $servico = $servicos[0]
    Write-Host "Servico encontrado: $($servico.id)"
    $jobsUri = "$api/services/$($servico.id)/jobs"

    $etapa = 'consultar os jobs'
    $listaJobs = Invoke-RestMethod -Uri "${jobsUri}?limit=20" -Headers $cabecalhos -TimeoutSec 30
    $jobs = @($listaJobs | ForEach-Object { $_.job } | Where-Object { $_.id })
    $ativo = $jobs | Where-Object { $_.status -in @('pending', 'running') } | Select-Object -First 1
    if ($ativo) {
        Write-Host "Ja existe um job ativo. Nenhum outro job foi criado."
        $ativo | Select-Object id, status, createdAt
        return
    }
    if (!$Iniciar) {
        if ($jobs.Count) {
            $jobs | Select-Object -First 5 -Property id, status, createdAt
        } else {
            Write-Host 'Nenhum job encontrado.'
        }
        return
    }

    $etapa = 'iniciar o job'
    $comando = @'
sh -c 'export LOCAIS="Curitiba, PR" SEGMENTOS=manipulacao PROFUNDIDADE=1 ENRIQUECER_SITES=true GOSOM_CONCURRENCY=1; exec python -m pharmaleads.cloud_job'
'@
    $corpo = @{ planId = 'plan-srv-008'; startCommand = $comando.Trim() } | ConvertTo-Json -Compress
    Write-Host 'Solicitando um job de 2 GB para Curitiba, PR...'
    $job = Invoke-RestMethod -Uri $jobsUri -Method Post -Headers $cabecalhos -ContentType 'application/json' -Body $corpo -TimeoutSec 30
    if ($job.id -notmatch '^job-[a-z0-9]+$') {
        throw 'O Render nao retornou um ID de job. Consulte a aba One-off Jobs antes de tentar novamente.'
    }
    Write-Host 'Pedido aceito. Acompanhe o job na aba One-off Jobs do servico.'
    $job | Select-Object id, status, createdAt
} catch {
    $status = $_.Exception.Response
    if ($status) {
        $codigo = [int]$status.StatusCode
        if ($codigo -in @(401, 403)) {
            throw "Render HTTP $codigo ao $etapa. Confira se a chave da API tem acesso a este servico."
        }
        throw "Render HTTP $codigo ao ${etapa}. Confira One-off Jobs antes de repetir o envio."
    }
    throw "Falha ao ${etapa}. $($_.Exception.Message)"
} finally {
    Remove-Variable cabecalhos, credencial, chave
}

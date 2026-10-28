# Estado atual — 27/10/2026

## M10 em andamento — consolidação, revisão e evidências — 28/10/2026

Iniciado após M09. O núcleo normaliza e deduplica observações por tipo/valor, preserva fontes
e hashes de evidência, marca compartilhado somente a partir de três estabelecimentos e produz
score heurístico `m10-v1`, sem escrita comercial. As seis colunas `contact_*` foram aplicadas e
inspecionadas no Supabase. O adaptador CAS lê exclusivamente o checkpoint M08/M09 e grava somente
essas colunas; as políticas das fontes são revalidadas antes do PATCH e o teste confirma que uma
fonte revogada interrompe a operação. A prova remota do lead 60 promoveu três contatos e três
evidências, levando a revisão CAS de 0 para 1. A revisão humana remota aprovou um contato e levou
a versão a 4. Passaram 30 testes locais M10/M04, Ruff e mypy. Faltam provar uma disputa CAS
remota entre revisões e calibrar score/limiar com o piloto (D-20).

A revisão humana M10 foi adicionada localmente: identificador estável por contato, decisão
`approved`/`rejected`, autoria vinda do `sub` do JWT e CAS. A evidência é minimalista desde a
origem (`minimal_only`), sem conteúdo bruto armazenado. A revisão remota foi confirmada; faltam
prova CAS concorrente e calibração D-20.

## M09 aceito — navegador seletivo — 27/10/2026

O browser será aplicado somente a páginas efetivamente dinâmicas que não tenham sido atendidas
pelo HTTP autorizado. O contrato Playwright usa um contexto/página, Service Workers bloqueados,
limites de requisição/HTML/tempo, egress por subrequisição, cancelamento e fechamento garantido.
A prova Chromium controlada confirmou contato introduzido por JavaScript, comparação HTTP 0 ×
browser 1, popup fechado, timeout, subrequisição sintética bloqueada e ausência de leak. O CLI
exige decisão humana e M08 concluído; o worker dedicado reivindica apenas `crawl_browser`.
Ver [M09](M09.md).

## M08 aceito — coleta institucional HTTP — 27/10/2026

Implementados Scrapy 2.19, fonte aprovada `confirmed_site_http`, limites de host,
profundidade, concorrência, tamanho e tempo, `robots.txt`, AutoThrottle, retry finito,
`Retry-After` e pausa sem evasão em 403/CAPTCHA. O parser versionado observa apenas
`mailto:`, `tel:`, links explícitos WhatsApp e JSON-LD. O egress mantém SSRF/DNS
rebinding bloqueados e fixa o IP validado. Observações e métricas ficam somente no
`job_checkpoint`; nenhum contato comercial é sobrescrito e nenhuma tabela/coluna foi
criada. Checkpoint periódico renova lease e permite retomada com fencing.

Passaram 84 testes afetados M04/M06/M07/M08, Ruff, mypy e sintaxe PowerShell. A prova com
servidor controlado respeitou robots, processou duas páginas e obteve três observações.
A prova real do lead 60 terminou `succeeded`, processou duas páginas e observou um
e-mail, um telefone e um WhatsApp. O `error_code` residual da primeira tentativa foi
removido por CAS sem repetir o crawl; o estado final limpo foi confirmado. O módulo
está pronto e aguarda somente o aceite humano. Ver [M08](M08.md).

## M07 aceito — descoberta e validação de sites — 27/10/2026

Implementadas entrada manual autorizada, normalização de URL, bloqueio SSRF para
IPv4/IPv6, DNS misto, IP fixado contra rebinding, redirecionamentos revalidados,
limites de rede/HTML, vínculo por CNPJ e revisão versionada. O catálogo não autoriza
provedor nacional externo nem Google. Persistência CAS e SQL restritos à tabela
`public.pharmaleads` foram preparados. Entrada CSV limitada e validada também foi
entregue. Passaram 26 testes M07 e 23 testes M04 afetados, além de Ruff, formatação,
mypy e sintaxe PowerShell. O SQL foi aplicado pelo usuário: RLS ativa, onze campos de
site atualizáveis por `authenticated` e nenhum grant equivalente para `anon`. O
verificador remoto seguro de duas revisões CAS está pronto. O candidato `fdc.com.br`
do lead 60 publicou o CNPJ exato; após ampliar o teto HTML de 256 para 512 KiB, a
validação real retornou `branch_exact`. A prova remota persistiu `review_required` na
versão 1; duas revisões disputaram o CAS, exatamente uma venceu e o resultado final
foi `confirmed`, versão 2, com `website` confirmado. M07 aceito e M08 liberado. Ver
[M07](M07.md).

Após o aceite, foi preparada uma auditoria complementar read-only dos 100 leads. Ela
compara os 11 campos cadastrais de cada linha com o arquivo original do piloto e
confirma que apenas o lead 60 possui dados M07. Dois testes novos elevaram a evidência
afetada para 28 testes M07 e 23 M04, total 51. A execução remota confirmou os 100
cadastros idênticos ao piloto original, zero divergências, somente o lead 60 com site,
os outros 99 intocados e zero escritas. Auditoria complementar encerrada.

## M06 aceito — fila reduzida por lead — 26/10/2026

Após o aceite do G1, foi implementado o núcleo da fila com idempotência determinística,
janela de 15 minutos, lease de 60 segundos, fencing, heartbeat, retry com backoff,
cancelamento e recuperação. Dois workers disputam por compare-and-set e somente um
vence. Worker separado da FastAPI executa apenas `synthetic_probe`, explicitamente
sem scraping ou efeito comercial. O adaptador Data API exige JWT autenticado e nunca
usa `service_role`.

A restrição humana de uma tabela impede a fila PostgreSQL relacional e `SKIP LOCKED`.
O desenho reduzido mantém um trabalho corrente em colunas `job_*` da própria linha do
lead. O SQL manual foi aplicado pelo usuário em 26/10/2026: as 16 colunas apareceram
com os tipos esperados; nenhuma tabela, função, trigger, índice, schema ou papel foi
criado pelo script. Onze testes M06, Ruff, formatação e mypy passaram. A prova remota
iniciou dois workers e confirmou exatamente um vencedor, conclusão e limpeza. O
verificador isola o lead escolhido. A prova final recuperou o lease na segunda
tentativa, bloqueou o worker obsoleto por fencing e confirmou a limpeza.
RLS está ativa, `authenticated` recebeu UPDATE nas 16 colunas e `anon` não possui
grant. A inspeção encontrou sobreposição da política geral: gestor/responsável também
podiam alterar `job_*`. O usuário confirmou o bloqueio temporário da escrita de CRM
até M11 e aplicou a correção: as políticas UPDATE agora exigem `admin` ou `operador`.
M06 foi aceito com as evidências locais e remotas. M07 está liberado. A renovação
segura do JWT permanece necessária antes de publicar worker contínuo em produção.
Ver [M06](M06.md).

## M05 aceito; G1 aprovado — 25/10/2026

O usuário definiu cobertura nacional, todos os municípios e todos os CNAEs do setor
farmacêutico humano, sem veterinária. Foi entregue a CLI de validação, dry-run,
stage, promoção e relatório G1, com ZIP seguro, streaming, checksum, dicionário
municipal, CNPJ misto, matriz/filial, duplicações e preservação dos campos comerciais.
A fonte Receita está aprovada no catálogo versionado M04. A suíte unitária passou
com 99 testes; Ruff, formatação e mypy passaram em 40 arquivos.

A competência oficial 2026-10 foi baixada em fluxo incremental: 6.803.525.340 bytes
em 21 ZIPs. Foram analisadas 73.809.379 linhas e consolidados 128.895 estabelecimentos
elegíveis, com 0 rejeições e 0 duplicações. O stage contém 128.895 linhas e o relatório
G1 foi gerado em `aguarda_decisao_humana`. Um piloto determinístico de 100 leads,
cobrindo 27 UFs e 9 CNAEs, foi gravado no Supabase e integralmente confirmado por
leitura autenticada (`rows_written=100`, `rows_verified=100`). Os IDs do piloto foram
renumerados para 1–100 e o próximo identity é 101. O usuário aceitou o M05 e aprovou
o G1 ciente de que telefone/e-mail da Receita ainda não foram verificados externamente.
Naquele aceite, M06 ficou liberado pelo gate e dependia da D-19, definida depois no
início do módulo. Detalhes em [M05](M05.md).

## M04 — aceito e validado em produção — 25/10/2026

O usuário aceitou formalmente o piloto. A API foi publicada no Render e respondeu
200 em `/health`; Supabase Auth e RBAC reais foram confirmados em `/v1/me`.
`/v1/sources` bloqueou o perfil sem escopo com 403 e respondeu 200 com `[]` após
atribuição autorizada de `app_metadata.role=operador`. `/health/supabase` confirmou
`public.pharmaleads` por HEAD com RLS restrita (HTTP 401). O M05 foi iniciado depois.

## Render — configuração de produção validada — 25/10/2026

O backend agora aceita `PHARMALEADS_APP_ENV=production` e host `0.0.0.0`.
O teste reproduziu as variáveis do Render, inclusive `PHARMALEADS_ALLOWED_ORIGINS`
como lista JSON, e confirmou a inicialização da FastAPI. Execução conjunta atual:
57 testes com M04, autenticação e fundação. A publicação real foi concluída e
validada posteriormente, conforme a seção de aceite acima.

## M04 — artefato validado em HTTP real; aceite do piloto pendente — 24/10/2026

Wheel gerado e validado fora do checkout, com API Uvicorn em localhost: autenticação,
escopos, somente leitura, configuração padrão, override, recarga e reinício passaram.
Diretório de execução sem armazenamento auxiliar criado. Script reproduzível em
`ops/validate_m04_package.py`; lint, formatação e tipos passaram. Testes M04 anteriores:
27; execução conjunta com auth/fundação: 57. Render foi escolhido, mas nenhuma
publicação real foi efetuada. Para avançar ao M05, falta aceite humano
do piloto com gestão por publicação/histórico declarativo. Ver [M04](M04.md).

## M04 — SQLite removido; configuração versionada implementada — 24/10/2026

Catálogo substituído por JSON somente leitura, incluído no wheel Python e carregado
independentemente do diretório atual. API de fontes somente leitura; POSTs removidos.
Naquela entrega, a configuração inicial estava vazia, sem fontes aprovadas. O M05
posteriormente publicou a fonte Receita. Override ausente/inválido bloqueia
sem fallback; importador revalida a configuração antes de cada requisição remota.
Nenhum objeto Supabase alterado. Aceite do piloto com histórico declarativo e
validação de publicação em produção pendentes. Detalhes em [M04.md](M04.md).
Verificação final: 27 testes M04 e 57 na execução conjunta com auth/fundação passaram;
Ruff, formatação e mypy passaram; JSON confirmado no wheel.
As seções anteriores de SQLite/linha técnica abaixo são histórico superado.

## M04 — em andamento, adequação ao Supabase pendente — 24/10/2026

Diretriz mais recente: `public.pharmaleads` guarda somente leads; sem outras tabelas,
sem SQLite e sem linha técnica de catálogo. Verificação de código confirmou que
`registry.py` ainda usa SQLite. Para concluir M04, substituir por configuração
versionada sem banco adicional, adequar gestão/auditoria do piloto e testar as
fronteiras de permissão com essa configuração. Os 17 testes M04 e 46 testes
conjuntos anteriores validam o código local, não essa nova adequação. M05 ainda não
iniciado. Relatar pendências para o próximo módulo após toda alteração.

### Histórico anterior à diretriz de tabela somente de leads

Correção posterior: SQLite local não atende à persistência Supabase exigida pelo
usuário. Foi autorizado adicionar colunas somente a `public.pharmaleads`.
Proposta e decisão necessária sobre linha técnica e CNPJ em
[M04_SUPABASE_PLANO.md](M04_SUPABASE_PLANO.md). O módulo não está pronto para produção.

Catálogo SQLite local persistente, auditoria transacional, aprovação/revogação autenticadas e políticas versionadas implementados. Contratos de adaptadores incluem capacidades, versão, origem, cursor, checkpoint e observações; bloqueios antes de buscar e antes de gravar, incluindo integração no importador CSV existente. 17 testes sintéticos M04 passaram fora do sandbox Windows. TestClient funciona nesse contexto: a afirmação anterior de conflito como causa comprovada do travamento foi excessiva. Detalhes e limite de operação em um computador em [M04.md](M04.md). Nenhum objeto remoto foi alterado; M05 não iniciado; aceite humano pendente.

## M03 — fechado e aceito — 24/10/2026

M03 encerrado pelo usuário. Entregues e aceitos: validação JWT Supabase (HS256, issuer, audience, exp); papéis via `app_metadata.role` (`user_metadata` ignorado — TC-007); `GET /v1/me` na FastAPI com resposta tipada; RLS atualizada com `auth.uid()` e papel; dependency `get_current_user` em `api/dependencies.py`; `jwt_validator.py` em `infrastructure/auth/`; 15 testes unitários passando em `tests/unit/test_auth.py`. D-07 aberta para M11. Commits: `9f40308` (feat M03) e `42b433d` (aceite). M04 requer pedido específico.

## M02 — fechado e aceito — 24/10/2026

M02 encerrado pelo usuário. Entregues e aceitos: RLS de `public.pharmaleads` corrigida (políticas permissivas `ALL TO public` removidas; `anon` sem acesso; apenas `authenticated` e `service_role` operam a tabela). Tabela resetada: todas as 218 linhas apagadas por decisão do usuário para iniciar prospecção do zero. Estrutura ajustada: `cnpj NOT NULL`, três índices duplicados removidos, coluna `origem text` adicionada para rastreabilidade de fonte. Probe `/health/supabase` integrado na FastAPI: aceita 401/403 como "conectado com RLS restrita". Importador CSV local (`data_api_writer.py`) pronto com dry-run, allowlist cadastral, insert/update separados e trava de escrita operacional. CI verde: 48 testes unitários passando, ruff e mypy sem erros. Commits: `bb2174e` (probe RLS) e `81c731b` (aceite M01). M03 requer pedido específico.


## M02 — importação cadastral preparada, contrato aditado

O usuário pediu o passo 1 de gravação e a regra oficial de uma única tabela Supabase no começo do projeto. Aditivo inserido na especificação canônica. Importador local de CSV implementado para public.pharmaleads, com prévia sem rede, allowlist cadastral, validação de CNPJ/UF, inserção e atualização separadas, sem tocar CRM. Execução real bloqueada por padrão até o passo 2 de RLS e liberação operacional; nenhum dado remoto foi escrito. Contagem agregada read-only: 218 linhas, 216 CNPJs nulos e 2 mascarados. Nenhum teste, lint ou importação real foi executado nesta continuação conforme pedido do usuário de parar testes. M02 segue parcial; detalhes em M02.md.

## FastAPI → Supabase Data API — 24/10/2026

Após o pedido para conectar logo e interromper testes, a chave publicável fornecida pelo usuário foi usada apenas no ambiente do processo FastAPI local. GET /health/supabase retornou connected com HEAD fixo em public.pharmaleads, zero linhas. Não houve leitura de leads, escrita, mudança RLS ou alteração em outra tabela. O processo local foi iniciado; instruções e evidência em M02.md. A suíte de 46 testes unitários, Ruff e mypy passaram antes do pedido de parada; não se executaram mais testes depois dele. M02: transporte de diagnóstico integrado, aplicação de CRM/autorização/aceite pendentes. M03–M24 não iniciados; gates não aprovados.

## Revisão de segurança e dependências M02 — 24/10/2026

Continuação autorizada dentro de M02: consultas de catálogo e logs **somente leitura** no projeto confirmado. Confirmadas sete políticas permissivas; a política `ALL TO public USING (true)` e grants amplos deixam `anon` com caminho de acesso à tabela. Encontrados índices aparentemente redundantes, nenhum trigger de usuário e nenhuma view/função textual/publicação Realtime dependente nas consultas realizadas. Logs da rota `/rest/v1/pharmaleads` nos sete dias exibidos mostram apenas dois probes `HEAD` desta sessão; isso não inventaria clientes externos/SQL direto. Evidência e limites em [M02_INSPECAO_PHARMALEADS.md](M02_INSPECAO_PHARMALEADS.md). Nenhum dado, política, grant ou objeto remoto foi alterado. Correção de RLS e escrita operacional bloqueadas até identificar consumidores, definir acesso esperado e validar plano/rollback em ambiente segregado. M02 continua parcial, sem aceite; M03 não iniciado.

## Data API escolhida — 24/10/2026

O usuário confirmou o projeto Supabase e escolheu a Data API com chave publicável para a conexão inicial, mantendo `public.pharmaleads` como único alvo. Um probe HTTPS `HEAD` fixo nessa rota retornou `connection=ok` e zero linhas. O código não lê registros, não escreve, não carrega chave secret/service_role e não altera outros objetos. Testes locais e limites em [M02.md](M02.md). A FastAPI e o frontend continuam sem acesso operacional aos dados; RLS ampla da tabela e compatibilidade com consumidores existentes impedem declarar a conexão pronta para CRM. M02 sem aceite; M03–M24 não iniciados.

## Continuação M02 — 24/10/2026

O usuário autorizou preparar a conexão ao Supabase existente com a restrição de usar somente `public.pharmaleads`. O painel confirmou os endpoints direto/pooler de sessão e indicou um certificado CA público, baixado e validado em `.tmp/supabase/` (ignorado). Configuração remota presa ao projeto/banco/host confirmados; script interativo criado para inspecionar **somente metadados** da tabela em transação `READ ONLY`, sem senha no comando, repositório ou chat. A senha do banco não foi fornecida e a prova ainda não foi executada; **conexão backend–Supabase e aceite M02 continuam pendentes**. Nenhum dado/objeto remoto foi alterado. Detalhes, comandos, testes e limitações em [M02.md](M02.md).

M00 aceito; M01 implementado e testado localmente, com aceite humano pendente. M02 preparado localmente e testado apenas sem PostgreSQL real; integração e aceite pendentes. M03–M24 não iniciados; G1/G2/G3 não submetidos. A seção M00 abaixo é registro histórico, inclusive suas pendências posteriormente resolvidas.

## Referências atualizadas e reconciliação — 23/10/2026

Usuário reenviou o Markdown definitivo, o Markdown v1.5 e o PDF v1.5, confirmando o reinício do projeto e autorizando reaproveitar somente o que for compatível. O definitivo é idêntico ao contrato canônico já armazenado. O Markdown e o PDF v1.5 foram copiados sem edição para `docs/referencia/`; os 72 RFs foram localizados em ambos. A correspondência de RF-001–RF-072 e RNF-001–RNF-037 com o roteiro v2.0, as prioridades e os conflitos estão em [RECONCILIACAO_V15.md](RECONCILIACAO_V15.md). Casos de teste v1.5 foram inventariados em namespace próprio, ainda sem evidências de execução. Nenhum módulo novo ou funcionalidade de negócio foi implementado por esta reconciliação.

Reuso confirmado: fundação M01 e partes locais de M02 (validação CNPJ, configuração de conexão) são compatíveis em princípio, sem homologação. Migration multischema, bootstrap e teste de integração M02 não são aplicáveis ao Supabase de uma tabela. O painel de produção foi inspecionado visualmente e foram executados dois `SELECT` de metadados para grants/FKs; nenhum objeto ou dado remoto foi alterado. A próxima mudança de código continua restrita ao M02 e depende de plano de uma tabela revisado, compatibilidade com consumidores atuais e teste em banco descartável.

Trava de segurança M02 adicionada à CLI: migrations de alteração só chegam ao Alembic se `local_test=true` e o destino for o banco local descartável já validado pela configuração. Verificação executada na raiz via `./ops/windows/Test-M02.ps1`: Ruff, formatação e mypy passaram; 21 testes de banco passaram isoladamente via `./.venv/Scripts/python.exe -m pytest tests/unit/test_database.py -q`, incluindo dois negativos da trava. A suíte unitária completa iniciou, passou pelos 21 cenários de banco e ficou parada no primeiro teste antigo da fundação (`test_health_is_not_readiness`); foi interrompida, portanto **não passou integralmente** nesta rodada. Integração PostgreSQL, conexão backend-Supabase e testes de produção não foram executados.

## Restrição atual do M02 — 23/10/2026

Usuário identificou o projeto Supabase `qxsdcrywsjkrpcbfgbxb`/schema `public` e restringiu toda alteração a `public.pharmaleads`. Tentativa de abrir o editor redirecionou para login; colunas/dependências ainda não verificadas. Nenhum SQL remoto executado. A migration e o bootstrap M02 atuais são incompatíveis com essa restrição; não aplicá-los nesse projeto. O teste de integração preparado permanece para PostgreSQL local descartável. Próximo passo: inspeção autenticada somente de metadados e decisão sobre onde ficará o modelo completo, sem alterar outras tabelas ou objetos. Ver DECISOES EX-05 e M02.md.

Decisão posterior D-06: o usuário confirmou **uma única tabela e nenhum outro projeto** por limite de recursos. Destinar `public.pharmaleads` ao cadastro por estabelecimento/filial e ao estado comercial mínimo. A migration preparada está bloqueada para esse projeto e não há teste de integração real que comprove o novo desenho. Histórico, fila, proveniência e supressão exigem replanejamento ou declaração explícita de limitação. Inspeção visual autenticada posterior confirmou 218 linhas, CNPJ nullable, RLS habilitado e políticas permissivas `ALL TO public USING (true)` e `SELECT TO public USING (true)`. Duas consultas `SELECT` de catálogo confirmaram grants amplos para `anon`/`authenticated` e nenhuma FK externa apontando para a tabela. Não houve tentativa de acesso às linhas com esses papéis, alteração remota ou teste de conexão do backend; detalhes em [M02_INSPECAO_PHARMALEADS.md](M02_INSPECAO_PHARMALEADS.md).

## Limpeza autorizada após M01

Usuário solicitou reinício sem legado e autorizou a exclusão na base local atual. Removidos sistema Node antigo, frontend antigo, SQL, testes antigos, configurações, dependências/build da raiz e documentação legada. Preservados M00/M01 e histórico Git. Atualizados README, AGENTS, exemplo de configuração e acompanhamento. Nenhuma integração, migração, coleta ou publicação. Inventário, comandos, testes reais e limites em LIMPEZA_LEGADO.md. Decisão EX-04.

## Entrega M01

Pacote Python instalável, FastAPI com health/readiness honesto, configuração, erros e request_id; shell React/TypeScript isolado, ferramentas, locks, scripts PowerShell e CI preparados. A entrega original registrou Ruff/mypy/14 testes Python e lint/tipos/2 testes web/build aprovados. Evidências originais em M01.md. Não equivalem a integração Supabase nem homologação. Ver LIMPEZA_LEGADO.md para a revalidação após exclusão; a revalidação desta limpeza consolidou 14 testes Python, 2 testes web, build e 2 cenários E2E desktop/mobile aprovados, além de inspeção visual das capturas. O registro original permanece histórico.

Próxima etapa: aceite M01 e pedido específico para M02; banco real depende de D-06 e ambiente segregado.

---

## Registro histórico da entrega M00

# Progresso

23/10/2026 — M00: inventário e governança documentados; revisão/aceite humano pendentes. M01–M24 não iniciados para a v2.0. G1/G2/G3 não submetidos.

## Pedido e entrega

Executar por módulos: entregue somente M00. Criados contrato canônico preservado, contexto, decisões, matriz e orientações AGENTS/Cursor. Não foram criados API, frontend, banco, scrapers ou stubs novos. Nenhum arquivo preexistente foi sobrescrito; mudanças anteriores permanecem.

## Arquivos da etapa

- docs/referencia/PHARMALEADS_ESPECIFICACAO_DEFINITIVA_CURSOR.md
- docs/CONTEXTO.md
- docs/PROGRESSO.md
- docs/DECISOES.md
- docs/MATRIZ_REQUISITOS.md
- AGENTS.md
- .cursor/rules/00-core.mdc
- .cursor/rules/10-backend.mdc
- .cursor/rules/20-frontend.mdc
- .cursor/rules/30-security.mdc
- .cursor/rules/40-testing.mdc

## Inspeções executadas

PowerShell, diretório exato:

```powershell
Set-Location 'C:\Users\guilh\.gemini\antigravity-ide\scratch\centrus-pharmaleads'
Get-Content -LiteralPath 'C:\Users\guilh\Downloads\PHARMALEADS_ESPECIFICACAO_DEFINITIVA_CURSOR.md' -Raw
git status --short
git rev-parse HEAD
git diff --stat
git rev-list --left-right --count HEAD...origin/main
rg --files src shared server worker tests supabase .github docs scraper
Get-Content .cursor/rules/sync-with-production-before-edits.mdc
Get-Content package.json
Get-Content shared/format.ts
Get-Content shared/contracts.ts -TotalCount 100
Get-Content .github/workflows/ci.yml
```

Leitura complementada por trechos da especificação, buscas direcionadas no worker/API/SQL e inspeção dos testes PGlite/E2E. Contrato tem 25 módulos, 12 UCs e 28 TCs. Inventário não equivale a auditoria completa de cada linha. Referência Git local 0/0; working tree alterado; remoto não atualizado nesta etapa documental.

## Verificação da entrega

Verificação documental local: comparar conteúdo do contrato com original, conferir presença dos 25 módulos/12 UCs/28 TCs e destinos das referências; verificar que hashes dos arquivos preexistentes não mudaram. Resultado: PASSOU. Cópia byte a byte idêntica ao original; 25 módulos, 12 UCs e 28 TCs distintos presentes; referências do AGENTS e das cinco rules apontam ao contrato existente; 51 arquivos preexistentes versionados ou não ignorados preservados por comparação SHA-256 antes/depois. Arquivos ignorados não foram incluídos nessa comparação nem editados.

SHA-256 do contrato: `e0ff84a7070e9e6d9f672dd066d48d9fe81f829ce04e80c61145ea9974cf8e29`. Conferências executadas por Python via here-string PowerShell, usando o runtime `C:\Users\guilh\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe`, sem criar programa/teste de aplicação. Foram criados 11 arquivos documentais/orientações. Isso verifica a entrega documental, não a conformidade do software.

Não executados: build/lint/testes da aplicação, banco, Auth, APIs externas, migrações, coleta, restore e medições. Motivo: M00 é documental, código inalterado e serviços reais não autorizados para esta etapa. Resultados históricos não foram reapresentados como testes da v2.0. Nenhum segredo foi solicitado ou copiado de configuração local para a documentação.

## Próxima etapa e bloqueios

Parar no M00. Próximo: M01 somente mediante pedido explícito. Antes de código: definir base preservando alterações locais conforme regra de sincronização; verificar versões/empacotamento, escolher lock Python e construir apenas fundação/shell. Não há necessidade de credenciais de produção para isso. Decisões D-01 a D-20 aplicáveis seguem abertas em DECISOES; cada uma bloqueia somente o escopo indicado.

Referências v1.5/roteiros pendentes impedem afirmar rastreabilidade integral dos RFs originais, mas não impedem documentar M00. Nenhuma aprovação de fontes, preços, licenças ou integração foi inferida da especificação.

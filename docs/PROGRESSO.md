# Estado atual — 24/10/2026

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

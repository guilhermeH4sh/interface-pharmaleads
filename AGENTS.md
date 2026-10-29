# PharmaLeads — execução por módulo

> **INSTRUÇÃO OBRIGATÓRIA PARA O AGENTE**
> Leia este arquivo **inteiro** antes de qualquer outra ação.
> Ele é a fonte primária de contexto do projeto. Use-o para responder perguntas sobre estado, rotas, pastas, comandos e restrições **sem precisar abrir o código**.
> Só abra um arquivo de código se a tarefa exigir alterar ou verificar algo que não esteja descrito aqui.
> Se este arquivo contradizer o código, o código prevalece — e este arquivo deve ser corrigido.

## Estado atual (verificado em código — 27/10/2026)

- **M00** aceito; **M01** aceito; **M02** aceito; **M03** aceito; **M04** aceito em 25/10/2026.
- M02: RLS corrigida, tabela preparada com `cnpj NOT NULL` e coluna `origem`; importador CSV pronto.
- M03: JWT Supabase validado (HS256), `GET /v1/me`, RBAC por `app_metadata.role`, 15 testes.
- M04: catálogo JSON sem SQLite, API somente leitura e importador protegido. Produção validada no Render: `/health`, Auth/RBAC real e Supabase conectado por HEAD com RLS 401. A revisão `m05-receita-1` agora publica a fonte Receita aprovada para o recorte M05. Detalhes em docs/M04.md.
- **M05 aceito em 25/10/2026; G1 aprovado**: competência oficial 2026-10 baixada e filtrada em fluxo incremental. Foram analisados 73.809.379 estabelecimentos e gerados 128.895 leads elegíveis, sem rejeições/duplicações. Piloto estratificado de 100 leads (27 UFs, 9 CNAEs) gravado e confirmado no Supabase; IDs renumerados para 1–100 e próximo identity 101. O usuário avaliou a cobertura, os contatos declarados não verificados e os recursos medidos e autorizou avançar. Detalhes em docs/M05.md.
- **M06 aceito em 26/10/2026**: fila reduzida a um trabalho corrente por lead nas 16 colunas `job_*` de `public.pharmaleads`; CAS substitui `SKIP LOCKED` devido à restrição de uma tabela/nenhum outro objeto. D-19, idempotência, lease, fencing, retry, cancelamento, recuperação e worker sintético entregues; 11 testes passaram. RLS/grants restringem UPDATE a `admin`/`operador`. A prova real confirmou um vencedor entre dois workers, recuperação na segunda tentativa, bloqueio do worker obsoleto e limpeza. Detalhes em docs/M06.md.
- **M07 aceito em 27/10/2026**: entrada manual/CSV autorizado, validação SSRF/DNS rebinding com IP fixado, vínculo filial/rede por CNPJ, revisão versionada, adaptador CAS e verificador remoto de duas revisões entregues. O limite HTML seguro foi ajustado para 512 KiB após o caso real FDC de 330.572 bytes. As dez colunas `site_*` foram aplicadas e inspecionadas no Supabase; RLS permaneceu ativa, `authenticated` recebeu UPDATE nas dez colunas mais `website` e `anon` não recebeu esse grant. 28 testes M07 e 23 M04 afetados passaram. A prova real no lead 60 confirmou `fdc.com.br`, versão 2 e exatamente um vencedor entre duas revisões; `website` foi persistido. A auditoria read-only confirmou os 100 cadastros idênticos ao piloto original, os outros 99 sem dados M07 inesperados e zero escritas. Detalhes em docs/M07.md.
- **M08 aceito em 27/10/2026**: Scrapy institucional restrito ao site confirmado, robots/limites, SSRF com IP fixado, parsing explícito de e-mail/telefone/WhatsApp/JSON-LD, checkpoint retomável e worker com um reactor por processo foram implementados. Catálogo `m08-confirmed-http-1`; resultados ficam somente em `job_checkpoint`, sem promoção comercial. A prova real no lead 60 terminou `succeeded`, processou duas páginas e observou um contato de cada tipo; o erro residual da primeira tentativa foi removido por CAS e o estado final foi confirmado limpo. Detalhes em docs/M08.md.
- **M09 aceito em 27/10/2026**: Playwright seletivo com contexto não persistente, limites, timeout/cancelamento, egress por subrequisição, CLI/worker dedicado e comparação HTTP × browser. Prova local Chromium confirmou JavaScript, popup, timeout, subrequisição bloqueada e fechamento sem leak; nenhum site externo/Supabase foi usado. Detalhes em docs/M09.md.
- **M10 em andamento**: normalização/dedup de observações, limiar compartilhado provisório N=3 e score `m10-v1`; as seis colunas `contact_*` foram aplicadas. O adaptador CAS lê M08/M09 e grava somente esses campos, revalidando fonte antes do PATCH; teste de revogação passou. A prova remota do lead 60 gravou 3 contatos/3 evidências (0→1), a revisão humana aprovou um contato (versão 4) e a prova CAS concorrente teve um vencedor entre duas revisões (versão 5). A revisão usa identificador estável, `sub` do JWT, CAS e bloqueio por fonte revogada; evidência é `minimal_only`, sem conteúdo bruto. Pendente: calibração D-20. **M20 antecipado em andamento**: piloto OSM autorizado para no máximo 20 leads de SP, sem dados brutos e sem confirmação automática; oferece Overpass serial e extrato Geofabrik Sudeste temporário limitado a 900 MiB. Detalhes em docs/M20.md. M11–M19/M21–M24: não iniciados. G2/G3: não aprovados.
- Testes Python: última suíte completa registrada com 99 testes antes do teste de amostragem; 22 testes afetados de M05/Data API, 11 testes M06, 51 testes afetados de M07/M04 e 84 testes afetados de M08/M07/M06/M04 passaram. M09: teste unitário de egress, Ruff/mypy e prova Chromium controlada de JS/popup/timeout/subrequisição passaram. Suíte de integração PostgreSQL não executada.

## Stack e versões

Atualização M11: API CRM em andamento com `GET /v1/leads` e `GET /v1/leads/{lead_id}`;
paginação por ID, filtros UF/CNPJ e escopo por responsável reutilizam os papéis M03, sem fechar D-07.
17 testes M11/auth passaram, além de Ruff e mypy. Implementação em `api/routes/v1/leads.py`.
Pendentes: edição CAS, histórico/atividades, contatos autorizados, D-07/D-17 e prova remota.
M20 interrompido pelo usuário, sem aceite; esta atualização substitui o estado anterior acima.

- Python 3.12 / FastAPI ≥0.115 / Uvicorn ≥0.34 / Pydantic ≥2.10 / pydantic-settings ≥2.7
- SQLAlchemy ≥2.0 / Alembic ≥1.16 / psycopg (binary)
- Scrapy ≥2.19,<3 (M08); osmium ≥4.3,<5 (leitura efêmera do extrato OSM M20)
- M04: configuração JSON versionada incluída no pacote Python; nenhum banco auxiliar.
- Dev: pytest ≥8, httpx2 ≥2, ruff ≥0.9, mypy ≥1.15; Playwright ≥1.64,<2 (M09; Chromium só para prova controlada)
- Frontend: React 19.3.1 / TypeScript 6.0.3 / Vite 8.3.5 (`apps/web`)
- Gerenciadores: uv (backend), npm (web)

## Mapa de pastas relevantes

```
packages/backend/src/pharmaleads/
  api/          # main.py, dependencies.py, errors.py, routes/v1/me.py
  config.py     # Settings com prefixo PHARMALEADS_*
  domain/source_policy/  # engine.py, models.py, registry.py, adapters.py, catalog.json (M04)
  domain/receita/        # recorte, coleta oficial incremental, stage e relatório G1 (M05)
  domain/jobs/           # estado, idempotência, lease e fencing da fila reduzida M06
  domain/sites/          # URL segura, vínculo por CNPJ e revisão concorrente M07
  domain/crawling/       # observações M08 e contrato/browser seletivo M09
  domain/contacts/       # normalização e consolidação de observações M10
  infrastructure/
    auth/jwt_validator.py        # validação JWT Supabase
    data_api.py                  # probe HEAD
    data_api_writer.py           # importador CSV (dry-run padrão)
    receita_cli.py               # inclui coletar-oficial e demais comandos M05
    job_queue_data_api.py        # CAS autenticado na única tabela permitida
    worker_cli.py                # processo M06 separado da FastAPI
    m06_verify_cli.py            # prova controlada de concorrência remota e limpeza
    m07_audit_cli.py             # comparação read-only dos 100 leads com o piloto original
    m07_verify_cli.py            # prova remota de duas revisões CAS e publicação do site
    site_http.py                  # HTTP com IP fixado, SSRF e redirecionamentos seguros
    site_data_api.py              # CAS do fluxo de sites em public.pharmaleads
    site_cli.py                   # validar/propor/revisar candidatos M07
    institutional_spider.py       # spider limitado e retomável M08
    m08_{cli,runner,worker_cli}.py # enfileiramento, reactor único e worker M08
    m09_browser.py               # contexto Playwright isolado e limitado M09
    m09_{cli,runner,worker_cli}.py # enfileiramento explícito e worker dedicado M09
    contact_data_api.py, m10_{cli,review_cli,verify_cli}.py # promoção, revisão e prova CAS M10
    osm_{overpass,pbf}.py, m20_cli.py # descoberta OSM limitada ao piloto SP M20
    scrapy_{egress,retry}.py      # IP fixado e Retry-After M08
    database/{session,settings,cli}.py
  worker.py              # executor e handler sintético identificado
  shared/identifiers.py
database/migrations/versions/20261023_0001_m02_base.py  # bloqueada para Supabase remoto
apps/web/src/   # React; components/, lib/, test/
tests/unit/     # inclui test_m05_receita.py e test_m06_jobs.py
tests/integration/test_m02_database.py  # requer PostgreSQL local descartável
ops/validate_m04_package.py  # smoke do wheel em API real somente localhost e dados sintéticos
ops/sql/          # scripts SQL manuais, transacionais e restritos a public.pharmaleads
ops/windows/    # Setup-M01.ps1, Start-Api.ps1, Start-Web.ps1, Test-M01.ps1,
                # Test-M02.ps1, Import-Pharmaleads.ps1, Invoke-M05.ps1, Start-Worker.ps1, Test-M06-Remote.ps1,
                # Invoke-M07.ps1, Test-M07-Remote.ps1, Test-M07-Pilot.ps1, Test-M08-Remote.ps1,
                # Test-M10-Remote.ps1, Test-M10-Review-Remote.ps1, Test-M10-Cas-Remote.ps1,
                # Invoke-M20-OsmPilot.ps1
docs/           # acompanhamento e relatórios M01.md, M02.md, M04.md, M05.md, M06.md, M07.md, M08.md, M09.md
docs/referencia/  # contrato canônico (não editar)
```

## Variáveis de ambiente (nomes apenas; nunca expor valores)

Prefixo `PHARMALEADS_*` (pydantic-settings). Relevantes:
- `PHARMALEADS_DATA_API_PUBLISHABLE_KEY` — chave publicável Supabase
- `PHARMALEADS_DATA_API_ACCESS_TOKEN` — JWT curto autenticado para promoção M05/worker M06; nunca versionar
- `PHARMALEADS_TABLE_WRITE_APPROVED` — trava operacional; único valor aceito: `public.pharmaleads`
- `PHARMALEADS_SUPABASE_JWT_SECRET` — segredo JWT (Settings → API → JWT Settings)
- `PHARMALEADS_SOURCE_POLICY_PATH` — override opcional para JSON somente leitura; padrão usa `catalog.json` do pacote, sem depender do diretório atual
- `PHARMALEADS_APP_ENV`, `PHARMALEADS_APP_HOST`, `PHARMALEADS_APP_PORT`, `PHARMALEADS_ALLOWED_ORIGINS`

## Rotas FastAPI implementadas

| Método | Rota | Nota |
|--------|------|------|
| GET | `/health` | sempre 200 |
| GET | `/health/supabase` | probe Data API; aceita 401/403 como conectado |
| GET | `/ready` | ainda 503; prontidão plena será implementada em módulo posterior |
| GET | `/v1/me` | JWT obrigatório; retorna perfil do usuário autenticado |
| GET | `/v1/leads` | M11: consulta cadastral, cursor after_id, filtros UF/CNPJ e escopo por responsável |
| GET | `/v1/leads/{lead_id}` | M11: ficha cadastral com o mesmo escopo e RLS |
| GET | `/v1/sources` | M04; catálogo de fontes, escopo `sources:read` |
| GET | `/v1/sources/{source_id}/policies` | M04; consulta políticas publicadas |
| GET | `/v1/sources/{source_id}/history` | M04; histórico declarativo da configuração; `sources:manage` |

## Comandos

```powershell
# Instalar (raiz)
.\ops\windows\Setup-M01.ps1

# API (terminal 1, raiz)
.\ops\windows\Start-Api.ps1

# Web (terminal 2, raiz)
.\ops\windows\Start-Web.ps1

# Testes unitários Python afetados
.\.venv\Scripts\python.exe -m pytest tests/unit/ -q

# Lint e tipos
.\.venv\Scripts\ruff.exe check .
.\.venv\Scripts\mypy.exe packages/backend/src

# Web
cd apps/web && npm test        # vitest run
cd apps/web && npm run typecheck
cd apps/web && npm run lint

# Importador CSV (dry-run padrão — sem escrita)
.\ops\windows\Import-Pharmaleads.ps1 -File 'C:\caminho\arquivo.csv' -Mode insert

# M05: validar ZIPs oficiais locais (repita caminhos no array)
.\ops\windows\Invoke-M05.ps1 -Command validar -InputFile @('Empresas0.zip','Estabelecimentos0.zip','Municipios.zip')

# M05: baixar e filtrar a competência oficial com remoção incremental dos ZIPs
.\.venv\Scripts\python.exe -m pharmaleads.infrastructure.receita_cli coletar-oficial --work .m05-downloads\2026-10 --output .m05-stage --competencia 2026-10-01

# M06: após aplicar/revisar o SQL e definir credenciais somente no processo
.\ops\windows\Start-Worker.ps1 -WorkerId worker-piloto -Once

# M06: prova controlada com dois workers; solicita chave/token sem exibi-los
.\ops\windows\Test-M06-Remote.ps1 -LeadId 1

# M07: validação sem escrita de URL candidata manual
.\ops\windows\Invoke-M07.ps1 -Command validar --cnpj CNPJ --url https://exemplo.com.br

# M07: confirmar site real e provar duas revisões CAS; solicita chave/token sem exibi-los
.\ops\windows\Test-M07-Remote.ps1 -LeadId ID -Cnpj CNPJ -Url https://site-oficial.example

# M07: auditar os 100 leads sem escrever; solicita chave/token sem exibi-los
.\ops\windows\Test-M07-Pilot.ps1

# M08: enfileirar, coletar o site confirmado e mostrar contagens; solicita segredos
.\ops\windows\Test-M08-Remote.ps1 -LeadId 60

# M09: somente após diagnosticar necessidade real de JavaScript no site confirmado
.\.venv\Scripts\python.exe -m pharmaleads.infrastructure.m09_cli --lead-id ID --reason dynamic_after_http --apply
.\.venv\Scripts\python.exe -m pharmaleads.infrastructure.m09_worker_cli --worker-id browser-piloto

# M09: prova controlada local (Chromium instalado uma vez)
.\.venv\Scripts\python.exe ops\verify_m09_browser.py

# M10: dry-run remoto; acrescente -Apply somente após conferir a contagem
.\ops\windows\Test-M10-Remote.ps1 -LeadId 60

# M10: revisar contato; o script solicita ID e decisão se não forem informados
.\ops\windows\Test-M10-Review-Remote.ps1 -LeadId 60

# M10: provar dois revisores concorrentes; o script solicita o ID já revisado
.\ops\windows\Test-M10-Cas-Remote.ps1 -LeadId 60

# M20: no máximo 20 IDs existentes da UF SP; extrato temporário e URLs somente candidatas
.\ops\windows\Invoke-M20-OsmPilot.ps1 -LeadId 1,2 -DownloadPbf
```

## Restrições duras (não alterar sem autorização explícita)

- **Supabase `qxsdcrywsjkrpcbfgbxb`**: alterar **somente** `public.pharmaleads`; nenhuma outra tabela ou objeto.
- Exceção humana pontual em 25/10/2026: adicionar `app_metadata.role=operador` a um usuário existente do Supabase Auth para validar RBAC do M04; não autoriza outras alterações em `auth.users`.
- `public.pharmaleads` persiste somente dados de leads/filiais: não inserir linhas técnicas de catálogo nem CNPJ fictício; não criar tabelas auxiliares, inclusive SQLite. Novas colunas na própria tabela podem atender necessidades dos leads. Políticas/fontes devem ter solução sem banco adicional.
- A migration `20261023_0001_m02_base.py` cria schemas/papéis e **não pode** ser aplicada nesse projeto.
- CLI M02 bloqueia `upgrade/downgrade --apply` em destinos remotos (trava verificada em teste).
- Não usar chave `secret/service_role` para contornar RLS.
- Não executar suíte de integração (`tests/integration/`) contra produção.
- Sem reset/stash/commit/push automáticos. Sem `DROP` ou `CASCADE` por suposição.
- Não ler/expor valores de `.env` nem imprimir credenciais.

## Regras de domínio

- Coleta nunca altera estado comercial (CRM separado).
- Política de fonte/campo/ação bloqueia por padrão.
- Google transitório e condicional — somente M21.
- CNPJ completo textual (incluindo alfanumérico) por filial, independente.
- `user_metadata` não concede papel (TC-007); usar somente `app_metadata.role`.
- D-07 aberta: matriz de papéis final definida em M11.

## Como trabalhar com economia de tokens

- Ao iniciar qualquer módulo, abrir a comunicação e a documentação com um título no formato `Mxx — descrição clara do que o módulo faz`, seguido de uma frase curta com seu objetivo.
- Uma tarefa por sessão; ler somente arquivos citados na tarefa.
- Usar `Select-String`, `Select-Object -First N`, `git diff --stat` antes de `git diff`.
- Ignorar: `node_modules`, `.venv`, `dist`, `.uv-cache`, `.npm-cache`, `__pycache__`, `*.lock` (extrair versões com grep).
- Patches pontuais; reescrever arquivo inteiro só se >50% desatualizado.
- Não rodar suíte completa; rodar só o teste afetado com `-k nome_do_teste`.
- Resposta final ≤15 linhas; não copiar conteúdo de arquivos na resposta.
- Após toda alteração, informar o estado do módulo, a verificação executada e o que ainda falta para avançar ao próximo módulo; não declarar conclusão com pendências omitidas.
- Antes de alterar código: `git status --short; git diff --stat`.

## Arquivos de referência

- Contrato canônico: `docs/referencia/PHARMALEADS_ESPECIFICACAO_DEFINITIVA_CURSOR.md`
- Reconciliação v1.5: `docs/RECONCILIACAO_V15.md`
- Decisões: `docs/DECISOES.md`
- Progresso: `docs/PROGRESSO.md`
- Contexto: `docs/CONTEXTO.md`
- Regra de sync antes de editar: `.cursor/rules/sync-with-production-before-edits.mdc`
- M02 detalhe: `docs/M02.md` e `docs/M02_INSPECAO_PHARMALEADS.md`
- M04 detalhe e limitações do catálogo local: `docs/M04.md`
- Validar artefato M04: `uv build --wheel --offline --out-dir .tmp/m04-wheel`; depois `.\.venv\Scripts\python.exe ops/validate_m04_package.py --wheel .tmp/m04-wheel/pharmaleads-0.1.0-py3-none-any.whl`

## Atualização obrigatória do AGENTS.md

**Ao encerrar qualquer módulo ou alterar código**, o agente DEVE atualizar este arquivo antes do commit final. Obrigatório:

1. **Estado atual** — marcar módulo como aceito/em andamento/não iniciado conforme evidência real (código + teste executado); nunca declarar "aceito" sem evidência.
2. **Rotas** — adicionar/remover rotas da tabela se a API mudou.
3. **Mapa de pastas** — adicionar linha se novo pacote/diretório relevante foi criado.
4. **Stack e versões** — atualizar se dependência foi adicionada ou atualizada.
5. **Variáveis de ambiente** — adicionar nome se nova `PHARMALEADS_*` foi introduzida em `config.py`.
6. **Testes** — atualizar contagem ou arquivos se novos testes foram adicionados.

Não é necessário atualizar o AGENTS.md para: patches de bug sem impacto na estrutura, alterações internas de função sem mudança de interface pública, ou atualizações de docs que não mudam o estado de módulos.

Ao atualizar, use patch pontual (só as linhas que divergem). Nunca reescreva o arquivo inteiro exceto se >50% estiver desatualizado.

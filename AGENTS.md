# PharmaLeads — execução por módulo

> **INSTRUÇÃO OBRIGATÓRIA PARA O AGENTE**
> Leia este arquivo **inteiro** antes de qualquer outra ação.
> Ele é a fonte primária de contexto do projeto. Use-o para responder perguntas sobre estado, rotas, pastas, comandos e restrições **sem precisar abrir o código**.
> Só abra um arquivo de código se a tarefa exigir alterar ou verificar algo que não esteja descrito aqui.
> Se este arquivo contradizer o código, o código prevalece — e este arquivo deve ser corrigido.

## Estado atual (verificado em código — 25/10/2026)

- **M00** aceito; **M01** aceito; **M02** aceito; **M03** aceito.
- M02: RLS corrigida, tabela resetada (0 linhas), `cnpj NOT NULL`, coluna `origem`, importador CSV pronto.
- M03: JWT Supabase validado (HS256), `GET /v1/me`, RBAC por `app_metadata.role`, 15 testes.
- M04 implementado e validado para revisão do piloto: catálogo JSON sem SQLite, API somente leitura e importador protegido. 27 testes M04 e 57 com auth/fundação passaram; smoke do wheel isolado com Uvicorn/HTTP real, recarga e reinício passou. Aceite humano do piloto pendente; Render escolhido e configuração `production` validada, publicação real ainda não executada. Detalhes em docs/M04.md.
- M05–M24: não iniciados. G1/G2/G3: não aprovados.
- Testes Python: não verificado o total atual da suíte completa (era 48 em M02 + 15 em M03; rodar para confirmar).

## Stack e versões

- Python 3.12 / FastAPI ≥0.115 / Uvicorn ≥0.34 / Pydantic ≥2.10 / pydantic-settings ≥2.7
- SQLAlchemy ≥2.0 / Alembic ≥1.16 / psycopg (binary)
- M04: configuração JSON versionada incluída no pacote Python; nenhum banco auxiliar.
- Dev: pytest ≥8, httpx2 ≥2, ruff ≥0.9, mypy ≥1.15
- Frontend: React 19.3.1 / TypeScript 6.0.3 / Vite 8.3.5 (`apps/web`)
- Gerenciadores: uv (backend), npm (web)

## Mapa de pastas relevantes

```
packages/backend/src/pharmaleads/
  api/          # main.py, dependencies.py, errors.py, routes/v1/me.py
  config.py     # Settings com prefixo PHARMALEADS_*
  domain/source_policy/  # engine.py, models.py, registry.py, adapters.py, catalog.json (M04)
  infrastructure/
    auth/jwt_validator.py        # validação JWT Supabase
    data_api.py                  # probe HEAD
    data_api_writer.py           # importador CSV (dry-run padrão)
    database/{session,settings,cli}.py
  shared/identifiers.py
database/migrations/versions/20261023_0001_m02_base.py  # bloqueada para Supabase remoto
apps/web/src/   # React; components/, lib/, test/
tests/unit/     # test_auth.py, test_database.py, test_data_api.py, test_foundation.py, test_source_policy.py, test_m04_workflow.py
tests/integration/test_m02_database.py  # requer PostgreSQL local descartável
ops/validate_m04_package.py  # smoke do wheel em API real somente localhost e dados sintéticos
ops/windows/    # Setup-M01.ps1, Start-Api.ps1, Start-Web.ps1, Test-M01.ps1,
                # Test-M02.ps1, Import-Pharmaleads.ps1, Test-Supabase-*.ps1
docs/           # CONTEXTO.md, PROGRESSO.md, DECISOES.md, MATRIZ_REQUISITOS.md, M01.md, M02.md
docs/referencia/  # contrato canônico (não editar)
```

## Variáveis de ambiente (nomes apenas; nunca expor valores)

Prefixo `PHARMALEADS_*` (pydantic-settings). Relevantes:
- `PHARMALEADS_DATA_API_PUBLISHABLE_KEY` — chave publicável Supabase
- `PHARMALEADS_SUPABASE_JWT_SECRET` — segredo JWT (Settings → API → JWT Settings)
- `PHARMALEADS_SOURCE_POLICY_PATH` — override opcional para JSON somente leitura; padrão usa `catalog.json` do pacote, sem depender do diretório atual
- `PHARMALEADS_APP_ENV`, `PHARMALEADS_APP_HOST`, `PHARMALEADS_APP_PORT`, `PHARMALEADS_ALLOWED_ORIGINS`

## Rotas FastAPI implementadas

| Método | Rota | Nota |
|--------|------|------|
| GET | `/health` | sempre 200 |
| GET | `/health/supabase` | probe Data API; aceita 401/403 como conectado |
| GET | `/ready` | 503 até M04+ |
| GET | `/v1/me` | JWT obrigatório; retorna perfil do usuário autenticado |
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
```

## Restrições duras (não alterar sem autorização explícita)

- **Supabase `qxsdcrywsjkrpcbfgbxb`**: alterar **somente** `public.pharmaleads`; nenhuma outra tabela ou objeto.
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

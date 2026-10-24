# PHARMALEADS — ESPECIFICAÇÃO TÉCNICA MESTRA E CONTEXTO PARA O CURSOR

**Versão:** 2.0 — 23/10/2026  
**Natureza:** especificação de produto, arquitetura, engenharia, segurança, qualidade e instruções de execução incremental por IA.  
**Produto:** PharmaLeads, plataforma interna de prospecção B2B e CRM para estabelecimentos farmacêuticos brasileiros.  
**Responsabilidade de implementação:** Cursor, atuando como engenheiro de software sênior, sob aprovação humana dos gates e decisões comerciais.  
**Estado inicial:** roteiro de planejamento; nenhuma funcionalidade é presumida pronta.  
**Fontes de requisitos:** `Prompts_Modulares_Prospec_Farmacias(1).md` (v1.0) e `Prompts por módulos: plataforma de prospecção de farmácias` (v1.1). A especificação `Especificacao_Tecnica_Prospec_Farmacias_v1_5_Multifontes.md` é mencionada nesses arquivos, mas não foi disponibilizada nesta solicitação; seus 72 RFs, critérios e detalhes NÃO podem ser tratados como integralmente conferidos. Quando esse arquivo for disponibilizado, fazer reconciliação formal de IDs, prioridades e regras sem sobrescrever decisões existentes.

### Aditivo de escopo aprovado — fase inicial de uma tabela (24/10/2026)

Por decisão expressa do usuário, o projeto Supabase qxsdcrywsjkrpcbfgbxb usará, pelo menos no início, somente a tabela existente public.pharmaleads. Não criar ou alterar outras tabelas, schemas, funções, papéis ou objetos desse projeto para executar os módulos atuais. Mudanças necessárias na própria tabela exigem diff restrito, preservação dos registros e avaliação de impacto. O plano multischema descrito adiante permanece referência arquitetural futura e não deve ser aplicado a esse projeto nesta fase.

A conexão inicial usa a Data API com chave publicável, no backend Python. A importação M02 poderá inserir e atualizar apenas campos cadastrais permitidos de public.pharmaleads; operações comerciais e histórico não podem ser apagados por reimportação. A execução real depende de arquivo de dados identificado, prévia, confirmação e política de acesso segura. A chave publicável conecta a aplicação, mas não constitui autenticação individual nem resolve a RLS.

Requisitos que dependam de múltiplas tabelas ou de objetos adicionais devem ser registrados como pendentes ou incompatíveis com esta fase, com alternativa e decisão humana antes de qualquer implementação remota. Este aditivo modifica o destino inicial de persistência, sem declarar atendidos integridade, auditoria, fila, privacidade ou homologação previstas neste contrato. Histórico e reconciliação em docs/DECISOES.md e docs/RECONCILIACAO_V15.md.

---

## 0. ORDEM PERMANENTE AO CURSOR — LEIA ANTES DE ESCREVER CÓDIGO

Você é o responsável técnico pela execução incremental do PharmaLeads. Sua missão é construir um sistema **funcional, auditável, seguro, modular, operável sem Docker e escalável por etapas**, sem apresentar protótipos, mocks ou arquivos recém-criados como funcionalidades homologadas.

1. Inspecione o repositório real antes de modificar arquivos. Se estiver vazio, crie a estrutura somente no módulo solicitado. Se existir código antigo em JavaScript/Node, inventarie e reaproveite o que for compatível; não destrua ou reescreva sem justificativa. TypeScript será utilizado no frontend; **não criar backend Node paralelo**.
2. Nunca implemente todos os módulos a partir deste documento automaticamente. Comece pelo **M00**; só execute outro quando eu pedir o código do módulo. Respeite dependências e os gates G1/G2/G3.
3. Use este documento como contrato de engenharia e os prompts M00–M24 como plano de execução. Em conflito: (a) segurança, legislação, licença e proibições explícitas; (b) decisão humana aprovada em `docs/DECISOES.md`; (c) especificação original v1.5 após conferida; (d) este documento; (e) escolhas técnicas rotineiras documentadas. Conflitos materiais exigem registro antes de execução real.
4. Não invente CNPJs, URLs de dados públicos, layouts, seletores, endpoints de terceiros, preços, licenças, acessos, resultados ou evidências. Fixtures sintéticas devem estar isoladas em testes e claramente rotuladas.
5. A ausência de credenciais não autoriza simular uma integração bem-sucedida. Implemente interfaces, testes locais e documentação; marque a integração real como **bloqueada**.
6. Não use Docker, Docker Compose, Redis, Celery, Kubernetes ou Supabase CLI local que dependa de Docker no piloto. Evite serviços e dependências extras sem evidência de necessidade.
7. Não use serviços externos pagos, não publique, não rode migração destrutiva e não efetue coleta massiva sem autorização explícita. Banco de testes e desenvolvimento devem ser diferentes da produção.
8. Secrets devem permanecer fora de código, logs, frontend, prompts e commits. Nunca me peça para colar segredos em mensagens. Documente o nome de variáveis e a configuração local protegida.
9. Ao final de cada etapa atualize contexto, progresso, matriz de requisitos, decisões, testes realmente executados e próximo bloqueio. Pare no módulo escolhido.
10. Priorize **soluções simples e verificáveis**, não arquitetura ornamental. Não esconda fragilidade com `try/except` genérico, retornos falsos, dados de demonstração em telas operacionais ou testes que só confirmam mocks.

### Formato obrigatório de resposta do Cursor por módulo

Antes de modificar: objetivo, arquivos atingidos, dependências e riscos. Depois de implementar: (1) pedido × entregue, (2) arquivos criados/alterados, (3) comandos PowerShell e diretório exato, (4) testes executados/resultados e não executados/motivo, (5) requisitos e estado, (6) segurança e limitações, (7) decisões, (8) itens dependentes de mim, (9) próximo módulo e seus pré-requisitos. Nunca declarar **integrado** sem acesso real nem **homologado** sem evidência de aceite.

---

## 1. VISÃO DO PRODUTO E RESULTADO DE NEGÓCIO

### 1.1 Problema

Encontrar, validar, organizar e trabalhar comercialmente estabelecimentos farmacêuticos em todo o Brasil demanda dados dispersos, contatos incompletos, identificação de matriz/filial e atualização frequente. O objetivo **não é apenas fazer scraping**: é oferecer um CRM confiável, com uma base mestre verificável, coleta de múltiplas fontes autorizadas, gestão do funil comercial e capacidade de explicar a origem de cada dado.

### 1.2 Objetivo

Construir uma plataforma interna na qual usuários autorizados possam: importar farmácias elegíveis de fontes cadastrais; navegar por UF e município; descobrir sites legítimos por fontes independentes; executar coletas manuais e, futuramente, automáticas; extrair contatos empresariais quando permitido; reconciliar dados; revisar casos ambíguos; visualizar a procedência e a qualidade; registrar responsável, status, atividades e histórico; bloquear contatos por canal; e exportar somente informação elegível. Todo trabalho de coleta deve continuar no worker mesmo que o navegador seja fechado.

### 1.3 Escopo geográfico

Abrangência arquitetural: **26 estados + Distrito Federal**, sem `CHECK` ou enum limitado a SP/GO/DF. Implantação inicial: **uma UF piloto a decidir**, com municípios configuráveis. Implementação e testes locais usam fixtures sintéticas enquanto D-02 estiver em aberto. Escalonamento nacional depende de medição e aprovação, não de um botão de varredura indiscriminada.

### 1.4 Segmento-alvo

CNAEs principais inicialmente propostos: `4771701`, `4771702`, `4771703`; formatar exibição conforme cadastro oficial sem perder os códigos originais. `4771704` (veterinário) e CNAEs secundários desabilitados até decisão D-01. Elegibilidade depende também da situação cadastral, competência e regras aprovadas. Não assumir que todo registro de CNAE correlato é lead utilizável.

### 1.5 Fora do MVP

Envio de e-mails, WhatsApp, campanhas, discadores, enriquecimento de pessoas físicas, scraping de áreas autenticadas, bypass de CAPTCHA/bloqueios, bot de vendas, integração automática ao Google Business Profile, scraping do Google Maps, importação persistente de contatos do Google Places e descoberta nacional por adivinhação de domínios. Não criar telas com botões operacionais que não possuam execução real.

### 1.6 Fluxos ponta a ponta

**Fluxo A — cadastro oficial:** selecionar UF/competência/CNAE → registrar fonte autorizada → adquirir arquivos oficiais e verificar layout → processar localmente em lotes → validar CNPJ numérico/alfanumérico e filiais → staging permitida → reconciliação → promoção atômica para cadastro mestre → medir cobertura G1. Importações posteriores preservam responsável, status e notas comerciais.

**Fluxo B — prospecção de contato:** obter domínio candidato de fonte independente aprovada ou entrada manual → validar URL e sinais de vínculo → aprovar estabelecimento/site → criar job → worker busca páginas permitidas via Scrapy ou Playwright → gerar observações e evidências mínimas → validar políticas e normalizar → resolver vínculo com a filial → classificar compartilhado/pessoal/empresarial → consolidar contato sem duplicar → revisão humana se ambíguo → disponibilizar no CRM se permitido.

**Fluxo C — operação comercial:** login → validar token e papéis → listar leads do escopo → filtrar e abrir ficha → consultar contato com fonte e grau de verificação → atribuir/alterar responsável e status autorizado → adicionar atividade imutável → aplicar bloqueios e regras antes de exportação → auditar cada ação. Sem envio automatizado de mensagens.

**Fluxo D — coleta manual:** operador configura fonte, UF/domínio e limites → backend valida escopo/licença/orçamento → cria job idempotente → worker reivindica job com lease → executa, checkpoint e heartbeat → grava resultados com proteção contra worker antigo → console mostra estado real → erro/retry/cancelamento → relatório G2.

**Fluxo E — agendamento futuro:** admin habilita agenda após G2 → scheduler do SO chama `tick` → transação cria ocorrência única + job → worker executa fluxo D → atrasos/reinício seguem política de catch-up. Google Places não participa de agendas.

**Fluxo F — privacidade:** registrar objeção ou pedido → validar escopo do contato/canal → inserir supressão segura → impedir uso/exportação atuais e futuros → registrar providência e trilha de auditoria → garantir que nova importação não reintroduza contato suprimido.

### 1.7 Marcos de entrega e valor cedo

O roadmap original prevê o dashboard completo em M13; para evitar demora no feedback de UX, **M01** inclui apenas shell web compilável e navegação não operacional. Pode-se criar um protótipo visual isolado, com dados explicitamente fictícios, **somente se solicitado**, sem alterar o gate nem antecipar integração funcional. O primeiro CRM comercial real continua em M11–M13; não afirmar que uma demonstração visual já valida cobertura de dados. Após M05, G1 testa a hipótese comercial antes do investimento pesado em crawling.

---

## 2. STACK TECNOLÓGICA PRESCRITA

| Camada | Tecnologia | Uso e limites |
|---|---|---|
| Linguagem backend | Python 3.12 como versão-base candidata | Confirmar suporte de todas as bibliotecas antes de fixar em lockfile; usar `venv` |
| API | FastAPI + Uvicorn + Pydantic v2 | OpenAPI, validações, endpoints HTTP; sem executar spiders na requisição |
| Persistência | PostgreSQL gerenciado pelo Supabase | Base mestre, filas, auditoria, CRM; conexões SQL com TLS |
| Acesso ao banco | SQLAlchemy 2.x + psycopg 3 | `Session`/transações explícitas; pool limitado e SQL parametrizado |
| Migrations | Alembic | Única fonte de verdade da evolução do schema |
| Autenticação | Supabase Auth | JWT validado no backend; papéis internos não derivados de metadados editáveis |
| Evidências | Supabase Storage privado | Apenas arquivos cuja persistência for permitida; URLs temporárias controladas |
| HTTP crawling | Scrapy + lxml | Coleta HTTP, throttling, robots, parsing versionado |
| Páginas JS | Playwright Chromium + integração scrapy-playwright quando compatível | Uso seletivo, contextos isolados, controle de recursos e egress |
| Transformação | Polars | Lotes e processamento de arquivos grandes sem `read_all` desnecessário |
| Normalização | Pydantic; `phonenumbers` se validada a necessidade | Tipos e telefone com contexto explícito |
| Frontend | React + TypeScript `strict` + Vite | SPA administrativa, sem acesso direto a schemas internos |
| UI | Tailwind CSS + shadcn/ui + Radix subjacente | Design system reutilizável e acessível |
| Roteamento e dados | React Router + TanStack Query | Rotas e cache de requisições; invalidar após mutações |
| Formulários | React Hook Form + Zod | Validação de interface coerente com OpenAPI, backend soberano |
| Tabelas | TanStack Table | Filtros, seleção e paginação controlada por servidor |
| Qualidade backend | pytest, Ruff, mypy (ou pyright, escolher um) | Tests, lint, formatação e checagem de tipos |
| Qualidade frontend | ESLint, TypeScript, Vitest, Testing Library, Playwright Test | Unitário, componentes, E2E e acessibilidade |
| Operação | PowerShell + Agendador de Tarefas (Windows); systemd/cron (Linux) | Sem Docker; scheduler, API e worker separados |
| CI | GitHub Actions | Lint, tipos, testes e build; segredos e ambientes segregados |

**Política de versões:** as versões citadas são famílias ou candidatas de arquitetura, NÃO alegação de compatibilidade testada. M01 verifica versões estáveis/documentadas vigentes, fixa `pyproject.toml`/lock e `package-lock.json` (npm como gerenciador padrão), registra matriz Python/Node e não atualiza dependências sem testes. Usar Python `src` layout e empacotamento instalável; não recorrer a manipulação de `sys.path`. Evitar dependências duplicadas que façam a mesma função.

**Supabase:** considerar endpoint direto (IPv6, ou IPv4 com configuração do plano) e pooler **session** em rede IPv4; conferir limite real e funções da sessão (`COPY`, cursors, prepared statements) antes de escolher. Pooler **transaction** não é a escolha para importação com `COPY` ou dependências de sessão. `service_role`/credenciais privilegiadas não entram no navegador. HTTPS/TLS obrigatório fora dos testes locais.

---

## 3. ESTILO ARQUITETURAL E FRONTEIRAS

### 3.1 Estilo

**Monorepositório + monólito modular** no backend, **workers/processos independentes** e SPA React. Não criar microsserviços HTTP artificiais. Separar domínios por responsabilidade, dependências unidirecionais e contratos tipados. Camadas recomendadas: **domain** (regras e entidades), **application** (casos de uso e transações), **infrastructure** (SQL, redes, Storage, crawler), **presentation** (FastAPI/CLI); adotar pragmaticamente e sem classes vazias.

### 3.2 Dependências permitidas

`web -> API HTTP -> aplicação -> domínio/portas -> infraestrutura`. `worker -> handlers de jobs -> casos de uso/infraestrutura`. `scheduler tick -> repositório de agendas/jobs`, jamais importando componentes React. Scrapers produzem `ObservationCandidate`; **não** escrevem em `comercial.*` nem promovem contatos diretamente. `source_policies` aplica controle transversal em importação, gravação, leitura e exportação.

### 3.3 Diagrama lógico

```text
Receita Federal / Arquivos aprovados / Sites confirmados / Fontes licenciadas
                |                 |                   |
            Importador         Scrapy           Playwright (se JS)
                |                 |                   |
                +--------- Adaptadores tipados --------+
                                  |
                     Política de fonte/campo/ação
                                  |
                    Staging e observações permitidas
                                  |
                    Normalização / resolução / revisão
                                  |
                 PostgreSQL Supabase (schemas internos)
                      |                       |
                 FastAPI                    Worker
                      |                       ^
              React CRM / Auth              Jobs PostgreSQL
                                              ^
                                          Scheduler tick

           Google Places (consulta manual transitória separada)
```

### 3.4 Domínios de responsabilidade

- **ingest:** arquivos oficiais, staging, competência, snapshots, falhas e reconciliação.
- **core:** estabelecimento, fonte, políticas, identidade, sites, observações, contatos e evidências.
- **coleta:** job, tentativas, lease, agenda, cursor, métricas e histórico.
- **comercial:** lead/atribuição/status/atividades, sem que scrapers alterem seu estado.
- **audit:** autoria e evento imutável, acessível só ao papel autorizado.
- **privacy:** supressão, exportações, pedidos LGPD e retenção.
- **google_integrations:** consultas transitórias e metadados permitidos, sem escrever contatos restritos.

### 3.5 Estratégia de evolução

Escalar inicialmente pelo aumento controlado de workers e particionamento dos jobs por fonte/UF/domínio. Monitorar conexões PostgreSQL, memória de Chromium, tamanho de staging, custo de Storage e produtividade do parser. Separar infraestrutura em serviços adicionais **somente quando métricas justificarem**. Não prometer elasticidade automática em um PC local.

---

## 4. ESTRUTURA DE PASTAS CANÔNICA

Os diretórios abaixo são **estrutura-alvo**, não ordem para criar arquivos vazios no M01. O pacote Python `pharmaleads` fica em `packages/backend/src/` e todas as entradas importam o mesmo pacote instalado em modo editável; `apps/api` e `services/` contêm entrypoints/configuração e implementações específicas, nunca cópias das mesmas regras.

```text
pharmaleads/
├── README.md
├── AGENTS.md                         # orientação resumida ao Cursor
├── .cursor/
│   └── rules/
│       ├── 00-core.mdc               # regras permanentes e escopo por módulo
│       ├── 10-backend.mdc
│       ├── 20-frontend.mdc
│       ├── 30-security.mdc
│       └── 40-testing.mdc
├── .env.example                       # somente nomes/placeholders seguros
├── .gitignore
├── .github/workflows/ci.yml
├── pyproject.toml                     # configuração raiz Python/QA
├── requirements.lock ou uv.lock      # escolher UMA estratégia reproduzível
├── package.json                      # scripts agregadores opcionais
├── package-lock.json
├── apps/
│   ├── api/
│   │   └── README.md                  # execução Uvicorn do pacote instalado
│   └── web/
│       ├── index.html
│       ├── vite.config.ts
│       ├── tsconfig.json
│       ├── src/
│       │   ├── app/                   # providers, router, guards, layout
│       │   ├── assets/
│       │   ├── components/ui/         # wrappers do design system
│       │   ├── components/common/
│       │   ├── features/
│       │   │   ├── auth/
│       │   │   ├── dashboard/
│       │   │   ├── estabelecimentos/
│       │   │   ├── leads/
│       │   │   ├── atividades/
│       │   │   ├── coletas/
│       │   │   ├── agendas/
│       │   │   ├── fontes/
│       │   │   ├── revisao/
│       │   │   ├── privacidade/
│       │   │   └── integracoes/
│       │   ├── hooks/
│       │   ├── lib/                    # api client, query keys, utils
│       │   ├── generated/             # tipos OpenAPI (não editar manualmente)
│       │   ├── styles/
│       │   ├── test/
│       │   └── main.tsx
│       ├── public/
│       └── tests/e2e/
├── packages/backend/
│   ├── pyproject.toml                 # somente se escolhido empacotamento workspace
│   └── src/pharmaleads/
│       ├── __init__.py
│       ├── config.py
│       ├── api/
│       │   ├── main.py
│       │   ├── dependencies.py
│       │   ├── errors.py
│       │   ├── middleware.py
│       │   └── routes/v1/
│       ├── domain/
│       │   ├── establishment/
│       │   ├── source_policy/
│       │   ├── contact/
│       │   ├── commercial/
│       │   ├── jobs/
│       │   └── privacy/
│       ├── application/
│       │   ├── commands/
│       │   ├── queries/
│       │   └── services/
│       ├── infrastructure/
│       │   ├── database/
│       │   │   ├── models/
│       │   │   ├── repositories/
│       │   │   ├── session.py
│       │   │   └── unit_of_work.py
│       │   ├── auth/
│       │   ├── storage/
│       │   ├── clients/
│       │   └── crawling/
│       ├── worker/
│       │   ├── main.py
│       │   ├── claim.py
│       │   └── handlers/
│       ├── scheduler/
│       │   └── cli.py
│       ├── cli/
│       │   ├── import_cnpj.py
│       │   └── report_coverage.py
│       └── shared/
│           ├── identifiers.py
│           ├── normalization.py
│           ├── security.py
│           └── observability.py
├── services/
│   ├── ingest_cnpj/
│   ├── discovery/
│   ├── connectors/
│   │   ├── receita/
│   │   ├── farmacia_popular/
│   │   ├── redes/
│   │   ├── anvisa/
│   │   ├── csv_fornecedores/
│   │   └── osm/
│   ├── source_policies/
│   ├── crawler/spiders/
│   ├── normalizer/
│   ├── resolver/
│   ├── scheduler/
│   └── google_integrations/
├── database/
│   ├── alembic.ini
│   ├── migrations/
│   │   ├── env.py
│   │   └── versions/
│   └── sql/                             # EXPLAIN e consultas operacionais versionadas
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── contract/
│   ├── security/
│   ├── fixtures/
│   └── performance/
├── ops/
│   ├── windows/                         # PowerShell, supervisor, scheduler
│   ├── linux/                           # systemd, cron, permissões
│   ├── runbooks/
│   └── backup/
└── docs/
    ├── CONTEXTO.md
    ├── PROGRESSO.md
    ├── DECISOES.md
    ├── MATRIZ_REQUISITOS.md
    ├── ARQUITETURA.md
    ├── MODELO_DADOS.md
    ├── API.md
    ├── FONTES_E_LICENCAS.md
    ├── SEGURANCA.md
    ├── TESTES.md
    ├── OPERACAO.md
    ├── PILOTO.md
    └── referencia/
```

**Regra de ajuste:** não manter duas configurações Python concorrentes; M01 decide se `pyproject.toml` mora na raiz (recomendado para uma única distribuição) ou no pacote. Pastas em `services/` podem ser adaptadores/scripts que importam `pharmaleads`, sem duplicar domínio. Registrar escolha em `DECISOES.md`. Nunca criar circular imports nem `utils.py` genérico com lógica de diversos domínios.

---

## 5. MODELO DE DADOS LÓGICO E CONTRATOS

### 5.1 Convenções globais

UUID em IDs internos; CNPJ **`varchar(14)`/`text`** em formato canônico uppercase sem pontuação; 12 primeiras posições compatíveis com caracteres alfanuméricos e duas últimas posições numéricas de verificação, validadas segundo a regra oficial vigente. Não converter CNPJ para número. Timestamps `timestamptz` UTC, exibição local `America/Sao_Paulo` por padrão. Usar PK/FK, índices úteis, `NOT NULL` quando justificado, checks, versões incrementais e `created_at/updated_at`. Evitar `ON DELETE CASCADE` apagando histórico comercial/auditoria sem política explícita.

### 5.2 Entidades mínimas (nomes lógicos; definir DDL com Alembic)

| Schema.entidade | Campos e regras fundamentais |
|---|---|
| `ingest.carga` | `id`, fonte, competência, UF, filtros, layout/versão, hash, estado, totais, início/fim, erro sanitizado |
| `ingest.staging_estabelecimento` | carga, índice/linha, campos cadastrais permitidos, hash, situação de validação |
| `ingest.rejeicao` | carga, código de erro, linha, metadados permitidos, sem payload sensível desnecessário |
| `core.estabelecimento` | `id`, `cnpj` único, razão/nome fantasia, matriz/filial, CNAE, situação, endereço, UF, município, competência, snapshot/versionamento |
| `core.fonte` | tipo, fornecedor, propósito, status, contratos, limites, aprovação, vigência, retenção, canais |
| `core.politica_fonte` | `fonte_id`, campo, ação (coletar/armazenar/exibir/exportar), decisão, vigência, justificativa, versão |
| `core.site_candidato` | URL/domínio normalizado, origem independente, candidato estabelecimento, sinais, estado, revisor/data |
| `core.observacao` | fonte, estabelecimento candidato, tipo/campo, valor quando permitido, data, versão parser, metadados, evidência |
| `core.evidencia` | hash, referência de URL ou Storage, restrição de acesso, retenção, expiração, exclusão de bruto |
| `core.contato` | estabelecimento, tipo, valor normalizado, classificação e estado; único por `(estabelecimento_id,tipo,valor_normalizado)` |
| `core.contato_observacao` | associação N:N das fontes que realmente observaram aquele valor, sem herdar licença fictícia |
| `core.conflito_vinculo` | candidatos, motivo, score explicável, estado, revisão humana, decisão e versão |
| `core.usuario_perfil` | `auth_user_id`, papel, ativo, atribuição autorizada, histórico administrativo |
| `comercial.lead` | estabelecimento, responsável, status, observações comerciais, `version` para edição concorrente |
| `comercial.atividade` | lead, autor, tipo, resumo, momento, origem, append-only; correção por novo evento |
| `coleta.job` | fonte, tipo, partição, chave idempotente, origem, estado, tentativas, limites, lease, fencing, checkpoint |
| `coleta.job_tentativa` | job, worker, início/fim, resultados, erros classificados, métricas e token de execução |
| `coleta.agenda` | periodicidade, fuso IANA, próxima ocorrência, atraso, ativa, responsável, limites |
| `coleta.ocorrencia` | agenda, janela lógica, job associado, unicidade por agenda/janela |
| `privacy.supressao` | identificador HMAC por canal/valor, versão de chave, motivo, escopo, data, solicitante |
| `privacy.pedido` | tipo, solicitante, status, responsável, prazo aprovado internamente, ações de atendimento |
| `privacy.exportacao` | filtros, autor, job, período, escopo, contagens, estado, arquivo temporário e expiração |
| `audit.evento` | ator, ação, recurso, ID, antes/depois minimizados, horário, request/job_id, motivo |

### 5.3 Regras de integridade indispensáveis

- CNPJ completo identifica **cada estabelecimento**; filiais com a mesma raiz não são fundidas. Telefones e domínios iguais entre filiais **não** identificam a mesma loja.
- `UNIQUE(cnpj)` somente após normalização e validação. CNPJ sem confirmação vai para rejeição/revisão, não para cadastro mestre promovido.
- `contato` é único **por estabelecimento, tipo e valor**; a mesma observação de retry não duplica vínculo nem atividade.
- Contatos compartilhados continuam relacionados às unidades com classificação apropriada, nunca promovidos como contato direto confirmado de cada filial.
- `comercial.lead` contém informações **exclusivamente comerciais**; `ingest`, spiders e normalizadores não recebem permissão de atualização nessas tabelas.
- Observações de fontes diferentes devem manter proveniência independente. Revogação de licença pode tornar um contato inelegível, ainda que seu valor continue armazenado sob uma política específica.
- Política `deny by default`: sem autorização explícita por fonte/campo/ação, bloquear inclusive staging, arquivos temporários persistentes, logs e exportação.
- Estado comercial e trilha de atividades permanecem preservados após importação, consolidação ou reprocessamento; testar esta propriedade explicitamente.
- Auditar alteração de responsável, status, revisão, aprovação de fonte, supressão e exportação.
- Usar migrations aditivas com `expand -> backfill -> contract` quando houver dados reais. Testar constraints e permissões com papel de runtime, não apenas owner do schema.

### 5.4 Contratos tipados ilustrativos

```python
from datetime import datetime
from typing import Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field

ContactKind = Literal["telefone", "email", "website", "whatsapp"]

class ObservationCandidate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    source_id: UUID
    establishment_candidate_id: UUID | None
    kind: ContactKind
    raw_value: str = Field(min_length=1, max_length=2048)
    observed_at: datetime
    source_url: str | None
    extractor_version: str
    evidence_reference: str | None = None

class JobRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    source_id: UUID
    kind: Literal["importacao", "descoberta", "scraping_http", "scraping_js", "revalidacao"]
    uf: str | None = Field(default=None, min_length=2, max_length=2)
    confirmed_domain_id: UUID | None = None
    max_pages: int = Field(default=10, ge=1, le=100)
```

Este exemplo não é o contrato final: implementar invariantes cross-field (tipo de job × escopo obrigatório) e aderir ao schema resultante. **Nunca confundir campo presente com direito de persistir ou exportar.**

---

## 6. REGRAS DE NEGÓCIO, ESTADOS E CASOS DE USO

### 6.1 Papéis e autorização provisória

- `admin`: governança de usuários/configuração/fontes, acesso ampliado conforme política.
- `gestor`: consulta comercial global e exportação se aprovado.
- `comercial`: consulta/edição apenas de leads atribuídos, sem administrar crawler ou políticas.
- `operador`: gerencia jobs/coletas e monitora fontes; sem alteração comercial irrestrita.
- `revisor`: valida sites, vínculos e conflitos, com justificativa auditada.
- `privacidade`: gerencia bloqueios/pedidos e visualização estritamente necessária.

Princípio: autorizar por **ação + recurso + escopo**, não somente por nome de papel ou visibilidade de botão. Documentar matriz endpoint × papel × condição. Proposta inicial requer decisão D-07. A criação de conta Supabase Auth não concede, por si, acesso ao CRM.

### 6.2 Estados de lead

`Não contatado -> Em contato -> Respondido -> Qualificado` ou `Sem interesse`; transições adicionais devem ser explicitamente aprovadas e registradas. Não criar automações de funil sem requisito. Registro de atividade não deve modificar status implicitamente. Editar lead requer `version` esperada; conflito retorna `409`, com possibilidade de reconciliar sem perder nota digitada.

### 6.3 Estados do job

`pendente -> executando -> concluido` ou `executando -> aguardando_retry -> pendente`; falhas definitivas seguem para `falhou`; cancelamento solicitado é distinto de `cancelado` confirmado. Uma tentativa pode expirar o lease; worker antigo deve perder direito de finalizar e de publicar efeitos. Usar transições atômicas e token de fencing. Cancelamento antes de começar é imediato; em execução é cooperativo, com progresso verdadeiro.

### 6.4 Estados de sites/vínculos

`pendente -> confirmado | rejeitado | em_revisao`, com justificativa e autoria. Evidência forte (por exemplo CNPJ completo realmente publicado e correspondente) pode sustentar automação aprovada. Nome semelhante, telefone comum ou endereço parcial exigem revisão. Uma página de rede não atribui contato da central a todas as lojas.

### 6.5 Estados de fonte

`rascunho -> pendente_aprovacao -> aprovada -> suspensa | expirada | revogada`. Uma fonte vencida/revogada bloqueia novas coletas e novos usos incompatíveis. Expiração de licença não deve ser mascarada por dados antigos em cache ou exportação.

### 6.6 Estados de qualidade do contato

Dimensões separadas, jamais único campo mágico: (a) formato `valido/invalido/indeterminado`, (b) vínculo `confirmado/provavel/ambíguo/não vinculável`, (c) natureza `empresarial/pessoal/compartilhado/indeterminado`, (d) operacional `não testado/confirmado/inválido`, (e) frescor e (f) elegibilidade jurídica/contratual por canal. Score heurístico é prioridade de revisão, **não probabilidade**.

### 6.7 Contatos compartilhados

Regra configurável inicial: valor normalizado aparece em **3 ou mais estabelecimentos distintos**, ou pertence a central de rede, ou domínio genérico/contabilidade listado em configuração versionada. A marcação é um indício revisável, não motivo para apagar vínculo. Não chamar genericamente todo Gmail/Outlook de e-mail inválido. Não inferir que `tel:` é WhatsApp; links `wa.me` são apenas sinais de canal publicado.

### 6.8 Casos de uso de negócio

`UC-01` Importar recorte oficial com dry-run, validação e promoção.  
`UC-02` Buscar/listar/filtrar estabelecimentos nacionalmente por UF, cidade, CNAE, situação e contato.  
`UC-03` Cadastrar domínio candidato, validar e revisar associação.  
`UC-04` Executar/reprocessar/cancelar coleta manual com monitor real.  
`UC-05` Consolidar contatos com rastreabilidade, classificação e revisão.  
`UC-06` Distribuir leads e registrar atividades comerciais.  
`UC-07` Exportar apenas campos/contatos autorizados, respeitando supressões.  
`UC-08` Registrar e resolver pedidos de correção/exclusão/bloqueio.  
`UC-09` Configurar agenda (pós-G2) e acompanhar falhas/recuperação.  
`UC-10` Consultar Places sob demanda em tela separada (condicional, sem persistência proibida).  
`UC-11` Auditar mudança de status, fonte, vínculo, permissão, exportação e tratamento de dados.  
`UC-12` Comparar ganho incremental por fonte, qualidade de vínculo e custo real do piloto.

### 6.9 Critérios de negócio transversais

Não criar contagem fictícia. Estabelecimentos elegíveis, contatos distintos, observações e leads trabalhados são métricas diferentes. Ter telefone publicado não prova que ele está válido ou autorizado para disparos. `sem contato` deve poder refletir `não coletado`, `coletado sem encontrar`, `bloqueado por política`, `em revisão` e `sem dados`, evitando conclusões erradas.

---

## 7. FONTES DE DADOS E LICENÇAS

| Fonte | Finalidade prevista | Implementação | Condição de uso |
|---|---|---|---|
| Receita Federal — dados abertos CNPJ | Base oficial de estabelecimentos, cadastro declarado | M05, lotes e snapshots | Conferir layout, publicação, cobertura e finalidade |
| Sites institucionais confirmados | Contatos comerciais publicados e dados de lojas | M07–M10 com Scrapy/Playwright | Termos, robots, política do campo e URL segura |
| Localizadores de redes | Endereços e contatos específicos de filial | M17 | Aprovação da fonte e parser real por rede |
| Farmácia Popular | Qualificação de participação quando fonte oficial disponível | M16 | Conferir dataset e licença; não supor telefone |
| Anvisa | Qualificação por mecanismo verificável | M18 | Pode ser consulta manual; não presumir API em lote |
| Importação CSV/fornecedores | Complementar dados comerciais licenciados | M19 | Contrato por campo, finalidade, retenção e exportação |
| OpenStreetMap | Descoberta geográfica condicional | M20 | Revisar obrigações ODbL e atribuição; sem presumir CNPJ |
| Contato fornecido diretamente | Registro de contato informado pela empresa | M11 | Origem real, auditoria e classificação; não reetiquetar Google |
| Google Places API (New) | Consulta contextual manual e transitória | M21 separado | Aprovação jurídica/financeira/técnica; proibir importar contato restrito |

**Regra crítica Google:** Google Business Profile é gestão de perfil empresarial próprio, não fonte genérica de extração de contatos de terceiros. Não implementar scraping de Maps, contorno de bloqueios ou varredura nacional por Places. Consultas Google não alimentam tabelas próprias de contatos, staging, logs, arquivos, cache persistente nem mecanismo oculto de descoberta de URLs. `place_id` pode ser guardado nos limites expressamente permitidos e deve continuar separado dos campos restritos. Revisar os termos vigentes **antes de ativar**; separar tabelas não significa autorização contratual automática.

**Cobertura comercial:** a Receita não é catálogo confiável de websites das farmácias. G1 mede campos declarados e sites já conhecidos; se não houver fornecedor de descoberta autorizado, M07 entrega entrada manual/importação rastreada, não uma promessa de descoberta automática nacional. Reportar claramente ao negócio que o número de telefones obtidos de fontes autorizadas pode ser inferior ao observado em Google Maps.

---

## 8. IMPORTAÇÃO, CRAWLING, NORMALIZAÇÃO E VÍNCULO

### 8.1 Importador Receita

Conferir layout oficial vigente, nomes reais de arquivos, encoding, competência, referência de município, separadores e atualizações. Registrar URL, versão, hash local e checksum oficial quando existir; hash local sozinho não prova autenticidade. Inspecionar e limitar ZIP antes de extrair (path traversal, zip bomb, extensões). Não baixar país inteiro automaticamente. Processar localmente em streaming/lotes, filtrar cedo por UF/município/CNAE e carregar apenas elegíveis ao Supabase via `COPY` ou batches com sessão apropriada. Reexecução por mesma carga deve ser idempotente; recorte parcial não significa fechamento/inativação dos ausentes. Registro de matriz e filial é independente e comercial é preservado.

### 8.2 Descoberta e SSRF

Candidatos só vêm de entradas/arquivos/fontes aprovadas independentes. Validar `http/https`, portas, IDNA, credenciais na URL, DNS, IPv4 e IPv6, privados, loopback, link-local, metadata endpoints e redirecionamentos. Revalidar cada destino efetivo. Controlar DNS rebinding/egress de rede inclusive subrequests do browser; sem mitigação suficiente, **não habilitar URL arbitrária em produção**. Fixture local é exceção de teste isolada, nunca allowlist de produção.

### 8.3 Scrapy

Respeitar `robots.txt`, termos, allowlist de domínio, profundidade, concorrência e taxa por host, timeouts, conteúdo máximo e AutoThrottle. Tratar 429 com `Retry-After`, 5xx com retry finito, 403/CAPTCHA com pausa sem evasão. Visitar preferencialmente páginas `contato`, `sobre`, rodapé, links `tel:`, `mailto:`, `wa.me` e JSON-LD quando autorizado. Registrar extrator, data, URL e hash. Não renderizar HTML bruto como conteúdo seguro.

### 8.4 Playwright

Usar somente se a origem realmente depender de JavaScript e a política permitir. Esperar condição de DOM específica, limitar contextos, páginas, processos, memória, tempo e requests. Tratar redirecionamentos, iframes, service workers, popups, WebSockets e subrequests. Não compartilhar cookies ou sessão entre domínios/estabelecimentos. Encerrar processos órfãos após falha; não usar sleeps arbitrários como mecanismo de sincronização.

### 8.5 Normalização e entidade

Validar CNPJ misto; telefone com DDI/DDD e indicação de extensão (`phonenumbers` quando adotado); e-mail preservando local-part e tratando Unicode/IDN conforme política; URLs canônicas sem parâmetros irrelevantes e CEP/endereço sem reconstrução inventada. Normalização não comprova titularidade. Correspondência por CNPJ completo e evidência forte pode ser automática conforme regra aprovada; nome/endereço semelhantes exigem revisão e trilha auditável. Garantir que evidência de um domínio de rede não seja usada como vínculo direto de loja sem justificativa.

### 8.6 Persistência de evidências

Manter o mínimo necessário (origem, data, versão, hash, metadados e, apenas quando permitido, trecho/arquivo privado). Retenção de conteúdo e revalidação devem ser configuráveis e validadas pelo responsável; **12 meses e 90 dias** aparecem como propostas no material de referência, não obrigação legal automática. Se o bruto expirar, preservar trilha mínima permitida e invalidar provas que não possam mais sustentar determinada classificação. Storage privado, escopo por ação, signed URLs efêmeras e limpeza de órfãos.

---

## 9. JOBS, CONCORRÊNCIA, IDEMPOTÊNCIA E AGENDAMENTO

### 9.1 Arquitetura da fila

Fila em PostgreSQL, sem Redis/Celery: `INSERT` com chave de requisição; worker usa `SELECT ... FOR UPDATE SKIP LOCKED` numa transação curta; reserva `lease_until`, `attempt_id`, `fencing_token` monotônico; faz I/O fora da transação; grava checkpoint e resultado somente se token ainda válido. Heartbeat e resgate de lease expirado. Sem garantir exactly-once: **at-least-once + efeitos idempotentes**.

### 9.2 Duas idempotências diferentes

- **Requisição:** `request_idempotency_key`, fornecida/gerada pelo cliente e mantida nos retries, retorna o mesmo job se repetida.
- **Trabalho ativo:** chave canônica `source_id + job_kind + canonical_partition` evita crawls equivalentes **concomitantes**. A chave da **janela lógica** distingue novas coletas legítimas após conclusão.
- Partições devem ordenar listas, normalizar casing/espaços, UF e domínios. Definir algoritmo de serialização/hash e janela concreta em D-19; testar fronteiras de tempo, paralelismo e reinício.
- Agendas têm `UNIQUE(agenda_id, logical_occurrence)` e ocorrência associada ao job, incluindo casos deduplicados contra coleta manual.

### 9.3 Recuperação

Retries exponenciais com jitter e teto, somente para falhas transitórias; timeouts e `Retry-After` quando aplicável. `403`, CAPTCHA e licença inválida não recebem retries de evasão. Falha terminal preserva motivo sanitizado; tentativa esgotada não cria loop. Cancelamento cooperativo reconhecido; queda do banco interrompe writes e mantém estado recuperável. Concluir job ou publicar resultado por worker cujo lease expirou é proibido.

### 9.4 Scheduler

Após G2, comando `python -m pharmaleads.scheduler.cli tick` idempotente acionado pelo Windows Task Scheduler, ou alternativa Linux. Agendas diárias, semanais e mensais com timezone IANA; definir comportamento de 29/30/31, DST, horários ambíguos/inexistentes e máquina desligada. Atraso gera **no máximo um catch-up** por política ou pula a ocorrência, sem avalanche. Scheduler cria jobs; não executa spiders. Coletas Places excluídas.

---

## 10. API, CONTRATOS E TRATAMENTO DE ERROS

### 10.1 Contrato HTTP

Todos os recursos versionados em `/v1`; JSON UTF-8; OpenAPI gerado pela FastAPI; tipos TypeScript de cliente gerados a partir do OpenAPI validado. Endpoints sugeridos:

```text
GET    /health
GET    /ready
GET    /v1/me
GET    /v1/estabelecimentos
GET    /v1/estabelecimentos/{id}
GET    /v1/contatos/{id}/evidencias
GET    /v1/fontes
GET    /v1/fontes/{id}/politicas
GET    /v1/sites/candidatos
POST   /v1/sites/candidatos
POST   /v1/sites/candidatos/{id}/revisao
PATCH  /v1/leads/{estabelecimento_id}
POST   /v1/leads/{id}/atividades
POST   /v1/supressoes
POST   /v1/exportacoes
GET    /v1/exportacoes/{id}
POST   /v1/jobs
GET    /v1/jobs
GET    /v1/jobs/{id}
POST   /v1/jobs/{id}/cancelar
POST   /v1/jobs/{id}/reprocessar
GET    /v1/agendas
POST   /v1/agendas
PATCH  /v1/agendas/{id}
GET    /v1/agendas/{id}/execucoes
GET    /v1/metricas/cobertura
GET    /v1/qualidade/fontes
POST   /v1/integracoes/google/places/busca  # condicional M21
```

Rotas são **contratos propostos** e só passam a existir nos respectivos módulos. M21 deve adaptar endpoints e métodos ao contrato real do provedor. Não criar handler que apenas retorna `[]` para aparentar funcionamento.

### 10.2 Padrões de resposta

Paginação server-side: `items`, `next_cursor` ou `page`/`page_size`, `total` quando calculável; limite máximo configurado; ordenação estável com desempate por ID; apenas campos de ordenação permitidos; filtros compostos parametrizados. Nunca carregar o país inteiro no browser. Para jobs, `POST /v1/jobs` retorna `202 Accepted`, `job_id`, localização e indicador de deduplicação. `PATCH` comercial com `version` e retorno `409` no conflito.

### 10.3 Erros padronizados

```json
{
  "error": {
    "code": "LEAD_VERSION_CONFLICT",
    "message": "O lead foi alterado por outro usuário.",
    "details": null,
    "request_id": "<uuid>"
  }
}
```

Mapeamento: `400` parâmetros inconsistentes, `401` sem autenticação/token inválido, `403` sem autorização ou fonte bloqueada (não vazar dados sensíveis), `404` recurso inexistente ou não visível quando adequado, `409` conflito de versão/chave/estado, `422` schema inválido, `429` limite, `503` dependência indisponível. Nunca retornar stack trace, SQL, token ou URL contendo segredo. `request_id` é propagado para logs, jobs e auditoria. O frontend apresenta erro legível, estado de recuperação e mantém dados do formulário sem confirmar sucesso falso.

### 10.4 Resiliência da API

Pool SQL limitado, transações curtas, timeout por dependência, cancelamento de requisição, circuit breaker somente quando comprovadamente necessário, retries apenas em operações idempotentes e com orçamento. Evitar N+1 e índices sem justificativa. `GET /health` responde vida do processo; `GET /ready` valida somente dependências necessárias e não diz pronto quando DB/Auth indispensável está indisponível.

---

## 11. INTERFACE CRM — UX, TELAS E INTERAÇÃO

**Identidade:** PharmaLeads, produto interno da Centrus; usar logotipo real fornecido, sem gerar imagem fictícia. Visual de CRM SaaS claro, profissional, dados densos mas legíveis, navegação estável, tons neutros com azul-marinho como destaque, componentes shadcn/ui, contraste WCAG e responsividade. Português brasileiro; datas no fuso configurado; estados carregando/vazio/erro/sucesso. Evitar excesso de gradientes, métricas falsas e animações que comprometam produtividade.

### 11.1 Layout

Sidebar recolhível: Visão Geral, Estabelecimentos, Leads, Coletas, Agendamentos (quando implementado), Fontes, Revisões, Privacidade, Relatórios e Configurações (conforme papel). Topbar: busca, UF ativa/filtros, estado do usuário e logout. Área principal: breadcrumbs, ações e conteúdos. Em mobile: navegação adaptada e detalhes acessíveis, sem depender exclusivamente de tabela horizontal.

### 11.2 Telas

1. **Login:** fluxo Supabase Auth, erros apropriados, proteção de sessão, logout e controle de inatividade conforme política.
2. **Visão Geral:** cards e gráficos **somente** com métricas reais da API: cobertura, leads por status, pendências, jobs; quando não medido, mostrar `Não disponível`.
3. **Estabelecimentos:** tabela paginada com CNPJ, nome, cidade/UF, CNAE, situação, contatos por tipo/qualidade, fonte, responsável/status; filtros persistentes na URL e seleção autorizada.
4. **Ficha de estabelecimento:** cabeçalho, cadastro oficial, contatos consolidados com origem, tipo/qualidade, sites e vínculo, histórico/atividades, notas comerciais, pendências e evidências acessíveis.
5. **Leads:** mudança de status e atribuição com controle otimista, timeline append-only, filtros de responsável e estado.
6. **Coletas:** disparo manual com limites, histórico, filtro por estado, tipo, UF, fonte, tentativas, progresso genuíno, cancelamento e reprocessamento.
7. **Agendas:** periodicidade, fuso, próxima execução, atraso, pausa e histórico (M15 após gate).
8. **Fontes e revisões:** política/status/licença/termos, fontes pendentes, sites candidatos, vínculos ambíguos, aprovar/rejeitar com motivo.
9. **Privacidade/exportação:** pedidos, supressão, elegibilidade, contagem excluída, download autenticado temporário.
10. **Consulta Google:** busca manual e detalhes transitórios claramente separados dos dados do CRM, sem botão de importar telefone, somente M21 autorizado.

### 11.3 Regras de frontend

Separar `features/<dominio>/{api,components,hooks,schemas,pages}` quando justificável; componentes UI comuns sem regras comerciais. React Query para estado do servidor; estado local apenas formulário/UI; não duplicar dados da API em vários stores. Tipar contratos gerados, `strict: true`, evitar `any` e `as unknown as`. Formulário com Zod/RHF, validação backend final; tratar token expirado, 401/403, 409, 429, rede offline e retries controlados. Sem dados fictícios em produção. Lista deve funcionar com 0, 1 e milhares de registros mediante paginação. Acessibilidade: navegação por teclado, foco visível, labels, modais com focus trap, tabela com cabeçalho semântico e feedback anunciável.

---

## 12. SEGURANÇA, PRIVACIDADE E GOVERNANÇA

### 12.1 Modelo de ameaça mínimo

Atacante externo não autenticado; usuário comercial tentando acessar lead de outro usuário (IDOR); operador malicioso tentando URL interna (SSRF); fonte externa devolvendo HTML/JS perigoso (XSS); arquivo ZIP/CSV malicioso; credential leakage via logs; pool SQL compartilhando contexto de usuário; spider herdando privilégios comerciais; job perdido/repetido; exportação posterior à supressão. Cada risco exige teste negativo e mitigação demonstrável.

### 12.2 Autenticação/Autorização

Verificar assinatura JWT com chaves oficiais do projeto e rotação/JWKS conforme modo aplicável, `iss`, `aud`, expiração e usuário ativo; nunca apenas base64 decode. Papéis em tabela protegida, atribuídos por admin. Autorização central `can(actor, action, resource, scope)`, aplicada inclusive ID de detalhe, evidências, histórico e exportação. Contas recém-criadas ficam sem autorização até ativação. Auditoria de negações relevantes, sem tokens.

### 12.3 Banco e RLS

Schemas internos não expostos à Data API por padrão; acessar dados comerciais via FastAPI, conexões SQL de papéis mínimos. `migration_role` separado de `api_runtime_role` e `collector_role`; scraper sem `UPDATE` comercial. **RLS não protege uma consulta que a contorne**, como papéis proprietários/BYPASSRLS; documentar o caminho efetivo. Se contexto transacional de usuário for usado, aplicar `SET LOCAL` seguro em toda transação, testar limpeza do pool; caso contrário impor escopo na aplicação e permissões SQL por papel com testes reais.

### 12.4 Proteções de dados

Política de fonte/campo/ação com deny-by-default; finalidade e base legal sob decisão D-05, sem presumir legitimidade apenas por dados públicos. Supressão por valor normalizado+canal via HMAC com chave secreta/versionada, procedimento de rotação com versões válidas até migração completa. Exportação revalida permissão e supressões antes de gerar e liberar download. Não exportar informação pessoal sem base e finalidade aprovadas; não definir prazo LGPD fictício. Tratar dados de representantes/pessoas naturais de modo mais restritivo que informações cadastrais de pessoa jurídica. Registrar pedidos de titulares e decisões de retenção.

### 12.5 Segurança de rede e coleta

SSRF em todas as etapas (inclusive DNS rebinding e browser); proibir URL interna, credenciais embutidas, redirecionamentos para host privado, local file e endpoints metadata. Egress restrito na infraestrutura. TLS no banco/API e criptografia em trânsito. Cookies seguros em auth quando aplicável, CSP/headers de proteção, CORS allowlist, CSRF conforme modelo efetivo de sessão, rate limiting especialmente autenticação, exportação e consultas pagas.

### 12.6 Uploads/arquivos/CSV

Permitir somente formatos e tamanhos aprovados; validar MIME e conteúdo, não confiar em extensão; nome aleatório; sandbox de parsing e limites de expansão ZIP; evitar path traversal, decompression bomb, linhas gigantes e UTF-8 inválido. CSV exportado neutraliza fórmulas iniciadas por `=`, `+`, `-`, `@` e outros prefixos relevantes, conforme política adotada/testada. Upload nunca dispara código shell ou executa fórmulas. Storage com políticas privadas, sem links públicos permanentes.

### 12.7 Segredos e logs

`.env` não comitado, `env.example` apenas placeholders, CI sem credenciais de produção. Não logar senha, JWT, telefones completos, e-mails pessoais, HTML bruto, detalhes Google restritos nem strings de conexão. Redação/minimização e retenção de logs. Auditoria preserva metadados essenciais, sem cópia indiscriminada de payloads. Logs estruturados com `timestamp`, `level`, `service`, `request_id`, `job_id`, `event`, `error_code`, `duration_ms` e `source_id` quando permitido.

---

## 13. TESTES, QA, CONTRATOS E CRITÉRIOS DE ACEITE

### 13.1 Pirâmide de testes

- **Unitário:** normalizadores, regras de CNAE/UF, classificação compartilhado, transições, política por campo e cálculo de chave idempotente.
- **Contrato:** Pydantic/OpenAPI/TypeScript, cliente gerado, erros e versionamento de API; fixture identificada para fontes externas.
- **Integração:** PostgreSQL de teste **separado**, migrations, grants/negativas, `COPY`, FKs, worker, Supabase Auth real quando acesso autorizado.
- **E2E:** Playwright Test para CRM, permissões, filtros, edição/persistência, jobs, erro de servidor, exportação e acessibilidade básica.
- **Segurança:** IDOR, SSRF/redirecionamentos, XSS, SQLi, CSV injection, arquivo malicioso, JWT falso, RLS/grants, secrets, política expirada.
- **Resiliência:** workers concorrentes, lease expirado, retry, checkpoint, cancelamento, 429/CAPTCHA, rede/DB indisponível, scheduler atrasado e interrupção do browser.
- **Carga:** importação em lotes, consumo de memória, throughput e latência p50/p95 sob dados e hardware documentados. Metas são alvos, nunca medições presumidas.

### 13.2 Casos de teste obrigatórios

`TC-001` importar mesma carga duas vezes sem duplicações.  
`TC-002` preservar status/responsável/notas após reimportação.  
`TC-003` dois CNPJs de filiais com mesma raiz permanecem independentes.  
`TC-004` aceitar CNPJ alfanumérico válido e rejeitar DV inválido.  
`TC-005` não persistir campo negado nem em staging/quarentena/log.  
`TC-006` comercial não vê lead de outro responsável por URL direta.  
`TC-007` alteração de papel por user_metadata não concede permissão.  
`TC-008` dois workers não reivindicam o mesmo job ao mesmo tempo.  
`TC-009` contato central de rede não vira telefone direto de todas as filiais.  
`TC-010` perda de lease impede worker antigo de publicar conclusão.  
`TC-011` clique duplo retorna mesmo job, nova coleta legítima posterior funciona.  
`TC-012` URL externa redirecionada para IP privado é bloqueada.  
`TC-013` Chromium não acessa rede interna via subrequest.  
`TC-014` 403/CAPTCHA pausa sem mecanismo de evasão.  
`TC-015` fonte expirada bloqueia nova coleta/uso/exportação.  
`TC-016` evidência expirada remove bruto sem perder trilha mínima permitida.  
`TC-017` exportação respeita supressão criada depois de solicitada.  
`TC-018` rotação HMAC preserva contatos suprimidos.  
`TC-019` CSV contendo fórmula não executa ao abrir no software alvo testado.  
`TC-020` edição comercial concorrente retorna 409 e evita perda de dados.  
`TC-021` dois scheduler ticks não criam ocorrências duplicadas.  
`TC-022` reinício com agenda atrasada não cria avalanche.  
`TC-023` Places não persiste contatos/payloads em banco/cache/logs/Storage.  
`TC-024` fechamento da janela do CRM não interrompe worker.  
`TC-025` fonte com layout alterado gera rejeição rastreável, sem importar lixo.  
`TC-026` queda entre commit e ack não duplica contato.  
`TC-027` estados `não coletado`, `sem contato` e `bloqueado` não se confundem.  
`TC-028` backup restaurado em banco segregado preserva integridade.

Ao receber a especificação v1.5, preservar IDs originais e criar tabela de correspondência, **sem renumerar silenciosamente**. Cada caso contém pré-condições, dados de teste, passos, resultado esperado, resultado obtido, ambiente, evidência e vínculo com RF/RNF.

### 13.3 Padrões de qualidade

Cada PR/módulo precisa lint, tipos, testes afetados e build quando relevante. Cobertura numérica não substitui cenários críticos; não impor percentual arbitrário como selo de segurança. `pytest` não acessa produção nem Internet por padrão; testes reais são opt-in com infraestrutura aprovada. Mock é aceitável para unidade, nunca evidência de integração homologada. Code review de alterações com foco em dados privados, isolamento, transações e idempotência. Verificar comportamento após recarregar a página e restart do processo.

### 13.4 Desempenho e observabilidade

Instrumentar duração de importação, batch size, RAM/CPU, p50/p95 API, filas por status, worker heartbeat, job duration, páginas/min, retries/429, rejeições de parser, contatos únicos elegíveis, campos presentes, precisão de vínculo por amostra humana e custo incremental por fonte. Regras de denominador e período explícitas. **Alvo proposto** de p95 para listagem de 50 itens: 2 s no cenário definido, não promessa até medição. Alertas baseados em thresholds calibrados no piloto; notificações externas somente após destino aprovado.

---

## 14. OPERAÇÃO, CONFIGURAÇÕES E AMBIENTES

### 14.1 Ambientes

`local` (dados sintéticos/banco de desenvolvimento), `test` (banco segregado descartável), `staging` (integrações autorizadas), `production` (após homologação). Variáveis de ambiente diferenciadas com nomes explícitos. Nunca compartilhar credenciais administrativas nem usar banco de produção em testes/CI.

### 14.2 `.env.example` ilustrativo

```dotenv
APP_ENV=development
APP_HOST=127.0.0.1
APP_PORT=8000
LOG_LEVEL=INFO
DATABASE_URL=postgresql+psycopg://<runtime-user>:<password>@<host>:5432/<database>
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_ANON_KEY=<public-client-key>
SUPABASE_JWKS_URL=<authorized-jwks-url>
SUPABASE_JWT_ISSUER=<issuer>
SUPABASE_JWT_AUDIENCE=<audience>
SUPABASE_STORAGE_BUCKET=<private-evidence-bucket>
HMAC_ACTIVE_KEY_ID=<key-id>
HMAC_SECRET=<local-secret-not-in-git>
FRONTEND_ALLOWED_ORIGINS=http://localhost:5173
DEFAULT_TIMEZONE=America/Sao_Paulo
PILOT_UF=<define-before-real-import>
CRAWLER_MAX_PAGES=10
CRAWLER_MAX_CONCURRENCY=2
WORKER_MAX_CONCURRENCY=1
GOOGLE_PLACES_ENABLED=false
GOOGLE_PLACES_API_KEY=<server-only-if-approved>
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<public-client-key>
```

**Importante:** parâmetros exatos de autenticação JWT variam conforme projeto/chave e devem ser verificados em M03. Exemplo não concede permissão nem expõe segredo real. `VITE_*` é público ao navegador; nunca incluir qualquer server key ali. Ajustar a nomenclatura uma única vez e tipar configuração com validação fail-fast.

### 14.3 Processos

`API` (Uvicorn) expõe HTTP; `worker` consome fila PostgreSQL; `scheduler tick` apenas agenda; `web` é build SPA servido por hospedagem HTTP segura. Cada processo tem logs e health próprios. Em Windows usar scripts PowerShell e Agendador de Tarefas com caminho absoluto da venv, working directory e reinício controlado. Em Linux usar unidades systemd com `Restart`, `MemoryMax`, `TasksMax` e timers. Sem Docker, documentar isolamento limitado de Chromium, egress e limites reais disponíveis no SO.

### 14.4 Backup/recovery

Confirmar funcionalidades do **plano Supabase real** e responsabilidade pelos arquivos Storage separadamente; versionar migrations; backups de banco e Storage obedecem políticas distintas. Definir RPO/RTO D-11 e testar restauração em ambiente segregado, com tempo, consistência e perdas observadas. Scripts escritos não constituem teste de restore. Runbooks para fonte fora, 429, layout quebrado, worker preso, DB indisponível, disco cheio, supressão urgente, segredo vazado e limite de orçamento.

### 14.5 Comandos esperados (M01 define os exatos)

```powershell
# Executar na raiz do repositório; comandos de exemplo até M01 fixar empacotamento.
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e .[dev]
.\.venv\Scripts\python.exe -m pytest tests/unit -q
.\.venv\Scripts\python.exe -m uvicorn pharmaleads.api.main:app --reload
npm --prefix apps/web install
npm --prefix apps/web run dev
npm --prefix apps/web run build
# Worker e scheduler: fornecer comandos instaláveis e verificados nos módulos M06/M15.
```

Não informar que comandos acima foram executados apenas por aparecerem nesta especificação.

---

## 15. DECISÕES PENDENTES E GATES

### 15.1 Decisões humanas

| ID | Decisão necessária | Bloqueio principal |
|---|---|---|
| D-01 | CNAEs principais/extra e inclusão de veterinárias | Importação real M05 |
| D-02 | UF/municípios do piloto | M05 real, G1 e homologação |
| D-03 | Canais comerciais autorizados | Exportações/uso comercial |
| D-04 | Orçamento e chave/ativação de APIs pagas | M21 |
| D-05 | Base legal/finalidade/retenção e procedimento LGPD | Uso/exportação real |
| D-06 | Plano/região/capacidade Supabase e conexões | M02 real, importação |
| D-07 | Visibilidade/atribuição por vendedor | M03/M11 finais |
| D-09 | Tamanho de amostra, precisão esperada e revalidação | M22/M24 |
| D-11 | RPO/RTO, cópia do Storage e testes de restore | M23 |
| D-12 | Responsáveis por incidentes, operação e homologação | M23/M24 |
| D-14 | Termos, custos, FieldMask, uso e guarda do Places | M21 |
| D-16 | Aprovação de fontes complementares e campos por ação | M16–M20 |
| D-17 | Canal de registro de contato fornecido pela farmácia | M11 |
| D-18 | Ordem comercial das fontes complementares | M16–M20 |
| D-19 | Fórmula de idempotência, janela lógica e normalização | M06 |
| D-20 | Critério de contato compartilhado e score, calibrados no piloto | M10/M22 |

Registrar novas decisões com data, autor, alternativas, justificativa, impacto, requisitos afetados e validação necessária; não registrar opções como fatos já aprovados.

### 15.2 Gates de liberação

**G1 — depois do M05, antes do M06:** relatório por UF/competência com total elegível, município, telefones e e-mails **declarados** na Receita (não verificados), cobertura de sites de fontes permitidas, matrizes/filiais, percentual e denominador, indicação de e-mail de contabilidade/genérico, duração, memória e tamanho. O usuário avalia se cobertura/custo viabilizam crawler e autoriza seguir ou reduz escopo.

**G2 — depois do M14, antes do M15–M21:** piloto manual demonstrado: contatos únicos **elegíveis** por fonte, vínculos corretos/revisados, casos rejeitados, custo, manutenção de parser, disponibilidade dos workers e erros. Escolher explicitamente quais evoluções merecem investimento. Uma fonte independente pode permanecer fora da implantação sem travar o resto.

**G3 — depois do M23, antes do M24:** matriz RF/RNF atualizada; nenhuma falha P0 conhecida sem tratamento aprovado, P1 documentados; testes negativos críticos; plano e evidência de restauração ou pendência com responsável, infraestrutura e licença conferidas. G3 não é publicação automática.

---

## 16. ROADMAP M00–M24 — PROMPTS EXECUTÁVEIS POR ETAPA

**Regra:** cada item abaixo é uma ordem **somente quando enviado/selecionado individualmente pelo usuário**. Inclua sempre o contexto das seções 0–15. Cada módulo implementa somente seu escopo, valida aceite e gera relatório. *Núcleo do piloto M00–M14; evoluções condicionais M15–M21; fechamento M22–M24.*

### M00 — Contexto, inventário e governança

Inspecione o estado do repositório (sem escrever módulos), leia referências disponíveis, identifique diferenças entre Node/JS anterior e stack-alvo, registre reuso/migração, decisões abertas, riscos e escopo. Crie `docs/CONTEXTO.md`, `PROGRESSO.md`, `DECISOES.md` e `MATRIZ_REQUISITOS.md`. O arquivo v1.5 ausente deve ficar listado como **referência pendente**, nunca recriado por suposição. Gere `AGENTS.md` e rules do Cursor concisas, apontando para o contrato canônico; não duplique o documento inteiro em várias rules. **Aceite:** matriz de trabalho, escolhas explícitas, nenhuma implementação futura, nenhum segredo, inventário e comandos de inspeção reportados.

### M01 — Fundação e shell web

Estruture pacote Python instalável, `venv`, lock/deps, configuração tipada, `.env.example`, Ruff/typecheck/pytest, FastAPI `/health`, `/ready` honesto, middleware `request_id`, tratamento padronizado de erros e shell React/TypeScript/Vite/Tailwind/shadcn compilável. CI inicial para lint/types/test/build e scripts PowerShell. Verifique imports executados fora da pasta do arquivo; não instalar Supabase local com Docker. **Aceite:** API sobe, build web passa, erro de configuração é explícito, não há secrets no git, comandos executados documentados. Não criar dashboard comercial fictício.

### M02 — Supabase e migrations isoladas

Escolha conexão com TLS e modo adequado; implemente Alembic único, schemas e entidades-base, papéis runtime/migration/coleta com grants restritos, índices e constraints, CNPJ 14 posições misto, versão comercial, eventos idempotentes e trilha de auditoria. Inspecione objetos preexistentes e **não toque outras tabelas/projetos**. Teste migrations em banco descartável, permissões negativas, duas filiais e rollback seguro conforme mudança. **Aceite:** integridade e isolamento realmente demonstrados; falta de credencial mantém integração pendente.

### M03 — Supabase Auth e RBAC/ABAC

Valide JWT de verdade, issuer/audience/expiração/chaves, bootstrap seguro do primeiro admin, papéis internos, usuário ativo e `GET /v1/me`; autorizações centralizadas por ação/escopo. Com SQLAlchemy/psycopg não presumir `auth.uid()` automaticamente. Testes: token falso/expirado, acesso cruzado/IDOR, escalada por metadata, usuário inativo, evidência/admin negados, vazamento de contexto de pool. **Aceite:** autorização do backend e negativos executados; UI de login ficará no M13.

### M04 — Políticas de fonte e contratos

Implemente cadastro de fonte, licença, termos, aprovação, vigência e política por **fonte + campo + ação** (`coletar/persistir/exibir/exportar`). Adaptador define capacidades, versão, cursor, origem, checkpoint e observações; importador não precisa fingir ser spider. Bloqueio antes de buscar e antes de gravar, inclusive staging/logs. Adicione endpoints de fontes/políticas protegidos. Use fonte sintética para testes. **Aceite:** pendente bloqueia, permitido apenas exibição não exporta, revogação impede novo uso e há histórico auditado.

### M05 — Receita, recorte e G1

Inspecione publicação/layout oficiais, crie CLI `dry-run/importar/validar/promover/relatorio`, streaming/batches e checksum, dicionário municipal, suporte CNPJ misto e filiais, importação filtrada UF/CNAE, staging/rejeições idempotentes e promoção íntegra. Dados comerciais imutáveis por importação. Medir memória/tempo/quantidade e cobertura de contato declarado e sites já conhecidos, sem chamar de verificado. **Aceite:** fixtures de layout alterado/ZIP hostil/importação parcial/duplicações/CNPJ misto; relatório G1 entregue e **parar para decisão humana**.

### M06 — Fila PostgreSQL e workers

Após G1: fila `SKIP LOCKED`, leases/heartbeat/fencing, tentativa identificada, deduplicação de clique e trabalho ativo, checkpoint, backoff/retry, cancelamento e recuperação. Worker processo independente da API; handlers sintéticos identificados em teste, sem fingir spider operacional. Decisão D-19. Testar dois workers, commit antes de ack, lease vencido, queda de DB, reenvio e janela de tempo. **Aceite:** exatamente uma reivindicação ativa por job, efeitos idempotentes e resultados imunes a worker obsoleto.

### M07 — Descoberta de sites e validação

Entrada manual, candidatos de arquivos/fontes autorizadas e revisor de vínculos; não inventar buscador nacional. Validação SSRF completa em HTTP+redirecionamentos, estratégia de egress/DNS rebinding, confirmação forte por CNPJ e classificação de rede/filial. Requer leitura G1 e lista real de provedores disponíveis. **Aceite:** fluxo candidato→revisão→confirmado, testes ambiguidade, privado/IPv6/redirecionamento e revisão concorrente; URLs arbitrárias bloqueadas sem proteção suficiente.

### M08 — Scrapy institucional HTTP

Spider restrito a domínios confirmados, páginas relevantes, política/robots/termos, `tel/mailto/wa.me/JSON-LD`, limite de profundidade/concorrência/tamanho, 429 `Retry-After`, CAPTCHA/403 pausa, 5xx retry finito, parsing versionado e saída como observação. Integrar worker sem reactor reiniciado invalidamente. **Aceite:** testes com servidor controlado, HTML múltiplos contatos/vazio/quebrado, rede bloqueada, retomada e métricas; nenhuma gravação direta em `comercial.*`.

### M09 — Playwright seletivo

Integre navegador somente para página efetivamente dinâmica autorizada. Limite browser/context/page e memória, proteja requisições secundárias e rede interna, isole cookies, encerre recursos e preserve contrato de observação. Sem esperar com `sleep` cego ou baixar navegador indiscriminadamente por todo crawl. **Aceite:** página JS controlada, timeout, cancelamento, popups/subrequests, ausência de leak de processos, comparação HTTP × browser e instrução Windows/Linux.

### M10 — Consolidação, revisão e evidência

Normalizadores CNPJ/telefone/email/URL; contato por estabelecimento/tipo/valor; N:N com observações reais, revisão de vínculos, dimensões de qualidade, compartilhado N=3 provisório, score heurístico versionado, retenção e Storage privado. Preservar registro mínimo autorizado quando evidência bruta expirar. **Aceite:** dedup por retries, origens múltiplas, central de rede, revogação de fonte, conflito, ausência de vazamento em evidência e nenhuma alteração em lead comercial.

### M11 — API CRM e histórico

Listagem/detalhe/filtros, contato e evidências autorizadas, `PATCH` versionado de lead, timeline append-only, responsável/status e registro de contato realmente informado pela empresa, nunca copiado/reetiquetado de Google. Paginação estável, query parametrizada e escopo por perfil. **Aceite:** filtros combinados, SQLi negada, IDOR negado, conflito 409, métricas de consulta reais e preservação pós-scrape.

### M12 — Privacidade, supressão e exportação

Supressão HMAC com versionamento e rotação comprovada; pedidos LGPD, central de elegibilidade e exportação como job com autenticação e URL efêmera. Revalidar consentimentos/base/licença/supressão antes do download; prevenir CSV formula injection; auditar sem vazar payload. Dependências D-03/D-05. **Aceite:** número bloqueado continua bloqueado após importação e rotação; supressão entre geração/download impede acesso; papel ou fonte indevidos não exportam.

### M13 — Dashboard comercial real

Login Supabase, guards, sidebar, tabela paginada, busca/filtros, ficha, qualidade de contatos, status/responsável, atividade, histórico, evidência, exportação, revisão/privacidade para papéis correspondentes. UI profissional e responsiva com estados de erro/retry/vazio e valores reais; sem placeholder operacional. Cliente gerado via OpenAPI e testes componente/E2E. **Aceite:** mudança persiste após reload, 401/403/409 tratados, acessibilidade/teclado, desktop/mobile e fluxo de exportação autorizado.

### M14 — Coleta manual no dashboard e G2

Endpoints de job (criar/listar/detalhar/reprocessar/cancelar) com 202, UI Nova coleta para operador/admin, fonte aprovada/escopo/limites, monitor real, estado do worker, polling controlado, cancelamento cooperativo. Sem executor frontend. **Aceite:** E2E job→worker→observação→consolidação→painel; duplo clique idempotente, 403 comercial, recuperação pós-browser; relatório G2 e **parar para aprovação das evoluções**.

### M15 — Agendas automáticas (opcional após G2)

CRUD restrito de agendas, timezone IANA, recorrência diária/semanal/mensal, scheduler tick atômico, ocorrências únicas, atraso/catch-up, pausa, histórico e configuração do Agendador de Tarefas/cron/systemd. Compartilhar fila M06 e não adicionar Places. **Aceite:** ticks paralelos, reinício, horário ambíguo, dias 29/30/31, conflito com manual e fechamento do browser.

### M16 — Farmácia Popular (opcional após G2)

Identificar e revisar fonte oficial vigente e termos; parser versionado e carga por competência, vínculo por CNPJ completo, rejeição de ausentes/ambíguos, qualificação visível no CRM. Não prometer telefone nem inferir descredenciamento por ausência. **Aceite:** layout/versão, filial, reexecução, relatório de ganho de qualificação e fonte realmente aprovada ou claramente inativa.

### M17 — Redes/franquias (opcional após G2)

Um parser por domínio real aprovado, extração de lojas/localizadores e vínculo por CNPJ/endereço com revisão, central compartilhada distinta do contato da filial. Sem seletores de produção fictícios. **Aceite:** lojas iguais em redes, múltiplas filiais, paginação, alteração de layout, idempotência e cobertura amostral honesta.

### M18 — Anvisa (opcional após G2)

Conferir mecanismo autorizado vigente. Se API/dataset oficial permitir automação, implementar contrato real; senão fluxo de verificação manual rastreável. Diferenciar `não consultado`, `não localizado`, `indisponível`, `verificado`. Não equiparar não encontrado a irregular. **Aceite:** autorização, casos ambíguos, autoria e evidência sem afirmar licença sanitária ampla.

### M19 — CSV/fornecedores licenciados (opcional após G2)

Upload seguro, preview/mapeamento de colunas, dry-run, relatórios, streaming, fonte e licença por campo, CNPJ textual misto, rejeições, dedup e observações. Não substituir status comercial. **Aceite:** licença expirada, CSV formula, duplicações, encoding, import interrompido e dados sem permissão descartados antes de staging.

### M20 — OpenStreetMap (opcional após G2)

Rever ODbL/atribuição e limites de fonte de extrato/API; piloto regional, dados geográficos de origem separados, vínculo de candidate a estabelecimento, sem pressupor CNPJ nem contato verificado. **Aceite:** tags sem CNPJ, duplicação, ambiguidade, licença bloqueante e desligamento seguro.

### M21 — Google Places separado (opcional após G2 e aprovação)

Places API (New) em consulta manual com Text Search/Nearby/Details conforme contrato vigente, field masks mínimos, cotas por usuário, chave server-only, atribuições, custo/budget concorrente, cache transitório permitido, `place_id` isolado. Proibida importação/escrita de contatos em base própria, logs, Storage e exportações. **Aceite:** fixtures/indisponibilidade/budget, nenhuma persistência restrita, aprovação de termos/conta/faturamento antes de produção.

### M22 — Métricas e alertas

Mínimo pode começar após M14; versão completa conforme evoluções ativadas. Métricas de cobertura por UF/competência, contato elegível e compartilhado, fonte e ganho incremental, revisão, worker, atrasos, parser, custos/latência e amostras humanas. Alertas deduplicados sem destinatários inventados. **Aceite:** denominador e período explícitos, precisão `não medida` sem rótulos, p50/p95 medidos, fonte com queda detectada.

### M23 — Operação sem Docker, segurança e backup

Scripts PowerShell/systemd, processos supervisionados, limites de memória e navegador, TLS/CORS, health/readiness, acesso a secrets, egress seguro, runbooks, políticas de backup banco/Storage, restore de teste e orçamento. Não publicar sem escopo aprovado. **Aceite:** start/stop/restart, scheduler navegador fechado, falha sem loops, logs sem segredo e restore comprovado ou pendente registrado. Solicitar G3 após evidências.

### M24 — Homologação, auditoria e piloto

Após G3: cruzar cada RF/RNF original conferido com implementação, testes e evidências; fluxo ponta a ponta Receita→site→job→contato→CRM→supressão→exportação; agendas somente se M15 implementado. Testes TC-001+ e segurança. Amostra inicial operacional ~100; para avaliar qualidade, propor amostra **estratificada de 200–300** (redes/independentes) e declarar incerteza/limites, sem inferir precisão nacional. Classificar P0/P1/P2, custos, limites e parecer `iniciar piloto / manter piloto / expandir`. Produção e abrangência nacional exigem autorização e dados reais.

---

## 17. CONTROLE DE CONTEXTO E ECONOMIA DE TOKENS NO CURSOR

1. Ao iniciar uma sessão, leia nesta ordem `docs/CONTEXTO.md`, `PROGRESSO.md`, `DECISOES.md`, `MATRIZ_REQUISITOS.md` e arquivos diretamente relacionados ao módulo; não escaneie todo o repositório a cada mensagem.
2. Mantenha `.cursor/rules` curtas, por domínio e com regras de referência, não cópias integrais da especificação. `AGENTS.md` resume comandos, arquitetura, prioridades e como localizar documentação.
3. Antes de alterar, liste arquivos afetados e verifique `git status`/diff. Não formate ou renomeie pastas alheias sem necessidade. Evite commits automáticos quando não solicitados.
4. Edite o menor conjunto necessário. Teste primeiro arquivos afetados, depois módulos integrados conforme gates. Evite gerar centenas de stubs e não recarregue arquivos longos sem alteração.
5. Guarde decisões, estados reais e comandos verificáveis nos docs; outra conversa deve continuar sem recontar o histórico inteiro.
6. Se resposta do Cursor não couber, entregue código funcional em etapas menores **sem mudar o contrato**, com estado parcial explícito. Não marcar como pronto por economizar contexto.

---

## 18. PROMPTS DE CONTROLE PARA COPIAR NO CURSOR

### Inicialização M00

> Leia `PHARMALEADS_ESPECIFICACAO_DEFINITIVA_CURSOR.md` e os dois roteiros de referência, se disponíveis. Inspecione o repositório real. Execute **somente o M00** conforme seções 0, 15 e 16. Não construa a API, frontend, banco ou scrapers neste comando. Registre arquitetura, riscos, decisões pendentes, matriz de requisitos e reaproveitamento de código existente. Entregue relatório de fim de módulo e pare.

### Execução de uma etapa

> Execute **somente o módulo MXX** da seção 16 da especificação mestra. Antes de editar, leia `docs/PROGRESSO.md`, `docs/DECISOES.md`, as dependências, o código relevante e critérios de aceite. Faça a menor implementação completa e testável desse módulo, sem antecipar módulos seguintes. Atualize documentação com evidências e comandos PowerShell reais. Não diga que passou teste não executado. Pare ao concluir.

### Retomada

> Continue a partir do estado real do repositório. Leia `CONTEXTO`, `PROGRESSO`, `DECISOES` e `MATRIZ_REQUISITOS`. Informe último módulo validado, gates aprovados, bloqueios, arquivos afetados e próxima etapa solicitada. Não reinicie nem repita código; não avance sem meu comando explícito.

### Revisão técnica

> Não implemente funcionalidades novas. Audite o módulo recém-concluído contra a especificação mestra e os testes executados. Procure escopo faltante, mocks mascarando integração, falhas de autorização, SQL grants/RLS reais, vazamento de logs, SSRF, transações longas, idempotência, retries e divergência de docs. Classifique P0/P1/P2, cite arquivo/linha, reproduza quando possível, corrija apenas P0/P1 do módulo e rode testes afetados.

### Correção controlada

> Não avance de módulo. Reproduza [DESCREVER FALHA], identifique causa demonstrável, altere o menor conjunto de arquivos, preserve estrutura visual e partes funcionais, rode testes afetados e registre causa, diff, resultado, riscos e pendências em `PROGRESSO.md`. Não esconda erro com retorno fixo, mock em produção ou `except: pass`.

### Registrar decisão

> Registre a decisão [D-XX: TEXTO] em `docs/DECISOES.md` com autor, data, motivo, módulos bloqueados/desbloqueados, migrações e testes necessários. Não implemente mudança de código automaticamente.

---

## 19. DEFINIÇÃO DE PRONTO E PROIBIÇÕES FINAIS

Uma funcionalidade está **documentada** quando tem requisitos e decisões; **implementada** quando há código executável; **testada localmente** quando os testes apropriados foram realmente executados; **integrada** quando serviço real aprovado respondeu com evidência; **homologada** quando critérios e aceites humanos do ambiente previsto foram cumpridos. Estes estados não são sinônimos.

**Não faça:** varredura nacional não aprovada; copiar telefone da Places API para banco próprio; burlar CAPTCHA; usar RLS como argumento vazio; executar scraper no FastAPI; manter lock SQL durante rede; reescrever CRM a cada módulo; permitir `service_role` no browser; tratar CNPJ como inteiro; permitir scraper alterar status; usar dados simulados disfarçados como reais; definir licenças por palpite; declarar API externa ou teste como realizado sem evidência; publicar produção por conta própria.

**Faça:** entregar um fluxo ponta a ponta comprovável, auditar origem e decisões, medir cobertura real antes de escalar, distinguir contato cadastral de verificado, limitar recursos de coletores, planejar recuperação, preservar o histórico comercial e exigir aceite nos gates.

**Comando inicial autorizado por este documento:** **M00, exclusivamente**. Qualquer trabalho posterior aguarda pedido específico do usuário.

---

## 20. REFERÊNCIAS OFICIAIS A CONFERIR NA IMPLEMENTAÇÃO

Estas referências são pontos de verificação de requisitos externos mutáveis, não prova de licenças individuais aprovadas:

- Receita Federal — CNPJ alfanumérico: https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/cnpj-alfanumerico
- Receita Federal — dados abertos: https://www.gov.br/receitafederal/dados
- Supabase — conexão PostgreSQL: https://supabase.com/docs/guides/database/connecting-to-postgres
- Supabase — Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase — back-ups: https://supabase.com/docs/guides/platform/backups
- Google Places — políticas e atribuições: https://developers.google.com/maps/documentation/places/web-service/policies
- Google Places — identificação: https://developers.google.com/maps/documentation/places/web-service/place-id
- Scrapy: https://docs.scrapy.org/en/latest/
- scrapy-playwright: https://github.com/scrapy-plugins/scrapy-playwright
- FastAPI: https://fastapi.tiangolo.com/
- ANPD — orientações de proteção de dados pessoais: https://www.gov.br/anpd/pt-br

**Nota de rastreabilidade:** este documento integra e aprofunda os dois roteiros disponibilizados. Onde havia opções ou lacunas, identifica propostas e decisões pendentes. A especificação v1.5 original continua pendente de leitura e comparação linha a linha. Nenhuma integração, teste, orçamento ou licença é considerado aprovado somente porque foi descrito aqui.

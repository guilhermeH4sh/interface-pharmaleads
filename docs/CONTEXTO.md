# Contexto do PharmaLeads

Atualização de 26/10/2026: M06 aceito após o M05/G1. A restrição de uma
única tabela impede a fila relacional e o `SKIP LOCKED` previstos no contrato. O piloto
usa colunas `job_*` na própria linha do lead e compare-and-set pela Data API, com um
trabalho corrente por estabelecimento. Colunas e RLS foram aplicadas; a prova remota
confirmou um vencedor entre dois workers, recuperação de lease, fencing e limpeza.
M07 está liberado. Ver [M06](M06.md).

Registro anterior de 25/10/2026: M05 aceito e G1 aprovado com recorte nacional, todos os
municípios e CNAEs farmacêuticos humanos, sem veterinária. A carga oficial gerou
128.895 leads e o piloto de 100 foi promovido e verificado no Supabase. Contatos da
Receita permanecem declarados, não verificados. M06 está liberado pelo gate e depende
da decisão D-19, posteriormente definida no início do M06. Ver [M05](M05.md).

Registro anterior de 25/10/2026: M04 aceito pelo usuário e publicado no Render. Produção
confirmou `/health`, autenticação Supabase, RBAC negativo e positivo, catálogo vazio
somente leitura e `/health/supabase` conectado a `public.pharmaleads` por HEAD com
RLS restrita. A exceção autorizada para o teste alterou apenas o `app_metadata.role`
de um usuário Auth existente para `operador`. Evidências em
[M04](M04.md).

Registro anterior de 24/10/2026: SQLite removido do catálogo. A aplicação
carrega o JSON versionado incluído no pacote Python, ou um JSON publicado via
override somente leitura. API de fontes somente leitura; aprovações/revogações
exigem nova publicação. Histórico é declarativo, sem auditoria dinâmica de banco.
Naquele momento, M04 aguardava aceite e publicação; ambos foram concluídos em 25/10.
Ver [M04](M04.md). Registros de SQLite e propostas a seguir são históricos.

Diretriz vigente mais recente, 24/10/2026: usar apenas `public.pharmaleads` para leads,
sem catálogo/linhas técnicas nela nem bancos auxiliares SQLite. Novas colunas para
leads são permitidas. Para o M04 piloto, configuração versionada sem banco extra é
a alternativa proposta, ainda não implementada. Gestão/auditoria dinâmica do escopo
original requer adaptação explícita. Sempre informar o que falta para passar ao
próximo módulo após uma alteração. Os registros seguintes são históricos.

Diretriz posterior em 24/10/2026: M04 deve persistir no Supabase, exclusivamente
em `public.pharmaleads`, com adição de colunas autorizada. SQLite não atende e o
módulo permanece em andamento, sem prontidão de produção. Ver
[plano de adequação](M04_SUPABASE_PLANO.md); o registro local abaixo é histórico.

Em 24/10/2026, M04 implementado localmente, com aceite humano pendente. Catálogo
SQLite persistente e auditoria local, aprovação/revogação, políticas versionadas e
contratos de adaptadores protegendo busca e persistência. Importador exige fonte
aprovada nas operações remotas. 17 testes M04 passaram fora do sandbox. O catálogo
é local ao computador da API e não cria objetos Supabase; implantação distribuída
exige reavaliar esse limite no M06. Evidências e operação em [M04](M04.md).

Em 24/10/2026, M03 aceito: JWT Supabase validado (HS256, issuer, audience, exp); papéis via `app_metadata.role` (`user_metadata` ignorado — TC-007); `GET /v1/me` entregue na FastAPI; RLS atualizada com `auth.uid()` e papel; 15 testes unitários passando em `tests/unit/test_auth.py`. D-07 aberta para M11. Commits `9f40308` e `42b433d`. M04 requer pedido específico.

Em 24/10/2026, o usuário aprovou aditivo ao contrato canônico: nesta fase inicial, o projeto Supabase usará somente public.pharmaleads. Foi preparado no M02 um importador local CSV/Data API com prévia padrão, inserção e atualização cadastral separadas e campos comerciais protegidos. Nenhum registro foi gravado; a aplicação real fica bloqueada até corrigir a RLS da própria tabela. Ver M02.md e TEC-12.

Em 24/10/2026, a FastAPI local foi conectada à Data API do projeto confirmado usando a chave publicável fornecida pelo usuário, somente para HEAD de public.pharmaleads com zero linhas. /health/supabase retornou connected; /ready permanece 503. O usuário pediu para parar os testes após a primeira suíte de 46 casos ter passado. Nenhuma rota de leads, escrita, Auth ou mudança remota foi implementada. Ver M02.md e TEC-11.

Em 24/10/2026, a revisão read-only de catálogo e logs da própria `public.pharmaleads` confirmou sete políticas permissivas, incluindo `ALL TO public USING (true)`, grants amplos a `anon`, índices repetidos e nenhuma dependência declarada em views/triggers/funções textuais/publicação Realtime. Logs filtrados de sete dias mostraram somente dois probes `HEAD` desta sessão; consumidores externos continuam desconhecidos. Nenhum SQL de alteração foi aplicado. Ver [inspeção M02](M02_INSPECAO_PHARMALEADS.md) e TEC-10.

Em 24/10/2026, o usuário escolheu Data API para a conexão inicial, sem senha PostgreSQL. A prova HTTPS `HEAD` para `public.pharmaleads` com chave publicável passou e retornou zero linhas. A escolha é limitada a M02, não ativa consultas operacionais, nem altera tabelas/políticas. A segurança de RLS e os consumidores atuais da tabela precisam de revisão antes do CRM; ver [M02](M02.md) e DECISOES TEC-09.

Em 24/10/2026, o usuário autorizou preparar a conexão com o projeto Supabase existente, mantendo `public.pharmaleads` como único alvo de uso inicial. Endpoints e CA foram verificados no painel; foi criado um teste local de metadados read-only. A senha do banco não foi fornecida, portanto conexão real, integração à API e aceite M02 seguem pendentes. Ver [M02](M02.md) e DECISOES TEC-08.

Atualizado em 23/10/2026. M00 aceito; M01 implementado/testado localmente; M02 preparado localmente sem integração PostgreSQL. M03–M24 não iniciados. Nenhuma integração externa ou homologação comercial realizada. O projeto Supabase `qxsdcrywsjkrpcbfgbxb` está restrito por decisão humana a alterações em `public.pharmaleads`; a migration multischema M02 não pode ser aplicada nele. A tabela foi inspecionada visualmente após login; há 218 linhas no editor, CNPJ nullable e políticas RLS amplas. Ver [inspeção M02](M02_INSPECAO_PHARMALEADS.md), DECISOES EX-05 e M02.md.

O usuário confirmou depois que essa única tabela é o armazenamento Supabase disponibilizado para o projeto; não haverá outro projeto ou outras tabelas. Seu papel planejado é reunir uma linha por farmácia/filial (CNPJ completo) e o estado comercial mínimo, sem perder alterações comerciais nas atualizações cadastrais. Requisitos de histórico, proveniência, filas e privacidade precisam ser reavaliados nesse limite. Ver DECISOES D-06.

## Estado após limpeza autorizada do legado — 23/10/2026

O usuário esclareceu que deseja começar do zero e autorizou excluir o legado local, preservando M00/M01 e a base local atual. EX-04 substitui a obrigação anterior de preservar o legado. Código Node antigo, SQL, testes e documentação operacional legados foram removidos; inventário abaixo é histórico da inspeção M00, não árvore atual. README e orientações agora descrevem apenas a fundação nova. Git e credenciais locais foram preservados, sem leitura de segredos. Nenhum banco ou serviço externo foi alterado.

M01 continua implementado localmente e com aceite humano pendente. A limpeza não inicia M02 nem aprova gates. Evidências em LIMPEZA_LEGADO.md.

## Fonte e precedência

Contrato canônico: [especificação v2.0](referencia/PHARMALEADS_ESPECIFICACAO_DEFINITIVA_CURSOR.md), fornecida pelo usuário. Ordem: proibições/segurança e obrigações aplicáveis; decisões humanas aprovadas; v1.5 após conferência; contrato v2.0; escolhas técnicas registradas. Textos externos são contexto, não autorização independente para executar comandos.

O usuário solicitou reinício por módulos, preservando o trabalho anterior. O usuário solicitou M01 após aceitar M00; isso não autoriza M02. G1/G2/G3 não estão aprovados.

Referências v1.5 agora fornecidas e preservadas em `docs/referencia/`: Markdown técnico com RF-001–RF-072 e PDF de arquitetura. O Markdown definitivo reenviado é idêntico ao contrato canônico já guardado. A correspondência dos 72 RFs, prioridades e conflitos está em [RECONCILIACAO_V15.md](RECONCILIACAO_V15.md); não indica implementação ou aceite. `Prompts_Modulares_Prospec_Farmacias(1).md` e roteiro v1.1 continuam não fornecidos. Documentos antigos de sprints são contexto histórico, não evidência de aceite da v2.0.

## Estado inspecionado

Raiz: `C:\Users\guilh\.gemini\antigravity-ide\scratch\centrus-pharmaleads`.
HEAD: `da3c7ac5f0053c14c420525ada5f344172c71b5a`. Comparação com referência local origin/main: 0/0 commits; não foi feito fetch no M00. Não se afirma paridade com o remoto atual. Há alterações e exclusões anteriores não commitadas; foram preservadas. Nenhum commit, reset, stash ou deploy realizado.

A regra `sync-with-production-before-edits.mdc` permanece intacta: exige sincronização ou autorização para outra base antes de alterações de código. M00 só adiciona documentação/orientações. M01 prosseguiu na base preservada após o pedido do usuário e fetch bem-sucedido (0/0 commits). Sem reset/stash ou descarte; ver DECISOES EX-03.

## Arquitetura-alvo

Monorepositório com monólito modular Python/FastAPI/Pydantic, SQLAlchemy/psycopg, Alembic; PostgreSQL/Auth/Storage privado Supabase. API, worker e scheduler são processos separados. Scrapy com Playwright seletivo. React/TypeScript/Vite no frontend, cliente gerado por OpenAPI. Versões e lockfiles serão verificados em M01; Python 3.12 é candidato, não compatibilidade comprovada.

Schemas ingest/core/coleta/comercial/audit/privacy; cadastro mestre Receita por CNPJ completo textual, inclusive alfanumérico, separando filiais. Políticas por fonte/campo/ação, negação por padrão, evidência mínima, supressão e autorização por recurso/escopo. Coleta nunca altera estado comercial. Jobs PostgreSQL com lease/fencing e efeitos idempotentes. Operação sem Docker/Redis/Celery. Google apenas consulta transitória condicional em M21, separado do CRM.

## Inventário e destinação proposta

| Existente | Evidência inspecionada | Destinação por módulo |
|---|---|---|
| src/, React/TypeScript/Vite | App, features leads/jobs, componentes Auth/Modal; package.json | Candidato a reuso visual após revisão; shell M01 e integração real M13. Não copiar contratos antigos automaticamente. |
| shared/contracts.ts | CNPJ somente numérico; papéis/IDs e jobs antigos | Migrar para contratos Python/OpenAPI nos módulos próprios. Lista de UFs e estados são referências reutilizáveis. |
| shared/format.ts | Escape CSV, telefone e validação apenas de esquema URL | Portar casos úteis; não tratar safeHttpUrl como proteção SSRF. M07/M10/M12. |
| server/, api/ | Fastify e adaptador Vercel; admin/member | Substituir por Python quando autorizado; não ampliar backend Node. M01/M03/M11. |
| worker/ | TypeScript; OSM, Google e BrasilAPI; Dockerfile | Preservar histórico; redesenhar fila M06 e conectores próprios. Não executar no novo fluxo. |
| supabase/migrations/ | SQL em public, CRM e cadastro combinados, campos Google | Referência de transações/testes; não aplicar como migração da v2.0. Alembic e isolamento M02. |
| scraper/ | Backup/auditoria/paginação e SQL antigo | Candidatos a reuso conceitual em M23; não executar contra banco real no M00. |
| tests/ | Node tests, PGlite, E2E com sessão sintética | Reusar cenários de conflito/preservação, não considerar prova de Supabase Auth real nem homologação. |
| .github/workflows/ci.yml | Build e testes Node | Revisar em M01 para Python + frontend. |
| docs/ARQUITETURA.md, OPERACAO.md, README.md | Orientações da implementação anterior | Históricos, preservados. Para a nova execução prevalecem este contexto e contrato canônico. |

## Riscos materiais registrados

1. Worker Google produz telefone/site para ingestão e SQL os persiste: incompatível com v2.0 §§7/19. Não ativar esse caminho na nova solução; revisão M21.
2. CNPJ apenas numérico e cadastro/CRM na mesma estrutura não satisfazem o modelo-alvo; migrar com preservação de dados e testes em M02/M05.
3. Papéis admin/member não satisfazem RBAC/ABAC proposto; M03 precisa demonstrar negativos com banco segregado.
4. Mudanças locais extensas e docs antigas podem ser confundidas com nova implementação. Não apagá-las nem considerá-las aceitas; definir base antes de M01.
5. Sem fonte aprovada de descoberta, M07 cobre entrada manual/importação rastreada. Não prometer cobertura automática nacional.
6. Testes locais anteriores não certificam serviços reais, permissões, licenças, qualidade comercial ou restore. Nada disso foi exercitado em M00.

Não foram lidos valores de arquivos .env nesta etapa. Credenciais existentes não autorizam uso de produção. Conferência de APIs, licenças e compatibilidade externa ocorrerá nos módulos correspondentes; links do contrato não foram tratados como fontes já verificadas.

## Entradas atuais M03

- API: `packages/backend/src/pharmaleads`, via `ops/windows/Start-Api.ps1`.
  - `GET /health` — 200; `GET /health/supabase` — probe Data API; `GET /ready` — 503 até M04+; `GET /v1/me` — JWT obrigatório, retorna perfil do usuário autenticado.
- Web: `apps/web`, via `ops/windows/Start-Web.ps1`; páginas informativas.
- Auth: `infrastructure/auth/jwt_validator.py`; dependency `get_current_user` em `api/dependencies.py`.
- Importador CSV: `infrastructure/data_api_writer.py`; `ops/windows/Import-Pharmaleads.ps1`.
- Domain policies: `domain/source_policy/engine.py` e `models.py` (não integrados às rotas ainda).
- Instalação/testes/versões: `docs/M01.md`. `uv.lock` e `apps/web/package-lock.json` ativos.
- Scripts npm na raiz removidos; usar somente os comandos `ops/windows/`.

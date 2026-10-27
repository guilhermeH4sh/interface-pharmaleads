# Decisões

Data: 23/10/2026. Autor do registro: Codex. Aprovação comercial/homologação: usuário, ainda pendente salvo instruções expressas abaixo.

## Diretrizes da execução

- Diretriz humana — 24/10/2026, piloto mínimo: usar exclusivamente `public.pharmaleads` para persistir leads. Não criar outras tabelas nem misturar linhas de catálogo com farmácias. Adição de colunas para os leads é permitida. O restante deve funcionar sem banco auxiliar. Isso descarta a solução SQLite M04 e a proposta de linha técnica; manter CNPJ obrigatório para farmácias. Após cada alteração informar testes, estado e pendências para o próximo módulo.
- Decisão aceita para o M04 piloto: fontes e políticas como configuração versionada distribuída com a aplicação, leitura autenticada, aprovação/revogação por revisão e publicação da configuração. Histórico por versões/revisões; não equivale a auditoria operacional dinâmica. Gestão mutável via API permanece fora do piloto.
- Execução autorizada em 24/10/2026 e aceita em 25/10/2026: SQLite substituído por configuração JSON validada no pacote; rotas de mutação removidas; API e importador usam o carregador somente leitura. Publicação no Render e autenticação/RBAC/conexão Supabase validadas; ver docs/M04.md.
- Exceção humana pontual em 25/10/2026: autorizado adicionar `app_metadata.role=operador` a um único usuário existente do Supabase Auth para o teste positivo de RBAC. Nenhuma tabela, política ou objeto foi criado; a exceção não autoriza alterações futuras em `auth.users` nem uso de chave secreta no cliente.

- EX-01 — Executar somente M00 nesta etapa, conforme pedido humano de trabalho módulo a módulo e contrato fornecido. Alternativa rejeitada: implementar tudo. Impacto: M01–M24 aguardam solicitação específica; nenhum gate aprovado.
- EX-02 — Preservar código e mudanças anteriores; registrar reuso/migração sem exclusões. Motivo: reinício controlado e inventário exigido em M00. A organização física da nova base será decidida antes de editar código em M01. Não implica aprovação de arquitetura legada.
- TEC-01 — Contrato v2.0 copiado integralmente em docs/referencia; quatro documentos de acompanhamento em docs/. Escolha de organização documental pelo agente, sem mudança de requisitos. Validação: igualdade da cópia e referências locais.
- TEC-02 — Stack prescrita é alvo, não integração aprovada. Python/FastAPI e Alembic substituirão os caminhos Node/SQL antigos somente nos módulos autorizados. Pyproject raiz e estratégia de lock são propostas a confirmar em M01; não foram criados ambientes, dependências ou migrations.

## Decisões humanas abertas

Todas as linhas abaixo estão PENDENTES, sem aprovador/data de aprovação. Texto e IDs preservados da seção 15.1; lacunas na numeração não foram preenchidas por suposição. Nenhum segredo deve ser enviado por chat.

| ID | Decisão necessária | Bloqueio principal |
|---|---|---|
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
| D-20 | Critério de contato compartilhado e score, calibrados no piloto | M10/M22 |

## M05 — D-01 e D-02 resolvidas (25/10/2026)

Decisão humana: o piloto cobre todas as 27 UFs e todos os municípios. Entram todos
os CNAEs principais especificamente farmacêuticos de uso humano; atividades
veterinárias ficam excluídas. A implementação explicita nove CNAEs de fabricação,
preparação, atacado e varejo humano e exclui `2122000`, `4644302` e `4771704`.
CNAE secundário não concede elegibilidade nesta primeira carga, evitando incluir
estabelecimentos de outro setor que apenas mantenham atividade farmacêutica acessória.

## M05 — piloto Supabase executado (25/10/2026)

Decisão humana: promover 100 estabelecimentos para validar todas as conexões. A
amostra determinística cobre 27 UFs e 9 CNAEs. A Data API usou chave publicável e
JWT curto de `app_metadata.role=operador`, sem `service_role`. `authenticated`
manteve `SELECT`; `INSERT` e `UPDATE` foram limitados às colunas cadastrais. Políticas RLS do
operador foram aplicadas somente em `public.pharmaleads`. Resultado confirmado:
100 linhas gravadas e 100 relidas. Por decisão humana posterior, os IDs do piloto
foram renumerados de 1 a 100 e o próximo identity definido como 101 por script
transacional restrito à tabela.

Impacto: D-01 e D-02 deixam de bloquear o pipeline. D-06 continua exigindo medir o
recorte real e a capacidade antes de promover para a única tabela permitida.

## M05 aceito e G1 aprovado (25/10/2026)

Decisão humana: após revisar o relatório da competência 2026-10, a cobertura nacional,
o piloto real de 100 linhas e os recursos medidos, o usuário aceitou o M05 e aprovou
o G1. A decisão reconhece que telefone e e-mail da Receita são apenas declarados e
serão verificados nos módulos M07–M10. M06 deixa de ser bloqueado pelo gate; D-19
continua pendente. A promoção dos outros 128.795 leads não foi autorizada por este aceite.

## M06 — D-19 definida para o piloto (26/10/2026)

Decisão técnica dentro da autorização para continuar: a chave idempotente é SHA-256
versionado sobre CNPJ canônico, tipo minúsculo e payload JSON canônico. Trabalho ativo
igual sempre deduplica; após estado terminal, a mesma solicitação deduplica por 15
minutos e depois pode gerar novo UUID. Lease inicial de 60 segundos, cinco tentativas
e backoff exponencial limitado a cinco minutos. Mudança de proprietário incrementa o
fencing token; heartbeat e conclusão exigem worker, fence e lease ainda válidos.

Como somente `public.pharmaleads` pode existir, cada lead guarda um único trabalho
corrente em colunas `job_*`. O adaptador usa compare-and-set pela Data API em vez de
`SKIP LOCKED`; não existe histórico relacional completo nem dois tipos simultâneos no
mesmo lead. Esta redução deve permanecer visível e não equivale ao modelo completo do
contrato. As 16 colunas `job_*` foram aplicadas pelo usuário em 26/10/2026; RLS/grants
foram inspecionados. Após confirmação humana do impacto, a política geral de UPDATE
foi limitada a `admin`, preservando a política específica de `operador`; gestor e
responsável ficam temporariamente sem UPDATE até M11. Concorrência real aguarda validação.

Cada aprovação futura deve incluir autor, data, motivo, alternativas, impacto/módulos, migrações e testes necessários. Não exigir todas as decisões comerciais para M01 local.

## Conflitos e reconciliação

- CF-01: Node/worker/Docker legados versus Python e sem Docker. Preservados como histórico; proibir ampliação do backend Node na nova execução. Resolver migração nos módulos correspondentes.
- CF-02: persistência Google legada versus consulta transitória na v2.0. Não executar coletor antigo como parte do novo projeto; mudança de código fica para módulo solicitado, sem afirmar que está tecnicamente desativado.
- CF-03: na inspeção M00, Markdown v1.5 e roteiros não estavam disponíveis. O usuário forneceu posteriormente Markdown e PDF v1.5; RF-001–RF-072 foram mapeados em RECONCILIACAO_V15.md. Agendas RF-047–050 e Farmácia Popular RF-061 são P0 na v1.5, mas evoluções condicionais pós-G2 na v2.0; sequenciamento v2.0 prevalece até decisão humana. Os roteiros v1.0/v1.1 permanecem indisponíveis. Não renumerar TCs.
- CF-04: regra existente de sincronização exige base limpa/igual ao remoto ou autorização de outra base antes de código. M00 documental preserva working tree; M01 precisa resolver base concreta, sem reset/stash automáticos. Consulta local origin/main não substitui fetch.

## Gates

| Gate | Momento | Evidência e aprovação | Estado |
|---|---|---|---|
| G1 | após M05, antes M06 | cobertura declarada, denominadores, filiais, recursos/custo e decisão humana de viabilidade | **aprovado pelo usuário em 25/10/2026** |
| G2 | após M14, antes M15–M21 | fluxo manual real, contatos elegíveis, qualidade, custo/erros; selecionar evoluções | não submetido |
| G3 | após M23, antes M24 | matriz, negativos, riscos, infraestrutura/licenças e restore ou pendência com responsável | não submetido |

G3 não autoriza publicação automática. Integração real, coleta massiva, APIs pagas e produção dependem do escopo humano aprovado.

## M01 — decisões de execução (23/10/2026)

- EX-03 — Usuário aceitou M00 ("ok") e autorizou iniciar o próximo módulo ("Pode iniciar") após ser informado das mudanças locais. Execução restrita ao M01 na base local preservada; nenhum reset, stash, commit ou migração. `git fetch origin` executado com sucesso; comparação HEAD...origin/main retornou 0/0. A árvore continua com alterações anteriores; não foi declarada limpa.
- TEC-03 — Uma distribuição Python com pyproject na raiz e src layout em packages/backend; uv.lock é a estratégia única Python. npm/lock próprio em apps/web mantém instalação web independente do legado. Motivo: preservar alterações anteriores sem executar backend Node nem dependências antigas nos comandos M01.
- TEC-04 — Versões resolvidas e ensaiadas conforme M01.md; Python 3.12 e Node 24. SQLAlchemy/Alembic/Scrapy e outros componentes de módulos futuros ainda não foram instalados. mypy escolhido, sem pyright concorrente.
- TEC-05 — Configuração nova usa PHARMALEADS_* de processo e não carrega .env legado. Rejeita ambiente de produção e bind externo nesta etapa. /ready responde 503 até verificações reais de M02/M03. Isso evita prontidão falsa; não é erro pendente da fundação.
- TEC-06 — Shell informativo isolado com duas páginas; shadcn/Radix Button por instalação manual. Sem protótipo de CRM, métricas artificiais ou credenciais web. Bibliotecas de consultas/formulários comerciais aguardam seus casos de uso.

Decisões comerciais D-xx abertas e G2/G3 continuam pendentes. Nenhuma licença, integração real ou publicação adicional foi aprovada por estas escolhas técnicas.

## EX-04 — Exclusão local do legado (23/10/2026)

Decisão humana: usuário esclareceu que desejava começar do zero e apagar o sistema legado; após proposta concreta de exclusão com preservação de M00/M01 e do histórico Git, respondeu "pode continuar". Autorizada a base local atual com alterações. Esta decisão substitui EX-02 e a preservação do legado prevista em EX-03 apenas quanto aos arquivos antigos explicitamente removidos; demais arquivos permanecem preservados.

Motivo: manter somente a nova arquitetura no checkout. Alternativa rejeitada: manter os dois sistemas na mesma árvore. Removidos backend/worker Node, frontend antigo, SQL, testes, configurações, dependências/build da raiz e documentação legada. Inventário e validação em LIMPEZA_LEGADO.md. Nenhuma migração de dados, alteração remota, publicação, commit, reset ou stash. Credenciais locais não lidas nem removidas. Não inicia M02; M01 permanece com aceite humano pendente.

Fetch inicialmente bloqueado por permissão de escrita em .git/FETCH_HEAD; repetido com permissão ampliada e concluído. HEAD...origin/main = 0/0 após fetch; árvore suja autorizada, não declarada limpa.

## EX-05 — Escopo do projeto Supabase informado (23/10/2026)

Decisão humana: no projeto de referência `qxsdcrywsjkrpcbfgbxb`, schema `public`, qualquer alteração deve ficar limitada à tabela `public.pharmaleads`. Nenhuma outra tabela ou objeto pode ser alterado. A intenção anterior de excluir `pharmaleads` não dispensa inspeção de estrutura e dependências nem autoriza `CASCADE`.

Impacto: a revisão Alembic M02 atual, bem como `bootstrap_roles.sql`, **não podem ser executados nesse projeto** porque criam schemas, tabelas, papéis, funções e grants fora da tabela autorizada. O teste de integração M02 também cria uma tabela sentinela e schemas; deve permanecer restrito a um PostgreSQL local descartável, nunca ao projeto citado. D-06 permanece aberta quanto ao destino da arquitetura completa: banco separado aprovado ou revisão de escopo/arquitetura em nova decisão humana. Não reduzir o modelo completo a `pharmaleads` por suposição.

Verificação realizada: tentativa de leitura do link do editor Supabase fornecido pelo usuário; redirecionamento para login. Não houve inspeção de colunas, FKs ou dependências; nenhuma consulta SQL remota e nenhuma alteração foi executada. Para continuar a inspeção, usar sessão autenticada do usuário ou acesso de leitura apropriado, sem enviar credenciais no chat.

## D-06 — Destino único confirmado pelo usuário (23/10/2026)

Decisão humana posterior: usar apenas a tabela existente `public.pharmaleads` no projeto `qxsdcrywsjkrpcbfgbxb`; não criar outro projeto ou outras tabelas. Motivo informado: limite de recursos disponibilizados pela chefia. Esta decisão substitui a alternativa de um segundo projeto citada em EX-05 e prevalece sobre a proposta multischema do contrato v2.0 para esse destino.

Finalidade aprovada em princípio: uma linha por estabelecimento farmacêutico/filial, identificada por CNPJ completo textual, com cadastro verificável e estado comercial mínimo (responsável, status e notas), sem permitir que atualização cadastral apague trabalho comercial. Não presumir nomes/tipos das colunas atuais antes de inspecionar a tabela.

Impacto técnico: revisão Alembic multischema M02 e bootstrap de papéis permanecem bloqueados para esse projeto. Histórico imutável, proveniência N:N, políticas por fonte/campo/ação, fila PostgreSQL com lease/fencing, supressão e exportação auditável não podem ser declarados atendidos apenas por essa tabela. Avaliar em cada módulo uma representação viável dentro da única tabela sem perda de integridade; se um requisito não puder ser cumprido, registrar limitação e alternativa para decisão humana, sem simular homologação. Índices, triggers, funções, políticas RLS e Storage também exigem revisão do limite expresso pelo usuário antes de qualquer criação ou alteração remota.

Próxima evidência necessária: acesso de leitura autenticado ao editor para inspecionar colunas, constraints, índices, RLS e dependências de `public.pharmaleads`; elaborar diff SQL restrito ao alvo autorizado e validá-lo primeiro localmente. Nenhuma alteração remota executada nesta decisão.

### Evidência posterior do M02 — 23/10/2026

O acesso autenticado ao projeto de produção foi obtido no navegador. Inspeção visual da tabela e de três políticas RLS, mais duas consultas `SELECT` de catálogo, estão registradas em [M02_INSPECAO_PHARMALEADS.md](M02_INSPECAO_PHARMALEADS.md). Há 218 linhas no editor, CNPJ nullable, política permissiva `ALL TO public USING (true)` e privilégios `SELECT/INSERT/UPDATE/DELETE` para `anon` e `authenticated`. Nenhuma FK externa apontando para a tabela foi encontrada. Não foram alteradas tabelas, políticas, dados ou outros objetos; a migration multischema continua bloqueada. A exposição e o uso por outras aplicações precisam ser avaliados antes de qualquer ajuste de acesso da tabela.

## EX-06 — Recomeço com referências completas (23/10/2026)

O usuário reenviou o contrato definitivo e forneceu a especificação v1.5 em Markdown/PDF, pedindo recomeçar do zero e reaproveitar apenas o que coincidir com o plano. O contrato definitivo é idêntico ao canônico já preservado. As referências v1.5 foram incorporadas sem edição; os 72 RFs e prioridades foram mapeados em [RECONCILIACAO_V15.md](RECONCILIACAO_V15.md). Esta decisão mantém a restrição posterior D-06 de uma única tabela no Supabase e não autoriza criação de novas tabelas nem aplicação da migration multischema. A fundação M01 pode ser reaproveitada; partes locais de M02 exigem adaptação e teste. Nenhum gate ou módulo adicional foi aprovado por esta reconciliação.

## TEC-07 — Trava local da migration incompatível (23/10/2026)

Enquanto o M02 de uma tabela não está desenhado, a CLI Alembic bloqueia `upgrade --apply` e `downgrade --apply` contra todo destino remoto. Somente o banco PostgreSQL local descartável identificado por `local_test=true` pode executar a revisão multischema histórica; `inspect` remoto permanece read-only. Motivo: evitar criação acidental de schemas/tabelas no Supabase compartilhado. Testes negativos unitários executados; nenhum SQL de alteração remoto. O bootstrap SQL, por ser arquivo separado, continua proibido por procedimento e não foi executado.

## TEC-08 — Prova de conexão limitada à tabela autorizada (24/10/2026)

Pedido humano: conectar o Supabase neste projeto, usando no início apenas `public.pharmaleads`. Decisão técnica: pinagem do projeto `qxsdcrywsjkrpcbfgbxb`, banco `postgres` e endpoints confirmados no painel; `inspect` lê exclusivamente metadados da tabela em transação read-only. Script PowerShell usa senha digitada localmente e certificado CA público validado; não carrega `.env` antigo nem altera banco. Modo padrão: pooler de sessão 5432, com direto 5432 como alternativa. Não colocar chave da Data API ou credencial de serviço no frontend enquanto RLS e consumidores existentes não forem revisados. Teste com senha e integração à API permanecem pendentes. Nenhuma autorização de migration, papel, política ou nova tabela foi inferida.

## TEC-09 — Data API como transporte inicial (24/10/2026)

Decisão humana posterior: usar a segunda opção de conexão, Data API com chave publicável, em vez de exigir senha PostgreSQL para o primeiro acesso. Escopo: apenas `public.pharmaleads` no projeto `qxsdcrywsjkrpcbfgbxb`. A prova M02 faz somente `HEAD` com `limit=0`, sem registros; resultado real `connection=ok`. Mantidos backend Python, nenhuma chave secret/service_role e nenhuma mudança remota. O transporte difere da prescrição SQLAlchemy/psycopg v2.0 para a persistência completa; essa parte exigirá reconciliação de requisitos antes de módulos de escrita/fila/auditoria. A RLS permissiva existente não é aprovada para uso operacional só por esta escolha. Rever consumidores e políticas da própria tabela antes de expor dados no CRM. TEC-08 permanece como alternativa SQL não executada.

## TEC-10 — Ajuste de acesso condicionado ao inventário de consumidores (24/10/2026)

Escolha técnica de segurança, sem mudança remota: continuar M02 com inspeção read-only e **não** alterar RLS/grants da tabela de produção ainda. Motivo: o catálogo confirmou `ALL TO public USING (true)` e grants amplos, mas não identifica consumidores externos. Os logs da rota Data API por sete dias mostraram só os probes desta sessão; ausência de outros eventos nessa interface não prova ausência de uso. Antes de um diff SQL restrito a `public.pharmaleads`, obter do responsável pelo projeto os consumidores e operações esperadas, definir rollback/backup e validar em ambiente segregado. Nenhuma outra tabela, schema, função ou papel será criado/alterado por essa revisão. Não representa aceite humano do M02 nem decisão final de política. Evidências em [M02_INSPECAO_PHARMALEADS.md](M02_INSPECAO_PHARMALEADS.md).

## TEC-11 — Conexão de diagnóstico FastAPI com chave publicável (24/10/2026)

Decisão humana: seguir diretamente com a conexão Supabase e interromper os testes. O usuário forneceu URL e chave publicável do projeto e afirmou que nenhuma outra tabela utiliza pharmaleads. A FastAPI passa a oferecer somente /health/supabase, que executa HEAD com zero linhas na tabela autorizada; prova real connected no processo local. Não se inferiu que nenhuma aplicação externa use a tabela, nem se alterou RLS/grants. O risco RLS da TEC-10 segue aberto para rotas de dados. A chave fica no ambiente do processo, não em código/arquivo/frontend; NEXT_PUBLIC_* não é usado por este projeto Vite/Python. M02 parcialmente integrado, não aceito; M03 não iniciado.

## TEC-12 — Aditivo de uma tabela e importação restrita (24/10/2026)

Decisão humana: começar usando apenas public.pharmaleads no Supabase e registrar isso no contrato oficial, executando o passo 1 de gravação controlada do M02. O aditivo preserva a arquitetura multischema original como referência futura, sem aplicá-la ao projeto atual. Implementação local: CSV validado, prévia padrão, apenas campos cadastrais, insert/update separados, chave publicável de processo e escrita real bloqueada até correção da RLS da própria tabela e liberação operacional. Nenhuma linha ou objeto remoto foi alterado. Limitação registrada: 216 de 218 linhas atuais têm CNPJ nulo e não podem ser conciliadas automaticamente. Testes não executados nesta continuação por pedido do usuário; não declarar integração de escrita nem aceite.

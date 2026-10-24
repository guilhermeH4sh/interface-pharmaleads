# PLATAFORMA NACIONAL DE PROSPECÇÃO DE FARMÁCIAS

**Documento de projeto de software e especificação técnico-funcional**  
**Versão:** 1.5 - aquisição mult fontes, cadastro permanente por origem permitida, consulta Google Places separada, operação manual/automática e infraestrutura sem Docker; proposta para aprovação e início da implementação  
**Data:** 23 de outubro de 2026  
**Base de referência:** "Projeto revisado: plataforma nacional de prospecção de farmácias" (documento fornecido pelo solicitante, 23/10/2026).  
**Banco de dados escolhido:** Supabase (PostgreSQL gerenciado).  
**Situação:** arquitetura proposta; funcionalidades ainda não implementadas ou homologadas.

> **Controle de versão:** este documento transforma o plano de referência em especificação de implementação. Preserva a proposta de base mestre da Receita, enriquecimento por fontes autorizadas, procedência dos contatos e separação entre coleta e comercial. Acrescenta requisitos verificáveis, arquitetura detalhada com Supabase, contratos de integração, modelo lógico ampliado e critérios de implantação. A versão 1.2 especificou duas modalidades de acionamento de coletas (manual pelo painel e automática por agenda do sistema operacional), com o mesmo motor de jobs, controle de concorrência e auditoria. A versão 1.3 separou Google Business Profile e Google Places. A versão 1.5 acrescenta um catálogo mult fontes com termos de uso, regras de persistência por campo, conectores independentes, gates de publicação, fontes administrativas e checagens de regularidade; mantém o objetivo da versão 1.4: **encontrar farmácias e consultar contatos no Google Maps**, por APIs oficiais Places, sem gestão de perfis de terceiros. Google Places é uma fonte de descoberta/consulta referenciada por `place_id`, não uma autorização para replicar seus contatos em uma base persistente de CRM. Valores, prioridades e metas assinalados como *propostos* requerem validação do responsável pelo produto.

## 1. Apresentação e controle do documento

### 1.1 Finalidade

Servir como referência para iniciar a construção de uma aplicação interna de prospecção B2B voltada a estabelecimentos farmacêuticos no Brasil. Reúne definição de produto, arquitetura, requisitos funcionais (RF), requisitos não funcionais (RNF), regras de negócio (RN), modelos de informação, fluxos de dados, diretrizes de scraping, APIs, segurança, testes, indicadores e entregas. É uma especificação de construção, não uma afirmação de que os controles já estejam em produção.

### 1.2 Escopo, limites e premissas

- Abrangência alvo: Brasil, com implantação progressiva por unidade federativa e município. A UF do piloto permanece **a definir**.
- Universo cadastral proposto: estabelecimentos com situação cadastral ativa e CNAE principal 4771-7/01 (sem manipulação), 4771-7/02 (com manipulação) e 4771-7/03 (homeopáticos). A inclusão de 4771-7/04 (veterinários) depende de aprovação de escopo.
- Identificador principal de estabelecimento: CNPJ completo de 14 dígitos. A raiz do CNPJ serve para agrupamento empresarial, não para fundir filiais.
- Dados: informações cadastrais de empresas e canais de contato empresariais, com classificação de eventual dado pessoal. Não coletar dados de pacientes, clientes, CPFs, sócios ou responsáveis técnicos como objeto da prospecção.
- O sistema **não** terá envio automático de e-mail, ligações ou WhatsApp no MVP. Exportar ou consultar um canal não equivale a permissão para abordar seu titular.
- Os fluxos de armazenamento, acesso e exportação dependem de validação de tratamento de dados e de termos de uso das fontes.
- Supabase gerencia o PostgreSQL, Auth e Storage; **não executa** os browsers e spiders. Os workers de coleta rodam em serviço Python fora da plataforma.
- O painel inicial inclui um CRM leve (status, responsável, observações e histórico). Integração com CRM corporativo é evolução condicionada à existência e ao contrato do CRM.
- **Modelo mult fontes definido:** a aplicação deverá combinar base oficial de CNPJ, fontes públicas complementares, sites e localizadores autorizados, cadastro comercial informado diretamente, e fornecedores B2B licenciados, com habilitação por fonte. O Google Places permanece um recurso separado de consulta e não alimenta diretamente o cadastro comercial persistente.
- **Objetivo Google confirmado:** localizar farmácias e consultar os contatos comerciais apresentados no Google Maps. Usar **Google Places API (New)**, com Text Search, Nearby Search e Place Details; nunca a API Google Business Profile para consultar terceiros. O sistema poderá reter `place_id` e oferecer consulta contextual de dados sujeitos às políticas e atribuições da Google Maps Platform. A montagem de uma base permanente de telefones/sites/endereço extraídos exclusivamente de Places **não está autorizada por padrão**; informações persistidas no Supabase deverão ter fonte própria e direito de reutilização. Integração depende da aprovação de orçamento, termos e elegibilidade.

### 1.3 Classificação das decisões

| Marca | Significado | Exemplo |
|:--|:--|:--|
| Definido | Requisito presente no documento-base ou decisão explícita | Supabase; foco em farmácias; scraping necessário |
| Proposto | Escolha técnica recomendada, sujeita a avaliação do time | FastAPI; processos Python com `venv` e agendamento do sistema operacional; metas de desempenho |
| Pendente | Afeta escopo, conformidade ou custo; requer decisão formal | UF do piloto; canais de abordagem; orçamento de APIs |

### 1.4 Partes interessadas e responsabilidades

| Papel | Responsabilidade | Situação |
|:--|:--|:--|
| Responsável pelo produto / negócio | Aprovar prioridades, campos e regras comerciais | Nome a designar |
| Desenvolvimento backend e dados | Ingestão, scrapers, banco, API e deploy | Nome a designar |
| Desenvolvimento frontend | Experiência do painel e integração com API | Nome a designar |
| QA | Estratégia de testes, evidências, homologação e critérios de aceite | Nome a designar |
| Operação comercial | Validar utilidade, precisão e tratamento de leads | Nome a designar |
| Responsável jurídico/LGPD | Bases legais, políticas por fonte, opt-out, retenção | Nome a designar |
| Administrador de infraestrutura | Segredos, observabilidade, backup, custos e incidentes | Nome a designar |

## 2. Objetivos, indicadores e fronteiras do sistema

### 2.1 Problema de negócio

A descoberta manual de farmácias e a manutenção de listas comerciais são lentas, geram duplicidade e não mostram claramente de onde vieram os contatos. É necessário criar um cadastro nacional incremental, usando dados oficiais para cobertura e crawling autorizado para obter informações que a base cadastral não possui ou não confirma.

### 2.2 Objetivos do produto

1. Manter base mestre rastreável de estabelecimentos elegíveis ao público-alvo.
2. Identificar sites oficiais, importar bases públicas complementares e coletar contatos empresariais publicados de forma permitida.
3. Evitar misturar informação observada, inferência automática e confirmação efetiva.
4. Consolidar contatos com origem, data, classificação e grau de confiança.
5. Oferecer ao comercial consulta, filtros, distribuição, status, observações e exportação controlada.
6. Detectar alterações de layouts, falhas de coleta e desatualização dos dados.
7. Operar com controles de acesso, trilha de auditoria, supressão e capacidade de recuperação.
8. Permitir várias fontes de prospecção com regras independentes de licenciamento, armazenamento, exportação e confiabilidade; nenhum dado entra na base mestre sem origem comprovável.

### 2.3 Indicadores e metas iniciais

| Indicador | Definição operacional | Meta/condição inicial |
|:--|:--|:--|
| Cobertura cadastral | Ativos elegíveis importados / ativos elegíveis na versão de referência | Alvo 100% do recorte validado, após reconciliação |
| Cobertura com site confirmado | Estabelecimentos com domínio confirmado / elegíveis | Medir baseline do piloto |
| Cobertura com contato verificado | Elegíveis com ao menos um contato confirmado / elegíveis | Meta após baseline; não inventar percentual |
| Precisão do vínculo site-CNPJ | Matches corretos em amostra humana estratificada | Meta proposta >=95% no piloto |
| Precisão de contato exportável | Contatos corretamente atribuídos em amostra rotulada | Meta proposta >=90%; por tipo de contato |
| Taxa de duplicidade | Duplicados comprovados / registros amostrados | Meta proposta <1% |
| Taxa de erro de coleta | Jobs com falha por fonte / jobs elegíveis | Meta proposta <5%, desagregada por causa |
| Frescor | Contatos reavaliados em até 90 dias | Proposta, sujeita à relevância comercial |
| Tempo de consulta | Percentil 95 de GET paginado nas condições de teste | Proposta <=2 s para 50 registros |
| Integridade comercial | Reprocessamentos que apagam status/observações do vendedor | Obrigatoriamente 0 |

**Interpretação:** verificação de sintaxe de e-mail, MX, padrão telefônico ou HTTP 200 **não** comprova, isoladamente, que o contato pertence à farmácia, está ativo ou autoriza abordagem.

### 2.4 Dentro e fora do escopo

**No escopo:** cadastro nacional, cargas periódicas, descoberta de sites, spiders por fonte permitida, enriquecimento de contatos, evidências, normalização, revisão humana de casos ambíguos, base consolidada no Supabase, API, painel comercial mínimo, **início manual de coletas pelo painel e início automático por agendamento configurável**, exportações e auditoria. **Integração Google solicitada pelo negócio:** busca de farmácias via Places API com consulta contextual de telefones e sites, referenciada por `place_id`, com orçamento e limites; conteúdo restrito não é promovido automaticamente ao cadastro comercial persistente.

**Fora do MVP:** automação de mensagens, validação de números por chamadas, scraping de redes sociais em violação de termos, contorno de CAPTCHA/bloqueios, compra de bases sem procedência, inteligência artificial para decisão automática sobre pessoa física, CRM completo de funil de vendas e mapa geográfico avançado. Também ficam fora do MVP o gerenciamento de perfis Google Business Profile, o scraping de páginas do Google Maps e a construção de cadastro permanente de leads com dados restritos da Places API. O módulo Places poderá ser pilotado após aprovação técnica, financeira e jurídica.

## 3. Arquitetura da solução

### 3.1 Visão lógica de componentes

![Figura 1 - Arquitetura mult fontes da plataforma](arquitetura_multifontes.png){width=15.5cm}

**Legenda de responsabilidades:** a Receita Federal é o cadastro mestre; Farmácia Popular, Anvisa (consulta, quando permitido), bases regionais autorizadas, OpenStreetMap (ODbL), sites institucionais, localizadores, contatos informados pela própria empresa e fornecedores com contrato podem funcionar como conectores independentes. Cada conector possui política de licença e só libera campos cuja persistência esteja autorizada. Fontes oficiais e websites autorizados alimentam workers Python. A Google Places API oferece descoberta de estabelecimentos e apresentação pontual de dados, fora do motor Scrapy; a ligação à base própria ocorre apenas via `place_id` e regras de correspondência, sem importação automática de conteúdo restrito. Esses workers extraem, normalizam e persistem em esquemas internos do PostgreSQL/Supabase. A FastAPI lê e altera apenas o que sua função permite; o painel React não possui credenciais administrativas do banco. Supabase Auth autentica usuários, e Storage guarda evidências permitidas em bucket privado.

### 3.2 Pipeline de ponta a ponta

![Figura 2 - Pipeline de ingestão, crawling e consolidação](pipeline.png){width=15.5cm}

**Fluxo oficial:** baixar manifesto e arquivos da Receita, conferir layout/integridade, processar em disco temporário ou armazenamento adequado, filtrar o recorte elegível, carregar staging e promover para o cadastro mestre.

**Fluxo mult fontes:** cada conector ativo recebe uma partição e uma política de uso; a importação de arquivos, o crawling permitido e a entrada manual entram em observações separadas. Antes da publicação, validar licença/uso, fonte, data, CNPJ, duplicidade, consentimento/base legal quando aplicável e supressão. **Fluxo de scraping:** descobrir URL candidata por fontes independentes autorizadas, confirmar associação ao estabelecimento, criar job, extrair conteúdo relevante, guardar observações e evidências, normalizar e resolver em contato consolidado. Nenhum campo Google Places pode ser recopiado como se tivesse outra origem.

**Publicação:** a camada comercial acessa uma visão consolidada e filtrada pelas regras de acesso, supressão, qualidade e canal. A coleta não altera os campos de gestão comercial.

### 3.3 Responsabilidades e fronteiras

| Componente | Responsabilidade | Não deve fazer |
|:--|:--|:--|
| Importador Receita | Versão, filtro, staging, snapshot e reconciliação | Fazer outreach ou reescrever status comercial |
| Conectores complementares | Ingerir listagens públicas autorizadas, datasets contratados e confirmações comerciais com procedência | Presumir que um conjunto público autoriza qualquer redistribuição |
| Motor de políticas por origem | Definir se o campo pode ser guardado, mostrado ou exportado e sua retenção | Trocar rótulo de origem para contornar termos externos |
| Descoberta | Levantar domínios candidatos e indícios de associação | Tratar domínio candidato como confirmado automaticamente |
| Spider Scrapy | Rastrear páginas permitidas com limites de domínio | Acessar caminhos vedados ou burlar bloqueios |
| Playwright | Renderizar contatos cujo DOM depende de JavaScript | Substituir requisição HTTP simples em toda URL |
| Google Places API (condicional) | Buscar farmácias de terceiros por termo/área, retornar IDs e consultar dados contextuais com atribuição | Persistir ou exportar conteúdo restrito como diretório permanente de prospecção |
| Places Insights (evolução opcional) | Identificar oportunidades por região no Brasil através do BigQuery, se contratado | Supor acesso livre ou irrestrito a nomes e contatos para armazenamento no CRM |
| Normalizador e resolvedor | Transformar observações em contatos canônicos | Inventar confirmação de contato sem evidência |
| Worker de jobs | Reservar tarefas, checkpoint, retry e registrar execução | Receber chamadas HTTP da interface como processo bloqueante |
| PostgreSQL/Supabase | Integridade, armazenamento relacional, histórico | Ser usado como depósito ilimitado de HTML e ZIPs enormes |
| Storage privado | Guardar arquivos permitidos com ciclo de retenção | Servir HTML e evidências publicamente |
| FastAPI | Autorização, orquestração lógica, consultas e exportações | Executar browser no processo de requisição |
| Painel React | Operação comercial e visibilidade de coletas | Acessar segredos administrativos |

### 3.4 Comunicação, implantação e ambientes

- **Desenvolvimento:** Python instalado diretamente na máquina, dependências isoladas em ambiente virtual (`python -m venv .venv`), frontend executado com Node.js/Vite e projeto Supabase de desenvolvimento separado. Não conectar testes automatizados ao projeto de produção.
- **Homologação:** ambiente lógico distinto, configuração própria por variáveis de ambiente, conjunto reduzido de dados e fontes de teste e políticas de acesso equivalentes às de produção. A execução também será sem contêineres.
- **Produção:** frontend React publicado como aplicação estática; FastAPI executada como processo Python independente; coletores Scrapy/Playwright e importador executados por comandos Python separados, em máquina ou servidor compatível com seus requisitos de CPU, RAM, armazenamento e conectividade. Supabase permanece gerenciado e remoto.
- **Gerenciamento de processos:** em Linux, usar `systemd` para manter FastAPI e worker supervisionados, e `cron` ou `systemd timers` para iniciar periodicamente o comando leve de conferência de agendas (`scheduler tick`); em Windows, usar o Agendador de Tarefas para o mesmo comando e processo supervisionado para API e worker. **O agendador do sistema operacional apenas verifica agendas vencidas e insere jobs no Supabase; não executa o spider dentro da API ou a cada clique no painel.**
- **Pré-requisito de operação:** é necessário ao menos um ambiente capaz de executar Python e os navegadores do Playwright nos horários planejados. Caso haja somente um computador local, as coletas ocorrerão quando ele estiver ligado e conectado; disponibilidade contínua e cobertura nacional não devem ser assumidas.
- **Conexão ao banco:** backend persistente em conexão direta quando a rede suportar ou via pooler de sessão; migrações e operações SQL nativas em conexão compatível. Evitar pooler de transação para `COPY`, recursos de sessão e prepared statements sem avaliação específica.
- **Segregação:** schemas `ingest`, `core`, `coleta`, `comercial`, `audit` como internos; opcional `api` exclusivamente para objetos explicitamente expostos. Revisar GRANT, exposição da Data API e RLS; schema por si só não garante isolamento.
- **Operação inicial:** uma máquina de workers com processamento por lotes e agendamento simples. Escala horizontal somente após medição.

### 3.5 Sequência do job de scraping

1. O operador autorizado solicita **Iniciar coleta** no painel (modo manual) **ou** o processo agendador consulta regras ativas e identifica agendas vencidas (modo automático).
2. No modo manual a API valida o usuário; no modo automático o scheduler autentica como serviço restrito. Ambos validam fonte, domínio, janela, orçamento, permissões e escopo da requisição.
3. O serviço grava job `pendente` com chave de idempotência e origem de acionamento (`manual` ou `automatico`), preservando solicitante ou agenda responsável.
4. Um worker reserva o job atomicamente, registra lease e heartbeat e muda para `executando`.
5. O spider carrega apenas páginas autorizadas; usa Playwright somente se necessário.
6. O pipeline salva observações e referências de evidência em transações curtas.
7. A consolidação valida, calcula qualidade e atualiza contatos sem alterar `lead_comercial`.
8. O worker finaliza métricas, checkpoint e estado. Em falha, registra motivo, política de retentativa e alerta.
9. A API apresenta histórico, contagem de registros e eventuais necessidades de revisão.

### 3.6 Máquina de estados dos jobs

![Figura 3 - Estados sugeridos para execução de jobs](estados.png){width=15cm}

**Regras de execução:** `claim` via transação com `FOR UPDATE SKIP LOCKED`, lease por worker, heartbeat periódico e reatribuição de lease expirado. A reexecução é idempotente. O mecanismo de retry deve distinguir falhas transitórias, permanentes e bloqueios por política. Jobs encerrados após tentativas máximas vão para revisão em vez de loop infinito. A origem manual ou automática **não** modifica as regras técnicas do coletor.

### 3.7 Acionamento manual e automático das coletas

![Figura 4 - Acionamento manual e automático convergindo para a mesma fila de jobs](acionamento.png){width=15.5cm}

**Decisão de arquitetura:** a plataforma terá **dois meios de solicitar uma coleta**, mas **um único fluxo de execução**. Isso evita manter dois scrapers diferentes, impede divergências de validação e facilita testes e auditoria.

| Dimensão | Modo manual | Modo automático |
|:--|:--|:--|
| Quem dispara | Operador/admin autenticado no dashboard | Processo agendador Python autorizado, iniciado pelo SO |
| Configuração | Fonte, UF/município ou domínio, escopo e confirmação | Regra ativa com fonte, partição, periodicidade, horário e fuso |
| Primeira ação | `POST /v1/jobs` pela FastAPI | Comando `scheduler tick` consulta agendas vencidas no Supabase |
| Persistência | Insere `coleta.job_coleta` com `origem=manual` e `solicitado_por` | Insere `coleta.job_coleta` com `origem=automatico` e `agenda_id` |
| Execução real | Worker Python reserva e processa o job em segundo processo | Mesmo worker Python e mesmos spiders |
| Feedback | Tela de monitor exibe ID, status, progresso e erros | Tela mostra agenda, próxima execução, última execução e jobs gerados |
| Interrupção | Operador pode solicitar cancelamento de job permitido | Admin pode pausar agenda e cancelar jobs ainda pendentes, conforme política |

**Fluxo manual (P0):** (1) operador abre **Coletas > Nova coleta**; (2) seleciona fonte autorizada, região/domínio, tipo de coleta e escopo; (3) interface apresenta uma prévia dos parâmetros e exige confirmação; (4) FastAPI aplica RBAC e valida limites, política por fonte e duplicidade ativa; (5) job entra como `pendente`; (6) o worker executa; (7) o operador acompanha o resultado por ID no monitor. A resposta HTTP deve retornar **202 Accepted** com `job_id`, sem esperar o navegador terminar o crawl. Clicar repetidamente não deve duplicar trabalho equivalente em andamento.

**Fluxo automático (P0):** (1) admin cadastra e habilita uma agenda; (2) o `cron`, `systemd timer` ou Agendador do Windows inicia periodicamente um **comando Python curto**, por exemplo uma vez por minuto; (3) esse comando lê no PostgreSQL/Supabase agendas com `proxima_execucao_em <= agora`, reserva cada agenda atomicamente, verifica limites e cria o job; (4) avança `proxima_execucao_em` na mesma transação, para evitar novo disparo; (5) o worker independente processa a fila. **O Supabase armazena agendas e jobs; o agendador e o navegador automatizado rodam fora dele.**

**Periodicidades propostas:** diária, semanal ou mensal, com horário local e timezone IANA configurado (ex.: `America/Sao_Paulo`). Expressões cron livres não serão inseridas diretamente pelo usuário no MVP; a interface oferece opções validadas. A rotina mensal da Receita e a revalidação periódica de contatos podem usar o mesmo mecanismo, com tipos de job distintos. A agenda não representa promessa de execução quando a máquina estiver desligada.

**Política para atrasos e indisponibilidade:** quando o computador/servidor estiver desligado na hora prevista, não haverá execução naquele instante. No retorno, cada agenda poderá executar **no máximo um disparo de recuperação** ou ignorar a janela vencida, conforme `politica_atraso`, nunca criar uma avalanche de jobs retroativos. Horário de verão e mudanças de fuso devem ser tratados por biblioteca de timezone, armazenando instantes no banco em UTC.

**Concorrência e prevenção de duplicidade:** criar uma chave de idempotência calculada a partir de fonte, partição, tipo de coleta e janela lógica; impedir sobreposição simultânea da mesma tarefa; reservar agendas e jobs em transações PostgreSQL com locks adequados. Conflitos devolvem o job existente ou informam que já há execução ativa. Falha no envio de comando não pode gerar dois jobs equivalentes.

**Governança e proteção:** apenas operador/admin inicia manualmente; somente admin configura, suspende ou edita agendas; comercial tem acesso no máximo à visualização permitida. Registrar usuário, agenda, origem, timestamp, filtros, motivo da recusa e mudanças de configuração. Política de domínio, limites de taxa, retenção, supressão e orçamento valem igualmente para ambos os modos.

**Critério de homologação obrigatório:** demonstrar uma coleta disparada pelo botão do painel e outra disparada automaticamente pelo agendador do SO, ambas visíveis no mesmo histórico, sem duplicação, com capacidade de falhar e retomar sem alterar dados comerciais.

## 4. Levantamento de requisitos funcionais

### 4.1 Convenções

`P0` = indispensável para o MVP; `P1` = necessário antes de operação regular; `P2` = evolução. Os critérios listados são verificáveis. Todos os requisitos são **propostas de produto a aprovar**, salvo as decisões fixadas no resumo de escopo.

### 4.2 Catálogo de requisitos funcionais

| ID | Pri. | Requisito verificável | Critério de aceite resumido |
|:--|:--:|:--|:--|
| RF-001 | P0 | Cadastrar fontes com tipo, permissão, risco, URL de termos e status | Fonte sem aprovação não é executada |
| RF-002 | P0 | Parametrizar CNAE principal, situação ativa e recorte por UF/município | Recorte reproduzível para a mesma versão |
| RF-003 | P0 | Registrar competência, origem, integridade e layout de cada carga CNPJ | Carga sem verificação fica bloqueada |
| RF-004 | P0 | Importar estabelecimentos elegíveis para staging e base mestre | Reconciliação por UF e relatório de rejeição |
| RF-005 | P0 | Preservar snapshot/versão cadastral e data de última observação | Possível identificar inclusões e alterações |
| RF-006 | P0 | Deduplicar por CNPJ completo e manter filiais separadas | CNPJ repetido não duplica estabelecimento |
| RF-007 | P0 | Criar e gerenciar jobs por fonte/UF/município/domínio | Estados e tentativas consultáveis |
| RF-008 | P0 | Retomar jobs interrompidos com checkpoint/lease | Retomada não duplica contatos/evidências sem critério |
| RF-009 | P0 | Descobrir URLs candidatas a site institucional | Cada URL tem origem e situação de revisão |
| RF-010 | P0 | Associar site ao CNPJ por evidências objetivas | Casos ambíguos não viram associação automática |
| RF-011 | P0 | Executar crawling com respeito a políticas por domínio | Testes provam limite, pausa e bloqueio |
| RF-012 | P0 | Usar browser somente em páginas dinâmicas autorizadas | Caminho HTTP simples não inicia browser |
| RF-013 | P0 | Extrair telefone, e-mail, links de WhatsApp, site e perfis publicados | Valores brutos e URL da observação registrados |
| RF-014 | P0 | Criar evidência de cada observação extraída | Fonte, URL, horário e hash rastreáveis |
| RF-015 | P0 | Normalizar CNPJ, CEP, domínio, telefone e e-mail | Formatos inválidos são classificados/rejeitados |
| RF-016 | P0 | Identificar telefones/e-mails potencialmente compartilhados | Central e contabilidade recebem marca própria |
| RF-017 | P0 | Consolidar observações sem apagar origem ou histórico | Contato final aponta para observações utilizadas |
| RF-018 | P0 | Diferenciar validade técnica, confirmação de vínculo e autorização de uso | Interface não exibe apenas rótulo genérico "validado" |
| RF-019 | P0 | Preservar campos comerciais em toda atualização de scraping | Reimportação não altera status, dono e notas |
| RF-020 | P0 | Autenticar usuários e impor permissões por papel | Usuário não autorizado recebe 403 ou ausência do recurso |
| RF-021 | P0 | Listar estabelecimentos por UF, município, CNAE, situação e contato | Busca paginada com filtros consistentes |
| RF-022 | P0 | Exibir ficha de estabelecimento com fontes e datas de contato | Contato mostra procedência e tipo de confiança |
| RF-023 | P0 | Criar/alterar status comercial e responsável | Histórico registra usuário, antes/depois e data |
| RF-024 | P0 | Registrar observações e interações comerciais manuais | Nenhuma observação desaparece após nova coleta |
| RF-025 | P0 | Manter lista de supressão por contato/canal | Exportação exclui contatos suprimidos |
| RF-026 | P0 | Exportar somente contatos permitidos por papel e política de canal | Exportação gera trilha auditável |
| RF-027 | P0 | Registrar auditoria de login relevante, atualização e exportação | É possível responder quem fez o quê e quando |
| RF-028 | P0 | Consultar resultado de jobs: aceitos, erros, duração, motivo e cobertura | Tela e API mostram estado real da execução |
| RF-029 | P1 | Colocar domínio/fonte em pausa após sequência de falhas ou bloqueios | Pausa evita tentativas repetitivas |
| RF-030 | P1 | Reprocessar fontes em janela configurável com idempotência | Nova coleta não cria o mesmo lead novamente |
| RF-031 | P1 | Oferecer fila de revisão humana de vínculos ambíguos | Revisão aprovada/rejeitada gera trilha |
| RF-032 | P1 | Calcular score de confiança explicável por contato | Score inclui sinais, penalidades e versão de regra |
| RF-033 | P1 | Medir cobertura, precisão amostral, erros e frescor por UF | Dashboard não confunde percentual de sites com de contatos |
| RF-034 | P1 | Atualizar a base mestre após nova carga oficial | Relatório de estabelecimentos novos, alterados e inativos |
| RF-035 | P1 | Classificar domínios com falha de SSRF/redirecionamento | URL interna ou privada é recusada |
| RF-036 | P1 | Gerar pedidos de correção, bloqueio e exclusão conforme política | Solicitação recebe estado, responsável e prazo |
| RF-037 | P1 | Manter política de retenção e limpeza de HTML/evidências | Purga periódica registra resultado |
| RF-038 | P1 | Gerenciar orçamento e limites de APIs pagas por fonte | Bloqueia chamadas após teto definido |
| RF-039 | P2 | Integrar CRM externo por API após aprovação | Sincronização não duplica e respeita supressão |
| RF-040 | P2 | Suportar mapa/consulta por raio se houver demanda | Exige revisão de licença de geocodificação |
| RF-041 | P2 | Oferecer perfis/grupos empresariais sem mesclar filiais | Grupo reúne múltiplos CNPJs distintos |
| RF-042 | P2 | Analisar feedback do comercial sobre contatos incorretos | Feedback influencia recrawl ou revisão de score |
| RF-043 | P2 | Importar cadastros complementares oficiais com proveniência | Fonte nova não sobrescreve dado sem regra |
| RF-044 | P2 | Gerar relatórios de qualidade por fonte e versão do spider | Queda de extração é detectável por release |
| RF-045 | P0 | Iniciar coleta manual a partir do dashboard, com fonte e região/domínio | API retorna 202 e ID de job; status visível sem bloquear interface |
| RF-046 | P0 | Validar permissão, parâmetros, limites e execução concorrente no disparo manual | Clique duplicado não cria job equivalente ativo; usuários sem papel recebem 403 |
| RF-047 | P0 | Cadastrar, ativar, pausar e editar agendas recorrentes | Admin configura periodicidade, horário, timezone, fonte e escopo; histórico auditado |
| RF-048 | P0 | Criar automaticamente jobs vencidos por comando Python acionado pelo agendador do SO | Execução da agenda gera job `automatico`, mesmo pipeline e métricas do manual |
| RF-049 | P0 | Impedir duplicidade em disparos simultâneos ou após reinício do agendador | Duas chamadas do scheduler para a mesma janela produzem no máximo um job lógico |
| RF-050 | P0 | Exibir origem, solicitante/agenda, próxima e última execução no painel | Operador distingue manual/automático e identifica falhas e atrasos |
| RF-051 | P1 | Definir política para janelas perdidas por máquina desligada | Na retomada, no máximo um catch-up por agenda ou pular janela, conforme configuração |
| RF-052 | P1 | Permitir cancelamento controlado e suspensão de novas coletas | Cancelamento de job pendente é imediato; em execução é cooperativo, auditado |
| RF-053 | P1 condicionado | Pesquisar farmácias via Google Places Text Search e Nearby Search | Filtros de termo, categoria, região e raio; mostrar resultados/`place_id` e atribuição após aprovações contratuais |
| RF-054 | P1 condicionado | Consultar Place Details de farmácia selecionada | Exibir telefone/site quando disponíveis em resposta atual; não persistir conteúdo restrito automaticamente |
| RF-055 | P1 condicionado | Relacionar `place_id` a CNPJ/estabelecimento existente com revisão de ambiguidade | Persistir somente o identificador permitido; correspondência sem garantia não atualiza contatos nem razão social |
| RF-056 | P1 condicionado | Controlar consumo e custos das consultas Google | FieldMask mínimo, SKUs, limites por usuário/organização, erros e teto diário/mensal monitorados |
| RF-057 | P1 condicionado | Impedir exportação ou ingestão no Supabase de conteúdo restrito recebido exclusivamente da Places API | Testes de negativa de gravação, atribuições e segregação por origem |
| RF-058 | P2 opcional | Avaliar Places Insights para descoberta territorial em escala nacional | Acesso contratado ao BigQuery, disponibilidade Brasil, custos e limites de resultados documentados antes do projeto |

| RF-059 | P0 | Manter um catálogo de **múltiplas fontes** com finalidade, contrato/licença, classe de dados, periodicidade, escopo e responsável | Fonte `pendente`/`bloqueada` não pode gerar observação publicável nem executar job |
| RF-060 | P0 | Definir regras de uso por `fonte + campo + operação` (coletar, persistir, exibir, exportar) | Telefone com persistência negada não aparece em `core.contato` ou CSV |
| RF-061 | P0 | Integrar lista oficial Farmácia Popular como fonte complementar após inspecionar campos e direitos de uso | Importação identifica versão e cruza CNPJ sem sobrescrever dados comerciais |
| RF-062 | P1 | Integrar consultas públicas da Anvisa para qualificação cadastral, conforme mecanismo autorizado | Consulta sem API/bulk permitidos fica em modo manual e não gera scraping não autorizado |
| RF-063 | P0 | Registrar contato fornecido diretamente pelo estabelecimento ou autorizado pelo comercial | Registrar autor, evidência de origem, finalidade, data e classificação do canal |
| RF-064 | P1 | Importar fornecedores B2B licenciados e arquivos CSV homologados | Contrato e campos autorizados registrados; ausência de contrato bloqueia publicação |
| RF-065 | P1 | Importar extratos OpenStreetMap, condicionado a avaliação ODbL e separação de dataset | Atribuição/licença preservadas e exportação verificada segundo obrigação aplicável |
| RF-066 | P0 | Consolidar múltiplas observações por CNPJ sem apagar versões, conflitos ou proveniência | Mesmo telefone de duas fontes produz um contato e duas evidências distintas |
| RF-067 | P0 | Bloquear enriquecimento derivado de conteúdo Google Places sem autorização específica | Nenhuma rotina importa resposta Places ou usa a busca Google como origem oculta do scraper |
| RF-068 | P1 | Mostrar cobertura, custo, frescor, rejeições e desempenho **por fonte** e por UF | Dashboard exibe denominador, competência e período da medição |
| RF-069 | P1 | Permitir importar/pausar/reprocessar individualmente conectores por fonte, UF ou domínio | Pausa de uma fonte não interrompe as demais |
| RF-070 | P0 | Aplicar autorização de exportação por contato/canal e procedência | Um contato suprimido, restrito, pessoal sem revisão ou de licença incompatível não sai no arquivo |
| RF-071 | P1 | Registrar e revisar conflitos de fontes (telefones diferentes, CNPJ ambíguo, endereços divergentes) | Divergência sem regra confiável entra em fila de revisão, sem substituir automaticamente o consolidado |
| RF-072 | P1 | Permitir análise de valor por fonte para priorizar orçamento | Relatório de novos CNPJs, contatos únicos elegíveis e custo por contato válido, sem inflar duplicações |

### 4.3 Casos de uso essenciais

**UC-01 - Importar base oficial.** Ator: operador de dados. Pré-condições: fonte aprovada e espaço disponível. Fluxo: registrar versão -> baixar -> verificar checksum/layout -> filtrar CNAE principal -> staging -> reconciliar -> promover -> emitir relatório. Exceções: corrupção, layout diferente, contagens fora do intervalo; não promover.

**UC-02 - Descobrir e confirmar site.** Ator: serviço de descoberta e revisor. Fluxo: identificar domínio candidato -> guardar evidência -> comparar identificadores/telefone/endereço -> confirmar se houver critério forte; se ambíguo, enviar à revisão humana.

**UC-03 - Executar enriquecimento por scraping.** Ator: agendador/operador. Pré-condições: fonte permitida, domínio aceito e job válido. Fluxo: reservar job -> rastrear páginas de contato -> extrair -> validar -> persistir observações -> consolidar -> atualizar métricas. Exceções: 429, 5xx, `robots.txt`, bloqueio explícito, dados inconsistentes, redirecionamento inseguro.

**UC-07 - Disparar coleta manualmente.** Ator: operador ou administrador. Pré-condições: sessão autenticada, fonte aprovada e parâmetros válidos. Fluxo: abrir tela de coletas -> informar região/domínio e fonte -> confirmar -> solicitar API -> receber `job_id`/202 -> acompanhar progresso. Exceções: 403, fonte bloqueada, orçamento excedido, job duplicado em andamento ou ausência de worker; registrar o resultado e informar na interface.

**UC-08 - Executar coleta agendada.** Ator: agendador do sistema operacional e serviço Python. Pré-condições: agenda ativa, horário vencido, máquina ligada e credencial de serviço válida. Fluxo: iniciar `scheduler tick` -> reservar agenda -> criar job idempotente -> atualizar próxima ocorrência -> worker coleta -> registrar resultado. Exceções: tick duplicado, banco indisponível, horário perdido e agenda pausada; não criar múltiplos jobs para a mesma janela.

**UC-04 - Qualificar lead comercial.** Ator: vendedor. Fluxo: consultar lista -> abrir ficha -> observar origem/qualidade -> designar responsável -> alterar status e registrar comentário. A ação é auditada.

**UC-05 - Exportar contatos.** Ator: perfil autorizado. Fluxo: filtrar -> aplicar supressão, elegibilidade por canal e regras de permissão -> gerar arquivo temporário -> registrar quantidade e solicitante -> permitir download seguro. Em caso de restrição, informar causa sem expor dados indevidos.

**UC-06 - Tratar opt-out.** Ator: responsável autorizado. Fluxo: receber solicitação -> localizar canal/contato -> aplicar supressão -> propagar a integrações pertinentes -> manter registro mínimo necessário para impedir novas abordagens.

## 5. Requisitos não funcionais

| ID | Eixo | Requisito e verificação | Meta sugerida para aceite |
|:--|:--|:--|:--|
| RNF-001 | Segurança | TLS em todos os acessos externos | Obrigatório |
| RNF-002 | Segurança | Senhas e tokens não ficam no frontend, repositório ou logs | 0 ocorrências em análise de segredos |
| RNF-003 | Segurança | Princípio de privilégio mínimo em Supabase e API | Testes negativos de todas as funções P0 |
| RNF-004 | Segurança | RLS nos objetos expostos pela Data API; restrição por GRANT/schema | Política testada em homologação |
| RNF-005 | Segurança | Validação de URL contra SSRF, IPs privados, redirecionamentos | 100% dos casos automatizados de bloqueio |
| RNF-006 | Segurança | Limitar upload/download e sanitizar texto antes de exibir | Testes contra XSS e arquivo malicioso |
| RNF-007 | Privacidade | Origem, finalidade, retenção e elegibilidade por canal rastreáveis | Nenhum contato exportado sem regra |
| RNF-008 | Privacidade | Evidências/HTML não são públicos e expiram por política | Testar acesso não autenticado e purga |
| RNF-009 | Privacidade | Supressão prevalece sobre segmentação/exportação | Zero casos de vazamento em testes |
| RNF-010 | Integridade | `cnpj` único, FKs e constraints em registros essenciais | Inserção duplicada não corrompe dados |
| RNF-011 | Integridade | Atualização idempotente e transacional por lote | Rodar lote 2 vezes sem duplicar |
| RNF-012 | Integridade | Reprocessamento não altera status nem notas comerciais | Zero divergências em teste de regressão |
| RNF-013 | Disponibilidade | Interface e API têm monitoramento e healthcheck | Disponibilidade alvo a pactuar após piloto |
| RNF-014 | Desempenho | Consultas paginadas com índices apropriados | p95 <=2 s para 50 itens no cenário de referência |
| RNF-015 | Desempenho | Coleta obedece a limite por domínio e recuo em 429/5xx | Evidência em testes com servidor simulado |
| RNF-016 | Escalabilidade | Crescimento por workers independentes sem partilhar browser entre jobs | Testes de concorrência com isolamento |
| RNF-017 | Escalabilidade | Não carregar toda a Receita por inserts HTTP individuais | Importação em lote ou `COPY` |
| RNF-018 | Resiliência | Lease e recuperação de jobs abandonados | Job retomado após encerramento forçado |
| RNF-019 | Resiliência | Retry limitado e tratamento distinto de falha permanente | Nenhum loop de tentativas sem fim |
| RNF-020 | Observabilidade | Logs estruturados com job_id, fonte_id, versão e causa | 100% dos jobs críticos rastreáveis |
| RNF-021 | Observabilidade | Alertar sobre queda de volume, erro e campos que sumiram | Alerta em teste de degradação |
| RNF-022 | Qualidade | Testes unitários, integração, contrato, E2E e RLS | Todos os testes P0 aprovados |
| RNF-023 | Qualidade | Linters, typing e migrations em CI | Pipeline bloqueia merge com erro |
| RNF-024 | Recuperação | Backup e restauração do PostgreSQL efetivamente testados | RPO/RTO a aprovar; proposta 24h/8h |
| RNF-025 | Recuperação | Evidências do Storage têm estratégia separada de backup | Teste de recuperação de objeto e metadado |
| RNF-026 | Manutenibilidade | Componentes de coleta independem da API e UI | Teste CLI funciona sem API online |
| RNF-027 | Manutenibilidade | Mudanças de esquema sempre versionadas | Alembic e revisão SQL obrigatórios |
| RNF-028 | Auditabilidade | Exportação, alteração comercial e supressão têm log imutável no nível de aplicação | Registros com ator, momento e ação |
| RNF-029 | Portabilidade | Processos executáveis em ambiente virtual Python, com configuração externa e scripts de inicialização | Rodar desenvolvimento e homologação sem alterar o código e sem contêineres |
| RNF-030 | Custos | Monitorar armazenamento, egress, conexões, jobs, browser e APIs | Limites e alertas configurados antes de produção |
| RNF-031 | Agendamento | A mesma lógica de validação, concorrência e spider é usada por coletas manuais e automáticas | Teste de paridade de resultados e políticas |
| RNF-032 | Agendamento | Disparos simultâneos e reinícios não criam jobs duplicados na mesma janela | 100% dos cenários automatizados sem duplicidade lógica |
| RNF-033 | Operação | O agendamento não depende de um navegador aberto, mas requer worker e máquina ativos | Teste com painel fechado; indisponibilidade visível no monitor |
| RNF-034 | Auditoria | Toda coleta registra origem, solicitação, horário, parâmetros e resultado | Job rastreável por ID e, quando aplicável, por agenda e usuário |
| RNF-035 | Integração Google | Chave/API restrita ao backend, segregada por ambiente, com quota e alertas de faturamento | Testes de vazamento de segredo, negação por quota e orçamento |
| RNF-036 | Integrações Google | Conteúdo Places segue controles de retenção, atribuição e finalidade contratados | Testes impedem INSERT/exportação de campos cuja retenção não foi autorizada |
| RNF-037 | Custos externos | Registrar consumo por API, impor tetos e monitorar erros de quota | Teste de orçamento esgotado e pausa segura |

**Nota:** tempos e percentuais são metas propostas, não compromissos de capacidade já demonstrada. O cenário de medição deve fixar quantidade de estabelecimentos, concorrência, filtros, volume de dados, compute e plano do Supabase.

## 6. Regras de negócio e decisão de qualidade

| ID | Regra | Justificativa |
|:--|:--|:--|
| RN-001 | Um CNPJ completo corresponde a um estabelecimento mestre | Não fundir matriz e filial |
| RN-002 | CNAE secundário é candidato para revisão, não entrada automática no universo | Evitar falso positivo no recorte |
| RN-003 | Só promover lotes oficiais com layout reconhecido e conferência quantitativa | Evitar corrupção silenciosa |
| RN-004 | Um site candidato não é site confirmado | Vínculo equivocado é risco comercial |
| RN-005 | Domínios bloqueados ou proibidos não serão rastreados | Respeitar permissões e restrições |
| RN-006 | Evidência observada é imutável; consolidação pode ser recalculada | Auditoria e reprocessamento |
| RN-007 | Score é explicável e versionado; limiares exigem calibração | Evitar percentuais arbitrários |
| RN-008 | Contato pode estar tecnicamente válido sem pertencer ao estabelecimento | Precisão do lead |
| RN-009 | Um link de WhatsApp publicado não significa opt-in para campanhas | Condição de abordagem distinta de descoberta |
| RN-010 | E-mail de contabilidade e central de rede deve ter classificação específica | Evitar contato comercial incorreto |
| RN-011 | Coleta nunca escreve em tabela de gestão comercial | Preservar trabalho do vendedor |
| RN-012 | Supressão tem precedência em exportação e integração de envio | Respeitar oposição/opt-out |
| RN-013 | Acesso a dados e exportações depende de perfil de usuário | Minimização de acesso |
| RN-014 | Todos os horários persistidos em UTC, exibidos conforme fuso de interface | Auditoria coerente |
| RN-015 | URL externa passa por validação de esquema, DNS, IP e redirecionamento | Prevenção de SSRF |
| RN-016 | Só fontes com permissão e finalidade documentadas entram na execução | Governança operacional |
| RN-017 | Disparo manual e automático entram na mesma fila e obedecem à mesma política | Evitar dois motores de coleta inconsistentes |
| RN-018 | Uma agenda pausada não gera novos jobs; pausa não significa cancelar automaticamente job já em execução | Previsibilidade operacional |
| RN-019 | A mesma partição/fonte/janela não deve originar coletas concorrentes equivalentes | Controle de recursos e deduplicação |
| RN-020 | Admin controla agendas; operador cria jobs manuais; comercial não dispara coletas | Restrição de acesso por papel |
| RN-021 | O requisito de descoberta de farmácias no Google Maps utiliza Places API (New), não Google Business Profile API | Google Business Profile é para locais próprios ou autorizados |
| RN-022 | Dados da Places API não são promovidos automaticamente a `core.estabelecimento`, `core.contato` ou `coleta.observacao_coleta` | Cumprir termos de cache, armazenamento e finalidade; exceções específicas exigem avaliação |
| RN-023 | `place_id` é referência externa; associação a CNPJ deve ser validada e não substitui cadastro oficial | Evitar confundir local Google com identidade fiscal |
| RN-024 | Google Places nunca será acessado por scraping do site Maps nem usado para alimentar automaticamente contatos persistentes no Supabase | Separar consulta contextual de ingestão autorizada |

### 6.1 Estados de qualidade de um contato

Um contato terá dimensões independentes: `validade_formato` (válido, inválido, indeterminado), `vinculo_estabelecimento` (confirmado, provável, não confirmado, rejeitado), `atualidade` (recente, vencida, desconhecida) e `uso_canal` (permitido sob política, restrito, suprimido). O score numérico poderá apoiar priorização, mas nunca substitui essas dimensões nem decide sozinho sobre licitude do tratamento.

### 6.2 Deduplicação

- Chave forte: CNPJ completo validado; persistência com UNIQUE.
- Raiz de CNPJ: agrupamento empresarial, sem fusão de unidades.
- Fonte sem CNPJ: sugestão de associação por nome, endereço e telefone, com limiares calibrados em amostra rotulada.
- Contato compartilhado: registrar associação a várias unidades, mas sinalizar central, rede ou contador.
- `UPSERT` de contato: chave natural composta por estabelecimento, tipo e valor canônico; evidências devem apontar para observações distintas sem reproduzir o mesmo evento em reexecuções.

## 7. Especificação de coleta e web scraping

### 7.1 Catálogo inicial de fontes

| Fonte | Papel | Coleta inicial | Condição de uso |
|:--|:--|:--|:--|
| Receita Federal - dados abertos de CNPJ | Universo cadastral e contatos de cadastro | Download e processamento de arquivos | Validar versão oficial e tratamentos de eventuais dados pessoais |
| Sites oficiais das farmácias | Complemento de e-mail, telefone, WhatsApp e site | Scrapy; Playwright quando necessário | Respeitar termos, políticas, limites e finalidade |
| Localizadores de redes | Contato/endereço por unidade | Spider especializado por domínio | Autorizar e verificar regras individualmente |
| Listas públicas de órgãos de saúde | Indícios de credenciamento/regularidade | Download/API caso disponível | Validar identidade e condições de reutilização |
| Google Places API (Google Maps Platform) | Descoberta e consulta de farmácias de terceiros no Google Maps | Text Search, Nearby Search e Place Details (API oficial); armazenar `place_id` | Resultados/contatos sob restrições de cache e atribuição; não exportar campos restritos como base de leads |
| Google Places Insights (evolução) | Inteligência territorial e IDs de locais no Brasil | BigQuery/assinatura do produto, se viável | Contratação e custos separados; validar cobertura e limites da consulta |
| Instagram Business Discovery | Metadados limitados, se houver caso aprovado | API oficial | Não raspar Instagram nem presumir acesso a contato privado |

### 7.2 Desenho dos spiders

| Spider / módulo | Entrada | Saída | Critério de fallback |
|:--|:--|:--|:--|
| `institutional_site_spider` | Site confirmado | Páginas de contato/sobre/rodapé e links | HTTP simples primeiro |
| `chain_locator_spider` | Fonte de rede autorizada | Unidade, telefone, endereço e evidência | Parser específico com testes de contrato |
| `dynamic_contact_spider` | URL dinâmica autorizada | DOM renderizado e contatos | Playwright se sem dados em HTML estático |
| `candidate_discovery` | CNPJ, cidade e sinais oficiais | Domínios candidatos e proveniência | Revisão humana quando vínculo fraco |
| `official_data_ingestor` | Arquivos oficiais e metadados | Lotes filtrados, snapshot e relatório | Não é spider web; pipeline separado |
| `google_places_search` (condicional) | Região/cidade/termo ou área/raio | Lista de `place_id` e resultados transitórios com atribuição | API oficial, não spider; limite de resultados não equivale a cobertura total |
| `google_places_details` (condicional) | `place_id` selecionado pelo usuário | Dados de contato atuais apenas para exibição permitida | Não promover conteúdo restrito ao pipeline comercial persistido |

### 7.3 Política técnica de rastreamento

1. Scrapy com `ROBOTSTXT_OBEY`, identificador de agente e canal de contato do operador.
2. Concorrência por domínio explicitamente limitada; AutoThrottle e atraso configuráveis.
3. Retentativas restritas a falhas transitórias, com backoff e `Retry-After`; bloqueios explícitos interrompem coleta.
4. Allowlist de domínios por fonte; limite de profundidade e páginas por estabelecimento; sem login, CAPTCHA bypass ou rotação para evasão.
5. Download timeout, tamanho máximo de resposta e controles de memória por worker/browser.
6. Proibição de URL localhost, metadata endpoints, IP privado, DNS rebinding e redirecionamentos internos.
7. Não renderizar/armazenar HTML bruto indefinidamente; evidência mínima necessária, com retenção definida.
8. A estratégia de checkpoint do Scrapy pode usar `JOBDIR` por execução; esta pasta é local ao job e não compartilhada entre spiders. Estado macro permanece em `job_coleta`.

### 7.4 Contrato de observação de campo

Cada valor extraído será registrado com `estabelecimento_candidato_id`, `campo`, `valor_bruto`, `valor_normalizado`, `fonte_id`, `job_id`, `url`, `trecho_limitado`, `hash_conteudo`, `coletado_em`, `versao_spider` e `status_validacao`. Um campo pode ser apenas uma *observação* e não deve aparecer como contato confirmado até que o resolvedor aprove a associação.

### 7.5 Tratamento de erros

| Situação | Ação obrigatória |
|:--|:--|
| HTTP 429 | Respeitar `Retry-After`; reduzir taxa; limitar retries |
| HTTP 500/502/503 | Backoff com máximo de tentativas; registrar causa |
| HTTP 403 / bloqueio | Parar domínio/job e enviar à revisão; não contornar |
| Layout alterado | Quarentena do parser, alerta por campos ausentes e fixture nova |
| Site indisponível | Preservar última evidência, reduzir atualidade e planejar revalidação |
| CNPJ inválido | Rejeitar vínculo automático; registrar erro de origem |
| Timeout JavaScript | Encerrar contexto do browser, liberar recurso e finalizar com status rastreável |
| Supabase indisponível | Buffer limitado e retry idempotente; não perder checkpoint silenciosamente |

### 7.6 Google Maps: descoberta de farmácias e consulta de contatos (escopo confirmado)

**Necessidade confirmada pelo negócio:** procurar farmácias no Google Maps e visualizar os contatos comerciais que constem das fichas. A solução correta é **Google Places API (New)**, não Google Business Profile. Esta última exige acesso aos perfis próprios/autorizados e não será desenvolvida para a prospecção de terceiros.

![Figura 5 - Descoberta no Google Maps sem ingestão de conteúdo restrito](google_integracoes.png){width=15.5cm}

**Fluxo de busca proposto:** (1) operador escolhe UF, município, termo ou área no painel; (2) FastAPI valida papel, parâmetros e orçamento; (3) usa Text Search para consultas por texto e/ou Nearby Search com área e categoria; (4) os resultados são apresentados com atribuição e, quando elegível, o `place_id` pode ser salvo como referência; (5) operador seleciona a farmácia e, sob demanda, chama Place Details para contato/site; (6) a interface exibe esses dados de forma transitória, sem gravar telefone, endereço, nome ou site recebidos exclusivamente da Places no CRM; (7) o sistema pode solicitar revisão de correspondência com um CNPJ mestre usando dados que possua legitimamente por outras fontes. **Não** presumir que toda busca retorna todas as farmácias: Text Search limita resultados e relevância, e Nearby Search depende da área e parâmetros.

| Componente Google | Uso projetado | Dados no Supabase | Limitação relevante |
|:--|:--|:--|:--|
| Text Search (New) | Pesquisar "farmácias em [município]" ou termos associados | ID do lugar, parâmetros e métricas próprias da consulta, sem copiar campos restritos | Máximo documentado de 60 resultados no total por consulta paginada; resultado não é universo completo |
| Nearby Search (New) | Procurar tipo de local por raio geográfico | `place_id` e auditoria de custo/uso, sob regras aplicáveis | Requer área/raio; resultados são recorte, não cobertura nacional garantida |
| Place Details (New) | Exibir telefone comercial, site e dados da ficha escolhida | Somente `place_id` como referência persistente por padrão | Telefone/site são campos de cobrança mais elevada; não podem ser armazenados livremente |
| Places Insights (P2 opcional) | Prospectar áreas e identificar IDs de locais por BigQuery | IDs permitidos vinculados ao CRM próprio | Produto por assinatura, acessível mediante contratação e com limites de consulta |
| Scrapy + Playwright | Extrair contatos de **sites independentes** com crawling autorizado | Evidências, contatos e proveniência dessas fontes, se licenças permitirem | Não utilizá-lo no site Google Maps nem como rota para contornar restrições da Places API |

**Esquema recomendado:** `core.google_place_ref(estabelecimento_id, place_id, vinculado_em, metodo_vinculo, revisado_por)` com referência única por local e `audit.google_places_consulta(id, usuario_id, endpoint, campo_mask, sku_prevista, custo_estimado, status, criado_em)`. Esta última tabela guarda metadados operacionais próprios e não as respostas completas do Google. Dados provenientes de outras fontes legítimas devem manter `fonte_id` e evidências próprias; nunca rotular informação do Google como se viesse da Receita ou de um site institucional.

**Configuração:** habilitar faturamento e Places API (New) em um projeto Google Cloud; restringir chave no backend e no uso permitido da API; usar máscaras de campos explícitas (`X-Goog-FieldMask`), em vez de `*`; aplicar limites de consumo por usuário, período e método, com bloqueio ao exceder o orçamento. A cobrança considera a SKU de maior nível incluída nos campos solicitados. Segurança e atribuições devem ser verificadas antes de publicar a integração.

**Modalidade manual e automática:** pesquisas no Google pelo painel serão **manuais/sob demanda** na primeira versão da integração. A execução automática já prevista no projeto permanece para **dados oficiais e scraping permitido**. Uma varredura automática ou armazenamento sistemático de conteúdo Google não está aprovado e exigiria reavaliação jurídica/contratual e orçamentária; o agendamento do sistema não altera permissões de uso da fonte.

**Critérios de aceite específicos:** consulta de farmácias em uma cidade; exibição de resultados e link Google Maps com atribuições corretas; consulta de detalhes quando selecionados; controle de faltas de resultados; impossibilidade de gravar/exportar contatos restritos do Google; associação manual por `place_id`; orçamento/quotas registrados; rejeição de termos fora de escopo; teste de falha 403/429 sem fallback para scraping Google Maps. Piloto deverá medir quantidade de consultas, custo por consulta e relevância dos resultados, sem confundir isso com aumento comprovado da cobertura cadastral.

**Fontes oficiais para validação da implementação:**

- Places Text Search (New): https://developers.google.com/maps/documentation/places/web-service/text-search
- Places Nearby Search (New): https://developers.google.com/maps/documentation/places/web-service/nearby-search
- Place Data Fields (New): https://developers.google.com/maps/documentation/places/web-service/data-fields
- Places Policies: https://developers.google.com/maps/documentation/places/web-service/policies
- Places Usage and Billing: https://developers.google.com/maps/documentation/places/web-service/usage-and-billing
- Google, Places Insights para leads: https://developers.google.com/maps/architecture/places-insights-sales-leads
- Places Insights (disponibilidade do Brasil): https://developers.google.com/maps/documentation/placesinsights/cloud-setup

**Ressalva de negócio:** se a exigência for **gravar permanentemente todos os contatos das farmácias apresentados pelo Google Maps**, o objetivo não é atendido nos termos normais da Places API. É necessário obter uma licença/solução expressamente compatível ou coletar os mesmos dados de fontes independentes cujo uso e armazenamento sejam permitidos. Não afirmar que o simples aparecimento de um número no Google permite incluí-lo no Supabase.

### 7.7 Estratégia mult fontes de prospecção - decisão de arquitetura (versão 1.5)

A plataforma terá um **cadastro mestre por CNPJ** e **conectores especializados independentes**, ao invés de um único robô central ou da extração em massa do Google Maps. Cada fonte fornece uma função diferente: cobertura cadastral, enriquecimento de contatos, confirmação de atividade, localização complementar ou pesquisa contextual. **Disponibilidade pública não equivale a licença de reutilização:** as colunas abaixo são orientações técnicas, não parecer jurídico definitivo.

![Figura 6 - Fontes permitidas, política de uso e dados comerciais](fontes_multiplas.png){width=15.5cm}

| Fonte concreta | Papel no produto | Persistência no Supabase | Pri. | Gate antes da ativação |
|:--|:--|:--|:--:|:--|
| **Receita Federal - dados abertos de CNPJ** | Universo de farmácias, CNPJ, CNAE, situação cadastral, endereço e contatos declarados | **Sim**, para campos de uso permitido, com fonte, competência, tratamento LGPD e revalidação | P0 | Validar layout/versão e regras de uso; processar o recorte em vez de importar todo o país |
| **Sites institucionais de farmácias** | E-mails de contato, telefone, links públicos de WhatsApp e redes | **Condicionada**: coleta e reutilização autorizadas por domínio, finalidade e canal | P0 | Confirmar que o domínio é da farmácia; política de acesso e SSRF; contato publicado não garante opt-in |
| **Localizadores de redes e franquias** | Telefones/unidades por loja, com vínculo empresa-filial | **Condicionada** a cada domínio e licença; separação filial x matriz | P1 | Teste de parser, autorização de coleta e associação unitária por CNPJ/endereço |
| **Farmácia Popular - lista de participantes** | Qualificação do estabelecimento e cruzamento de credenciamento | **Sob validação** das colunas reais e condições de reutilização da lista pública | P1 | Download versionado e conferência de presença/qualidade do identificador CNPJ |
| **Anvisa - consultas de farmácias/drogarias** | Indicador de autorização/regularidade, não fonte geral de telefones | **Sob validação** de mecanismo e uso, não presumir API ou extração em lote | P1 | Consulta oficial e documentação de permissão para processamento sistemático; filiais exigem cuidado |
| **OpenStreetMap** | Dados geográficos e eventualmente contatos/site declarados por contribuidores | **Possível conforme ODbL**, atribuição, obrigações de base derivada e tratamento de dados | P2 | Revisar impacto ODbL no dataset/redistribuição e origem de cada atributo; evitar limites de infraestrutura comunitária |
| **Fornecedores B2B licenciados** | Complementar contatos quando houver cobertura insuficiente | **Conforme contrato explícito**, retenção, uso comercial e direitos de exportação | P2 | Contrato, documentação de origem, licença por campo e tratamento LGPD aprovados |
| **Informação fornecida pela farmácia / comercial** | Correção e confirmação operacional de canal empresarial | **Sim, se a finalidade e base legal forem adequadas**, com origem e auditoria | P0 | Registrar quem informou, quando, finalidade e evidência de comunicação/consentimento quando necessário |
| **Google Places API (New)** | Busca e consulta contextual no Google Maps, sob demanda | **Por padrão só `place_id`**; conteúdo de ficha sem cópia permanente de CRM | P1 cond. | Aprovação de uso, cobrança, atribuições, máscaras de campo e fluxo sem exportação do conteúdo restrito |
| **Outras bases regionais/municipais** | Identificar estabelecimentos adicionais ou sinais de licenciamento | **A definir caso a caso**, mediante instrumento legal e licença concreta | P2 | Primeiro catalogar fonte, dataset, finalidade e política; não criar crawler genérico de órgãos |

**Evidência pesquisada em 23/10/2026:** o Ministério da Saúde disponibiliza uma lista atualizada de participantes do Farmácia Popular (02/10/2026), mas o layout do arquivo não foi validado neste projeto; a Anvisa oferece consulta pública de farmácias e drogarias autorizadas, não foi identificada aqui autorização geral de extração em massa. OpenStreetMap declara ODbL com atribuição e condições de compartilhamento de bases derivadas. O Google Places permite armazenar o `place_id` sob exceção específica, mas proíbe pré-busca e armazenamento geral de conteúdo de Places sob termos padrão. Referências oficiais estão no item 16.3.

### 7.8 Contrato único de conector e políticas por campo

**Interface lógica proposta:** `SourceConnector.discover(scope)`, `SourceConnector.fetch(cursor)`, `SourceConnector.parse(payload)`, `SourceConnector.normalize(observation)`, `SourceConnector.check_permissions(action, field)` e `SourceConnector.checkpoint(state)`. Nem todas as fontes fazem crawling: Receita e Farmácia Popular são importadores de arquivo; fornecedor usa arquivo/API contratada; input humano passa pela FastAPI; Google Places usa API de apresentação sob demanda em módulo próprio, **fora do pipeline de contatos persistidos**.

Campos mínimos de metadados: `fonte_id`, `tipo_fonte`, `licenca_versao`, `contrato_referencia`, `documentacao_url`, `permitir_coleta`, `permitir_persistencia`, `permitir_exibicao`, `permitir_exportacao`, `restricao_canal`, `retencao_dias`, `capturado_em`, `competencia_dataset`, `revisado_em`, `aprovado_por` e `estado_aprovacao`. Permissões e finalidades sensíveis devem ser modeladas também **por tipo de campo**, pois um dataset pode permitir armazenar CNPJ e restringir outro atributo.

**Portão de publicação (fail-closed):** observação bruta -> fonte/termos válidos -> dado permitido -> associação com CNPJ confiável -> verificação técnica -> verificação de vínculo -> classificação pessoal/empresarial -> supressão e canal -> consolidação -> disponibilização/exportação autorizada. Em caso de fonte pendente, contrato expirado, CNPJ ambíguo, erro de parser ou política indefinida: **quarentena**, com motivo e revisão humana. A aplicação não deve "herdar" a permissão de um contato de uma outra fonte quando o próprio valor só foi observado numa fonte restrita.

### 7.9 Política de persistência e segregação Google

- **`core.estabelecimento`** recebe dados da Receita e demais fontes com uso legítimo, não clones da resposta do Google.
- **`core.contato`** recebe apenas telefones/e-mails cujo `fonte_id` e política autorizem aquela persistência e finalidade. Exemplo: número identificado em `mailto:`/`tel:` de site institucional cuja coleta foi autorizada, ou campo do cadastro oficial, com atribuição de origem.
- **`core.google_place_ref`** admite apenas `place_id` e vínculo revisado a um CNPJ já conhecido por fonte independente. Não persistir JSON integral de Place Details, telefone ou website exclusivo da resposta Google, nem atributos em logs.
- **O scraper não deverá transformar uma resposta Google em lista de sites para crawling como forma de contornar os termos**. Fontes usadas no cadastro mestre precisam ser descobertas e justificadas de maneira independente.
- Se não existir fonte independente habilitada com telefone: exibir "Contato não confirmado na base própria"; oferecer consulta Google sob demanda na interface permitida, sem exportá-lo como dado de CRM.

### 7.10 Resolução de conflitos e prioridade de publicação

1. CNPJ de 14 dígitos, validado, identifica estabelecimento; **raiz de 8 dígitos não deduplica filiais**.
2. A fonte oficial governa identidade cadastral (CNPJ, CNAE e situação); demais fontes geram observações sem substituir silenciosamente esses dados.
3. Telefones iguais, após normalização E.164, consolidam-se como um único contato por estabelecimento e tipo, mantendo **todas** as evidências independentes. Telefones diferentes coexistem, com classificação de uso e atualidade.
4. Dados de rede/franquia podem pertencer à central; usar marca `compartilhado` e não replicar como contato confirmado de cada filial.
5. Conferência sintática de telefone, WhatsApp publicado ou MX do e-mail **não comprova entrega, titularidade nem permissão para contato comercial**.
6. Exportar apenas evidências autorizadas e atuais, com supressão aplicada e regra de canal aprovada. A ordem de prioridade (fonte oficial, site confirmado, informação da farmácia, fornecedor etc.) é **proposta**, ajustável após precisão amostral.

### 7.11 Piloto mult fontes e metas de verificação

Executar um piloto com uma UF a definir e uma amostra estratificada de farmácias independentes e redes. Rodar: (A) Receita isolada; (B) Receita + sites autorizados; (C) + Farmácia Popular/Anvisa com permissões verificadas; (D) canais fornecidos por parceiros/fornecedor contratado; (E) Google Places somente em consulta contextual. Registrar: CNPJs únicos, contatos adicionais únicos permitidos, contatos em quarentena, cobertura por UF, custo por contato elegível, rejeições, conflito de fontes e tempo de revalidação. Comparar ganho **incremental**; não somar totais brutos de fontes como se fossem novos leads.

**Gate de aceite:** uma mesma farmácia pode possuir contatos vindos de três fontes legítimas sem gerar três leads; perda de uma fonte não elimina as demais; revogação do direito de uso de uma fonte impede novas exportações afetadas; conteúdo Google restrito não persiste; todo campo comercial exportado possui `fonte_id` e justificativa de uso. Somente após esse piloto devem ser aprovadas metas nacionais e investimentos de APIs adicionais.


## 8. Modelo de dados Supabase / PostgreSQL

### 8.1 Modelo lógico de entidades

![Figura 7 - Relacionamentos principais (visão simplificada)](dados.png){width=15.5cm}

**Observação:** é um modelo lógico, não DDL executável. O diagrama omite campos operacionais, integridade e cardinalidades detalhadas, descritos a seguir.

### 8.2 Schemas propostos

| Schema | Acesso e finalidade |
|:--|:--|
| `ingest` | Lotes e metadados de importação, staging controlado |
| `core` | Cadastro mestre, contatos consolidados, candidatos e ligações |
| `coleta` | Fontes, jobs, observações, evidências e revisão |
| `comercial` | Status, responsáveis, notas, atividades e supressão |
| `audit` | Eventos de operação e exportações append-only |
| `api` (opcional) | Views/RPC explicitamente expostas, com permissões mínimas |

**Proteção de acesso:** schemas internos não devem ser expostos pela Data API por padrão. O backend usa usuário PostgreSQL com permissões restritas. Caso exponha `api` para frontend, configurar corretamente GRANT e RLS, inclusive em views; testar acesso `anon` e `authenticated`. Credencial de serviço ou senha de conexão nunca é entregue ao navegador.

### 8.3 Entidades, chaves e campos relevantes

| Entidade | Chave e campos centrais | Restrições/observações |
|:--|:--|:--|
| `ingest.carga_cnpj` | id, competencia, arquivo, checksum, layout, contagens, estado | Evitar promoção sem reconciliação |
| `ingest.rejeicao_carga` | id, carga_id, registro_referencia, erro | Volume e retenção a dimensionar |
| `core.estabelecimento` | id UUID, cnpj CHAR(14), cnpj_basico, CNAE, UF, município IBGE, endereço, situação, snapshot | UNIQUE(cnpj), índices por UF/município |
| `core.grupo_empresarial` | id, nome_normalizado, método_agrupamento | Não implica fusão |
| `core.site_candidato` | id, estabelecimento_id, dominio, origem, estado, score_vinculo | Revisão de ambiguidade |
| `coleta.fonte` | id, nome, tipo, licença/termos, finalidade, risco, ativa, revisada_em, estado_aprovacao | Nenhuma fonte desconhecida roda |
| `coleta.fonte_politica_campo` | fonte_id, tipo_campo, acao, permitido, validade, fundamento, revisao | `UNIQUE(fonte_id,tipo_campo,acao)`; negar por padrão |
| `ingest.dataset_externo` | id, fonte_id, versao, checksum, origem_url, importado_em, situacao | Versionar Farmácia Popular, OSM ou CSV contratado quando permitido |
| `coleta.conector_execucao` | id, fonte_id, job_id, adaptador_versao, cursor, aceitos, rejeitados | Estado e métricas por fonte, sem substituir `job_coleta` |
| `coleta.conflito_fonte` | id, estabelecimento_id, campo, evidencias, motivo, estado, revisado_por | Revisão de divergências e CNPJ ambíguo |
| `coleta.job_coleta` | id, fonte_id, partição, estado, idempotency_key, `origem`, `solicitado_por`, `agenda_id`, janela_logica, tentativas, lease, heartbeat, checkpoint | UNIQUE lógico por tarefa/janela; `origem` = manual ou automatico |
| `coleta.agenda_coleta` | id, fonte_id, tipo_job, parametros_json, periodicidade, horario_local, timezone, ativa, politica_atraso, proxima_execucao_em, ultima_execucao_em, criado_por, alterado_em | Só admin edita; reserva e avanço da agenda atômicos; `timezone` IANA |
| `coleta.observacao_coleta` | id, job_id, fonte_id, campo, valor_bruto, normalizado, timestamp | Dado observado, ainda não consolidado |
| `coleta.evidencia` | id, observacao_id, URL, snippet limitado, hash, storage_key, data | Acesso privado; retenção |
| `core.contato` | id, estabelecimento_id, tipo, valor, flags qualidade, score, revisao_em | UNIQUE(estabelecimento,tipo,valor) |
| `core.contato_observacao` | contato_id, observacao_id, algoritmo_versao | N:N, rastreia por que o contato existe |
| `comercial.lead_comercial` | estabelecimento_id, status, responsavel_id, atualizado_em | Isolado de writes de scraper |
| `comercial.historico_comercial` | id, estabelecimento_id, autor_id, campo, antes/depois, data | Append-only em aplicação |
| `comercial.supressao` | canal, valor_hmac, motivo, registrado_em | HMAC de contato normalizado; sem chave no frontend |
| `audit.auditoria_exportacao` | id, usuario_id, filtros, quantidades, finalidade, criado_em | Nunca gravar cópia desnecessária de todos os contatos |
| `audit.evento_sistema` | id, ator, acao, objeto, resultado, data, correlation_id | Retenção e mascaramento |
| `core.usuario_perfil` | auth_user_id, papel, ativo, criado_em | FK lógica/segura para Supabase Auth |
| `core.google_place_ref` (opcional) | estabelecimento_id, place_id, vinculado_em | Apenas referência/identificador, sem copiar campos de Places sob restrição |
| `audit.google_places_consulta` (condicional) | id, usuario_id, endpoint, fieldmask, sku_prevista, custo_estimado, status, criado_em | Guardar apenas metadados internos de uso/custo, sem payload restrito de Places |

### 8.3.1 Exemplo de persistência de múltiplas origens (regra obrigatória)

Um mesmo CNPJ recebe telefone A na Receita e telefone A no site confirmado; os dois registros devem preservar suas evidências próprias, mas `core.contato` exibe **uma única linha** para telefone A. Se o telefone B aparecer apenas na ficha Google, o telefone B **não** é inserido em `core.contato` pelo conector Places. Se um contato provém de CSV contratado cuja licença impede exportar, ele pode ser exibido ou mantido somente se essas operações estiverem explicitamente permitidas; o exportador precisa filtrar o uso por fonte/atributo, não apenas por `score`.

A trilha `coleta.fonte` -> `coleta.observacao_coleta` -> `core.contato_observacao` -> `core.contato` deve permitir demonstrar a independência real de cada evidência. A política de armazenamento do Supabase não altera os direitos de terceiros sobre os dados.

### 8.4 Índices, transações e migrations

- Índice único no CNPJ completo e nos contatos normalizados por estabelecimento/tipo.
- Índice composto `(uf, municipio_codigo)` e índices de datas para revalidação.
- `pg_trgm` para pesquisa aproximada se a medição justificar; `PostGIS` apenas se houver consulta geoespacial.
- Chaves estrangeiras, `NOT NULL` e `CHECK` para estados críticos, datas e scores.
- Inserções em lote e `INSERT ... ON CONFLICT` para reprocessamentos; observações com identidade de evento para evitar duplicidade por retry.
- Índice composto sobre agendas ativas e `proxima_execucao_em`; unique por chave de idempotência de job. Claims do scheduler com bloqueio de linha, sem executar scraping dentro da transação.
- Alembic como fonte de migrations da aplicação; scripts SQL revisados para grants, schemas, extensões e RLS. Nunca usar `db push` destrutivo sem revisão de diff e plano de rollback.
- Separar ambiente de testes e produção; toda mudança de banco deve passar por CI e snapshot/backup quando compatível com o risco.

### 8.5 Volume e estratégia para base nacional

O processamento completo de arquivos CNPJ nacionais pode ocupar dezenas de gigabytes e demandar muito mais espaço temporário do que a base filtrada de farmácias. **Não colocar todo o ZIP e todos os registros nacionais na base operacional do Supabase sem dimensionamento.** Preferir download/streaming em worker apropriado, validação local do layout, filtro de estabelecimentos e `COPY` apenas do recorte necessário. Avaliar custo de compute, armazenamento e egress após um ensaio com uma UF; armazenar manifestos e estatísticas de carga para reprodutibilidade.

### 8.6 Supabase Auth, Storage e backup

- **Auth:** login de usuários internos com identidade gerenciada pelo Supabase. Papéis de negócio no banco da aplicação, não em metadados de usuário editáveis pelo próprio usuário.
- **Storage:** bucket privado `coleta-evidencias` (nome sugerido). Guardar apenas artefatos autorizados, com objetos identificados por chave imutável e política de retenção; preferir snippets/metadata a HTML completo quando possível.
- **Segredos:** senha Postgres, token de serviço e chaves de fontes sob secret manager/variáveis protegidas no servidor. Chaves públicas do frontend não concedem acesso administrativo.
- **Backups:** contratar/verificar o nível apropriado de backups PostgreSQL; realizar restauração de teste. Backups automáticos do banco **não incluem os próprios arquivos armazenados no Supabase Storage**; esses exigem recuperação separada.
- **Conexões:** cuidar de limites de pool/conexões; workers não criam conexão por registro. Usar pool com teto configurado e transações curtas.

## 9. Contratos de API e navegação do painel

### 9.1 Princípios de API

API REST versionada (`/v1`), JSON, datas ISO 8601 UTC, paginação por cursor quando adequada, filtros documentados, erros padronizados com código e `request_id`, limites de taxa e validação de entrada. Apenas o backend com permissões adequadas escreve em dados internos; o usuário final não acessa PostgreSQL diretamente.

### 9.2 Endpoints previstos

| Método e caminho | Função | Papel mínimo sugerido |
|:--|:--|:--|
| `GET /v1/estabelecimentos` | Busca com filtros e paginação | comercial |
| `GET /v1/estabelecimentos/{id}` | Detalhes, contatos e evidências permitidas | comercial |
| `GET /v1/contatos/{id}/evidencias` | Histórico e classificação | comercial |
| `PATCH /v1/leads/{estabelecimento_id}` | Status, responsável, observações | comercial |
| `POST /v1/leads/{id}/atividades` | Registrar interação manual | comercial |
| `GET /v1/jobs` | Histórico e estado de jobs | operador |
| `POST /v1/jobs` | Disparar coleta **manual**; responde 202 com `job_id` | operador |
| `POST /v1/jobs/{id}/reprocessar` | Retomar/reexecutar com idempotência | operador |
| `POST /v1/jobs/{id}/cancelar` | Solicitar cancelamento auditável do job | operador |
| `GET /v1/agendas` | Listar agendas, próxima e última execução, estado | operador |
| `POST /v1/agendas` | Cadastrar recorrência de coleta | admin |
| `PATCH /v1/agendas/{id}` | Alterar parâmetros, suspender ou reativar agenda | admin |
| `GET /v1/agendas/{id}/execucoes` | Consultar jobs originados pela agenda | operador |
| `GET /v1/fontes` | Consultar fontes, termos e permissões por campo | operador |
| `GET /v1/fontes/{id}/politicas` | Mostrar permissões de persistência/exibição/exportação por tipo de campo | operador |
| `PATCH /v1/fontes/{id}` | Aprovar, suspender ou atualizar contrato, escopo e licença | admin |
| `POST /v1/importacoes/datasets` | Iniciar importação autorizada de Farmácia Popular/CSV contratado/OSM com versão | operador |
| `GET /v1/qualidade/fontes` | Cobertura incremental, custo, frescor e conflitos por fonte | gestor |
| `GET /v1/revisoes/conflitos` | Listar divergências de dados e vínculos entre fontes | revisor |
| `GET /v1/integracoes/google/places/buscar` (P1 condicionado) | Pesquisar farmácias por cidade/termo/raio com controle de custo | operador |
| `GET /v1/integracoes/google/places/{place_id}` (P1 condicionado) | Consulta transitória dos detalhes de local selecionado | operador |
| `POST /v1/integracoes/google/places/vinculos` (P1 condicionado) | Vincular referência `place_id` a estabelecimento após revisão | revisor |
| `GET /v1/integracoes/google/places/consumo` (P1 condicionado) | Auditoria de quota e custo das consultas | admin |
| `POST /v1/revisoes/vinculos` | Aprovar/rejeitar site candidato | revisor |
| `POST /v1/exportacoes` | Criar exportação filtrada e auditada | gestor |
| `GET /v1/exportacoes/{id}` | Estado/arquivo temporário autorizado | gestor |
| `POST /v1/supressoes` | Registrar bloqueio de contato/canal | privacidade |
| `GET /v1/metricas/cobertura` | Indicadores por UF, fonte e período | gestor |
| `GET /health` e `/ready` | Saúde/liveness e disponibilidade dependências | infraestrutura |

**Importante:** estes caminhos são contrato proposto e deverão ser consolidados no OpenAPI ao implementar; a lista não corresponde a endpoints já existentes.

### 9.3 Telas previstas do sistema

1. **Login e acesso:** autenticação, sessão e bloqueio conforme perfil.
2. **Visão geral:** total de estabelecimentos, contatos por nível de confiança, cobertura UF e últimas coletas.
3. **Tabela de leads:** pesquisa, filtros, paginação, seleção e exportação autorizada.
4. **Detalhe do estabelecimento:** cadastro oficial, contatos, data, tipo de verificação e evidências.
5. **Operação comercial:** status, responsável, observações, histórico e atividades.
6. **Monitor de coletas:** botão **Nova coleta** (manual, para operador), seleção de fonte/região, confirmação, jobs com origem manual/automática, filtros por fonte/região, erros, cancelamento autorizado e reprocessamento. **Aba Agendamentos:** recorrências, próxima execução, última execução e habilitação/pausa pelo administrador.
7. **Revisão de sites:** vínculos sugeridos, sinais usados e decisão humana.
8. **Administração:** usuários, papéis, fontes, regras e política de supressão.
9. **Auditoria e indicadores:** exports, alterações, qualidade, frescor e falhas.
10. **Buscar no Google Maps (condicionado):** pesquisa de farmácias, abertura de ficha de detalhes, referência por `place_id` e monitor de consumo; sem exportação nem persistência de campos restritos como leads.

### 9.4 Matriz de papéis sugerida

| Ação | Admin | Operador | Revisor | Comercial | Gestor | Privacidade |
|:--|:--:|:--:|:--:|:--:|:--:|:--:|
| Consultar leads permitidos | S | S | S | S | S | Conforme caso |
| Criar/reprocessar jobs manualmente | S | S | N | N | N | N |
| Criar/alterar/pausar agendas automáticas | S | N | N | N | N | N |
| Consultar agendas e histórico de coletas | S | S | N | N | Conforme política | N |
| Aprovar site candidato | S | S | S | N | N | N |
| Alterar status/nota comercial | S | N | N | S | S | N |
| Exportar contatos | S | N | N | N | S | Conforme política |
| Aplicar supressão | S | N | N | N | N | S |
| Administrar fontes/papéis | S | Conforme delegação | N | N | N | N |
| Buscar e consultar Places sob demanda (se aprovado) | S | S | S | Conforme política | S | N |
| Vincular `place_id` ao CNPJ após revisão | S | S | S | N | N | N |
| Consultar auditoria | S | Parcial | N | N | Parcial | Conforme finalidade |

`S` e `N` são propostas. A matriz final exige aprovação do negócio e testes por papel, inclusive registros de outros responsáveis se houver segregação por vendedor.

## 10. Segurança, privacidade e conformidade

### 10.1 Modelagem inicial de ameaças

| Ameaça | Impacto | Controle planejado |
|:--|:--|:--|
| Scraper acessa endereço interno por URL maliciosa | Vazamento de serviços internos | Bloquear IPs privados/link-local, DNS e redirecionamentos |
| Chave administrativa exposta no navegador | Leitura/escrita não autorizada | Segredos só em backend; scans de CI |
| RLS/GRANT incorreto | Vazamento entre perfis | Schemas privados, testes de acesso negativos |
| HTML malicioso exibido no painel | XSS | Renderizar como texto, sanitização, CSP |
| Vendedor exporta contatos suprimidos | Descumprimento de opt-out | Filtro central obrigatório na API |
| Dados incorretos vinculados a CNPJ | Abordagem errada | Review manual, provas e score calibrado |
| Processamento repetido causa duplicidade | Erro comercial e custo | Idempotência, locks e UNIQUE |
| Arquivos de evidência divulgados | Exposição de dados pessoais | Bucket privado, URLs temporárias e retenção |
| Excesso de jobs e custo | Indisponibilidade/sobrecusto | Quotas, timeouts, alarmes e limites por fonte |
| Uso da Places API para montar diretório/exportação permanente ou chave Google exposta | Violação contratual, cobranças indevidas e bloqueio | Isolamento por `place_id`, chave restrita, controle de quota e testes negativos de persistência |
| Perda ou corrupção do banco | Interrupção e perda de históricos | Backup, restauração testada, migrations com rollback |

### 10.2 Governança de dados

Cadastrar finalidade e condição de uso por fonte; documentar teste de legítimo interesse quando aplicável e revisá-lo com responsável jurídico; disponibilizar canal para correção, oposição ou exclusão; conservar o mínimo necessário e evitar coleta indiscriminada de dados pessoais. Aplicar a supressão antes da exportação e de qualquer integração. O tratamento público e a prospecção comercial requerem avaliação jurídica contextual: o fato de um contato ser público não estabelece autorização irrestrita para qualquer abordagem.

### 10.3 Restrições externas relevantes

A API Places do Google tem regras específicas de armazenamento e cache: o `place_id` é exceção explícita, mas isso não autoriza persistir indiscriminadamente seus demais campos em um banco de prospecção. As Business Profile APIs gerenciam perfis próprios/autorizados e **não fazem parte do escopo atual**; para descobrir farmácias de terceiros, utiliza-se a Places API apenas sob as condições contratadas. O uso de dados de Places em telas requer observar as regras de atribuição aplicáveis. O Instagram e o WhatsApp têm políticas próprias para API e comunicação comercial. As regras e contratos devem ser verificados na implementação, não inferidos a partir de práticas de terceiros.

### 10.4 Política de retenção sugerida para aprovação

| Categoria | Política inicial sugerida | Observação |
|:--|:--|:--|
| Cadastro oficial consolidado | Até substituição e exigências de rastreabilidade | Base cadastral pública de PJ; reavaliar dados pessoais |
| Observações/evidências mínimas | 12 meses, com reavaliação | Justificar necessidade e direitos |
| HTML bruto temporário | Até 90 dias, caso armazenado | Reduzir ao mínimo; acesso restrito |
| Logs técnicos sem valores sensíveis | 90 dias para operação inicial | Ajustar custos e política |
| Auditoria de exportações | Período definido com jurídico e negócio | Não definir retenção arbitrária como obrigação legal |
| Supressões | Enquanto necessário para evitar nova abordagem | HMAC com chave rotacionada sob procedimento |

**Pendente:** homologar prazos, bases legais e procedimentos de exclusão antes de operar com contatos pessoais em produção.

## 11. Testes, qualidade e homologação

### 11.1 Estratégia de testes por camada

| Camada | Testes | Evidência esperada |
|:--|:--|:--|
| Parsers/normalização | Unitários com fixtures HTML, CNPJ, telefones, e-mails | Relatório pytest |
| Ingestão oficial | Contrato de layout, checksum e reconciliação por UF | Manifesto e contagens |
| Scraping | Mock HTTP, robots, delays, bloqueio, timeouts, JS | Logs e testes de integração |
| Jobs | Idempotência, claim concorrente, lease e falha forçada | Ausência de job duplicado |
| PostgreSQL | Constraints, migrations, rollback, RLS e permissões | SQL testado em homologação |
| API | Contrato OpenAPI, validação, auth, autorização e paginação | Relatório de integração |
| Frontend | E2E das rotas críticas, acessibilidade, filtros e alterações | Relatório Playwright |
| Places API (P1 condicionado) | Termos/raio, FieldMask, place_id, cobrança, atribuição, 403/429 e bloqueio de persistência/exportação | Fixtures/mock de API e testes de integração sob quota controlada |
| Segurança | SSRF, XSS, exposição de credenciais, rate limit | Testes negativos |
| Operação | Backup/restore, alerta, indisponibilidade de fonte, fila | Runbook executado |

### 11.2 Casos de teste prioritários

| ID | Cenário | Resultado esperado |
|:--|:--|:--|
| TC-001 | Importar mesmo arquivo CNPJ duas vezes | Sem duplicação, mesma quantidade elegível |
| TC-002 | CNPJ inválido em staging | Registro rejeitado com motivo |
| TC-003 | Filiais com raiz igual e CNPJ diferente | Dois estabelecimentos mantidos |
| TC-004 | Layout oficial alterado | Carga bloqueada e alerta |
| TC-005 | Fonte responde 429 com `Retry-After` | Aguarda/reagenda dentro da política |
| TC-006 | Fonte declara caminho proibido | Spider não requisita caminho |
| TC-007 | URL redireciona para IP privado | Requisição bloqueada |
| TC-008 | Job perde worker no meio da coleta | Lease expira, retoma sem duplicar |
| TC-009 | Site da rede mostra contato central | Não atribuir automaticamente a todas as filiais |
| TC-010 | E-mail tem MX mas não vínculo confirmado | Não classificar como contato confirmado |
| TC-011 | Nova coleta de lead já negociado | Status, responsável e notas preservados |
| TC-012 | Usuário comercial tenta criar job | Acesso negado |
| TC-013 | Usuário comum tenta consultar dado não permitido | Acesso negado no backend e banco exposto |
| TC-014 | Exportar contato suprimido | Contato ausente e exportação auditada |
| TC-015 | Repetir importação de evidência idêntica | Sem observações duplicadas indevidamente |
| TC-016 | Storage privado acessado sem permissão | Download bloqueado |
| TC-017 | Restore de backup em homologação | Dados essenciais íntegros e teste documentado |
| TC-018 | Spiders param de encontrar telefones | Alerta de variação de preenchimento |
| TC-019 | Filtro por UF/CNAE e paginação | Total e páginas consistentes |
| TC-020 | Atualizar status comercial | Autor e mudança registrados no histórico |
| TC-021 | Operador inicia coleta manual pelo dashboard | API retorna 202/job_id e job aparece como manual no monitor |
| TC-022 | Operador clica duas vezes em Iniciar coleta | Nenhum job equivalente duplicado; exibe ID existente |
| TC-023 | Admin configura agenda diária e tick atinge o horário | Um job automático é criado com agenda_id e parâmetros corretos |
| TC-024 | Scheduler tick executado em paralelo por dois processos | Uma única ocorrência agendada e um job lógico |
| TC-025 | Máquina fica desligada durante execução prevista | Política de atraso aplicada na retomada sem avalanche |
| TC-026 | Admin pausa agenda e inicia novo tick | Nenhum novo job automático da agenda pausada |
| TC-027 | Usuário comercial tenta criar agenda | Acesso negado e evento auditado |
| TC-028 | Coleta manual e automática da mesma partição simultaneamente | Uma fica deduplicada ou aguarda, sem executar dois crawls equivalentes |
| TC-029 | Worker é interrompido após job automático | Lease expira, retoma idempotente e registros comerciais são mantidos |

**Cenários da descoberta Google (P1 condicionado):** TC-G01: consulta "farmácias" por cidade usa API oficial e máscara restrita; TC-G02: seleção de `place_id` consulta detalhes atuais; TC-G03: retorno sem telefone mostra campo indisponível sem inventar contato; TC-G04: resposta Places não grava nome/telefone/endereço/site como lead; TC-G05: orçamento esgotado bloqueia chamadas; TC-G06: exibição atende atribuições; TC-G07: campos restritos não entram no CSV; TC-G08: duplicidade/ambiguidade de vínculo é submetida à revisão; TC-G09: erro 429 não aciona scraper Google Maps.

**Cenários mult fontes obrigatórios:** TC-MF-01: mesma farmácia presente em Receita e Farmácia Popular permanece um CNPJ único; TC-MF-02: mesmo telefone de duas fontes origina um contato e duas evidências; TC-MF-03: fonte sem licença/termos aprovados é bloqueada; TC-MF-04: fonte autorizada apenas para exibição não é persistida/exportada; TC-MF-05: contato da Google Places não é gravado em `core.contato` ou nos logs; TC-MF-06: revogação de permissão bloqueia nova exportação; TC-MF-07: site com domínio não confirmado permanece em revisão; TC-MF-08: telefone de rede marcado como central não é atribuído como direto a cada filial; TC-MF-09: competência de dataset preservada em reimportação; TC-MF-10: fonte pausada não interrompe outros conectores; TC-MF-11: resultado OSM conserva atribuição e metadados de licença; TC-MF-12: importação de fornecedor sem contrato válido é rejeitada.

### 11.3 Critérios para aceite do piloto

- Carga oficial elegível reconciliada com a versão escolhida e diferenças documentadas.
- Pelo menos uma fonte autorizada com spider completo, testes de contrato, limitação por domínio e tratamento de erro.
- Catálogo mult fontes com matriz por campo e operação; validar pelo menos duas fontes **independentes** sem multiplicar o mesmo CNPJ/contato.
- Demostrar relatório incremental de contatos elegíveis por fonte e bloquear ingestão/exportação de origem restrita.
- Amostra de sites confirmados revisada por pessoa do negócio/QA; precisão reportada com tamanho da amostra e critério, não apenas porcentagem sem contexto.
- Banco Supabase com migrations reprodutíveis, contas separadas, segredos protegidos e testes negativos de acesso.
- Reprocessamento de jobs e de lotes não cria duplicidades nem sobrescreve gestão comercial.
- Um usuário operador inicia uma coleta manual pelo painel; o job aparece com origem e ID, progride em worker separado e retorna resultado consultável.
- Uma agenda ativa, configurada por admin, cria automaticamente um job no horário definido; agendas pausadas e ticks duplicados não produzem novas coletas indevidas.
- Política de janela perdida é demonstrada com máquina/agendador temporariamente indisponível, sem criação em massa de jobs atrasados.
- Painel mostra estabelecimentos, contatos com procedência, status e histórico.
- Exportação implementa supressão e registro de auditoria.
- Métricas mínimas de operação e restauração ensaiada antes de uso real.
- Aprovação jurídica e comercial para os canais efetivamente disponibilizados.

## 12. Planejamento de execução

### 12.1 Fases e entregáveis

| Fase | Entrega principal | Gate de saída |
|:--|:--|:--|
| F0 - Fundação | Decisões de escopo, cadastro de fontes, repositório, ambientes virtuais Python, scripts de execução, CI e projeto Supabase segregado | Acesso, licenças e ambientes validados |
| F1 - Base mestre | Pipeline Receita, dicionário, filtros, snapshots, migrations e contagens | Reconciliação validada no recorte-piloto |
| F2 - Descoberta e scraping | Conectores por fonte, site candidato, spiders, Playwright seletivo, ingestão complementar, evidências e fila única para jobs manuais/automáticos | Duas fontes independentes com ganho incremental comprovado e disparo manual pela API |
| F3 - Qualidade e deduplicação | Normalizadores, score, revisão humana e métricas | Precisão amostral e critérios atingidos |
| F4 - API e painel | Auth, RBAC, consulta, gestão de leads, exportação, **tela Nova coleta** e **gestão de agendas**, auditoria | UAT comercial, API, manual e agendas aprovados |
| F5 - Operação | Execução automática por cron/systemd timer/Agendador Windows, política de atrasos, reprocessamento, alertas, backups e escalonamento progressivo | Coleta automática demonstrada, runbooks, restore e custos medidos |

A estimativa de 16 a 23 semanas do documento-base é apenas uma referência para um profissional experiente em tempo integral, não um compromisso de entrega. Ajustar após F0/F1, capacidade real da equipe, volume de dados e eventuais exigências jurídicas.

### 12.2 Backlog técnico inicial (primeiras entregas)

1. Criar repositório com convenções, `.env.example`, lint, pytest e proteção de secrets.
2. Criar projetos Supabase isolados (ao menos dev e produção), contas de serviço de menor privilégio e migrations.
3. Implementar schema mínimo de fontes, carga, estabelecimento e job, com constraints e índices.
4. Construir importador de recorte oficial em ambiente local, com validação de layout e relatório.
5. Importar recorte da UF piloto para o Supabase e medir custo/latência/volume.
6. Implementar mecanismo de job com reserva atômica, retry, idempotência, origem manual/automática e rastreabilidade.
7. Construir primeiro spider para um domínio cuja coleta esteja autorizada.
7a. Implementar matriz de fontes/campos/ações, com estado aprovado/pendente, importador da lista Farmácia Popular após verificação de colunas e regras, e endpoint para registro de contato informado pela empresa.
7b. Criar testes de separação de conteúdo Google e avaliação do ganho incremental de dados por origem.
8. Registrar observações/evidências, normalizar e relacionar a estabelecimento.
9. Criar endpoints de lista/detalhe e autenticação básica com papéis.
10. Criar tela de tabela de leads, ficha de detalhes, monitor de jobs e **botão Nova coleta**, sem executar crawling na API.
11. Criar `coleta.agenda_coleta`, os endpoints de administração da agenda e comando Python `scheduler tick` integrado a cron/systemd timer/Agendador Windows; validar atraso, pausa e duplicação.
12. Implementar trilha comercial, supressão, exportação controlada e testes de acesso.
13. Executar homologação ponta a ponta incluindo disparo manual e automático com dados amostrais e critérios de aceite.
14. Projetar integração Google Places P1 condicionada a aprovação de termos, cotas e orçamento; priorizar busca manual + detalhe transitório + `place_id`, sem copiar respostas restritas para a base de leads. Considerar Places Insights P2 se necessário.

### 12.3 Estrutura proposta de repositório

```text
prospeccao-farmacias/
|-- pyproject.toml
|-- requirements.txt              # ou dependencias no pyproject.toml
|-- .env.example
|-- README.md
|-- docs/
|   |-- architecture/
|   |-- requirements/
|   |-- runbooks/
|   `-- governance/
|-- database/
|   |-- migrations/
|   `-- sql/                    # grants, policies, indices
|-- apps/
|   |-- api/                    # FastAPI, services, auth, schemas
|   `-- web/                    # React, TypeScript, Vite
|-- services/
|   |-- ingest_cnpj/            # arquivos oficiais, versao, filtro
|   |-- discovery/              # candidatos a sites e associacao
|   |-- connectors/             # importadores e adaptadores por fonte (Farmacia Popular, CSV, OSM condicional)
|   |-- source_policies/        # licenca por fonte/campo, persistencia e exportacao
|   |-- google_integrations/     # Places Search/Details isolados, controle de quota (P1 condicionado)
|   |-- crawler/                # projeto Scrapy e spiders
|   |-- normalizer/             # Pydantic, phonenumbers etc.
|   |-- resolver/               # evidencias, identidade, score
|   `-- scheduler/              # agendas, tick, jobs, lease, retry
|-- shared/                     # modelos e configuracoes Python
|-- tests/
|   |-- unit/
|   |-- integration/
|   |-- contract/
|   |-- e2e/
|   `-- fixtures/
|-- ops/                        # scripts de inicio, tarefa agendada, systemd e cron
`-- .github/workflows/
```

### 12.4 Definition of Done

Uma tarefa está concluída quando o código foi revisado, tem testes adequados, migrations versionadas se houve alteração de esquema, logs sem dados sensíveis, documentação de configuração, evidência de execução em homologação e critério de aceite demonstrado. Funcionalidade que depende de permissão jurídica ou de fonte não aprovada não é considerada liberada para produção.

## 13. Operação, monitoramento e resposta a incidentes

### 13.1 Métricas mínimas e alarmes

Coletas: jobs criados, iniciados, finalizados, **origem manual/automática, taxa de atrasos das agendas, próximas execuções vencidas**, tempo por fonte, erros por categoria, requisições 429/403, páginas processadas, campos encontrados, queda abrupta de preenchimento, fila acumulada e leases expirados. Dados: total elegível por UF, contatos com evidência recente, contatos rejeitados, duplicidade, percentual em revisão e versões de carga. Aplicação: HTTP p50/p95, erros 5xx, tentativas de acesso negado, exportações e custo por período.

### 13.2 Procedimento operacional resumido

- **Falha de importação:** bloquear promoção, preservar versão anterior, comparar layout, abrir incidente e reprocessar após correção.
- **Quebra de spider:** pausar fonte, registrar amostra/fixture, corrigir parser e liberar após teste de contrato.
- **Supabase indisponível:** suspender novas coletas, armazenar apenas buffer limitado e seguro; reexecutar jobs idempotentes após retorno.
- **Vazamento/acesso indevido:** revogar segredos, bloquear exportação e seguir plano de resposta a incidentes com responsáveis legais.
- **Perda de dados:** restaurar em ambiente segregado, validar integridade e aplicar procedimento documentado de recuperação.
- **Estouro de orçamento:** interromper integrações pagas e suspender novos jobs por fonte até aprovação.

### 13.3 Capacidade e custos a validar

Não há dados suficientes para afirmar custo mensal de Supabase, servidor ou APIs. Integrações Google, se aprovadas, deverão ter cota, limites de orçamento e aferição de preço vigentes antes de ser ativadas. Medir no piloto: tamanho da base filtrada, volume de observações por estabelecimento, tamanho de evidências, conexões simultâneas, CPU/RAM por browser, throughput, egress e retenção. Projetar produção a partir dessas medidas; a plataforma não deve depender de créditos gratuitos ou quotas não verificadas.

## 14. Riscos e decisões abertas

### 14.1 Registro de riscos prioritários

| ID | Risco | Impacto | Mitigação / decisão |
|:--|:--|:--|:--|
| R-01 | Uso de fontes ou contatos sem base legal/termos adequados | Alto | Revisão jurídica por fonte e por canal antes da exportação |
| R-02 | Associação de site incorreta a CNPJ | Alto | Revisão humana, score validado e evidências fortes |
| R-03 | Supabase subdimensionado para staging nacional | Alto | Filtrar antes de persistir, teste de volume e orçamento |
| R-04 | Scraper depender só de Playwright | Médio | Scrapy HTTP como padrão, browser seletivo |
| R-05 | Acesso indevido por políticas ou chave de serviço | Alto | Schemas internos, grants, RLS, RBAC e testes negativos |
| R-06 | Contatos de contabilidade classificados como farmácia | Alto | Heurística e revisão de contato compartilhado |
| R-07 | Quebra silenciosa por mudança de HTML | Médio | Fixtures de contrato e alertas por preenchimento |
| R-08 | Custos de ferramentas de busca e geocodificação | Médio | Orçamento, limites e validação de licenças |
| R-09 | Perda de histórico comercial no reprocessamento | Alto | Separação física e teste de regressão |
| R-10 | Backup apenas do banco, esquecendo Storage | Alto | Política independente de backup de objetos |
| R-11 | Excesso de papéis e schemas antes do MVP | Médio | Implementar menor conjunto viável, mantendo fronteiras |
| R-12 | Métricas de qualidade irreais sem baseline | Médio | Piloto, amostragem e calibração antes da expansão |
| R-13 | Exigir base nacional permanente a partir do Google Maps | Alto | Usar Places apenas para descoberta/consulta permitida e manter Receita como universo mestre |
| R-14 | Persistir/redistribuir dados Places sem permissão de armazenamento | Alto | Restrição técnica no pipeline, avaliação jurídica dos termos e teste de exportação |
| R-15 | Interpretar dado público como permissão irrestrita de reutilização | Alto | Contrato/licença e finalidade revisados por fonte e por campo; negar por padrão |
| R-16 | Atribuição incorreta de número de central a unidade de farmácia | Alto | Evidências por filial, classificação compartilhado e revisão humana |
| R-17 | Misturar dados OSM sujeitos a ODbL com dataset proprietário sem avaliação | Alto | Segregação de origem, atribuição e avaliação de obrigações derivadas |
| R-18 | Subestimar custo/benefício de fornecedores e APIs adicionais | Médio | Piloto incremental, monitoramento e teto por fonte |

### 14.2 Registro de decisões (a aprovar)

| ID | Questão e encaminhamento proposto | Status |
|:--|:--|:--|
| D-01 | Confirmar CNAEs 01/02/03; veterinárias 04 somente se aprovado | Pendente |
| D-02 | Definir UF e municípios do piloto | Pendente |
| D-03 | Definir quais canais o comercial pode usar e em que condições | Pendente |
| D-04 | Definir orçamento e permissões de APIs de descoberta/validação | Pendente |
| D-05 | Aprovar base legal, retenção, aviso de privacidade e responsável | Pendente |
| D-06 | Selecionar plano/região de Supabase e limites de armazenamento/conexão | Pendente |
| D-07 | Definir segregação por vendedor vs visibilidade global | Pendente |
| D-08 | Decidir Metabase inicial, React próprio ou ambos | Pendente; este documento especifica React como alvo |
| D-09 | Aprovar critérios amostrais de precisão e periodicidade de revalidação | Pendente |
| D-10 | Confirmar CRM existente e estratégia de integração futura | Pendente |
| D-11 | Definir RPO/RTO e backup de objetos do Storage | Pendente |
| D-12 | Confirmar responsáveis por operação, incidentes e homologação | Pendente |
| D-13 | Objetivo do Google é localizar farmácias e consultar contatos comerciais apresentados no Google Maps, não administrar fichas | **Definido pelo negócio**: usar Places API (New) |
| D-14 | Validar termos, modelo de exibição, licença, API key, faturamento, FieldMask, orçamento e viabilidade da Places API no piloto | Pendente; bloqueia ativação da integração |
| D-15 | Decidir se há necessidade futura de Places Insights/BigQuery no Brasil e cotar acesso | Pendente; evolução P2 opcional |

| D-16 | Aprovar fontes adicionais por fases: Farmácia Popular, Anvisa (consulta), sites/redes, OSM e fornecedores B2B; definir o que pode ser armazenado por fonte/campo | **Proposto; a liberação de cada fonte depende de aprovação individual** |
| D-17 | Aprovar canal de registro de contato fornecido pela empresa e evidência mínima | Pendente |
| D-18 | Escolher fontes complementares prioritárias com base no ganho real de contatos elegíveis por custo, e não na quantidade bruta de registros | Pendente após piloto |

## 15. Parecer técnico crítico sobre a arquitetura

### 15.1 Pontos fortes

1. **Separação entre cadastro mestre e enriquecimento.** O scraper não define sozinho o universo de farmácias, o que melhora mensuração de cobertura.
2. **CNPJ completo como identidade de estabelecimento.** Reduz fusões erradas entre unidades e redes.
3. **Procedência por campo.** Permite contestar um contato e explicar por que foi incluído.
4. **Workers independentes.** Evita acoplamento entre navegador, API e interface.
5. **PostgreSQL gerenciado no Supabase.** Reduz manutenção de infraestrutura, fornece ferramentas de autenticação e simplifica o início do produto.
6. **Separação da camada comercial.** Preserva status e histórico mesmo quando um coletor erra ou é reexecutado.

### 15.2 Pontos fracos e ajustes recomendados antes do código

1. **Fonte de descoberta insuficientemente comprovada.** A Receita não resolve, por si, qual é o domínio correto de cada farmácia. Este é potencialmente o maior gargalo de cobertura e deve ser testado com uma amostra antes de investir no dashboard.
2. **Risco de custo no Supabase.** Carregar o universo completo de CNPJs e HTML bruto no banco gerenciado pode custar muito mais do que manter somente o recorte farmacêutico e os dados consolidados. Exigir ensaio volumétrico.
3. **Pontuação de contatos não é verdade de campo.** DDD, MX e domínio vivo são evidências técnicas limitadas; sem validação humana por amostragem, score pode transmitir falsa confiança.
4. **Governança por canal ainda indefinida.** É inadequado liberar exportação integral de WhatsApp ou e-mails pessoais antes de decisões jurídicas e operacionais.
5. **Modelo de jobs e agendamentos precisa ser implementado com cuidado.** Um campo `status` não basta: precisa de reserva atômica, lease, heartbeat, limite de retentativas, idempotência e distinção entre acionamento manual e automático. Sem máquina ativa, a agenda não executará no horário previsto.
6. **Excesso de funcionalidade no MVP pode atrasar a prova de valor.** A prioridade deve ser uma UF piloto, uma fonte legalmente defensável e contatos medidos; mapa, integrações e CRM completo vêm depois.
7. **Risco de confundir serviço gerenciado com sistema completo.** Supabase não elimina trabalho de infraestrutura do crawler, monitoramento, retenção, segurança da API e backup dos objetos.
8. **O acúmulo de fontes não garante contatos válidos.** Fontes adicionais aumentam esforço de manutenção, resolução de conflitos, custo e exposição jurídica. A meta correta é contatos **novos e utilizáveis**, não números brutos somados de fornecedores.
9. **A descoberta pelo Google Maps não equivale a dados reutilizáveis para CRM.** Places permite localizar estabelecimentos e consultar detalhes, mas as regras de armazenamento e exportação impedem considerar seu conteúdo uma base permanente livre. Para prospecção nacional em escala, a Receita e fontes com reutilização autorizada continuam essenciais. O Places Insights pode aprimorar inteligência territorial, mas exige contrato e custos de BigQuery.

### 15.3 Recomendação de aprovação

**Aprovável com ressalvas como arquitetura de referência**, não como desenho completamente validado para produção nacional. Recomenda-se iniciar F0 e F1 imediatamente após as decisões mínimas de escopo e infraestrutura, mas **não escalar o scraping e não liberar exportações comerciais** sem validar fontes, associação site-CNPJ, políticas de canal, custos e testes de acesso. O marco de decisão mais importante é um piloto com dados reais, medição de qualidade e revisões documentadas.

## 16. Referências, rastreabilidade e histórico

### 16.1 Histórico de versões

| Versão | Data | Alteração |
|:--|:--|:--|
| 1.0 | 23/10/2026 | Especificação integrada inicial com Supabase, scraping e requisitos. |
| 1.1 | 23/10/2026 | Remoção da dependência de Docker e adoção de processos Python com `venv` e agendadores do sistema operacional. |
| 1.2 | 23/10/2026 | Definição de coletas manuais e automáticas, agendas no Supabase, endpoints, regras de concorrência, requisitos e testes. |
| 1.3 | 23/10/2026 | Inclusão condicional de Google Business Profile/Places, novos requisitos, controles de acesso, persistência, riscos, decisões, testes e desenho de integração. |
| 1.4 | 23/10/2026 | Objetivo confirmado: descoberta de farmácias e consulta de contatos no Google Maps via Places; removida gestão GBP do escopo, introduzidos endpoints, riscos, testes, diagrama e alternativa futura Places Insights. |
| 1.5 | 23/10/2026 | Arquitetura mult fontes: Farmácia Popular, Anvisa, sites, redes, OSM, fornecedores B2B e origem própria; matriz de permissão por campo; conectores, requisitos RF-059 a RF-072, testes TC-MF, novos riscos e decisões, diagrama e roteiro de validação. |

### 16.2 Origem das decisões

A visão de base mestre da Receita, fontes de enriquecimento, CNAEs, score, procedência, supressão e seis fases foi preservada do documento de referência enviado pelo solicitante. As escolhas adicionais de schemas Supabase, estratégia de filtragem antes do PostgreSQL, contratos de API, requisitos numerados, papéis, segurança SSRF, plano de testes e critérios de aceite são **complementações propostas neste documento**, não fatos observados em implementação existente.

### 16.3 Documentação técnica e normativa consultada

- Receita Federal. Dicionário e layout dos dados públicos do CNPJ: https://www.gov.br/receitafederal/dados/cnpj-metadados.pdf
- IBGE/CONCLA. CNAE 4771-7/01 e classificações correlatas: https://concla.ibge.gov.br/busca-online-cnae.html?subclasse=4771701&tipo=cnae&versao=9&view=subclasse
- Supabase. Database Overview: https://supabase.com/docs/guides/database/overview
- Supabase. Connecting to Postgres: https://supabase.com/docs/guides/database/connecting-to-postgres
- Supabase. Securing Your API: https://supabase.com/docs/guides/api/securing-your-api
- Supabase. Storage Access Control: https://supabase.com/docs/guides/storage/security/access-control
- Supabase. Database Backups: https://supabase.com/docs/guides/platform/backups
- Scrapy. Job persistence: https://docs.scrapy.org/en/latest/topics/jobs.html
- Scrapy. AutoThrottle: https://docs.scrapy.org/en/latest/topics/autothrottle.html
- Google Maps Platform. Places API Policies: https://developers.google.com/maps/documentation/places/web-service/policies
- Google Maps Platform. Place IDs: https://developers.google.com/maps/documentation/places/web-service/place-id
- Google Places (New). Text Search: https://developers.google.com/maps/documentation/places/web-service/text-search
- Google Places (New). Nearby Search: https://developers.google.com/maps/documentation/places/web-service/nearby-search
- Google Places (New). FieldMask e cobrança: https://developers.google.com/maps/documentation/places/web-service/data-fields
- Google Places Insights. Descoberta de leads: https://developers.google.com/maps/architecture/places-insights-sales-leads
- Google Places Insights. Dados do Brasil: https://developers.google.com/maps/documentation/placesinsights/cloud-setup
- Ministério da Saúde. Lista de Farmácias Participantes do Farmácia Popular, versão 02/10/2026: https://www.gov.br/saude/pt-br/composicao/sectics/farmacia-popular/publicacoes/farmacias-participante-do-programa-farmacia-popular/view
- Anvisa. Consulta de Drogarias e Farmácias autorizadas: https://www.gov.br/anvisa/pt-br/sistemas/consulta-de-drogarias-e-farmacias
- OpenStreetMap. Copyright, ODbL, atribuição e regras de derivados: https://www.openstreetmap.org/copyright
- Receita Federal. Repositório de Dados Abertos da RFB: https://www.gov.br/receitafederal/dados
- ANPD. Guia Orientativo - Legítimo Interesse: https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia_orientativo_hipoteses_legais_tratamento_de_dados_pessoais_legitimo_interesse

**Fim do documento.**

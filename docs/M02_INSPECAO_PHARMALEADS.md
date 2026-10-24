# M02 — inspeção de `public.pharmaleads`

Complemento agregado em 24/10/2026: SELECT de contagens, sem copiar valores de registros, mostrou 218 linhas; 216 com CNPJ nulo e 2 com CNPJ em máscara padrão. Também foram conferidos defaults de id identity, status, historico, created_at e updated_at. O importador M02 não tenta vincular automaticamente as linhas sem CNPJ e verifica as formas canônica e mascarada antes de inserir ou atualizar por CNPJ. Nenhuma linha foi modificada.

Data: 23/10/2026. Projeto confirmado no painel Supabase: `qxsdcrywsjkrpcbfgbxb` (`Luna_Whatsapp`, branch `main PRODUCTION`). Inspeção visual autenticada do Table Editor e da página de políticas RLS; duas consultas remotas `SELECT` somente de metadados (grants e FKs). Nenhum dado ou objeto modificado. Este registro não equivale a teste de conexão do backend nem a inventário completo de dependências.

## Estrutura observada

A tabela `public.pharmaleads` contém 218 linhas segundo o rodapé do editor no momento da inspeção. Não foram copiados dados de linhas. Colunas mostradas pela definição do painel:

| Grupo | Colunas e tipos |
|---|---|
| Identificação | `id bigint` identity, chave primária; `nome text not null`; `razao_social text`; `cnpj text` |
| Localização | `uf varchar(2) not null`; `cidade text not null`; `bairro text`; `endereco text` |
| Contato | `telefone text`; `whatsapp text`; `email text`; `website text` |
| Classificação e CRM | `cnae text`; `status text`; `responsavel text`; `duplicado boolean`; `observacoes text`; `historico jsonb` |
| Tempo e Google legado | `created_at timestamptz not null`; `updated_at timestamptz not null`; `google_place_id text`; `google_rating numeric(2,1)`; `google_reviews integer`; `google_status text`; `google_maps_url text` |

Restrições exibidas: `pharmaleads_pkey` em `id`; `pharmaleads_cnpj_key` UNIQUE em `cnpj`, que aceita `NULL`; `pharmaleads_status_check` para `Não contatado`, `Em contato`, `Respondido`, `Qualificado` e `Sem interesse`. `historico` tem padrão `[]`. Índices, triggers e dependências declaradas foram inspecionados posteriormente, conforme a seção de 24/10/2026 abaixo. A presença de CNPJ nulo no editor impede tratar os registros atuais como cadastro já validado por CNPJ completo. Não excluir ou reconstruir a tabela com base nesta inspeção parcial.

## RLS e risco observado

RLS está habilitado. O painel mostrou sete políticas; a modalidade permissiva foi confirmada nas três políticas cujas expressões foram abertas:

| Política | Comando | Papel exibido | Expressão confirmada |
|---|---|---|---|
| `Acesso apenas para autenticados` | ALL | authenticated | não inspecionada |
| `Permitir inserção e atualização` | ALL | public | `USING (true)`; opção de `WITH CHECK` não marcada no editor |
| `Permitir leitura pública` | SELECT | public | `USING (true)` |
| `pharmaleads_delete_policy` | DELETE | service_role | não inspecionada |
| `pharmaleads_insert_policy` | INSERT | authenticated, service_role | não inspecionada |
| `pharmaleads_select_policy` | SELECT | anon, authenticated | `USING (true)` |
| `pharmaleads_update_policy` | UPDATE | authenticated, service_role | não inspecionada |

Uma política `ALL TO public USING (true)` pode tornar ineficazes as restrições das demais políticas permissivas. Uma consulta `SELECT` ao catálogo confirmou que `anon`, `authenticated` e `service_role` possuem privilégios SQL de `SELECT`, `INSERT`, `UPDATE` e `DELETE` em `public.pharmaleads`. Isto indica exposição ampla da tabela pelos papéis da Data API; não foi feita tentativa de ler ou escrever linhas com esses papéis. Como há dados de contato e o projeto é compartilhado/produção, não vincular a aplicação à Data API nem colocar chave de serviço no frontend antes de revisar o uso atual e um ajuste seguro das políticas **desta tabela**. Não alterar políticas remotamente sem avaliar o impacto sobre o sistema que já usa o projeto.

## Consequência para o desenho de uma tabela

O esquema existente mistura cadastro, CRM, histórico JSON e campos Google. A migration Alembic multischema preparada para M02 não se aplica a este projeto. M02 deverá propor alteração aditiva e restrita a `public.pharmaleads`, preservando as 218 linhas e os consumidores existentes, após levantamento de dependências e backup/restore adequado. A regra de uma linha por CNPJ/filial ainda não está demonstrada: `cnpj` é nullable e os dados precisam de auditoria de qualidade antes de impor `NOT NULL` ou nova validação. Atualizações cadastrais e comerciais devem ser separadas por contratos de escrita, mesmo que fiquem na mesma linha. `historico jsonb` não demonstra por si só auditoria imutável, fila concorrente, proveniência ou supressão. Os campos Google existentes exigem revisão de finalidade e retenção no M21; não iniciar uso deles.

## Conexão local, sem compartilhar segredo

O login no dashboard permite inspeção visual, mas não configura o backend. Para uma inspeção de conexão **somente leitura**, usar o painel **Connect** para obter host, usuário, banco, porta e modo reais deste projeto; escolher conexão direta na porta 5432, ou pooler em modo *session* na 5432 se necessário. Guardar a senha do banco somente em configuração local protegida, sem enviá-la por chat ou adicioná-la ao repositório. Baixar o certificado CA do projeto e configurar TLS `verify-full`. Os nomes das variáveis estão em `.env.example` e a validação em `packages/backend/src/pharmaleads/infrastructure/database/settings.py`. O comando `python -m pharmaleads.infrastructure.database.cli inspect` abre uma transação read-only e lista somente metadados de `public.pharmaleads`; não lê linhas da tabela. Executá-lo somente após o ambiente ser configurado localmente e o destino conferido. **Nunca executar `upgrade --apply`, `downgrade --apply`, `bootstrap_roles.sql` ou `Test-M02.ps1 -Integration` neste projeto.**

Outra consulta `SELECT` ao catálogo não encontrou FKs de outras tabelas apontando para `public.pharmaleads`. Isso não exclui dependências em views, funções ou aplicativos. Próxima evidência antes de qualquer alteração remota: demais dependências e uso atual da tabela por outros sistemas; plano SQL revisável limitado ao alvo autorizado; forma de backup/restore e janela de mudança. M02 segue preparado localmente, sem integração nem aceite.

## Complemento de catálogo e logs — 24/10/2026

Após o pedido para continuar M02, foram executados no SQL Editor do mesmo projeto apenas `SELECT` em `pg_policies`, `pg_indexes`, `pg_constraint`, `pg_trigger`, `pg_depend`/`pg_rewrite`, `pg_proc`, `pg_publication_tables`, `information_schema.role_table_grants` e `pg_class`. Não se consultaram linhas de `public.pharmaleads` nem se executou DDL/DML. As políticas foram conferidas no catálogo, complementando a leitura visual anterior:

| Política | Comando | Papel | Modo | `USING` | `WITH CHECK` |
|---|---|---|---|---|---|
| `Acesso apenas para autenticados` | ALL | authenticated | permissiva | true | ausente |
| `Permitir inserção e atualização` | ALL | public | permissiva | true | ausente |
| `Permitir leitura pública` | SELECT | public | permissiva | true | ausente |
| `pharmaleads_delete_policy` | DELETE | service_role | permissiva | true | ausente |
| `pharmaleads_insert_policy` | INSERT | authenticated, service_role | permissiva | ausente | true |
| `pharmaleads_select_policy` | SELECT | anon, authenticated | permissiva | true | ausente |
| `pharmaleads_update_policy` | UPDATE | authenticated, service_role | permissiva | true | true |

`public` no papel de política significa todos os papéis. Políticas permissivas aplicáveis são combinadas por OR; portanto `ALL TO public USING (true)` abre o caminho de leitura e alteração para os papéis com grants, inclusive `anon`. O catálogo confirmou RLS habilitado, `FORCE RLS` desligado e propriedade da tabela por `postgres`. `anon`, `authenticated` e `service_role` têm grants SQL amplos na tabela (inclusive SELECT/INSERT/UPDATE/DELETE). Isso é um **risco concreto de acesso**, embora não tenhamos tentado ler ou alterar registros com a chave publicável. Fontes para a semântica: [PostgreSQL CREATE POLICY](https://www.postgresql.org/docs/current/sql-createpolicy.html), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) e [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys).

O catálogo retornou três constraints e dez índices; não há trigger de usuário na tabela. Há pares de índices btree aparentemente repetidos para `cidade`, `status` e `uf`, além de dois índices não únicos em `cnpj` e o índice único da constraint. São candidatos a revisão de desempenho/custo, **não a remoção nesta etapa**. Nenhuma view/materialized view dependente via `pg_depend`, função com referência textual a `pharmaleads` em `pg_get_functiondef`, nem participação de `pharmaleads` em `pg_publication_tables` apareceu nas consultas. A busca textual não detecta SQL dinâmico e o catálogo não revela aplicativos externos.

Nos Unified Logs, filtro de pathname exato `/rest/v1/pharmaleads`, intervalo exibido de sete dias, apareceram duas chamadas `HEAD` 200 em 24/10/2026, ambas compatíveis com nossos probes `select=id&limit=0`. Não apareceu outro acesso **por essa rota nesse período e nessa interface**. Isso não prova ausência de consumidores: clientes SQL diretos, outras rotas, períodos anteriores e limitações de retenção/cobertura dos logs permanecem fora da evidência. Não foram exportados logs nem copiados identificadores/dados de outras tabelas.

Plano revisável dentro de M02, sem execução remota agora: (1) identificar com o responsável pelo projeto os sistemas que usam `pharmaleads` e suas operações; (2) definir comportamento de leitura/escrita autorizado e estratégia de rollback/backup da própria tabela; (3) validar em ambiente segregado uma alteração **exclusiva das políticas/grants da tabela**, preservando dados e contratos dos consumidores; (4) apresentar diff SQL e evidência de testes antes de aplicar qualquer alteração em produção. Não criar papéis, schemas, funções ou tabelas adicionais nesse projeto; não usar `CASCADE`. Sem inventário externo e teste isolado, política corretiva, migração aditiva e CRM operacional permanecem bloqueados. M02 segue parcial, não homologado.

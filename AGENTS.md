# PharmaLeads — execução por módulo

Leia docs/CONTEXTO.md, docs/PROGRESSO.md, docs/DECISOES.md e docs/MATRIZ_REQUISITOS.md. Contrato canônico: docs/referencia/PHARMALEADS_ESPECIFICACAO_DEFINITIVA_CURSOR.md.

Execute somente o módulo solicitado. M00 aceito; M01 entregue e avanço ao M02 autorizado. M02 preparado localmente, integração/aceite pendentes (docs/M02.md); próximos módulos requerem pedido específico. Respeite G1 após M05, G2 após M14 e G3 após M23, com aceite humano registrado. Não confunda implementado, testado, integrado e homologado.

Alvo: Python/FastAPI + Supabase + React/TypeScript; sem backend Node paralelo nem Docker. Legado removido localmente por autorização expressa em 23/10/2026 (docs/LIMPEZA_LEGADO.md e DECISOES EX-04). Não restaurar código, SQL ou configurações antigas como base da nova versão.

Antes de editar código, leia .cursor/rules/sync-with-production-before-edits.mdc, inspecione git status/diff e preserve alterações existentes. Sem reset/stash/commit automáticos. Comandos de inspeção: git status --short; git diff --stat; rg --files. Comandos da fundação em docs/M01.md: ops/windows/Setup-M01.ps1, Start-Api.ps1, Start-Web.ps1 e Test-M01.ps1. Não há projeto npm na raiz; web atual em apps/web, com package.json e lock próprios.

Não ler/expor segredos, usar produção em testes, ativar API paga, coleta massiva ou publicar sem autorização. Política de fonte/campo/ação bloqueia por padrão; coleta nunca altera CRM; Google transitório condicional M21. Referências ausentes devem ser registradas, não reconstruídas.

As referências v1.5 fornecidas posteriormente estão em docs/referencia. Consultar docs/RECONCILIACAO_V15.md para RF-001–RF-072, conflitos de prioridades e limites de reuso. O Markdown definitivo reenviado é idêntico ao contrato canônico. Isto não autoriza aplicar o modelo multischema no projeto Supabase limitado a uma tabela.

M02: Alembic único em database/alembic.ini e database/migrations. Usar conexão explicitamente identificada e TLS; não carregar .env antigo. Não executar bootstrap/migrations contra destino ainda não identificado. Exclusão da tabela remota pharmaleads autorizada quanto à intenção, mas pendente de identificar projeto/schema e inspecionar dependências; nunca usar CASCADE ou excluir outras tabelas por suposição.

Restrição humana posterior (23/10/2026): no projeto Supabase `qxsdcrywsjkrpcbfgbxb`, schema `public`, alterar somente a tabela `public.pharmaleads`; nenhuma outra tabela ou objeto deve ser alterado. A migration M02 existente cria schemas, tabelas, papéis e funções e portanto NÃO pode ser aplicada nesse projeto. Após login, estrutura e RLS de `public.pharmaleads` foram inspecionadas visualmente; grants e FKs externas foram consultados somente em metadados, demais dependências ainda não. Não executar `upgrade`, `bootstrap`, `DROP` ou testes de integração contra esse projeto. Ver DECISOES.md D-06/EX-05, M02.md e docs/M02_INSPECAO_PHARMALEADS.md.

A CLI M02 agora bloqueia `upgrade/downgrade --apply` em destinos remotos; teste negativo local passou. Duas consultas `SELECT` no painel confirmaram grants amplos e nenhuma FK externa apontando para a tabela, mas outras dependências e consumidores continuam pendentes. Não remover a trava antes de substituir a migration multischema por plano revisado de uma tabela.

Em 24/10/2026 o usuário escolheu Data API como transporte inicial. Probe HTTPS `HEAD` de `public.pharmaleads` com chave publicável passou, sem ler linhas; ver DECISOES TEC-09 e M02.md. Isto não libera leitura/escrita operacional nem dispensa rever RLS permissiva e consumidores existentes. Não usar chave secret/service_role para contornar RLS nem conectar outras tabelas. M02 segue sem aceite.

O usuário confirmou uma tabela e nenhum projeto Supabase adicional. Papel planejado: cadastro de estabelecimentos/filiais por CNPJ completo mais estado comercial mínimo na mesma linha. Não confundir isso com esquema já inspecionado. Redesenhar M02 antes de qualquer aplicação; reavaliar módulos que exigem histórico, observações, filas, auditoria e supressões. Não afirmar que estão implementados com uma coluna JSON ou com dados locais sem demonstrar as garantias exigidas.

Antes da alteração informe objetivo, arquivos, dependências/riscos. Ao terminar registre pedido/entrega, arquivos, comandos com diretório, testes reais e omissões, requisitos/estados, segurança/limites, decisões, dependências humanas e próxima etapa. Pare no módulo escolhido.

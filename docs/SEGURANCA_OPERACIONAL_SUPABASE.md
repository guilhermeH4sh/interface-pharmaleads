# Proteção do Supabase compartilhado

## Contenção do incidente de 25/11/2026

Publicar código no GitHub não cancela jobs já criados no banco. Esta entrega não executa SQL remoto. O cancelamento e a recuperação precisam ser confirmados pelo operador do Supabase.

1. Executar `supabase/rollback_email_01_parar_jobs.sql` no projeto correto. Desagenda somente `pharmaleads-email-index` e `pharmaleads-email-backfill` e solicita cancelamento somente das execuções correspondentes de pg_cron.
2. Confirmar que esses dois nomes não estão mais em `cron.job` e que não há execução ativa deles em `pg_stat_activity`. Não cancelar indiscriminadamente outras conexões.
3. Com a carga estabilizada, executar separadamente `supabase/rollback_email_02_remover_auxiliares.sql`, se a reversão dos objetos auxiliares ainda for necessária. O script usa transação e limites de lock/execução; não usa CASCADE nem exclui leads. Se houver dependências ou timeout, parar e investigar, sem repetição automática.
4. Avaliar estatísticas e autovacuum antes de nova manutenção. Não agendar VACUUM, não usar VACUUM FULL durante o incidente. VACUUM comum permite reutilização interna de espaço; não promete reduzir o arquivo físico.
5. Confirmar normalização pelos logs de autenticação e conexões. Um build aprovado não prova recuperação do banco.

## Regras para novas rotinas

- DDL não pertence a cron. Índices exigem migration isolada, janela, revisão de locks e plano de reversão. `CREATE INDEX CONCURRENTLY` tem restrições e não pode ser executado dentro de transação.
- Nenhum novo job SQL é liberado nesta entrega. A CI bloqueia chamadas de criação/alteração de jobs nos diretórios `supabase` e `scripts`; a checagem é textual, não um parser nem substituto da revisão. Tornar o check obrigatório depende das proteções do GitHub.
- Quando uma rotina futura for aprovada: intervalo mínimo de cinco minutos, timeout menor que o intervalo, lote limitado, cursor de progresso e trava transacional `pg_try_advisory_xact_lock` envolvendo o lote na mesma transação. Não usar uma trava de sessão sem garantia de liberação.
- pg_cron serializa instâncias do mesmo job; ticks atrasados podem ficar na fila. Jobs distintos, clientes e repetições manuais continuam concorrendo pelos mesmos recursos.
- Manter a coleta diária no Render separada da manutenção SQL. Os scripts de reversão não alteram a agenda do Render.

## Monitoramento e isolamento pendentes

O Centrus disponibiliza `/health/ready`: consulta HEAD mínima em cada banco configurado, sem contagem ou conteúdo, timeout de três segundos, cache de um minuto e compartilhamento de chamadas concorrentes por processo. HTTP 200 confirma apenas essas leituras; não prova login, capacidade do pool ou todos os módulos. HTTP 503 é falha/degradação. Configurar monitor com intervalo de pelo menos um minuto; não há novos alertas externos enviados por este código.

Revisar logs existentes para: 5xx de autenticação acima de 5% em cinco minutos; três timeouts de middleware em dez minutos; três falhas consecutivas por job; transações ociosas acima de sessenta segundos. Definir destinatários e integração antes de ativar notificações.

Separação da prospecção, orçamento de conexões, `idle_in_transaction_session_timeout` e ajustes de autovacuum precisam de revisão do banco operacional inteiro. Nenhuma dessas configurações globais é modificada por esta entrega.

# Banco exclusivo do PharmaLeads

Projeto: `pharmaleads` (`zofekhywrxlgziqcfeml`). URL da API:
`https://zofekhywrxlgziqcfeml.supabase.co`.

O Luna_Whatsapp é um produto separado. Não aplicar scripts ou configurar coletores
PharmaLeads nesse projeto.

As migrations em `migrations/` registram a estrutura copiada do banco original:
todas as 28 colunas, chave primária, checks, RLS, funções, índices e triggers.
Os índices secundários e os triggers são aplicados depois da cópia, para preservar
exatamente os valores existentes. Nenhuma migration agenda jobs SQL.

As permissões da tabela continuam limitadas ao usuário autorizado. Somente essa
conta de acesso foi transferida para o Auth dedicado; sessões não são portáveis
entre projetos. O usuário precisa entrar novamente após a troca.

Os arquivos numerados antigos fora de `migrations/` são históricos e não devem ser
executados em lote. Backups de leads, senhas e tokens não pertencem ao Git.

O Render usa configuração não secreta em `render.yaml`; a agenda criada fora do
Blueprint também precisa apontar para o mesmo projeto. As variáveis secretas de
login permanecem no Render e no `.env` local ignorado pelo Git. A suspensão já
existente da agenda é preservada durante a migração.

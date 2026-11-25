# Correções da coleta — 24/11/2026

## Implementado

- Importar e sincronizar o CSV parcial após timeout ou saída anormal do Gosom, antes de apagar o diretório temporário. A rodada continua sinalizada como interrompida; não soma todas as consultas como concluídas.
- Continuar as rodadas estadual, nacional e agendada após erros. Uma execução com rodadas falhas termina como falha, mesmo quando salvou resultados de outras rodadas.
- Consultar o status a cada 60 segundos em repouso e 5 segundos durante coleta. Abas ocultas não iniciam consultas periódicas; consultas iniciais e controles continuam disponíveis.
- Versionar a criação das colunas e a restrição do CRM na migração 03. SQL não aplicado automaticamente.
- Carregar somente membros do CRM no Kanban. O modal de inclusão busca no servidor até 31 candidatos (mostra 30 e orienta refinar a pesquisa), com debounce e cancelamento de consultas antigas.
- Consultar os relatórios por uma RPC agregada, sem baixar os leads ao abrir. A exportação completa continua lendo a carteira somente quando solicitada pelo usuário.
- Adicionar `12_relatorios_agregados.sql`: função com SECURITY INVOKER e acesso apenas a authenticated; índice parcial para as chaves dos membros do CRM. Precisa ser aplicado antes de publicar o novo frontend. Sem a função, Relatórios mostra erro explícito e opção de tentar novamente; não apresenta zeros fictícios.

## Limitações ainda abertas do diagnóstico

- O CRM ainda carrega todos os seus membros, paginados por chave; a paginação por coluna do Kanban continua pendente para carteiras com muitos contatos em negociação. Relatórios depende da aplicação manual da migração 12; execução SQL e desempenho real ainda não verificados.
- Cobertura ainda usa o plano estático e não tem checkpoint persistente entre One-Off Jobs.
- Identidades Receita e Maps ainda precisam de conciliação conservadora entre fontes; não unir apenas por nome ou telefone compartilhado.
- Revisar índices e contagens com EXPLAIN no banco real antes de publicar mudanças de esquema.
- Confirmar OOM, bloqueio do Google e encerramentos por infraestrutura nos logs de uma execução real. Importar CSV parcial não recupera processos mortos pelo sistema antes de executar o tratamento.
- Otimização por carregamento dinâmico das telas foi retirada deste pacote; bundle permanece sem essa divisão.

Não houve carga, exclusão ou alteração de registros no Supabase neste trabalho. A migração 03 precisa ser aplicada antes da 04 em instalações novas; bancos existentes preservam suas colunas e defaults.

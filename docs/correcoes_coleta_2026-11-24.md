# Correções da coleta — 24/11/2026

## Implementado

- Importar e sincronizar o CSV parcial após timeout ou saída anormal do Gosom, antes de apagar o diretório temporário. A rodada continua sinalizada como interrompida; não soma todas as consultas como concluídas.
- Continuar as rodadas estadual, nacional e agendada após erros. Uma execução com rodadas falhas termina como falha, mesmo quando salvou resultados de outras rodadas.
- Consultar o status a cada 60 segundos em repouso e 5 segundos durante coleta. Abas ocultas não iniciam consultas periódicas; consultas iniciais e controles continuam disponíveis.
- Versionar a criação das colunas e a restrição do CRM na migração 03. SQL não aplicado automaticamente.

## Limitações ainda abertas do diagnóstico

- CRM e Relatórios ainda carregam a carteira inteira; precisam de paginação e agregação no servidor com migração compatível.
- Cobertura ainda usa o plano estático e não tem checkpoint persistente entre One-Off Jobs.
- Identidades Receita e Maps ainda precisam de conciliação conservadora entre fontes; não unir apenas por nome ou telefone compartilhado.
- Revisar índices e contagens com EXPLAIN no banco real antes de publicar mudanças de esquema.
- Confirmar OOM, bloqueio do Google e encerramentos por infraestrutura nos logs de uma execução real. Importar CSV parcial não recupera processos mortos pelo sistema antes de executar o tratamento.
- Otimização por carregamento dinâmico das telas foi retirada deste pacote; bundle permanece sem essa divisão.

Não houve carga, exclusão ou alteração de registros no Supabase neste trabalho. A migração 03 precisa ser aplicada antes da 04 em instalações novas; bancos existentes preservam suas colunas e defaults.

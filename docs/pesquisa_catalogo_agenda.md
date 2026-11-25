# Pesquisa do catálogo e coleta automática

## Interface

- Ao abrir Leads, nenhuma linha é consultada ou exibida até uma pesquisa explícita.
- Nos filtros inferiores, escolher um estado ou Todas as UFs, selecionar os tipos e clicar em Aplicar filtros consulta apenas `public.pharmaleads`. O formulário superior duplicado foi removido.
- Aplicar os filtros laterais também confirma o recorte escolhido. Limpar filtros esconde os resultados e exige nova pesquisa.
- A consulta inclui contatos já adicionados ao CRM. Não tem limite de 50 resultados: usa paginação e preserva exportação e seleção do recorte completo.
- A tela consulta atualizações do catálogo a cada minuto quando visível. Não consulta nem inicia jobs do Render.
- As métricas gerais continuam agregadas; não representam necessariamente o recorte da tabela.

## Agenda

O cron existente `interface-pharmaleads`, `crn-dbt381psrm7s73a3lk1g`, foi conferido no workspace Luna-AI. Usa `Dockerfile.agenda`, branch `main`, auto deploy e `0 10,16,22 * * *` (UTC): 07h, 13h e 19h em Brasília.

Cada execução escolhe até duas cidades de cada UF, incluindo uma única localidade no DF: 53 cidades por execução, 159 visitas programadas ao dia. Todas as 27 UFs entram em cada horário. As cidades e o estado inicial da fila alternam conforme data e horário, evitando recomeçar sempre pelas capitais. Localidades de UFs pequenas podem se repetir entre execuções, especialmente o DF.

O catálogo `api/municipios_ibge.json` contém 5.571 municípios obtidos da API oficial do IBGE. Atualização: `python scripts/atualizar_cobertura_ibge.py --todos-municipios`. O arquivo é incluído nas duas imagens Docker; não depende de uma chamada ao IBGE durante a coleta.

A data, quantidade de cidades e segmentos ficam fixados nos inputs do job. A troca de dia durante uma coleta não altera as cidades das rodadas seguintes. A fila diária não para pela meta de 1.000 leads.

Configuração opcional no cron (os inputs são propagados ao coletor):

- `AGENDA_CIDADES_POR_UF`: `1` ou `2`; padrão `2`.
- `AGENDA_SEGMENTOS`: segmentos separados por vírgula; padrão inclui varejo, manipulação, homeopatia, veterinária e distribuidoras.

Cada cidade usa uma rodada com até oito consultas, profundidade 1, concorrência 1 e timeout de 300 segundos do Gosom. Busca adicional de e-mails e enriquecimento de sites ficam desligados nessa agenda de descoberta; dados fornecidos pelo Maps continuam sendo salvos, inclusive sem e-mail. Confirmação de WhatsApp continua separada.

O aumento de rodadas amplia o trabalho e o tempo faturável dos One-Off Jobs. Os horários são disparos, não garantias de conclusão: bloqueios do Google, indisponibilidade do Supabase e outro job ativo podem atrasar ou impedir uma execução. O cron aguarda conflito por até uma hora; não cancela a coleta ativa. A rotação avança pelo calendário, mas ainda não há checkpoint persistente para retomar cidades que falharam em outro job.

## Validação

1. Abrir Leads: sem tabela, sem consulta REST de linhas e sem `/api/collector`.
2. Escolher SP e um tipo: somente os registros salvos desse recorte aparecem.
3. Pesquisar Todas as UFs: navegar pelas páginas e testar filtros de e-mail e exportação.
4. Limpar filtros: a tabela desaparece até nova confirmação.
5. Conferir a agenda no Render e os próximos One-Off Jobs: localidades são municípios, os logs atravessam as 27 UFs e os horários usam cidades distintas quando disponíveis.

Os testes usam processos simulados; não comprovam rendimento nem ausência de bloqueio em uma coleta real do Google. Nenhuma carga de leads foi disparada durante a implementação.

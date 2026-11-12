# Diagnóstico da coleta, 11/11/2026

## Medição disponível

Consulta somente leitura à única tabela `public.pharmaleads`: 12.611 registros, 5.068 com e-mail e zero com CNPJ no campo estruturado `dados_brutos.cnpj`. O job anterior estava em 95/131 rodadas e exibia 506 envios. Esse valor inclui upserts e não prova 506 leads únicos. A captura indicada pelo usuário (456 envios em 13 horas) equivale a cerca de 35 **envios** por hora; a taxa real de inserções antes da alteração não foi registrada. Logs detalhados do Gosom/Render e tempos por consulta não estavam disponíveis nesta análise.

| Causa | Evidência | Impacto | Mudança |
| --- | --- | --- | --- |
| Baixa concorrência | `render.yaml` fixa `GOSOM_CONCURRENCY=1` | Alto | Mantida em 1 no One-Off Job de 2 GB para reduzir risco de OOM |
| Visitas a sites em série | `enriquecedor.py` visitava até 100 sites com timeout de 15 s cada | Alto | Paralelismo limitado a 2 e timeout de 8 s, configuráveis |
| Consultas extras na sincronização | `supabase.py` consultava e-mails individualmente depois de cada upsert | Alto | Consulta prévia em lote; comparação antes do PATCH |
| Métrica enganosa | `synced_leads` somava registros enviados, inclusive existentes; SQLite temporário tratava cada rodada como nova | Alto | Contagem de inserções retornadas pelo Supabase e exibição separada |
| E-mail obrigatório | `cloud_job.py` força `-email`; `sincronizar_pendentes` não envia estabelecimentos sem e-mail válido | Alto para volume, necessário pela regra do produto | Mantido; reportar rendimento real |
| Consultas sobrepostas | Varejo usa farmácia, drogaria e farmácia 24 horas; 262 localidades em rodadas de até 8 buscas | Médio | Deduplicação adicional por nome/endereço exatos; medir consultas com resultado |
| CNPJ ausente | CSV Gosom não possui coluna CNPJ; UI sempre fixava vazio | Alto para completude | Extrair número único do site vinculado no Maps, validar dígitos e guardar origem/confiança |
| Avaliações descartadas | `banco.py` descartava `user_reviews` | Médio | Até cinco avaliações recentes resumidas em `dados_brutos` |
| SQLite | Importação já usa transação por CSV e chave primária; não há commit por linha | Baixo | Índice em nome/endereço para deduplicação exata |

Não há evidência suficiente para atribuir o baixo volume a CAPTCHA, rate limit ou falta de proxy. O Gosom escreve logs no stderr do job; verifique os logs do Render antes de aumentar a taxa. Resultados por consulta, duplicatas locais, leads novos/hora e duração da rodada passam a constar dos eventos da **próxima** execução.

## Limites da meta

O supervisor para após 1.000 leads únicos novos com e-mail ou ao acabar a fila nacional e informa o déficit. A meta não é garantida: depende de estabelecimentos públicos encontrados, e-mails reais e deduplicação. Uma coleta avulsa pode terminar abaixo da meta sem ser considerada erro. O job atual usa uma imagem anterior e não herda essas mudanças.

## Google Meu Negócio e avaliações

Google Business Profile lista locais que a conta autenticada administra; não é um catálogo de farmácias de terceiros. Portanto, não foi criada uma fonte fictícia “Google Meu Negócio”. A fonte de descoberta continua `Google Maps` via Gosom, que já devolve nota e contagem de avaliações. As avaliações recentes passam a ser preservadas quando o CSV as inclui. Taxa de resposta do proprietário não pode ser calculada com segurança sem dados completos de respostas. A Places API exige chave, faturamento e análise dos limites de armazenamento; antes de usá-la como fonte adicional, rever as políticas de dados da Google.

## Migração e configuração

Não há alteração de colunas no Supabase. `dados_brutos` já é JSONB e guarda `cnpj`, `cnpj_origem`, `cnpj_confianca`, `avaliacoes_recentes` e `fonte_dados`. No SQLite, a criação do índice é automática ao abrir `Banco`. Para aplicação manual, sem apagar registros:

```sql
CREATE INDEX IF NOT EXISTS lugares_nome_endereco ON lugares(nome, endereco);
```

Após uma falha do One-Off Job por uso acima de 2 GB, `GOSOM_CONCURRENCY` e `SITE_CONCURRENCY` foram reduzidas para `1`. A cobertura nacional encerra uma rodada após 5 minutos e pula para a seguinte se houver timeout, sem repetir a rodada lenta. As buscas continuam usando `-email` no Gosom; a visita adicional a sites via Playwright fica desligada no painel e na cobertura nacional para reduzir tempo e memória. CNPJ de site vinculado recebe confiança média; um dígito válido não comprova sozinho a titularidade do estabelecimento. Dados cadastrais da Receita, QSA e CNPJ de leads antigos ainda exigem uma fonte de correspondência verificável e um processo de revisão. Não são preenchidos por aproximação.

## Validação operacional

Execute `python -m unittest tests.test_cnpj_site tests.test_cloud_job tests.test_fluxo tests.test_supabase tests.test_render_service tests.test_render_jobs -q`, `node --test api/_collector.test.mjs`, `npm run build --prefix apps/web` e `npm run lint --prefix apps/web`. Em uma nova coleta, compare `new_supabase_leads / hora`, `queries_with_results / queries_completed`, `local_duplicates` e tempo de cada rodada. Confira o total real na tabela Supabase antes/depois. A parada deve levar o job ao estado `canceled` no Render e o painel a “Coleta cancelada”.

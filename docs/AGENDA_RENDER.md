# Agenda diária de prospecção

Cada horário inicia um One-Off Job de varejo no coletor existente, com profundidade 1. O job pesquisa uma UF por rodada, sem executar os estados em paralelo. A fila passa por todas as nove UFs mesmo se atingir a meta de 1.000 novos leads usada pela coleta nacional manual.

| Brasília | UTC | UFs |
| --- | --- | --- |
| 07h | 10h | SP, PR, SC, RS, MS, MT, GO, DF, TO |
| 13h | 16h | MG, ES, BA, SE, AL, PE, PB, RN, CE |
| 19h | 22h | RJ, MA, PI, PA, AP, AM, RR, AC, RO |

## Ativar uma vez

1. Publique os commits no GitHub. No Render, confirme o deploy atualizado do Web Service `pharmaleads-collector`. A Vercel deve continuar no modo One-Off Jobs para que o painel manual compartilhe o mesmo controle de concorrência.
2. No painel do Render, crie **um Cron Job** Docker a partir do repositório `guilhermeH4sh/interface-pharmaleads`, branch `main`. Use `./Dockerfile.agenda` e deixe o Docker Command padrão.
3. Em **Schedule**, informe `0 10,16,22 * * *`. Os horários do Render usam UTC.
4. Configure as variáveis abaixo no Cron Job. Os segredos são inseridos apenas no painel do Render.

   | Variável | Valor |
   | --- | --- |
   | `RENDER_COLLECTOR_URL` | URL HTTPS do Web Service existente, sem caminho |
   | `RENDER_COLLECTOR_TOKEN` | Mesmo token já cadastrado no Web Service |
   | `RENDER_API_KEY` | Chave com acesso aos One-Off Jobs do coletor |

5. Em **Runs**, confirme a próxima execução. Após o primeiro disparo, o log do Cron Job deve mostrar o ID do One-Off Job. A fila e o progresso ficam em **One-Off Jobs** e no painel de Prospecção. Se o coletor estiver ocupado, o disparador tenta novamente a cada minuto até o fim da primeira hora da janela. A agenda usa um identificador por data e horário para reconhecer um disparo recente repetido.

O Cron Job e os One-Off Jobs usam recursos cobrados pelo Render. O Cron Job só dispara a fila e termina assim que o One-Off Job é aceito. Cada rodada da agenda tem limite de cinco minutos no Gosom. Se uma UF falhar ou atingir o limite, a fila segue para as próximas e o job termina com indicação de falha parcial. A atualização do Supabase mantém as regras de elegibilidade já usadas pelo coletor.

## Ler os resultados nos logs

- `numOfJobsCompleted` conta atividades internas do Gosom.
- `places found` conta resultados de uma busca, que podem se sobrepor entre consultas.
- `synced_leads` conta registros enviados ao Supabase, incluindo atualizações.
- `new_supabase_leads` conta novos registros únicos inseridos na base.

# Diagnóstico e validação da coleta por UF

A interface usa React, Vite e Tailwind. A função Vercel valida a sessão Supabase e encaminha a execução ao serviço Python no Render. O trabalhador usa SQLite para importação e pendências. O catálogo online está em `public.pharmaleads`.

| Causa | Evidência | Impacto | Encaminhamento |
| --- | --- | --- | --- |
| Busca avulsa ampla | Varejo usa três termos, profundidade 1 e uma localidade informada pela interface | Alto para cobertura | A barra e o seletor agora convergem na mesma UF. O fluxo atual ainda faz buscas amplas pela UF. |
| Rendimento condicionado a e-mail | O trabalhador sempre habilita `-email`. Contatos novos sem e-mail válido ficam fora do Supabase | Alto | Preservar a regra de envio e medir separadamente estabelecimentos encontrados, contatos elegíveis e inserções. |
| Política de memória | O Render usava concorrência 1 imposta no supervisor. O diagnóstico de 11/11 registra OOM anterior num job de 2 GB | Alto | O ambiente pode configurar concorrência. O valor padrão continua 1 e requer medição antes de aumentar. |
| Rodadas e timeouts | O plano nacional limita o trabalho a 20 rodadas, com 300 s por rodada e descarte da rodada em timeout. Avulsa usa até duas tentativas e um intervalo de 5 s | Alto | Para a fonte cadastral, a retomada é transacional por arquivo. A fila do Google ainda tem os limites anteriores. |
| Cancelamento só do PID | O supervisor encerra o trabalhador, que antes encerrava apenas o PID principal do Gosom | Alto | O binário inicia em uma sessão POSIX e seu grupo recebe SIGTERM e, se precisar, SIGKILL. Eventos posteriores ao pedido de parada são descartados. |
| Versão, parâmetros e recursos | O Docker usa Gosom 1.17.1 e o executável Windows instalado reporta 1.18.1 com revisão adicional. A produção usa `-lang pt-BR`, `-exit-on-inactivity 3m`, `-c`, `-depth` e `-email`. As chamadas não configuram `-geo`, raio, zoom, fast ou proxy | Médio | Benchmarks locais e do Render devem usar a mesma versão e configuração. |
| Deduplicação e escrita | Importação SQLite por transação, CID quando disponível, comparação adicional por nome/endereço e upsert do Supabase por `chave` | Baixo para volume por si só | Medir duplicatas em vez de remover regras de identidade. CNPJ cadastral usa a inscrição completa, incluindo a filial. |
| Polling e acesso local | One-Off Jobs consultam estado e logs remotos. O 502 anterior foi reproduzido no Vite e rastreado ao proxy local | Médio para acompanhamento | O Vite já encaminha a função do coletor à Vercel. A duração do polling e seu impacto no Render exigem logs de produção. |

O Supabase tinha **12.813 registros**, **5.270 com o campo de e-mail preenchido** e **125 com CNPJ em `dados_brutos`**. Um recorte por texto no endereço ou em `local_busca` identificou **204 registros associados ao DF**. O recorte é indicativo porque depende de texto e inclui histórico. A série de métricas de um job anterior não está disponível para calcular um baseline equivalente. CPU, RAM e rede por rodada, CAPTCHA, consentimento e rate limit também seguem sem medição direta. O teto aproximado de resultados citado no pedido é uma hipótese a medir por consulta.

## Fontes e execução local

**Receita Federal.** Use os ZIPs de Estabelecimentos de uma única competência, baixados do repositório de Dados Abertos. O importador filtra por UF e situação ativa. Considera CNAEs principais e secundários 4771-7/01 a 4771-7/04 e 4644-3/01 a 4644-3/02. A classe 4773-3 é de artigos médicos e ortopédicos. A inscrição completa identifica cada estabelecimento. O importador guarda fonte, competência, data da importação, situação, nome fantasia, início da atividade, endereço, CNAEs, telefones e e-mail cadastral. O código de município da Receita é mantido no seu sistema de identificação. Razão social, porte e QSA exigem os arquivos Empresas e Sócios da mesma competência. [Layout da Receita](https://www.gov.br/receitafederal/dados/cnpj-metadados.pdf/view) · [Classificação do IBGE](https://cnae.ibge.gov.br/?view=estrutura)

```powershell
python -m scripts.importar_receita_uf --uf DF --competencia 2026-10 --banco dados/receita-piloto.sqlite .\Estabelecimentos0.zip
python -m scripts.atualizar_cobertura_ibge --cache-localidades dados/receita-piloto.sqlite
```

Passe todos os ZIPs da competência para medir a cobertura cadastral da UF. Ao reexecutar o mesmo comando, o importador pula os arquivos concluídos e recomeça o arquivo interrompido. O SQLite registra o checkpoint e os dados do arquivo na mesma transação. O cache do IBGE é atualizado sob demanda. A consulta real gravou 27 UFs e 5.571 municípios. [API de localidades do IBGE](https://servicodados.ibge.gov.br/api/docs/localidades)

**Correspondência.** Os scripts existentes coletam candidatos por CEP/UF ou telefone. O revisor exige nome fantasia compatível, logradouro distintivo e mesmo número, e registra um nível de confiança para revisão. Essas saídas locais não vinculam CNPJs automaticamente ao catálogo.

**Google Meu Negócio.** O Business Profile exige OAuth e dá acesso aos perfis administrados pela conta autorizada. Uma integração com perfis próprios precisa de acesso autorizado e credenciais da aplicação. Os termos do Maps restringem downloads em massa. Por isso, a ampliação de cobertura cadastral usa a Receita. [Google Business Profile](https://developers.google.com/my-business/content/location-data) · [Termos do Google Maps](https://www.google.com/help/terms_maps/)

**Concorrência.** Configure `GOSOM_CONCURRENCY` no ambiente do Render entre 1 e 4 e `SITE_CONCURRENCY` de acordo com o limite do enriquecedor. O padrão permanece 1. Após qualquer ajuste, compare tempo, memória, consultas com resultado, duplicatas e novos registros por minuto, usando a mesma UF, versão e seleção de segmentos.

## Validação e próximos pontos

- Testes web cobrem nome e sigla das 27 UFs e rejeição de município. O formulário mantém a cobertura nacional existente quando a barra e o seletor estão vazios.
- Teste de integração local alimenta o coletor por uma amostra controlada. Os testes do importador cobrem UF, CNAE secundário, contato, deduplicação, reversão de arquivo inválido e retomada.
- O teste de cancelamento confirma os sinais ao grupo Linux com subprocesso simulado. A confirmação de ausência de órfãos após uma parada real no Render depende de executar um job autorizado com o novo código.
- A retomada do importador ocorre por arquivo. A persistência de checkpoints do Gosom entre instâncias do Render, os benchmarks comparáveis de DF/SP no Maps, as fontes cadastrais no menu da interface e a integração OAuth seguem pendentes.
- Nenhuma alteração de schema foi aplicada no Supabase. O piloto cria tabelas apenas no SQLite indicado no comando e não publica registros.

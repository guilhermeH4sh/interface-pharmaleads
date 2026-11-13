# PharmaLeads — coleta de estabelecimentos

Aplicação local para buscar estabelecimentos farmacêuticos no Google Maps por meio do
[gosom/google-maps-scraper](https://github.com/gosom/google-maps-scraper), guardar os
resultados em SQLite e consultar, filtrar e exportar leads numa interface React.
O scraper pode rodar localmente ou em One-Off Jobs do Render. A interface publicada na Vercel consulta
`public.pharmaleads` no Supabase após login com a conta autorizada. A Vercel não executa
o Gosom nem armazena o SQLite local.

## Interface publicada

Abra [pharmaleads.vercel.app](https://pharmaleads.vercel.app) e entre com o e-mail e
senha do usuário Supabase que tem acesso à tabela. A senha é enviada pelo navegador
diretamente ao Supabase Auth; não está no repositório nem é enviada à Vercel. O navegador
mantém a sessão apenas durante a aba, e a política RLS limita a leitura à conta autorizada.
A interface mostra os leads já presentes no Supabase e permite filtrar e exportar CSV.

Com o login Supabase já configurado no `.env` local, cada CSV importado é enviado
automaticamente à tabela online. Falhas de rede deixam os registros numa fila SQLite
local; rode `python -m pharmaleads sincronizar-supabase` para reenviá-los. A coleta
iniciada pelo navegador local continua restrita a `127.0.0.1`.

### Ativar o botão de coleta online no Render

O painel chama a função Vercel `/api/collector`, que valida a sessão Supabase e encaminha o
pedido ao Web Service do Render. Com One-Off Jobs ativado, o serviço inicia uma
instância separada de 2 GB que executa Gosom, Chromium e Playwright. Os leads com
e-mail continuam sendo enviados para `public.pharmaleads`.

1. No Render, crie um **Blueprint** a partir deste repositório. O arquivo `render.yaml`
   cria o serviço `pharmaleads-collector` no plano Starter usando `Dockerfile.render`.
2. Durante a criação, preencha `SUPABASE_EMAIL`, `SUPABASE_PASSWORD` e
   `RENDER_COLLECTOR_TOKEN`. Gere uma chave longa e aleatória e não a publique.
3. Copie a URL HTTPS `onrender.com` do serviço.
4. Na Vercel, em **Settings > Environment Variables**, configure para Production:
   `RENDER_COLLECTOR_URL` e o mesmo `RENDER_COLLECTOR_TOKEN`.
5. Quando o Render estiver **Live** com a versão que suporta One-Off Jobs, adicione
   `RENDER_API_KEY` em **Vercel > Settings > Environment Variables > Production**.
   Use uma chave da API do Render com acesso ao serviço, aos jobs e aos logs do
   workspace. Guarde a chave somente na configuração de servidor da Vercel.
6. Faça um **Redeploy** na Vercel. Na aba **Prospecção**, use **Pesquisar** com uma
   cidade e um segmento. O job aparece em **One-off Jobs** no serviço do Render.

Sem `RENDER_API_KEY`, o painel usa o modo anterior, que executa a coleta dentro do
Web Service. Com a chave, a instância de 2 GB é cobrada pelo tempo do job, além do
plano do serviço base. O painel acompanha o status pela API do Render e as etapas,
rodadas e contagens pelos logs do job. **Parar coleta** solicita o cancelamento.
Uma cobertura nacional encadeia as rodadas dentro do mesmo job e interrompe a fila
em caso de falha. Os resultados já enviados ficam no Supabase.

O painel também oferece **Enriquecer sites de leads novos**. Quando ativada, após a
busca no Maps o contêiner usa o Playwright para visitar somente a
página inicial pública de até 25 sites dos novos estabelecimentos. Ele procura e-mails,
links de WhatsApp e redes sociais. E-mails e WhatsApp complementam o registro existente;
as redes sociais ficam em `dados_brutos`. Esta opção aumenta a duração da rodada e não
visita sites de leads que já estavam na base.

Para revisar **leads já cadastrados** sem e-mail, existe uma varredura local
com Playwright. Ela usa a lista fixa em `dados/recuperacao_emails.json`,
visita somente sites públicos associados a esses leads e salva candidatos
com a URL de origem. Não cria leads nem grava candidatos automaticamente no
Supabase: confirme nome, endereço ou telefone, a página que publica o contato
e o domínio de e-mail antes de atualizar o registro existente.

```powershell
python -m scripts.preparar_fila_playwright
npm ci --prefix apps/web
node scripts/scan_playwright_emails.cjs dados/fila_playwright_emails.json dados/candidatos_playwright_emails.jsonl 100
```

No Windows, a varredura usa o Microsoft Edge instalado. Em outro sistema,
instale o Chromium do Playwright ou defina `PLAYWRIGHT_BROWSER_PATH` para o
executável do navegador. O arquivo de saída é retomável: uma nova execução
pula os leads já examinados.

Para leads sem site, um piloto cruza CEP/UF com os [dados abertos do CNPJ da
Receita Federal](https://www.gov.br/receitafederal/dados/cnpj-metadados.pdf),
espelhados em Parquet pelo CNPJ Aberto (competência de setembro de 2026):

```powershell
python -m pip install --target dados/.deps duckdb==1.4.1
python -m scripts.preparar_fila_cnpj
python -m scripts.cruzar_cnpj_publico --shards 1
python -m scripts.revisar_cnpj_candidatos dados/cnpj_candidatos_piloto.jsonl
```

O cruzamento gera **candidatos locais**, sem atualizar o Supabase. Mesmo com nome,
rua e número coincidentes, confira o CNPJ, o contato e o domínio: o e-mail
cadastral pode pertencer ao contador ou a outro ocupante do endereço.

Uma segunda busca cruza o telefone exato dos mesmos leads com os estabelecimentos
do CNPJ. Ela inclui leads sem CEP e também salva apenas candidatos locais:

```powershell
python -m scripts.cruzar_cnpj_telefone --somente-preparar
python -m scripts.cruzar_cnpj_telefone --usar-fila-existente --shards 1 --saida dados/cnpj_candidatos_telefone_piloto.jsonl
```

Telefone compartilhado por filiais, contadores ou antigos ocupantes não comprova
que o e-mail pertence ao estabelecimento. Confirme nome e endereço antes de usar.

Em **Filtros da coleta**, marque **Cobertura nacional** e use **Iniciar coleta** para
percorrer as 27 capitais, intercalando as regiões,
e depois uma cidade do interior nos estados grandes — São Paulo entra com duas. Cada
rodada continua limitada a oito consultas para preservar estabilidade. O supervisor do
Render inicia a próxima rodada automaticamente; **Parar coleta** encerra a rodada em
andamento e impede as seguintes. Uma falha interrompe a fila. E-mail é obrigatório e o
enriquecimento permanece ativo. A grade **Cobertura por UF** lê `ultima_coleta`
dos leads já salvos em `public.pharmaleads` e mostra a data mais recente de cada estado.

## Requisitos

- Windows 10/11; Python 3.11 ou mais novo (a API usa apenas a biblioteca padrão).
- Node.js 24 LTS e npm, para instalar e compilar a interface.
- Gosom Google Maps Scraper para Windows. Baixe o executável na página oficial de
  [releases](https://github.com/gosom/google-maps-scraper/releases), extraia caso venha
  compactado e salve como `bin/google-maps-scraper.exe`. No macOS/Linux, salve como
  `bin/google-maps-scraper` e execute `chmod +x bin/google-maps-scraper`.
- Acesso à internet para a coleta real. A instalação de dependências também exige internet.

## Instalar e iniciar (PowerShell)

Abra o PowerShell **na pasta que contém este README**:

```powershell
cd C:\Users\guilh\Downloads\TRAMPOS\PharmaLeads\PharmaLeads
python -m pharmaleads verificar
cd apps\web
npm ci
npm run build
cd ..\..
python -m pharmaleads.api
```

A última linha mantém a API em execução. Abra **http://127.0.0.1:8765** no navegador.
Use `Ctrl+C` no terminal da API para encerrar a aplicação. Na primeira execução do
Gosom, o download do navegador necessário pode demorar.

Para desenvolvimento da interface, deixe a API rodando em um terminal e em outro execute:

```powershell
cd C:\Users\guilh\Downloads\TRAMPOS\PharmaLeads\PharmaLeads\apps\web
npm run dev
```

Abra a URL local informada pelo Vite (`http://127.0.0.1:5173`). O Vite encaminha
as requisições `/api` para a API local na porta 8765. Em Linux/macOS os nomes de
comandos Python podem variar; não há necessidade de iniciar o Vite no uso normal.

Para comparar a interface local com a publicação e usar a coleta em nuvem,
vincule a raiz deste repositório ao projeto existente da Vercel com
`vercel link` e execute `vercel dev` na raiz. Configure
`RENDER_COLLECTOR_URL` e `RENDER_COLLECTOR_TOKEN` em **Development** na Vercel,
e `RENDER_API_KEY` somente se esse ambiente usar One-Off Jobs. Esse fluxo
executa a função `/api/collector` localmente com credenciais de servidor.
Use o ambiente e a conta do Supabase correspondentes ao deploy comparado.

## Como usar

1. Na barra acima das métricas, pesquise uma cidade ou bairro, por exemplo
   `Curitiba, PR`, e adicione o local. O limite é 100 locais por execução local.
2. Abra **Filtros da coleta**, marque os segmentos desejados, escolha profundidade
   entre 1 e 10 e, opcionalmente, marque a busca de e-mails. Clique em **Iniciar coleta**.
3. A API gera os termos a partir dos segmentos escolhidos, executa uma busca por vez,
   salva o CSV real do Gosom e importa os leads em SQLite. A tela acompanha consultas
   concluídas, falhas e a busca atual. Há duas tentativas por consulta e intervalo entre elas.
4. Clique em **Parar coleta** para encerrar o processo atual e interromper a fila.
   CSVs parciais das tentativas são preservados para análise; uma consulta interrompida
   não é contabilizada como concluída. A tela permite começar uma nova execução.
5. Filtre os estabelecimentos por texto, UF, segmento ou situação. O botão **Exportar CSV**
   exporta todos os resultados filtrados, inclusive além da página carregada.

Uma busca é concluída somente depois que o Gosom encerra e seu CSV é importado. O tempo
varia; a primeira inicialização e a inatividade configurada do Gosom podem levar minutos.
As tentativas têm limite de 30 minutos, registram erros e não derrubam a fila inteira.

A situação `ativa_ou_desconhecida` significa que o Maps não informou fechamento; ela
**não confirma** que o estabelecimento está aberto. Um número em formato de celular é
um WhatsApp provável, sem verificação de que tenha conta. Sem `Buscar e-mails`, o
scraper não tenta procurá-los nos sites. Não há geração de leads fictícios em produção.

## Dados e compatibilidade

- Banco em `dados/interface_pharmaleads.db`: tabelas `lugares`, `consultas`, `execucoes`
  e `lotes` ficam no mesmo arquivo SQLite. `chave` identifica estabelecimentos e repetidos
  são atualizados; contatos existentes são mantidos quando uma nova busca vem sem eles.
- Na máquina deste projeto, a cópia foi inicializada com 1.339 leads reais existentes.
  `dados/pharmaleads.db` e as demais informações anteriores foram preservados. Em uma
  instalação nova, o banco é criado vazio; dados locais não são distribuídos no Git.
- Arquivos da interface: `apps/web`; CSS e identidade visual do dashboard original foram
  mantidos. A tela foi adaptada de CNPJ/CNAE para os campos que o Gosom de fato retorna.
- Saídas e logs de cada consulta ficam em `dados/execucoes/<id>/`. Não execute duas
  instâncias da API no mesmo diretório. A API aceita apenas conexões locais.
- `locais.txt` preserva a lista ampliada de localidades, mas a tela executa os locais
  que você digitar; ela não inicia automaticamente os 502 lotes existentes. Os comandos
  `python -m pharmaleads gerar`, `coletar`, `status`, `importar` e `exportar` continuam
  disponíveis para uso pela linha de comando com o SQLite local.
- O arquivo `.env` fornece o login de sincronização ao Supabase. Nunca publique `.env`,
  `dados/` ou CSVs de leads.

## Testes

Na raiz do projeto:

```powershell
python -m unittest discover -s tests -v
cd apps\web
npm test
npm run build
npm run test:e2e
```

Os testes usam um Gosom simulado e dados temporários, sem acessar o Google. Os testes
end-to-end exigem o navegador Chromium do Playwright (`npx playwright install chromium`
se necessário). Um teste real envolve acesso externo e resultados que podem variar.

## Limites conhecidos

O Google Maps pode alterar seu funcionamento, limitar resultados ou bloquear requisições;
um resultado vazio não comprova ausência de estabelecimentos. Fontes de locais estão em
`FONTES_LOCAIS.md`. Respeite os termos aplicáveis e trate dados pessoais de acordo com a
legislação pertinente. O serviço local é destinado ao computador do usuário, não foi
projetado para ser exposto diretamente à internet ou a múltiplos operadores.

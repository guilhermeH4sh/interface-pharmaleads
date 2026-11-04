# PharmaLeads — coleta de estabelecimentos

Aplicação local para buscar estabelecimentos farmacêuticos no Google Maps por meio do
[gosom/google-maps-scraper](https://github.com/gosom/google-maps-scraper), guardar os
resultados em SQLite e consultar, filtrar e exportar leads numa interface React.
O scraper e a API Python rodam localmente. A interface publicada na Vercel consulta
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

### Ativar o botão de coleta online

O painel publicado inicia um workflow sob demanda no GitHub Actions. Esse workflow roda
o contêiner oficial do Gosom em Linux e envia os CSVs para a **mesma tabela**
`public.pharmaleads`; ele não depende do seu computador ligado e não cria outra tabela.
O painel mostra o estado do job (na fila, em andamento, concluído, falhou ou cancelado).

Configure estes segredos **nas próprias plataformas, sem colá-los em chats**:

1. No repositório `guilhermeH4sh/interface-pharmaleads`, acesse **Settings > Secrets and
   variables > Actions > New repository secret**. Crie `SUPABASE_EMAIL` e
   `SUPABASE_PASSWORD` com os valores correspondentes do `.env` local.
2. Crie um **fine-grained personal access token** no GitHub, limitado apenas ao
   repositório `interface-pharmaleads`, com permissão **Actions: Read and write**.
3. No projeto `pharmaleads` da Vercel, acesse **Settings > Environment Variables** e
   crie `GITHUB_ACTIONS_TOKEN` com esse token para **Production**. Faça um novo deploy
   para a variável entrar em vigor.

Depois, entre em [pharmaleads.vercel.app](https://pharmaleads.vercel.app), informe os
locais, marque os segmentos e clique em **Iniciar coleta**. O limite é 20 buscas por
execução; o botão **Parar coleta** cancela o job atual. A execução depende das cotas
de GitHub Actions e da disponibilidade do Google Maps. O job falha com uma mensagem
se as credenciais de sincronização não estiverem configuradas.

O painel também oferece **Enriquecer sites de leads novos**. Quando ativada, após a
busca no Maps o GitHub Actions instala o Chromium e o Playwright visita somente a
página inicial pública de até 25 sites dos novos estabelecimentos. Ele procura e-mails,
links de WhatsApp e redes sociais. E-mails e WhatsApp complementam o registro existente;
as redes sociais ficam em `dados_brutos`. Esta opção aumenta a duração da rodada e não
visita sites de leads que já estavam na base.

Em **Filtros da coleta**, marque **Cobertura nacional** e use **Iniciar coleta** para
percorrer as 27 capitais, intercalando as regiões,
e depois uma cidade do interior nos estados grandes — São Paulo entra com duas. Cada
rodada continua limitada a 20 buscas. Se ela termina bem, o GitHub Actions agenda a
próxima; **Parar coleta** cancela a rodada em andamento e qualquer rodada seguinte que
já esteja na fila. Uma falha interrompe a fila. Busca de e-mails e enriquecimento ficam desligados nessa fila,
para a rodada caber no tempo do job. A grade **Cobertura por UF** lê `ultima_coleta`
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

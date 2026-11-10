# Passagem do projeto PharmaLeads para outra conta do Codex

Use este arquivo como fonte de contexto ao abrir o projeto em outra conta. Não há
senhas, tokens, JWTs ou chaves privadas neste documento.

## Instrução para a nova conversa

Cole esta frase na primeira mensagem da outra conta:

> Leia `HANDOFF_CODEX.md` e o `README.md`, inspecione o estado atual do repositório e
> continue o projeto PharmaLeads preservando as restrições e decisões registradas.

## Estado entregue

- Interface publicada: <https://pharmaleads.vercel.app>
- Repositório único (interface, scraper, Render e deploy Vercel):
  <https://github.com/guilhermeH4sh/interface-pharmaleads>
- O repositório antigo `scraper-pharmaleads` não recebe mais o produto; a Vercel
  lê somente `interface-pharmaleads`.
- Supabase: projeto `qxsdcrywsjkrpcbfgbxb`, tabela única `public.pharmaleads`.
- Em 2 de novembro de 2026, a tabela tinha **2.631 leads únicos**.
- As 27 UFs tinham registros dos segmentos `varejo` e `manipulacao`.
- A coleta nacional automática usada para completar essa cobertura foi encerrada.
- O ajuste mais recente está no commit
  `dc03e61044c34be4f863bdd7d857a732b0b846b0` (`Otimiza execução em lote do
  coletor`), publicado na branch `main` em 2 de novembro de 2026.
- Antes, uma rodada acionava um contêiner Gosom para cada consulta. Agora as até 20
  consultas são enviadas em um único arquivo de entrada e processadas por um único
  contêiner, com concorrência 2. Isso reduz a repetição de inicialização do navegador
  e deve diminuir materialmente o tempo total da rodada.
- Cada rodada é repetida uma vez se o CSV estiver vazio ou a execução falhar. Se a
  segunda tentativa falhar, a rodada é encerrada com erro para evitar resultado
  incompleto silencioso.
- O CSV consolidado mantém o `input_id` do Gosom, portanto a importação continua
  atribuindo corretamente o segmento e o local de busca a cada lead.
- O enriquecimento com Playwright foi integrado como opção da coleta online. Quando
  selecionado no painel, ele visita somente a página inicial pública de até 25 sites
  de leads novos na rodada e extrai e-mails, link de WhatsApp e links de redes sociais.
  E-mails e WhatsApp atualizam os campos existentes; as redes ficam em `dados_brutos`.
  Não cria tabela nem coluna no Supabase. Como é uma etapa extra de navegação, aumenta
  o tempo da rodada e deve ser usada quando a qualidade de contato for prioridade.

O total no Supabase pode aumentar depois desta passagem. Consulte a tabela antes de
usar o número acima como estado atual.

## Arquitetura

1. A interface React/Vite está em `apps/web` e é publicada na Vercel.
2. No domínio publicado, a interface autentica o usuário pelo Supabase Auth e lê
   diretamente `public.pharmaleads`, respeitando RLS.
3. O endpoint Vercel `api/collector.mjs` valida a sessão Supabase e chama o Web Service
   protegido do Render.
4. `Dockerfile.render` deriva da imagem oficial do Gosom e inclui Python e Playwright.
5. `pharmaleads/render_service.py` supervisiona a fila e `cloud_job.py` executa cada
   rodada diretamente, sincronizando o CSV consolidado com `public.pharmaleads`.
6. A chave `chave` identifica e deduplica estabelecimentos no Supabase.
7. O modo local continua disponível com `python -m pharmaleads.api` e SQLite, mas o
   produto publicado usa o Supabase como base online.

## Regras que devem ser preservadas

- Usar somente a tabela `public.pharmaleads`; não criar, apagar ou alterar outras
  tabelas do projeto Supabase.
- Não apagar os leads existentes sem uma solicitação explícita e uma verificação do
  alvo.
- Nunca publicar `.env`, senhas, tokens, JWTs, CSVs de leads ou o diretório `dados/`.
- Manter o acesso da interface protegido por Supabase Auth e RLS.
- Tratar a chave publicável do Supabase como chave de cliente; credenciais de servidor
  continuam somente nas plataformas que as utilizam.
- Uma execução online aceita no máximo 20 consultas. `varejo` gera três termos e
  `manipulacao` gera um termo por local; juntos, cabem no máximo cinco locais por
  rodada.
- O Google Maps pode retornar páginas vazias ou mudar sua estrutura. O scraper deve
  preservar resultados já sincronizados e continuar consultas independentes quando
  uma delas falhar.

## Configuração externa necessária

Os valores não ficam no Git. A nova conta precisa ter acesso às plataformas ou pedir
ao proprietário para reconectá-las.

### Render — `pharmaleads-collector`

- `SUPABASE_EMAIL`
- `SUPABASE_PASSWORD`
- `RENDER_COLLECTOR_TOKEN`

### Vercel — projeto `pharmaleads`, ambiente Production

- `RENDER_COLLECTOR_URL`: URL HTTPS do Web Service.
- `RENDER_COLLECTOR_TOKEN`: o mesmo segredo configurado no Render.

### Desenvolvimento local

- O arquivo `.env` local contém o login Supabase e é ignorado pelo Git.
- O Gosom para Windows deve existir como `bin/google-maps-scraper.exe`.
- A pasta local usada durante o desenvolvimento foi
  `C:\Users\guilh\Downloads\TRAMPOS\PharmaLeads\PharmaLeads`.

## Operação

### Interface publicada

1. Abra <https://pharmaleads.vercel.app>.
2. Entre com o usuário autorizado do Supabase.
3. Para coletar, informe cidades, estados ou regiões, escolha os segmentos e inicie a
   coleta.
4. Para `varejo` + `manipulacao`, use no máximo cinco locais em cada rodada.
5. Os resultados são enviados ao Supabase durante a execução no Render.

### Desenvolvimento local

```powershell
cd C:\Users\guilh\Downloads\TRAMPOS\PharmaLeads\PharmaLeads
python -m pharmaleads verificar
python -m pharmaleads.api
```

A interface local fica em <http://127.0.0.1:8765>.

## Arquivos centrais

- `pharmaleads/render_service.py`: API protegida e supervisão da fila no Render.
- `pharmaleads/cloud_job.py`: execução direta do Gosom e sincronização.
- `pharmaleads/supabase.py`: autenticação e acesso exclusivo a `public.pharmaleads`.
- `pharmaleads/banco.py`: importação, deduplicação local e fila de sincronização.
- `api/collector.mjs`: autenticação do painel e controle do workflow online.
- `render.yaml` e `Dockerfile.render`: infraestrutura e imagem do coletor.
- `apps/web/src/HostedDashboard.tsx`: painel publicado e consulta dos leads.
- `README.md`: instalação, operação e limites conhecidos.

## Funcionalidades prontas

- Login pelo Supabase Auth com validação do usuário autorizado.
- Listagem paginada de todos os leads online.
- Busca e filtros por texto, UF, segmento e situação.
- Exportação CSV dos resultados filtrados.
- Coleta local pelo Gosom.
- Coleta online iniciada pelo painel, executada no Render.
- Botões para iniciar e interromper a coleta online.
- Sincronização automática e deduplicada com o Supabase.
- Execução consolidada de até 20 consultas por rodada, com concorrência 2, repetição
  integral uma vez em falhas transitórias e sincronização deduplicada.
- Enriquecimento opcional de sites públicos com Playwright para novos leads, limitado
  a 100 sites novos por rodada para controlar duração e consumo do Render.
- Cobertura nacional no painel: 27 capitais, intercaladas por região, e depois uma
  cidade do interior nos estados grandes (São Paulo tem duas). Cada rodada respeita
  as oito consultas configuradas. Ao terminar bem, o supervisor inicia a seguinte.
  Parar encerra a rodada atual e impede as seguintes. E-mails e enriquecimento ficam
  ligados. A grade por UF usa `ultima_coleta`, sem tabela nova.

## Próximos passos recomendados

- Mostrar, durante a rodada, o andamento de cada consulta do Gosom. O painel já mostra
  a rodada, os locais dela e a data mais recente de cada UF.
- Registrar a data da última cobertura de cada UF e permitir atualização periódica.
- Melhorar a seleção de cidades dentro de estados grandes para aumentar diversidade
  geográfica, mantendo deduplicação.
- Revisar a rotação e o armazenamento dos segredos nas plataformas.
- Criar uma fila persistente de enriquecimento para retentar, em outra rodada, sites
  que estejam indisponíveis ou lentos.

Antes de qualquer mudança, confira o estado do GitHub, Vercel e Supabase. Este documento
descreve o estado verificado na data indicada, não substitui uma inspeção atual.

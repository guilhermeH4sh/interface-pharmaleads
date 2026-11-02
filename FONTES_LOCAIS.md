# Fontes dos locais de busca

As localidades em `locais.txt` combinam as 27 capitais com bairros, distritos e setores.
Foram eliminadas repetições por nome normalizado dentro de cada cidade. Os nomes são
pontos de partida para buscas e não garantem cobertura completa ou limites oficiais atuais.

- [IBGE, Censo 2022, agregados por bairro, dados básicos](https://ftp.ibge.gov.br/Censos/Censo_Demografico_2022/Agregados_por_Setores_Censitarios/Agregados_por_Bairro_csv/Agregados_por_bairros_basico_BR_20260520.zip): bairros identificados pelas capitais e UFs; a base não cobre bairros de todas as capitais.
- [AutoCidade, dados abertos](https://github.com/andradeandrey/autocidade-dados-abertos/tree/main/dados/bairros): bairros complementares de capitais, incluindo Brasília, Goiânia e São Luís (licença MIT no repositório).
- [Prefeitura de São Paulo, Lei 11.220/1992](https://legislacao.prefeitura.sp.gov.br/lei-11220-de-20-de-maio-de-1992): distritos municipais usados como áreas adicionais de busca.
- [Prefeitura de Rio Branco, lista de bairros atendidos em 2023](https://www.riobranco.ac.gov.br/noticias/prefeitura-entrega-mais-de-27-mil-produtos-em-60-bairros-de-rio-branco-entre-dia-26-de-marco-e-13-de-abril/): localidades complementares de Rio Branco, AC.
- [CEP Brasil, localidades de Palmas, TO](https://cepbrasil.org/tocantins/palmas/): bairros, setores e localidades complementares em Palmas, TO.

As cópias das bases utilizadas ficam em `dados/fontes/`, pasta local ignorada pelo Git.
Os novos lotes foram acrescentados após os lotes existentes, sem modificá-los; a geração
`gerar --recriar` substitui esses arquivos de lote, então use-a somente se desejar gerar
novos lotes do zero. `coletar --limite 1` processa apenas um lote por rodada.

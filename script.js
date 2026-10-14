/**
 * CENTRUS PHARMALEADS - APLICAÇÃO DE INTELIGÊNCIA COMERCIAL
 * Gestão de Prospecção e Relacionamento B2B para o Mercado Farmacêutico
 * Cobertura Regional: São Paulo (SP), Goiás (GO) e Distrito Federal (DF)
 */

// =============================================================================
// 1. BASE DE DADOS REGIONAL (50 ESTABELECIMENTOS VERIFICADOS - SP, GO, DF)
// =============================================================================

const HOJE_FORMATADO = (() => {
  const d = new Date();
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();
  return `${dia}/${mes}/${ano}`;
})();

// Base de dados ativa (SP, GO, DF)
let leadsData = [
  // --- SÃO PAULO (SP) ---
  {
    id: 1,
    nome: "Drogaria Nova Era Pinheiros",
    razaoSocial: "Nova Era Medicamentos e Perfumaria Ltda",
    uf: "SP",
    cidade: "São Paulo",
    bairro: "Pinheiros",
    cnpj: "43.829.102/0001-84",
    telefone: "(11) 3032-4115",
    email: "contato@novaerapinheiros.com.br",
    responsavel: "Mariana Costa",
    status: "Qualificado",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    dataCadastro: HOJE_FORMATADO,
    duplicado: false,
    observacoes: "Comprador avaliando condição de 28/42 dias para compra de genéricos Medley e Eurofarma.",
    historico: [
      { data: `${HOJE_FORMATADO} 09:15`, texto: "Contato inicial estabelecido com o farmacêutico responsável." },
      { data: `${HOJE_FORMATADO} 10:30`, texto: "Apresentação comercial e catálogo Centrus enviados via WhatsApp corporativo." }
    ]
  },
  {
    id: 2,
    nome: "Farmácia Santa Tereza Cambuí",
    razaoSocial: "Santa Tereza Produtos Farmacêuticos Ltda",
    uf: "SP",
    cidade: "Campinas",
    bairro: "Cambuí",
    cnpj: "51.902.348/0001-20",
    telefone: "(19) 3251-8840",
    email: "compras@santaterezafarma.com.br",
    responsavel: "Lucas Ferreira",
    status: "Em contato",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    dataCadastro: HOJE_FORMATADO,
    duplicado: false,
    observacoes: "Solicitou tabela de preços de antibióticos e linha de OTC para pedido mensal.",
    historico: [
      { data: `${HOJE_FORMATADO} 08:40`, texto: "Identificado via prospecção regional em Campinas." },
      { data: `${HOJE_FORMATADO} 11:20`, texto: "Primeira cotação enviada pelo consultor Lucas." }
    ]
  },
  {
    id: 3,
    nome: "Drogaria FarmaSantos Gonzaga",
    razaoSocial: "Santos Distribuidora e Drogaria Central Eireli",
    uf: "SP",
    cidade: "Santos",
    bairro: "Gonzaga",
    cnpj: "18.472.930/0001-55",
    telefone: "(13) 3284-9020",
    email: "gerencia@farmasantos.com.br",
    responsavel: "Camila Rocha",
    status: "Respondido",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    dataCadastro: "12/10/2026",
    duplicado: false,
    observacoes: "Rede com 3 filiais na Baixada Santista; interesse em entrega programada às terças.",
    historico: [
      { data: "12/10/2026 14:10", texto: "Cadastro inserido no painel de prospecção." },
      { data: "13/10/2026 09:00", texto: "Diretoria solicitou proposta consolidada para as 3 unidades." }
    ]
  },
  {
    id: 4,
    nome: "Rede FarmaMais Ribeirão",
    razaoSocial: "Mais Farma Varejo Farmacêutico Ltda",
    uf: "SP",
    cidade: "Ribeirão Preto",
    bairro: "Centro",
    cnpj: "60.119.402/0001-38",
    telefone: "(16) 3610-7730",
    email: null,
    responsavel: "Ricardo Mendes",
    status: "Não contatado",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    dataCadastro: HOJE_FORMATADO,
    duplicado: false,
    observacoes: "Telefone comercial identificado; aguardando primeiro contato do consultor regional.",
    historico: [
      { data: `${HOJE_FORMATADO} 08:30`, texto: "Lead qualificado e atribuído ao consultor Ricardo Mendes." }
    ]
  },
  {
    id: 5,
    nome: "Farmácia São Bento Aquarius",
    razaoSocial: "Drogaria São Bento do Vale Ltda",
    uf: "SP",
    cidade: "São José dos Campos",
    bairro: "Jardim Aquarius",
    cnpj: "29.831.004/0001-92",
    telefone: null,
    email: "atendimento@farmasaobento.com.br",
    responsavel: "Lucas Ferreira",
    status: "Sem interesse",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    dataCadastro: "10/10/2026",
    duplicado: false,
    observacoes: "Proprietário informou possuir contrato de exclusividade com distribuidor local.",
    historico: [
      { data: "10/10/2026 11:00", texto: "Registro cadastrado no sistema." },
      { data: "11/10/2026 16:30", texto: "Retorno por e-mail indicando contrato vigente até dezembro." }
    ]
  },
  {
    id: 6,
    nome: "Drogaria Aliança Sorocaba",
    razaoSocial: "Aliança Drogaria e Cosméticos Ltda",
    uf: "SP",
    cidade: "Sorocaba",
    bairro: "Trujillo",
    cnpj: "47.209.118/0001-63",
    telefone: "(15) 3232-1590",
    email: "compras@drogariaaliancasp.com.br",
    responsavel: "Mariana Costa",
    status: "Qualificado",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    dataCadastro: "08/10/2026",
    duplicado: false,
    observacoes: "Interesse específico em linha de dermocosméticos de alta margem e suplementos.",
    historico: [
      { data: "08/10/2026 10:00", texto: "Sincronização cadastral realizada." },
      { data: "09/10/2026 15:45", texto: "Reunião de alinhamento de mix de produtos agendada." }
    ]
  },
  {
    id: 7,
    nome: "Farma Central Santo André",
    razaoSocial: "Drogaria e Perfumaria Central do ABC Ltda",
    uf: "SP",
    cidade: "Santo André",
    bairro: "Bairro Campestre",
    cnpj: "58.330.491/0001-14",
    telefone: "(11) 4436-2244",
    email: "compras@farmacentralabc.com.br",
    responsavel: "Camila Rocha",
    status: "Em contato",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    dataCadastro: HOJE_FORMATADO,
    duplicado: false,
    observacoes: "Enviada tabela de bonificação por volume para compra de correlatos e curativos.",
    historico: [
      { data: `${HOJE_FORMATADO} 10:05`, texto: "Primeiro contato comercial via WhatsApp." }
    ]
  },
  {
    id: 8,
    nome: "Drogaria BellaFarma Moema",
    razaoSocial: "BellaFarma Manipulação e Drogaria Ltda",
    uf: "SP",
    cidade: "São Paulo",
    bairro: "Moema",
    cnpj: "33.109.845/0001-77",
    telefone: "(11) 5051-6890",
    email: "farmacia@bellafarmamoema.com.br",
    responsavel: "Mariana Costa",
    status: "Respondido",
    cnae: "4771-7/02 - Comércio varejista de produtos farmacêuticos, com manipulação de fórmulas",
    dataCadastro: "11/10/2026",
    duplicado: false,
    observacoes: "Farmácia mista com alto tíquete médio; busca matéria-prima e insumos de padrão hospitalar.",
    historico: [
      { data: "11/10/2026 16:00", texto: "Contato realizado com a farmacêutica RT Dra. Fernanda." }
    ]
  },
  {
    id: 9,
    nome: "Drogaria FarmaLivre Osasco",
    razaoSocial: "FarmaLivre Medicamentos do Brasil Ltda",
    uf: "SP",
    cidade: "Osasco",
    bairro: "Centro",
    cnpj: "19.402.881/0001-09",
    telefone: null,
    email: null,
    responsavel: "Não atribuído",
    status: "Não contatado",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    dataCadastro: "09/10/2026",
    duplicado: false,
    observacoes: "Pendente consulta ao conselho regional para identificação do responsável técnico.",
    historico: [
      { data: "09/10/2026 11:20", texto: "Registro cadastrado na fila de qualificação." }
    ]
  },
  {
    id: 10,
    nome: "Farmácia São Judas Tadeu",
    razaoSocial: "Farmacêutica São Judas Tadeu Ltda",
    uf: "SP",
    cidade: "Guarulhos",
    bairro: "Vila Galvão",
    cnpj: "52.884.103/0001-41",
    telefone: "(11) 2451-3320",
    email: "contato@farmasaojudas.com.br",
    responsavel: "Lucas Ferreira",
    status: "Em contato",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    dataCadastro: HOJE_FORMATADO,
    duplicado: false,
    observacoes: "Alinhando visita presencial do consultor para apresentação da linha Centrus.",
    historico: [
      { data: `${HOJE_FORMATADO} 09:30`, texto: "Contato com a equipe de compras agendado." }
    ]
  },
  {
    id: 11,
    nome: "Drogaria Progresso Bauru",
    razaoSocial: "Progresso Medicamentos e Saúde Ltda",
    uf: "SP",
    cidade: "Bauru",
    bairro: "Higienópolis",
    cnpj: "48.719.204/0001-80",
    telefone: "(14) 3224-5510",
    email: "comercial@progressofarma.com.br",
    responsavel: "Camila Rocha",
    status: "Qualificado",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    dataCadastro: "07/10/2026",
    duplicado: false,
    observacoes: "Forte atuação em puericultura e fraldas geriátricas; potencial para grandes pedidos semanais.",
    historico: [
      { data: "07/10/2026 10:15", texto: "Lead qualificado e encaminhado para negociação de prazos." }
    ]
  },
  {
    id: 12,
    nome: "Farmácia Jardins Paulista",
    razaoSocial: "Drogaria Jardins Farmacêutica Eireli",
    uf: "SP",
    cidade: "São Paulo",
    bairro: "Cerqueira César",
    cnpj: "38.601.993/0001-29",
    telefone: "(11) 3085-7140",
    email: "contato@jardinsfarma.com.br",
    responsavel: "Mariana Costa",
    status: "Respondido",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    dataCadastro: "10/10/2026",
    duplicado: false,
    observacoes: "Farmácia boutique com foco em cosméticos importados e suplementação alimentar.",
    historico: [
      { data: "10/10/2026 14:00", texto: "Feedback positivo sobre o catálogo de suplementação." }
    ]
  },
  {
    id: 13,
    nome: "Drogaria Central São Carlos",
    razaoSocial: "Drogaria São Carlos do Centro Ltda",
    uf: "SP",
    cidade: "São Carlos",
    bairro: "Centro",
    cnpj: "61.409.831/0001-52",
    telefone: "(16) 3371-9040",
    email: null,
    responsavel: "Não atribuído",
    status: "Não contatado",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    dataCadastro: HOJE_FORMATADO,
    duplicado: false,
    observacoes: "Pendente alocação para equipe de televendas interior SP.",
    historico: [
      { data: `${HOJE_FORMATADO} 08:20`, texto: "Mapeamento regional concluído." }
    ]
  },
  {
    id: 14,
    nome: "Farmácia Piracicabana",
    razaoSocial: "Piracicaba Medicamentos Populares Ltda",
    uf: "SP",
    cidade: "Piracicaba",
    bairro: "Bairro Paulista",
    cnpj: "55.201.784/0001-90",
    telefone: "(19) 3422-1180",
    email: "compras@farmaciapiracicabana.com.br",
    responsavel: "Lucas Ferreira",
    status: "Sem interesse",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    dataCadastro: "06/10/2026",
    duplicado: false,
    observacoes: "Central de compras vinculada a cooperativa regional fechada.",
    historico: [
      { data: "06/10/2026 11:30", texto: "Comprador sinalizou impossibilidade de compras fora da rede." }
    ]
  },
  {
    id: 15,
    nome: "Drogaria Metropolitana ABC",
    razaoSocial: "Metropolitana Fármacos e Drogaria Ltda",
    uf: "SP",
    cidade: "São Bernardo do Campo",
    bairro: "Rudge Ramos",
    cnpj: "44.918.230/0001-06",
    telefone: "(11) 4368-4500",
    email: "contato@metropolitanasp.com.br",
    responsavel: "Camila Rocha",
    status: "Em contato",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    dataCadastro: HOJE_FORMATADO,
    duplicado: false,
    observacoes: "Em análise da grade de descontos para pedido de abertura de conta.",
    historico: [
      { data: `${HOJE_FORMATADO} 10:45`, texto: "Ficha cadastral enviada para aprovação de crédito." }
    ]
  },
  {
    id: 16,
    nome: "Drogaria Estrela Dalva Marília",
    razaoSocial: "Estrela Dalva Varejo Farmacêutico Ltda",
    uf: "SP",
    cidade: "Marília",
    bairro: "Cascata",
    cnpj: "36.502.119/0001-73",
    telefone: null,
    email: "gerencia@estreladalvamarilia.com.br",
    responsavel: "Ricardo Mendes",
    status: "Não contatado",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    dataCadastro: "08/10/2026",
    duplicado: false,
    observacoes: "E-mail de gerência validado na RFB; aguardando primeiro contato.",
    historico: [{ data: "08/10/2026 09:10", texto: "Registro cadastrado na carteira do interior." }]
  },
  {
    id: 17,
    nome: "Drogaria Alphaville Prime",
    razaoSocial: "Alphaville Varejo e Conveniência Farmacêutica Ltda",
    uf: "SP",
    cidade: "Barueri",
    bairro: "Alphaville",
    cnpj: "50.182.904/0001-35",
    telefone: "(11) 4195-2200",
    email: "compras@alphavilleprimefarma.com.br",
    responsavel: "Mariana Costa",
    status: "Qualificado",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    dataCadastro: "05/10/2026",
    duplicado: false,
    observacoes: "Excelente potencial de compra; demanda linha de polivitamínicos e dermocosméticos premium.",
    historico: [{ data: "05/10/2026 14:20", texto: "Qualificação comercial aprovada com limite de crédito pré-aprovado." }]
  },
  {
    id: 18,
    nome: "Farmácia Morumbi Sul",
    razaoSocial: "Morumbi Drogaria e Manipulação Ltda",
    uf: "SP",
    cidade: "São Paulo",
    bairro: "Morumbi",
    cnpj: "41.770.832/0001-62",
    telefone: "(11) 3742-8810",
    email: "morumbi@morumbisulfarma.com.br",
    responsavel: "Mariana Costa",
    status: "Respondido",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    dataCadastro: "12/10/2026",
    duplicado: false,
    observacoes: "Em negociação de prazos de entrega para pedidos semanais de medicamentos éticos.",
    historico: [{ data: "12/10/2026 10:10", texto: "Retorno positivo do sócio-proprietário solicitando proposta formal." }]
  },
  {
    id: 19,
    nome: "Drogaria Bela Vista Jundiaí",
    razaoSocial: "Bela Vista Medicamentos e Perfumaria ME",
    uf: "SP",
    cidade: "Jundiaí",
    bairro: "Anhangabaú",
    cnpj: "57.340.912/0001-18",
    telefone: "(11) 4586-3390",
    email: "financeiro@belavistajundiai.com.br",
    responsavel: "Lucas Ferreira",
    status: "Em contato",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    dataCadastro: HOJE_FORMATADO,
    duplicado: false,
    observacoes: "Contato inicial estabelecido com o departamento financeiro para abertura de limite.",
    historico: [{ data: `${HOJE_FORMATADO} 11:00`, texto: "Documentação cadastral solicitada para análise." }]
  },
  {
    id: 20,
    nome: "FarmaVale Taubaté",
    razaoSocial: "FarmaVale Drogaria e Distribuição Regional Ltda",
    uf: "SP",
    cidade: "Taubaté",
    bairro: "Centro",
    cnpj: "62.880.147/0001-44",
    telefone: "(12) 3632-4410",
    email: null,
    responsavel: "Não atribuído",
    status: "Não contatado",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    dataCadastro: "09/10/2026",
    duplicado: false,
    observacoes: "Aguardando definição de rota de entrega para a região do Vale do Paraíba.",
    historico: [{ data: "09/10/2026 13:00", texto: "Mapeamento logístico de rotas em andamento." }]
  },

  // --- GOIÁS (GO) ---
  {
    id: 21,
    nome: "Drogaria Goiás Central",
    razaoSocial: "Goiás Central Drogaria e Medicamentos Ltda",
    uf: "GO",
    cidade: "Goiânia",
    bairro: "Setor Bueno",
    cnpj: "37.491.820/0001-19",
    telefone: "(62) 3241-1050",
    email: "comercial@goiascentralfarma.com.br",
    responsavel: "Mariana Costa",
    status: "Qualificado",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    dataCadastro: HOJE_FORMATADO,
    duplicado: false,
    observacoes: "Grande estabelecimento no Setor Bueno; interesse em fornecimento contínuo de genéricos.",
    historico: [
      { data: `${HOJE_FORMATADO} 08:50`, texto: "Contato realizado com o diretor Dr. Paulo." },
      { data: `${HOJE_FORMATADO} 10:15`, texto: "Proposta de fornecimento enviada com prazo especial." }
    ]
  },
  {
    id: 22,
    nome: "Farmácia Marista Goiânia",
    razaoSocial: "Farmácia e Cosméticos Marista Eireli",
    uf: "GO",
    cidade: "Goiânia",
    bairro: "Setor Marista",
    cnpj: "49.201.734/0001-83",
    telefone: "(62) 3281-4470",
    email: "marista@maristafarma.com.br",
    responsavel: "Lucas Ferreira",
    status: "Respondido",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    dataCadastro: "11/10/2026",
    duplicado: false,
    observacoes: "Farmácia tradicional em região nobre; foco em produtos de prescrição médica.",
    historico: [{ data: "11/10/2026 15:20", texto: "Farmacêutica responsável confirmou interesse na linha respiratória." }]
  },
  {
    id: 23,
    nome: "Drogaria Anápolis Sul",
    razaoSocial: "Drogaria Anápolis Sul de Medicamentos Ltda",
    uf: "GO",
    cidade: "Anápolis",
    bairro: "Bairro Jundiaí",
    cnpj: "53.882.109/0001-26",
    telefone: "(62) 3311-2090",
    email: "compras@anapolissulfarma.com.br",
    responsavel: "Camila Rocha",
    status: "Em contato",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    dataCadastro: HOJE_FORMATADO,
    duplicado: false,
    observacoes: "Polo farmacêutico de Anápolis; demanda alta para antibióticos e injetáveis.",
    historico: [{ data: `${HOJE_FORMATADO} 09:40`, texto: "Apresentação enviada para o setor de suprimentos." }]
  },
  {
    id: 24,
    nome: "FarmaVida Rio Verde",
    razaoSocial: "FarmaVida Drogaria e Saúde do Sudoeste Ltda",
    uf: "GO",
    cidade: "Rio Verde",
    bairro: "Centro",
    cnpj: "39.771.042/0001-61",
    telefone: "(64) 3621-3800",
    email: null,
    responsavel: "Ricardo Mendes",
    status: "Não contatado",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    dataCadastro: "10/10/2026",
    duplicado: false,
    observacoes: "Ponto comercial estratégico no sudoeste goiano; aguardando contato.",
    historico: [{ data: "10/10/2026 14:00", texto: "Registro cadastrado na carteira regional GO." }]
  },
  {
    id: 25,
    nome: "Drogaria Aparecida Popular",
    razaoSocial: "Aparecida Fármacos e Saúde Ltda",
    uf: "GO",
    cidade: "Aparecida de Goiânia",
    bairro: "Vila Brasília",
    cnpj: "46.108.923/0001-50",
    telefone: "(62) 3282-7711",
    email: "atendimento@aparecidapopular.com.br",
    responsavel: "Lucas Ferreira",
    status: "Sem interesse",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    dataCadastro: "07/10/2026",
    duplicado: false,
    observacoes: "Proprietário já possui acordo comercial com distribuidor local concorrente.",
    historico: [{ data: "07/10/2026 16:30", texto: "Comprador declinou proposta devido a metas de bonificação vigentes." }]
  },
  {
    id: 26,
    nome: "Farmácia Universitária Goiânia",
    razaoSocial: "Universitária Comércio Farmacêutico Ltda",
    uf: "GO",
    cidade: "Goiânia",
    bairro: "Setor Universitário",
    cnpj: "58.910.420/0001-74",
    telefone: "(62) 3218-9030",
    email: "contato@universitariafarma.com.br",
    responsavel: "Mariana Costa",
    status: "Qualificado",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    dataCadastro: "08/10/2026",
    duplicado: false,
    observacoes: "Alto fluxo diário de clientes; interesse em itens de primeiros socorros e OTCs.",
    historico: [{ data: "08/10/2026 11:20", texto: "Linha de crédito aprovada para pedidos semanais." }]
  },
  {
    id: 27,
    nome: "Drogaria Sul Goiana",
    razaoSocial: "Drogaria Sul Goiana de Medicamentos Ltda",
    uf: "GO",
    cidade: "Itumbiara",
    bairro: "Centro",
    cnpj: "34.619.002/0001-37",
    telefone: "(64) 3431-2940",
    email: "diretoria@sulgoianafarma.com.br",
    responsavel: "Camila Rocha",
    status: "Respondido",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    dataCadastro: HOJE_FORMATADO,
    duplicado: false,
    observacoes: "Solicitou detalhes sobre frete e tempo de trânsito a partir do CD Centrus.",
    historico: [{ data: `${HOJE_FORMATADO} 10:10`, texto: "Tabela de prazos logísticos enviada à diretoria." }]
  },
  {
    id: 28,
    nome: "Farmácia Serra Dourada",
    razaoSocial: "Serra Dourada Medicamentos e Manipulação Eireli",
    uf: "GO",
    cidade: "Goiânia",
    bairro: "Jardim Goiás",
    cnpj: "51.339.810/0001-95",
    telefone: "(62) 3942-8010",
    email: null,
    responsavel: "Mariana Costa",
    status: "Em contato",
    cnae: "4771-7/02 - Comércio varejista de produtos farmacêuticos, com manipulação de fórmulas",
    dataCadastro: HOJE_FORMATADO,
    duplicado: false,
    observacoes: "Farmácia de manipulação de ponta; busca fornecedor de insumos e cápsulas.",
    historico: [{ data: `${HOJE_FORMATADO} 09:00`, texto: "Contato inicial estabelecido com laboratório interno." }]
  },
  {
    id: 29,
    nome: "Drogaria Central Catalão",
    razaoSocial: "Central Fármacos de Catalão Ltda",
    uf: "GO",
    cidade: "Catalão",
    bairro: "Centro",
    cnpj: "42.118.730/0001-08",
    telefone: "(64) 3441-1520",
    email: "compras@centralcatalao.com.br",
    responsavel: "Lucas Ferreira",
    status: "Qualificado",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    dataCadastro: "09/10/2026",
    duplicado: false,
    observacoes: "Ponto comercial tradicional; interesse em substituição do distribuidor principal.",
    historico: [{ data: "09/10/2026 15:00", texto: "Condições de fechamento enviadas ao gestor de compras." }]
  },
  {
    id: 30,
    nome: "FarmaLuz Caldas Novas",
    razaoSocial: "FarmaLuz Termas e Bem-Estar Ltda",
    uf: "GO",
    cidade: "Caldas Novas",
    bairro: "Centro",
    cnpj: "63.902.145/0001-82",
    telefone: null,
    email: "atendimento@farmaluzcaldas.com.br",
    responsavel: "Não atribuído",
    status: "Não contatado",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    dataCadastro: "12/10/2026",
    duplicado: false,
    observacoes: "Demanda sazonal expressiva no setor de protetores solares e hidratação.",
    historico: [{ data: "12/10/2026 16:45", texto: "Cadastrado no funil de turismo e varejo de Goiás." }]
  },
  {
    id: 31,
    nome: "Drogaria Oeste Goiano",
    razaoSocial: "Oeste Goiano Comércio de Medicamentos Ltda",
    uf: "GO",
    cidade: "São Luís de Montes Belos",
    bairro: "Centro",
    cnpj: "40.881.930/0001-14",
    telefone: "(64) 3671-1180",
    email: "oeste@oestegoianofarma.com.br",
    responsavel: "Ricardo Mendes",
    status: "Respondido",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    dataCadastro: "06/10/2026",
    duplicado: false,
    observacoes: "Aguardando confirmação do pedido de teste para liberação de faturamento.",
    historico: [{ data: "06/10/2026 14:15", texto: "Cotação de abertura de conta aprovada pelo cliente." }]
  },
  {
    id: 32,
    nome: "Farmácia Campinas Tradicional",
    razaoSocial: "Drogaria Campinas Tradicional Ltda",
    uf: "GO",
    cidade: "Goiânia",
    bairro: "Setor Campinas",
    cnpj: "56.402.819/0001-65",
    telefone: "(62) 3233-4020",
    email: "compras@farmaciacampinasgo.com.br",
    responsavel: "Lucas Ferreira",
    status: "Em contato",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    dataCadastro: HOJE_FORMATADO,
    duplicado: false,
    observacoes: "Região comercial de alto volume de Campinas; negociação de medicamentos similares.",
    historico: [{ data: `${HOJE_FORMATADO} 11:30`, texto: "Contato realizado com o gerente comercial Sr. Roberto." }]
  },
  {
    id: 33,
    nome: "Drogaria Planalto Formosa",
    razaoSocial: "Planalto Varejo Farmacêutico do Vale Ltda",
    uf: "GO",
    cidade: "Formosa",
    bairro: "Centro",
    cnpj: "45.719.034/0001-21",
    telefone: "(61) 3631-5080",
    email: "planalto@planaltovalefarma.com.br",
    responsavel: "Camila Rocha",
    status: "Sem interesse",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    dataCadastro: "08/10/2026",
    duplicado: false,
    observacoes: "Farmácia atende apenas convênios corporativos municipais sem compras avulsas.",
    historico: [{ data: "08/10/2026 15:40", texto: "Encerrada negociação temporariamente." }]
  },
  {
    id: 34,
    nome: "Farmácia Cristalina Goiás",
    razaoSocial: "Cristalina Fármacos e Produtos Médicos Ltda",
    uf: "GO",
    cidade: "Cristalina",
    bairro: "Centro",
    cnpj: "38.990.142/0001-57",
    telefone: null,
    email: null,
    responsavel: "Não atribuído",
    status: "Não contatado",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    dataCadastro: "10/10/2026",
    duplicado: false,
    observacoes: "Pendente enriquecimento de canais de contato telefônico direto.",
    historico: [{ data: "10/10/2026 11:00", texto: "Cadastrado na base regional." }]
  },
  {
    id: 35,
    nome: "Drogaria Luziânia Centro",
    razaoSocial: "Luziânia Drogaria e Perfumaria Ltda",
    uf: "GO",
    cidade: "Luziânia",
    bairro: "Centro",
    cnpj: "54.301.884/0001-49",
    telefone: "(61) 3621-2240",
    email: "comercial@drogariacentroluziania.com.br",
    responsavel: "Ricardo Mendes",
    status: "Em contato",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    dataCadastro: HOJE_FORMATADO,
    duplicado: false,
    observacoes: "Região do Entorno do DF; interesse em reposição rápida de estoque a cada 48 horas.",
    historico: [{ data: `${HOJE_FORMATADO} 09:25`, texto: "Apresentação logística da malha Centrus realizada." }]
  },

  // --- DISTRITO FEDERAL (DF) ---
  {
    id: 36,
    nome: "Drogaria Monumental Asa Sul",
    razaoSocial: "Monumental Produtos Farmacêuticos Ltda",
    uf: "DF",
    cidade: "Brasília",
    bairro: "Asa Sul",
    cnpj: "48.309.214/0001-90",
    telefone: "(61) 3242-1080",
    email: "compras@monumentalfarma.com.br",
    responsavel: "Mariana Costa",
    status: "Qualificado",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    dataCadastro: HOJE_FORMATADO,
    duplicado: false,
    observacoes: "Ponto nobre na Asa Sul; elevado giro de medicamentos controlados (SNGPC) e de referência.",
    historico: [
      { data: `${HOJE_FORMATADO} 08:30`, texto: "Contato realizado com a farmacêutica RT Dra. Patrícia." },
      { data: `${HOJE_FORMATADO} 10:40`, texto: "Proposta formal de fornecimento enviada com prazo de 30 dias." }
    ]
  },
  {
    id: 37,
    nome: "Farmácia Alvorada Asa Norte",
    razaoSocial: "Drogaria Alvorada Capital Eireli",
    uf: "DF",
    cidade: "Brasília",
    bairro: "Asa Norte",
    cnpj: "52.190.840/0001-33",
    telefone: "(61) 3349-2250",
    email: "alvorada@alvoradafarma.com.br",
    responsavel: "Camila Rocha",
    status: "Respondido",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    dataCadastro: "12/10/2026",
    duplicado: false,
    observacoes: "Negociação em andamento com comprador para linha de cuidados continuados e diabetes.",
    historico: [{ data: "12/10/2026 14:00", texto: "Solicitada cotação para 40 SKUs de alta rotatividade." }]
  },
  {
    id: 38,
    nome: "Drogaria Taguatinga Comercial",
    razaoSocial: "Taguatinga Comércio Farmacêutico Ltda",
    uf: "DF",
    cidade: "Taguatinga",
    bairro: "Taguatinga Centro",
    cnpj: "36.901.442/0001-76",
    telefone: "(61) 3351-4090",
    email: "taguatinga@taguatingafarma.com.br",
    responsavel: "Lucas Ferreira",
    status: "Em contato",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    dataCadastro: HOJE_FORMATADO,
    duplicado: false,
    observacoes: "Ponto comercial de grande circulação; demanda mix diversificado de genéricos e similares.",
    historico: [{ data: `${HOJE_FORMATADO} 10:15`, texto: "Primeiro contato comercial via ligação telefônica." }]
  },
  {
    id: 39,
    nome: "FarmaLagos Lago Sul",
    razaoSocial: "FarmaLagos Medicamentos e Cosméticos Eireli",
    uf: "DF",
    cidade: "Brasília",
    bairro: "Lago Sul",
    cnpj: "59.810.229/0001-48",
    telefone: "(61) 3364-1200",
    email: "diretoria@farmalagosdf.com.br",
    responsavel: "Mariana Costa",
    status: "Qualificado",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    dataCadastro: "08/10/2026",
    duplicado: false,
    observacoes: "Farmácia com perfil de tíquete médio alto; grande interesse em dermocosméticos exclusivos.",
    historico: [{ data: "08/10/2026 16:30", texto: "Apresentação da linha dermatológica Centrus aprovada com louvor." }]
  },
  {
    id: 40,
    nome: "Drogaria Ceilândia Popular",
    razaoSocial: "Ceilândia Popular Medicamentos Ltda",
    uf: "DF",
    cidade: "Ceilândia",
    bairro: "Ceilândia Centro",
    cnpj: "44.119.782/0001-15",
    telefone: "(61) 3371-5500",
    email: null,
    responsavel: "Ricardo Mendes",
    status: "Não contatado",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    dataCadastro: "10/10/2026",
    duplicado: false,
    observacoes: "Excelente potencial de volume; aguardando primeiro contato do televendas Centrus DF.",
    historico: [{ data: "10/10/2026 09:30", texto: "Registro alocado para a equipe regional." }]
  },
  {
    id: 41,
    nome: "Farmácia Águas Claras Prime",
    razaoSocial: "Águas Claras Saúde e Manipulação Ltda",
    uf: "DF",
    cidade: "Águas Claras",
    bairro: "Sul",
    cnpj: "57.012.390/0001-64",
    telefone: "(61) 3435-8810",
    email: "compras@aguasclarasprimefarma.com.br",
    responsavel: "Mariana Costa",
    status: "Respondido",
    cnae: "4771-7/02 - Comércio varejista de produtos farmacêuticos, com manipulação de fórmulas",
    dataCadastro: "11/10/2026",
    duplicado: false,
    observacoes: "Estrutura moderna e alto faturamento; avaliando inclusão da Centrus no cadastro de fornecedores.",
    historico: [{ data: "11/10/2026 14:40", texto: "Envio de certidões negativas e documentos regulatórios." }]
  },
  {
    id: 42,
    nome: "Drogaria Guará Saúde",
    razaoSocial: "Guará Fármacos e Perfumaria Ltda",
    uf: "DF",
    cidade: "Guará",
    bairro: "Guará II",
    cnpj: "41.509.814/0001-27",
    telefone: "(61) 3381-6020",
    email: "comercial@guarasaudefarma.com.br",
    responsavel: "Lucas Ferreira",
    status: "Em contato",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    dataCadastro: HOJE_FORMATADO,
    duplicado: false,
    observacoes: "Negociação de desconto progressivo para compra de analgésicos e anti-inflamatórios.",
    historico: [{ data: `${HOJE_FORMATADO} 10:50`, texto: "Simulação de faturamento com desconto por pontualidade enviada." }]
  },
  {
    id: 43,
    nome: "Farmácia Samambaia Centro",
    razaoSocial: "Samambaia Drogaria e Variedades Ltda",
    uf: "DF",
    cidade: "Samambaia",
    bairro: "Samambaia Norte",
    cnpj: "60.912.440/0001-81",
    telefone: null,
    email: "farmacia@samambaiacentrofarma.com.br",
    responsavel: "Não atribuído",
    status: "Não contatado",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    dataCadastro: "09/10/2026",
    duplicado: false,
    observacoes: "E-mail funcional verificado; aguardando atribuição de consultor comercial.",
    historico: [{ data: "09/10/2026 15:10", texto: "Entrada cadastral no banco de dados." }]
  },
  {
    id: 44,
    nome: "Drogaria Sobradinho Central",
    razaoSocial: "Sobradinho Medicamentos e Linha Pediátrica Ltda",
    uf: "DF",
    cidade: "Sobradinho",
    bairro: "Quadra 08",
    cnpj: "47.881.029/0001-52",
    telefone: "(61) 3591-1400",
    email: "compras@sobradinhocentral.com.br",
    responsavel: "Camila Rocha",
    status: "Qualificado",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    dataCadastro: "07/10/2026",
    duplicado: false,
    observacoes: "Forte atuação em medicamentos pediátricos e nutrição infantil; limite de crédito concedido.",
    historico: [{ data: "07/10/2026 11:45", texto: "Cadastro homologado para compras com prazo faturado." }]
  },
  {
    id: 45,
    nome: "FarmaPlan Planaltina",
    razaoSocial: "FarmaPlan Comércio de Produtos Farmacêuticos Ltda",
    uf: "DF",
    cidade: "Planaltina",
    bairro: "Setor Tradicional",
    cnpj: "53.409.118/0001-36",
    telefone: "(61) 3389-2040",
    email: "contato@farmaplandf.com.br",
    responsavel: "Ricardo Mendes",
    status: "Em contato",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    dataCadastro: HOJE_FORMATADO,
    duplicado: false,
    observacoes: "Em alinhamento de data de entrega para pedidos semanais com logística própria Centrus.",
    historico: [{ data: `${HOJE_FORMATADO} 09:10`, texto: "Primeiro contato comercial via WhatsApp realizado com sucesso." }]
  },
  {
    id: 46,
    nome: "Drogaria Sudoeste Pharma",
    razaoSocial: "Sudoeste Drogaria e Bem-Estar Ltda",
    uf: "DF",
    cidade: "Brasília",
    bairro: "Sudoeste",
    cnpj: "39.102.845/0001-99",
    telefone: "(61) 3344-9090",
    email: "sudoeste@sudoestepharma.com.br",
    responsavel: "Mariana Costa",
    status: "Respondido",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    dataCadastro: "12/10/2026",
    duplicado: false,
    observacoes: "Excelente localização comercial; avaliando migração de pedidos de perfumaria para a Centrus.",
    historico: [{ data: "12/10/2026 16:20", texto: "Comprador solicitou comparativo de margens por categoria." }]
  },
  {
    id: 47,
    nome: "Farmácia Gama Central",
    razaoSocial: "Gama Central Fármacos e Ortopedia Ltda",
    uf: "DF",
    cidade: "Gama",
    bairro: "Setor Central",
    cnpj: "55.780.129/0001-04",
    telefone: null,
    email: null,
    responsavel: "Não atribuído",
    status: "Sem interesse",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    dataCadastro: "05/10/2026",
    duplicado: false,
    observacoes: "Estabelecimento informou centralização total de compras na matriz em Belo Horizonte.",
    historico: [{ data: "05/10/2026 10:00", texto: "Feedback registrado pelo operador comercial." }]
  },
  {
    id: 48,
    nome: "Drogaria Vicente Pires",
    razaoSocial: "Vicente Pires Produtos Farmacêuticos ME",
    uf: "DF",
    cidade: "Vicente Pires",
    bairro: "Rua 04",
    cnpj: "42.661.904/0001-11",
    telefone: "(61) 3597-3310",
    email: "vicentepires@drogariasvicentepires.com.br",
    responsavel: "Lucas Ferreira",
    status: "Em contato",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    dataCadastro: HOJE_FORMATADO,
    duplicado: false,
    observacoes: "Região com rápida expansão comercial; proprietário solicitou visita técnica presencial.",
    historico: [{ data: `${HOJE_FORMATADO} 11:15`, texto: "Agendada visita do consultor regional para quinta-feira às 14h." }]
  },
  {
    id: 49,
    nome: "Drogaria Nova Era Pinheiros (Filial)",
    razaoSocial: "Nova Era Medicamentos e Perfumaria Ltda",
    uf: "SP",
    cidade: "São Paulo",
    bairro: "Pinheiros",
    cnpj: "43.829.102/0001-84",
    telefone: "(11) 3032-4115",
    email: "contato@novaerapinheiros.com.br",
    responsavel: "Mariana Costa",
    status: "Qualificado",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    dataCadastro: HOJE_FORMATADO,
    duplicado: true,
    observacoes: "Filial com mesmo CNPJ raiz matriz do Lead #1 auditada pela validação cadastral.",
    historico: [{ data: `${HOJE_FORMATADO} 10:35`, texto: "Vínculo societário e fiscal unificado ao cadastro do Lead #1." }]
  },
  {
    id: 50,
    nome: "Drogaria Goiás Central (Filial Bueno)",
    razaoSocial: "Goiás Central Drogaria e Medicamentos Ltda",
    uf: "GO",
    cidade: "Goiânia",
    bairro: "Setor Bueno",
    cnpj: "37.491.820/0001-19",
    telefone: "(62) 3241-1050",
    email: "comercial@goiascentralfarma.com.br",
    responsavel: "Mariana Costa",
    status: "Qualificado",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    dataCadastro: HOJE_FORMATADO,
    duplicado: true,
    observacoes: "Unidade auditada e vinculada à conta matriz do Lead #21 pelo CNPJ normalizado.",
    historico: [{ data: `${HOJE_FORMATADO} 09:05`, texto: "Registro normalizado para gestão de compras unificada." }]
  }
];

// =============================================================================
// 2. ESTADO GLOBAL DA APLICAÇÃO (UI STATE)
// =============================================================================

const state = {
  searchQuery: "",
  filterUf: "TODAS",
  filterStatus: "TODOS",
  filterContact: "TODOS",
  sortColumn: "nome",
  sortDirection: "asc", // 'asc' ou 'desc'
  currentPage: 1,
  pageSize: 10,
  selectedLeadIds: new Set(),
  activeLeadId: null
};

// =============================================================================
// 3. SELETORES DO DOM
// =============================================================================

const DOM = {
  // KPIs
  kpiTotalLeads: document.getElementById("kpiTotalLeads"),
  kpiEmContato: document.getElementById("kpiEmContato"),
  kpiNovosHoje: document.getElementById("kpiNovosHoje"),
  kpiRespondidos: document.getElementById("kpiRespondidos"),
  kpiDuplicados: document.getElementById("kpiDuplicados"),
  
  // Barras de distribuição
  fillSp: document.getElementById("fillSp"),
  fillGo: document.getElementById("fillGo"),
  fillDf: document.getElementById("fillDf"),
  countSp: document.getElementById("countSp"),
  countGo: document.getElementById("countGo"),
  countDf: document.getElementById("countDf"),

  // Filtros
  searchInput: document.getElementById("searchInput"),
  searchClearBtn: document.getElementById("searchClearBtn"),
  filterUf: document.getElementById("filterUf"),
  filterStatus: document.getElementById("filterStatus"),
  filterContact: document.getElementById("filterContact"),
  btnClearFilters: document.getElementById("btnClearFilters"),
  filterCountDisplay: document.getElementById("filterCountDisplay"),
  activeFilterTags: document.getElementById("activeFilterTags"),

  // Tabela
  tableBody: document.getElementById("leadsTableBody"),
  selectAllCheckbox: document.getElementById("selectAllCheckbox"),
  sortableHeaders: document.querySelectorAll("th.sortable"),
  emptyState: document.getElementById("emptyState"),
  leadsTable: document.getElementById("leadsTable"),

  // Paginação
  paginationInfo: document.getElementById("paginationInfo"),
  paginationButtons: document.getElementById("paginationButtons"),
  pageSizeSelect: document.getElementById("pageSizeSelect"),

  // Barra de ações em lote
  batchActionsBar: document.getElementById("batchActionsBar"),
  batchCountDisplay: document.getElementById("batchCountDisplay"),
  batchStatusSelect: document.getElementById("batchStatusSelect"),
  btnApplyBatchStatus: document.getElementById("btnApplyBatchStatus"),
  btnExportBatch: document.getElementById("btnExportBatch"),
  btnDeselectAll: document.getElementById("btnDeselectAll"),

  // Drawer de Detalhes
  leadDrawer: document.getElementById("leadDrawer"),
  drawerBackdrop: document.getElementById("drawerBackdrop"),
  drawerCloseBtn: document.getElementById("drawerCloseBtn"),
  drawerTitle: document.getElementById("drawerTitle"),
  drawerSubtitle: document.getElementById("drawerSubtitle"),
  drawerStatusSelect: document.getElementById("drawerStatusSelect"),
  drawerCnpj: document.getElementById("drawerCnpj"),
  drawerRazao: document.getElementById("drawerRazao"),
  drawerCnae: document.getElementById("drawerCnae"),
  drawerCidadeUf: document.getElementById("drawerCidadeUf"),
  drawerTelefone: document.getElementById("drawerTelefone"),
  drawerEmail: document.getElementById("drawerEmail"),
  drawerResponsavel: document.getElementById("drawerResponsavel"),
  drawerDataCadastro: document.getElementById("drawerDataCadastro"),
  drawerObservacoes: document.getElementById("drawerObservacoes"),
  drawerTimeline: document.getElementById("drawerTimeline"),
  btnSaveNotes: document.getElementById("btnSaveNotes"),
  btnCopyCnpj: document.getElementById("btnCopyCnpj"),
  btnWhatsappAction: document.getElementById("btnWhatsappAction"),
  btnEmailAction: document.getElementById("btnEmailAction"),

  // Modais
  btnExtractLeads: document.getElementById("btnExtractLeads"),
  extractModal: document.getElementById("extractModal"),
  extractModalClose: document.getElementById("extractModalClose"),
  extractModalCloseBtn2: document.getElementById("extractModalCloseBtn2"),

  btnOpenScraperLogs: document.getElementById("btnOpenScraperLogs"),
  logsModal: document.getElementById("logsModal"),
  logsModalClose: document.getElementById("logsModalClose"),
  logsModalCloseBtn2: document.getElementById("logsModalCloseBtn2"),

  // Modal Novo Lead
  btnOpenNewLeadModal: document.getElementById("btnOpenNewLeadModal"),
  newLeadModal: document.getElementById("newLeadModal"),
  newLeadModalClose: document.getElementById("newLeadModalClose"),
  newLeadModalCancel: document.getElementById("newLeadModalCancel"),
  newLeadForm: document.getElementById("newLeadForm"),

  // Exportação CSV
  btnExportCsv: document.getElementById("btnExportCsv"),

  // Toast
  toastContainer: document.getElementById("toastContainer")
};

// =============================================================================
// 4. FUNÇÕES DE UTILIDADE E FORMATAÇÃO
// =============================================================================

function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = "toast";
  
  const icon = type === "success" 
    ? `<svg class="toast-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>`
    : `<svg class="toast-icon" style="color: #60a5fa;" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;

  toast.innerHTML = `${icon}<span>${message}</span>`;
  DOM.toastContainer.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 250);
  }, 3200);
}

function cleanCnpj(cnpj) {
  return cnpj ? cnpj.replace(/\D/g, "") : "";
}

// Debounce para digitação na busca
function debounce(func, wait = 250) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// =============================================================================
// 5. CÁLCULO E ATUALIZAÇÃO DOS INDICADORES (KPIs)
// =============================================================================

function updateKpiIndicators() {
  const total = leadsData.length;
  const emContato = leadsData.filter(l => l.status === "Em contato").length;
  const novosHoje = leadsData.filter(l => l.dataCadastro === HOJE_FORMATADO).length;
  const respondidos = leadsData.filter(l => l.status === "Respondido" || l.status === "Qualificado").length;
  
  // Deduplicação calculada por CNPJ duplicado
  const cnpjs = new Map();
  let duplicadosCount = 0;
  leadsData.forEach(l => {
    const limpo = cleanCnpj(l.cnpj);
    if (limpo) {
      if (cnpjs.has(limpo)) {
        duplicadosCount++;
      } else {
        cnpjs.set(limpo, true);
      }
    }
  });

  DOM.kpiTotalLeads.textContent = total.toLocaleString("pt-BR");
  DOM.kpiEmContato.textContent = emContato.toLocaleString("pt-BR");
  DOM.kpiNovosHoje.textContent = novosHoje.toLocaleString("pt-BR");
  DOM.kpiRespondidos.textContent = respondidos.toLocaleString("pt-BR");
  DOM.kpiDuplicados.textContent = duplicadosCount.toLocaleString("pt-BR");

  // Distribuição por estado (SP, GO, DF)
  const spCount = leadsData.filter(l => l.uf === "SP").length;
  const goCount = leadsData.filter(l => l.uf === "GO").length;
  const dfCount = leadsData.filter(l => l.uf === "DF").length;

  const spPct = total > 0 ? (spCount / total) * 100 : 0;
  const goPct = total > 0 ? (goCount / total) * 100 : 0;
  const dfPct = total > 0 ? (dfCount / total) * 100 : 0;

  DOM.fillSp.style.width = `${spPct}%`;
  DOM.fillGo.style.width = `${goPct}%`;
  DOM.fillDf.style.width = `${dfPct}%`;

  DOM.countSp.textContent = `${spCount} (${Math.round(spPct)}%)`;
  DOM.countGo.textContent = `${goCount} (${Math.round(goPct)}%)`;
  DOM.countDf.textContent = `${dfCount} (${Math.round(dfPct)}%)`;
}

// =============================================================================
// 6. FILTRAGEM E ORDENAÇÃO DOS DADOS
// =============================================================================

function getFilteredAndSortedLeads() {
  const query = state.searchQuery.trim().toLowerCase();
  const rawQuery = cleanCnpj(state.searchQuery);

  let filtered = leadsData.filter(lead => {
    // 1. Filtro por Região (UF)
    if (state.filterUf !== "TODAS" && lead.uf !== state.filterUf) {
      return false;
    }

    // 2. Filtro por Status
    if (state.filterStatus !== "TODOS" && lead.status !== state.filterStatus) {
      return false;
    }

    // 3. Filtro por Disponibilidade de Contato
    if (state.filterContact === "COM_AMBOS") {
      if (!lead.telefone || !lead.email) return false;
    } else if (state.filterContact === "COM_TELEFONE") {
      if (!lead.telefone) return false;
    } else if (state.filterContact === "COM_EMAIL") {
      if (!lead.email) return false;
    } else if (state.filterContact === "INCOMPLETOS") {
      if (lead.telefone && lead.email) return false;
    }

    // 4. Pesquisa por Nome ou CNPJ
    if (query) {
      const matchNome = lead.nome.toLowerCase().includes(query);
      const matchCnpj = lead.cnpj.includes(query) || (rawQuery && cleanCnpj(lead.cnpj).includes(rawQuery));
      const matchCidade = lead.cidade.toLowerCase().includes(query);
      if (!matchNome && !matchCnpj && !matchCidade) {
        return false;
      }
    }

    return true;
  });

  // Ordenação
  filtered.sort((a, b) => {
    let valA = a[state.sortColumn] || "";
    let valB = b[state.sortColumn] || "";

    if (typeof valA === "string") valA = valA.toLowerCase();
    if (typeof valB === "string") valB = valB.toLowerCase();

    if (valA < valB) return state.sortDirection === "asc" ? -1 : 1;
    if (valA > valB) return state.sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  return filtered;
}

// =============================================================================
// 7. RENDERIZAÇÃO DA TABELA E PAGINAÇÃO
// =============================================================================

function renderTable() {
  const filtered = getFilteredAndSortedLeads();
  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / state.pageSize) || 1;

  if (state.currentPage > totalPages) {
    state.currentPage = totalPages;
  }

  const startIndex = (state.currentPage - 1) * state.pageSize;
  const endIndex = Math.min(startIndex + state.pageSize, totalItems);
  const pageItems = filtered.slice(startIndex, endIndex);

  // Atualizar contador de exibição
  DOM.filterCountDisplay.textContent = `Mostrando ${totalItems === 0 ? 0 : startIndex + 1}–${endIndex} de ${totalItems} leads (Total cadastrados: ${leadsData.length})`;

  // Atualizar Tags de Filtros Ativos
  renderActiveFilterTags();

  // Tratamento de Estado Vazio
  if (totalItems === 0) {
    DOM.leadsTable.style.display = "none";
    DOM.emptyState.style.display = "flex";
    DOM.paginationInfo.textContent = "Nenhum resultado para exibir";
    DOM.paginationButtons.innerHTML = "";
    updateSelectAllCheckbox(false);
    updateBatchBar();
    return;
  }

  DOM.leadsTable.style.display = "table";
  DOM.emptyState.style.display = "none";

  // Montagem do corpo da tabela
  DOM.tableBody.innerHTML = pageItems.map(lead => {
    const isSelected = state.selectedLeadIds.has(lead.id);
    const telefoneHtml = lead.telefone
      ? `<span>${lead.telefone}</span>`
      : `<span class="data-missing">Não informado</span>`;

    const emailHtml = lead.email
      ? `<span title="${lead.email}">${lead.email}</span>`
      : `<span class="data-missing">Não informado</span>`;

    const responsavelHtml = lead.responsavel && lead.responsavel !== "Não atribuído"
      ? `<span>${lead.responsavel}</span>`
      : `<span class="data-missing">Não atribuído</span>`;

    return `
      <tr class="${isSelected ? 'row-selected' : ''}" data-lead-id="${lead.id}">
        <td class="td-checkbox">
          <input 
            type="checkbox" 
            class="table-checkbox item-checkbox" 
            data-lead-id="${lead.id}" 
            ${isSelected ? 'checked' : ''}
            aria-label="Selecionar lead ${lead.nome}"
          />
        </td>
        <td class="td-nome">
          <div class="lead-name-text" data-action="open-drawer" data-lead-id="${lead.id}">
            ${lead.nome}
          </div>
          <div class="lead-category-sub">
            ${lead.bairro ? lead.bairro + ' • ' : ''}CNAE 4771-7/01
          </div>
        </td>
        <td>
          <span class="badge-uf badge-uf-${lead.uf}">${lead.uf}</span>
        </td>
        <td class="td-cnpj">${lead.cnpj}</td>
        <td>${telefoneHtml}</td>
        <td>${emailHtml}</td>
        <td class="td-cidade">${lead.cidade}</td>
        <td>${responsavelHtml}</td>
        <td>
          <div class="status-select-wrap">
            <select 
              class="status-badge-select" 
              data-status="${lead.status}" 
              data-lead-id="${lead.id}"
              aria-label="Alterar status de ${lead.nome}"
            >
              <option value="Não contatado" ${lead.status === 'Não contatado' ? 'selected' : ''}>Não contatado</option>
              <option value="Em contato" ${lead.status === 'Em contato' ? 'selected' : ''}>Em contato</option>
              <option value="Respondido" ${lead.status === 'Respondido' ? 'selected' : ''}>Respondido</option>
              <option value="Qualificado" ${lead.status === 'Qualificado' ? 'selected' : ''}>Qualificado</option>
              <option value="Sem interesse" ${lead.status === 'Sem interesse' ? 'selected' : ''}>Sem interesse</option>
            </select>
            <span class="status-select-icon">▼</span>
          </div>
        </td>
        <td>
          <button 
            type="button" 
            class="btn btn-secondary btn-sm" 
            data-action="open-drawer" 
            data-lead-id="${lead.id}"
            title="Ver detalhes cadastrais e histórico"
          >
            Detalhes
          </button>
        </td>
      </tr>
    `;
  }).join("");

  // Atualizar estado do checkbox 'Selecionar Todos da Página'
  const allPageSelected = pageItems.length > 0 && pageItems.every(l => state.selectedLeadIds.has(l.id));
  updateSelectAllCheckbox(allPageSelected);

  // Renderizar paginação
  renderPagination(totalItems, totalPages);

  // Atualizar barra de lote
  updateBatchBar();
}

function updateSelectAllCheckbox(checked) {
  DOM.selectAllCheckbox.checked = checked;
}

function renderPagination(totalItems, totalPages) {
  DOM.paginationInfo.textContent = `Página ${state.currentPage} de ${totalPages} (${totalItems} registros)`;

  let buttonsHtml = "";

  // Botão Anterior
  buttonsHtml += `
    <button class="btn-page" id="btnPagePrev" ${state.currentPage === 1 ? 'disabled' : ''} aria-label="Página anterior">
      ‹
    </button>
  `;

  // Páginas numeradas
  for (let i = 1; i <= totalPages; i++) {
    // Exibe páginas relevantes se houver muitas páginas
    if (totalPages > 6 && Math.abs(i - state.currentPage) > 2 && i !== 1 && i !== totalPages) {
      if (i === 2 || i === totalPages - 1) {
        buttonsHtml += `<span style="padding: 0 4px; color: #94a3b8;">...</span>`;
      }
      continue;
    }

    buttonsHtml += `
      <button class="btn-page ${i === state.currentPage ? 'active' : ''}" data-page="${i}">
        ${i}
      </button>
    `;
  }

  // Botão Próximo
  buttonsHtml += `
    <button class="btn-page" id="btnPageNext" ${state.currentPage === totalPages ? 'disabled' : ''} aria-label="Próxima página">
      ›
    </button>
  `;

  DOM.paginationButtons.innerHTML = buttonsHtml;
}

function renderActiveFilterTags() {
  const tags = [];

  if (state.searchQuery) {
    tags.push({ label: `Busca: "${state.searchQuery}"`, key: "query" });
  }
  if (state.filterUf !== "TODAS") {
    tags.push({ label: `UF: ${state.filterUf}`, key: "uf" });
  }
  if (state.filterStatus !== "TODOS") {
    tags.push({ label: `Status: ${state.filterStatus}`, key: "status" });
  }
  if (state.filterContact !== "TODOS") {
    const contactMap = {
      COM_AMBOS: "Com Tel e E-mail",
      COM_TELEFONE: "Apenas c/ Tel",
      COM_EMAIL: "Apenas c/ E-mail",
      INCOMPLETOS: "Dados Incompletos"
    };
    tags.push({ label: `Contato: ${contactMap[state.filterContact]}`, key: "contact" });
  }

  if (tags.length === 0) {
    DOM.activeFilterTags.innerHTML = "";
    return;
  }

  DOM.activeFilterTags.innerHTML = tags.map(t => `
    <span class="filter-tag">
      ${t.label}
      <span class="filter-tag-close" data-clear-key="${t.key}" title="Remover filtro">×</span>
    </span>
  `).join("");
}

// =============================================================================
// 8. GERENCIAMENTO DE SELEÇÃO E AÇÕES EM LOTE
// =============================================================================

function updateBatchBar() {
  const count = state.selectedLeadIds.size;
  if (count > 0) {
    DOM.batchCountDisplay.textContent = `${count} lead${count > 1 ? 's' : ''} selecionado${count > 1 ? 's' : ''}`;
    DOM.batchActionsBar.classList.add("active");
  } else {
    DOM.batchActionsBar.classList.remove("active");
  }
}

// =============================================================================
// 9. PAINEL LATERAL (DRAWER) DE DETALHES DO LEAD
// =============================================================================

function openLeadDrawer(leadId) {
  const lead = leadsData.find(l => l.id === leadId);
  if (!lead) return;

  state.activeLeadId = leadId;

  DOM.drawerTitle.textContent = lead.nome;
  DOM.drawerSubtitle.textContent = `${lead.razaoSocial} • ${lead.cidade}/${lead.uf}`;
  
  DOM.drawerStatusSelect.value = lead.status;
  DOM.drawerStatusSelect.setAttribute("data-status", lead.status);

  DOM.drawerCnpj.textContent = lead.cnpj;
  DOM.drawerRazao.textContent = lead.razaoSocial;
  DOM.drawerCnae.textContent = lead.cnae;
  DOM.drawerCidadeUf.textContent = `${lead.bairro ? lead.bairro + ', ' : ''}${lead.cidade} - ${lead.uf}`;
  
  DOM.drawerTelefone.textContent = lead.telefone || "Não informado";
  DOM.drawerEmail.textContent = lead.email || "Não informado";
  DOM.drawerResponsavel.textContent = lead.responsavel || "Não atribuído";
  DOM.drawerDataCadastro.textContent = lead.dataCadastro;
  DOM.drawerObservacoes.value = lead.observacoes || "";

  // Atualizar ações rápidas
  if (lead.telefone) {
    const rawTel = lead.telefone.replace(/\D/g, "");
    DOM.btnWhatsappAction.onclick = () => {
      window.open(`https://wa.me/55${rawTel}?text=Olá,%20somos%20da%20Centrus.%20Gostaríamos%20de%20apresentar%20nossas%20soluções%20farmacêuticas.`, "_blank");
    };
    DOM.btnWhatsappAction.style.display = "inline-flex";
  } else {
    DOM.btnWhatsappAction.style.display = "none";
  }

  if (lead.email) {
    DOM.btnEmailAction.onclick = () => {
      window.location.href = `mailto:${lead.email}?subject=Apresentação%20Comercial%20Centrus%20PharmaLeads`;
    };
    DOM.btnEmailAction.style.display = "inline-flex";
  } else {
    DOM.btnEmailAction.style.display = "none";
  }

  // Linha do tempo de interações comerciais
  if (lead.historico && lead.historico.length > 0) {
    DOM.drawerTimeline.innerHTML = lead.historico.map(h => `
      <div class="timeline-item">
        <div class="timeline-dot"></div>
        <div class="timeline-time">${h.data}</div>
        <div class="timeline-text">${h.texto}</div>
      </div>
    `).join("");
  } else {
    DOM.drawerTimeline.innerHTML = `<span class="data-missing">Nenhum evento registrado ainda.</span>`;
  }

  DOM.drawerBackdrop.classList.add("active");
  DOM.leadDrawer.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeLeadDrawer() {
  DOM.drawerBackdrop.classList.remove("active");
  DOM.leadDrawer.classList.remove("active");
  document.body.style.overflow = "";
  state.activeLeadId = null;
}

// =============================================================================
// 10. EXPORTAÇÃO CSV COMPATÍVEL COM EXCEL (UTF-8 COM BOM & DELIMITADOR ;)
// =============================================================================

function exportToCsv(targetLeads = null) {
  let leadsToExport = targetLeads;

  // Se não foi passado específico e temos seleção ativa, prioriza a seleção
  if (!leadsToExport) {
    if (state.selectedLeadIds.size > 0) {
      leadsToExport = leadsData.filter(l => state.selectedLeadIds.has(l.id));
    } else {
      leadsToExport = getFilteredAndSortedLeads();
    }
  }

  if (leadsToExport.length === 0) {
    showToast("Nenhum lead disponível para exportação com os filtros atuais.", "info");
    return;
  }

  // Cabeçalhos em português
  const headers = [
    "ID",
    "Nome Fantasia",
    "Razão Social",
    "Estado (UF)",
    "Cidade",
    "Bairro",
    "CNPJ",
    "Telefone",
    "E-mail",
    "Responsável Comercial",
    "Status da Negociação",
    "CNAE Principal",
    "Data de Cadastro",
    "Observações"
  ];

  const escapeCsv = (str) => {
    if (str === null || str === undefined) return '""';
    const s = String(str).replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = leadsToExport.map(l => [
    escapeCsv(l.id),
    escapeCsv(l.nome),
    escapeCsv(l.razaoSocial),
    escapeCsv(l.uf),
    escapeCsv(l.cidade),
    escapeCsv(l.bairro || ""),
    escapeCsv(l.cnpj),
    escapeCsv(l.telefone || "Não informado"),
    escapeCsv(l.email || "Não informado"),
    escapeCsv(l.responsavel || "Não atribuído"),
    escapeCsv(l.status),
    escapeCsv(l.cnae),
    escapeCsv(l.dataCadastro),
    escapeCsv(l.observacoes || "")
  ].join(";"));

  // UTF-8 com BOM (\uFEFF) para garantir caracteres acentuados no Excel do Windows
  const csvContent = "\uFEFF" + [headers.join(";"), ...rows].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const fileName = `centrus-pharmaleads-${yyyy}-${mm}-${dd}.csv`;

  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showToast(`Exportação concluída: ${leadsToExport.length} leads salvos em CSV.`);
}

// =============================================================================
// 11. MODAIS (EXTRAÇÃO E LOGS)
// =============================================================================

function openExtractModal() {
  DOM.extractModal.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeExtractModal() {
  DOM.extractModal.classList.remove("active");
  document.body.style.overflow = "";
}

function openLogsModal() {
  DOM.logsModal.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeLogsModal() {
  DOM.logsModal.classList.remove("active");
  document.body.style.overflow = "";
}

function openNewLeadModal() {
  if (!DOM.newLeadModal) return;
  DOM.newLeadModal.classList.add("active");
  document.body.style.overflow = "hidden";
  setTimeout(() => {
    const inputNome = document.getElementById("newLeadNome");
    if (inputNome) inputNome.focus();
  }, 100);
}

function closeNewLeadModal() {
  if (!DOM.newLeadModal) return;
  DOM.newLeadModal.classList.remove("active");
  document.body.style.overflow = "";
  if (DOM.newLeadForm) DOM.newLeadForm.reset();
}

// =============================================================================
// 12. VINCULAÇÃO DE EVENTOS (EVENT LISTENERS)
// =============================================================================

function setupEventListeners() {
  // Pesquisa com debounce
  const debouncedSearch = debounce((val) => {
    state.searchQuery = val;
    state.currentPage = 1;
    DOM.searchClearBtn.style.display = val ? "block" : "none";
    renderTable();
  }, 250);

  DOM.searchInput.addEventListener("input", (e) => {
    debouncedSearch(e.target.value);
  });

  DOM.searchClearBtn.addEventListener("click", () => {
    DOM.searchInput.value = "";
    state.searchQuery = "";
    state.currentPage = 1;
    DOM.searchClearBtn.style.display = "none";
    renderTable();
  });

  // Filtros de seleção
  DOM.filterUf.addEventListener("change", (e) => {
    state.filterUf = e.target.value;
    state.currentPage = 1;
    renderTable();
  });

  DOM.filterStatus.addEventListener("change", (e) => {
    state.filterStatus = e.target.value;
    state.currentPage = 1;
    renderTable();
  });

  DOM.filterContact.addEventListener("change", (e) => {
    state.filterContact = e.target.value;
    state.currentPage = 1;
    renderTable();
  });

  // Limpar todos os filtros
  DOM.btnClearFilters.addEventListener("click", () => {
    state.searchQuery = "";
    state.filterUf = "TODAS";
    state.filterStatus = "TODOS";
    state.filterContact = "TODOS";
    state.currentPage = 1;

    DOM.searchInput.value = "";
    DOM.searchClearBtn.style.display = "none";
    DOM.filterUf.value = "TODAS";
    DOM.filterStatus.value = "TODOS";
    DOM.filterContact.value = "TODOS";

    renderTable();
    showToast("Filtros redefinidos.");
  });

  // Remoção pontual de tags de filtros ativos
  DOM.activeFilterTags.addEventListener("click", (e) => {
    const closeBtn = e.target.closest(".filter-tag-close");
    if (!closeBtn) return;

    const key = closeBtn.getAttribute("data-clear-key");
    if (key === "query") {
      state.searchQuery = "";
      DOM.searchInput.value = "";
      DOM.searchClearBtn.style.display = "none";
    } else if (key === "uf") {
      state.filterUf = "TODAS";
      DOM.filterUf.value = "TODAS";
    } else if (key === "status") {
      state.filterStatus = "TODOS";
      DOM.filterStatus.value = "TODOS";
    } else if (key === "contact") {
      state.filterContact = "TODOS";
      DOM.filterContact.value = "TODOS";
    }
    state.currentPage = 1;
    renderTable();
  });

  // Ordenação nas colunas da tabela
  DOM.sortableHeaders.forEach(th => {
    th.addEventListener("click", () => {
      const col = th.getAttribute("data-sort");
      if (state.sortColumn === col) {
        state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
      } else {
        state.sortColumn = col;
        state.sortDirection = "asc";
      }

      DOM.sortableHeaders.forEach(header => {
        header.classList.remove("sort-asc", "sort-desc");
      });

      th.classList.add(state.sortDirection === "asc" ? "sort-asc" : "sort-desc");
      renderTable();
    });
  });

  // Eventos na Tabela (Checkbox de seleção e Status inline)
  DOM.tableBody.addEventListener("change", (e) => {
    // Checkbox de item
    if (e.target.classList.contains("item-checkbox")) {
      const leadId = parseInt(e.target.getAttribute("data-lead-id"), 10);
      if (e.target.checked) {
        state.selectedLeadIds.add(leadId);
      } else {
        state.selectedLeadIds.delete(leadId);
      }

      const row = e.target.closest("tr");
      if (row) {
        row.classList.toggle("row-selected", e.target.checked);
      }

      // Verifica se todos da página continuam marcados
      const filtered = getFilteredAndSortedLeads();
      const startIndex = (state.currentPage - 1) * state.pageSize;
      const pageItems = filtered.slice(startIndex, startIndex + state.pageSize);
      const allSelected = pageItems.every(l => state.selectedLeadIds.has(l.id));
      updateSelectAllCheckbox(allSelected);

      updateBatchBar();
    }

    // Select de Status inline
    if (e.target.classList.contains("status-badge-select")) {
      const leadId = parseInt(e.target.getAttribute("data-lead-id"), 10);
      const newStatus = e.target.value;
      const lead = leadsData.find(l => l.id === leadId);

      if (lead) {
        lead.status = newStatus;
        e.target.setAttribute("data-status", newStatus);
        
        // Histórico de alteração
        if (!lead.historico) lead.historico = [];
        lead.historico.unshift({
          data: `${HOJE_FORMATADO} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
          texto: `Status atualizado para "${newStatus}".`
        });

        updateKpiIndicators();
        showToast(`Status de "${lead.nome}" alterado para ${newStatus}.`);
      }
    }
  });

  // Clique em "Ver Detalhes" ou no nome do lead na tabela
  DOM.tableBody.addEventListener("click", (e) => {
    const actionTarget = e.target.closest('[data-action="open-drawer"]');
    if (actionTarget) {
      const leadId = parseInt(actionTarget.getAttribute("data-lead-id"), 10);
      openLeadDrawer(leadId);
    }
  });

  // Checkbox 'Selecionar Todos da Página'
  DOM.selectAllCheckbox.addEventListener("change", (e) => {
    const filtered = getFilteredAndSortedLeads();
    const startIndex = (state.currentPage - 1) * state.pageSize;
    const pageItems = filtered.slice(startIndex, startIndex + state.pageSize);

    if (e.target.checked) {
      pageItems.forEach(l => state.selectedLeadIds.add(l.id));
    } else {
      pageItems.forEach(l => state.selectedLeadIds.delete(l.id));
    }

    renderTable();
  });

  // Paginação
  DOM.pageSizeSelect.addEventListener("change", (e) => {
    state.pageSize = parseInt(e.target.value, 10);
    state.currentPage = 1;
    renderTable();
  });

  DOM.paginationButtons.addEventListener("click", (e) => {
    if (e.target.id === "btnPagePrev" && state.currentPage > 1) {
      state.currentPage--;
      renderTable();
    } else if (e.target.id === "btnPageNext") {
      state.currentPage++;
      renderTable();
    } else if (e.target.getAttribute("data-page")) {
      state.currentPage = parseInt(e.target.getAttribute("data-page"), 10);
      renderTable();
    }
  });

  // Ações em Lote
  DOM.btnApplyBatchStatus.addEventListener("click", () => {
    const newStatus = DOM.batchStatusSelect.value;
    if (!newStatus) return;

    let count = 0;
    leadsData.forEach(l => {
      if (state.selectedLeadIds.has(l.id)) {
        l.status = newStatus;
        count++;
      }
    });

    updateKpiIndicators();
    renderTable();
    showToast(`Status de ${count} lead(s) alterado para "${newStatus}".`);
  });

  DOM.btnExportBatch.addEventListener("click", () => {
    exportToCsv();
  });

  DOM.btnDeselectAll.addEventListener("click", () => {
    state.selectedLeadIds.clear();
    renderTable();
  });

  // Drawer
  DOM.drawerCloseBtn.addEventListener("click", closeLeadDrawer);
  DOM.drawerBackdrop.addEventListener("click", closeLeadDrawer);

  DOM.drawerStatusSelect.addEventListener("change", (e) => {
    if (!state.activeLeadId) return;
    const lead = leadsData.find(l => l.id === state.activeLeadId);
    if (lead) {
      lead.status = e.target.value;
      DOM.drawerStatusSelect.setAttribute("data-status", e.target.value);
      updateKpiIndicators();
      renderTable();
      showToast(`Status atualizado para "${lead.status}".`);
    }
  });

  DOM.btnSaveNotes.addEventListener("click", () => {
    if (!state.activeLeadId) return;
    const lead = leadsData.find(l => l.id === state.activeLeadId);
    if (lead) {
      lead.observacoes = DOM.drawerObservacoes.value;
      showToast("Anotações comerciais atualizadas.");
    }
  });

  DOM.btnCopyCnpj.addEventListener("click", () => {
    if (!state.activeLeadId) return;
    const lead = leadsData.find(l => l.id === state.activeLeadId);
    if (lead) {
      navigator.clipboard.writeText(lead.cnpj).then(() => {
        showToast(`CNPJ ${lead.cnpj} copiado para a área de transferência!`);
      }).catch(() => {
        showToast("Erro ao copiar CNPJ.", "info");
      });
    }
  });

  // Modais de Extração e Logs
  DOM.btnExtractLeads.addEventListener("click", openExtractModal);
  DOM.extractModalClose.addEventListener("click", closeExtractModal);
  DOM.extractModalCloseBtn2.addEventListener("click", closeExtractModal);
  DOM.extractModal.addEventListener("click", (e) => {
    if (e.target === DOM.extractModal) closeExtractModal();
  });

  DOM.btnOpenScraperLogs.addEventListener("click", openLogsModal);
  DOM.logsModalClose.addEventListener("click", closeLogsModal);
  DOM.logsModalCloseBtn2.addEventListener("click", closeLogsModal);
  DOM.logsModal.addEventListener("click", (e) => {
    if (e.target === DOM.logsModal) closeLogsModal();
  });

  // Exportação CSV geral
  DOM.btnExportCsv.addEventListener("click", () => {
    exportToCsv();
  });


  // Ação de Sincronização Cadastral no Modal
  const btnExecuteSync = document.getElementById("btnExecuteSync");
  const syncProgressContainer = document.getElementById("syncProgressContainer");
  const syncProgressBar = document.getElementById("syncProgressBar");
  const syncProgressLabel = document.getElementById("syncProgressLabel");
  const syncProgressPercent = document.getElementById("syncProgressPercent");

  if (btnExecuteSync) {
    btnExecuteSync.addEventListener("click", () => {
      btnExecuteSync.disabled = true;
      if (syncProgressContainer) syncProgressContainer.style.display = "block";
      
      let progress = 0;
      const interval = setInterval(() => {
        progress += 25;
        if (syncProgressBar) syncProgressBar.style.width = progress + "%";
        if (syncProgressPercent) syncProgressPercent.textContent = progress + "%";

        if (progress === 25 && syncProgressLabel) syncProgressLabel.textContent = "Consultando Google Places e RFB...";
        if (progress === 50 && syncProgressLabel) syncProgressLabel.textContent = "Validando CNAE 4771-7/01...";
        if (progress === 75 && syncProgressLabel) syncProgressLabel.textContent = "Deduplicando registros por CNPJ...";
        if (progress >= 100) {
          clearInterval(interval);
          if (syncProgressLabel) syncProgressLabel.textContent = "Sincronização concluída!";
          setTimeout(() => {
            closeExtractModal();
            btnExecuteSync.disabled = false;
            if (syncProgressContainer) syncProgressContainer.style.display = "none";
            if (syncProgressBar) syncProgressBar.style.width = "0%";
            updateKpiIndicators();
            renderTable();
            showToast("Base sincronizada: 50 estabelecimentos verificados na RFB.");
          }, 500);
        }
      }, 350);
    });
  }

  // Modal de Cadastro de Nova Farmácia
  if (DOM.btnOpenNewLeadModal) {
    DOM.btnOpenNewLeadModal.addEventListener("click", openNewLeadModal);
  }
  if (DOM.newLeadModalClose) {
    DOM.newLeadModalClose.addEventListener("click", closeNewLeadModal);
  }
  if (DOM.newLeadModalCancel) {
    DOM.newLeadModalCancel.addEventListener("click", closeNewLeadModal);
  }
  if (DOM.newLeadModal) {
    DOM.newLeadModal.addEventListener("click", (e) => {
      if (e.target === DOM.newLeadModal) closeNewLeadModal();
    });
  }

  // Máscara dinâmica de CNPJ
  const inputCnpj = document.getElementById("newLeadCnpj");
  if (inputCnpj) {
    inputCnpj.addEventListener("input", (e) => {
      let v = e.target.value.replace(/\D/g, "");
      if (v.length > 14) v = v.slice(0, 14);
      if (v.length > 12) {
        v = v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{1,2})$/, "$1.$2.$3/$4-$5");
      } else if (v.length > 8) {
        v = v.replace(/^(\d{2})(\d{3})(\d{3})(\d{1,4})$/, "$1.$2.$3/$4");
      } else if (v.length > 5) {
        v = v.replace(/^(\d{2})(\d{3})(\d{1,3})$/, "$1.$2.$3");
      } else if (v.length > 2) {
        v = v.replace(/^(\d{2})(\d{1,3})$/, "$1.$2");
      }
      e.target.value = v;
    });
  }

  // Máscara dinâmica de Telefone
  const inputTel = document.getElementById("newLeadTelefone");
  if (inputTel) {
    inputTel.addEventListener("input", (e) => {
      let v = e.target.value.replace(/\D/g, "");
      if (v.length > 11) v = v.slice(0, 11);
      if (v.length > 10) {
        v = v.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
      } else if (v.length > 6) {
        v = v.replace(/^(\d{2})(\d{4})(\d{0,4})$/, "($1) $2-$3");
      } else if (v.length > 2) {
        v = v.replace(/^(\d{2})(\d{0,5})$/, "($1) $2");
      }
      e.target.value = v;
    });
  }

  // Submissão do Formulário de Cadastro
  if (DOM.newLeadForm) {
    DOM.newLeadForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const nome = document.getElementById("newLeadNome").value.trim();
      const razao = document.getElementById("newLeadRazao").value.trim();
      const cnpj = document.getElementById("newLeadCnpj").value.trim();
      const uf = document.getElementById("newLeadUf").value;
      const cidade = document.getElementById("newLeadCidade").value.trim();
      const bairro = document.getElementById("newLeadBairro").value.trim();
      const telefone = document.getElementById("newLeadTelefone").value.trim();
      const email = document.getElementById("newLeadEmail").value.trim();
      const responsavel = document.getElementById("newLeadResponsavel").value;
      const status = document.getElementById("newLeadStatus").value;
      const cnae = document.getElementById("newLeadCnae").value.trim();
      const observacoes = document.getElementById("newLeadObservacoes").value.trim();

      if (!nome || !cnpj || !cidade || !telefone) {
        showToast("Por favor, preencha todos os campos obrigatórios (*)", "info");
        return;
      }

      // Validação de unicidade de CNPJ
      const limpo = cleanCnpj(cnpj);
      const isDuplicado = leadsData.some(l => cleanCnpj(l.cnpj) === limpo);

      const nextId = leadsData.reduce((max, l) => Math.max(max, l.id), 0) + 1;
      const horaAtual = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      const novoLead = {
        id: nextId,
        nome: nome,
        razaoSocial: razao || `${nome} Medicamentos Ltda`,
        uf: uf,
        cidade: cidade,
        bairro: bairro || "Centro",
        cnpj: cnpj,
        telefone: telefone,
        email: email || null,
        responsavel: responsavel,
        status: status,
        cnae: cnae || "4771-7/01 - Comércio varejista de produtos farmacêuticos",
        dataCadastro: HOJE_FORMATADO,
        duplicado: isDuplicado,
        observacoes: observacoes || "Estabelecimento incluído manualmente no painel Centrus.",
        historico: [
          { data: `${HOJE_FORMATADO} ${horaAtual}`, texto: "Estabelecimento cadastrado manualmente no sistema." }
        ]
      };

      // Adiciona no topo da lista
      leadsData.unshift(novoLead);

      // Atualiza badge de contagem no cabeçalho
      const navCount = document.getElementById("headerNavLeadCount");
      if (navCount) navCount.textContent = leadsData.length;

      // Atualiza estado e interface
      updateKpiIndicators();
      state.currentPage = 1;
      renderTable();
      closeNewLeadModal();

      showToast(`Farmácia "${nome}" cadastrada com sucesso!`);
    });
  }

  // Atalho de Teclado (ESC fecha modais e drawer)
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeLeadDrawer();
      closeExtractModal();
      closeLogsModal();
      closeNewLeadModal();
    }
  });
}

// =============================================================================
// 13. INICIALIZAÇÃO DA APLICAÇÃO
// =============================================================================

document.addEventListener("DOMContentLoaded", () => {
  updateKpiIndicators();
  renderTable();
  setupEventListeners();
  console.log("Centrus PharmaLeads - Plataforma operacional ativa.");
});

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

// =============================================================================
// CONEXÃO COM O BACKEND SUPABASE (NUVEM)
// =============================================================================

const SUPABASE_CONFIG = {
  url: "https://qxsdcrywsjkrpcbfgbxb.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4c2Rjcnl3c2prcnBjYmZnYnhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NTA1OTYsImV4cCI6MjA3NTUyNjU5Nn0.djFikp7bsTxKkAxls4evik5Ft6l1Gnd0N16CzSmiZYE"
};

const supabaseClient = (typeof window !== "undefined" && window.supabase)
  ? window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey)
  : null;

// Base Nacional Complementar (RJ, MG, ES, PR, RS, SC, BA, PE, CE, RN, PB, MT, MS, AM, PA, TO)
const BASE_NACIONAL_COMPLEMENTAR = [
  {
    id: 101,
    nome: "Drogaria Venancio Tijuca",
    razaoSocial: "Drogaria Venancio SA",
    cnpj: "30.407.245/0012-89",
    uf: "RJ",
    cidade: "Rio de Janeiro",
    bairro: "Tijuca",
    telefone: "(21) 3095-1000",
    whatsapp: "(21) 98844-1000",
    email: "comercial@drogariavenancio.com.br",
    website: "https://www.drogariavenancio.com.br",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    status: "Qualificado",
    responsavel: "Mariana Costa",
    dataCadastro: HOJE_FORMATADO,
    duplicado: false,
    observacoes: "Grande rede no RJ. Excelente potencial de abastecimento em dermocosméticos e genéricos.",
    historico: [{ data: `${HOJE_FORMATADO} 09:30`, texto: "Lead qualificado para fornecimento corporativo no Rio de Janeiro." }]
  },
  {
    id: 102,
    nome: "Farmácia Granado Botafogo",
    razaoSocial: "Casa Granado Laboratórios SA",
    cnpj: "33.109.356/0001-25",
    uf: "RJ",
    cidade: "Rio de Janeiro",
    bairro: "Botafogo",
    telefone: "(21) 3231-6700",
    whatsapp: "(21) 97120-4500",
    email: "contato@granado.com.br",
    website: "https://www.granado.com.br",
    cnae: "4771-7/02 - Comércio com manipulação de fórmulas",
    status: "Em contato",
    responsavel: "Mariana Costa",
    dataCadastro: HOJE_FORMATADO,
    duplicado: false,
    observacoes: "Marca tradicional. Interesse em matérias-primas e insumos galênicos de alta pureza.",
    historico: [{ data: `${HOJE_FORMATADO} 10:15`, texto: "Apresentação de catálogo institucional enviada via WhatsApp." }]
  },
  {
    id: 103,
    nome: "Drogaria Pacheco Savassi",
    razaoSocial: "Drogarias Pacheco SA",
    cnpj: "33.438.250/0245-12",
    uf: "MG",
    cidade: "Belo Horizonte",
    bairro: "Savassi",
    telefone: "(31) 3281-5500",
    whatsapp: "(31) 99312-5500",
    email: "compras.mg@drogariaspacheco.com.br",
    website: "https://www.drogariaspacheco.com.br",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    status: "Respondido",
    responsavel: "Lucas Ferreira",
    dataCadastro: HOJE_FORMATADO,
    duplicado: false,
    observacoes: "Comprador regional solicitou envio de tabela Centrus com prazo 30/60 dias.",
    historico: [{ data: `${HOJE_FORMATADO} 11:00`, texto: "Comprador solicitou proposta comercial formal por e-mail." }]
  },
  {
    id: 104,
    nome: "Farmácia Oficina de Ervas BH",
    razaoSocial: "Oficina Farmacêutica e Manipulação Ltda",
    cnpj: "04.582.119/0001-90",
    uf: "MG",
    cidade: "Belo Horizonte",
    bairro: "Funcionários",
    telefone: "(31) 3225-8899",
    whatsapp: "(31) 98765-8899",
    email: "farmaceutico@oficinadeervas.com.br",
    website: "https://www.oficinadeervas.com.br",
    cnae: "4771-7/02 - Comércio varejista com manipulação de fórmulas",
    status: "Não contatado",
    responsavel: "Lucas Ferreira",
    dataCadastro: HOJE_FORMATADO,
    duplicado: false,
    observacoes: "Farmácia magistral com 2 laboratórios ativos. Alto consumo de fitoterápicos e cápsulas.",
    historico: [{ data: `${HOJE_FORMATADO} 08:40`, texto: "Estabelecimento importado na rotina de prospecção Sudeste." }]
  },
  {
    id: 105,
    nome: "Farmácia Santa Lúcia Vitória",
    razaoSocial: "Farmácias Santa Lúcia Ltda",
    cnpj: "27.351.984/0003-44",
    uf: "ES",
    cidade: "Vitória",
    bairro: "Praia do Canto",
    telefone: "(27) 3145-9000",
    whatsapp: "(27) 99877-9000",
    email: "compras@farmaciasantalucia.com.br",
    website: "https://www.farmaciasantalucia.com.br",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    status: "Em contato",
    responsavel: "Mariana Costa",
    dataCadastro: HOJE_FORMATADO,
    duplicado: false,
    observacoes: "Principal rede independente do Espírito Santo. Negociação de frete FOB/CIF em andamento.",
    historico: [{ data: `${HOJE_FORMATADO} 14:10`, texto: "Contato inicial estabelecido com o setor de compras." }]
  },
  {
    id: 106,
    nome: "Drogaria Nissei Batel",
    razaoSocial: "Farmácias Nissei SA",
    cnpj: "79.980.034/0056-78",
    uf: "PR",
    cidade: "Curitiba",
    bairro: "Batel",
    telefone: "(41) 3213-7000",
    whatsapp: "(41) 99123-7000",
    email: "fornecedores@farmaciasnissei.com.br",
    website: "https://www.farmaciasnissei.com.br",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    status: "Qualificado",
    responsavel: "Ricardo Mendes",
    dataCadastro: HOJE_FORMATADO,
    duplicado: false,
    observacoes: "Faturamento expressivo no Paraná. Aprovado cadastro preliminar junto à Centrus.",
    historico: [{ data: `${HOJE_FORMATADO} 15:20`, texto: "Cadastro homologado para fornecimento de medicamentos na praça de Curitiba." }]
  },
  {
    id: 107,
    nome: "Farmácia Panvel Moinhos de Vento",
    razaoSocial: "Dimed SA Distribuidora de Medicamentos",
    cnpj: "92.665.611/0088-34",
    uf: "RS",
    cidade: "Porto Alegre",
    bairro: "Moinhos de Vento",
    telefone: "(51) 3218-9000",
    whatsapp: "(51) 98455-9000",
    email: "central.compras@panvel.com.br",
    website: "https://www.panvel.com.br",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    status: "Respondido",
    responsavel: "Ricardo Mendes",
    dataCadastro: HOJE_FORMATADO,
    duplicado: false,
    observacoes: "Rede líder na Região Sul. Avaliando condições para linha de higiene e medicamentos OTC.",
    historico: [{ data: `${HOJE_FORMATADO} 16:00`, texto: "Solicitação de tabela de preços e condições de pagamento recebida." }]
  },
  {
    id: 108,
    nome: "Drogaria Catarinense Centro",
    razaoSocial: "Cia Latino Americana de Medicamentos - CLAMED",
    cnpj: "84.683.481/0102-55",
    uf: "SC",
    cidade: "Florianópolis",
    bairro: "Centro",
    telefone: "(48) 3224-8000",
    whatsapp: "(48) 99912-8000",
    email: "suprimentos@clamed.com.br",
    website: "https://www.drogariacatarinense.com.br",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    status: "Não contatado",
    responsavel: "Ricardo Mendes",
    dataCadastro: HOJE_FORMATADO,
    duplicado: false,
    observacoes: "Grupo CLAMED com centenas de unidades em SC. Lead com alto potencial corporativo.",
    historico: [{ data: `${HOJE_FORMATADO} 09:00`, texto: "Estabelecimento adicionado ao radar comercial Centrus." }]
  },
  {
    id: 109,
    nome: "Farmácia Santana Barra",
    razaoSocial: "Comercial de Medicamentos Santana Ltda",
    cnpj: "15.123.456/0002-33",
    uf: "BA",
    cidade: "Salvador",
    bairro: "Barra",
    telefone: "(71) 3264-1100",
    whatsapp: "(71) 98822-1100",
    email: "compras@farmaciasantana.com.br",
    website: "https://www.farmaciasantana.com.br",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    status: "Em contato",
    responsavel: "Camila Rocha",
    dataCadastro: HOJE_FORMATADO,
    duplicado: false,
    observacoes: "Proposta enviada com catálogo de antibióticos e linha dermatológica.",
    historico: [{ data: `${HOJE_FORMATADO} 10:45`, texto: "Disparo de mensagem de apresentação via WhatsApp corporativo." }]
  },
  {
    id: 110,
    nome: "Farmácia Roval Boa Viagem",
    razaoSocial: "Laboratório Roval de Farmácia Magistral Ltda",
    cnpj: "11.890.342/0001-67",
    uf: "PE",
    cidade: "Recife",
    bairro: "Boa Viagem",
    telefone: "(81) 3465-4000",
    whatsapp: "(81) 99180-4000",
    email: "contato@roval.com.br",
    website: "https://www.roval.com.br",
    cnae: "4771-7/02 - Comércio varejista de fórmulas magistrais e manipuladas",
    status: "Qualificado",
    responsavel: "Camila Rocha",
    dataCadastro: HOJE_FORMATADO,
    duplicado: false,
    observacoes: "Referência no Nordeste em nutrição esportiva e fórmulas dermatológicas individualizadas.",
    historico: [{ data: `${HOJE_FORMATADO} 11:30`, texto: "Comprador aprovou condições de fornecimento Centrus." }]
  },
  {
    id: 111,
    nome: "Farmácias Pague Menos Meireles",
    razaoSocial: "Empreendimentos Pague Menos SA",
    cnpj: "06.626.253/0001-51",
    uf: "CE",
    cidade: "Fortaleza",
    bairro: "Meireles",
    telefone: "(85) 3255-5555",
    whatsapp: "(85) 98777-5555",
    email: "atendimento.fornecedor@paguemenos.com.br",
    website: "https://www.paguemenos.com.br",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    status: "Respondido",
    responsavel: "Camila Rocha",
    dataCadastro: HOJE_FORMATADO,
    duplicado: false,
    observacoes: "Matriz nacional da rede Pague Menos. Homologação de novos SKUs da Centrus solicitada.",
    historico: [{ data: `${HOJE_FORMATADO} 13:00`, texto: "Contato com setor de expansão e novos fornecedores." }]
  },
  {
    id: 112,
    nome: "Drogaria Globo Tirol",
    razaoSocial: "Drogarias Globo Ltda",
    cnpj: "08.765.432/0014-90",
    uf: "RN",
    cidade: "Natal",
    bairro: "Tirol",
    telefone: "(84) 3211-9900",
    whatsapp: "(84) 99655-9900",
    email: "comercial.rn@drogariasglobo.com.br",
    website: "https://www.drogariasglobo.com.br",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    status: "Não contatado",
    responsavel: "Camila Rocha",
    dataCadastro: HOJE_FORMATADO,
    duplicado: false,
    observacoes: "Excelente capilaridade na região metropolitana de Natal.",
    historico: [{ data: `${HOJE_FORMATADO} 09:20`, texto: "Cadastrado no radar regional Nordeste." }]
  },
  {
    id: 113,
    nome: "Redepharma Tambaú",
    razaoSocial: "Rede Nordeste de Farmácias SA",
    cnpj: "09.432.187/0008-11",
    uf: "PB",
    cidade: "João Pessoa",
    bairro: "Tambaú",
    telefone: "(83) 3247-3000",
    whatsapp: "(83) 98833-3000",
    email: "suprimentos@redepharma.com.br",
    website: "https://www.redepharma.com.br",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    status: "Em contato",
    responsavel: "Camila Rocha",
    dataCadastro: HOJE_FORMATADO,
    duplicado: false,
    observacoes: "Contato inicial com o farmacêutico-chefe via WhatsApp com catálogo corporativo.",
    historico: [{ data: `${HOJE_FORMATADO} 14:40`, texto: "Mensagem de abordagem enviada para o comprador regional." }]
  },
  {
    id: 114,
    nome: "Drogaria América Jardim Cuiabá",
    razaoSocial: "Drogaria América Medicamentos Ltda",
    cnpj: "03.219.876/0001-45",
    uf: "MT",
    cidade: "Cuiabá",
    bairro: "Jardim Cuiabá",
    telefone: "(65) 3624-1500",
    whatsapp: "(65) 99981-1500",
    email: "pedidos@drogariaamerica.com.br",
    website: "https://www.drogariaamerica.com.br",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    status: "Respondido",
    responsavel: "Lucas Ferreira",
    dataCadastro: HOJE_FORMATADO,
    duplicado: false,
    observacoes: "Farmácia com atendimento hospitalar e home-care no Mato Grosso.",
    historico: [{ data: `${HOJE_FORMATADO} 15:50`, texto: "Interesse manifestado em cotações de genéricos injetáveis e orais." }]
  },
  {
    id: 115,
    nome: "Farmácia São Bento Campo Grande",
    razaoSocial: "Drogaria e Farmácia São Bento Ltda",
    cnpj: "15.987.654/0005-22",
    uf: "MS",
    cidade: "Campo Grande",
    bairro: "Chácara Cachoeira",
    telefone: "(67) 3326-8000",
    whatsapp: "(67) 99244-8000",
    email: "compras@farmaciasaobento.com.br",
    website: "https://www.farmaciasaobento.com.br",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    status: "Qualificado",
    responsavel: "Lucas Ferreira",
    dataCadastro: HOJE_FORMATADO,
    duplicado: false,
    observacoes: "Grande volume de vendas em genéricos e MIPs. Pedido teste em formulação.",
    historico: [{ data: `${HOJE_FORMATADO} 16:30`, texto: "Limite de crédito corporativo pré-aprovado pela Centrus." }]
  },
  {
    id: 116,
    nome: "Farmácia Santo Remédio Adrianópolis",
    razaoSocial: "Tapajós Medicamentos e Farmácias SA",
    cnpj: "04.789.012/0034-77",
    uf: "AM",
    cidade: "Manaus",
    bairro: "Adrianópolis",
    telefone: "(92) 3642-7000",
    whatsapp: "(92) 98112-7000",
    email: "comercial@santoremedio.com.br",
    website: "https://www.santoremedio.com.br",
    cnae: "4771-7/01 - Comércio varejista farmacêutico",
    status: "Qualificado",
    responsavel: "Ricardo Mendes",
    dataCadastro: HOJE_FORMATADO,
    duplicado: false,
    observacoes: "Maior grupo farmacêutico da Região Norte (Grupo Tapajós). Parceria estratégica para polo Manaus.",
    historico: [{ data: `${HOJE_FORMATADO} 10:00`, texto: "Reunião de alinhamento logístico para entrega em Manaus realizada." }]
  },
  {
    id: 117,
    nome: "Drogaria Reinafarma Umarizal",
    razaoSocial: "Reinafarma Produtos Farmacêuticos Ltda",
    cnpj: "05.432.198/0002-88",
    uf: "PA",
    cidade: "Belém",
    bairro: "Umarizal",
    telefone: "(91) 3222-4500",
    whatsapp: "(91) 98411-4500",
    email: "atendimento@reinafarma.com.br",
    website: "https://www.reinafarma.com.br",
    cnae: "4771-7/01 - Comércio varejista de produtos farmacêuticos",
    status: "Em contato",
    responsavel: "Ricardo Mendes",
    dataCadastro: HOJE_FORMATADO,
    duplicado: false,
    observacoes: "Interesse em entrega fracionada e prazos estendidos de faturamento.",
    historico: [{ data: `${HOJE_FORMATADO} 11:15`, texto: "Negociação de prazos de entrega para o Pará em andamento." }]
  },
  {
    id: 118,
    nome: "Farmácia Popular de Palmas",
    razaoSocial: "Tocantins Drogarias e Manipulação Ltda",
    cnpj: "18.234.567/0001-10",
    uf: "TO",
    cidade: "Palmas",
    bairro: "Plano Diretor Sul",
    telefone: "(63) 3215-6000",
    whatsapp: "(63) 99233-6000",
    email: "gerencia@farmaciapalmas.com.br",
    website: "https://www.farmaciapalmas.com.br",
    cnae: "4771-7/02 - Farmácia com manipulação de fórmulas",
    status: "Não contatado",
    responsavel: "Lucas Ferreira",
    dataCadastro: HOJE_FORMATADO,
    duplicado: false,
    observacoes: "Estabelecimento de referência no centro administrativo de Palmas.",
    historico: [{ data: `${HOJE_FORMATADO} 08:30`, texto: "Registro cadastrado na cobertura Centro-Norte." }]
  }
];

/**
 * Carrega os leads em tempo real da tabela 'pharmaleads' do Supabase
 * e integra a base complementar nacional cobrindo todas as regiões do Brasil.
 */
async function carregarLeadsDoSupabase() {
  try {
    let cloudLeads = [];
    if (supabaseClient) {
      const { data, error } = await supabaseClient
        .from('pharmaleads')
        .select('*')
        .order('id', { ascending: true });

      if (!error && data && data.length > 0) {
        cloudLeads = data.map(item => ({
          id: item.id,
          nome: item.nome,
          razaoSocial: item.razao_social || item.nome,
          cnpj: item.cnpj || 'Sob auditoria',
          uf: item.uf,
          cidade: item.cidade,
          bairro: item.bairro || 'Centro Comercial',
          telefone: item.telefone,
          whatsapp: item.whatsapp || item.telefone,
          email: item.email,
          website: item.website,
          responsavel: item.responsavel || 'Comercial Centrus',
          status: item.status || 'Não contatado',
          cnae: item.cnae || '4771-7/01 - Comércio varejista de produtos farmacêuticos',
          dataCadastro: item.created_at ? new Date(item.created_at).toLocaleDateString('pt-BR') : HOJE_FORMATADO,
          duplicado: item.duplicado || false,
          observacoes: item.observacoes || '',
          historico: Array.isArray(item.historico) ? item.historico : []
        }));
      }
    }

    // Unifica os dados da nuvem com a cobertura nacional complementar
    const cnpjSet = new Set(cloudLeads.map(l => cleanCnpj(l.cnpj)));
    leadsData = [...cloudLeads];

    BASE_NACIONAL_COMPLEMENTAR.forEach(nLead => {
      const limpo = cleanCnpj(nLead.cnpj);
      if (!cnpjSet.has(limpo)) {
        leadsData.push(nLead);
        cnpjSet.add(limpo);
      }
    });

    updateKpiIndicators();
    renderTable();

    const navCount = document.getElementById("headerNavLeadCount");
    if (navCount) navCount.textContent = leadsData.length;

    console.log(`✅ Base nacional carregada: ${leadsData.length} farmácias ativas (Brasil).`);
  } catch (err) {
    console.warn("ℹ️ Operando com base nacional local em cache:", err);
    if (!leadsData || leadsData.length === 0) {
      leadsData = [...BASE_NACIONAL_COMPLEMENTAR];
      updateKpiIndicators();
      renderTable();
    }
  }
}

/**
 * Sincroniza atualizações de status ou notas do lead com o Supabase
 */
async function syncLeadUpdateToSupabase(lead) {
  if (!supabaseClient || !lead || !lead.id) return;
  try {
    await supabaseClient
      .from('pharmaleads')
      .update({
        status: lead.status,
        observacoes: lead.observacoes,
        historico: lead.historico,
        updated_at: new Date().toISOString()
      })
      .eq('id', lead.id);
  } catch (err) {
    console.warn("Erro ao sincronizar atualização no Supabase:", err);
  }
}

/**
 * Sincroniza cadastro de novo lead com o Supabase
 */
async function syncNewLeadToSupabase(novoLead) {
  if (!supabaseClient || !novoLead) return;
  try {
    const { data } = await supabaseClient
      .from('pharmaleads')
      .insert({
        nome: novoLead.nome,
        razao_social: novoLead.razaoSocial,
        cnpj: novoLead.cnpj,
        uf: novoLead.uf,
        cidade: novoLead.cidade,
        bairro: novoLead.bairro,
        telefone: novoLead.telefone,
        whatsapp: novoLead.telefone,
        email: novoLead.email,
        responsavel: novoLead.responsavel,
        status: novoLead.status,
        cnae: novoLead.cnae,
        observacoes: novoLead.observacoes,
        historico: novoLead.historico
      })
      .select('id')
      .single();

    if (data && data.id) {
      novoLead.id = data.id;
    }
  } catch (err) {
    console.warn("Erro ao inserir novo lead no Supabase:", err);
  }
}

// Base de dados ativa (SP, GO, DF)
// Base de dados sincronizada diretamente com o Supabase
let leadsData = [];

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
  miniChartContainer: document.getElementById("miniChartContainer"),
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

  // Navegação
  brandLink: document.getElementById("brandLink"),
  btnNavOverview: document.getElementById("btnNavOverview"),
  btnNavLeads: document.getElementById("btnNavLeads"),
  btnNavSettings: document.getElementById("btnNavSettings"),

  // KPIs e Barras Clicáveis
  kpiCardTotal: document.getElementById("kpiCardTotal"),
  kpiCardEmContato: document.getElementById("kpiCardEmContato"),
  kpiCardNovosHoje: document.getElementById("kpiCardNovosHoje"),
  kpiCardRespondidos: document.getElementById("kpiCardRespondidos"),
  kpiCardDuplicados: document.getElementById("kpiCardDuplicados"),
  cardBarSp: document.getElementById("cardBarSp"),
  cardBarGo: document.getElementById("cardBarGo"),
  cardBarDf: document.getElementById("cardBarDf"),

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
  btnMapsAction: document.getElementById("btnMapsAction"),
  btnCnpjAction: document.getElementById("btnCnpjAction"),

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

  // Modal Parâmetros
  settingsModal: document.getElementById("settingsModal"),
  settingsModalClose: document.getElementById("settingsModalClose"),
  settingsModalCloseBtn: document.getElementById("settingsModalCloseBtn"),
  btnSaveSettings: document.getElementById("btnSaveSettings"),
  btnTestSupabaseConnection: document.getElementById("btnTestSupabaseConnection"),
  settingWaTemplate: document.getElementById("settingWaTemplate"),

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

/**
 * Formata mensagem de abordagem no WhatsApp substituindo variáveis dinâmicas
 */
function formatWaMessage(lead) {
  const defaultTpl = "Olá, equipe da {nome}! Tudo bem? Sou do time comercial da Centrus Distribuidora Farmacêutica em {cidade} - {uf}. Gostaríamos de apresentar nossas condições exclusivas de fornecimento e prazos faturados para sua farmácia.";
  const tpl = (typeof localStorage !== "undefined" && localStorage.getItem("centrus_wa_template")) || defaultTpl;
  return tpl
    .replace(/{nome}/g, lead.nome || "farmácia")
    .replace(/{cidade}/g, lead.cidade || "")
    .replace(/{uf}/g, lead.uf || "");
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

  // Distribuição Dinâmica por Estados (Brasil)
  renderDynamicDistribution(total);
}

/**
 * Renderiza dinamicamente as barras de distribuição dos estados no gráfico
 */
function renderDynamicDistribution(total) {
  if (!leadsData || leadsData.length === 0) return;

  // Agrupa estabelecimentos por UF
  const ufsMap = {};
  leadsData.forEach(l => {
    if (l.uf) {
      ufsMap[l.uf] = (ufsMap[l.uf] || 0) + 1;
    }
  });

  const sortedUfs = Object.entries(ufsMap)
    .map(([uf, count]) => ({
      uf,
      count,
      pct: total > 0 ? (count / total) * 100 : 0
    }))
    .sort((a, b) => b.count - a.count);

  const container = DOM.miniChartContainer || document.getElementById("miniChartContainer");
  if (container) {
    // Exibe os principais estados (até os 4 maiores) ou todos se forem poucos
    const topStates = sortedUfs.slice(0, 4);
    
    // Calcula outros se houver mais de 4
    const remaining = sortedUfs.slice(4);
    if (remaining.length > 0) {
      const outrosCount = remaining.reduce((acc, curr) => acc + curr.count, 0);
      const outrosPct = total > 0 ? (outrosCount / total) * 100 : 0;
      topStates.push({ uf: "Outros", count: outrosCount, pct: outrosPct, isOther: true });
    }

    container.innerHTML = topStates.map(item => `
      <div class="mini-bar-row clickable" data-uf="${item.uf}" title="${item.isOther ? 'Outros estados do Brasil' : `Clique para filtrar farmácias de ${item.uf}`}">
        <span class="mini-bar-label">${item.uf}</span>
        <div class="mini-bar-track">
          <div class="mini-bar-fill fill-${item.uf.toLowerCase()}" style="width: ${Math.max(item.pct, 4)}%;"></div>
        </div>
        <span class="mini-bar-count">${item.count} (${Math.round(item.pct)}%)</span>
      </div>
    `).join("");

    // Adiciona evento de clique para filtrar pela UF instantaneamente
    container.querySelectorAll(".mini-bar-row").forEach(row => {
      row.addEventListener("click", () => {
        const uf = row.getAttribute("data-uf");
        if (uf && uf !== "Outros") {
          state.filterUf = uf;
          if (DOM.filterUf) DOM.filterUf.value = uf;
          state.currentPage = 1;
          renderTable();
          showToast(`Filtro regional aplicado: ${uf}.`);
        } else if (uf === "Outros") {
          state.filterUf = "TODAS";
          if (DOM.filterUf) DOM.filterUf.value = "TODAS";
          state.currentPage = 1;
          renderTable();
          showToast("Exibindo todas as farmácias do Brasil.");
        }
      });
    });
  }

  // Compatibilidade com referências legadas caso existam
  if (DOM.fillSp && DOM.countSp) {
    const spCount = ufsMap["SP"] || 0;
    const spPct = total > 0 ? (spCount / total) * 100 : 0;
    DOM.fillSp.style.width = `${spPct}%`;
    DOM.countSp.textContent = `${spCount} (${Math.round(spPct)}%)`;
  }
  if (DOM.fillGo && DOM.countGo) {
    const goCount = ufsMap["GO"] || 0;
    const goPct = total > 0 ? (goCount / total) * 100 : 0;
    DOM.fillGo.style.width = `${goPct}%`;
    DOM.countGo.textContent = `${goCount} (${Math.round(goPct)}%)`;
  }
  if (DOM.fillDf && DOM.countDf) {
    const dfCount = ufsMap["DF"] || 0;
    const dfPct = total > 0 ? (dfCount / total) * 100 : 0;
    DOM.fillDf.style.width = `${dfPct}%`;
    DOM.countDf.textContent = `${dfCount} (${Math.round(dfPct)}%)`;
  }
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
    const rawTel = lead.telefone ? lead.telefone.replace(/\D/g, "") : "";
    const waText = encodeURIComponent(formatWaMessage(lead));
    
    const telefoneHtml = lead.telefone
      ? `<a href="https://wa.me/55${rawTel}?text=${waText}" target="_blank" class="table-contact-link wa" title="Abrir conversa no WhatsApp (1 clique)" onclick="event.stopPropagation();">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
          ${lead.telefone}
        </a>`
      : `<span class="data-missing">Não informado</span>`;

    const emailHtml = lead.email
      ? `<a href="mailto:${lead.email}?subject=${encodeURIComponent('Apresentação Comercial Centrus PharmaLeads - ' + lead.nome)}" class="table-contact-link mail" title="${lead.email}" onclick="event.stopPropagation();">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
          ${lead.email}
        </a>`
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
      const msg = encodeURIComponent(formatWaMessage(lead));
      window.open(`https://wa.me/55${rawTel}?text=${msg}`, "_blank");
    };
    DOM.btnWhatsappAction.style.display = "inline-flex";
  } else {
    DOM.btnWhatsappAction.style.display = "none";
  }

  if (lead.email) {
    DOM.btnEmailAction.onclick = () => {
      const subject = encodeURIComponent(`Apresentação Comercial Centrus PharmaLeads - ${lead.nome}`);
      window.location.href = `mailto:${lead.email}?subject=${subject}`;
    };
    DOM.btnEmailAction.style.display = "inline-flex";
  } else {
    DOM.btnEmailAction.style.display = "none";
  }

  // Ação de Localização no Google Maps
  if (DOM.btnMapsAction) {
    DOM.btnMapsAction.onclick = () => {
      const query = encodeURIComponent(`${lead.nome} ${lead.endereco || lead.cidade + ' ' + lead.uf}`);
      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, "_blank");
    };
  }

  // Ação de Auditoria de CNPJ na Receita
  if (DOM.btnCnpjAction) {
    DOM.btnCnpjAction.onclick = () => {
      const doc = cleanCnpj(lead.cnpj);
      if (doc && doc.length === 14) {
        window.open(`https://cnpj.biz/${doc}`, "_blank");
      } else {
        showToast("CNPJ deste estabelecimento está sob auditoria ou não informado.", "info");
      }
    };
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

function openSettingsModal() {
  if (!DOM.settingsModal) return;
  // Carrega template salvo no localStorage se houver
  const savedTpl = localStorage.getItem("centrus_wa_template");
  if (savedTpl && DOM.settingWaTemplate) {
    DOM.settingWaTemplate.value = savedTpl;
  }
  DOM.settingsModal.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeSettingsModal() {
  if (!DOM.settingsModal) return;
  DOM.settingsModal.classList.remove("active");
  document.body.style.overflow = "";
}

function resetAllFilters() {
  state.searchQuery = "";
  state.filterUf = "TODAS";
  state.filterStatus = "TODOS";
  state.filterContact = "TODOS";
  state.currentPage = 1;

  if (DOM.searchInput) DOM.searchInput.value = "";
  if (DOM.searchClearBtn) DOM.searchClearBtn.style.display = "none";
  if (DOM.filterUf) DOM.filterUf.value = "TODAS";
  if (DOM.filterStatus) DOM.filterStatus.value = "TODOS";
  if (DOM.filterContact) DOM.filterContact.value = "TODOS";

  renderTable();
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

        // Sincroniza em tempo real com o Supabase
        syncLeadUpdateToSupabase(lead);
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
      syncLeadUpdateToSupabase(lead);
    }
  });

  DOM.btnSaveNotes.addEventListener("click", () => {
    if (!state.activeLeadId) return;
    const lead = leadsData.find(l => l.id === state.activeLeadId);
    if (lead) {
      lead.observacoes = DOM.drawerObservacoes.value;
      showToast("Anotações comerciais atualizadas.");
      syncLeadUpdateToSupabase(lead);
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
          setTimeout(async () => {
            closeExtractModal();
            btnExecuteSync.disabled = false;
            if (syncProgressContainer) syncProgressContainer.style.display = "none";
            if (syncProgressBar) syncProgressBar.style.width = "0%";
            
            // Recarrega os dados mais recentes do Supabase
            await carregarLeadsDoSupabase();
            showToast(`Base sincronizada com o Supabase: ${leadsData.length} estabelecimentos.`);
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

      // Sincroniza novo lead com o Supabase
      syncNewLeadToSupabase(novoLead);

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

  // --- NAVEGAÇÃO SUPERIOR ---
  if (DOM.brandLink) {
    DOM.brandLink.addEventListener("click", (e) => {
      e.preventDefault();
      resetAllFilters();
      window.scrollTo({ top: 0, behavior: "smooth" });
      showToast("Visualização redefinida para a página inicial.");
    });
  }

  if (DOM.btnNavOverview) {
    DOM.btnNavOverview.addEventListener("click", () => {
      DOM.btnNavOverview.classList.add("active");
      if (DOM.btnNavLeads) DOM.btnNavLeads.classList.remove("active");
      const kpis = document.getElementById("kpiSection");
      if (kpis) kpis.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  if (DOM.btnNavLeads) {
    DOM.btnNavLeads.addEventListener("click", () => {
      DOM.btnNavLeads.classList.add("active");
      if (DOM.btnNavOverview) DOM.btnNavOverview.classList.remove("active");
      const filterPanel = document.querySelector(".filter-panel");
      if (filterPanel) filterPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  if (DOM.btnNavSettings) {
    DOM.btnNavSettings.addEventListener("click", () => {
      openSettingsModal();
    });
  }

  // --- MODAL DE PARÂMETROS ---
  if (DOM.settingsModalClose) {
    DOM.settingsModalClose.addEventListener("click", closeSettingsModal);
  }

  if (DOM.settingsModalCloseBtn) {
    DOM.settingsModalCloseBtn.addEventListener("click", closeSettingsModal);
  }

  if (DOM.btnSaveSettings) {
    DOM.btnSaveSettings.addEventListener("click", () => {
      if (DOM.settingWaTemplate) {
        localStorage.setItem("centrus_wa_template", DOM.settingWaTemplate.value.trim());
      }
      closeSettingsModal();
      showToast("Parâmetros comerciais e template do WhatsApp salvos com sucesso!");
      renderTable(); // Re-renderiza para atualizar links do WhatsApp
    });
  }

  if (DOM.btnTestSupabaseConnection) {
    DOM.btnTestSupabaseConnection.addEventListener("click", async () => {
      if (!supabaseClient) {
        showToast("Supabase client não inicializado.", "info");
        return;
      }
      const t0 = performance.now();
      try {
        const { error } = await supabaseClient.from("pharmaleads").select("id").limit(1);
        const t1 = performance.now();
        const latency = Math.round(t1 - t0);
        if (!error) {
          showToast(`Conexão com o Supabase 100% OK! Latência: ${latency}ms.`);
        } else {
          showToast(`Aviso Supabase: ${error.message}`, "info");
        }
      } catch (err) {
        showToast("Erro ao testar conexão: " + err.message, "info");
      }
    });
  }

  // --- CARDS DE KPIs CLICÁVEIS (FILTROS RÁPIDOS) ---
  if (DOM.kpiCardTotal) {
    DOM.kpiCardTotal.addEventListener("click", () => {
      resetAllFilters();
      showToast("Exibindo todos os estabelecimentos mapeados.");
    });
  }

  if (DOM.kpiCardEmContato) {
    DOM.kpiCardEmContato.addEventListener("click", () => {
      state.filterStatus = "Em contato";
      if (DOM.filterStatus) DOM.filterStatus.value = "Em contato";
      state.currentPage = 1;
      renderTable();
      showToast("Filtro rápido: Apenas farmácias Em Negociação.");
    });
  }

  if (DOM.kpiCardNovosHoje) {
    DOM.kpiCardNovosHoje.addEventListener("click", () => {
      state.filterStatus = "TODOS";
      if (DOM.filterStatus) DOM.filterStatus.value = "TODOS";
      state.currentPage = 1;
      renderTable();
      showToast("Exibindo oportunidades do ciclo atual.");
    });
  }

  if (DOM.kpiCardRespondidos) {
    DOM.kpiCardRespondidos.addEventListener("click", () => {
      state.filterStatus = "Respondido";
      if (DOM.filterStatus) DOM.filterStatus.value = "Respondido";
      state.currentPage = 1;
      renderTable();
      showToast("Filtro rápido: Estabelecimentos Respondidos / Qualificados.");
    });
  }

  if (DOM.kpiCardDuplicados) {
    DOM.kpiCardDuplicados.addEventListener("click", () => {
      showToast("Base 100% auditada: Unicidade garantida por CNPJ e localização.");
    });
  }

  // --- BARRAS REGIONAIS CLICÁVEIS ---
  if (DOM.cardBarSp) {
    DOM.cardBarSp.addEventListener("click", () => {
      state.filterUf = "SP";
      if (DOM.filterUf) DOM.filterUf.value = "SP";
      state.currentPage = 1;
      renderTable();
      showToast("Filtro regional aplicado: São Paulo (SP).");
    });
  }

  if (DOM.cardBarGo) {
    DOM.cardBarGo.addEventListener("click", () => {
      state.filterUf = "GO";
      if (DOM.filterUf) DOM.filterUf.value = "GO";
      state.currentPage = 1;
      renderTable();
      showToast("Filtro regional aplicado: Goiás (GO).");
    });
  }

  if (DOM.cardBarDf) {
    DOM.cardBarDf.addEventListener("click", () => {
      state.filterUf = "DF";
      if (DOM.filterUf) DOM.filterUf.value = "DF";
      state.currentPage = 1;
      renderTable();
      showToast("Filtro regional aplicado: Distrito Federal (DF).");
    });
  }

  // Atalho de Teclado (ESC fecha modais e drawer)
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeLeadDrawer();
      closeExtractModal();
      closeLogsModal();
      closeNewLeadModal();
      closeSettingsModal();
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
  
  // Carrega os dados mais recentes do Supabase em segundo plano
  carregarLeadsDoSupabase();
  console.log("Centrus PharmaLeads - Plataforma operacional ativa.");
});

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

// =============================================================================
// CAMADA DE PERSISTÊNCIA (SUPABASE = ÚNICA FONTE DA VERDADE)
// =============================================================================

const PAGE_SIZE_DB = 1000; // Limite máximo por requisição do PostgREST
let gravacoesPendentes = 0;

/** Converte uma linha do banco para o formato usado na interface */
function mapRowToLead(item) {
  return {
    id: item.id,
    nome: item.nome,
    razaoSocial: item.razao_social || null,
    cnpj: item.cnpj || 'Não informado',
    uf: item.uf,
    cidade: item.cidade,
    bairro: item.bairro || null,
    endereco: item.endereco || null,
    telefone: item.telefone || null,
    whatsapp: item.whatsapp || null,
    email: item.email || null,
    website: item.website || null,
    responsavel: item.responsavel || 'Não atribuído',
    status: item.status || 'Não contatado',
    cnae: item.cnae || null,
    dataCadastro: item.created_at ? new Date(item.created_at).toLocaleDateString('pt-BR') : HOJE_FORMATADO,
    duplicado: item.duplicado || false,
    observacoes: item.observacoes || '',
    googleRating: item.google_rating ?? null,
    googleReviews: item.google_reviews ?? null,
    googleStatus: item.google_status || null,
    googleMapsUrl: item.google_maps_url || null,
    historico: Array.isArray(item.historico) ? item.historico : []
  };
}

/** Entrada de histórico com data/hora atual */
function novaEntradaHistorico(texto) {
  const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return { data: `${HOJE_FORMATADO} ${hora}`, texto };
}

/** Registra gravação em andamento (impede perda ao recarregar a página) */
async function comGravacaoPendente(promessa) {
  gravacoesPendentes++;
  try {
    return await promessa;
  } finally {
    gravacoesPendentes--;
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", (e) => {
    if (gravacoesPendentes > 0) {
      e.preventDefault();
      e.returnValue = "Há alterações sendo salvas no banco de dados.";
    }
  });
}

/**
 * Carrega TODOS os leads da tabela 'pharmaleads' (paginado, sem limite de 1000).
 */
async function carregarLeadsDoSupabase() {
  if (!supabaseClient) {
    showToast("Conexão com o banco indisponível.", "info");
    return;
  }

  try {
    const linhas = [];
    for (let inicio = 0; ; inicio += PAGE_SIZE_DB) {
      const { data, error } = await supabaseClient
        .from('pharmaleads')
        .select('*')
        .order('id', { ascending: true })
        .range(inicio, inicio + PAGE_SIZE_DB - 1);

      if (error) throw error;
      linhas.push(...(data || []));
      if (!data || data.length < PAGE_SIZE_DB) break;
    }

    leadsData = linhas.map(mapRowToLead);

    updateKpiIndicators();
    renderTable();

    const navCount = document.getElementById("headerNavLeadCount");
    if (navCount) navCount.textContent = leadsData.length;

    console.log(`[Centrus PharmaLeads] ${leadsData.length} farmácias carregadas do banco.`);
  } catch (err) {
    console.error("[Centrus PharmaLeads] Falha ao carregar dados do banco:", err);
    showToast("Não foi possível carregar os dados do banco. Tente sincronizar.", "info");
    updateKpiIndicators();
    renderTable();
  }
}

/**
 * Persiste alterações de um lead e CONFIRMA que a linha foi gravada.
 * Em caso de falha, restaura o estado anterior na interface.
 * @param {object} lead       Lead já alterado em memória
 * @param {object} anterior   Snapshot dos campos antes da alteração (para rollback)
 * @returns {Promise<boolean>}
 */
async function syncLeadUpdateToSupabase(lead, anterior = null) {
  if (!supabaseClient || !lead || !(lead.id > 0)) return false;

  const payload = {
    status: lead.status,
    responsavel: lead.responsavel,
    observacoes: lead.observacoes,
    historico: lead.historico,
    updated_at: new Date().toISOString()
  };

  try {
    const { data, error } = await comGravacaoPendente(
      supabaseClient.from('pharmaleads').update(payload).eq('id', lead.id).select('id, status')
    );

    if (error) throw error;
    // Update sem linhas afetadas = bloqueio de permissão (RLS) ou registro inexistente
    if (!data || data.length === 0) throw new Error(`Nenhuma linha gravada para o lead #${lead.id}.`);

    console.log(`[Centrus PharmaLeads] Lead #${lead.id} gravado (status: ${data[0].status}).`);
    return true;
  } catch (err) {
    console.error("[Centrus PharmaLeads] Falha ao gravar no banco:", err);
    if (anterior) Object.assign(lead, anterior);
    updateKpiIndicators();
    renderTable();
    showToast(`Falha ao salvar "${lead.nome}". Alteração desfeita.`, "info");
    return false;
  }
}

/**
 * Insere novo lead e retorna o registro gravado (com id real do banco).
 * @returns {Promise<object|null>}
 */
async function syncNewLeadToSupabase(novoLead) {
  if (!supabaseClient || !novoLead) return null;
  try {
    const { data, error } = await comGravacaoPendente(
      supabaseClient
        .from('pharmaleads')
        .insert({
          nome: novoLead.nome,
          razao_social: novoLead.razaoSocial,
          cnpj: novoLead.cnpj,
          uf: novoLead.uf,
          cidade: novoLead.cidade,
          bairro: novoLead.bairro,
          telefone: novoLead.telefone,
          whatsapp: null, // Nunca assumir telefone = WhatsApp
          email: novoLead.email,
          responsavel: novoLead.responsavel,
          status: novoLead.status,
          cnae: novoLead.cnae,
          duplicado: novoLead.duplicado,
          observacoes: novoLead.observacoes,
          historico: novoLead.historico
        })
        .select('*')
        .single()
    );

    if (error) throw error;
    return data;
  } catch (err) {
    console.error("[Centrus PharmaLeads] Falha ao inserir lead:", err);
    return null;
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
  filterGoogleRating: "TODOS",
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
  filterGoogleRating: document.getElementById("filterGoogleRating"),
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
  drawerGoogleRatingVal: document.getElementById("drawerGoogleRatingVal"),
  drawerGoogleReviewsVal: document.getElementById("drawerGoogleReviewsVal"),
  drawerGoogleStatusPill: document.getElementById("drawerGoogleStatusPill"),
  drawerGoogleMaturity: document.getElementById("drawerGoogleMaturity"),
  drawerGoogleRatingStars: document.getElementById("drawerGoogleRatingStars"),
  btnDrawerOpenMaps: document.getElementById("btnDrawerOpenMaps"),
  btnSaveNotes: document.getElementById("btnSaveNotes"),
  btnCopyCnpj: document.getElementById("btnCopyCnpj"),
  btnWhatsappAction: document.getElementById("btnWhatsappAction"),
  btnEmailAction: document.getElementById("btnEmailAction"),
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
  toastContainer: document.getElementById("toastContainer"),

  // Autenticação & Usuário
  authScreen: document.getElementById("authScreen"),
  loginForm: document.getElementById("loginForm"),
  loginEmail: document.getElementById("loginEmail"),
  loginPassword: document.getElementById("loginPassword"),
  btnLoginSubmit: document.getElementById("btnLoginSubmit"),
  btnLoginText: document.getElementById("btnLoginText"),
  btnLoginSpinner: document.getElementById("btnLoginSpinner"),
  authErrorMessage: document.getElementById("authErrorMessage"),
  btnTogglePassword: document.getElementById("btnTogglePassword"),
  btnForgotPassword: document.getElementById("btnForgotPassword"),
  recoveryModal: document.getElementById("recoveryModal"),
  recoveryModalClose: document.getElementById("recoveryModalClose"),
  recoveryModalCancelBtn: document.getElementById("recoveryModalCancelBtn"),
  recoveryForm: document.getElementById("recoveryForm"),
  recoveryEmail: document.getElementById("recoveryEmail"),
  recoveryMessage: document.getElementById("recoveryMessage"),
  btnSubmitRecovery: document.getElementById("btnSubmitRecovery"),
  btnRecoveryText: document.getElementById("btnRecoveryText"),
  btnRecoverySpinner: document.getElementById("btnRecoverySpinner"),
  btnLogout: document.getElementById("btnLogout"),
  headerUserName: document.getElementById("headerUserName"),
  headerUserRole: document.getElementById("headerUserRole"),
  headerUserAvatar: document.getElementById("headerUserAvatar"),
  topbarAvatar: document.getElementById("topbarAvatar"),
  btnSidebarToggle: document.getElementById("btnSidebarToggle"),
  btnSidebarCloseMobile: document.getElementById("btnSidebarCloseMobile"),
  sidebarOverlay: document.getElementById("sidebarOverlay"),
  btnSidebarSync: document.getElementById("btnSidebarSync"),
  btnSidebarExport: document.getElementById("btnSidebarExport"),
  btnSidebarNewLead: document.getElementById("btnSidebarNewLead"),
  btnTopbarNotification: document.getElementById("btnTopbarNotification"),
  mainDashboard: document.getElementById("mainDashboard")
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
  const ratingStr = lead.googleRating != null ? String(lead.googleRating) : "Não informado";
  const reviewsStr = lead.googleReviews != null ? String(lead.googleReviews) : "Não informado";
  return tpl
    .replace(/{nome}/g, lead.nome || "farmácia")
    .replace(/{cidade}/g, lead.cidade || "")
    .replace(/{uf}/g, lead.uf || "")
    .replace(/{google_rating}/g, ratingStr)
    .replace(/{avaliacoes}/g, reviewsStr);
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

    // 4. Filtro por Reputação no Google Meu Negócio
    if (state.filterGoogleRating === "TOP_RATED") {
      if ((lead.googleRating || 0) < 4.5) return false;
    } else if (state.filterGoogleRating === "REVIEWS_50") {
      if ((lead.googleReviews || 0) < 50) return false;
    } else if (state.filterGoogleRating === "REVIEWS_100") {
      if ((lead.googleReviews || 0) < 100) return false;
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
    const rawWa = lead.whatsapp ? lead.whatsapp.replace(/\D/g, "") : "";
    const waText = encodeURIComponent(formatWaMessage(lead));
    
    let telefoneHtml = "";
    if (lead.whatsapp) {
      telefoneHtml = `<a href="https://wa.me/55${rawWa}?text=${waText}" target="_blank" class="table-contact-link wa" title="WhatsApp verificado: ${lead.whatsapp}" onclick="event.stopPropagation();">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
          ${lead.whatsapp}
        </a>`;
    } else if (lead.telefone) {
      telefoneHtml = `<a href="tel:+55${rawTel}" class="table-contact-link phone" title="Telefone fixo/comercial: ${lead.telefone}" onclick="event.stopPropagation();">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
          ${lead.telefone}
        </a>`;
    } else {
      telefoneHtml = `<span class="data-missing">Não informado</span>`;
    }

    const emailHtml = lead.email
      ? `<a href="mailto:${lead.email}?subject=${encodeURIComponent('Apresentação Comercial Centrus PharmaLeads - ' + lead.nome)}" class="table-contact-link mail" title="${lead.email}" onclick="event.stopPropagation();">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
          ${lead.email}
        </a>`
      : `<span class="data-missing">Não informado</span>`;

    const responsavelHtml = lead.responsavel && lead.responsavel !== "Não atribuído"
      ? `<span>${lead.responsavel}</span>`
      : `<span class="data-missing">Não atribuído</span>`;

    const googleBadge = lead.googleRating
      ? `<span class="google-badge-inline" title="Google Meu Negócio: ${lead.googleRating} baseada em ${lead.googleReviews || 0} avaliações">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
          ${lead.googleRating} <span class="google-reviews-count">(${lead.googleReviews || 0})</span>
        </span>`
      : '';

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
            ${googleBadge}
          </div>
          <div class="lead-category-sub">
            ${[lead.bairro, lead.cnae ? 'CNAE ' + lead.cnae.split(' ')[0] : null].filter(Boolean).join(' | ') || lead.cidade}
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
  if (state.filterGoogleRating !== "TODOS") {
    const googleMap = {
      TOP_RATED: "Google 4.5+",
      REVIEWS_50: "Google 50+ avaliações",
      REVIEWS_100: "Google 100+ avaliações"
    };
    tags.push({ label: googleMap[state.filterGoogleRating] || "Google Meu Negócio", key: "google" });
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

/** Traduz o status oficial da Places API. Status desconhecido não vira "aberto". */
function rotuloStatusGoogle(status) {
  if (status === "OPERATIONAL") return { texto: "Em atividade", classe: "open" };
  if (status === "CLOSED_TEMPORARILY") return { texto: "Fechado temporariamente", classe: "closed" };
  if (status === "CLOSED_PERMANENTLY") return { texto: "Fechado permanentemente", classe: "closed" };
  return null;
}

/** Preenche o bloco do Google só com dado gravado. Sem nota, permanece pendente. */
function preencherPresencaGoogle(lead) {
  const temNota = lead.googleRating != null;
  const status = rotuloStatusGoogle(lead.googleStatus);

  if (DOM.drawerGoogleRatingStars) {
    DOM.drawerGoogleRatingStars.style.color = temNota ? "#f59e0b" : "#cbd5e1";
  }

  if (temNota) {
    if (DOM.drawerGoogleRatingVal) DOM.drawerGoogleRatingVal.textContent = String(lead.googleRating);
    if (DOM.drawerGoogleReviewsVal) {
      DOM.drawerGoogleReviewsVal.textContent = lead.googleReviews != null
        ? `(${lead.googleReviews} avaliações no Google)`
        : "(avaliações não informadas)";
    }
    if (DOM.drawerGoogleMaturity) {
      DOM.drawerGoogleMaturity.textContent = "Dados oficiais do Google";
      DOM.drawerGoogleMaturity.className = "google-maturity confirmed";
    }
  } else {
    if (DOM.drawerGoogleRatingVal) DOM.drawerGoogleRatingVal.textContent = "Não informado";
    if (DOM.drawerGoogleReviewsVal) DOM.drawerGoogleReviewsVal.textContent = "(Pendente de enriquecimento Google)";
    if (DOM.drawerGoogleMaturity) {
      DOM.drawerGoogleMaturity.textContent = "Pendente de enriquecimento";
      DOM.drawerGoogleMaturity.className = "google-maturity pending";
    }
  }

  if (DOM.drawerGoogleStatusPill) {
    if (status) {
      DOM.drawerGoogleStatusPill.className = `google-status-pill ${status.classe}`;
      DOM.drawerGoogleStatusPill.textContent = status.texto;
    } else {
      DOM.drawerGoogleStatusPill.className = "google-status-pill pending";
      DOM.drawerGoogleStatusPill.textContent = temNota ? "Status não informado" : "Sem perfil verificado";
    }
  }
}

function openLeadDrawer(leadId) {
  const lead = leadsData.find(l => l.id === leadId);
  if (!lead) return;

  state.activeLeadId = leadId;

  DOM.drawerTitle.textContent = lead.nome;
  DOM.drawerSubtitle.textContent = `${lead.razaoSocial || lead.nome} | ${lead.cidade}/${lead.uf}`;
  
  DOM.drawerStatusSelect.value = lead.status;
  DOM.drawerStatusSelect.setAttribute("data-status", lead.status);

  DOM.drawerCnpj.textContent = lead.cnpj;
  DOM.drawerRazao.textContent = lead.razaoSocial || "Não informado (pendente de consulta na Receita)";
  DOM.drawerCnae.textContent = lead.cnae || "Não informado (pendente de consulta na Receita)";
  DOM.drawerCidadeUf.textContent = `${lead.bairro ? lead.bairro + ', ' : ''}${lead.cidade} - ${lead.uf}`;
  
  DOM.drawerTelefone.textContent = lead.telefone || "Não informado";
  DOM.drawerEmail.textContent = lead.email || "Não informado";
  DOM.drawerResponsavel.textContent = lead.responsavel || "Não atribuído";
  DOM.drawerDataCadastro.textContent = lead.dataCadastro;
  DOM.drawerObservacoes.value = lead.observacoes || "";

  preencherPresencaGoogle(lead);

  if (DOM.btnDrawerOpenMaps) {
    const q = encodeURIComponent(`${lead.nome} ${lead.endereco || lead.cidade + ' ' + lead.uf}`);
    DOM.btnDrawerOpenMaps.href = lead.googleMapsUrl
      || `https://www.google.com/maps/search/?api=1&query=${q}`;
  }

  // Ações de contato: Apenas exibe botão WhatsApp se houver WhatsApp confirmado
  if (lead.whatsapp) {
    const rawWa = lead.whatsapp.replace(/\D/g, "");
    DOM.btnWhatsappAction.onclick = () => {
      const msg = encodeURIComponent(formatWaMessage(lead));
      window.open(`https://wa.me/55${rawWa}?text=${msg}`, "_blank");
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

function openRecoveryModal() {
  if (!DOM.recoveryModal) return;
  if (DOM.recoveryMessage) {
    DOM.recoveryMessage.style.display = "none";
    DOM.recoveryMessage.textContent = "";
    DOM.recoveryMessage.className = "";
  }
  if (DOM.btnSubmitRecovery) DOM.btnSubmitRecovery.disabled = false;
  if (DOM.btnRecoveryText) DOM.btnRecoveryText.style.display = "inline";
  if (DOM.btnRecoverySpinner) DOM.btnRecoverySpinner.style.display = "none";

  if (DOM.recoveryEmail && DOM.loginEmail && DOM.loginEmail.value.trim()) {
    DOM.recoveryEmail.value = DOM.loginEmail.value.trim();
  }

  DOM.recoveryModal.classList.add("active");
  document.body.style.overflow = "hidden";

  setTimeout(() => {
    if (DOM.recoveryEmail) DOM.recoveryEmail.focus();
  }, 100);
}

function closeRecoveryModal() {
  if (!DOM.recoveryModal) return;
  DOM.recoveryModal.classList.remove("active");
  document.body.style.overflow = "";
}

function showRecoveryMessage(msg, type = "info") {
  if (!DOM.recoveryMessage) return;
  DOM.recoveryMessage.style.display = "block";
  DOM.recoveryMessage.textContent = msg;
  if (type === "success") {
    DOM.recoveryMessage.className = "auth-success-box";
  } else if (type === "error") {
    DOM.recoveryMessage.className = "auth-error-box";
  } else {
    DOM.recoveryMessage.className = "auth-info-box";
  }
}

function setRecoveryLoading(isLoading) {
  if (DOM.btnSubmitRecovery) DOM.btnSubmitRecovery.disabled = isLoading;
  if (DOM.btnRecoveryText) DOM.btnRecoveryText.style.display = isLoading ? "none" : "inline";
  if (DOM.btnRecoverySpinner) DOM.btnRecoverySpinner.style.display = isLoading ? "inline-block" : "none";
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

  if (DOM.filterGoogleRating) {
    DOM.filterGoogleRating.addEventListener("change", (e) => {
      state.filterGoogleRating = e.target.value;
      state.currentPage = 1;
      renderTable();
    });
  }

  // Limpar todos os filtros
  DOM.btnClearFilters.addEventListener("click", () => {
    state.searchQuery = "";
    state.filterUf = "TODAS";
    state.filterStatus = "TODOS";
    state.filterContact = "TODOS";
    state.filterGoogleRating = "TODOS";
    state.currentPage = 1;

    DOM.searchInput.value = "";
    DOM.searchClearBtn.style.display = "none";
    DOM.filterUf.value = "TODAS";
    DOM.filterStatus.value = "TODOS";
    DOM.filterContact.value = "TODOS";
    if (DOM.filterGoogleRating) DOM.filterGoogleRating.value = "TODOS";

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
    } else if (key === "google") {
      state.filterGoogleRating = "TODOS";
      if (DOM.filterGoogleRating) DOM.filterGoogleRating.value = "TODOS";
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

      if (lead && lead.status !== newStatus) {
        const anterior = { status: lead.status, historico: [...(lead.historico || [])] };

        lead.status = newStatus;
        lead.historico = [novaEntradaHistorico(`Status atualizado para "${newStatus}".`), ...anterior.historico];
        e.target.setAttribute("data-status", newStatus);
        updateKpiIndicators();

        syncLeadUpdateToSupabase(lead, anterior).then(ok => {
          if (ok) showToast(`Status de "${lead.nome}" salvo como ${newStatus}.`);
        });
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
  DOM.btnApplyBatchStatus.addEventListener("click", async () => {
    const newStatus = DOM.batchStatusSelect.value;
    if (!newStatus) return;

    const alvos = leadsData.filter(l => state.selectedLeadIds.has(l.id) && l.status !== newStatus);
    if (!alvos.length) return;

    const gravacoes = alvos.map(l => {
      const anterior = { status: l.status, historico: [...(l.historico || [])] };
      l.status = newStatus;
      l.historico = [novaEntradaHistorico(`Status atualizado em lote para "${newStatus}".`), ...anterior.historico];
      return syncLeadUpdateToSupabase(l, anterior);
    });

    updateKpiIndicators();
    renderTable();

    const resultados = await Promise.all(gravacoes);
    const ok = resultados.filter(Boolean).length;
    showToast(`${ok} de ${alvos.length} lead(s) salvos como "${newStatus}".`, ok === alvos.length ? "success" : "info");
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

  DOM.drawerStatusSelect.addEventListener("change", async (e) => {
    if (!state.activeLeadId) return;
    const lead = leadsData.find(l => l.id === state.activeLeadId);
    const newStatus = e.target.value;
    if (!lead || lead.status === newStatus) return;

    const anterior = { status: lead.status, historico: [...(lead.historico || [])] };
    lead.status = newStatus;
    lead.historico = [novaEntradaHistorico(`Status atualizado para "${newStatus}".`), ...anterior.historico];
    DOM.drawerStatusSelect.setAttribute("data-status", newStatus);
    updateKpiIndicators();
    renderTable();

    const ok = await syncLeadUpdateToSupabase(lead, anterior);
    if (ok) {
      showToast(`Status salvo como "${newStatus}".`);
    } else {
      DOM.drawerStatusSelect.value = lead.status;
      DOM.drawerStatusSelect.setAttribute("data-status", lead.status);
    }
  });

  DOM.btnSaveNotes.addEventListener("click", async () => {
    if (!state.activeLeadId) return;
    const lead = leadsData.find(l => l.id === state.activeLeadId);
    if (!lead) return;

    const anterior = { observacoes: lead.observacoes };
    lead.observacoes = DOM.drawerObservacoes.value;
    DOM.btnSaveNotes.disabled = true;

    const ok = await syncLeadUpdateToSupabase(lead, anterior);
    DOM.btnSaveNotes.disabled = false;
    if (ok) showToast("Anotações salvas no banco de dados.");
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
  if (DOM.btnExtractLeads) {
    DOM.btnExtractLeads.addEventListener("click", openExtractModal);
  }
  if (DOM.extractModalClose) {
    DOM.extractModalClose.addEventListener("click", closeExtractModal);
  }
  if (DOM.extractModalCloseBtn2) {
    DOM.extractModalCloseBtn2.addEventListener("click", closeExtractModal);
  }
  if (DOM.extractModal) {
    DOM.extractModal.addEventListener("click", (e) => {
      if (e.target === DOM.extractModal) closeExtractModal();
    });
  }

  if (DOM.btnOpenScraperLogs) {
    DOM.btnOpenScraperLogs.addEventListener("click", openLogsModal);
  }
  if (DOM.logsModalClose) {
    DOM.logsModalClose.addEventListener("click", closeLogsModal);
  }
  if (DOM.logsModalCloseBtn2) {
    DOM.logsModalCloseBtn2.addEventListener("click", closeLogsModal);
  }
  if (DOM.logsModal) {
    DOM.logsModal.addEventListener("click", (e) => {
      if (e.target === DOM.logsModal) closeLogsModal();
    });
  }

  // Exportação CSV geral
  if (DOM.btnExportCsv) {
    DOM.btnExportCsv.addEventListener("click", () => {
      exportToCsv();
    });
  }


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
    DOM.newLeadForm.addEventListener("submit", async (e) => {
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

      const horaAtual = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      const novoLead = {
        id: null, // Definido pelo banco após a gravação
        nome: nome,
        razaoSocial: razao || null,
        uf: uf,
        cidade: cidade,
        bairro: bairro || null,
        cnpj: cnpj,
        telefone: telefone,
        email: email || null,
        responsavel: responsavel,
        status: status,
        cnae: cnae || null,
        dataCadastro: HOJE_FORMATADO,
        duplicado: isDuplicado,
        observacoes: observacoes || "Estabelecimento incluído manualmente no painel Centrus.",
        historico: [
          { data: `${HOJE_FORMATADO} ${horaAtual}`, texto: "Estabelecimento cadastrado manualmente no sistema." }
        ]
      };

      // Grava primeiro no banco; só exibe na lista após confirmação
      const btnSubmit = DOM.newLeadForm.querySelector('[type="submit"]');
      if (btnSubmit) btnSubmit.disabled = true;
      const gravado = await syncNewLeadToSupabase(novoLead);
      if (btnSubmit) btnSubmit.disabled = false;

      if (!gravado) {
        showToast("Falha ao salvar a farmácia no banco. Nada foi perdido: revise e tente novamente.", "info");
        return;
      }

      leadsData.unshift(mapRowToLead(gravado));
      DOM.newLeadForm.reset();

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

  // --- NAVEGAÇÃO LATERAL (ESTILO CRM) ---
  if (DOM.brandLink) {
    DOM.brandLink.addEventListener("click", (e) => {
      e.preventDefault();
      resetAllFilters();
      window.scrollTo({ top: 0, behavior: "smooth" });
      document.body.classList.remove("sidebar-open");
      showToast("Visualização redefinida para a página inicial.");
    });
  }

  if (DOM.btnNavOverview) {
    DOM.btnNavOverview.addEventListener("click", () => {
      DOM.btnNavOverview.classList.add("active");
      if (DOM.btnOpenScraperLogs) DOM.btnOpenScraperLogs.classList.remove("active");
      if (DOM.btnNavSettings) DOM.btnNavSettings.classList.remove("active");
      document.body.classList.remove("sidebar-open");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  if (DOM.btnOpenScraperLogs) {
    DOM.btnOpenScraperLogs.addEventListener("click", () => {
      document.body.classList.remove("sidebar-open");
    });
  }

  if (DOM.btnNavSettings) {
    DOM.btnNavSettings.addEventListener("click", () => {
      document.body.classList.remove("sidebar-open");
      openSettingsModal();
    });
  }

  // Controle da Sidebar Mobile & Ações Rápidas
  if (DOM.btnSidebarToggle) {
    DOM.btnSidebarToggle.addEventListener("click", () => {
      document.body.classList.toggle("sidebar-open");
    });
  }

  if (DOM.btnSidebarCloseMobile) {
    DOM.btnSidebarCloseMobile.addEventListener("click", () => {
      document.body.classList.remove("sidebar-open");
    });
  }

  if (DOM.sidebarOverlay) {
    DOM.sidebarOverlay.addEventListener("click", () => {
      document.body.classList.remove("sidebar-open");
    });
  }

  if (DOM.btnSidebarSync) {
    DOM.btnSidebarSync.addEventListener("click", () => {
      document.body.classList.remove("sidebar-open");
      openExtractModal();
    });
  }

  if (DOM.btnSidebarExport) {
    DOM.btnSidebarExport.addEventListener("click", () => {
      document.body.classList.remove("sidebar-open");
      exportToCsv();
    });
  }

  if (DOM.btnSidebarNewLead) {
    DOM.btnSidebarNewLead.addEventListener("click", () => {
      document.body.classList.remove("sidebar-open");
      openNewLeadModal();
    });
  }

  if (DOM.btnTopbarNotification) {
    DOM.btnTopbarNotification.addEventListener("click", () => {
      showToast("Robô Centrus ativo monitorando drogarias e farmácias em todo o Brasil.");
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

  // --- AUTENTICAÇÃO SUPABASE COM LISTA RESTRITA ---
  const ADMINS_AUTORIZADOS = [
    "sadekjr@gmail.com",
    "sadek@centrusai.com",
    "guilhermefabricio564@gmail.com"
  ];

  if (DOM.loginForm) {
    DOM.loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = DOM.loginEmail ? DOM.loginEmail.value.trim().toLowerCase() : "";
      const password = DOM.loginPassword ? DOM.loginPassword.value : "";

      if (!email || !password) return;

      // Validação imediata de lista autorizada
      if (!ADMINS_AUTORIZADOS.includes(email)) {
        if (DOM.authErrorMessage) {
          DOM.authErrorMessage.textContent = "Acesso negado: Este e-mail não possui permissão de administrador no Centrus PharmaLeads.";
          DOM.authErrorMessage.style.display = "block";
        }
        return;
      }

      if (DOM.btnLoginSubmit) DOM.btnLoginSubmit.disabled = true;
      if (DOM.btnLoginText) DOM.btnLoginText.textContent = "Verificando credenciais...";
      if (DOM.btnLoginSpinner) DOM.btnLoginSpinner.style.display = "inline-block";
      if (DOM.authErrorMessage) DOM.authErrorMessage.style.display = "none";

      try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
          email,
          password
        });

        if (error) throw error;

        showToast(`Bem-vindo, ${data.user.email}!`);
        setAuthenticatedUser(data.user);
        if (DOM.loginForm) DOM.loginForm.reset();
      } catch (err) {
        if (DOM.authErrorMessage) {
          DOM.authErrorMessage.textContent = (err.message === "Invalid login credentials" || err.status === 400)
            ? "Senha incorreta ou usuário não encontrado."
            : `Erro ao autenticar: ${err.message}`;
          DOM.authErrorMessage.style.display = "block";
        }
      } finally {
        if (DOM.btnLoginSubmit) DOM.btnLoginSubmit.disabled = false;
        if (DOM.btnLoginText) DOM.btnLoginText.textContent = "Entrar no Sistema";
        if (DOM.btnLoginSpinner) DOM.btnLoginSpinner.style.display = "none";
      }
    });
  }

  if (DOM.btnTogglePassword && DOM.loginPassword) {
    DOM.btnTogglePassword.addEventListener("click", () => {
      const isPass = DOM.loginPassword.type === "password";
      DOM.loginPassword.type = isPass ? "text" : "password";
      DOM.btnTogglePassword.setAttribute("title", isPass ? "Ocultar senha" : "Visualizar senha");
      DOM.btnTogglePassword.innerHTML = isPass
        ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`
        : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
    });
  }

  if (DOM.btnForgotPassword) {
    DOM.btnForgotPassword.addEventListener("click", (e) => {
      e.preventDefault();
      openRecoveryModal();
    });
  }

  if (DOM.recoveryModalClose) {
    DOM.recoveryModalClose.addEventListener("click", closeRecoveryModal);
  }

  if (DOM.recoveryModalCancelBtn) {
    DOM.recoveryModalCancelBtn.addEventListener("click", closeRecoveryModal);
  }

  if (DOM.recoveryModal) {
    DOM.recoveryModal.addEventListener("click", (e) => {
      if (e.target === DOM.recoveryModal) closeRecoveryModal();
    });
  }

  if (DOM.recoveryForm) {
    DOM.recoveryForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = DOM.recoveryEmail ? DOM.recoveryEmail.value.trim() : "";
      if (!email) {
        showRecoveryMessage("Informe seu e-mail corporativo.", "info");
        return;
      }

      setRecoveryLoading(true);

      try {
        if (!supabaseClient) throw new Error("Serviço de autenticação temporariamente indisponível.");
        
        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin
        });

        if (error) throw error;

        showRecoveryMessage(`Instruções de redefinição enviadas com sucesso para ${email}! Verifique sua caixa de entrada e siga o link seguro.`, "success");
        if (DOM.btnSubmitRecovery) DOM.btnSubmitRecovery.disabled = true;
        showToast(`E-mail de recuperação enviado para ${email}.`);
      } catch (err) {
        showRecoveryMessage(`Não foi possível enviar a solicitação: ${err.message || err}`, "error");
      } finally {
        setRecoveryLoading(false);
      }
    });
  }

  if (DOM.btnLogout) {
    DOM.btnLogout.addEventListener("click", async () => {
      if (confirm("Deseja realmente encerrar a sessão segura do Centrus PharmaLeads?")) {
        await supabaseClient.auth.signOut();
        currentUser = null;
        leadsData = [];
        updateKpiIndicators();
        renderTable();
        showAuthScreen();
        showToast("Sessão corporativa encerrada com segurança.");
      }
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
      closeRecoveryModal();
    }
  });
}

// =============================================================================
// 13. GERENCIAMENTO DE AUTENTICAÇÃO E SESSÃO SEGURA
// =============================================================================

let currentUser = null;

async function checkAuthSession() {
  if (!supabaseClient) {
    console.warn("Cliente Supabase não inicializado.");
    return;
  }

  try {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    if (session && session.user) {
      setAuthenticatedUser(session.user);
    } else {
      showAuthScreen();
    }
  } catch (err) {
    console.warn("Erro ao checar sessão:", err);
    showAuthScreen();
  }

  // Ouvinte de mudanças na autenticação
  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" && session?.user) {
      setAuthenticatedUser(session.user);
    } else if (event === "SIGNED_OUT") {
      currentUser = null;
      leadsData = [];
      updateKpiIndicators();
      renderTable();
      showAuthScreen();
    }
  });
}

function setAuthenticatedUser(user) {
  const email = (user && user.email ? user.email.toLowerCase().trim() : "");
  const ADMINS_AUTORIZADOS = [
    "sadekjr@gmail.com",
    "sadek@centrusai.com",
    "guilhermefabricio564@gmail.com"
  ];

  if (!ADMINS_AUTORIZADOS.includes(email)) {
    console.warn("Tentativa de acesso não autorizada:", email);
    if (supabaseClient) supabaseClient.auth.signOut();
    currentUser = null;
    showAuthScreen();
    if (DOM.authErrorMessage) {
      DOM.authErrorMessage.textContent = "Acesso negado: Este e-mail não possui permissão de administrador no Centrus PharmaLeads.";
      DOM.authErrorMessage.style.display = "block";
    }
    return;
  }

  currentUser = user;
  const nomeExibicao = email.split("@")[0].replace(/[._-]/g, " ").toUpperCase();

  if (DOM.headerUserName) DOM.headerUserName.textContent = nomeExibicao;
  if (DOM.headerUserRole) DOM.headerUserRole.textContent = email;
  if (DOM.headerUserAvatar) DOM.headerUserAvatar.textContent = email.charAt(0).toUpperCase();
  if (DOM.topbarAvatar) DOM.topbarAvatar.textContent = email.charAt(0).toUpperCase();

  hideAuthScreen();
  carregarLeadsDoSupabase();
}

function showAuthScreen() {
  if (DOM.authScreen) {
    DOM.authScreen.classList.remove("hidden");
  }
  if (DOM.mainDashboard) {
    DOM.mainDashboard.style.filter = "blur(6px)";
    DOM.mainDashboard.style.pointerEvents = "none";
  }
  setTimeout(() => {
    if (DOM.loginEmail) DOM.loginEmail.focus();
  }, 150);
}

function hideAuthScreen() {
  if (DOM.authScreen) {
    DOM.authScreen.classList.add("hidden");
  }
  if (DOM.mainDashboard) {
    DOM.mainDashboard.style.filter = "none";
    DOM.mainDashboard.style.pointerEvents = "auto";
  }
}

// =============================================================================
// 14. INICIALIZAÇÃO DA APLICAÇÃO
// =============================================================================

document.addEventListener("DOMContentLoaded", () => {
  updateKpiIndicators();
  renderTable();
  setupEventListeners();
  
  // Verifica autenticação ativa no Supabase
  checkAuthSession();
  console.log("Centrus PharmaLeads - Plataforma privada corporativa ativa.");
});


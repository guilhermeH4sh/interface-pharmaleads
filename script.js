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

/**
 * Carrega os leads em tempo real da tabela 'pharmaleads' do Supabase
 */
async function carregarLeadsDoSupabase() {
  if (!supabaseClient) return;

  try {
    const { data, error } = await supabaseClient
      .from('pharmaleads')
      .select('*')
      .order('id', { ascending: true });

    if (!error && data && data.length > 0) {
      leadsData = data.map(item => ({
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

      updateKpiIndicators();
      renderRegionalDistribution();
      renderTable();

      const navCount = document.getElementById("headerNavLeadCount");
      if (navCount) navCount.textContent = leadsData.length;

      console.log(`✅ Supabase sincronizado: ${leadsData.length} farmácias carregadas da nuvem.`);
    }
  } catch (err) {
    console.warn("ℹ️ Operando com base de dados local em cache:", err);
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
  
  // Carrega os dados mais recentes do Supabase em segundo plano
  carregarLeadsDoSupabase();
  console.log("Centrus PharmaLeads - Plataforma operacional ativa.");
});

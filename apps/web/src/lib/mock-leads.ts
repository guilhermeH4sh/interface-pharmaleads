import { parseLeadEmails, type EmailAvailability } from "./email";
import type { WhatsAppVerification } from "./whatsapp";

/**
 * Módulo de dados mockados e serviços assíncronos no formato Supabase
 * Permite alternar para o Supabase real sem alterar os componentes de UI.
 */

export type LeadStatus = "Qualificado" | "Em contato" | "Respondido" | "Não qualificado" | "Não contatado";
export type LeadOrigin = "Google Maps" | "Google Meu Negócio" | "Receita Federal" | "Outras fontes";

export interface LeadItem {
  id: string;
  nome: string;
  cnpj: string;
  cnpjOrigem?: string;
  cnpjConfianca?: string;
  cidade: string;
  uf: string;
  bairro: string;
  telefone: string;
  status: LeadStatus;
  origem: LeadOrigin;
  endereco?: string;
  categoria?: string;
  segmento?: string;
  situacao?: string;
  site?: string;
  email?: string;
  avaliacao?: number;
  qtdAvaliacoes?: number;
  avaliacoesRecentes?: Array<{ nota?: string; texto?: string; data?: string }>;
  link?: string;
  whatsappLink?: string;
  whatsappPublicado?: string;
  whatsappVerificacao?: WhatsAppVerification;
  ultimaColeta?: string;
  dataCriacao?: string;
  updatedAt?: number;
  crmIncluded?: boolean;
}

export interface LeadSummary {
  totalLeads: number;
  qualificados: number;
  emContato: number;
  respondidos: number;
  naoContatados: number;
  naoQualificados: number;
  estados: number;
  origem: {
    googleMaps: { percent: number; count: number };
    googleMeuNegocio: { percent: number; count: number };
    outrasFontes: { percent: number; count: number };
  };
}

export interface LeadFilterParams {
  query?: string;
  statusTab?: "Todos" | LeadStatus;
  uf?: string;
  statusSelect?: string;
  origem?: string;
  segmentos?: string[];
  emailAvailability?: EmailAvailability;
  page?: number;
  pageSize?: number;
}

export interface LeadPaginationResult {
  items: LeadItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Modo demo intencionalmente vazio: nenhum estabelecimento fictício é carregado.
export const MOCK_SUMMARY: LeadSummary = {
  totalLeads: 0,
  qualificados: 0,
  emContato: 0,
  respondidos: 0,
  naoContatados: 0,
  naoQualificados: 0,
  estados: 0,
  origem: {
    googleMaps: { percent: 0, count: 0 },
    googleMeuNegocio: { percent: 0, count: 0 },
    outrasFontes: { percent: 0, count: 0 },
  },
};
let MOCK_DATABASE: LeadItem[] = [];

/**
 * Função assíncrona simulando endpoint do Supabase com filtros no servidor
 */
export async function fetchMockLeads(params: LeadFilterParams): Promise<LeadPaginationResult> {
  // Simula latência de rede realista (180ms)
  await new Promise((resolve) => setTimeout(resolve, 180));

  const {
    query = "",
    statusTab = "Todos",
    uf = "",
    statusSelect = "",
    origem = "",
    segmentos = [],
    emailAvailability = "todos",
    page = 1,
    pageSize = 5,
  } = params;

  let filtered = [...MOCK_DATABASE];

  // 1. Filtro da Aba rápida (Pills)
  if (statusTab && statusTab !== "Todos") {
    filtered = filtered.filter((item) => item.status === statusTab);
  }

  // 2. Filtro do Select de Status da coluna lateral
  if (statusSelect && statusSelect !== "Todos os status") {
    filtered = filtered.filter((item) => item.status === statusSelect);
  }

  // 3. Filtro de Origem
  if (origem && origem !== "Todas as origens") {
    filtered = filtered.filter((item) => item.origem === origem);
  }

  if (segmentos.length) {
    filtered = filtered.filter((item) => segmentos.includes(item.segmento || ""));
  }

  if (emailAvailability !== "todos") {
    filtered = filtered.filter((item) => (parseLeadEmails(item.email).length > 0) === (emailAvailability === "com"));
  }

  // 4. Filtro de UF
  if (uf && uf !== "Selecionar UF(s)" && uf !== "Todas as UFs") {
    filtered = filtered.filter((item) => item.uf === uf);
  }

  // 5. Busca textual (nome, CNPJ, telefone, e-mail e categoria)
  if (query.trim()) {
    const q = query.trim().toLowerCase();
    filtered = filtered.filter(
      (item) =>
        item.nome.toLowerCase().includes(q) ||
        item.cnpj.replace(/\D/g, "").includes(q.replace(/\D/g, "")) ||
        item.uf.toLowerCase().includes(q) ||
        item.telefone.replace(/\D/g, "").includes(q.replace(/\D/g, "")) ||
        (item.categoria && item.categoria.toLowerCase().includes(q))
    );
  }

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const items = filtered.slice(startIndex, startIndex + pageSize);

  return {
    items,
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}

/**
 * Retorna as estatísticas resumidas
 */
export async function fetchMockSummary(): Promise<LeadSummary> {
  return MOCK_SUMMARY;
}

/**
 * Atualiza o status de um lead no banco mockado
 */
export async function updateLeadStatus(id: string, newStatus: LeadStatus): Promise<boolean> {
  await new Promise((resolve) => setTimeout(resolve, 100));
  const lead = MOCK_DATABASE.find((item) => item.id === id);
  if (!lead) return false;
  lead.status = newStatus;
  return true;
}

/**
 * Atualiza status em lote
 */
export async function batchUpdateStatus(ids: string[], newStatus: LeadStatus): Promise<boolean> {
  await new Promise((resolve) => setTimeout(resolve, 150));
  const idSet = new Set(ids);
  MOCK_DATABASE.forEach((item) => {
    if (idSet.has(item.id)) {
      item.status = newStatus;
    }
  });
  return true;
}

/**
 * Remove um lead do banco mockado
 */
export async function deleteLead(id: string): Promise<boolean> {
  await new Promise((resolve) => setTimeout(resolve, 100));
  const initialLength = MOCK_DATABASE.length;
  MOCK_DATABASE = MOCK_DATABASE.filter((item) => item.id !== id);
  return MOCK_DATABASE.length < initialLength;
}

export function getUFs(): string[] {
  return ["BA", "CE", "DF", "GO", "MG", "PE", "PR", "RJ", "RS", "SC", "SP"];
}

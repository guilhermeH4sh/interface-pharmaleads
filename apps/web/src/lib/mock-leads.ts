import { parseLeadEmails, type EmailAvailability } from "./email";

/**
 * Módulo de dados mockados e serviços assíncronos no formato Supabase
 * Permite alternar para o Supabase real sem alterar os componentes de UI.
 */

export type LeadStatus = "Qualificado" | "Em contato" | "Respondido" | "Não qualificado" | "Não contatado";
export type LeadOrigin = "Google Maps" | "Google Meu Negócio" | "Outras fontes";

export interface LeadItem {
  id: string;
  nome: string;
  cnpj: string;
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
  link?: string;
  whatsappLink?: string;
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
  municipio?: string;
  bairro?: string;
  statusSelect?: string;
  origem?: string;
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
// Hierarquia de Localidades para filtros em cascata
export const LOCATIONS_HIERARCHY: Record<string, Record<string, string[]>> = {
  SP: {
    "São Paulo": ["Centro", "Pinheiros", "Moema", "Itaim Bibi", "Vila Mariana", "Santana", "Tatuapé"],
    "Sorocaba": ["Centro", "Campolim", "Além Ponte", "Trujillo", "Mangal"],
    "Campinas": ["Cambuí", "Centro", "Barão Geraldo", "Taquaral", "Guanabara"],
    "Ribeirão Preto": ["Centro", "Jardim Paulista", "Bonfim Paulista", "Ipiranga"],
    "Santos": ["Gonzaga", "Boqueirão", "Ponta da Praia", "Embaré"],
  },
  GO: {
    "Goiânia": ["Setor Bueno", "Setor Marista", "Setor Oeste", "Centro", "Jardim Goiás"],
    "Anápolis": ["Jundiaí", "Centro", "Maracanã", "Cidade Jardim"],
    "Aparecida de Goiânia": ["Centro", "Vila Brasília", "Garavelo"],
  },
  DF: {
    "Brasília": ["Asa Sul", "Asa Norte", "Sudoeste", "Águas Claras", "Taguatinga", "Guará"],
  },
  RJ: {
    "Rio de Janeiro": ["Copacabana", "Ipanema", "Barra da Tijuca", "Botafogo", "Tijuca", "Centro"],
    "Niterói": ["Icaraí", "Ingá", "Centro", "Santa Rosa"],
  },
  MG: {
    "Belo Horizonte": ["Savassi", "Lourdes", "Funcionários", "Centro", "Pampulha"],
    "Uberlândia": ["Centro", "Santa Mônica", "Fundinho"],
  },
  PR: {
    "Curitiba": ["Batel", "Centro", "Bigorrilho", "Água Verde", "Cabral"],
    "Londrina": ["Centro", "Gleba Palhano"],
  },
  RS: {
    "Porto Alegre": ["Moinhos de Vento", "Bela Vista", "Centro Histórico", "Menino Deus"],
    "Caxias do Sul": ["Centro", "Pellegrino", "São Pelegrino"],
  },
  BA: {
    "Salvador": ["Pituba", "Barra", "Graça", "Itaigara", "Brotas"],
  },
  SC: {
    "Florianópolis": ["Centro", "Trindade", "Agronômica", "Itacorubi"],
  },
  PE: {
    "Recife": ["Boa Viagem", "Graças", "Espinheiro", "Casa Forte"],
  },
  CE: {
    "Fortaleza": ["Aldeota", "Meireles", "Cocó", "Centro"],
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
    municipio = "",
    bairro = "",
    statusSelect = "",
    origem = "",
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

  if (emailAvailability !== "todos") {
    filtered = filtered.filter((item) => (parseLeadEmails(item.email).length > 0) === (emailAvailability === "com"));
  }

  // 4. Filtro de UF
  if (uf && uf !== "Selecionar UF(s)" && uf !== "Todas as UFs") {
    filtered = filtered.filter((item) => item.uf === uf);
  }

  // 5. Filtro de Município
  if (municipio && municipio !== "Selecionar município" && municipio !== "Todos os municípios") {
    filtered = filtered.filter((item) => item.cidade.toLowerCase() === municipio.toLowerCase());
  }

  // 6. Filtro de Bairro
  if (bairro && bairro !== "Selecionar bairro" && bairro !== "Todos os bairros") {
    filtered = filtered.filter((item) => item.bairro.toLowerCase() === bairro.toLowerCase());
  }

  // 7. Busca textual (nome, cnpj, cidade, telefone, categoria)
  if (query.trim()) {
    const q = query.trim().toLowerCase();
    filtered = filtered.filter(
      (item) =>
        item.nome.toLowerCase().includes(q) ||
        item.cnpj.replace(/\D/g, "").includes(q.replace(/\D/g, "")) ||
        item.cidade.toLowerCase().includes(q) ||
        item.uf.toLowerCase().includes(q) ||
        item.telefone.replace(/\D/g, "").includes(q.replace(/\D/g, "")) ||
        (item.bairro && item.bairro.toLowerCase().includes(q)) ||
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

/**
 * Helpers para selects cascateados
 */
export function getUFs(): string[] {
  return Object.keys(LOCATIONS_HIERARCHY).sort();
}

export function getMunicipios(uf: string): string[] {
  if (!uf || !LOCATIONS_HIERARCHY[uf]) return [];
  return Object.keys(LOCATIONS_HIERARCHY[uf]).sort();
}

export function getBairros(uf: string, municipio: string): string[] {
  if (!uf || !municipio || !LOCATIONS_HIERARCHY[uf] || !LOCATIONS_HIERARCHY[uf][municipio]) {
    return [];
  }
  return LOCATIONS_HIERARCHY[uf][municipio].sort();
}


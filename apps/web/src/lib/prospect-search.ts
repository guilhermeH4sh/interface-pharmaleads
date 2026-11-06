import { PUBLISHABLE_KEY, SUPABASE_URL, validSupabaseSession, type SupabaseSession } from "./backend";
import type { Lead } from "./crm";

export const ESTABLISHMENTS = [
  { value: "varejo", label: "Farmácia de Varejo / Drogaria" },
  { value: "manipulacao", label: "Farmácia de Manipulação" },
  { value: "homeopatia", label: "Farmácia Homeopática" },
  { value: "veterinaria", label: "Farmácia Veterinária" },
  { value: "distribuidoras", label: "Distribuidoras de Medicamentos" },
];
export const STATES = [
  ["AC", "Acre"], ["AL", "Alagoas"], ["AP", "Amapá"], ["AM", "Amazonas"],
  ["BA", "Bahia"], ["CE", "Ceará"], ["DF", "Distrito Federal"], ["ES", "Espírito Santo"],
  ["GO", "Goiás"], ["MA", "Maranhão"], ["MT", "Mato Grosso"], ["MS", "Mato Grosso do Sul"],
  ["MG", "Minas Gerais"], ["PA", "Pará"], ["PB", "Paraíba"], ["PR", "Paraná"],
  ["PE", "Pernambuco"], ["PI", "Piauí"], ["RJ", "Rio de Janeiro"], ["RN", "Rio Grande do Norte"],
  ["RS", "Rio Grande do Sul"], ["RO", "Rondônia"], ["RR", "Roraima"], ["SC", "Santa Catarina"],
  ["SP", "São Paulo"], ["SE", "Sergipe"], ["TO", "Tocantins"],
].map(([value, label]) => ({ value, label: `${label} (${value})` }));
export const SOURCES = ["Google Maps", "Google Meu Negócio", "Receita Federal", "Outras fontes"].map(value => ({ value, label: value }));
export const SEARCH_STATUSES = ["Qualificado", "Em contato", "Respondido", "Não contatado", "Não qualificado"].map(value => ({ value, label: value }));

export interface ProspectFilters {
  segments: string[];
  states: string[];
  sources: string[];
  statuses: string[];
}
export const emptyProspectFilters = (): ProspectFilters => ({ segments: [], states: [], sources: [], statuses: [] });
export const SEARCH_PAGE_SIZE = 25;
const COLUMNS = "chave,nome,segmento,categoria,endereco,local_busca,telefone,telefone_normalizado,emails,site,link,whatsapp_link,crm_status";

function validateSelection(values: string[], options: { value: string }[]) {
  if (values.some(value => !options.some(option => option.value === value))) {
    throw new Error("Filtro de pesquisa inválido.");
  }
}

export function buildProspectQuery(filters: ProspectFilters, page: number): URLSearchParams {
  validateSelection(filters.segments, ESTABLISHMENTS);
  validateSelection(filters.states, STATES);
  validateSelection(filters.sources, SOURCES);
  validateSelection(filters.statuses, SEARCH_STATUSES);
  const query = new URLSearchParams({
    select: COLUMNS,
    order: "nome.asc,chave.asc",
    limit: String(SEARCH_PAGE_SIZE),
    offset: String((Math.max(1, page) - 1) * SEARCH_PAGE_SIZE),
  });
  if (filters.segments.length) query.set("segmento", `in.(${filters.segments.join(",")})`);
  if (filters.states.length) {
    query.set("or", `(${filters.states.map(uf => `local_busca.ilike."*, ${uf}"`).join(",")})`);
  }
  if (filters.statuses.length) query.set("crm_status", `in.(${filters.statuses.map(value => `"${value}"`).join(",")})`);
  // A tabela atual contém somente a coleta Gosom/Maps; não há coluna de fonte.
  if (filters.sources.length && !filters.sources.includes("Google Maps")) query.set("chave", "is.null");
  return query;
}

export async function searchSupabaseProspects(session: SupabaseSession, filters: ProspectFilters, page: number, signal?: AbortSignal) {
  const active = await validSupabaseSession(session);
  const response = await fetch(`${SUPABASE_URL}/rest/v1/pharmaleads?${buildProspectQuery(filters, page)}`, {
    headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${active.access_token}`, Prefer: "count=exact" },
    signal,
  });
  if (!response.ok) throw new Error(`Não foi possível pesquisar os leads (HTTP ${response.status}). Confira a sessão e as permissões da tabela.`);
  const rows = await response.json() as Lead[];
  const range = response.headers.get("content-range")?.split("/")[1];
  if (!range || range === "*" || !Number.isFinite(Number(range))) throw new Error("O Supabase não informou a contagem de resultados.");
  return { rows, total: Number(range), session: active };
}

export function prospectTitle(filters: ProspectFilters): string {
  const types = filters.segments.map(value => ESTABLISHMENTS.find(option => option.value === value)?.label).join(", ");
  const states = filters.states.map(value => STATES.find(option => option.value === value)?.label).join(", ");
  return `${types || "Estabelecimentos farmacêuticos"} em ${states || "todo o Brasil"}`;
}

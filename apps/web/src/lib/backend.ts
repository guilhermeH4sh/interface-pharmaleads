import type { Lead, Status as LocalApiStatus } from "./crm";
import type {
  LeadFilterParams,
  LeadItem,
  LeadPaginationResult,
  LeadStatus,
  LeadSummary,
} from "./mock-leads";
import { parseLeadEmails } from "./email";
import { normalizeWhatsAppNumber, publishedWhatsAppNumber, whatsAppUrl, type WhatsAppVerification } from "./whatsapp";

// Configuração oficial do Supabase (mesma utilizada em HostedDashboard.tsx)
export const SUPABASE_URL = "https://qxsdcrywsjkrpcbfgbxb.supabase.co";
export const PUBLISHABLE_KEY = "sb_publishable_9AdBAjeEHFysAVpC7VCLMw_cDgQ4Fl0";
export const AUTHORIZED_USER_ID = "677ed1e4-3e73-4f2c-951f-e77386f305da";
export const SESSION_KEY = "pharmaleads-supabase-session";
export const CRM_STORAGE_KEY = "pharmaleads-crm-overrides";
export const DELETED_STORAGE_KEY = "pharmaleads-deleted-ids";

const SUPABASE_BASE_COLUMNS =
  "chave,nome,segmento,categoria,endereco,local_busca,telefone,telefone_normalizado,celular,whatsapp_link,site,emails,situacao,avaliacao,qtd_avaliacoes,latitude,longitude,link,ultima_coleta,dados_brutos";
const SUPABASE_COLUMNS = `${SUPABASE_BASE_COLUMNS},crm_included,crm_status`;
const SUPABASE_LIST_COLUMNS = [
  SUPABASE_COLUMNS.replace(",dados_brutos,", ","),
  "cnpj:dados_brutos->>cnpj",
  "cnpj_origem:dados_brutos->>cnpj_origem",
  "cnpj_confianca:dados_brutos->>cnpj_confianca",
  "fonte_dados:dados_brutos->>fonte_dados",
  "enriquecimento_site:dados_brutos->enriquecimento_site",
  "whatsapp_verificacao",
  "avaliacoes_recentes:dados_brutos->avaliacoes_recentes",
].join(",");
let whatsappColumnAvailable = true;

async function fetchLeadTable(query: URLSearchParams, options: RequestInit) {
  const select = (query.get("select") ?? "").split(",");
  const withoutVerification = select.includes("whatsapp_verificacao");
  if (withoutVerification && !whatsappColumnAvailable) {
    query.set("select", select.filter(column => column !== "whatsapp_verificacao").join(","));
  }
  const url = `${SUPABASE_URL}/rest/v1/pharmaleads`;
  const response = await fetch(`${url}?${query}`, options);
  if (withoutVerification && whatsappColumnAvailable && response.status === 400) {
    const error = await response.clone().json().catch(() => null) as { code?: string; message?: string } | null;
    if (error?.code === "42703" && error.message?.includes("whatsapp_verificacao")) {
      whatsappColumnAvailable = false;
      query.set("select", select.filter(column => column !== "whatsapp_verificacao").join(","));
      return fetch(`${url}?${query}`, options);
    }
  }
  return response;
}

export const COLETA_ATIVA_STATES = ["queued", "in_progress", "waiting", "pending", "requested"];

export type DataSourceMode = "local" | "supabase" | "mock";

export interface SupabaseSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  email?: string;
}

export interface CollectorRun {
  id: number | string;
  status: string;
  conclusion: string | null;
  url: string;
  created_at: string;
  title: string;
  stage?: string;
  round?: number;
  total_rounds?: number;
  completed_rounds?: number;
  skipped_rounds?: number;
  empty_rounds?: number;
  failure_reason?: "empty" | "timeout" | "sync" | "collector";
  synced_leads?: number;
  new_supabase_leads?: number;
  goal_leads?: number;
  new_leads_per_hour?: number;
  queries_completed?: number;
  queries_with_results?: number;
  local_duplicates?: number;
  found_leads?: number;
  new_leads?: number;
  with_email?: number;
  without_email?: number;
  can_stop?: boolean;
}

export interface UfCoverageItem {
  sigla: string;
  total: number;
  ultima: string;
}

export class AccessError extends Error { }

interface CrmOverride {
  status?: LeadStatus;
  crmIncluded?: boolean;
  updatedAt?: number;
}

function loadCrmOverrides(): Record<string, CrmOverride> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(CRM_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, CrmOverride>) : {};
  } catch {
    return {};
  }
}

function saveCrmOverrides(map: Record<string, CrmOverride>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CRM_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

function loadDeletedIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(DELETED_STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

export function setLeadStatusOverride(id: string, status: LeadStatus): void {
  const map = loadCrmOverrides();
  map[id] = { ...map[id], status, updatedAt: Date.now() };
  saveCrmOverrides(map);
}

export function setLeadCrmMembershipOverride(id: string, included: boolean): void {
  const map = loadCrmOverrides();
  map[id] = { ...map[id], crmIncluded: included, updatedAt: Date.now() };
  saveCrmOverrides(map);
}

export function setBatchLeadStatusOverride(ids: string[], status: LeadStatus): void {
  const map = loadCrmOverrides();
  const now = Date.now();
  for (const id of ids) {
    map[id] = { ...map[id], status, updatedAt: now };
  }
  saveCrmOverrides(map);
}

export function markLeadDeletedLocal(id: string): void {
  if (typeof window === "undefined") return;
  const set = loadDeletedIds();
  set.add(id);
  try {
    window.localStorage.setItem(DELETED_STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    // ignore
  }
}

// ---------- Sessão e Autenticação Supabase ----------

export function savedSupabaseSession(): SupabaseSession | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(SESSION_KEY) || window.sessionStorage.getItem(SESSION_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as SupabaseSession;
    if (!parsed.access_token || !parsed.refresh_token || !Number.isFinite(parsed.expires_at)) return null;
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(parsed));
    window.sessionStorage.removeItem(SESSION_KEY);
    return parsed;
  } catch {
    return null;
  }
}

let authGeneration = 0;

export function clearSupabaseSession(): void {
  authGeneration += 1;
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_KEY);
  window.sessionStorage.removeItem(SESSION_KEY);
}

export async function authenticateSupabase(
  grant: "password" | "refresh_token",
  fields: Record<string, string>,
  customUrl = SUPABASE_URL,
  customKey = PUBLISHABLE_KEY
): Promise<SupabaseSession> {
  const generation = authGeneration;
  let response: Response;
  let body: { access_token?: string; refresh_token?: string; expires_in?: number;
    user?: { id?: string; email?: string } };
  try {
    response = await fetch(`${customUrl}/auth/v1/token?grant_type=${grant}`, {
      method: "POST",
      headers: { apikey: customKey, "Content-Type": "application/json" },
      body: JSON.stringify(fields),
      signal: AbortSignal.timeout(8_000),
    });
    body = await response.json();
  } catch {
    throw new Error("Serviço de autenticação temporariamente indisponível. Tente novamente em instantes.");
  }
  if (generation !== authGeneration) throw new AccessError("Sessão encerrada.");
  if (response.status >= 500 || response.status === 429) {
    throw new Error("Serviço de autenticação temporariamente indisponível. Tente novamente em instantes.");
  }
  if (!response.ok) {
    throw new AccessError(
      grant === "password"
        ? "E-mail ou senha inválidos."
        : "Sua sessão expirou. Entre novamente na plataforma."
    );
  }
  if (!body || !body.access_token || !body.refresh_token || typeof body.expires_in !== "number" || !Number.isFinite(body.expires_in) || body.expires_in <= 0) {
    throw new Error("Serviço de autenticação temporariamente indisponível. Tente novamente em instantes.");
  }
  if (body.user?.id !== AUTHORIZED_USER_ID) {
    clearSupabaseSession();
    throw new AccessError(
      "Esta conta não tem acesso à plataforma."
    );
  }
  const session: SupabaseSession = {
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    expires_at: Date.now() + body.expires_in * 1000,
    email: body.user?.email || fields.email,
  };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
  return session;
}

let sessionRefresh: Promise<SupabaseSession> | null = null;

export async function validSupabaseSession(session: SupabaseSession): Promise<SupabaseSession> {
  const stored = savedSupabaseSession();
  const current = stored && stored.expires_at > session.expires_at ? stored : session;
  if (current.expires_at > Date.now() + 60_000) return current;
  // Compartilha a renovação entre o coletor e as consultas de leads.
  if (!sessionRefresh) {
    sessionRefresh = authenticateSupabase("refresh_token", { refresh_token: current.refresh_token })
      .finally(() => { sessionRefresh = null; });
  }
  return sessionRefresh;
}

export async function verifyPlatformSession(session: SupabaseSession): Promise<SupabaseSession> {
  const active = await validSupabaseSession(session);
  let identity: Response;
  try { identity = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${active.access_token}` },
    signal: AbortSignal.timeout(8_000),
  }); } catch {
    throw new Error("Serviço de autenticação temporariamente indisponível. Tente novamente em instantes.");
  }
  if (identity.status === 401 || identity.status === 403) throw new AccessError("Sua sessão expirou. Entre novamente na plataforma.");
  if (!identity.ok) throw new Error("Não foi possível validar sua sessão. Tente novamente.");
  let user: { id?: string };
  try { user = await identity.json(); } catch {
    throw new Error("Serviço de autenticação temporariamente indisponível. Tente novamente em instantes.");
  }
  if (!user || typeof user.id !== "string") {
    throw new Error("Serviço de autenticação temporariamente indisponível. Tente novamente em instantes.");
  }
  if (user.id !== AUTHORIZED_USER_ID) {
    throw new AccessError(
      "Esta conta não tem acesso à plataforma."
    );
  }
  return active;
}

export async function fetchSupabaseAllLeads(
  session: SupabaseSession,
  options: { crmOnly?: boolean; signal?: AbortSignal } = {}
): Promise<{ session: SupabaseSession; rows: Lead[] }> {
  const active = await verifyPlatformSession(session);

  const rows: Lead[] = [];
  let lastKey = "";
  let pageSize = 500;
  while (true) {
    const query = new URLSearchParams({
      select: SUPABASE_LIST_COLUMNS,
      order: "chave.asc",
      limit: String(pageSize),
    });
    if (lastKey) query.set("chave", `gt.${lastKey}`);
    if (options.crmOnly) query.set("or", "(crm_included.eq.true,and(crm_included.is.null,crm_status.neq.Não contatado))");
    const response = await fetchLeadTable(query, {
      cache: "no-store",
      signal: AbortSignal.any([...(options.signal ? [options.signal] : []), AbortSignal.timeout(20_000)]),
      headers: {
        apikey: PUBLISHABLE_KEY,
        Authorization: `Bearer ${active.access_token}`,
      },
    });
    if (response.status === 401) throw new AccessError("Sua sessão expirou. Entre novamente na plataforma.");
    if (response.status === 403) {
      throw new Error("A conta não tem acesso à tabela pharmaleads. Verifique as permissões no Supabase.");
    }
    if (!response.ok) {
      const failure = await response.json().catch(() => null) as { code?: string } | null;
      if (failure?.code === "57014" && pageSize > 100) {
        pageSize = Math.max(100, Math.floor(pageSize / 2));
        continue;
      }
      throw new Error(`Consulta ao Supabase falhou (HTTP ${response.status}).`);
    }
    const batch = (await response.json()) as Array<Lead & NonNullable<Lead["dados_brutos"]>>;
    for (const { cnpj, cnpj_origem, cnpj_confianca, fonte_dados, enriquecimento_site, avaliacoes_recentes, ...row } of batch) {
      rows.push({
        ...row,
        dados_brutos: row.dados_brutos ?? { cnpj, cnpj_origem, cnpj_confianca, fonte_dados, enriquecimento_site, avaliacoes_recentes },
      });
    }
    if (batch.length) {
      const nextKey = batch[batch.length - 1].chave;
      if (!nextKey || nextKey === lastKey) throw new Error("A paginação do Supabase retornou uma chave inválida.");
      lastKey = nextKey;
    }
    if (batch.length < pageSize) break;
  }
  if (new Set(rows.map(row => row.chave)).size !== rows.length) {
    throw new Error("A consulta ao Supabase retornou uma lista incompleta de leads.");
  }
  return { session: active, rows };
}

export interface RemoteLeadFilters {
  uf: string;
  origem: string;
  segmentos: string[];
  emailAvailability: "todos" | "com" | "sem";
  whatsappConfirmed?: boolean;
  query: string;
  includeCrm?: boolean;
}

export type LeadMetrics = Pick<LeadSummary, "totalLeads" | "qualificados" | "emContato" | "estados">;

export interface LeadReport {
  summary: LeadSummary;
  phoneCount: number;
  whatsappCount: number;
  segments: { varejo: number; manipulacao: number; homeopatia: number; outros: number };
}

export async function fetchLeadReport(session: SupabaseSession, signal: AbortSignal): Promise<LeadReport> {
  const active = await validSupabaseSession(session);
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/pharmaleads_relatorio`, {
    cache: "no-store", signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
    headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${active.access_token}` },
  });
  if (response.status === 401) throw new AccessError("Sua sessão expirou. Entre novamente na plataforma.");
  if (response.status === 404) throw new Error("Relatórios precisam da migração 12_relatorios_agregados.sql no Supabase.");
  if (!response.ok) throw new Error(`Não foi possível consultar os relatórios (HTTP ${response.status}).`);
  const report = await response.json() as LeadReport;
  const numeric = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0;
  if (!report?.summary || !report.segments
      || ![report.summary.totalLeads, report.summary.estados, report.phoneCount, report.whatsappCount,
        report.summary.qualificados, report.summary.emContato, report.summary.respondidos,
        report.summary.naoQualificados, report.summary.naoContatados,
        report.segments.varejo, report.segments.manipulacao, report.segments.homeopatia, report.segments.outros].every(numeric)
      || ![report.summary.origem?.googleMaps, report.summary.origem?.googleMeuNegocio,
        report.summary.origem?.outrasFontes].every(origin => origin && numeric(origin.count) && numeric(origin.percent))) {
    throw new Error("O Supabase retornou um relatório inválido.");
  }
  return report;
}

export async function fetchRemoteLeadMetrics(session: SupabaseSession, signal: AbortSignal) {
  const active = await validSupabaseSession(session);
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/leads_resumo`, {
    cache: "no-store",
    headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${active.access_token}` },
    signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
  });
  if (response.status === 401) throw new AccessError("Sua sessão expirou. Entre novamente na plataforma.");
  if (!response.ok) throw new Error("Não foi possível carregar as métricas da carteira.");
  const [metrics] = (await response.json()) as LeadMetrics[];
  if (!metrics) throw new Error("O Supabase não retornou as métricas da carteira.");
  return metrics;
}

const restValue = (value: string) => `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
const OUTSIDE_CRM = "(crm_included.eq.false,and(crm_included.is.null,or(crm_status.is.null,crm_status.eq.Não contatado)))";

export async function fetchCrmCandidates(session: SupabaseSession, term: string, signal: AbortSignal) {
  const active = await validSupabaseSession(session);
  const query = new URLSearchParams({ select: SUPABASE_LIST_COLUMNS, order: "chave.asc", limit: "31", or: OUTSIDE_CRM });
  if (term.trim()) {
    const pattern = restValue(`%${term.trim().replace(/[\\%_]/g, "\\$&")}%`);
    query.set("and", `(or(nome.ilike.${pattern},local_busca.ilike.${pattern},uf_prospeccao.ilike.${pattern}))`);
  }
  const response = await fetchLeadTable(query, { cache: "no-store", signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]),
    headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${active.access_token}` } });
  if (response.status === 401) throw new AccessError("Sua sessão expirou. Entre novamente na plataforma.");
  if (!response.ok) throw new Error(`Não foi possível buscar contatos para o CRM (HTTP ${response.status}).`);
  return mapRawLeadsToItems(await response.json() as Lead[]);
}

function applyRemoteLeadFilters(query: URLSearchParams, filters: RemoteLeadFilters) {
  if (!filters.includeCrm) query.set("or", OUTSIDE_CRM);
  if (filters.uf) query.set("uf_prospeccao", `eq.${filters.uf}`);
  if (filters.origem && filters.origem !== "Todas as origens") query.set("fonte_prospeccao", `eq.${filters.origem}`);
  if (filters.segmentos.length) query.set("segmento", `in.(${filters.segmentos.map(restValue).join(",")})`);
  if (filters.emailAvailability === "com") query.set("emails", "like.*@*.*");
  if (filters.emailAvailability === "sem") query.set("emails", "eq.");
  const term = filters.query.trim();
  if (term) {
    const pattern = term.replace(/[\\%_]/g, "\\$&");
    query.append("and", `(or(${["nome", "dados_brutos->>cnpj", "telefone", "emails", "categoria"]
      .map(column => `${column}.ilike.${restValue(`%${pattern}%`)}`).join(",")}))`);
  }
}

export async function countRemoteLeads(session: SupabaseSession, filters: RemoteLeadFilters, signal: AbortSignal) {
  let active = await validSupabaseSession(session);
  if (filters.whatsappConfirmed) {
    const deleted = loadDeletedIds();
    let total = 0;
    for await (const batch of readConfirmedLeads(active, filters, { limit: 75, idsOnly: true, signal })) {
      total += batch.filter(row => !deleted.has(row.chave)).length;
    }
    return total;
  }
  const query = new URLSearchParams({ select: "chave", limit: "1" });
  applyRemoteLeadFilters(query, filters);
  const response = await fetch(`${SUPABASE_URL}/rest/v1/pharmaleads?${query}`, {
    method: "HEAD", cache: "no-store", signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]),
    headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${active.access_token}`, Prefer: "count=exact" },
  });
  if (response.status === 401) throw new AccessError("Sua sessão expirou. Entre novamente na plataforma.");
  const count = response.headers.get("content-range")?.split("/")[1];
  if (response.ok && count && /^\d+$/.test(count)) return Number(count);
  if (!response.ok && response.status < 500) throw new Error(`Não foi possível contar os leads (HTTP ${response.status}).`);

  // O COUNT global pode atingir o limite do Supabase. Pagine só as chaves,
  // com o mesmo filtro, usando o índice da chave para dividir o trabalho.
  const pageSize = 500;
  let total = 0;
  let cursor: string | undefined;
  while (true) {
    signal.throwIfAborted();
    const page = await readRemoteLeads(active, filters, { limit: pageSize, idsOnly: true, cursor, signal });
    total += page.ids.length;
    if (!page.cursor || page.rowCount < pageSize) return total;
    if (cursor === page.cursor) throw new Error("O Supabase repetiu a página durante a contagem.");
    cursor = page.cursor;
    active = page.session;
  }
}

interface RemoteReadOptions {
  limit: number;
  cursor?: string;
  since?: string;
  createdSince?: string;
  peek?: boolean;
  idsOnly?: boolean;
  ids?: string[];
  signal?: AbortSignal;
}

type RemoteLeadRow = Lead & NonNullable<Lead["dados_brutos"]> & {
  uf_prospeccao?: string;
  fonte_prospeccao?: LeadItem["origem"];
};

async function fetchRemoteLeadRows(active: SupabaseSession, filters: RemoteLeadFilters, options: RemoteReadOptions) {
  const query = new URLSearchParams({
    select: options.idsOnly ? (filters.whatsappConfirmed ? "chave,whatsapp_verificacao" : "chave")
      : SUPABASE_LIST_COLUMNS + ",uf_prospeccao,fonte_prospeccao",
    order: "chave.asc",
    limit: String(options.limit + Number(Boolean(options.peek))),
  });
  applyRemoteLeadFilters(query, filters);
  if (options.since) query.set("ultima_coleta", `gte.${options.since}`);
  if (options.createdSince) query.set("primeira_coleta", `gte.${options.createdSince}`);
  if (options.cursor) query.set("chave", `gt.${options.cursor}`);
  if (options.ids) query.append("chave", `in.(${options.ids.map(restValue).join(",")})`);
  const response = await fetchLeadTable(query, {
    cache: "no-store",
    headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${active.access_token}` },
    signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000),
  });
  if (response.status === 401) throw new AccessError("Sua sessão expirou. Entre novamente na plataforma.");
  if (!response.ok) throw new Error(`Não foi possível consultar os leads (HTTP ${response.status}).`);
  return (await response.json()) as RemoteLeadRow[];
}

async function* readConfirmedLeads(active: SupabaseSession, filters: RemoteLeadFilters, options: RemoteReadOptions) {
  if (!whatsappColumnAvailable) throw new Error("A verificação de WhatsApp ainda precisa ser ativada no Supabase.");
  const pageSize = 500;
  // A ordem acompanha o índice parcial. Os demais filtros são aplicados por chave
  // para evitar varrer a tabela completa quando há poucas verificações.
  const query = new URLSearchParams({ select: "chave,whatsapp_verificacao", whatsapp_verificacao: "not.is.null",
    order: "whatsapp_verificacao->>estado.asc,chave.asc", limit: String(pageSize) });
  const ids = options.ids ? new Set(options.ids) : undefined;
  const seen = new Set<string>();
  for (let offset = 0; ; offset += pageSize) {
    options.signal?.throwIfAborted();
    query.set("offset", String(offset));
    const response = await fetch(`${SUPABASE_URL}/rest/v1/pharmaleads?${query}`, {
      cache: "no-store", headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${active.access_token}` },
      signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000),
    });
    if (response.status === 401) throw new AccessError("Sua sessão expirou. Entre novamente na plataforma.");
    if (!response.ok) throw new Error(`Não foi possível consultar as verificações de WhatsApp (HTTP ${response.status}).`);
    const rows = (await response.json()) as Pick<Lead, "chave" | "whatsapp_verificacao">[];
    const keys = rows.filter(row => row.whatsapp_verificacao?.estado === "confirmado"
      && (!ids || ids.has(row.chave)) && !seen.has(row.chave)).map(row => row.chave);
    for (const key of keys) seen.add(key);
    for (let index = 0; index < keys.length; index += 75) {
      const batch = keys.slice(index, index + 75);
      const leads = await fetchRemoteLeadRows(active, filters, { ...options, ids: batch, limit: batch.length, peek: false });
      yield leads.filter(lead => lead.whatsapp_verificacao?.estado === "confirmado");
    }
    if (rows.length < pageSize) return;
  }
}

export async function readRemoteLeads(session: SupabaseSession, filters: RemoteLeadFilters, options: RemoteReadOptions) {
  const active = await validSupabaseSession(session);
  let fetched: RemoteLeadRow[];
  if (filters.whatsappConfirmed) {
    fetched = [];
    const limit = options.limit + Number(Boolean(options.peek));
    for await (const batch of readConfirmedLeads(active, filters, options)) {
      fetched.push(...batch);
      if (fetched.length >= limit) break;
    }
    fetched = fetched.slice(0, limit);
  } else {
    fetched = await fetchRemoteLeadRows(active, filters, options);
  }
  const rows = options.peek ? fetched.slice(0, options.limit) : fetched;
  const deleted = loadDeletedIds();
  const geografia = new Map(rows.map(row => [row.chave, row]));
  const items = options.idsOnly ? [] : mapRawLeadsToItems(rows.map(
    ({ cnpj, cnpj_origem, cnpj_confianca, fonte_dados, enriquecimento_site, avaliacoes_recentes, ...row }) => ({
      ...row, dados_brutos: row.dados_brutos ?? { cnpj, cnpj_origem, cnpj_confianca, fonte_dados, enriquecimento_site, avaliacoes_recentes },
    }),
  )).map(item => {
    const row = geografia.get(item.id);
    return { ...item, uf: row?.uf_prospeccao ?? item.uf, origem: row?.fonte_prospeccao ?? item.origem };
  }).filter(item => (filters.includeCrm || (!item.crmIncluded && item.status === "Não contatado"))
    && (filters.emailAvailability === "todos" || (parseLeadEmails(item.email).length > 0) === (filters.emailAvailability === "com")));
  return { session: active, items, hasNext: options.peek && fetched.length > options.limit,
    ids: rows.map(row => row.chave).filter(id => !deleted.has(id)), cursor: rows.at(-1)?.chave, rowCount: rows.length };
}

export async function saveWhatsAppVerification(session: SupabaseSession, id: string, verification: WhatsAppVerification) {
  if (!whatsappColumnAvailable) throw new Error("A verificação de WhatsApp ainda precisa ser ativada no Supabase.");
  const active = await validSupabaseSession(session);
  const query = new URLSearchParams({ chave: `eq.${id}`, select: "chave" });
  const response = await fetch(`${SUPABASE_URL}/rest/v1/pharmaleads?${query}`, {
    method: "PATCH", signal: AbortSignal.timeout(20_000),
    headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${active.access_token}`,
      "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ whatsapp_verificacao: verification }),
  });
  if (response.status === 401) throw new AccessError("Sua sessão expirou. Entre novamente na plataforma.");
  if (!response.ok || ((await response.json()) as { chave: string }[])[0]?.chave !== id) {
    throw new Error("Não foi possível salvar a verificação de WhatsApp no Supabase.");
  }
  return active;
}

export async function* walkRemoteLeads(
  session: SupabaseSession, filters: RemoteLeadFilters,
  options: { since?: string; idsOnly?: boolean; signal?: AbortSignal },
) {
  let cursor: string | undefined;
  while (true) {
    const page = await readRemoteLeads(session, filters, { ...options, cursor, limit: options.idsOnly ? 500 : 250 });
    session = page.session;
    if (!page.cursor) break;
    if (page.cursor === cursor) throw new Error("A paginação do Supabase retornou a mesma chave.");
    yield page;
    cursor = page.cursor;
  }
}

export async function addRemoteLeadsToCrm(session: SupabaseSession, ids: string[]) {
  const active = await validSupabaseSession(session);
  const query = new URLSearchParams({ chave: `in.(${ids.map(restValue).join(",")})`, or: OUTSIDE_CRM, select: "chave" });
  const response = await fetch(`${SUPABASE_URL}/rest/v1/pharmaleads?${query}`, {
    method: "PATCH",
    headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${active.access_token}`,
      "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ crm_included: true, crm_status: "Em contato" }),
    signal: AbortSignal.timeout(20_000),
  });
  if (response.status === 401) throw new AccessError("Sua sessão expirou. Entre novamente na plataforma.");
  if (!response.ok) throw new Error(`Falha ao adicionar leads ao CRM (HTTP ${response.status}).`);
  const rows = (await response.json()) as Pick<Lead, "chave">[];
  return { session: active, moved: rows.map(row => row.chave) };
}

export async function updateSupabaseCrmLead(
  session: SupabaseSession,
  id: string,
  fields: Partial<Pick<Lead, "crm_included" | "crm_status">>
): Promise<{ session: SupabaseSession; row: Lead }> {
  const active = await validSupabaseSession(session);
  const query = new URLSearchParams({ chave: `eq.${id}`, select: SUPABASE_COLUMNS });
  const response = await fetch(`${SUPABASE_URL}/rest/v1/pharmaleads?${query}`, {
    method: "PATCH",
    headers: {
      apikey: PUBLISHABLE_KEY,
      Authorization: `Bearer ${active.access_token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(fields),
  });
  const body = (await response.json().catch(() => [])) as Lead[] | { message?: string; details?: string };
  if (response.status === 401) throw new AccessError("Sua sessão expirou. Entre novamente na plataforma.");
  if (!response.ok) {
    const message = !Array.isArray(body) ? body.message || body.details : undefined;
    throw new Error(message || `Não foi possível atualizar o lead no Supabase (HTTP ${response.status}).`);
  }
  const rows = Array.isArray(body) ? body : [];
  if (!rows[0]) throw new Error("O Supabase não encontrou o lead para atualizar.");
  return { session: active, row: rows[0] };
}

// ---------- API Local Python (SQLite + Gosom em 127.0.0.1:8765 via /api/*) ----------

export async function fetchLocalApiStatus(): Promise<LocalApiStatus | null> {
  try {
    const response = await fetch("/api/status", {
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) return null;
    return (await response.json()) as LocalApiStatus;
  } catch {
    return null;
  }
}

export async function fetchLocalAllLeads(): Promise<Lead[]> {
  const rows: Lead[] = [];
  let offset = 0;
  while (true) {
    const response = await fetch(`/api/leads?offset=${offset}`);
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error || `Erro na API local (HTTP ${response.status}).`);
    }
    const page = (await response.json()) as {
      items: Lead[];
      total: number;
      next_offset: number | null;
    };
    rows.push(...page.items);
    if (page.next_offset == null || !page.items.length || rows.length >= page.total) {
      break;
    }
    offset = page.next_offset;
  }
  return rows;
}

export async function startLocalCollection(payload: {
  locais: string[];
  segmentos: string[];
  profundidade: number;
  emails: boolean;
}): Promise<{ id: number }> {
  const response = await fetch("/api/coletas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await response.json().catch(() => ({}))) as { id?: number; error?: string };
  if (!response.ok || body.id == null) {
    throw new Error(body.error || `Falha ao iniciar coleta local (HTTP ${response.status}).`);
  }
  return { id: body.id };
}

export async function stopLocalCollection(): Promise<boolean> {
  const response = await fetch("/api/coletas/parar", { method: "POST" });
  const body = (await response.json().catch(() => ({}))) as { parando?: boolean; error?: string };
  if (!response.ok) {
    throw new Error(body.error || "Falha ao solicitar parada da coleta local.");
  }
  return Boolean(body.parando);
}

// ---------- Coletor Nuvem (/api/collector -> Render) ----------

export async function fetchCloudCollectorRun(
  session: SupabaseSession, signal?: AbortSignal
): Promise<{ session: SupabaseSession; run: CollectorRun | null }> {
  const active = await validSupabaseSession(session);
  const response = await fetch("/api/collector", {
    headers: { Authorization: `Bearer ${active.access_token}` },
    cache: "no-store",
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(45_000)]) : AbortSignal.timeout(45_000),
  });
  const body = ((await response.json().catch(() => null)) ?? {}) as {
    run?: CollectorRun | null;
    error?: string;
  };
  if (response.status === 401) throw new AccessError("Sua sessão expirou. Entre novamente na plataforma.");
  if (!response.ok) {
    throw new Error(body.error || `Coletor em nuvem indisponível (HTTP ${response.status}).`);
  }
  if (body.run !== null && (!body.run || typeof body.run.status !== "string")) {
    throw new Error("Resposta inválida do coletor no Render.");
  }
  return { session: active, run: body.run };
}

export async function controlCloudCollector(
  session: SupabaseSession,
  payload: {
    action: "start" | "stop";
    cobertura?: "nacional" | "estadual";
    uf?: string;
    locais?: string;
    segmentos?: string[];
    profundidade?: number;
    emails?: boolean;
    enriquecerSites?: boolean;
  }
): Promise<{ session: SupabaseSession; run: CollectorRun | null }> {
  const active = await validSupabaseSession(session);
  const response = await fetch("/api/collector", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${active.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(45_000),
  });
  const body = ((await response.json().catch(() => null)) ?? {}) as {
    run?: CollectorRun | null;
    error?: string;
  };
  if (response.status === 401) throw new AccessError("Sua sessão expirou. Entre novamente na plataforma.");
  if (!response.ok) {
    throw new Error(body.error || `Falha ao controlar coleta em nuvem (HTTP ${response.status}).`);
  }
  if (body.run !== null && (!body.run || typeof body.run.status !== "string")) {
    throw new Error("Resposta inválida do coletor no Render.");
  }
  return { session: active, run: body.run };
}

// ---------- Conversão e Mapeamento de Lead (SQLite / Supabase -> UI LeadItem) ----------

const UFS_BRASIL = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO",
]);

function extractCidadeUf(row: Lead): { cidade: string; uf: string } {
  const local = (row.local_busca || "").trim();
  const matches = [...(row.endereco || "").matchAll(/,\s*([^,-]+?)\s*-\s*([A-Z]{2})(?:,|$)/g)];
  const matchEndereco = matches.reverse().find((match) => UFS_BRASIL.has(match[2].toUpperCase()));
  if (matchEndereco) {
    return { cidade: matchEndereco[1].trim(), uf: matchEndereco[2].toUpperCase() };
  }
  const matchLocal = /^(.+?),\s*([A-Z]{2})$/i.exec(local);
  if (matchLocal) {
    const uf = matchLocal[2].toUpperCase();
    return { cidade: matchLocal[1].trim(), uf: UFS_BRASIL.has(uf) ? uf : "" };
  }
  return { cidade: local || "Não informado", uf: "" };
}

function extractBairro(endereco: string): string {
  if (!endereco) return "";
  const match = /-\s*([^,-]+?),\s*[^,-]+?\s*-\s*[A-Z]{2}/.exec(endereco);
  if (match && match[1]) {
    const candidate = match[1].trim();
    if (candidate.length >= 2 && candidate.length <= 45 && !/^\d+$/.test(candidate)) {
      return candidate;
    }
  }
  return "";
}

export function mapRawLeadsToItems(rows: Lead[]): LeadItem[] {
  const overrides = loadCrmOverrides();
  const deleted = loadDeletedIds();

  return rows
    .filter((row) => !deleted.has(row.chave))
    .map((row) => {
      const { cidade, uf } = extractCidadeUf(row);
      const bairro = extractBairro(row.endereco || "");
      const override = overrides[row.chave];
      const persistedCrmStatus = ["Qualificado", "Em contato", "Respondido", "Não qualificado", "Não contatado"].includes(row.crm_status || "")
        ? (row.crm_status as LeadStatus)
        : undefined;
      const avaliacaoNum = row.avaliacao ? Number(Number(row.avaliacao).toFixed(1)) : undefined;
      const qtdNum = row.qtd_avaliacoes ? Number(row.qtd_avaliacoes) : undefined;
      const verification = row.whatsapp_verificacao ?? undefined;
      const verifiedNumber = verification?.estado === "confirmado" ? normalizeWhatsAppNumber(verification.numero) : undefined;

      return {
        id: row.chave,
        nome: row.nome || "Estabelecimento Farmacêutico",
        cnpj: row.dados_brutos?.cnpj || "",
        cnpjOrigem: row.dados_brutos?.cnpj_origem,
        cnpjConfianca: row.dados_brutos?.cnpj_confianca,
        cidade,
        uf,
        bairro,
        telefone: row.telefone || row.telefone_normalizado || "Não informado",
        whatsappLink: verifiedNumber ? whatsAppUrl(verifiedNumber) : undefined,
        whatsappVerificacao: verification,
        whatsappPublicado: publishedWhatsAppNumber(row.dados_brutos?.enriquecimento_site?.whatsapp_link),
        // Dados não contatados iniciam zerados nas métricas de Qualificados / Em contato / Respondido
        status: row.crm_included === false ? "Não contatado" : persistedCrmStatus || override?.status || "Não contatado",
        origem: row.dados_brutos?.fonte_dados === "Receita Federal" ? "Receita Federal"
          : row.dados_brutos?.fonte_dados === "Google Meu Negócio" ? "Google Meu Negócio" : "Google Maps",
        endereco: row.endereco || undefined,
        categoria: row.categoria || row.segmento || "Farmácia",
        segmento: row.segmento || "",
        situacao: row.situacao || "ativa_ou_desconhecida",
        site: row.site || undefined,
        email: row.emails || undefined,
        avaliacao: Number.isFinite(avaliacaoNum) ? avaliacaoNum : undefined,
        qtdAvaliacoes: Number.isFinite(qtdNum) ? qtdNum : undefined,
        avaliacoesRecentes: row.dados_brutos?.avaliacoes_recentes,
        link: row.link || undefined,
        ultimaColeta: row.ultima_coleta || undefined,
        updatedAt: override?.updatedAt,
        crmIncluded: typeof row.crm_included === "boolean" ? row.crm_included : override?.crmIncluded ?? false,
      };
    });
}

export function computeSummaryFromItems(items: LeadItem[]): LeadSummary {
  const totalLeads = items.length;
  if (totalLeads === 0) {
    return {
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
  }

  let qualificados = 0;
  let emContato = 0;
  let respondidos = 0;
  let naoContatados = 0;
  let naoQualificados = 0;
  let mapsCount = 0;
  let gmbCount = 0;
  let outrasCount = 0;
  const ufs = new Set<string>();

  for (const item of items) {
    if (item.uf) ufs.add(item.uf);
    if (item.status === "Qualificado") qualificados++;
    else if (item.status === "Em contato") emContato++;
    else if (item.status === "Respondido") respondidos++;
    else if (item.status === "Não qualificado") naoQualificados++;
    else naoContatados++;

    if (item.origem === "Google Maps") mapsCount++;
    else if (item.origem === "Google Meu Negócio") gmbCount++;
    else outrasCount++;
  }

  const mapsPct = Math.round((mapsCount / totalLeads) * 100);
  const gmbPct = Math.round((gmbCount / totalLeads) * 100);
  const outrasPct = Math.max(0, 100 - mapsPct - gmbPct);

  return {
    totalLeads,
    qualificados,
    emContato,
    respondidos,
    naoContatados,
    naoQualificados,
    estados: ufs.size,
    origem: {
      googleMaps: { percent: mapsPct, count: mapsCount },
      googleMeuNegocio: { percent: gmbPct, count: gmbCount },
      outrasFontes: { percent: outrasPct, count: outrasCount },
    },
  };
}

export function computeUfCoverage(items: LeadItem[]): Record<string, { total: number; ultima: string }> {
  const map: Record<string, { total: number; ultima: string }> = {};
  for (const item of items) {
    if (!item.uf) continue;
    const current = map[item.uf] || { total: 0, ultima: "" };
    current.total += 1;
    if (item.ultimaColeta && item.ultimaColeta > current.ultima) {
      current.ultima = item.ultimaColeta;
    }
    map[item.uf] = current;
  }
  return map;
}

export function filterLeadItems(
  allItems: LeadItem[],
  params: LeadFilterParams
): LeadItem[] {
  const {
    query = "",
    statusTab = "Todos",
    uf = "",
    statusSelect = "",
    origem = "",
    segmentos = [],
    emailAvailability = "todos",
  } = params;

  const q = query.trim().toLowerCase();

  return allItems.filter((item) => {
    if (q) {
      const searchable = `${item.nome} ${item.cnpj} ${item.telefone} ${item.email || ""} ${item.categoria || ""}`.toLowerCase();
      if (!searchable.includes(q)) return false;
    }
    if (statusTab && statusTab !== "Todos" && item.status !== statusTab) {
      return false;
    }
    if (statusSelect && statusSelect !== "Todos os status" && item.status !== statusSelect) {
      return false;
    }
    if (uf && item.uf !== uf) {
      return false;
    }
    if (origem && origem !== "Todas as origens" && item.origem !== origem) {
      return false;
    }
    if (segmentos.length && !segmentos.includes(item.segmento || "")) {
      return false;
    }
    if (emailAvailability !== "todos" && (parseLeadEmails(item.email).length > 0) !== (emailAvailability === "com")) {
      return false;
    }
    return true;
  });
}

export function paginateLeadItems(
  filtered: LeadItem[],
  { page = 1, pageSize = 5 }: Pick<LeadFilterParams, "page" | "pageSize">
): LeadPaginationResult {

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);

  return {
    items,
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}

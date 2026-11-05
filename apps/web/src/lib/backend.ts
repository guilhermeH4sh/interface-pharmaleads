import type { Lead, Status as LocalApiStatus } from "./crm";
import type {
  LeadFilterParams,
  LeadItem,
  LeadPaginationResult,
  LeadStatus,
  LeadSummary,
} from "./mock-leads";

// Configuração oficial do Supabase (mesma utilizada em HostedDashboard.tsx)
export const SUPABASE_URL = "https://qxsdcrywsjkrpcbfgbxb.supabase.co";
export const PUBLISHABLE_KEY = "sb_publishable_9AdBAjeEHFysAVpC7VCLMw_cDgQ4Fl0";
export const AUTHORIZED_USER_ID = "677ed1e4-3e73-4f2c-951f-e77386f305da";
export const SESSION_KEY = "pharmaleads-supabase-session";
export const CRM_STORAGE_KEY = "pharmaleads-crm-overrides";
export const DELETED_STORAGE_KEY = "pharmaleads-deleted-ids";

const SUPABASE_COLUMNS =
  "chave,nome,segmento,categoria,endereco,local_busca,telefone,telefone_normalizado,celular,whatsapp_link,site,emails,situacao,avaliacao,qtd_avaliacoes,latitude,longitude,link,ultima_coleta";

export const COLETA_ATIVA_STATES = ["queued", "in_progress", "waiting", "pending", "requested"];

export type DataSourceMode = "local" | "supabase" | "mock";

export interface SupabaseSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  email?: string;
}

export interface CollectorRun {
  id: number;
  status: string;
  conclusion: string | null;
  url: string;
  created_at: string;
  title: string;
}

export interface UfCoverageItem {
  sigla: string;
  total: number;
  ultima: string;
}

export class AccessError extends Error { }

interface CrmOverride {
  status?: LeadStatus;
  responsavel?: string;
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

export function setBatchLeadStatusOverride(ids: string[], status: LeadStatus): void {
  const map = loadCrmOverrides();
  const now = Date.now();
  for (const id of ids) {
    map[id] = { ...map[id], status, updatedAt: now };
  }
  saveCrmOverrides(map);
}

export function setBatchLeadResponsibleOverride(ids: string[], responsavel: string): void {
  const map = loadCrmOverrides();
  for (const id of ids) {
    map[id] = { ...map[id], responsavel };
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
    const value = window.sessionStorage.getItem(SESSION_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as SupabaseSession;
    return parsed.access_token && parsed.refresh_token && Number.isFinite(parsed.expires_at)
      ? parsed
      : null;
  } catch {
    return null;
  }
}

export function clearSupabaseSession(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(SESSION_KEY);
}

export async function authenticateSupabase(
  grant: "password" | "refresh_token",
  fields: Record<string, string>,
  customUrl = SUPABASE_URL,
  customKey = PUBLISHABLE_KEY
): Promise<SupabaseSession> {
  const response = await fetch(`${customUrl}/auth/v1/token?grant_type=${grant}`, {
    method: "POST",
    headers: { apikey: customKey, "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  const body = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    user?: { id?: string; email?: string };
  };
  if (!response.ok || !body.access_token || !body.refresh_token || !body.expires_in) {
    throw new AccessError(
      grant === "password"
        ? "Login não autorizado. Confira e-mail e senha da conta Supabase."
        : "Sessão expirada. Entre novamente."
    );
  }
  if (body.user?.id !== AUTHORIZED_USER_ID) {
    clearSupabaseSession();
    throw new AccessError(
      "Esta conta não é o usuário autorizado para public.pharmaleads. Entre com o usuário cadastrado em Supabase Authentication > Users."
    );
  }
  const session: SupabaseSession = {
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    expires_at: Date.now() + body.expires_in * 1000,
    email: body.user?.email || fields.email,
  };
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
  return session;
}

export async function validSupabaseSession(session: SupabaseSession): Promise<SupabaseSession> {
  return session.expires_at > Date.now() + 60_000
    ? session
    : authenticateSupabase("refresh_token", { refresh_token: session.refresh_token });
}

export async function fetchSupabaseAllLeads(
  session: SupabaseSession
): Promise<{ session: SupabaseSession; rows: Lead[] }> {
  const active = await validSupabaseSession(session);
  const identity = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${active.access_token}` },
  });
  if (!identity.ok) throw new AccessError("Sessão inválida ou expirada. Entre novamente.");
  const user = (await identity.json()) as { id?: string };
  if (user.id !== AUTHORIZED_USER_ID) {
    throw new AccessError(
      "Esta conta não tem acesso aos leads. Entre com o usuário autorizado em Supabase Authentication > Users."
    );
  }

  const rows: Lead[] = [];
  let offset = 0;
  while (true) {
    const query = new URLSearchParams({
      select: SUPABASE_COLUMNS,
      order: "chave.asc",
      limit: "500",
      offset: String(offset),
    });
    const response = await fetch(`${SUPABASE_URL}/rest/v1/pharmaleads?${query}`, {
      headers: {
        apikey: PUBLISHABLE_KEY,
        Authorization: `Bearer ${active.access_token}`,
        Prefer: "count=exact",
      },
    });
    if (response.status === 401 || response.status === 403) {
      throw new AccessError("A conta não tem acesso à tabela pharmaleads. Verifique as permissões no Supabase.");
    }
    if (!response.ok) {
      throw new Error(`Consulta ao Supabase falhou (HTTP ${response.status}).`);
    }
    const batch = (await response.json()) as Lead[];
    rows.push(...batch);
    offset += batch.length;
    const total = Number(response.headers.get("content-range")?.split("/")[1]);
    if (
      !batch.length ||
      (Number.isFinite(total) && offset >= total) ||
      (!Number.isFinite(total) && batch.length < 500)
    ) {
      break;
    }
  }
  return { session: active, rows };
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

// ---------- Coletor Nuvem (/api/collector -> GitHub Actions) ----------

export async function fetchCloudCollectorRun(
  session: SupabaseSession
): Promise<{ session: SupabaseSession; run: CollectorRun | null }> {
  const active = await validSupabaseSession(session);
  const response = await fetch("/api/collector", {
    headers: { Authorization: `Bearer ${active.access_token}` },
  });
  const body = (await response.json().catch(() => ({}))) as {
    run?: CollectorRun | null;
    error?: string;
  };
  if (!response.ok) {
    throw new Error(body.error || `Coletor em nuvem indisponível (HTTP ${response.status}).`);
  }
  return { session: active, run: body.run || null };
}

export async function controlCloudCollector(
  session: SupabaseSession,
  payload: {
    action: "start" | "stop";
    cobertura?: "nacional";
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
  });
  const body = (await response.json().catch(() => ({}))) as {
    run?: CollectorRun | null;
    error?: string;
  };
  if (!response.ok) {
    throw new Error(body.error || `Falha ao controlar coleta em nuvem (HTTP ${response.status}).`);
  }
  return { session: active, run: body.run || null };
}

// ---------- Conversão e Mapeamento de Lead (SQLite / Supabase -> UI LeadItem) ----------

function extractCidadeUf(row: Lead): { cidade: string; uf: string } {
  const local = (row.local_busca || "").trim();
  const matchLocal = /^(.+?),\s*([A-Z]{2})$/i.exec(local);
  if (matchLocal) {
    return { cidade: matchLocal[1].trim(), uf: matchLocal[2].toUpperCase() };
  }
  const matchEnd = /,\s*([^,-]+?)\s*-\s*([A-Z]{2})(?:,|$)/.exec(row.endereco || "");
  if (matchEnd) {
    return { cidade: matchEnd[1].trim(), uf: matchEnd[2].toUpperCase() };
  }
  const ufFallback =
    /(?:,|\s)([A-Z]{2})(?:\b|$)/.exec(local)?.[1] ||
    /- ([A-Z]{2})(?:,|$)/.exec(row.endereco || "")?.[1] ||
    "SP";
  return { cidade: local || "Não informado", uf: ufFallback };
}

function extractBairro(endereco: string): string {
  if (!endereco) return "Centro";
  const match = /-\s*([^,-]+?),\s*[^,-]+?\s*-\s*[A-Z]{2}/.exec(endereco);
  if (match && match[1]) {
    const candidate = match[1].trim();
    if (candidate.length >= 2 && candidate.length <= 45 && !/^\d+$/.test(candidate)) {
      return candidate;
    }
  }
  return "Centro";
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
      const avaliacaoNum = row.avaliacao ? Number(Number(row.avaliacao).toFixed(1)) : undefined;
      const qtdNum = row.qtd_avaliacoes ? Number(row.qtd_avaliacoes) : undefined;

      return {
        id: row.chave,
        nome: row.nome || "Estabelecimento Farmacêutico",
        cnpj: "",
        cidade,
        uf,
        bairro,
        telefone: row.telefone || row.telefone_normalizado || "Não informado",
        whatsappLink: row.whatsapp_link || undefined,
        // Dados não contatados iniciam zerados nas métricas de Qualificados / Em contato / Respondido
        status: override?.status || "Não contatado",
        responsavel: override?.responsavel || "Comercial Centrus",
        origem: "Google Maps",
        endereco: row.endereco || undefined,
        categoria: row.categoria || row.segmento || "Farmácia",
        segmento: row.segmento || "varejo",
        situacao: row.situacao || "ativa_ou_desconhecida",
        site: row.site || undefined,
        email: row.emails || undefined,
        avaliacao: Number.isFinite(avaliacaoNum) ? avaliacaoNum : undefined,
        qtdAvaliacoes: Number.isFinite(qtdNum) ? qtdNum : undefined,
        link: row.link || undefined,
        ultimaColeta: row.ultima_coleta || undefined,
        updatedAt: override?.updatedAt,
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
  let mapsCount = 0;
  let gmbCount = 0;
  let outrasCount = 0;
  const ufs = new Set<string>();

  for (const item of items) {
    if (item.uf) ufs.add(item.uf);
    if (item.status === "Qualificado") qualificados++;
    else if (item.status === "Em contato") emContato++;
    else if (item.status === "Respondido") respondidos++;
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

export function filterAndPaginateItems(
  allItems: LeadItem[],
  params: LeadFilterParams
): LeadPaginationResult {
  const {
    query = "",
    statusTab = "Todos",
    uf = "",
    municipio = "",
    bairro = "",
    statusSelect = "",
    origem = "",
    page = 1,
    pageSize = 5,
  } = params;

  const q = query.trim().toLowerCase();

  const filtered = allItems.filter((item) => {
    if (q) {
      const searchable = `${item.nome} ${item.cnpj} ${item.cidade} ${item.uf} ${item.telefone} ${item.bairro} ${item.endereco || ""} ${item.categoria || ""}`.toLowerCase();
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
    if (municipio && item.cidade !== municipio) {
      return false;
    }
    if (bairro && item.bairro !== bairro) {
      return false;
    }
    if (origem && origem !== "Todas as origens" && item.origem !== origem) {
      return false;
    }
    return true;
  });

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

export function buildDynamicLocations(items: LeadItem[]): Record<string, Record<string, string[]>> {
  const hierarchy: Record<string, Record<string, Set<string>>> = {};
  for (const item of items) {
    if (!item.uf || !item.cidade) continue;
    if (!hierarchy[item.uf]) hierarchy[item.uf] = {};
    if (!hierarchy[item.uf][item.cidade]) hierarchy[item.uf][item.cidade] = new Set();
    if (item.bairro) hierarchy[item.uf][item.cidade].add(item.bairro);
  }

  const out: Record<string, Record<string, string[]>> = {};
  for (const uf of Object.keys(hierarchy).sort()) {
    out[uf] = {};
    for (const city of Object.keys(hierarchy[uf]).sort()) {
      out[uf][city] = [...hierarchy[uf][city]].sort();
    }
  }
  return out;
}

